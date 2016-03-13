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
var _peripheral;
    var _sendCharacteristic;
    var _bleAvailable = false;
    var manualDisconnect = false;

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
        console.log('RFduino is advertising \'' + rfduino.getAdvertisedServiceName(_peripheral) + '\' service.');
        console.log("serviceUUID: "+_peripheral.advertisement.serviceUuids);

        _peripheral.on('connect', function() {
            console.log("got connect event");
            peripheral.discoverServices();
            noble.stopScanning();
            //connectedPeripheral = peripheral;
        });

        _peripheral.on('disconnect', function() {
          noble.removeListener('discover',onDeviceDiscoveredCallback);
          _peripheral.removeAllListeners('servicesDiscover');
          _peripheral.removeAllListeners('connect');
          _peripheral.removeAllListeners('disconnect');
          //_peripheral = null;
          console.log('Disconnected');
          if(!manualDisconnect){
            autoReconnect();
          }

        });

        _peripheral.on('servicesDiscover', function(services) {

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
                    if (characteristics[i].uuid === rfduino.receiveCharacteristicUUID) {
                        receiveCharacteristic = characteristics[i];
                        break;
                    }
                    if (characteristics[i].uuid === rfduino.sendCharacteristicUUID) {
                        _sendCharacteristic = characteristics[i];
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
        _peripheral.connect();

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
      _peripheral.disconnect();
    //   if(connectedPeripheral){
    //     noble.disconnect(connectedPeripheral.uuid);
    //   }
      //connectedPeripheral.disconnect();
    }
    if (err) console.log(err.stack);
    if (options.exit) process.exit();
}
var autoReconnect = function(){
  if(_bleAvailable || noble.state === "poweredOn"){
    noble.on('discover', onDeviceDiscoveredCallback);
    noble.startScanning([rfduino.serviceUUID], false);
  }else{
    this.warn("BLE not AVAILABLE");
  }
}

//do something when app is closing
process.on('exit', exitHandler.bind(null,{cleanup:true}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit:true}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit:true}));
