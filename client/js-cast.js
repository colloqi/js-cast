  
(function(){
	var server_config= {
		start_url: "/js-cast/start",
		swfobject_url: "/js-cast/external/swfobject.js",
		wami_swfurl: "/js-cast/external/wami/Wami.swf",
		recorder_url: "/js-cast/external/wami/recorder.js"
	};
	
	function loadScript(url, callback){
        var script = document.createElement("script")
        script.type = "text/javascript";
        
        if (script.readyState){  //IE
            script.onreadystatechange = function(){
                if (script.readyState == "loaded" ||
                    script.readyState == "complete"){
                    script.onreadystatechange = null;
                    callback();
                }
            };
        }
        else {  //Others
            script.onload = function(){
                callback();
            };
        }
        script.src = url;
        document.getElementsByTagName("head")[0].appendChild(script);
    }
	
	/**
	 *	Simple EventEmitter similar to nodejs.
	 */
	var EventEmitter= function(){
		this._handlers= {};
	};
	EventEmitter.prototype= {
		emit: function(evt, data){
			if (this._handlers[evt]){
				this._handlers[evt](data);
			}
		},
		on: function(evt, handler){
			this._handlers[evt]= handler;
		}
	};
	
	var RecorderClass= function(){
		this._initialized= false;
		this._recording= false;
		this._ss_container= "";
		this._elapsed= 0, this._last_ts= 0;
		this._timer= null;
	};
	RecorderClass.prototype= new EventEmitter();//inherit from EventEmitter
	
	RecorderClass.prototype.load= function(ss_container){
		var self= this;
		this._ss_container= ss_container;
		//load additional js required for wami
		//swfobject is a commonly used library to embed Flash content
		loadScript(server_config.swfobject_url, function(){
			// Setup the recorder interface
			loadScript(server_config.recorder_url, function(){
				self.emit("load");
			});
		});
	};
	
	RecorderClass.prototype.init= function(){
		var self= this;
		if (!self._initialized){
			document.getElementById(self._ss_container).style.display="";
			Wami.setup({
				id : self._ss_container,
				swfUrl: server_config.wami_swfurl,
				onReady : function(){
					self._initialized= true;
					var ws= Wami.getSettings();
					ws.container= "au";	//options for streaming (POST)
					try{
						Wami.setSettings(ws);
					}catch(e){
						
					}
					Wami.hide();
					self.emit("init");
				},
				onLoaded: function(){
					
				},
				onError: function(){
					self.emit("error", arguments);
				}
			});
		}
		else {
			self.emit("init");
		}
	};
	
	RecorderClass.prototype.initStopWatch= function(){
		var self= this;
		self._last_ts= new Date().getTime();
		self._timer= setInterval(function(){
			var prev_ts= self._last_ts;
			self._last_ts= new Date().getTime();
			self._elapsed += (self._last_ts-prev_ts);
			var s= Math.round(self._elapsed/1000);
			self.emit("progress", s);
		}, 1000);
	};
	
	RecorderClass.prototype.endStopWatch= function(){
		if (this._timer){
			clearInterval(this._timer);
			this._timer= null;
		}
	};
	
	RecorderClass.prototype.isRecording= function(){
		return this._recording;
	};
	
	RecorderClass.prototype.isInitialized= function(){
		return this._initialized;
	};
	
	RecorderClass.prototype.pause= function(){
		
	};
	
	RecorderClass.prototype.resume= function(){
		
	};
	
	RecorderClass.prototype.stop= function(){
		
	};
	
	RecorderClass.prototype.start= function(url){
		console.log("Recording url=>"+url);
        try {
            Wami.startRecording(url);
        }
        catch(e){
			//FIXME: need to remove this once automatic stopping is recognized
            //IF the recording stops automatically, this is executed.
            console.log("Retry recording...");
            Wami.startRecording(url);
        }
		this._elapsed= 0;
		this.initStopWatch();
		this.emit("start");
	};
	
	RecorderClass.prototype.stop= function(){
		Wami.stopRecording();
		this.emit("end");
	};
	
	RecorderClass.prototype.pause= function(){
		this.emit("paused");
	};
	
	RecorderClass.prototype.resume= function(){
		this.emit("resumed");
	};
	
	
	/**
	 *	Following is the API impl exposed to the client browser.
	 */
	
    /** private */
	var BASE_URL;
	var _stop_url = "", _recorder= null;
	
	var JSCastClass= function(){
		var href= window.location.href.toString(),
			pathname= window.location.pathname.toString();
		BASE_URL= href.substr(0, href.length-pathname.length);
		_recorder= new RecorderClass();
	};
	JSCastClass.prototype= new EventEmitter();	//inherit from EventEmitter
	
	/**
	 * @description: This is the first function to be invoked.
	 * @argument ss_container - security settings container, where permissions dialog shall be shown.
	 */
	JSCastClass.prototype.configure= function(ss_container){
		_recorder.load(ss_container);
		var self= this;
		_recorder.on("paused", function(){
			self.emit("paused");
		});
		_recorder.on("progress", function(elapsed){
			self.emit("progress", elapsed);
		});
		_recorder.on("start", function(){
			self.emit("start");
		});
		_recorder.on("end", function(){
			$.ajax({
				url: _stop_url,
				success: function(data) {
				}
			});
			self.emit("end");
		});
	};
	
	JSCastClass.prototype.start= function(name, description){
		var self= this;
		if (!_recorder.isInitialized()){
			_recorder.init();
			_recorder.on("init", function(){
				self.requestChannel(name, description);
			});
		}
		else {
			self.requestChannel(name, description);
		}
	};
	
	JSCastClass.prototype.requestChannel= function(name, description){
		var self= this;
		$.ajax({
            data: {name: name, description: description},
			url: server_config.start_url,
			success: function(data) {
                _stop_url= data.stop_url;
				var recording_url= BASE_URL + data.post_url;
				_recorder.start(recording_url);
			}
		});
	};
	
	JSCastClass.prototype.stop= function(){
		return _recorder.stop();
	};
	
	JSCastClass.prototype.pause= function(){
		return _recorder.pause();
	};
	
	JSCastClass.prototype.resume= function(){
		return _recorder.resume();
	};
	
	JSCast= new JSCastClass();
})();
