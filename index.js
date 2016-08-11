// RFduino Node Example
// Discover and read temperature from RFduinos running the Temperature Sketch
// https://github.com/RFduino/RFduino/blob/master/libraries/RFduinoBLE/examples/Temperature/Temperature.ino
//
// (c) 2014 Don Coleman
var noble = require('noble'),
    rfduino = require('./simblee'),
    _ = require('underscore');

var sampleCounter = 1;
var connectedPeripheral;
var dataPacket = "";
var packetComplete = false;
var lastPacket = null;
var dataObject;
var _peripheral;
var _sendCharacteristic;
var _bleAvailable = false;
var manualDisconnect = false;
var uncompressedPacket1 = new Array();
var uncompressedPacket = new Array();
var lastCounter = 0;
var thatTime = 0;
var theOtherTime = 0;
var failCounter = 0;
var packetCounter = 0;
var droppedPacket = 0;
var goodPacket = 0;
var lastDroppedPacket;
var packetArray = new Array(86);
var droppedPacketArray = new Array(86);
var droppedPacketCounters = [];
var udpOpen = false;

const dgram = require('dgram');
const server = dgram.createSocket('udp4');
const client = dgram.createSocket('udp4');


server.on('error', (err) => {
  console.log(`server error:\n${err.stack}`);
  server.close();
});

server.on('message', (msg, rinfo) => {
  console.log(`server got: ${msg} from ${rinfo.address}:${rinfo.port}`);
  if(_sendCharacteristic!== null){
    var out = new Buffer(msg);
    _sendCharacteristic.write(out);
  }
});

server.on('listening', () => {
  var address = server.address();
  console.log(`server listening ${address.address}:${address.port}`);
  udpOpen = true;
});

server.bind(6100);


var receivedDeltas = new Array(3);
for (var i = 0; i < 4; i++) {
    receivedDeltas[i] = [0, 0, 0, 0];
}

var decompressedSamples = new Array(4);
for (var i = 0; i < 4; i++) {
    decompressedSamples[i] = [0, 0, 0, 0];
}

// TODO why does this need to be wrapped?
var stop = function() {
    noble.stopScanning();
};

noble.on('scanStart', function() {
    console.log('Scan started');
    //setTimeout(stop, 60000);
});

noble.on('scanStop', function() {
    console.log('Scan stopped');
});

