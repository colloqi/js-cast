/**
 *  @description: Implements a Post Request Queue. Buffers the post data and outputs in order.
 *
 */

var util = require('util'),
	EventEmitter = require('events').EventEmitter;

var ReqQueue= function(writestream, min, max){
    EventEmitter.call(this);
    this._q= [];
    this.MIN_THRESHOLD= min;
    this.MAX_THRESHOLD= max;
    this._writestream= writestream;
	this._stopped = true;
	this.writeTimer = setInterval(this.flush.bind(this),184);		//coresponding to 8192 buffer size on client
};

util.inherits(ReqQueue, EventEmitter);

ReqQueue.prototype.add= function(req, index){
    var self= this;
    var pkt= {complete: false, index: index, data: []};
    this._q.push(pkt);
    req.on("data", function(data){
        pkt.data.push(data);
    });
    req.on("end", function(){
        pkt.complete= true;
		//console.log('calling flush: '+index);
        //self.flush();
    });
    if (this._q.length > this.MAX_THRESHOLD){
        self.emit("error", "Q exceeded MAX THRESHOLD("+this.MAX_THRESHOLD+").");
    }
};

ReqQueue.prototype.empty= function(){
    this._q= [];
	this._stopped = true;
};

ReqQueue.prototype.flush= function(){
	if ((this._stopped) && (this._q.length < this.MIN_THRESHOLD)){
        this.emit("data", "Waiting for the minimum buffer build");
		return;
    }
	
	if (!this._q.length) {
		if (!this._stopped){
            this.emit("data", "Reached the bottom of the queue");
        }
		this._stopped = true;
		return;
	}

	if (this._stopped) {
        this.emit("data", "Starting to write stream");
    }
	this._stopped = false;
	
	//send a single packet
	var pkt= this._q[0];
	if (pkt.complete){
		//console.log("Writing packet -- "+pkt.index);
		for (var i=0, count= pkt.data.length; i< count; i++){
			if (!this._writestream.write(pkt.data[i])) {
				this.emit("data", "encoder is asking to stop the write");					
			}
		}
		this._q.shift();
	} 
};

module.exports= ReqQueue;
