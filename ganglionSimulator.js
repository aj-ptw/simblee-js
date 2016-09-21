// const dgram = require('dgram');
const gaussian = require('gaussian');

// const udpRx = dgram.createSocket('udp4');
// const udpTx = dgram.createSocket('udp4');

const ganglionSampleRate = 256;
const tcpHost = "127.0.0.1";
const tcpPort = 10996;

const GANGLION_CMD_STREAM_START = "b";
const GANGLION_CMD_STREAM_STOP = "s";
const TCP_CMD_CONNECT = "c";
const TCP_CMD_COMMAND = "k";
const TCP_CMD_DISCONNECT  = "d";
const TCP_CMD_ERROR = "e";
const TCP_CMD_LOG = "l";
const TCP_CMD_SCAN = "s";
const TCP_CMD_STATUS = "q";
const UDP_DATA = "t";
const UDP_STOP = ",;\n";

let tcpOpen = false;
let connected = false;
let stream;
let streaming = false;

///////////////////////////////////////////////////////////////
// TCP "Server"                                              //
///////////////////////////////////////////////////////////////

// Load the TCP Library
net = require('net');

// Keep track of the chat clients
var clients = [];

// Start a TCP Server
net.createServer((socket) => {

  // Identify this client
  socket.name = socket.remoteAddress + ":" + socket.remotePort

  // Put this new client in the list
  clients.push(socket);

  // Print debug message
  // console.log("Welcome " + socket.name + "\n");

  // Handle incoming messages from clients.
  socket.on('data', data => {
    console.log(`server got: ${data} from ${socket.name}`);
    parseMessage(data, socket);
  });

  // Remove the client from the list when it leaves
  socket.on('end', () => {
    clients.splice(clients.indexOf(socket), 1);
    console.log(socket.name + " left.\n");
    if (streaming) {
      // No more clients :/ might as well stop streaming, if that's what your into.
      if (clients.length == 0) {
        if (stream) clearInterval(stream); // Stops the stream
        streaming = false;
      }
    }
  });
}).listen({
  port: tcpPort,
  host: tcpHost
});

console.log(`server listenings on port ${tcpHost}:${tcpPort}`);

// Send a message to all clients
var broadcast = (message, sender) => {
  clients.forEach((client) => {
    client.write(message);
  });
}

///////////////////////////////////////////////////////////////
// UDP Tx "Server"                                           //
///////////////////////////////////////////////////////////////

var parseMessage = (msg, client) => {
  let msgElements = msg.toString().split(',');
  // var char = String.fromCharCode(msg[0]);
  // console.log('msgElements[0]',msgElements[0],char);
  switch (msgElements[0]) {
    case TCP_CMD_CONNECT:
      client.write(`${TCP_CMD_CONNECT},200${UDP_STOP}`);
      connected = true;
      break;
    case TCP_CMD_COMMAND:
      if (connected) {
        parseCommand(msgElements[1], client);
      } else {
        error400();
      }
      break;
    case TCP_CMD_DISCONNECT:
      if (connected) {
        client.write(`${TCP_CMD_DISCONNECT},200${UDP_STOP}`);
        connected = false;
      } else {
        error400();
      }
      break;
    case TCP_CMD_SCAN:
      // console.log(`sending: ${TCP_CMD_SCAN},200,ganglion-1234,bose-qc-headphones,ganglion-5678,ganglion-9678${UDP_STOP}`);
      client.write(`${TCP_CMD_SCAN},200,ganglion-1234,bose-qc-headphones,ganglion-5678,ganglion-9678${UDP_STOP}`);
      break;
    case TCP_CMD_STATUS:
      if (connected) {
        client.write(`${TCP_CMD_STATUS},200,true${UDP_STOP}`);
      } else {
        client.write(`${TCP_CMD_STATUS},200,false${UDP_STOP}`);
      }
      break;
    case TCP_CMD_ERROR:
    default:
      client.write(`${TCP_CMD_ERROR},500,Error: command not recognized${UDP_STOP}`);
      break;
  }
  // client.write(`${TCP_CMD_LOG},tacos${UDP_STOP}`);
}

var parseCommand = (cmd, client) => {
  console.log(cmd);
  switch (cmd) {
    case GANGLION_CMD_STREAM_START:
      console.log('start stream');
      startStream(); // Starts the stream
      streaming = true;
      break;
    case GANGLION_CMD_STREAM_STOP:
      console.log('stop stream');
      if (stream) clearInterval(stream); // Stops the stream
      streaming = false;
      break;
    default:
      // Send message to tell driver command not recognized
      client.write(`${TCP_CMD_COMMAND},406${UDP_STOP}`);

      break;
  }
}

var startStream = () => {
    const intervalInMS = 1000 / ganglionSampleRate;
    const strPre = `${UDP_DATA},200,`;
    const strPost = `${UDP_STOP}`;
    let sampleNumber = 0;
    let sampleGenerator = randomSample(4, 200, true, true);

    var getSample = sampleNumber => {
      let arr =  getArrayFromSample(sampleGenerator(sampleNumber));
    //   console.log(`${sampleNumber},${arr[0].toString()},${arr[1].toString()},${arr[2].toString()},${arr[3].toString()}`);
      return `${sampleNumber},${arr[0].toFixed(12).toString()},${arr[1].toFixed(12).toString()},${arr[2].toFixed(12).toString()},${arr[3].toFixed(12).toString()}`;
    };

    stream = setInterval(() => {
        let samp = getSample(sampleNumber);
        // Send the packet to all clients
        broadcast(`${strPre}${samp}${strPost}`);
        // Increment the sample number
        sampleNumber++;
    }, intervalInMS);
};

