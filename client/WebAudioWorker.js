var recLength = 0,
    recBuffers = [],
    sampleRate,
    url,
    chunk= 1;

var postsInProgress = 0,
    sentPackets = 0,
    statsInterval = 5000;

this.onmessage = function(e){
    switch(e.data.command){
    case 'init':
        init(e.data.config);
        chunk= 1;
        break;
    case 'config':
        url = e.data.config.url;
        postsInProgress = 0;
        setInterval(stats, statsInterval);
        break;
    case 'record':
        record(e.data.buffer);
        break;
    }
};

function init(config){
    sampleRate = config.sampleRate;
}

function record(inputBuffer){
    var bufferL = inputBuffer[0];               //only bufferL to be used for channel 1 and no interleave needed
    //var bufferR = inputBuffer[1];
    //recBuffers = interleave(bufferL, bufferR);
    //recBuffers.push(interleaved);
    //recLength = recBuffers.length;
    recLength = bufferL.length;
    //var dataview = encodeWAV(recBuffers);
    var dataview = encodeWAV(bufferL);
    queuePCMData(dataview);
}

function interleave(inputL, inputR){
    var length = inputL.length + inputR.length;
    var result = new Float32Array(length);

    var index = 0,
        inputIndex = 0;

    while (index < length){
        result[index++] = inputL[inputIndex];
        result[index++] = inputR[inputIndex];
        inputIndex++;
    }
    return result;
}

function floatTo16BitPCM(output, offset, input){
    for (var i = 0; i < input.length; i+=2, offset+=2){             //note i+=2, skipping alternate sample
        var s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
}

function writeString(view, offset, string){
    for (var i = 0; i < string.length; i++){
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

function encodeWAV(samples){
    var buffer = new ArrayBuffer(samples.length );          //since alternate samples are removed size is half
    var view = new DataView(buffer);
  
    ///* RIFF identifier */
    //writeString(view, 0, 'RIFF');
    ///* file length */
    //view.setUint32(4, 32 + samples.length * 2, true);
    ///* RIFF type */
    //writeString(view, 8, 'WAVE');
    ///* format chunk identifier */
    //writeString(view, 12, 'fmt ');
    ///* format chunk length */
    //view.setUint32(16, 16, true);
    ///* sample format (raw) */
    //view.setUint16(20, 1, true);
    ///* channel count */
    //view.setUint16(22, 2, true);
    ///* sample rate */
    //view.setUint32(24, sampleRate, true);
    ///* byte rate (sample rate * block align) */
    //view.setUint32(28, sampleRate * 4, true);
    ///* block align (channel count * bytes per sample) */
    //view.setUint16(32, 4, true);
    ///* bits per sample */
    //view.setUint16(34, 16, true);
    ///* data chunk identifier */
    //writeString(view, 36, 'data');
    ///* data chunk length */
    //view.setUint32(40, samples.length * 2, true);
  
    floatTo16BitPCM(view, 0, samples);
  
    return view;
}

function sendPCMData (ab) {       
    // Get an XMLHttpRequest instance
    var xhr = new XMLHttpRequest();
    postsInProgress++;
    //console.log("data recieved: "+ab.byteLength+"sending to url: "+url);
    // Set up request & send
    xhr.onerror = function (e) {
        postsInProgress--;
        sendNext();
    };
    xhr.onreadystatechange = function(){ 
        if ( xhr.readyState == 4 ) { 
            postsInProgress--;
            sendNext();           
        }
    };
    xhr.open('POST', url+"&chunk="+chunk, true);
    chunk++;
    xhr.send(ab);
}

function queuePCMData (ab) {
    if (recBuffers.length > 50) {
        this.postMessage("post queue length exceeded 50, emptying the old data");
        recBuffers = [];
    }
    recBuffers.push(ab);
    if (postsInProgress < 8 ) {
        sendNext();
    }
}

function sendNext () {
    if (recBuffers.length > 0) {
        sendPCMData (recBuffers[0]);
        recBuffers.shift();
        sentPackets +=1 ;
    }
}

function stats (){
    this.postMessage("current queue depth: "+recBuffers.length+", postsInProgress: "+postsInProgress);
    this.postMessage("transmission rate in packets: "+ sentPackets * 1000 /statsInterval);
    sentPackets = 0;
}
