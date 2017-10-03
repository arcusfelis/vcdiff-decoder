'use strict';

const errors = require('./errors');
const TypedArray = require('./typed_array_util');
const deserializeInteger = require('./deserialize/integer');
const deserializeDelta = require('./deserialize/delta');
const NearCache = require('./address_caches/near');
const SameCache = require('./address_caches/same');

/**
 *
 * @param delta {Uint8Array}
 * @param source {Uint8Array}
 * @constructor
 */
function VCDiff(delta, source) {
  this.delta = delta;
  this.position = 0;
  this.source = source;
  this.targetWindows = new TypedArray.TypedArrayList();
  this.etalon = null;
  this.etalonPosition = 0;
}

VCDiff.prototype.setEtalon = function(etalon) {
    // this one used for debugging
    // etalon is a real tartet
    console.log('setEtalon of length=' + etalon.length);
    this.etalon = etalon;
    this.etalonPosition = 0;
}

VCDiff.prototype.decode = function() {
  this._consumeHeader();
  while (this._consumeWindow()) {}

  let targetLength = this.targetWindows.typedArrays.reduce((sum, uint8Array) => uint8Array.length + sum, 0);
  let target = new Uint8Array(targetLength);
  let position = 0;

  // concat all uint8arrays
  for (let arrayNum = 0; arrayNum < this.targetWindows.typedArrays.length; arrayNum++) {
    let array = this.targetWindows.typedArrays[arrayNum];
    let length = array.length;
    target.set(array, position);
    position += length;
  }

  return target;
};

VCDiff.prototype._consumeHeader = function() {

  let hasVCDiffHeader = this.delta[0] === 214 && // V
      this.delta[1] === 195 && // C
      this.delta[2] === 196 && // D
      this.delta[3] === 0; // \0

  if (!hasVCDiffHeader) {
    throw new errors.InvalidDelta('first 3 bytes not VCD');
  }

  let hdrIndicator = this.delta[4];
  // extract least significant bit
  let vcdDecompress = 1 & hdrIndicator;
  // extract second least significant bit
  let vcdCodetable = 1 & (hdrIndicator >> 1);

  // verify not using Hdr_Indicator
  if (vcdDecompress || vcdCodetable) {
    throw new errors.NotImplemented(
      'non-zero Hdr_Indicator (VCD_DECOMPRESS or VCD_CODETABLE bit is set)'
    );
  }

  this.position += 5;
};

VCDiff.prototype._consumeWindow = function() {
  if (this.delta.length == this.position)
        return false;

  let winIndicator = this.delta[this.position++];

  // extract least significant bit
  let vcdSource = 1 & winIndicator;
  // extract second least significant bit
  let vcdTarget = 1 & (winIndicator >> 1);

  if ((!vcdSource) && (!vcdTarget)) {
      // the target window was compressed by itself
      // without comparing against another data segment, and these two
      // integers are not included.
    let sourceSegmentLength, sourceSegmentPosition, deltaLength;
    sourceSegmentLength = 0;
    sourceSegmentPosition = 0;

    ({ value: deltaLength, position: this.position } = deserializeInteger(this.delta, this.position));

    let sourceSegment = this.source.slice(sourceSegmentPosition, sourceSegmentPosition + sourceSegmentLength);
    this._buildTargetWindow(this.position, sourceSegment);
    this.position += deltaLength;
  }
  else if (vcdSource && vcdTarget) {
    throw new errors.InvalidDelta(
      'VCD_SOURCE and VCD_TARGET cannot both be set in Win_Indicator'
    )
  }
  else if (vcdSource) {
    let sourceSegmentLength, sourceSegmentPosition, deltaLength;
    ({ value: sourceSegmentLength, position: this.position } = deserializeInteger(this.delta, this.position));
    ({ value: sourceSegmentPosition, position: this.position } = deserializeInteger(this.delta, this.position));
    ({ value: deltaLength, position: this.position } = deserializeInteger(this.delta, this.position));

    let sourceSegment = this.source.slice(sourceSegmentPosition, sourceSegmentPosition + sourceSegmentLength);
    this._buildTargetWindow(this.position, sourceSegment);
    this.position += deltaLength;
  }
  else if (vcdTarget) {
    throw new errors.NotImplemented(
      'non-zero VCD_TARGET in Win_Indicator'
    )
  }
  return this.position < this.delta.length;
};

// first integer is target window length
VCDiff.prototype._buildTargetWindow = function(position, sourceSegment) {
  let window = deserializeDelta(this.delta, position);

  let T = new Uint8Array(window.targetWindowLength);
  /* VCDIFF copy window length: sourceSegment.length */
  /* VCDIFF target window length: window.targetWindowLength */
  console.log('sourceSegmentLength=' + sourceSegment.length +
              ' targetWindowLength=' + window.targetWindowLength +
              ' this.source.length=' + this.source.length);

  let U = new TypedArray.TypedArrayList();
  U.add(sourceSegment);
  U.add(T);

  let targetPosition = sourceSegment.length;
  let dataPosition = 0;

  let delta = new Delta(U, targetPosition, window.data, window.addresses);
  for (let instruction_number = 0; instruction_number < window.instructions.length; instruction_number++)
  {
      let instruction = window.instructions[instruction_number];
      let old_pos = delta.UTargetPosition;
      instruction.execute(delta);

      // verify etalon
      if (this.etalon)
      {
        console.log("move targetPosition " + old_pos + " => " + delta.UTargetPosition);
        for (let i = old_pos; i < delta.UTargetPosition; i++)
        {
            let offset = i - targetPosition;
            if (this.etalon[offset] != delta.U.get(i))
            {
                console.log('offset=' + offset + ' expected=' + this.etalon[offset] + ' decoded=' + delta.U.get(i));
                console.log('instruction_number=' + instruction_number);
                console.dir(instruction);
                throw new Error("etalon verification failed " + offset);
            }
        }
      }
  };

  let target = U.typedArrays[1];
  this.targetWindows.add(target);
};

function Delta(U, UTargetPosition, data, addresses) {
  this.U = U;
  this.UTargetPosition = UTargetPosition;
  this.data = data;
  this.dataPosition = 0;
  this.addresses = addresses;
  this.addressesPosition = 0;
  this.nearCache = new NearCache(4);
  this.sameCache = new SameCache(3);
}

Delta.prototype.getNextAddressInteger = function() {
  let value;
  // get next address and increase the address position for the next address
  ({value, position: this.addressesPosition } = deserializeInteger(this.addresses, this.addressesPosition));
  return value;
};

Delta.prototype.getNextAddressByte = function() {
  // get next address and increase the address position for the next address
  let value = this.addresses[this.addressesPosition++];
  return value;
};

module.exports = VCDiff;
