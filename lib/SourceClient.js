/**
 *	@description: This implements an ezstream based icecast source client
 */
var fs = require('fs.extra'),
	clone = require('clone'),
	spawn = require('child_process').spawn,
	util = require('util'),
	EventEmitter = require('events').EventEmitter ;

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

var SourceClient= function(id, config_dir, options){
	var self= this;
	
	this._id= id;
	this._last_activity_ts= Date.now();
	this._config_file= config_dir +"/"+ id +".xml";
	
	var config= clone(BASE_CONFIG);
	config.url= options.server + id +".ogg";
	this._url= config.url;
	this._name= options.info.name;
	this._description= options.info.description;
	this._encoder_bin= options.encoder;
    this._encoder_args= options.encoder_args;
	this._inactivity_timeout= (options.inactivity_timeout || DEFAULT_INACTIVITY_TIMEOUT)*1000;
	this._inactivity_timer= setInterval(this.handleInactivityTimer.bind(this), 5000);//5s
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
	if (options.savefile){
		this._savefile= options.savefile;
	}
	this.config= config;
	
	EventEmitter.call(this);
};

SourceClient.prototype.start= function(){
	//in node version 0.6.x chmodsync is not working. This is a workaround for that.
	var fd= fs.openSync(this._config_file, "w", 0644);
	fs.closeSync(fd);
	
	var self= this;
	//create config file for ezstream
	saveAsXML("ezstream", this.config, this._config_file, function(err){
		if (err){
			self.emit("error", "Error creating ezstream config file.", err);
		}
		else {
			self._spawnProcesses();
		}
	});
};

util.inherits(SourceClient, EventEmitter);

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
		slef.emit("data", 'ezstream stderr: ' + err);
    });
    ezstream.stdout.on("data", function(d){
		self.emit("data", "ezstream stdout=>"+d);
    });
    ezstream.on('exit', function (code) {
		if (code !== 0) {
			self.emit("data", 'ezstream process exited with code ' + code);
		}
		else {
			self.emit("data", "ezstream exited normally.");
		}
		ezstream= null;
		self._ezstream= null;
		self.emit("end");
    });
	this._ezstream= ezstream;
	
	var encoder= spawn(self._encoder_bin, self._encoder_args.split(" "));
    encoder.stdout.pipe(self._ezstream.stdin, {end: false});
	encoder.on('exit', function(){
		self._encoder= null;
	})
	this._encoder= encoder;
	if (this._savefile){
        var f= fs.createWriteStream(this._savefile, { flags: 'w', encoding: "binary", mode: 0666 });
        this._encoder.stdout.pipe(f, {end: false});
    }
	this.emit("start");
};

SourceClient.prototype.pipe= function(stream){
	this._last_activity_ts= Date.now();
	stream.pipe(this._encoder.stdin, {end: false});	
};

SourceClient.prototype.destroy= function(){
	this._ezstream.kill('SIGKILL');
	this._encoder.kill('SIGKILL');
	this._encoder= null;
	this._ezstream= null;
	clearInterval(this._inactivity_timer);
};

SourceClient.prototype.handleInactivityTimer= function(){
	var inactivity_duration= Date.now() - this._last_activity_ts;
	if (inactivity_duration > this._inactivity_timeout){
		this.emit("data", "Destroying client due to inactivity timeout:" +inactivity_duration);
		this.destroy();
	}
};

module.exports= SourceClient;

