'use strict';
const errors = require('./errors');
const VCDiff = require('./vcdiff');

/**
 *
 * @param delta {Uint8Array}
 * @param source {Uint8Array}
 */
function decodeSync(delta, source, etalon) {
  let vcdiff = new VCDiff(delta, source);
  if (etalon)
      vcdiff.setEtalon(etalon);
  return vcdiff.decode();
}

function decode(delta, buffer) {

}

module.exports = {
  decodeSync,
  decode
};


