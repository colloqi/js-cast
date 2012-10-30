/**
 *
 */

var	fs = require('fs.extra'),
    util = require('util'),
	EventEmitter = require('events').EventEmitter ;

var NodeIcecast = require('./NodeIcecast');

//constants/defaults
var DEFAULT_OPTIONS = {
	max_channels: 5,
    data_dir: fs.realpathSync(process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'])+"/js-cast",
    encoder: "oggenc"
};
var ENCODER_ARGS = {
    oggenc: "-r -Q -q 10 -B 16 -C 1 -R 22050 -",
    //oggenc: "-r -Q --ignorelength -k -q 10 -B 16 -C 1 -R 22050 --raw-endianness 1 -",
    ffmpeg: "-i - -f ogg -oggpagesize 250 -acodec libvorbis -ab 22050 -aq 10 -ac 1 -",
    avconv: "-i - -f ogg -oggpagesize 250 -acodec libvorbis -ab 22050 -aq 10 -ac 1 -",
    cat: null //purely testing purpose
};
var DEFAULT_INACTIVITY_TIMEOUT = 5*60; // 5 minutes
var REQ_Q_MAX_THRESHOLD = 8,
    REQ_Q_MIN_THRESHOLD = 4;
    
var OGG_HTTP_HEADERS = {
    "Content-Type": "application/ogg",
    "Connection": "close",
    "Transfer-Encoding": "identity"
};

var formatStr= function(str){
    return "js-cast: [" + new Date() +"]" +str;
};

var JSCast = function(){
	EventEmitter.call(this);
};
util.inherits(JSCast, EventEmitter);

JSCast.prototype.configure= function(app, a_config){
    var config= a_config || {};
	for (var config_name in DEFAULT_OPTIONS){
		this[config_name] = config[config_name] || DEFAULT_OPTIONS[config_name];
		//TODO: Do deep copy for objects
	}
	
	this._unnamed_channel_index = 0;
	this._channels = {};
	this._num_active_channels = 0;
	
	this._dir = this.data_dir;
	try {
		//fs.rmrfSync(this._dir); //cleanup from external, there may be files required to be saved
		fs.mkdirpSync(this._dir);
	}
	catch(e) {
		throw e;
    }
	this.emit("data", formatStr("Using encoder -- "+ this.encoder +"."));
	var self = this;
	app.get("/js-cast/start", function(req, res,next){
		if (self._num_active_channels === self._max_channels){
			self._send503();
		}
		else {
			var id= (Math.random().toString() + "1234567890123456").slice(2,18);
			var name= req.query.name|| "Channel"+ (++self._unnamed_channel_index);
			var description= req.query.description || "No Description Available.";
			var options= {
				info: { //channel/audio info
					name: name,
					description: description
				},
                savefile: self._dir+"/"+id+".ogg",
                encoder: self.encoder,
                encoder_args: ENCODER_ARGS[self.encoder],
                inactivity_timeout: DEFAULT_INACTIVITY_TIMEOUT,
                req_q_max_threshold: REQ_Q_MAX_THRESHOLD,
                req_q_min_threshold: REQ_Q_MIN_THRESHOLD
            };
			var channel;
            channel= new NodeIcecast(id, self._dir, options);
            self.addEventListeners(channel);
            channel.start();
			var data= {
				id: id,
				url: channel.getUrl(),
				post_url: "/js-cast/stream/?id="+id,
				stop_url: "/js-cast/end/?id="+id,
				name: name,
				description: description
			};
			res.contentType('json');
			res.json(data);
		}
	});

	app.post('/js-cast/stream', function(req, res, next){
		var channel= self._channels[req.query.id];
		if (channel){
            channel.addReq(req, req.query.chunk);
			req.on("end", function() {
				self._send200(res);
			});
		}
		else {
			self._send404(res);
		}
	});
    
    app.get('/js-cast/*.ogg', function(req, res, next){
        var parts= req.url.split("/");
        var id= parts[parts.length-1].replace(".ogg","");
        var channel= self._channels[id];
        if (channel){
            res.writeHead(200, OGG_HTTP_HEADERS);
            channel.addListener(res);
        }
        else {
            self._send404(res);
        }
    });
	
	app.get("/js-cast/end", function(req, res, next){
		var channel= self._channels[req.query.id];
		if (channel){
			channel.destroy();
			self._send200(res);
		}
		else {
			self._send404(res);
		}
	});
	
	var nstatic = require('node-static');
	var fileServer = new(nstatic.Server)(__dirname+'/../');
    
    var serveStaticFile= function(url, req, res){
        fileServer.serveFile(url, 200, {}, req, res);
    };

	app.get("/js-cast.js", function(req, res, next){
		serveStaticFile('/client/js-cast.js', req, res);
	});
	
	app.get("/js-cast/external/wami/Wami.swf", function(req, res, next){
		serveStaticFile(req.url.replace(/^\/js-cast/,""), req, res);
	});
    
    app.get("/js-cast/external/wami/recorder.js", function(req, res, next){
		serveStaticFile(req.url.replace(/^\/js-cast/,""), req, res);
	});
    
    app.get("/js-cast/external/swfobject.js", function(req, res, next){
        serveStaticFile(req.url.replace(/^\/js-cast/,""), req, res);
    });
	
	app.get("/js-cast/client/WebAudioWorker.js", function(req, res, next){
        serveStaticFile(req.url.replace(/^\/js-cast/,""), req, res);
    });
	
};

JSCast.prototype._send404= function(res){
	this._send(res, 404, "Not Found");
};

JSCast.prototype._send200= function(res){
	this._send(res, 200, "OK");
};

JSCast.prototype._send503= function(res){
	this._send(res, 503, "Service Unavailable");
};

JSCast.prototype._send= function(res, code, msg){
	res.statusCode= code;
	res.send(msg + "\n");
};

JSCast.prototype.getActiveChannels= function(){
	var channels= [];
	for (var id in this._channels){
		var channel= this._channels[id];
		channels.push({
			id: channel.getId(),
			name: channel.getName(),
			description: channel.getDescription(),
			url: channel.getUrl()
		});
	}
	return channels;
};

JSCast.prototype.addEventListeners= function(channel){
    var self= this;
    channel.on("start", function(){
        self.emit("data", formatStr("["+this.getId()+"]Channel started."));
		self._channels[this.getId()]= this;
    });
	channel.on("end", function(){
        self._num_active_channels--;
		delete self._channels[this.getId()];
        self.emit("data", formatStr("["+this.getId()+"]Channel ended."));
    });
    channel.on("data", function(data){
        self.emit("data", formatStr("["+this.getId()+"]"+data));
    });
	channel.on("error", function(data){
        self.emit("error", formatStr("["+this.getId()+"]"+data));
    });
};

module.exports= new JSCast();
