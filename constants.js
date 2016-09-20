const GANGLION_CMD_STREAM_START = "b";
const GANGLION_CMD_STREAM_TEST_START = "t";
const GANGLION_CMD_STREAM_STOP = "s";
const GANGLION_CMD_STREAM_TEST_STOP = "y";
const GANGLION_PREFIX = "Simblee";// "Ganglion";

const TCP_CMD_CONNECT = "c";
const TCP_CMD_COMMAND = "k";
const TCP_CMD_DISCONNECT  = "d";
const TCP_CMD_ERROR = "e";
const TCP_CMD_LOG = "l";
const TCP_CMD_SCAN = "s";
const TCP_CMD_STATUS = "q";
const TCP_DATA = "t";
const TCP_STOP = ",;\n";
const TCP_CODE_GOOD = 200;
const TCP_CODE_CONNECT_DEVICE_NOT_FOUND = 405;
const TCP_CODE_CONNECT_ALREADY_CONNECTED = 408;
const TCP_CODE_CONNECT_UNABLE_TO_CONNECT = 402;
const TCP_CODE_SCAN_ALREADY_SCANNING = 409;
const TCP_CODE_SCAN_NONE_FOUND = 407;

const SIMBLEE_UUID_SERVICE = 'fe84';
const SIMBLEE_UUID_RECEIVE = '2d30c082f39f4ce6923f3484ea480596';
const SIMBLEE_UUID_SEND = '2d30c083f39f4ce6923f3484ea480596';
const SIMBLEE_UUID_DISCONNECT = '2d30c084f39f4ce6923f3484ea480596';

const BLE_SEARCH_TIME = 10000; // In ms

var constants = {
    GANGLION_CMD_STREAM_START,
    GANGLION_CMD_STREAM_TEST_START,
    GANGLION_CMD_STREAM_STOP,
    GANGLION_CMD_STREAM_TEST_STOP,
    GANGLION_PREFIX,
    TCP_CMD_CONNECT,
    TCP_CMD_COMMAND,
    TCP_CMD_DISCONNECT,
    TCP_CMD_ERROR,
    TCP_CMD_LOG,
    TCP_CMD_SCAN,
    TCP_CMD_STATUS,
    TCP_DATA,
    TCP_STOP,
    TCP_CODE_GOOD,
    TCP_CODE_CONNECT_ALREADY_CONNECTED,
    TCP_CODE_CONNECT_DEVICE_NOT_FOUND,
    TCP_CODE_CONNECT_UNABLE_TO_CONNECT,
    TCP_CODE_SCAN_ALREADY_SCANNING,
    TCP_CODE_SCAN_NONE_FOUND,
    // Service characteristics
    SIMBLEE_UUID_SERVICE,
    SIMBLEE_UUID_RECEIVE,
    SIMBLEE_UUID_SEND,
    SIMBLEE_UUID_DISCONNECT,
    BLE_SEARCH_TIME
}

module.exports = constants;