var onDeviceDiscoveredCallback = function(peripheral) {
    _peripheral = peripheral;
    console.log('\nDiscovered Peripherial ' + peripheral.uuid);

    if (_.contains(_peripheral.advertisement.serviceUuids, rfduino.serviceUUID)) {
        // here is where we can capture the advertisement data from the rfduino and check to make sure its ours
        console.log('Device is advertising \'' + rfduino.getAdvertisedServiceName(_peripheral) + '\' service.');
        console.log("serviceUUID: " + _peripheral.advertisement.serviceUuids);

        _peripheral.on('connect', function() {
            console.log("got connect event");
            peripheral.discoverServices();
            noble.stopScanning();
            //connectedPeripheral = peripheral;
        });

        _peripheral.on('disconnect', function() {
            noble.removeListener('discover', onDeviceDiscoveredCallback);
            _peripheral.removeAllListeners('servicesDiscover');
            _peripheral.removeAllListeners('connect');
            _peripheral.removeAllListeners('disconnect');
            //_peripheral = null;
            console.log('Disconnected');
            if (!manualDisconnect) {
                autoReconnect();
            }

        });

        _peripheral.on('servicesDiscover', function(services) {

            var rfduinoService;

            for (var i = 0; i < services.length; i++) {
                if (services[i].uuid === rfduino.serviceUUID) {
                    rfduinoService = services[i];
                    console.log("Found simblee Service");
                    break;
                }
            }

            if (!rfduinoService) {
                console.log('Couldn\'t find the simblee service.');
                return;
            }

            rfduinoService.on('characteristicsDiscover', function(characteristics) {
                console.log('Discovered ' + characteristics.length + ' service characteristics');


                var receiveCharacteristic;

                for (var i = 0; i < characteristics.length; i++) {
                    console.log(characteristics[i].uuid);
                    if (characteristics[i].uuid === rfduino.receiveCharacteristicUUID) {
                        receiveCharacteristic = characteristics[i];
                        //break;
                    }
                    if (characteristics[i].uuid === rfduino.sendCharacteristicUUID) {
                        console.log("Found sendCharacteristicUUID");
                        _sendCharacteristic = characteristics[i];
                        //break;
                    }
                }


                if (receiveCharacteristic) {
                    receiveCharacteristic.on('read', function(data, isNotification) {
                        processCompressedData(data);
                        // var arr = data.toString().split(",");
                        // //console.log(data.toString());
                        // var counter = data.readUInt8(0);
                        // var time1 = data.readUInt32BE(2);
                        // var time2 = data.readUInt32BE(7);
                        // var time3 = data.readUInt32BE(12);
                        //
                        // //console.log(data.toString().split(","));
                        // var diff3 = time2 - time1;
                        // var diff2 = time3 - time2;
                        // var diff1 = time1 - theOtherTime;
                        // packetCounter++;
                        // if (counter - lastCounter > 2 && counter - lastCounter < 100) {
                        //     var jumpDiff = counter - lastCounter;
                        //     //console.log("FAIL "+ counter +" "+ lastCounter + " Counter Diff: "+jumpDiff);
                        // }
                        // if (diff1 > 7000) {
                        //     failCounter++;
                        //     console.log("Diff 1 Fail " + diff1 + " Fails: " + failCounter);
                        // }
                        // if (diff2 > 7000) {
                        //     failCounter++;
                        //     console.log("Diff 2 Fail " + diff2 + " Fails: " + failCounter);
                        // }
                        // if (diff3 > 7000) {
                        //     failCounter++;
                        //     console.log("Diff 3 Fail " + diff3 + " Fails: " + failCounter);
                        // }
                        // console.log("Packets: " + packetCounter + " Counter: " + counter);
                        // //console.log(" First: "+diff1+ " Second: "+diff2 + " Third: "+diff3);
                        // lastCounter = counter;
                        // theOtherTime = time3;
                        // //processCompressedData(data);
                        // //console.log(counter + " " +(parseInt(arr[2])-parseInt(arr[1])));
                        // //if(_sendCharacteristic){
                        //
                        // _sendCharacteristic.write(data[0]);
                        //}

                    });

                    console.log('Subscribing for data notifications');
                    receiveCharacteristic.notify(true);
                }

            });

            rfduinoService.discoverCharacteristics();

        });
        console.log("Calling connect");
        _peripheral.connect(function(err) {
            console.log("connected");
        });

    }
};

// noble.on('stateChange', function(state) {
//     if (state === 'poweredOn') {
//         noble.startScanning([rfduino.serviceUUID], false);
//     }
// });
noble.on('stateChange', function(state) {
    if (state === 'poweredOn') {
        noble.startScanning([rfduino.serviceUUID], false);
    } else {
        noble.stopScanning();
    }
});

noble.on('discover', onDeviceDiscoveredCallback);

