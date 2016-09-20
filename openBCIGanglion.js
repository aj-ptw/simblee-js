// RFduino Node Example
// Discover and read temperature from RFduinos running the Temperature Sketch
// https://github.com/RFduino/RFduino/blob/master/libraries/RFduinoBLE/examples/Temperature/Temperature.ino
//
// (c) 2014 Don Coleman
const noble = require('noble'),
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
var droppedPacketCounter = 0;
var goodPacket = 0;
var lastDroppedPacket;
var packetArray = new Array(127);
var droppedPacketArray = new Array(127);
var droppedPacketCounters = [];
var udpOpen = false;

const ganglionSampleRate = 256;
const tcpHost = "127.0.0.1";
const tcpPort = 10996;
// const udpRxPort = 10996;
// const udpTxPort = 10997;

const GANGLION_CMD_STREAM_START = "b";
const GANGLION_CMD_STREAM_TEST_START = "t";
const GANGLION_CMD_STREAM_STOP = "s";
const GANGLION_CMD_STREAM_TEST_STOP = "y";
const GANGLION_PREFIX = "Ganglion";
const TCP_CMD_CONNECT = "c";
const TCP_CMD_COMMAND = "k";
const TCP_CMD_DISCONNECT  = "d";
const TCP_CMD_ERROR = "e";
const TCP_CMD_LOG = "l";
const TCP_CMD_SCAN = "s";
const TCP_CMD_STATUS = "q";
const TCP_DATA = "t";
const TCP_STOP = ",;\n";
const CODE_GOOD = 200;

// let udpRxOpen = false;
let tcpOpen = false;
// let connected = true;
let stream;
let streaming = false;

let connected = true;

///////////////////////////////////////////////////////////////
// TCP "Server"                                              //
///////////////////////////////////////////////////////////////

// Load the TCP Library
net = require('net');

// Keep track of the chat clients
var clients = [];

// Start a TCP Server
net.createServer((socket) => {

    // Identify this client
    socket.name = socket.remoteAddress + ":" + socket.remotePort

    // Put this new client in the list
    clients.push(socket);

    // Print debug message
    // console.log("Welcome " + socket.name + "\n");

    // Handle incoming messages from clients.
    socket.on('data', data => {
        console.log(`server got: ${data} from ${socket.name}`);
        parseMessage(data, socket);
    });

    // Remove the client from the list when it leaves
    socket.on('end', () => {
        clients.splice(clients.indexOf(socket), 1);
        console.log(socket.name + " left.\n");
        if (streaming) {
            // No more clients :/ might as well stop streaming, if that's what your into.
            if (clients.length == 0) {
                if (stream) clearInterval(stream); // Stops the stream
                streaming = false;
            }
        }
    });
}).listen({
    port: tcpPort,
    host: tcpHost
});

console.log(`server listenings on port ${tcpHost}:${tcpPort}`);

// Send a message to all clients
var broadcast = (message, sender) => {
    clients.forEach((client) => {
        client.write(message);
    });
}

var parseMessage = (msg, client) => {
    let msgElements = msg.toString().split(',');
    // var char = String.fromCharCode(msg[0]);
    // console.log('msgElements[0]',msgElements[0],char);
    switch (msgElements[0]) {
        case TCP_CMD_CONNECT:
            client.write(`${TCP_CMD_CONNECT},200${TCP_STOP}`);
            connected = true;
            break;
        case TCP_CMD_COMMAND:
            if (connected) {
                parseCommand(msgElements[1], client);
                if(_sendCharacteristic!== null){
                    var out = new Buffer(msgElements[1]);
                    _sendCharacteristic.write(out);
                    console.log(`sending ${out} to Ganglion`);
                }
            } else {
                error400();
            }
            break;
        case TCP_CMD_DISCONNECT:
            if (connected) {
                client.write(`${TCP_CMD_DISCONNECT},200${TCP_STOP}`);
                connected = false;
            } else {
                error400();
            }
            break;
        case TCP_CMD_SCAN:
            // console.log(`sending: ${TCP_CMD_SCAN},200,ganglion-1234,bose-qc-headphones,ganglion-5678,ganglion-9678${TCP_STOP}`);
            client.write(`${TCP_CMD_SCAN},200,ganglion-1234,bose-qc-headphones,ganglion-5678,ganglion-9678${TCP_STOP}`);
            break;
        case TCP_CMD_STATUS:
            if (connected) {
                client.write(`${TCP_CMD_STATUS},200,true${TCP_STOP}`);
            } else {
                client.write(`${TCP_CMD_STATUS},200,false${TCP_STOP}`);
            }
            break;
        case TCP_CMD_ERROR:
        default:
            client.write(`${TCP_CMD_ERROR},500,Error: command not recognized${TCP_STOP}`);
            break;
    }
}

