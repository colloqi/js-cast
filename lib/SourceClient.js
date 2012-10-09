/**
 *	@description: This implements an ezstream based icecast source client
 */
var fs= require('fs.extra'),
	clone = require('clone'),
	spawn = require('child_process').spawn;

var DEFAULT_INACTIVITY_TIMEOUT= 5*60; // 5 minutes

//ezstream :
var BASE_CONFIG= {
	url : "http://localhost:8000/vorbis.ogg",
	sourcepassword: "hackme",
	
	format: "VORBIS",
	filename: "stdin",
	stream_once: 1, //to prevent ezstream from spinning endlessly when the input stream stops
	
	//stream description to be supplied to the server	
	svrinfoname: "Live voice stream",
    svrinfourl: "http://www.icecast.org",
    svrinfogenre: "Recorded Voice",
    svrinfodescription: "This is voice broadcasting",
	
    svrinfobitrate: 96,
    svrinfoquality:"2.0",
    svrinfochannels:2,
    svrinfosamplerate: 44100
	//svrinfopublic:1 //Allow the server to advertise the stream on a public YP directory
};

var saveAsXML= function(root, obj, filepath, next){
	var xml= "<"+root+">"+"\n";
	for (var tag in obj){
		xml += "<"+tag+">"+obj[tag]+"</"+tag+">"+"\n";
	}
	xml += "</"+root+">";
	fs.writeFile(filepath, xml, function (err) {
		next(err);
	});
};

var ARGS_OGGENC= "-B 16 -C 1 -R 22050 --raw-endianness 1 -";

var SourceClient= function(id, config_dir, options, callback){
	var self= this;
	
	this._id= id;
	this._evt_handler= callback;
	this._last_activity_ts= Date.now();
	this._config_file= config_dir +"/"+ id +".xml";
	
	var config= clone(BASE_CONFIG);
	config.url= options.server + id +".ogg";
	this._url= config.url;
	this._name= options.info.name;
	this._description= options.info.description;
	this._inactivity_timeout= (options.inactivity_timeout || DEFAULT_INACTIVITY_TIMEOUT)*1000;
	this._inactivity_timer= setInterval(this.handleInactivityTimer.bind(this), this._inactivity_timeout);
	for (var config_name in config){
		if (options[config_name]){
			config[config_name]= options[config_name];
		}
	}
	if (options.info){
		for (name in options.info){
			config["svrinfo"+name]= options.info[name];
		}
	}
	
	//in node version 0.6.x chmodsync is not working. This is a workaround for that.
	var fd= fs.openSync(this._config_file, "w", 0644);
	fs.closeSync(fd);
	
	//create config file for ezstream
	saveAsXML("ezstream", config, this._config_file, function(err){
		if (err){
			self._log("Error creating ezstream config file.");
			self._sendError(err);
		}
		else {
			self._spawnProcesses();
		}
	});
};

SourceClient.STARTED= 0x001;
SourceClient.ENDED= 0x002;

SourceClient.LOG= 0x1002;
SourceClient.ERROR= 0x1004;


SourceClient.prototype.getUrl= function(){
	return this._url;	
};

SourceClient.prototype.getName= function(){
	return this._name;
};

SourceClient.prototype.getDescription= function(){
	return this._description;
};

SourceClient.prototype.getId= function(){
	return this._id;
};

SourceClient.prototype._spawnProcesses= function(){
	var self= this;
	
	var ezstream= spawn("ezstream", ["-c", this._config_file]);
    ezstream.stderr.on('data', function (err) {
		slef._log('ezstream stderr: ' + err);
    });
    ezstream.stdout.on("data", function(d){
		self._log("ezstream stdout=>"+d);
    });
    ezstream.on('exit', function (code) {
		if (code !== 0) {
			self._log('ezstream process exited with code ' + code);
		}
		else {
			self._log("ezstream exited normally.");
		}
		ezstream= null;
		self._ezstream= null;
		self._send(SourceClient.ENDED);
    });
	this._ezstream= ezstream;
	
	var oggenc= spawn("oggenc", ARGS_OGGENC.split(" "));
    oggenc.stdout.pipe(self._ezstream.stdin, {end: false});
	oggenc.on('exit', function(){
		self._oggenc= null;
	})
	this._oggenc= oggenc;
	
	this._send(SourceClient.STARTED);
};

SourceClient.prototype.pipe= function(stream){
	stream.pipe(this._oggenc.stdin, {end: false});	
};

SourceClient.prototype.destroy= function(){
	this._ezstream.kill('SIGKILL');
	this._oggenc.kill('SIGKILL');
	this._oggenc= null;
	this._ezstream= null;
	clearInterval(this._inactivity_timer);
};

SourceClient.prototype._send= function(code, msg){
	this._evt_handler({code: code}, msg|| this);	
};

SourceClient.prototype._log= function(msg){
	this._send(SourceClient.LOG, msg);
};

SourceClient.prototype._sendError= function(msg){
	this._send(SourceClient.ERROR, msg);
};

SourceClient.prototype.handleInactivityTimer= function(){
	var inactivity_duration= Date.now() - this._last_activity_ts;
	if (inactivity_duration > this._inactivity_timeout){
		this._log("Destroying client due to inactivity timeout:" +inactivity_duration);
		this.destroy();
	}
};


module.exports= SourceClient;

