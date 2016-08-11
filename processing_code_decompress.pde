/*

    based on code for OpenBCI by Chip Audette, Conor Russomanno, Joel Murphy 2013 - 2015

    Compression algorithm made by Joel Murphy, Winter 2015-2016

*/
int localByteCounter = 0;
int localChannelCounter = 0;
int compressedSampleCounter = 0;
boolean isNewDataPacketAvailable = false;

  void interpretBinaryStream(byte inByte)  {
    switch (PACKET_readstate) {
      case 0:  //look for header byte
         if (inByte == byte(0xA0)) {
          PACKET_readstate++;               // go look for the sample counter
         }
         break;

      case 1:                               // get the sample counter
        sampleIndex = int(inByte);          // system assumes case 1 = sampleCounter
        if(sampleIndex == 0){               // this is a raw data packet!
          PACKET_readstate = 3;             // advance readState counter to interperet raw data next
        } else if((sampleIndex-prevSampleIndex) != 3) {    // compressed data ships every third sample
          println("OpenBCI_Ganglion: apparent sampleIndex jump from Serial data: " + prevSampleIndex
          + " to  " + sampleIndex + ".  Keeping packet");  // error report
        }

        prevSampleIndex = sampleIndex;      // keep track of the latest sample number we get
        localByteCounter=0;                 // prepare for next usage of localByteCounter
        localChannelCounter=0;              // prepare for next usage of localChannelCounter
        compressedSampleCounter = 0;        // prepare to count the samples
        PACKET_readstate++;                 // increment readState counter and get ready to read data packet
        break;

      case 2:                               // get compressed Ganglion channel values
        localCompressedByteBuffer[localByteCounter] = inByte;  // read the next byte into buffer
        localByteCounter++;                 // increment buffer
        if (localByteCounter==18) {          // when buffer is full
          localByteCounter = 0;             // reset byte counter
          // decompressDeltas(localCompressedByteBuffer);
          decompressLossyDeltas(localCompressedByteBuffer);
          decompressSamples();  // rubber, meet road

          PACKET_readstate++;  // go get the aux values available in the raw data packet

        }
        break;

      case 3:  // get AUX values expect 1 char in compressed packet
        auxByte = inByte;
        PACKET_readstate = 6;  // look for the end byte
        gotCompressedPackets = true;
        break;

      case 4:  // get raw Ganglion channel values
        localRawByteBuffer[localByteCounter] = inByte;  // gather 3 bytes/sample starting with [0]
        localByteCounter++;  // get ready for next byte in this sample
        if (localByteCounter==3) {      // when you get all the bytes for a channel
          receivedDataPacket[localChannelCounter] = interpret24bitAsInt32(localRawByteBuffer); // interpret data
          localChannelCounter++;  // prepare to get the next channel of 4
          if (localChannelCounter==4) {  // all 4 Ganglion channels arrived!
            seedDecompressor(receivedDataPacket);  // use this sample packet as the raw seed
            PACKET_readstate++;          // advance to get the aux values available in the raw data packet
            localByteCounter = 0;        // reset this counter
            localChannelCounter = 0;     // reset that counter
          } else {
            localByteCounter=0;          // prepare for next data channel
          }
        }
        break;

      case 5:  // get AUX values expect 5 chars in raw packet
        auxBytes[localByteCounter] = inByte;
        localByteCounter++;
        if (localByteCounter==7) {      // we got all the chars
          PACKET_readstate = 6;         // go look for the end byte next
          localByteCounter = 0;         // reset localByteCounter
        }
        break;

      case 6:
        //look for the end byte
        if (inByte == byte(0xC0)) {    // if correct end delimiter found:
          isNewDataPacketAvailable = true;
        } else {
          println("OpenBCI_Ganglion: interpretBinaryStream: Actbyte = " + inByte);
          println("OpenBCI_Ganglion: interpretBinaryStream: expecteding end-of-packet byte is missing, Discarding packet");
        }
        PACKET_readstate=0;  // either way, look for next packet start byte
        break;

      default:
        println("OpenBCI_Ganglion: interpretBinaryStream: default error: " + inByte + " .  Continuing...");
        PACKET_readstate=0;  // look for next packet start byte
        break;
    }  // end of switch(PACKET_readstate)


    if (isNewDataPacketAvailable) { // this happens inside interpretBinaryStream()
      println("packet Number " + int(sampleIndex));  // verbose
      writeDataToFile();  // put it in the file
      isNewDataPacketAvailable = false;  // more could be done here...
    }
  } // end of interpretBinaryStream


  void writeDataToFile(){  // log the data line
    if(gotCompressedPackets){               // if compressing
      dataLog.print(sampleIndex-2 + "\t");  // first sample is previous sample
      for(int i=0; i<4; i++){
       dataLog.print(decompressedSamples[1][i]);
       if(i<3) {dataLog.print("\t");}
      }
      dataLog.println();
      dataLog.print(sampleIndex-1 + "\t");  // first sample is previous sample
      for(int i=0; i<4; i++){
       dataLog.print(decompressedSamples[2][i]);
       if(i<3) {dataLog.print("\t");}
      }
      dataLog.println();
      dataLog.print(sampleIndex + "\t");    // second sample is this sample
      for(int i=0; i<4; i++){
       dataLog.print(decompressedSamples[3][i]);
       // rotate the latest data into zero position to decompress the next packet
       decompressedSamples[0][i] = decompressedSamples[3][i];  // seems to be the best place to rotate it...?
       dataLog.print("\t");
      }
      dataLog.print(char(auxByte));  // end of sample data line entry
      dataLog.println();  // end the line
      gotCompressedPackets = false;
      return;  // get outa here!
    }
    // when not compressed, do this:
    dataLog.print(sampleIndex + "\t");       // log sample number
    for(int i=0; i<4; i++){
      dataLog.print(receivedDataPacket[i]);  // log raw data
      dataLog.print("\t");
    }
    for (int i=0; i<7; i++){
      dataLog.print(char(auxBytes[i]));      // log aux bytes
      dataLog.print("\t");
    }
    dataLog.println();  // end the line
  }


  int interpret24bitAsInt32(byte[] byteArray) {
    //little endian
    int newInt = (
      ((0xFF & byteArray[0]) << 16) |
      ((0xFF & byteArray[1]) << 8) |
      (0xFF & byteArray[2])
      );
    if ((newInt & 0x00800000) > 0) {
      newInt |= 0xFF000000;
    } else {
      newInt &= 0x00FFFFFF;
    }
    return newInt;
  }


  int interpret16bitAsInt32(int delta) {
    if ((delta & 0x00008000) > 0) {
      delta |= 0xFFFF0000;
    } else {
      delta &= 0x0000FFFF;
    }
    return delta;
  }

  int interpret15bitAsInt32(int delta) {
    if ((delta & 0x00004000) > 0) {
      delta |= 0xFFFF8000;
    } else {
      delta &= 0x00007FFF;
    }
    return delta;
  }

