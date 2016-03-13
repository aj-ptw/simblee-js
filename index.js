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
var dataObject;

// TODO why does this need to be wrapped?
var stop = function() {
    noble.stopScanning();
};

noble.on('scanStart', function() {
    console.log('Scan started');
    setTimeout(stop, 10000);
});

noble.on('scanStop', function() {
    console.log('Scan stopped');
});

var onDeviceDiscoveredCallback = function(peripheral) {
    console.log('\nDiscovered Peripherial ' + peripheral.uuid);

    if (_.contains(peripheral.advertisement.serviceUuids, rfduino.serviceUUID)) {
        // here is where we can capture the advertisement data from the rfduino and check to make sure its ours
        console.log('RFduino is advertising \'' + rfduino.getAdvertisedServiceName(peripheral) + '\' service.');
        console.log("serviceUUID: "+peripheral.advertisement.serviceUuids);

        peripheral.on('connect', function() {
            console.log("got connect event");
            peripheral.discoverServices();
            connectedPeripheral = peripheral;
        });

        peripheral.on('disconnect', function() {
            console.log('Disconnected');
            connectedPeripheral = null;
            noble.startScanning([rfduino.serviceUUID], false);
        });

        peripheral.on('servicesDiscover', function(services) {

            var rfduinoService;

            for (var i = 0; i < services.length; i++) {
                if (services[i].uuid === rfduino.serviceUUID) {
                    rfduinoService = services[i];
                    console.log("Found RFduino Service");
                    break;
                }
            }

            if (!rfduinoService) {
                console.log('Couldn\'t find the RFduino service.');
                return;
            }

            rfduinoService.on('characteristicsDiscover', function(characteristics) {
                console.log('Discovered ' + characteristics.length + ' service characteristics');

                var receiveCharacteristic;

                for (var i = 0; i < characteristics.length; i++) {
                    //console.log(characteristics[i].uuid);
                    if (characteristics[i].uuid === rfduino.receiveCharacteristicUUID) {
                        receiveCharacteristic = characteristics[i];
                        console.log("Got receiveCharacteristicUUID: "+characteristics[i].uuid);
                        break;
                    }
                }

                if (receiveCharacteristic) {
                    receiveCharacteristic.on('read', function(data, isNotification) {
                        // temperature service sends a float
                         //console.log(data.toString());
                         dataPacket += data.toString();
                         //console.log(dataPacket.indexOf('\n'));
                         if(dataPacket.indexOf('\n')>-1){
                             dataPacket = dataPacket.replace(/\\n/g, "\\n")
                                .replace(/\\'/g, "\\'")
                                .replace(/\\"/g, '\\"')
                                .replace(/\\&/g, "\\&")
                                .replace(/\\r/g, "\\r")
                                .replace(/\\t/g, "\\t")
                                .replace(/\\b/g, "\\b")
                                .replace(/\\f/g, "\\f");
                            // remove non-printable and other non-valid JSON chars
                             dataPacket = dataPacket.replace(/[\u0000-\u0019]+/g,"");
                             dataPacket = dataPacket.replace(/\s+/g, '');
                             //console.log(dataPacket);
                             try {
                                 dataObject = JSON.parse(dataPacket.trim());
                                 console.log(JSON.stringify(dataObject));
                             } catch (e) {
                                 console.error(e);
                             }
                             dataPacket = "";
                         }

                    });

                    console.log('Subscribing for data notifications');
                    receiveCharacteristic.notify(true);
                }

            });

            rfduinoService.discoverCharacteristics();

        });
        console.log("Calling connect");
        peripheral.connect();

    }
};

noble.on('stateChange', function(state) {
    if (state === 'poweredOn') {
        noble.startScanning([rfduino.serviceUUID], false);
    }
});

noble.on('discover', onDeviceDiscoveredCallback);

function exitHandler(options, err) {
    if (options.cleanup){
      console.log('clean');
      //console.log(connectedPeripheral);
      if(connectedPeripheral){
        noble.disconnect(connectedPeripheral.uuid);
      }
      //connectedPeripheral.disconnect();
    }
    if (err) console.log(err.stack);
    if (options.exit) process.exit();
}

//do something when app is closing
process.on('exit', exitHandler.bind(null,{cleanup:true}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit:true}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit:true}));
