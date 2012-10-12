

var	fs= require('fs.extra');

var SourceClient= require('./SourceClient'),
    NodeIcecast= require('./NodeIcecast');

//constants/defaults
var DEFAULT_OPTIONS= {
	max_clients: 5,
	icecast: {
		server: "http://localhost:8000/",
		sourcepassword: "hackme"
	},
    data_dir: fs.realpathSync(process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'])+"/js-cast",
    use_node_icecast: false //If this flag is enabled icecast and ezstream are not used.
};

var JSCast= function(){
	
};

JSCast.prototype.configure= function(app, config){
	for (var config_name in DEFAULT_OPTIONS){
		this[config_name]= config[config_name] || DEFAULT_OPTIONS[config_name];
		//TODO: Do deep copy for objects
	}
	
	this._unnamed_channel_index= 0;
	this._clients= {};
	this._num_active_clients= 0;
	
	this._dir= this.data_dir;
	try {
		//fs.rmrfSync(this._dir); //cleanup from external, there may be files required to be saved
		fs.mkdirpSync(this._dir);
	}
	catch(e) {
		throw e;
    }
	
	var self= this;
	app.get("/js-cast/start", function(req, res,next){
		if (self._num_active_clients === self._max_clients){
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
                savefile: self._dir+"/"+id+".ogg"
            };
			var client;
            if (self.use_node_icecast) {
                console.log("using node icecast");
                client= new NodeIcecast(id, self._dir, options);
            }
            else {
                options.server= self.icecast.server;
				options.sourcepassword= self.icecast.sourcepassword;
                client= new SourceClient(id, self._dir, options);
            }
            self.addEventListeners(client);
            client.start();
			var data= {
				id: id,
				url: client.getUrl(),
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
		var client= self._clients[req.query.id];
		if (client){
            client.pipe(req);
			req.on("end", function() {
				self._send200(res);
			});
		}
		else {
			self._send404(res);
		}
	});
    
    if (this.use_node_icecast){
        var headers = {
            "Content-Type": "application/ogg",
            "Connection": "close",
            "Transfer-Encoding": "identity"
        };
        
        app.get('/js-cast/*.ogg', function(req, res, next){
            var parts= req.url.split("/");
            var id= parts[parts.length-1].replace(".ogg","");
            var client= self._clients[id];
            if (client){
                res.writeHead(200, headers); //set header for ogg-vorbis stream
                client.addListener(res);
            }
            else {
                self._send404(res);
            }
        });
    }
	
	app.get("/js-cast/end", function(req, res, next){
		var client= self._clients[req.query.id];
		if (client){
			client.destroy();
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

JSCast.prototype.getActiveClients= function(){
	var clients= [];
	for (var id in this._clients){
		var client= this._clients[id];
		clients.push({
			id: client.getId(),
			name: client.getName(),
			description: client.getDescription(),
			url: client.getUrl()
		});
	}
	return clients;
};

JSCast.prototype.addEventListeners= function(client){
    var self= this;
    client.on("start", function(){
        console.log("Client started: "+this.getId());
		self._clients[this.getId()]= this;
    });
	client.on("end", function(){
        self._num_active_clients--;
		delete self._clients[this.getId()];
		console.log("Client ended: "+this.getId());
    });
    client.on("data", function(data){
        console.log(data);
    });
	client.on("error", function(data){
        console.log("ERROR!!!");
		console.log(data)
    });
};

module.exports= new JSCast();
