
var jscast= require("./");

var express = require('express');
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
	//send json response containing all the urls and names the active clients
	console.log("Request for channels received:");
	var channels= jscast.getActiveClients();
	res.contentType('json');
	res.send(channels);
	console.log("sent channels");
	console.log(channels);
});

jscast.configure(app, {max_clients: 3});

app.listen(3000);
console.log("App listening on port 3000");