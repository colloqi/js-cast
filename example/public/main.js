
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
	
	JSCast.configure("security_settings_container");
	JSCast.on("start", function(){
		broadcasting= true;
		$("#dialog").hide();
		$("#create_new_button").text("Stop Your Channel");
	});
	JSCast.on("end", function(){
		broadcasting= false;
		$("#create_new_button").text("Start Channel");
	});
	
	JSCast.on("progress", function(elapsed){
		var s= Math.round(elapsed%60),
			m= Math.floor(elapsed/60);
		$("#elapsed").text((m>10?m:"0"+m)+":"+(s>10? s : "0"+s));
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
		JSCast.start(name, description);
	});
});