function floatToInt(n) {
    const MCP3912_Vref = 1.2;
    const MCP3912_Gain = 1.0;
    const scale_fac_uVolts_per_count = (MCP3912_Vref * 1000000) / (8388607.0 * MCP3912_Gain * 1.5 * 51.0); //MCP3912 datasheet page 34. Gain of InAmp = 80

    return Math.floor(n * scale_fac_uVolts_per_count); // Truncate counts number
}

/**
 * @description Mainly used by the simulator to convert a randomly generated sample into a std OpenBCI V3 Packet
 * @param sample - A sample object
 * @returns {Buffer}
 */
function getArrayFromSample(sample) {
    var array = [];
    const distribution = gaussian(0,1);

    // console.log(sample.sampleNumber, sample.channelData);

    return sample.channelData;

    // // channel data
    // for (var i = 0; i < 4; i++) {
    //     let whiteNoise = Math.abs(distribution.ppf(Math.random()) * Math.sqrt(256/2) * 1000);
    //
    //     array.push(Math.floor(whiteNoise));
    // }
    //
    // return array;
}

/**
 * @description Create a configurable function to return samples for a simulator. This implements 1/f filtering injection to create more brain like data.
 * @param numberOfChannels {Number} - The number of channels in the sample... either 8 or 16
 * @param sampleRateHz {Number} - The sample rate
 * @param injectAlpha {Boolean} - True if you want to inject noise
 * @param lineNoise {String} - A string that can be either:
 *              `60Hz` - 60Hz line noise (Default) (ex. __United States__)
 *              `50Hz` - 50Hz line noise (ex. __Europe__)
 *              `None` - Do not inject line noise.
 *
 * @returns {Function}
 */
var randomSample = (numberOfChannels, sampleRateHz, injectAlpha, lineNoise) => {
  const distribution = gaussian(0,1);
  const sineWaveFreqHz10 = 10;
  const sineWaveFreqHz50 = 50;
  const sineWaveFreqHz60 = 60;
  const uVolts = 1000000;

  var sinePhaseRad = new Array(numberOfChannels+1); //prevent index error with '+1'
  sinePhaseRad.fill(0);

  var accelCounter = 0;

  // Init arrays to hold coefficients for each channel and init to 0
  //  This gives the 1/f filter memory on each iteration
  var b0 = new Array(numberOfChannels).fill(0);
  var b1 = new Array(numberOfChannels).fill(0);
  var b2 = new Array(numberOfChannels).fill(0);

  /**
   * @description Use a 1/f filter
   * @param previousSampleNumber {Number} - The previous sample number
   */
  return previousSampleNumber => {
      let sample = newSample();
      for(var i = 0; i < numberOfChannels; i++) { //channels are 0 indexed
          // This produces white noise
          let whiteNoise = distribution.ppf(Math.random()) * Math.sqrt(sampleRateHz/2)/uVolts;

          switch (i) {
              case 0: // Add 10Hz signal to channel 1... brainy
              case 1:
                  if (injectAlpha) {
                      sinePhaseRad[i] += 2 * Math.PI * sineWaveFreqHz10 / sampleRateHz;
                      if (sinePhaseRad[i] > 2 * Math.PI) {
                          sinePhaseRad[i] -= 2 * Math.PI;
                      }
                      whiteNoise += (5 * Math.SQRT2 * Math.sin(sinePhaseRad[i]))/uVolts;
                  }
                  break;
              default:
                sinePhaseRad[i] += 2 * Math.PI * sineWaveFreqHz60 / sampleRateHz;
                if (sinePhaseRad[i] > 2 * Math.PI) {
                    sinePhaseRad[i] -= 2 * Math.PI;
                }
                whiteNoise += (8 * Math.SQRT2 * Math.sin(sinePhaseRad[i])) / uVolts;
                break;
          }
          /**
           * See http://www.firstpr.com.au/dsp/pink-noise/ section "Filtering white noise to make it pink"
           */
          b0[i] = 0.99765 * b0[i] + whiteNoise * 0.0990460;
          b1[i] = 0.96300 * b1[i] + whiteNoise * 0.2965164;
          b2[i] = 0.57000 * b2[i] + whiteNoise * 1.0526913;
          sample.channelData[i] = b0[i] + b1[i] + b2[i] + whiteNoise * 0.1848;
      }
      if (previousSampleNumber == 255) {
          sample.sampleNumber = 0;
      } else {
          sample.sampleNumber = previousSampleNumber + 1;
      }

      return sample;
  };
}

function newSample(sampleNumber) {
    if (sampleNumber || sampleNumber === 0) {
        if (sampleNumber > 255) {
            sampleNumber = 255;
        }
    } else {
        sampleNumber = 0;
    }
    return {
        sampleNumber:sampleNumber,
        channelData: [],
    }
}

function error400() {
  var buf = new Buffer(`${TCP_CMD_ERROR},400,Error: No open BLE device${UDP_STOP}`);
  udpTx.send(buf,udpTxPort);
}
