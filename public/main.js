
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
	
	var broadcasting= false;
	var elapsed= 0, last_ts= 0;;
	var timer= null;

	JSCast.configure({
		wami_container: "wami_gui_container"
	},
	function(evt){
		switch(evt){
		case "STARTED":
			broadcasting= true;
			last_ts= new Date().getTime();
			$("#dialog").hide();
			$("#create_new_button").text("Stop Your Channel");
			timer= setInterval(function(){
				var prev_ts= last_ts;
				last_ts= new Date().getTime();
				elapsed += (last_ts-prev_ts);
				var s= Math.round(elapsed/1000);
				$("#elapsed").text(Math.floor(s/60)+":"+Math.round(s%60));
			}, 1000);
			break;
		case "ENDED":
			broadcasting= false;
			if (timer){
				clearInterval(timer);
				timer= null;
			}
			$("#create_new_button").text("Start Channel");
			break;
		}
	});
	
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
		JSCast.create(name, description);
	});
});
