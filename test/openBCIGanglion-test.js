var sinon = require('sinon'),
    chai = require('chai'),
    should = chai.should(),
    expect = chai.expect,
    openBCIGanglion = require('../'),
    k = require('../constants');

var chaiAsPromised = require("chai-as-promised");
var sinonChai = require("sinon-chai");
chai.use(chaiAsPromised);
chai.use(sinonChai);
