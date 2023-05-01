# expat-wasm

An XML parser based on [expat](https://github.com/libexpat/libexpat).

The approach taken here was to compile to WASM with
[emscripten](https://emscripten.org/), and ship the WASM binary in the NPM
package.  This means you get a real, battle-tested XML parser, with 0 runtime
dependencies.

To install:

    npm install --save expat-wasm

To use:

```js
import {XmlParser} from 'expat-wasm'

parser = new XmlParser()
parser.on('startElement', (name, attributes) => ...)
parser.parse('<foo/>')
parser.destroy()
```

There are [docs](https://hildjj.github.io/expat-wasm/).

Requires nodejs 16 or higher, and works in a modern browser using WebPack.  See
the [webpack-demo](https://github.com/hildjj/expat-wasm/tree/master/webpack-demo)
directory for simple WebPack example.

[![Tests](https://github.com/hildjj/expat-wasm/actions/workflows/node.js.yml/badge.svg)](https://github.com/hildjj/expat-wasm/actions/workflows/node.js.yml)
[![codecov](https://codecov.io/gh/hildjj/expat-wasm/branch/master/graph/badge.svg?token=GQ5IHsZb8S)](https://codecov.io/gh/hildjj/expat-wasm)
