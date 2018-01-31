// make sure wasm file is loaded relative to the current directory
Module['locateFile'] = function (f) {
  if (!require) {
    return f;
  }
  var path = require('path');
  return path['join'](__dirname, f);
};
