const k = require('./constants'),
    _ = require('underscore');


module.exports = {
    /**
     * @description Get a list of local names from an array of peripherals
     */
    getPeripheralLocalNames: (pArray) => {
        return new Promise((resolve, reject) => {
            var list = []
            _.each(pArray, perif => {
                list.push(perif.advertisement.localName);
            });
            if (list.length > 0) {
                return resolve(list);
            } else {
                return reject(`No peripherals discovered with prefix equal to ${k.GANGLION_PREFIX}`);
            }
        });
    },
    /**
     * @description Get a peripheral with a local name
     * @param `pArray` {Array} - Array of peripherals
     */
    getPeripheralWithLocalName: (pArray, localName) => {
        return new Promise((resolve, reject) => {
            if (typeof(pArray) !== "object") return reject(`pArray must be of type Object`);
            _.each(pArray, perif => {
                if (perif.advertisement.hasOwnProperty("localName")) {
                    if (perif.advertisement.localName === localName) {
                        return resolve(perif);
                    }
                }
            });
            return reject(`No peripheral found with localName: ${localName}`);
        });
    },
    /**
     * @description Very safely checks to see if the noble peripheral is a
     *  ganglion by way of checking the local name property.
     */
    isPeripheralGanglion: (peripheral) => {
        if (peripheral) {
            if (peripheral.hasOwnProperty("advertisement")) {
                if (peripheral.advertisement !== null && peripheral.advertisement.hasOwnProperty("localName")) {
                    if (typeof(peripheral.advertisement.localName) !== undefined) {
                        if(peripheral.advertisement.localName.indexOf(k.GANGLION_PREFIX) > -1){
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }
}
