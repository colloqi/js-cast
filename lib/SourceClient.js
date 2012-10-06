/**
 *	@description: This implements an ezstream based icecast source client
 */
var fs= require('fs.extra'),
	fsb= require('fs'),
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
	svrinfoname: "My Stream",
    svrinfourl: "http://www.oddsock.org",
    svrinfogenre: "RockNRoll",
    svrinfodescription: "This is a stream description",
	
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
		if (err) {
			console.log("errror while writing to file");
			console.log(err);
			next(err);
		}
		else {
			next();
		}
	});
};

var ARGS_OGGENC= "-B 16 -C 1 -R 22050 --raw-endianness 1 -";

var SourceClient= function(id, config_dir, options, callback){
	this._id= id;
	this._evt_handler= callback;
	this._last_activity_ts= Date.now();
	this._config_file= config_dir +"/"+ id +".xml";
	var self= this;
	var config= clone(BASE_CONFIG);
	config.url= options.server + id +".ogg";
	this._url= config.url;
	this._name= options.info.name;
	this._description= options.info.description;
	if (options.info){
		for (name in options.info){
			config["svrinfo"+name]= options.info[name];
		}
	}
	
	var fd= fs.openSync(this._config_file, "w", 0644);
	fs.closeSync(fd);
	//create config file for ezstream
	saveAsXML("ezstream", config, this._config_file, function(err){
		if (err){
			console.log("error creating config file");
		}
		else {
			self._spawnProcesses();
		}
	});
};

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
	var oggenc= spawn("oggenc", ARGS_OGGENC.split(" "));
    oggenc.stdout.on("data", function(vorbis_data){
		console.log("writing to ezstream");
		self._ezstream.stdin.write(vorbis_data);
	});
	this._oggenc= oggenc;
	
	var ezstream= spawn("ezstream", ["-c", this._config_file]);
    ezstream.stderr.on('data', function (err) {
		console.log('ps stderr: ' + err);
    });
    ezstream.stdout.on("data", function(d){
		console.log("stdout=>"+d);
    });
    ezstream.on('exit', function (code) {
		console.log("ezstream exited");
		if (code !== 0) {
			console.log('ps process exited with code ' + code);
		}
		ezstream= null;
		self._send(SourceClient.ENDED);
		console.log(arguments);
    });
	
	this._ezstream= ezstream;
	this._send(SourceClient.STARTED);
};

SourceClient.prototype.write= function(data){
	this._last_activity_ts= Date.now();
	this._oggenc.stdin.write(data, 'binary');
};

SourceClient.prototype.destroy= function(){
	this._oggenc.kill();
	this._ezstream.kill();
};

SourceClient.prototype._send= function(code){
	this._evt_handler({code: code}, this);	
};

SourceClient.STARTED= 0x001;
SourceClient.ENDED= 0x002;

SourceClient.LOG= 0x1002;
SourceClient.ERROR= 0x1004;

module.exports= SourceClient;

