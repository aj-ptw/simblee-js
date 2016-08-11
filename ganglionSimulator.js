const dgram = require('dgram');

const udpRx = dgram.createSocket('udp4');
const udpTx = dgram.createSocket('udp4');

const udpRxPort = 10996;
const udpTxPort = 10997;

var udpRxOpen = false;

const UDP_CMD_CONNECT     = "c";
const UDP_CMD_COMMAND     = "k";
const UDP_CMD_DISCONNECT  = "d";
const UDP_CMD_ERROR       = "e";
const UDP_CMD_SCAN        = "s";
const UDP_CMD_STATUS      = "q";
const UDP_STOP = ";\n";

var connected = false;

///////////////////////////////////////////////////////////////
// UDP Rx "Server"                                           //
///////////////////////////////////////////////////////////////

udpRx.on('error', (err) => {
  console.log(`server error:\n${err.stack}`);
  udpRx.close();
  udpRxOpen = false;
});

udpRx.on('message', (msg, rinfo) => {
  console.log(`udpRx got: ${msg} from ${rinfo.address}:${rinfo.port}`);
  parseMessage(msg);
});

udpRx.on('listening', () => {
  var address = udpRx.address();
  console.log(`udpRx listening ${address.address}:${address.port}`);
  udpRxOpen = true;
});

udpRx.bind(udpRxPort);

///////////////////////////////////////////////////////////////
// UDP Tx "Server"                                           //
///////////////////////////////////////////////////////////////

var parseMessage = function(msg) {
  var char = String.fromCharCode(msg[0]);
  switch (char) {
    case UDP_CMD_CONNECT:
      var buf = new Buffer(`${UDP_CMD_CONNECT},200${UDP_STOP}`);
      udpTx.send(buf,udpTxPort);
      connected = true;
      break;
    case UDP_CMD_COMMAND:
      if (connected) {
        var buf = new Buffer(`${UDP_CMD_COMMAND},200${UDP_STOP}`);
        udpTx.send(buf,udpTxPort);
      } else {
        error400();
      }
      break;
    case UDP_CMD_DISCONNECT:
      if (connected) {
        var buf = new Buffer(`${UDP_CMD_DISCONNECT},200${UDP_STOP}`);
        udpTx.send(buf,udpTxPort);
        connected = false;
      } else {
        error400();
      }
      break;
    case UDP_CMD_SCAN:
      var buf = new Buffer(`${UDP_CMD_SCAN},200,ganglion-1234${UDP_STOP}`);
      udpTx.send(buf,udpTxPort);
      break;
    case UDP_CMD_STATUS:
      if (connected) {
        var buf = new Buffer(`${UDP_CMD_STATUS},200,true${UDP_STOP}`);
        udpTx.send(buf,udpTxPort);
      } else {
        var buf = new Buffer(`${UDP_CMD_STATUS},200,false${UDP_STOP}`);
        udpTx.send(buf,udpTxPort);
      }
      break;
    case UDP_CMD_ERROR:
    default:
      var buf = new Buffer(`${UDP_CMD_ERROR},500,Error: command not recognized${UDP_STOP}`);
      udpTx.send(buf,udpTxPort);
      break;
  }
}

function error400() {
  var buf = new Buffer(`${UDP_CMD_ERROR},400,Error: No open BLE device${UDP_STOP}`);
  udpTx.send(buf,udpTxPort);
}
