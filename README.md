An XML parser based on [expat](https://github.com/libexpat/libexpat).

The approach taken here was to compile to WASM with
[emscripten](https://kripken.github.io/emscripten-site/index.html),
and ship the WASM binary in the NPM package.  This means you get a real,
battle-tested XML parser, with 0 runtime dependencies.

To install:

    npm install --save expat-wasm

To use:

    const XmlParser = require('expat-wasm')
    async function f () {
      let p = await XmlParser.create()
      p.on('startElement', (name, attributes) => ...)
      p.parse('<foo/>')
    }
    f()

There are [docs](https://hildjj.github.io/expat-wasm/).

Requires nodejs 16 or higher, and works in a browser using WebPack.  See
the [webpack-demo](https://github.com/hildjj/expat-wasm/tree/master/webpack-demo)
directory for an example.

[![Tests](https://github.com/hildjj/expat-wasm/actions/workflows/node.js.yml/badge.svg)](https://github.com/hildjj/expat-wasm/actions/workflows/node.js.yml)
[![codecov](https://codecov.io/gh/hildjj/expat-wasm/branch/master/graph/badge.svg?token=GQ5IHsZb8S)](https://codecov.io/gh/hildjj/expat-wasm)
