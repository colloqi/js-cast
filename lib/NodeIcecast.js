/**
 *	@description: This implements a node based very basic icecast server
 *	Manages listeners also. All the listeners have to connect before streaming starts.
 */
var fs = require('fs.extra'),
	clone = require('clone'),
	spawn = require('child_process').spawn,
	util = require('util'),
	EventEmitter = require('events').EventEmitter ;

var ReqQueue= require('./ReqQueue.js');

var NodeIcecast= function(id, config_dir, options){
    EventEmitter.call(this);
	
    var self= this;
	this._id= id;
    this._listeners= new Array();
	this._last_activity_ts= Date.now();
    this._ogg_header= null;
	if (options.savefile){
        this._savefile= options.savefile;
    }
	this._url= "/js-cast/"+ id +".ogg";
	this._name= options.info.name;
	this._description= options.info.description;
    this._encoder_bin= options.encoder;
    this._encoder_args= options.encoder_args;
    if (options.inactivity_timeout){
        this._inactivity_timeout= options.inactivity_timeout * 1000;
        this._inactivity_timer= setInterval(this.handleInactivityTimer.bind(this), 5000);//5s
    }
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
	var encoder= spawn(self._encoder_bin, self._encoder_args? self._encoder_args.split(" ") : null);
	encoder.on('exit', function(){
        self._reqq.empty();
		self._encoder= null;
        for (var listener= self._listeners.pop(); listener; listener= self._listeners.pop()){
            listener.end();
        }
        self.emit("end");
	});
    encoder.stdout.once("data", function(data){
        self.emit("data", "Stored ogg header.");
        self._ogg_header= data;
    });
	encoder.stderr.on("data", function(data){
		self.emit("error", data);
    });
    this._encoder= encoder;
    this._reqq= new ReqQueue(encoder.stdin, this.req_q_min_threshold, this.req_q_max_threshold);
    this._reqq.on("data", function(data){
       self.emit("data", data);
    });
    if (this._savefile){
        var f= fs.createWriteStream(this._savefile, { flags: 'w', encoding: "binary", mode: 0666 });
        this._encoder.stdout.pipe(f, {end: false});
    }
	this.emit("start");
};

NodeIcecast.prototype.addReq= function(req, index){
    this._last_activity_ts= Date.now();
    this._reqq.add(req, index);
};

NodeIcecast.prototype.destroy= function(){
    this._reqq.empty();
	this._encoder.kill('SIGKILL');
	this._encoder= null;
	clearInterval(this._inactivity_timer);
};

NodeIcecast.prototype.addListener= function(listener){
    this._listeners.push(listener);
    this.emit("data", "Listener "+ this._listeners.length+" added at "+ new Date());
    if (this._ogg_header){
        this.emit("data", "Sending oggheader to the listener.");
        listener.write(this._ogg_header);
    }
    /*
    this._encoder.stdout.on("data", function(data){
        console.log("writing data to listener:"+data.length +" bytes at "+ new Date());
        listener.write(data);
    });*/
    this._encoder.stdout.pipe(listener, {end: false});
};

NodeIcecast.prototype.handleInactivityTimer= function(){
	var inactivity_duration= Date.now() - this._last_activity_ts;
	if (inactivity_duration > this._inactivity_timeout){
		this.emit("data", "Destroying client due to inactivity timeout:" +inactivity_duration);
		this.destroy();
	}
};

module.exports= NodeIcecast;