function exitHandler(options, err) {
    if (options.cleanup) {
        console.log('clean');
        //console.log(connectedPeripheral);
        manualDisconnect = true;
        _peripheral.disconnect();
        //   if(connectedPeripheral){
        //     noble.disconnect(connectedPeripheral.uuid);
        //   }
        //connectedPeripheral.disconnect();
    }
    if (err) console.log(err.stack);
    if (options.exit) {
        console.log("exit");
        _peripheral.disconnect();
        process.exit();
    }
}
var autoReconnect = function() {
    if (_bleAvailable || noble.state === "poweredOn") {
        noble.on('discover', onDeviceDiscoveredCallback);
        noble.startScanning([rfduino.serviceUUID], false);
    } else {
        this.warn("BLE not AVAILABLE");
    }
}
var interpret24bitAsInt32 = function(byteArray, index) {
    //little endian
    var newInt = (
        ((0xFF & byteArray[index]) << 16) |
        ((0xFF & byteArray[index + 1]) << 8) |
        (0xFF & byteArray[index + 2])
    );
    if ((newInt & 0x00800000) > 0) {
        newInt |= 0xFF000000;
    } else {
        newInt &= 0x00FFFFFF;
    }
    return newInt;
}
var interpret16bitAsInt32 = function(byteArray, index) {
    var newInt = (
        ((0xFF & byteArray[index]) << 8) |
        (0xFF & byteArray[index + 1])
    );
    if ((newInt & 0x00008000) > 0) {
        newInt |= 0xFFFF0000;
    } else {
        newInt &= 0x0000FFFF;
    }
    return newInt;
}
var interpret15bitAsInt32 = function(delta) {
        if ((delta & 0x00004000) > 0) {
            delta |= 0xFFFF8000;
        } else {
            delta &= 0x00007FFF;
        }
        return delta;
    }
    /*

    var array = new Array(3);
    for (var i = 0; i < 3; i++) {
    	array[i] = [' ', ' ', ' '];
    }

    array[0][2] = 'x';
    array[1][1] = 'x';
    array[2][0] = 'x';
     */
    //  void seedDecompressor = function(seed){
    //    for(int i=0; i<4; i++){
    //      decompressedSamples[0][i] = seed[i];
    //    }
    //  }
var decompressSamples = function() {
    // add the delta to the previous value
    for (var i = 1; i < 4; i++) {
        for (var j = 0; j < 4; j++) {
            decompressedSamples[i][j] = decompressedSamples[i - 1][j] - receivedDeltas[i - 1][j];
        }
    }
}
var decompressLossyDeltas = function(buffer) {
    var D = new Array(3);
    for (var i = 0; i < 4; i++) {
        D[i] = [0, 0, 0, 0];
    }
    //int[][] D = new int[3][4];
    var bufferPos = 0;
    for (var i = 0; i < 3; i++) {
        D[i][0] = ((buffer[bufferPos] & 0xFF) << 7);
        bufferPos++; //0111111110000000
        D[i][0] |= ((buffer[bufferPos] & 0xF0) >> 1); //0000000001111000
        D[i][1] = ((buffer[bufferPos] & 0x0F) << 11);
        bufferPos++; //12
        D[i][1] |= ((buffer[bufferPos] & 0xFF) << 3);
        bufferPos++; //4
        D[i][2] = ((buffer[bufferPos] & 0xFF) << 7);
        bufferPos++; //8
        D[i][2] |= ((buffer[bufferPos] & 0xF0) >> 1);
        D[i][3] = ((buffer[bufferPos] & 0x0F) << 11);
        bufferPos++; //12
        D[i][3] |= ((buffer[bufferPos] & 0xFF) << 3);
        bufferPos++; //4

    }
    for (var i = 0; i < 3; i++) { // convert 16bit short deltas to 32bit int deltas
        for (var j = 0; j < 4; j++) {
            receivedDeltas[i][j] = interpret15bitAsInt32(D[i][j]);
            //console.log((receivedDeltas[i][j] + "\t")); // verbose
        }
    }
    //return receivedDeltas;
}