// when we get raw data, use it to seed the uncompressed data array at 0
  void seedDecompressor(int[] seed){
    for(int i=0; i<4; i++){
      decompressedSamples[0][i] = seed[i];
    }
  }

// add the current receivedDeltas to the decompressedSamples
// needs to have the uncompressed seed placed in [0][x] of the 2D array to work
// 2D array shifted in the file write function (move this??)
  void decompressSamples(){
    // add the delta to the previous value
    for(int i=1; i<4; i++){
      for(int j=0; j<4; j++){
        decompressedSamples[i][j] = decompressedSamples[i-1][j] - receivedDeltas[i-1][j];
      }
    }
  }

//  16BIT VALUES TRUNKATED TO 12BIT -32768 to 32767
  void decompressLossyDeltas(byte[] buffer){
    int[][] D = new int [3][4];
    int bufferPos = 0;
    for(int i=0; i<3; i++){
      D[i][0] = ((buffer[bufferPos] & 0xFF) << 7); bufferPos++;  //0111111110000000
      D[i][0] |= ((buffer[bufferPos] & 0xF0) >> 1);             //0000000001111000
      D[i][1] = ((buffer[bufferPos] & 0x0F) << 11); bufferPos++; //12
      D[i][1] |= ((buffer[bufferPos] & 0xFF) << 3); bufferPos++; //4
      D[i][2] = ((buffer[bufferPos] & 0xFF) << 7); bufferPos++;  //8
      D[i][2] |= ((buffer[bufferPos] & 0xF0) >> 1);
      D[i][3] = ((buffer[bufferPos] & 0x0F) << 11); bufferPos++; //12
      D[i][3] |= ((buffer[bufferPos] & 0xFF) << 3); bufferPos++; //4

    }
    for(int i=0; i<3; i++){// convert 16bit short deltas to 32bit int deltas
      for(int j=0; j<4; j++){
      receivedDeltas[i][j] = interpret15bitAsInt32(D[i][j]);
      print(receivedDeltas[i][j] + "\t");  // verbose
      }
    }
  }

