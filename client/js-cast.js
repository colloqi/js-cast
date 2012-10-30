  
(function(){
	var server_config= {
		start_url: "/js-cast/start",
		wami: {
			swfobject_url: "/js-cast/external/swfobject.js",
			swfurl: "/js-cast/external/wami/Wami.swf",
			recorderjs_url: "/js-cast/external/wami/recorder.js"
		},
		webaudio: {
			workerjs_url: "/js-cast/client/WebAudioWorker.js"
		}
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
	
	function sendAjaxReq(args){
		var url= args.url;
		var xmlhttp;
		if (window.XMLHttpRequest){// code for IE7+, Firefox, Chrome, Opera, Safari
			xmlhttp=new XMLHttpRequest();
		}
		else {// code for IE6, IE5
			xmlhttp=new ActiveXObject("Microsoft.XMLHTTP");
		}
		xmlhttp.onreadystatechange= function(progress_evt) {
			if (xmlhttp.readyState==4 && xmlhttp.status==200){
				var content_type= xmlhttp.getResponseHeader("Content-Type");
				var out= content_type.indexOf("application/json") != -1 ? JSON.parse(xmlhttp.responseText) : xmlhttp.responseText;
				args.success && args.success(out);
			}
		}
		var qs="";
		for(var key in args.data) {
			var value = args.data[key];
			if (value){
				qs += encodeURIComponent(key) + "=" + encodeURIComponent(value) + "&";	
			}
		}
		if (qs.length > 0){
			qs = qs.substring(0, qs.length-1); //chop off last "&"
			url = url + "?" + qs;
		}

		xmlhttp.open("GET", url,true);
		xmlhttp.send();
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
	
	//web Audio based Audio-conf
	var WebAudioClass = function() {
		this.audioSessionInProgress = false;
		
		this.numChannels = 1;		//hardcoded to 1
		this.Float32ArrayBuffer = [];
		
		this.context = null;
		this.node = null;
		this.mediaStreamSource = null;
		this.worker = null;
	};
	
	WebAudioClass.prototype= new EventEmitter();//inherit from EventEmitter
	
	WebAudioClass.prototype.load= function(callback){
		callback();//nothing to load
	};
	
	WebAudioClass.prototype.init = function(a_config) {
		var self = this;
		navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia ||
									navigator.mozGetUserMedia || navigator.msGetUserMedia;
		
		var default_config= {bufferLen: 8192}
		var config = a_config || {};
		for (var key in default_config){
			this[key] = typeof (config[key]) !== "undefined"? config[key] : default_config[key];
		}
						
		this.Float32ArrayBuffer[0] = new Float32Array(this.bufferLen);	
		//this.Float32ArrayBuffer[1] = new Float32Array(this.bufferLen);
										   
		var createAudioContext = function(localMediaStream) {
			
			var playBuffer = [];
						
		    if (!self.context) { 						//already done
				try {
					self.context = new webkitAudioContext();
				}
				catch(e) {
					alert("Web API is not supported in your browser"+
												"Try enabling Web Audio flags in Chrome");
					return;
				}
						
				self.node = self.context.createJavaScriptNode(self.bufferLen, self.numChannels, self.numChannels);
				
				self.worker = new Worker(server_config.webaudio.workerjs_url);
				
				self.worker.onmessage = function(e){
					var ab = e.data;
					//self.emit('data',ab);
					//sendPCMData(self._recording_url, ab);
					console.log(e.data);		//post is done in worker itself, only console messages are sent
				}
				
				self.worker.postMessage({
					command: 'init',
					config: {
						sampleRate: self.context.sampleRate
					}
				});
			}
			
			self.node.onaudioprocess = function(e){
			
				//playBuffer[0] = e.outputBuffer.getChannelData(0);
				//playBuffer[1] = e.outputBuffer.getChannelData(1);
			
				if (!self.audioSessionInProgress) return;
				self.worker.postMessage({
					command: 'record',
					buffer: [
						e.inputBuffer.getChannelData(0)
						//e.inputBuffer.getChannelData(1)
					]
				});
			}
			
			self.mediaStreamSource = self.context.createMediaStreamSource(localMediaStream);
			self.mediaStreamSource.connect(self.node);
			self.node.connect(self.context.destination);
			self.emit("init");
		};
		navigator.getUserMedia({audio: true}, createAudioContext);
	};
	
	WebAudioClass.prototype.record = function(recording_url) {
		this._recording_url = recording_url;
		this.mediaStreamSource.connect(this.node);
		this.audioSessionInProgress = true;
		this.worker.postMessage({
			command: 'config',
			config: {
				url: recording_url
			}
		});
	};
	
	WebAudioClass.prototype.pause = function() {
		this.mediaStreamSource.disconnect();
		this.audioSessionInProgress = true;
	};

	WebAudioClass.prototype.stop = function() {
		if (this.mediaStreamSource) {
			this.mediaStreamSource.disconnect();
		}
		this.node.disconnect();
		this.audioSessionInProgress = false;
	};
	//end web Audio based Audio-conf
	
	//start Wami based Audio Recorder
	var WamiRecorderClass= function(){
		
	};
	WamiRecorderClass.prototype= new EventEmitter();//inherit from EventEmitter
	
	WamiRecorderClass.prototype.load= function(callback){
		//load additional js required for wami
		//swfobject is a commonly used library to embed Flash content
		loadScript(server_config.wami.swfobject_url, function(){
			// Setup the recorder interface
			loadScript(server_config.wami.recorderjs_url, function(){
				callback();
			});
		});
	};
	
	WamiRecorderClass.prototype.init= function(config){
		var self= this;
		document.getElementById(config.ss_container).style.display="";
		Wami.setup({
			id : config.ss_container,
			swfUrl: server_config.wami.swfurl,
			onReady : function(){
				self._initialized= true;
				var ws= Wami.getSettings();
				ws.container= "au";     //options for streaming (POST)
				try{
					Wami.setSettings(ws);
				}
				catch(e){
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
	};
	
	WamiRecorderClass.prototype.record= function(recording_url){
		console.log("record function called:"+recording_url);
		try {
           Wami.startRecording(recording_url);
        }
        catch(e){
                       //FIXME: need to remove this once automatic stopping is recognized
            //IF the recording stops automatically, this is executed.
            console.log("Retry recording...");
            Wami.startRecording(recording_url);
        }
	};
	
	WamiRecorderClass.prototype.pause= function(){
		
	};
	
	WamiRecorderClass.prototype.stop= function(){
		
	};
	
	//end Wami based Audio Recorder
	
	var RecorderClass= function(){
		this._initialized= false;
		this._loaded= false;
		this._recording= false;
		this._ss_container= "";
		this._elapsed= 0, this._last_ts= 0;
		this._timer= null;
		this._recorder = new WebAudioClass();
	};
	RecorderClass.prototype= new EventEmitter();//inherit from EventEmitter
	
	RecorderClass.prototype.load= function(){
		var self= this;
		if (this._loaded){
			self.emit("load");
		}
		else {
			this._recorder.load(function(){
				self._loaded= true;
				self.emit("load");
			});
		}
	};
	
	RecorderClass.prototype.init= function(ss_container){
		var self= this;
		if (!this._initialized){
			this._recorder.on("init", function(){
				self._initialized= true;
				console.log("recorder initialized");
				self.emit("init");
			});
			this._recorder.init({
				ss_container: ss_container
			});
		}
		else {
			self.emit("init");
		}
	};
	
	RecorderClass.prototype.start= function(){
        this._recorder.record(this._recording_url);
		this._elapsed= 0;
		this.initStopWatch();
		this.emit("start");
		return true;
	};
	
	RecorderClass.prototype.stop= function(){
        this._recorder.stop();
		this.endStopWatch();
		this.emit("end");
	};
	
	//TODO: need to implement this
	RecorderClass.prototype.pause= function(){
        this._recorder.pause();
		this.emit("paused");
	};
	
	//TODO: need to implement this
	RecorderClass.prototype.resume= function(){
		this.emit("resumed");
	};
	
	//TODO: need to get the progress events from flah, as it would be accurate.
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
	
	RecorderClass.prototype.setRecordingUrl= function(url){
		this._recording_url= url;	
	};
	
	/**
	 *	Following is the API impl exposed to the client browser.
	 */
	
    /** private */
	var BASE_URL= location.protocol + '//' + location.host;
	var _stop_url = "", _recording_url="", _recorder= null;
	
	var JSCastClass= function(){
		_recorder= new RecorderClass();
	};
	JSCastClass.prototype= new EventEmitter();	//inherit from EventEmitter
	
	/**
	 *@description: Loads necessary javascripts required (for recorder)
	 *@event: "load" on success, "error" on failure
	 */
	JSCastClass.prototype.load= function(){
		_recorder.load();
		var self= this;
		_recorder.on("load", function(){
			self.emit("load");
		});
		_recorder.on("init", function(){
			self.emit("ready");
		});
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
			sendAjaxReq({
				url: _stop_url,
				success: function(data) {
				}
			});
			self.emit("end");
		});
	};
	
	/**
	 *@description: This function must be called before invoking `start`
	 *@argument: ss_container - security settings container, where permissions dialog shall be shown.
	 *@event: "ready" on success, "error" on failure
	 */
	JSCastClass.prototype.prepare= function(ss_container){
		_recorder.init(ss_container);
	};
	
	/**
	 *@description: Gets recording url from server.
	 *@event: "opened" on success, stream url is sent as event data.
	 *@event: "error" on failure.
	 */
	JSCastClass.prototype.open= function(name, description){
		var self= this;
		sendAjaxReq({
            data: {name: name, description: description},
			url: server_config.start_url,
			success: function(data) {
                _stop_url= data.stop_url;
				var recording_url= BASE_URL + data.post_url;
				_recorder.setRecordingUrl(recording_url);
				self.emit("opened", data.url);
			}
		});
	};
	
	/**
	 *@description: To be invoked when recording has to be started.
	 *@event: "start" on success, "error" on failure.
	 */
	JSCastClass.prototype.start= function(){
		return _recorder.start();
	};
	
	/**
	 *@description: To stop recording.
	 *@event: none
	 */
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
