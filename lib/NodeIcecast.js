/**
 *	@description: This implements a node based very basic icecast server
 *	Manages listeners also. All the listeners have to connect before streaming starts.
 */
var fs = require('fs.extra'),
	clone = require('clone'),
	spawn = require('child_process').spawn,
	util = require('util'),
	EventEmitter = require('events').EventEmitter ;

var DEFAULT_INACTIVITY_TIMEOUT= 5*60; // 5 minutes
var ARGS_OGGENC= "-B 16 -C 1 -R 22050 --raw-endianness 1 -";

var NodeIcecast= function(id, config_dir, options){
	var self= this;
	
	this._id= id;
	this._last_activity_ts= Date.now();
	if (options.savefile){
        this._savefile= options.savefile;
    }
	this._url= "/js-cast/"+ id +".ogg";
	this._name= options.info.name;
	this._description= options.info.description;
	this._inactivity_timeout= (options.inactivity_timeout || DEFAULT_INACTIVITY_TIMEOUT)*1000;
	this._inactivity_timer= setInterval(this.handleInactivityTimer.bind(this), 5000);//5s
	EventEmitter.call(this);
};

util.inherits(NodeIcecast, EventEmitter);

NodeIcecast.prototype.getUrl= function(){
	return this._url;	
};

NodeIcecast.prototype.getName= function(){
	return this._name;
};

NodeIcecast.prototype.getDescription= function(){
	return this._description;
};

NodeIcecast.prototype.getId= function(){
	return this._id;
};

NodeIcecast.prototype.start= function(){
    this._spawnProcesses();    
};

NodeIcecast.prototype._spawnProcesses= function(){
	var self= this;
	var oggenc= spawn("oggenc", ARGS_OGGENC.split(" "));
	oggenc.on('exit', function(){
		self._oggenc= null;
        self.emit("end");
	})
	this._oggenc= oggenc;
    if (this._savefile){
        var f= fs.createWriteStream(this._savefile, { flags: 'w', encoding: "binary", mode: 0666 });
        this._oggenc.stdout.pipe(f, {end: false});
    }
	this.emit("start");
};

NodeIcecast.prototype.pipe= function(stream){
	stream.pipe(this._oggenc.stdin, {end: false});	
};

NodeIcecast.prototype.destroy= function(){
	this._oggenc.kill('SIGKILL');
	this._oggenc= null;
	clearInterval(this._inactivity_timer);
};

NodeIcecast.prototype.addListener= function(listener){
    this._oggenc.stdout.pipe(listener, {end: false});
};

NodeIcecast.prototype.handleInactivityTimer= function(){
	var inactivity_duration= Date.now() - this._last_activity_ts;
	if (inactivity_duration > this._inactivity_timeout){
		this.emit("data", "Destroying client due to inactivity timeout:" +inactivity_duration);
		this.destroy();
	}
};

module.exports= NodeIcecast;

