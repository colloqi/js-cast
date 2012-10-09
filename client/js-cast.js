  
(function(){
	var server_config= {
		start_url: "/js-cast/start",
		swfobject_url: "/js-cast/external/swfobject.js",
		wami_swfurl: "/js-cast/external/wami/Wami.swf",
		recorder_url: "/js-cast/external/wami/recorder.js"
		
	};
	var wami_initialized= false;
	var evt_handler;
	var wami_div_id;
    var stop_url = "";
	var base_url;
	
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
	
	var SClass= function(){
		var href= window.location.href.toString(),
			pathname= window.location.pathname.toString();
		base_url= href.substr(0, href.length-pathname.length);
	};
	
	SClass.prototype.configure= function(options, callback){
		wami_div_id= options.wami_container;
		evt_handler= callback;
		//load additional js required for wami
		//swfobject is a commonly used library to embed Flash content
		loadScript(server_config.swfobject_url, function(){
			// Setup the recorder interface
			loadScript(server_config.recorder_url, function(){
			})
		})
	};
	
	SClass.prototype.create= function(name, description){
		var self= this;
		if (!wami_initialized){
			document.getElementById(wami_div_id).style.display="";
			Wami.setup({
				id : wami_div_id,
				swfUrl: server_config.wami_swfurl,
				onReady : function(){
					wami_initialized= true;
					var ws= Wami.getSettings();
					ws.container= "au";
					try{
						Wami.setSettings(ws);	
					}catch(e){
						console.log("wami set settings error");
						console.log(e);
					}
					self.requestChannel(name, description);
                    Wami.hide();
				},
                onLoaded: function(){
                    
                },
                onError: function(){
                    console.log("Wami error");
                    console.log(arguments);
                }
			});
		}
		else {
			this.requestChannel(name, description);
		}
	};
	
	SClass.prototype.requestChannel= function(name, description){
		var self= this;
		$.ajax({
            data: {name: name, description: description},
			url: server_config.start_url,
			success: function(data) {
                stop_url= data.stop_url;
				self.start(data.post_url);
			}
		});
	};
	
	SClass.prototype.start= function(url){
		var recording_url= base_url + url;
		console.log("Recording url=>"+recording_url);
        try {
            Wami.startRecording(recording_url);
        }
        catch(e){
            //IF the recording stops automatically, this is executed.
            console.log("Retry recording...");
            Wami.startRecording(recording_url);
        }
		
        this._send("STARTED");
	};
	
	SClass.prototype.stop= function(){
		Wami.stopRecording();
        $.ajax({
			url: stop_url,
			success: function(data) {
			}
		});
		this._send("ENDED");
	};
	
	SClass.prototype._send= function(evt){
        if (evt_handler){
            evt_handler(evt);    
        }
	}
	
	JSCast= new SClass();
})();

