
function loadChannelList(){
	$.ajax({
		url: '/channels',
		success: function(data) {
			console.log(data);
			var html= "";
			for(var i=0, num_channels= data.length; i <num_channels; i++){
				var channel= data[i];
				html += '<li>';
				html += '<a href="'+channel.url+'" title="'+channel.description+'">';
				html += '<button>'+channel.name+'</button>';
				html += '</a>';
				html += '</li>';
			}
			$("#channel_list").html(html);
			$("#channel_list a").click(function(evt){
				evt.preventDefault();
				var url= $(this).attr("href");
				$("#audio_player").attr("src", url);
			});
		}
	});
}

function stopChannel(){
	$("#audio_player").pause();
}

var broadcasting= false;

$(document).ready(function(){
	
	JSCast.configure({
		wami_container: "wami_gui_container"
	},
	function(evt){
		console.log("evt received from jscast:"+evt);
		switch(evt){
		case "STARTED":
			broadcasting= true;
			$("#create_new_form :input[type=submit]").removeAttr("disabled").val("Create");
			$("#create_new_form").hide();
			$("#create_new_button").text("Stop Your Channel").removeAttr("disabled");
			break;
		case "ENDED":
			broadcasting= false;
			$("#create_new_button").text("Start Channel");
			break;
		}
	});
	
	$("#refresh_button").click(function(evt){
		loadChannelList();	
	});
	
	$("#create_new_button").click(function(evt){
		if (broadcasting){
			JSCast.stop();
		}
		else {
			$(this).text("Starting... Please Wait...").attr("disabled", "disabled");
			$("#create_new_form").show();			
		}
	});
	
	$("#cancel_button").click(function(evt){
		$("#create_new_form").hide();
		$("#create_new_button").removeAttr("disabled").text("Start New Channel");
	});
	
	$("#create_new_form").submit(function(evt){
		evt.preventDefault();
		$(this).find(':input[type="submit"]').attr("disabled", "true").val("Creating... Please Wait...");
		var name= $(this).find(":input[name=name]").val();
		var description= $(this).find(":input[name=description]").val();
		JSCast.create(name, description);
	});
});
