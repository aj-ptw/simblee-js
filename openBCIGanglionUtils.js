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
                list.push(perif.localName);
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
                if (perif.hasOwnProperty("localName")) {
                    if (perif.localName === localName) {
                        return resolve(perif);
                    }
                }
            });
            return reject(`No peripheral found with localName: ${localName}`);
        });
    }
}