var parseCommand = (cmd, client) => {
    console.log(cmd);
    switch (cmd) {
        case GANGLION_CMD_STREAM_START:
        case GANGLION_CMD_STREAM_TEST_START:
            console.log('start stream');
            //      startStream(); // Starts the stream
            streaming = true;
            droppedPacketCounter = 0;
            break;
        case GANGLION_CMD_STREAM_STOP:
        case GANGLION_CMD_STREAM_TEST_STOP:
            console.log('stop stream');
            //      if (stream) clearInterval(stream); // Stops the stream
            streaming = false;
            break;
        default:
            // Send message to tell driver command not recognized
            client.write(`${TCP_CMD_COMMAND},406${TCP_STOP}`);
            break;
    }
}

function error400() {
    client.write(`${TCP_CMD_ERROR},400,Error: No open BLE device${TCP_STOP}`);
}

var receivedDeltas = new Array(3);
for (var i = 0; i < 4; i++) {
    receivedDeltas[i] = [0, 0, 0, 0];
}

var decompressedSamples = new Array(3);
for (var i = 0; i < 3; i++) {
    decompressedSamples[i] = [0, 0, 0, 0];
}

// TODO why does this need to be wrapped?
var stop = function() {
    noble.stopScanning();
};



// Called after one second of scanning
var scanFinalize = () => {
    output = `${TCP_CMD_SCAN}`;
    if (peripheralArray.length > 0) {
        output = `${output},${CODE_GOOD}`;
        // Loop through peripherals and get localName property, add to the array
        for (var p in peripheralArray) {
            if (object.hasOwnProperty("localName")) {

            }
        }
    } else {

    }
}

noble.on('scanStart', function() {
    console.log('Scan started');

    //setTimeout(stop, 60000);
});

noble.on('scanStop', function() {
    console.log('Scan stopped');
});


var bleConnect = peripheral => {
    // if (_.contains(_peripheral.advertisement.localName, rfduino.localNamePrefix)) {
    // TODO: slice first 8 of localName and see if that is ganglion
    // here is where we can capture the advertisement data from the rfduino and check to make sure its ours
    console.log('Device is advertising \'' + peripheral.advertisement.localName + '\' service.');
    // TODO: filter based on advertising name ie make sure we are looking for the right thing
    console.log("serviceUUID: " + _peripheral.advertisement.serviceUuids);

    _peripheral.on('connect', function() {
        console.log("got connect event");
        peripheral.discoverServices();
        noble.stopScanning();
        //connectedPeripheral = peripheral;
    });

    _peripheral.on('disconnect', function() {
        // TODO: clean up our connectedPeripheral
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
                    // TODO: handle all the data, both streaming and not
                    if(streaming){
                        processCompressedData(data);
                    }else{

                    }
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
        // connected = true;
    });
};

var peripheralArray = [];

var onDeviceDiscoveredCallback = function(peripheral) {
    // _peripheral = peripheral;
    // console.log('\nDiscovered Peripherial ' + peripheral.uuid);
    //console.log(peripheral.advertisement);
    //if(typeof(rfduino.getAdvertisedServiceName(peripheral))!=="undefined"){
    //console.log('Device is advertising \'' + peripheral.advertisement.localName + '\' service.');
    //}
    if(peripheral.advertisement.localName.indexOf(rfduino.localNamePrefix) > -1){
        peripheralArray.push(peripheral);
    }
};

