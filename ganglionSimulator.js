const dgram = require('dgram');
const gaussian = require('gaussian');

const udpRx = dgram.createSocket('udp4');
const udpTx = dgram.createSocket('udp4');

const ganglionSampleRate = 256;
const udpRxPort = 10996;
const udpTxPort = 10997;

const GANGLION_CMD_STREAM_START = "b";
const GANGLION_CMD_STREAM_STOP = "s";
const UDP_CMD_CONNECT = "c";
const UDP_CMD_COMMAND = "k";
const UDP_CMD_DISCONNECT  = "d";
const UDP_CMD_ERROR = "e";
const UDP_CMD_SCAN = "s";
const UDP_CMD_STATUS = "q";
const UDP_DATA = "t";
const UDP_STOP = ",;\n";

let udpRxOpen = false;
let connected = false;
let stream;
let streaming = false;

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
  let msgElements = msg.toString().split(',');
  // var char = String.fromCharCode(msg[0]);
  // console.log('msgElements[0]',msgElements[0],char);
  switch (msgElements[0]) {
    case UDP_CMD_CONNECT:
      var buf = new Buffer(`${UDP_CMD_CONNECT},200${UDP_STOP}`);
      udpTx.send(buf,udpTxPort);
      connected = true;
      break;
    case UDP_CMD_COMMAND:
      if (connected) {
        parseCommand(msgElements[1]);
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
      var buf = new Buffer(`${UDP_CMD_SCAN},200,ganglion-1234,bose-qc-headphones${UDP_STOP}`);
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

var parseCommand = cmd => {
  console.log(cmd);
  switch (cmd) {
    case GANGLION_CMD_STREAM_START:
      console.log('start stream');
      if (!stream) startStream(); // Starts the stream
      streaming = true;
      break;
    case GANGLION_CMD_STREAM_STOP:
      console.log('stop stream');
      if (stream) clearInterval(stream); // Stops the stream
      streaming = false;
      break;
    default:
      // Send message to tell driver command not recognized
      udpTx.send(new Buffer(`${UDP_CMD_COMMAND},406${UDP_STOP}`), udpTxPort);
      break;
  }
}

var startStream = () => {
    const intervalInMS = 1000 / ganglionSampleRate;
    const bufPre = new Buffer(`${UDP_DATA},200,`);
    const bufPost = new Buffer(`${UDP_STOP}`);
    let sampleNumber = 0;
    let sampleGenerator = randomSample(4, 256, true, true);

    var getSample = sampleNumber => {
      let arr =  getArrayFromSample(sampleGenerator(sampleNumber));
      return new Buffer(`${sampleNumber},${arr[0].toString()},${arr[1].toString()},${arr[2].toString()},${arr[3].toString()}`);
    };

    stream = setInterval(() => {
        let bufSamp = getSample(sampleNumber);
        let totalLength = bufPre.length + bufSamp.length + bufPost.length;
        // Send the packet
        udpTx.send(Buffer.concat([bufPre,bufSamp,bufPost],totalLength), udpTxPort);
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

    // channel data
    for (var i = 0; i < 4; i++) {
        let whiteNoise = Math.abs(distribution.ppf(Math.random()) * Math.sqrt(256/2) * 1000);

        array.push(Math.floor(whiteNoise));
    }

    return array;
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
  var buf = new Buffer(`${UDP_CMD_ERROR},400,Error: No open BLE device${UDP_STOP}`);
  udpTx.send(buf,udpTxPort);
}
