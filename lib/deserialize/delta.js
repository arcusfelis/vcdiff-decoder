'use strict';

const errors = require('../errors');
const deserializeInteger = require('./integer');
const tokenizeInstructions = require('../tokenize_instructions');

function delta(delta, position) {

  let targetWindowLength, dataLength, instructionsLength, addressesLength;

  // parentheses are needed for assignment destructuring
  ({ value: targetWindowLength, position } = deserializeInteger(delta, position));

  // Delta_Indicator byte
  if (delta[position] !== 0) {
    throw new errors.NotImplemented(
      'VCD_DECOMPRESS is not supported, Delta_Indicator must be zero at byte ' + position + ' and not ' + delta[position]
    );
  }
  position++;

  ({ value: dataLength, position } = deserializeInteger(delta, position));

  console.log("instructionsLengthPosition: " + position);

  ({ value: instructionsLength, position } = deserializeInteger(delta, position));
  ({ value: addressesLength, position } = deserializeInteger(delta, position));

  let dataNextPosition = position + dataLength;
  let data = delta.slice(position, dataNextPosition);

//console.log("data: " + data.toString('hex'));

//console.log("dataLength: " + dataLength);
//console.log("instructionsLength: " + instructionsLength);
  let instructionsNextPosition = dataNextPosition + instructionsLength;
  let instructions = delta.slice(dataNextPosition, instructionsNextPosition);
//console.log("instructions: " + instructions.toString('hex'));
  let deserializedInstructions = tokenizeInstructions(instructions);

//console.log("deserializedInstructions:");
//console.dir(deserializedInstructions);

  let addressesNextPosition = instructionsNextPosition + addressesLength;
  let addresses = delta.slice(instructionsNextPosition, addressesNextPosition);
//  console.log("addressesLength " + addressesLength);
//  console.log("addresses " + addresses.toString('hex'));

  position = addressesNextPosition;

  let window = {
    targetWindowLength,
    position,
    data,
    instructions: deserializedInstructions,
    addresses
  };

  return window;
}

module.exports = delta;

