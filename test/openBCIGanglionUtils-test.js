var sinon = require('sinon'),
    chai = require('chai'),
    should = chai.should(),
    expect = chai.expect,
    utils = require('../openBCIGanglionUtils'),
    k = require('../constants');

var chaiAsPromised = require("chai-as-promised");
var sinonChai = require("sinon-chai");
chai.use(chaiAsPromised);
chai.use(sinonChai);

var getListOfPeripheralsOfSize = (perifsToMake) => {
    perifsToMake = perifsToMake || 3;

    let perifCount = 0;
    let output = [];

    for (var i = 0; i < perifsToMake; i++) {
        output.push({
            advertisement: {
                localName: makeLocalName(i),
                txPowerLevel: undefined,
                manufacturerData: undefined,
                serviceData: [],
                serviceUuids: []
            }
        })
    }
    return output;
}

var makeLocalName = (num) => {
    let localName = `${k.GANGLION_PREFIX}-00`;
    if (num < 10) {
        localName = `${localName}0${num}`;
    } else {
        localName = `${localName}${num}`;
    }
    return localName;
}

describe('openBCIGanglionUtils',function() {
    describe('#getPeripheralLocalNames', function() {
        it('should resolve a list of localNames from an array of peripherals', function(done) {
            let numPerifs = 3;
            let perifs = getListOfPeripheralsOfSize(numPerifs);
            utils.getPeripheralLocalNames(perifs).then(list => {
                expect(list.length).to.equal(numPerifs);
                for (var i = 0; i < list.length; i++) {
                    expect(list[i]).to.equal(makeLocalName(i));
                }
                done();
            }).catch(done);
        });
        it('should reject if array is empty', function(done) {
            utils.getPeripheralLocalNames([]).should.be.rejected.and.notify(done);
        });
    });
    describe('#getPeripheralWithLocalName', function() {
        it('should resovle a peripheral with local name', function(done) {
            let numOfPerifs = 4;
            let perifs = getListOfPeripheralsOfSize(numOfPerifs);
            // console.log('perifs', perifs);
            let goodName = makeLocalName(numOfPerifs - 1); // Will be in the list
            // console.log(`goodName: ${goodName}`);
            utils.getPeripheralWithLocalName(perifs, goodName).should.be.fulfilled.and.notify(done);
        });
        it('should reject if local name is not in perif list', function(done) {
            let numOfPerifs = 4;
            let perifs = getListOfPeripheralsOfSize(numOfPerifs);
            let badName = makeLocalName(numOfPerifs + 2); // Garuenteed to not be in the list
            utils.getPeripheralWithLocalName(perifs, badName).should.be.rejected.and.notify(done);
        });
        it('should reject if pArray is not array local name is not in perif list', function(done) {
            let badName = makeLocalName(1); // Garuenteed to not be in the list
            utils.getPeripheralWithLocalName(badName).should.be.rejected.and.notify(done);
        });
    });
    describe('#isPeripheralGanglion', function() {
        it('should return true when proper localName', function() {
            let list = getListOfPeripheralsOfSize(1);
            let perif = list[0];
            expect(utils.isPeripheralGanglion(perif)).to.be.true;
        });
        it('should return false when incorrect localName', function() {
            let list = getListOfPeripheralsOfSize(1);
            let perif = list[0];
            perif.advertisement.localName = "burrito";
            expect(utils.isPeripheralGanglion(perif)).to.be.false;
        });
        it('should return false when bad object', function() {
            expect(utils.isPeripheralGanglion({})).to.be.false;
        });
        it('should return false if nothing input', function() {
            expect(utils.isPeripheralGanglion()).to.be.false;
        });
        it('should return false when missing advertisement object', function() {
            let list = getListOfPeripheralsOfSize(1);
            let perif = list[0];
            perif.advertisement = null;
            expect(utils.isPeripheralGanglion(perif)).to.be.false;
        });
    });
});