// noble.on('stateChange', function(state) {
//     if (state === 'poweredOn') {
//         noble.startScanning([rfduino.serviceUUID], false);
//     }
// });
noble.on('stateChange', function(state) {
    // TODO: send state change error to gui
    if (state === 'poweredOn') {
        noble.startScanning([], false);
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
    // TODO: send back reconnect status, or reconnect fail
    if (_bleAvailable || noble.state === "poweredOn") {
        noble.on('discover', onDeviceDiscoveredCallback);
        noble.startScanning([rfduino.serviceUUID], false);
    } else {
        this.warn("BLE not AVAILABLE");
    }
}

///

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
var interpret16bitAsInt32 = function(delta) {
    if ((delta & 0x00008000) > 0) {
        delta |= 0xFFFF0000;
    } else {
        delta &= 0x0000FFFF;
    }
    return delta;
}

var interpret19bitAsInt32 = function(delta) {
    if ((delta & 0x00000001) > 0) {
        delta |= 0xFFF80000;
    } else {
        delta &= 0x0007FFFF;
    }
    return delta;
}

var decompressSamples = function() {
    // add the delta to the previous value
    for (var i = 1; i < 3; i++) {
        for (var j = 0; j < 4; j++) {
            decompressedSamples[i][j] = decompressedSamples[i - 1][j] - receivedDeltas[i - 1][j];
        }
    }
}

var decompressDeltas = function(buffer) {
    var D = new Array(2);
    // for (var i = 0; i < 4; i++) {
    D[0] = [0, 0, 0, 0];
    D[1] = [0, 0, 0, 0];
    // }
    //int[][] D = new int[3][4];
    var bufferPos = 0;

    D[0][0] = ((buffer[bufferPos] & 0xFF) << 11);   //1111111100000000000
    bufferPos++; //1
    D[0][0] |= ((buffer[bufferPos] & 0xFF) << 3);   //0000000011111111000
    bufferPos++; //2
    D[0][0] |= ((buffer[bufferPos] & 0xE0) >> 5);   //0000000000000000111
    D[0][1] = ((buffer[bufferPos] & 0x1F) << 14);   //1111100000000000000
    bufferPos++; //3
    D[0][1] |= ((buffer[bufferPos] & 0xFF) << 6);   //0000011111111000000
    bufferPos++; //4
    D[0][1] |= ((buffer[bufferPos] & 0xFC) >> 2);   //0000000000000111111
    D[0][2] = ((buffer[bufferPos] & 0x03) << 17);
    bufferPos++; //5
    D[0][2] |= ((buffer[bufferPos] & 0xFF) << 9);
    bufferPos++; //6
    D[0][2] |= ((buffer[bufferPos] & 0xFF) << 1);
    bufferPos++; //7
    D[0][2] |= ((buffer[bufferPos] & 0x80) >> 7);
    D[0][3] = ((buffer[bufferPos] & 0x7F) << 12);
    bufferPos++; //8
    D[0][3] |= ((buffer[bufferPos] & 0xFF) << 4);
    bufferPos++; //9
    D[0][3] |= ((buffer[bufferPos] & 0xF0) >> 4);
    D[1][0] = ((buffer[bufferPos] & 0x0F) << 15);
    bufferPos++; //10
    D[1][0] |= ((buffer[bufferPos] & 0xFF) << 7);
    bufferPos++; //11
    D[1][0] |= ((buffer[bufferPos] & 0xFE) >> 1);
    D[1][1] = ((buffer[bufferPos] & 0x01) << 18);
    bufferPos++; //12
    D[1][1] |= ((buffer[bufferPos] & 0xFF) << 10);
    bufferPos++; //13
    D[1][1] |= ((buffer[bufferPos] & 0xFF) << 2);
    bufferPos++; //14
    D[1][1] |= ((buffer[bufferPos] & 0xC0) >> 6);
    D[1][2] = ((buffer[bufferPos] & 0x3F) << 13);
    bufferPos++; //15
    D[1][2] |= ((buffer[bufferPos] & 0xFF) << 5);
    bufferPos++; //16
    D[1][2] |= ((buffer[bufferPos] & 0xF8) >> 3);
    D[1][3] = ((buffer[bufferPos] & 0x07) << 16);
    bufferPos++; //17
    D[1][3] |= ((buffer[bufferPos] & 0xFF) << 8);
    bufferPos++;
    D[1][3] |= (buffer[bufferPos] & 0xFF);



    // var deltaString = ""; // verbose
    for (var j = 0; j < 2; j++) { // convert 16bit short deltas to 32bit int deltas
        for (var k = 0; k < 4; k++) {
            receivedDeltas[j][k] = interpret19bitAsInt32(D[j][k]);
            // deltaString += receivedDeltas[k][j]; deltaString += "\t" // verbose
        }
    }
    // console.log(deltaString);  // verbose
}

var processCompressedData = function(data) {
    if (lastPacket !== null) {
        //console.log(data[0]+ " " + parseInt(lastPacket[0]));
        // if (parseInt(data[0]) === parseInt(lastPacket[0]) + 1) {
        //     //console.log("GOOD")
        //     lastPacket = data;
        // } else if (parseInt(data[0]) === parseInt(lastPacket[0]) - 255) {
        //     lastPacket = data;
        // } else {
        //     //console.log("BAD");
        //     //console.log(data[0] + " " + lastPacket[0]);
        //     lastPacket = data;
        // }
    } else {
        console.log("First Packet");

        //console.log(data[0]);
        // lastPacket = data;

    }
    lastPacket = data;
    var packetType = parseInt(data[0]);
    switch (packetType) {
        case 0:
        var start = 1;
        //console.log(data.length);
        // console.log("zero packet");
        uncompressedPacket[0] = parseInt(data[0]);
        packetCounter = uncompressedPacket[0];  // used to find dropped packets
        for (var i = 0; i < 4; i++) {
            uncompressedPacket[i + 1] = interpret24bitAsInt32(data, start);
            decompressedSamples[0][i] = uncompressedPacket[i + 1];  // seed the decompressor
            //console.log("Chan"+(i+1)+ " raw: " + receivedDataPacket[i]);
            start += 3;
        }
        //console.log(uncompressedPacket[0] + " " + uncompressedPacket[1] + " " + uncompressedPacket[2] + " " + uncompressedPacket[3] + " " + uncompressedPacket[4])
        var uncompressedPacketCSV = `${TCP_DATA},200,${uncompressedPacket[0]},${uncompressedPacket[1]},${uncompressedPacket[2]},${uncompressedPacket[3]},${uncompressedPacket[4]}${TCP_STOP}`;
        // console.log("zero packet " + uncompressedPacketCSV);
        client.write(uncompressedPacketCSV);
        // var outBuff = new Buffer(uncompressedPacketCSV);
        // udpTx.send(outBuff,0,outBuff.length, udpTxPort);
        break;

        default:
        //This is compressed data
        if(parseInt(data[0]) - packetCounter != 2){ // check for dropped packet
            lastDroppedPacket = parseInt(data[0]); // - 2;
            //var retryString = "&"+dropped;
            //var reset = Buffer.from(retryString);
            //_sendCharacteristic.write(reset);
            droppedPacketCounter++;
            console.error("\t>>>PACKET DROP<<<  " + packetCounter + "  " + lastDroppedPacket + " " + droppedPacketCounter);
        }else{
            // goodPacket++;
            // console.log(goodPacket)
        }
        var buffer = new Buffer(19);
        for (var i = 0; i < 19; i++) {
            buffer[i] = data[i + 1];
        }

        decompressDeltas(buffer);
        decompressSamples();

        packetCounter = parseInt(data[0]);
        for (var i = 1; i < 3; i++) {
            var packet = "";
            packet = `${TCP_DATA},200,`;
            packet += (packetCounter - (2-i));
            for (var j = 0; j < 4; j++) {
                packet += ",";
                packet += decompressedSamples[i][j];
                //decompressedSamples[i][j] = decompressedSamples[i - 1][j] - receivedDeltas[i - 1][j];
            }
            packet += `${TCP_STOP}`;
            if(udpOpen){
                //udpRx.send(packet,udpRxPort);
                client.write(packet);
                // var outBuff = new Buffer(packet);
                // udpTx.send(outBuff,0,outBuff.length, udpTxPort);
            }
            // console.log(packet);
        }
        for(var i=0; i<4; i++){ // rotate the 0 position for next time
            decompressedSamples[0][i] = decompressedSamples[2][i];
        }
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
