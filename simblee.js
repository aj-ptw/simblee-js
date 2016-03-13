module.exports = {
	serviceUUID: 'fe84',
	receiveCharacteristicUUID: '2d30c082f39f4ce6923f3484ea480596',//'2D30C082-F39F-4CE6-923F-3484EA480596'
	sendCharacteristicUUID: '2d30c083f39f4ce6923f3484ea480596',//
	disconnectCharacteristicUUID: '2d30c084f39f4ce6923f3484ea480596',//

	getAdvertisedServiceName: function(peripheral) {
		// RFduino provide one BluetoothService
		// The Arduino api allows the device to advertise what service the hardware is providing, e.g. 'temp', 'rgb', 'ledbtn'
		// The data is sent in the manufacturer data string
		// The temperature sketch sends [0,0,102,105,108,101]
		// remove the first 2 characters, remaining data is the name of the RFduino service
		return peripheral.advertisement.manufacturerData.slice(2).toString();
	}
};
