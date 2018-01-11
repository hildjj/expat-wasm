An XML parser based on [expat](https://github.com/libexpat/libexpat).

The approach taken here was to compile to WASM with
[emscripten](https://kripken.github.io/emscripten-site/index.html),
and ship the WASM binary in the NPM package.  This means you get a real,
battle-tested XML parser, with 0 runtime dependencies.

To install:

    npm install --save expat-wasm

To use:

    const {XmlParser} = require('expat-wasm')
    async function f () {
      let p = await XmlParser.create()
      p.on('startElement', (name, attributes) => ...)
    }
    f()

Requires nodejs 9 or higher (WASM!), and might work in a browser, perhaps.