// //  12BIT VALUES RANGE -2048 to 2047
//   void decompressDeltas(byte buffer){
//     int bufferPos = 0;
//     for(int i=0; i<3; i++){
//       receivedDeltas[i][0] = ((buffer[bufferPos] << 8) & 0x0000FF00);
//       receivedDeltas[i][0] |= (buffer[(bufferPos++)] & 0x00000F0);
//       receivedDeltas[i][1] = ((buffer[bufferPos] << 12) & 0x0000F000);
//       receivedDeltas[i][1] |= ((buffer[(bufferPos++)] << 4) & 0x00000FF0);
//       receivedDeltas[i][2] = ((buffer[(bufferPos++)] << 8) & 0x0000FF00);
//       receivedDeltas[i][2] |= (buffer[(bufferPos++)] & 0x00000F0);
//       receivedDeltas[i][3] = ((buffer[bufferPos] << 12) & 0x0000F000);
//       receivedDeltas[i][3] |= ((buffer[(bufferPos++)] << 4) & 0x00000FF0);
//       bufferPos++
//     }
//     for(int i=0; i<3; i++){// convert 16bit short deltas to 32bit int deltas
//       for(int j=0; j<4; j++){
//       receivedDeltas[i][j] = interpret16bitAsInt32(receivedDeltas[i][j]);
//       //print("\t" + receivedDeltas[i][j]);  // verbose
//       }
//     }
//   }



  //
  // receivedDeltas[0][0] = ((buffer[0] << 8) & 0x0000FF00);
  // receivedDeltas[0][0] |= (buffer[1] & 0x00000F0);
  // receivedDeltas[0][1] = ((buffer[1] << 12) & 0x0000F000);
  // receivedDeltas[0][1] |= ((buffer[2] << 4) & 0x00000FF0);
  // receivedDeltas[0][2] = ((buffer[3] << 8) & 0x0000FF00);
  // receivedDeltas[0][2] |= (buffer[4] & 0x00000F0);
  // receivedDeltas[0][3] = ((buffer[4] << 12) & 0x0000F000);
  // receivedDeltas[0][3] |= ((buffer[5] << 4) & 0x00000FF0);


  void PROTO_interpretBinaryStream(byte inByte)  {
    switch (PACKET_readstate) {

      case 0:                               // get the sample counter
        sampleIndex = int(inByte);          // system assumes case 1 = sampleCounter
        if(sampleIndex == 0){               // this is a raw data packet!
          PACKET_readstate = 2;             // advance readState counter to interperet raw data next
        } else if((sampleIndex-prevSampleIndex) != 3) {    // compressed data ships every third sample
          println("OpenBCI_Ganglion: apparent sampleIndex jump from Serial data: " + prevSampleIndex
          + " to  " + sampleIndex + ".  Keeping packet");  // error report
        }

        prevSampleIndex = sampleIndex;      // keep track of the latest sample number we get
        localByteCounter=0;                 // prepare for next usage of localByteCounter
        localChannelCounter=0;              // prepare for next usage of localChannelCounter
        compressedSampleCounter = 0;        // prepare to count the samples
        PACKET_readstate++;                 // increment readState counter and get ready to read data packet
        break;

      case 1:                               // get compressed Ganglion channel values
      localCompressedByteBuffer[localByteCounter] = inByte;  // read the next byte into buffer
      localByteCounter++;                 // increment buffer
      if (localByteCounter==18) {          // when buffer is full
        localByteCounter = 0;             // reset byte counter
        // decompressDeltas(localCompressedByteBuffer);
        decompressLossyDeltas(localCompressedByteBuffer);
        decompressSamples();  // rubber, meet road

        PACKET_readstate++;  // go get the aux values available in the raw data packet

      }
      break;

      case 2:  // get AUX values expect 1 char in compressed packet
        auxByte = inByte;
        isNewDataPacketAvailable = true;
        PACKET_readstate = 0;  // look for the end byte
        gotCompressedPackets = true;
        break;

      case 3:  // get raw Ganglion channel values
        localRawByteBuffer[localByteCounter] = inByte;  // gather 3 bytes/sample starting with [0]
        localByteCounter++;  // get ready for next byte in this sample
        if (localByteCounter==3) {      // when you get all the bytes for a channel
          receivedDataPacket[localChannelCounter] = interpret24bitAsInt32(localRawByteBuffer); // interpret data
          localChannelCounter++;  // prepare to get the next channel of 4
          if (localChannelCounter==4) {  // all 4 Ganglion channels arrived!
            seedDecompressor(receivedDataPacket);  // use this sample packet as the raw seed
            PACKET_readstate++;          // advance to get the aux values available in the raw data packet
            localByteCounter = 0;        // reset this counter
            localChannelCounter = 0;     // reset that counter
          } else {
            localByteCounter=0;          // prepare for next data channel
          }
        }
        break;

      case 4:  // get AUX values expect 5 chars in raw packet
        auxBytes[localByteCounter] = inByte;
        localByteCounter++;
        if (localByteCounter==7) {      // we got all the chars
          isNewDataPacketAvailable = true;
          PACKET_readstate = 0;         // go look for the end byte next
          localByteCounter = 0;         // reset localByteCounter
        }
        break;

      default:
        println("OpenBCI_Ganglion: interpretBinaryStream: default error: " + inByte + " .  Continuing...");
        PACKET_readstate=0;  // look for next packet start byte
        break;
    }  // end of switch(PACKET_readstate)


    if (isNewDataPacketAvailable) { // this happens inside interpretBinaryStream()
      println("packet Number " + int(sampleIndex));  // verbose
      writeDataToFile();  // put it in the file
      isNewDataPacketAvailable = false;  // more could be done here...
    }
  }