var processCompressedData = function(data) {
    if (lastPacket !== null) {
        //console.log(data[0]+ " " + parseInt(lastPacket[0]));
        if (parseInt(data[0]) === parseInt(lastPacket[0]) + 1) {
            //console.log("GOOD")
            lastPacket = data;
        } else if (parseInt(data[0]) === parseInt(lastPacket[0]) - 255) {
            lastPacket = data;
        } else {
            //console.log("BAD");
            //console.log(data[0] + " " + lastPacket[0]);
            lastPacket = data;
        }
    } else {
        console.log("First Packet");
        //console.log(data[0]);
        lastPacket = data;

    }
    var rawPacket = "";
    for (var i = 0; i < 20; i++) {
        rawPacket += data[i];
        rawPacket += " ";
    }
    //console.log(rawPacket);
    //console.log(data[0] + " " + data[1] + " " + data[2] + " " + data[3] + " " + data[4] + " " + data[5] + " " + data[6] + " " + data[7] + " " + data[8] + " " + data[9] + " " + data[10] + " " + data[11] + " " + data[12]);
    var packetType = parseInt(data[0]);
    switch (packetType) {
        case 0:
            var start = 1;
            //console.log(data.length);\
            uncompressedPacket[0] = parseInt(data[0]);
            packetCounter = uncompressedPacket[0];
            var diff = data.readUInt32BE(16);
            //console.log("diff:"+diff);
            // 16,17,18,19 - time stamp
            //console.log(data[1] + " " + data[2] + " " + data[3] + " " + data[4] + " " + data[5] + " " + data[6] + " " + data[7] + " " + data[8] + " " + data[9] + " " + data[10] + " " + data[11] + " " + data[12]);
            for (var i = 0; i < 4; i++) {
                uncompressedPacket[i + 1] = interpret24bitAsInt32(data, start);
                decompressedSamples[0][i] = uncompressedPacket[i + 1];
                //console.log("Chan"+(i+1)+ " raw: " + receivedDataPacket[i]);
                start += 3;
            }
            //console.log(uncompressedPacket[0] + " " + uncompressedPacket[1] + " " + uncompressedPacket[2] + " " + uncompressedPacket[3] + " " + uncompressedPacket[4])
                //This is RAW data
                //{pckCouter,chan1,chan1,chan1,chan2,chan2,chan2,chan3,chan3,chan3,chan4,chan4,chan4,aux1,aux2,aux3,aux4,aux5,aux6,aux7}
            break;
            // case 1:
            //     //This is compressed data
            //     var start = 1;
            //     uncompressedPacket1[0] = parseInt(data[0]);
            //     for (var i = 0; i < 4; i++) {
            //         var delta = interpret16bitAsInt32(data,start);
            //         uncompressedPacket1[i+1] = uncompressedPacket1[i+1] + delta;
            //         //console.log("Chan"+(i+1)+ " uncompressed: " + receivedDataPacket[i]);
            //         start += 2;
            //     }
            //     console.log("PACKET: "+uncompressedPacket1[0]+" "+uncompressedPacket1[1]+" "+uncompressedPacket1[2]+" "+uncompressedPacket1[3]+" "+uncompressedPacket1[4])
            //     start = 9;
            //     uncompressedPacket2[0] = parseInt(data[0])+1;
            //     for (var i = 0; i < 4; i++) {
            //         var delta = interpret16bitAsInt32(data,start);
            //         uncompressedPacket2[i+1] = uncompressedPacket1[i+1] + delta;
            //         //console.log("Chan"+(i+1)+ " uncompressed: " + receivedDataPacket[i]);
            //         start += 2;
            //     }
            //     console.log("PACKET: "+uncompressedPacket2[0]+" "+uncompressedPacket2[1]+" "+uncompressedPacket2[2]+" "+uncompressedPacket2[3]+" "+uncompressedPacket2[4])
            //     break;
        default:
            //This is compressed data
            // var buffer = Buffer.from([1, 2, 3,4,5,6,8,9,10,11,12,13,14,15,16,17,18]);
            var buffer = new Buffer(18);
            for (var i = 0; i < 19; i++) {
                buffer[i] = data[i + 1];
            }
            // var diff1 = data.readUInt32BE(1);
            // var diff2 = data.readUInt32BE(5);
            // var diff3 = data.readUInt32BE(9);
            // console.log("diff1:"+diff1);
            // console.log("diff2:"+diff2);
            // console.log("diff3:"+diff3);
            //var buffer = Buffer.from(data.buffer, 1, 19);
            decompressLossyDeltas(buffer);
            decompressSamples();
            //parseInt(data[0]) - parseInt(packetCounter)
            //_sendCharacteristic.write(data[0]);
            if(parseInt(data[0]) - parseInt(packetCounter)!=3){
                lastDroppedPacket = parseInt(data[0]) - 3;
                //var retryString = "&"+dropped;
                //var reset = Buffer.from(retryString);
                //_sendCharacteristic.write(reset);
                //console.error("!!!!!PACKET DROP!!!!!!");
                droppedPacket++;
            }else if(parseInt(data[0]) == lastDroppedPacket){
                droppedPacket--;
            }else{
                goodPacket++;
                //console.log(goodPacket)
            }
            //console.log("Good: "+goodPacket+" Dropped: "+droppedPacket);
            packetCounter = parseInt(data[0]);
            for (var i = 1; i < 4; i++) {
                var packet = "";
                packet += packetCounter - (3-i);
                for (var j = 0; j < 4; j++) {
                    packet += ",";
                    packet += decompressedSamples[i][j];
                    //decompressedSamples[i][j] = decompressedSamples[i - 1][j] - receivedDeltas[i - 1][j];
                }
                packet += ";\n";
                if(udpOpen){
                  //server.send(packet,6100);
                  var outBuff = new Buffer(packet);
                  client.send(outBuff,0,outBuff.length, 6000)
                }
                //console.log(packet);
            }
            // var start = 1;
            // uncompressedPacket1[0] = parseInt(data[0]) - 1;
            // for (var i = 0; i < 4; i++) {
            //     var delta = interpret16bitAsInt32(data, start);
            //     uncompressedPacket1[i + 1] = uncompressedPacket2[i + 1] + delta;
            //     //console.log("Chan"+(i+1)+ " uncompressed: " + receivedDataPacket[i]);
            //     start += 2;
            // }
            // console.log("PACKET1: " + uncompressedPacket1[0] + " " + uncompressedPacket1[1] + " " + uncompressedPacket1[2] + " " + uncompressedPacket1[3] + " " + uncompressedPacket1[4])
            // start = 9;
            // uncompressedPacket2[0] = parseInt(data[0]);
            // for (var i = 0; i < 4; i++) {
            //     var delta2 = interpret16bitAsInt32(data, start);
            //     uncompressedPacket2[i + 1] = uncompressedPacket1[i + 1] + delta2;
            //     //console.log("Chan"+(i+1)+ " uncompressed: " + receivedDataPacket[i]);
            //     start += 2;
            // }
            // console.log("PACKET2: " + uncompressedPacket2[0] + " " + uncompressedPacket2[1] + " " + uncompressedPacket2[2] + " " + uncompressedPacket2[3] + " " + uncompressedPacket2[4])

    }
    //console.log(data.toString());
    dataPacket += data.toString();
    //console.log(dataPacket.indexOf('\n'));
    if (dataPacket.indexOf('\n') > -1) {
        dataPacket = dataPacket.replace(/\\n/g, "\\n")
            .replace(/\\'/g, "\\'")
            .replace(/\\"/g, '\\"')
            .replace(/\\&/g, "\\&")
            .replace(/\\r/g, "\\r")
            .replace(/\\t/g, "\\t")
            .replace(/\\b/g, "\\b")
            .replace(/\\f/g, "\\f");
        // remove non-printable and other non-valid JSON chars
        dataPacket = dataPacket.replace(/[\u0000-\u0019]+/g, "");
        dataPacket = dataPacket.replace(/\s+/g, '');
        //console.log(dataPacket);
        try {
            dataObject = JSON.parse(dataPacket.trim());
            //console.log(JSON.stringify(dataObject));
        } catch (e) {
            //console.error(e);
        }
        dataPacket = "";
    }
}

//do something when app is closing
process.on('exit', exitHandler.bind(null, {
    cleanup: true
}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {
    exit: true
}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {
    exit: true
}));
