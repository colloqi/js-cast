  
(function(){
	var wami_initialized= false, recording= false;
	var evt_handler;
	var wami_div_id;
    var stop_url= "";
	
	var SClass= function(){
		//load additional js required for wami
	};
	
	SClass.prototype.configure= function(options, callback){
		wami_div_id= options.wami_container;
		evt_handler= callback;
	};
	
	SClass.prototype.create= function(name, description){
		var self= this;
		if (!wami_initialized){
			document.getElementById(wami_div_id).style.display="";
			Wami.setup({
				id : wami_div_id,
				swfUrl: "/wami/Wami.swf",
                console: false,
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
			url: '/jscast/start',
			success: function(data) {
                stop_url= data.stop_url;
				self.start(data.post_url);
			}
		});
	};
	
	SClass.prototype.start= function(url){
		var recording_url= window.location.href.toString().replace(window.location.pathname.toString(), "")+url;
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
  

