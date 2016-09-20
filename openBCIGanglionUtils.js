const k = require('./constants'),
    _ = require('underscore');


module.exports = {
    getPeripheralLocalNames,
    getPeripheralWithLocalName,

    getScanReponseFromPeriferals: (pArray) => {
        let output = `${k.TCP_CMD_SCAN}`;
        return getPeripheralLocalNames(pArray).then(list => {
            output = `${output},${k.TCP_CODE_GOOD}`;
            _.each(list, localName => {
                output = `${output},${localName}`;
            });
            return Promise.resovle(`${output}${k.TCP_STOP}`);
        }).catch(err => {
            return Promise.reject(`${output},${k.TCP_CODE_SCAN_NONE_FOUND}${k.TCP_STOP}`);
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
                    if (peripheral.advertisement.localName !== undefined && peripheral.advertisement.localName !== null) {
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

/**
 * @description Get a list of local names from an array of peripherals
 */
function getPeripheralLocalNames(pArray) {
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
}

/**
 * @description Get a peripheral with a local name
 * @param `pArray` {Array} - Array of peripherals
 */
function getPeripheralWithLocalName(pArray, localName) {
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
}
