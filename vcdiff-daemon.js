const vcdiff = require('.');
var fs = require('fs');
var net = require('net');

// Start a TCP Server
net.createServer(function (socket) {

	let sourceSize;
	let deltaSize;
    let source;
    let delta;
    let has_header = false;
    let has_source = false;

	socket.on('readable', () => {
	  let chunk;

      if (!has_header)
      {
		  chunk = socket.read(8);
		  if (chunk)
		  {
			  sourceSize = chunk.readUInt32BE(0, 4);
			  deltaSize  = chunk.readUInt32BE(4, 4);
              has_header = true;
			  console.log("sourceSize=" + sourceSize + " deltaSize=" + deltaSize);

              if (sourceSize == 0)
              {
                  has_source = true;
                  source = new Buffer([]);
              }
		  }
      }

      if (!has_source)
      {
		  chunk = socket.read(sourceSize);
          if (chunk && chunk.length)
          {
              source = chunk;
              has_source = true;
          }
      }

      if (has_source)
          delta = socket.read(deltaSize);
      if (delta)
      {
		  console.log("source=" + source.length + " delta=" + delta.length);
          try
          {
              let result = vcdiff.decodeSync(delta, source);
              console.log("result=" + result.length);

              var buf = new Buffer(4);
              buf.writeUInt32BE(result.length, 0);
              socket.write(buf);
              socket.write(new Buffer(result));
          }
          catch (err)
          {
              console.log("err " + err);
              console.log(err.stack);
              var buf = new Buffer(4);
              socket.write(buf);
          }
      }
	})

}).listen(5000);


