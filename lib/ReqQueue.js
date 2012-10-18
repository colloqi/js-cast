/**
 *  @description: Implements a Post Request Queue. Buffers the post data and outputs in order.
 *
 */

var util = require('util'),
	EventEmitter = require('events').EventEmitter ;
    
var ReqQueue= function(writestream){
    EventEmitter.call(this);
    this._q= [];
    this._writestream= writestream;
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
        self.flush();
    });
};

ReqQueue.prototype.flush= function(){
    while(this._q.length){
        var pkt= this._q[0];
        if (pkt.complete){
            //console.log("Writing packet -- "+pkt.index);
            for (var i=0, count= pkt.data.length; i< count; i++){
                this._writestream.write(pkt.data[i]);
            }
            this._q.shift();
        }
        else {
            break;
        }
    }
};

module.exports= ReqQueue;