const vcdiff = require('.');
var fs = require('fs');


function toHexString(byteArray) {
  return Array.from(byteArray, function(byte) {
    return ('0' + (byte & 0xFF).toString(16)).slice(-2);
  }).join(' ')
}

let print = 1;

let source = new fs.readFileSync('/tmp/test_source');
let target = new fs.readFileSync('/tmp/test_target');
let xdelta = new fs.readFileSync('/tmp/test_xdelta');

if (print)
{
    console.log('xdelta = ' + toHexString(xdelta));
    console.log('source = ' + toHexString(source));
    console.log('target = ' + toHexString(target));
}

let result = vcdiff.decodeSync(xdelta, source);
if (print)
    console.log('result = ' + toHexString(result));

fs.writeFileSync('/tmp/test_out', result);
