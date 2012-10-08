

var	fs= require('fs.extra');

var SourceClient= require('./SourceClient');

//constants/defaults
var DEFAULT_OPTIONS= {
	max_clients: 5,
	icecast: {
		server: "http://localhost:8000/",
		sourcepassword: "hackme"
	}
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
	
	var home= fs.realpathSync(process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME']);
	this._dir= home + "/"+ ".jscast";	//configuration files for ezstream stored here
	try {
		fs.mkdirpSync(this._dir);
		//TODO: remove all files in this dir
	}
	catch(e) {
		throw e;
    }
	
	var self= this;
	app.get("/jscast/start", function(req, res,next){
		if (self._num_active_clients === self._max_clients){
			self._send503();
		}
		else {
			var id= (Math.random().toString() + "1234567890123456").slice(2,18);
			var name= req.query.name|| "Channel"+ (++self._unnamed_channel_index);
			var description= req.query.description || "No Description Available.";
			var options= {
				server: self.icecast.server,
				sourcepassword: self.icecast.sourcepassword,
				info: {
					name: name,
					description: description
				}
			};
			var client= new SourceClient(id, self._dir, options, self.handleEvent.bind(self));
			var data= {
				id: id,
				url: client.getUrl(),
				post_url: "/jscast/stream/?id="+id,
				stop_url: "/jscast/end/?id="+id,
				name: name,
				description: description
			};
			res.contentType('json');
			res.json(data);
		}
	});
	
	app.post('/jscast/stream', function(req, res, next){
		var client= self._clients[req.query.id];
		if (client){
			req.on("data", function(chunk) {
				client.write(chunk);
			});
			req.on("end", function() {
				self._send200(res);
			});
		}
		else {
			self._send404(res);
		}
	});
	
	app.get("/jscast/end", function(req, res, next){
		var client= self._clients[req.query.id];
		if (client){
			client.destroy();
			self._send200(res);
		}
		else {
			self._send404(res);
		}
	})
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

JSCast.prototype.handleEvent= function(evt, data){
	var sc= SourceClient;
	switch(evt.code){
	case sc.STARTED:
		this._clients[data.getId()]= data;
		break;
	case sc.ENDED:
		this._num_active_clients--;
		delete this._clients[data.getId()];
		console.log("Client ended:");
		break;
	case sc.LOG:
		console.log(data);
		break;
	case sc.ERROR:
		console.log("ERROR!!!");
		console.log(data)
		break;
	}
};

module.exports= new JSCast();
