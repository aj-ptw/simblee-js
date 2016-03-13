// RFduino Node Example
// Discover and read temperature from RFduinos running the Temperature Sketch
// https://github.com/RFduino/RFduino/blob/master/libraries/RFduinoBLE/examples/Temperature/Temperature.ino
//
// (c) 2014 Don Coleman
var noble = require('noble'),
    rfduino = require('./rfduino'),
    _ = require('underscore');

var sampleCounter = 1;
var connectedPeripheral;
var dataArray1 = [];
var dataArray2 = [];
var whichArray;

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
                    if (characteristics[i].uuid === rfduino.receiveCharacteristicUUID) {
                        receiveCharacteristic = characteristics[i];
                        console.log("Got receiveCharacteristicUUID: "+characteristics[i].uuid);
                        break;
                    }
                }

                if (receiveCharacteristic) {
                    receiveCharacteristic.on('read', function(data, isNotification) {
                        // temperature service sends a float
                        var marker = data.readInt16LE(0);
                        //console.log(marker);

                        switch (marker) {
                          case 11:
                            //console.log("1-16: ")
                            whichArray = 1;
                            sampleCounter = 1;
                            break;
                          case 12:
                            //console.log("17-32: ")
                            whichArray = 2;
                            sampleCounter = 1
                            break;
                          case 99:
                            //console.log("READING COMPLETE")
                            console.log(dataArray1.toString());
                            console.log(dataArray2.toString());
                            sampleCounter = 1;
                            break;
                          default:
                            // if(sampleCounter == 5){
                            //     console.log(sampleCounter+": "+data.readFloatLE(0).toFixed(2) + " PSI");
                            // }
                            switch (whichArray) {
                              case 1:
                                //console.log(sampleCounter);
                                if(sampleCounter<=16){
                                  dataArray1[sampleCounter-1]=data.readFloatLE(0).toFixed(2);
                                }
                                //console.log(sampleCounter+": "+data.readFloatLE(0).toFixed(2) + " PSI");

                                break;
                              case 2:
                                //console.log(sampleCounter+": "+data.readFloatLE(0).toFixed(2) + " PSI");
                                if(sampleCounter<=16){
                                  dataArray2[sampleCounter-1]=data.readFloatLE(0).toFixed(2);
                                }
                                break;
                              default:

                            }
                            sampleCounter++;

                            //console.log(sampleCounter+": "+data.readInt16LE(0));

                            //
                        }
                        // if(data.readInt16LE(0) == 11){
                        //   console.log("1-16: ")
                        // }else if
                        // console.log(data.readInt16LE(0));

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
