
$(document).ready(function(){
	
	function loadChannelList(){
		$.ajax({
			url: '/channels',
			success: function(data) {
				var html= "";
				for(var i=0, num_channels= data.length; i <num_channels; i++){
					var channel= data[i];
					html += '<li>';
					html += '<a href="'+channel.url+'" title="'+channel.description+'">';
					html += '<button>'+channel.name+'</button>';
					html += '</a>';
					html += '</li>';
				}
				$("#channel_list").html(html ||'<li>No Channels Available.</li>');
				$("#channel_list a").click(function(evt){
					evt.preventDefault();
					var url= $(this).attr("href");
					$("#audio_player").attr("src", url);
				});
			}
		});
	}
	
	function formatTime(t){
		var s= Math.round(t%60),
			m= Math.floor(t/60);
		return (m>9?m:"0"+m)+":"+(s>9? s : "0"+s)
	}
	
	var broadcasting= false;
	var play_start_ts;
	
	$("#audio_player").bind("playing", function(){
		console.warn("playing");
	})
	var events= {
		"loadstart": function(){
			play_start_ts= new Date().getTime();
			$("#play_start_time").text("Playing Started at "+new Date().toString());
		},
		/*"progress": function(){
			//$("#play_elapsed").text(formatTime(Math.round((new Date().getTime() - play_start_ts)/1000)));
		},*/
		"suspend": null,
		"abort": null,
		"error": null,
		"emptied": null,
		"stalled": null,
		"loadedmetadata":null,
		"loadeddata":function(){
			play_start_ts= new Date().getTime();
		},
		"canplay":null,
		"canplaythrough":null,
		"playing":null,
		"waiting": null,
		"seeking":null,
		"seeked":null,
		"ended": null,
		"durationchange": null,
		"timeupdate": null,
		"play": null,
		"pause": null,
		"ratechange": null,
		"volumechange": null
	};
	for (var evtname in events){
		$("#audio_player").bind(evtname, function(cevtname){
			console.warn("evt:"+ cevtname);
			if (events[cevtname]){
				events[cevtname](arguments);
			}
		}.bind(this, evtname));
	}
	
	JSCast.load();
	
	loadChannelList();
	
	$("#refresh_button").click(function(evt){
		loadChannelList();	
	});
	
	$("#create_new_button").click(function(evt){
		if (broadcasting){
			JSCast.stop();
		}
		else {
			$("#dialog").show();			
		}
	});
	
	$("#cancel_button").click(function(evt){
		$("#dialog").hide();
	});
	
	$("#create_new_form").submit(function(evt){
		evt.preventDefault();
		$("#dialog").hide();
		var name= $(this).find(":input[name=name]").val();
		var description= $(this).find(":input[name=description]").val();
		
		JSCast.on("ready", function(){
			JSCast.open(name, description);	
		});
		JSCast.on("opened", function(stream_url){
			//do any initialization required such as sending url to the listeners.
			$("#audio_player").attr("src", stream_url);
			JSCast.start();
		});
		JSCast.on("start", function(){
			broadcasting= true;
			$("#start_time").text("Started at "+new Date().toString());
			$("#dialog").hide();
			$("#create_new_button").text("Stop Your Channel");
		});
		JSCast.on("end", function(){
			broadcasting= false;
			$("#start_time").text("");
			$("#create_new_button").text("Start Channel");
		});
		JSCast.on("progress", function(elapsed){
			$("#elapsed").text(formatTime(elapsed));
		});
		
		JSCast.prepare("security_settings_container");
	});
});
