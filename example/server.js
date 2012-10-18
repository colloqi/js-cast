
var express = require('express');
var jscast = require("js-cast");

var app = express();

// Configuration
app.configure(function(){
	app.set('views', __dirname + '/views');  
	app.set('view engine', 'ejs');
	app.set('view options', {
	    layout: false
	});
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(app.router);
	app.engine('html', require('ejs').renderFile);
	app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
	app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
    app.use(express.errorHandler()); 
});

// Routes
app.get('/', function(req, res){
	res.render('index.html');
});

app.get('/index.html', function(req, res){
	res.render('index.html');
});

app.get("/channels", function(req, res){
	//This is not made part of /jscast/channels as there may be a need to hide active channels from client.
	var channels = jscast.getActiveChannels();
	res.contentType('json');
	res.send(channels);
});

jscast.configure(app);
jscast.on("data", function(data){
    console.log(data);
});
jscast.on("error", function(data){
    console.log(data);
});

app.listen(3000);
console.log("Server listening on port 3000");
