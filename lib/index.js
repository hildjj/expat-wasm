
const { EventEmitter } = require('events')
const Pointers = require('./pointers')
const expatWasm = require('./expat')
const wasmBuf = require('./expat.wasm.js')
let expat = null
const expatInit = new Promise((resolve, reject) => {
  expatWasm({
    instantiateWasm (imports, cb) {
      WebAssembly.instantiate(wasmBuf.buffer, imports)
        .then(output => cb(output.instance))
      return {}
    }
  }).then(e => {
    expat = e
    resolve()
  }, reject)
})
const INTERNAL = Symbol('XmlParserInternal')

/**
 * Error parsing XML
 *
 * @class XmlParseError
 * @extends {Error}
 * @property {number} code - expat error code
 * @property {string} xmlMessage - error string
 * @property {number} line - input line that caused the error
 * @property {number} column - input column that cause the error
 */
class XmlParseError extends Error {
  constructor (parser) {
    super('XML Parse Error')
    this.code = XmlParser.XML_GetErrorCode(parser)
    this.xmlMessage = XmlParser.XML_ErrorString(this.code)
    this.line = XmlParser.XML_GetCurrentLineNumber(parser)
    this.column = XmlParser.XML_GetCurrentColumnNumber(parser)
  }
}

/**
 * An evented parser based on a WASM-compiled version of expat.
 * NOTE: Please make sure to call {@link XmlParser#destroy destroy()}
 * when you are done.
 *
 * @class XmlParser
 * @extends {EventEmitter}
 */
class XmlParser extends EventEmitter {
  /**
   * Factory for creating XmlParser instances.  This approach ensures that
   * the WASM code has been loaded, initialized, and bound correctly to
   * JS before you get an object.
   *
   * @static
   * @param {string} encoding - one of null, "US-ASCII", "UTF-8", "UTF-16"
   *   or "ISO-8859-1".  null, the default, will do content sniffing.
   * @param {string} [separator='|'] - the separator for namespace URI and
   *   element/attribute name.  Use XmlParser.NO_NAMESPACES to get Expat's
   *   old, broken namespace non-implementation via XmlParserCreate instead
   *   of XmlParserCreateNS.
   * @returns {XmlParser}
   *
   * @memberOf XmlParser
   */
  static async create (encoding, separator = '|') {
    await XmlParser._initialize(INTERNAL)
    return new XmlParser(INTERNAL, encoding, separator)
  }

  /**
   * The current version of expat
   *
   * @static
   * @returns {string} the current version
   *
   * @memberOf XmlParser
   */
  static async version () {
    await XmlParser._initialize(INTERNAL)
    return this.XML_ExpatVersion()
  }

  /**
   * Initialize the WASM binding.
   *
   * @private
   * @static
   * @param {any} _internalOnly - Prove you're calling this from create.
   * @returns {Promise}
   *
   * @memberOf XmlParser
  */
  static _initialize (_internalOnly) {
    if (_internalOnly !== INTERNAL) {
      throw new Error('don\'t call _intialize directly')
    }
    if (this._intialized != null) {
      return this._intialized
    }
    this._intialized = expatInit.then(() => {
      this.pointers = new Pointers()
      this.CB_TYPES = {}

      // Bind each of the basic expat APIs
      ;[
        ['XML_ExpatVersion', 'string', []],
        ['XML_FreeContentModel', 'void', ['number', 'number']],
        ['XML_ParserCreate', 'number', ['string']],
        ['XML_ParserCreateNS', 'number', ['string', 'number']],
        ['XML_ParserFree', 'void', ['number']],
        ['XML_Parse', 'void', ['number', 'array', 'number', 'number']],
        ['XML_SetParamEntityParsing', 'number', ['number', 'number']],
        ['XML_SetReturnNSTriplet', 'void', ['number', 'number']],
        ['XML_ParserReset', 'void', ['number', 'string']],
        ['XML_GetErrorCode', 'number', ['number']],
        ['XML_ErrorString', 'string', ['number']],
        ['XML_GetCurrentLineNumber', 'number', ['number']],
        ['XML_GetCurrentColumnNumber', 'number', ['number']],
        ['XML_SetUserData', 'void', ['number', 'number']]
      ].forEach(([name, ret, args]) => {
        this[name] = expat.cwrap(name, ret, args)
      })

      // Create callback functions that can be reused for each of the different
      // events.  We can't use a per-parser-instance closure (which would be
      // much more idiomatic JS) because emscripten requires us to declare the
      // max number of active callbacks as a small integer.

      // The approach is to arrange for expat to call these functions with an
      // integer as the first parameter; that integer looks up the correct
      // XmlParser instance inside of Pointers, and calls the correct function
      // with the event name as the first parameter.

      this.EVENTS = [
        /**
         * DTD Attribute list defined.
         *
         * @event XmlParser#attlistDecl
         * @param {string} elname - the element name
         * @param {string} attname - the attribute name
         * @param {string} attType - the attribute type
         * @param {string} dflt - the default value
         * @param {boolean} isrequired - is the attribute required
         */
        'AttlistDecl',
        /**
         * Plain text, or text that has been generated by an entity (e.g.)
         *
         * @event XmlParser#characterData
         * @param {string} text - the text that was found
         */
        'CharacterData',
        /**
         * Comment
         *
         * @event XmlParser#comment
         * @param {string} text - the comment text
         */
        'Comment',
        /**
         * DTD Element declaration
         *
         * @event XmlParser#elementDecl
         * @param {string} name - the name of the element
         * @param {Model} model - description of the element
         */
        'ElementDecl',
        /**
         * End of a CData section
         *
         * @event XmlParser#endCdataSection
         */
        'EndCdataSection',
        /**
         * End of a DTD
         *
         * @event XmlParser#endDoctypeDecl
         */
        'EndDoctypeDecl',
        /**
         * End of an Element.
         *
         * @event XmlParser#endElement
         * @param {string} name - the name of the element.  If the element is in
         *   a namespace, the name will be URI+separator+name.
         */
        'EndElement',
        /**
         * A namespace declaration went out of scope
         *
         * @event XmlParser#endNamespaceDecl
         * @param {string} prefix - the prefix that went out of scope
         */
        'EndNamespaceDecl',
        /**
         * Notation declaration.
         *
         * @event XmlParser#notationDecl
         * @param {string} notationName
         * @param {string} base
         * @param {string} systemId
         * @param {string} publicId
         */
        'NotationDecl',
        /**
         * Processing Instruction
         *
         * @event XmlParser#processingInstruction
         * @param {string} target
         * @param {string} data
         */
        'ProcessingInstruction',
        /**
         * CDATA Section.  Expect events for child text next.
         *
         * @event XmlParser#startCdataSection
         */
        'StartCdataSection',
        /**
         * Start of a DOCTYPE
         *
         * @event XmlParser#startDoctypeDecl
         * @param {string} doctypeName
         * @param {string} sysid
         * @param {string} pubid
         * @param {boolean} hasInternalSubset
         */
        'StartDoctypeDecl',
        /**
         * Start of an Element.
         *
         * @event XmlParser#startElement
         * @param {string} name - the name of the element.  If the element is in
         *   a namespace, the name will be URI+separator+name.
         * @param {object} attribs - attributes for this element as name/value
         *   pairs.  Names are similar to element name; URI+separator+name.
         */
        'StartElement',
        /**
         * Namespace declaration comes into scope.  Fires before startElement.
         *
         * @event XmlParser#startNamespaceDecl
         * @param {string} prefix
         * @param {string} uri
         */
        'StartNamespaceDecl',
        /**
         * Declaration of an entity.
         *
         * @event XmlParser#entityDecl
         * @param {string} entityName
         * @param {boolean} is_parameter_entity
         * @param {string|null} value
         * @param {string} base
         * @param {string} systemId
         * @param {string} publicId
         * @param {string} notationName
         */
        'EntityDecl',
        /**
         * XML Declaration.
         *
         * @event XmlParser#xmlDecl
         * @param {string} version
         * @param {string} encoding
         * @param {boolean} standalone
         */
        'XmlDecl'
      ].reduce((o, s) => {
        const lc = s[0].toLowerCase() + s.slice(1)
        o[lc] = expat.cwrap(
          `XML_Set${s}Handler`,
          'void',
          ['number', 'function'])
        switch (lc) {
          // These require special processing
          case 'startElement':
          case 'characterData':
          case 'xmlDecl':
          case 'startDoctypeDecl':
          case 'elementDecl':
          case 'attlistDecl':
          case 'entityDecl':
            this.CB_TYPES[lc] = expat.addFunction(
              this.pointers.bind('_' + lc, lc))
            break
          default:
            this.CB_TYPES[lc] = expat.addFunction(
              this.pointers.bind('_simpleEvent', lc))
        }
        return o
      }, {})

      return this
    })
    return this._intialized
  }

  constructor (_internalOnly, encoding, separator) {
    if (_internalOnly !== INTERNAL) {
      throw new Error('Please use "create()" factory')
    }
    super()
    this.separator = separator
    if (separator === XmlParser.NO_NAMESPACES) {
      this.parser = XmlParser.XML_ParserCreate(encoding)
    } else {
      this.parser = XmlParser.XML_ParserCreateNS(encoding, separator.charCodeAt(0))
      XmlParser.XML_SetReturnNSTriplet(this.parser, 1)
    }
    this.id = XmlParser.pointers.add(this)
    XmlParser.XML_SetUserData(this.parser, this.id)
    this.encoding = {
      'US-ASCII': 'ascii',
      'UTF-8': 'utf8',
      'UTF-16': 'utf16le',
      'ISO-8859-1': 'latin1'
    }[encoding] || 'utf8'
    for (const [k, v] of Object.entries(XmlParser.EVENTS)) {
      v(this.parser, XmlParser.CB_TYPES[k])
    }
  }

  /**
   * All events
   *
   * @event XmlParser#*
   * @param {string} eventName - Name of the event that fired
   * @param {...any} ...parameters - the parameters for the event
   */
  emit (event, ...args) {
    super.emit(event, ...args)
    super.emit('*', event, ...args)
  }

  _startElement (event, name, attr) {
    const attribs = {}
    for (let a = attr / 4; expat.HEAPU32[a]; a += 2) {
      attribs[expat.UTF8ToString(expat.HEAPU32[a])] =
        expat.UTF8ToString(expat.HEAPU32[a + 1])
    }
    this.emit(event, expat.UTF8ToString(name), attribs)
  }

  _characterData (event, txt, len) {
    this.emit(event, expat.UTF8ToString(txt, len))
  }

  _xmlDecl (event, version, encoding, standalone) {
    this.emit(event,
      expat.UTF8ToString(version),
      expat.UTF8ToString(encoding),
      !!standalone)
  }

  _startDoctypeDecl (event, doctypeName, sysid, pubid, internalSubset) {
    this.emit(event,
      expat.UTF8ToString(doctypeName),
      expat.UTF8ToString(sysid),
      expat.UTF8ToString(pubid),
      !!internalSubset)
  }

  __chase (model, m) {
    /**
     * @typedef {Object} Model
     * @property {string} name - Name of the model
     * @property {number} type - Empty=1, Any, Mixed, Name, Choice, Seq
     * @property {number} quant - None=0, Optional, Star, Plus
     * @property {Array<Model>} children
     */
    const a = model / 4
    const [type, quant, name, numchildren, children] = expat.HEAPU32.slice(a, a + 5)
    m.type = type
    m.quant = quant
    if (name) {
      m.name = expat.UTF8ToString(name)
    }
    m.children = []
    for (let c = 0; c < numchildren; c++) {
      const child = {}
      this.__chase(children + (20 * c), child)
      m.children.push(child)
    }
    return m
  }

  _elementDecl (event, name, model) {
    const m = this.__chase(model, {
      name: expat.UTF8ToString(name)
    })
    this.emit(event, expat.UTF8ToString(name), m)
    XmlParser.XML_FreeContentModel(this.parser, model)
  }

  _attlistDecl (event, elname, attname, attType, dflt, isrequired) {
    this.emit(
      event,
      expat.UTF8ToString(elname),
      expat.UTF8ToString(attname),
      expat.UTF8ToString(attType),
      expat.UTF8ToString(dflt),
      !!isrequired)
  }

  _entityDecl (event, entityName, isParameterEntity, value, valueLength, base, systemId, publicId, notationName) {
    this.emit(
      event,
      expat.UTF8ToString(entityName),
      !!isParameterEntity,
      value ? expat.UTF8ToString(value, valueLength) : null,
      expat.UTF8ToString(base),
      expat.UTF8ToString(systemId),
      expat.UTF8ToString(publicId),
      expat.UTF8ToString(notationName))
  }

  _simpleEvent (event, ...args) {
    this.emit(event, ...args.map(s => expat.UTF8ToString(s)))
    return 1
  }

  /**
   * Parse a chunk of text.  If this is not the last (or only) chunk,
   * set `final` to 0.
   *
   * @param {string|Buffer|Uint8Array|Uint8ClampedArray} chunk - Input text
   * @param {number} [final=1] - 0 if not the last or only chunk.
   *
   * @memberOf XmlParser
   * @throws {XmlParseError}
   * @fires XmlParser#attlistDecl
   * @fires XmlParser#characterData
   * @fires XmlParser#comment
   * @fires XmlParser#elementDecl
   * @fires XmlParser#endCdataSection
   * @fires XmlParser#endDoctypeDecl
   * @fires XmlParser#endElement
   * @fires XmlParser#endNamespaceDecl
   * @fires XmlParser#notationDecl
   * @fires XmlParser#processingInstruction
   * @fires XmlParser#startCdataSection
   * @fires XmlParser#startDoctypeDecl
   * @fires XmlParser#startElement
   * @fires XmlParser#startNamespaceDecl
   * @fires XmlParser#entityDecl
   * @fires XmlParser#xmlDecl
   */
  parse (chunk, final = 1) {
    if (typeof chunk === 'string') {
      chunk = Buffer.from(chunk, this.encoding)
    }

    const len = chunk.length
    if (Buffer.isBuffer(chunk)) {
      chunk = new Uint8Array(chunk, 0, len)
    } else if (!(chunk instanceof Uint8Array || chunk instanceof Uint8ClampedArray)) {
      throw new Error('Expected chunk to be a string, Buffer, Uint8Array, or Uint8ClampedArray')
    }

    const res = XmlParser.XML_Parse(this.parser, chunk, len, final)
    if (res === 0) {
      throw new XmlParseError(this.parser)
    } else if ((res === 1) && (final === 1)) {
      // TODO: this doesn't work yet
      XmlParser.XML_ParserReset(this.parser, this.encoding)
    }
    return res
  }

  /**
   * @typedef {Object} Pieces
   * @property {string} ns - the namespace URI
   * @property {string} local - the local name,
   *   or the EVENTS name if no namespace
   * @property {string} prefix - the prefix used for the current name
   */

  /**
   * Parse an element or attribute name.
   *
   * @param {string} name - a EVENTS name, or a URI+local+prefix triple
   * @returns {Pieces} pieces - the pieces of the name
   *
   * @memberOf XmlParser
   */
  triple (name) {
    const [ns, local, prefix] = name.split(this.separator)
    if (!local) {
      return {
        local: ns
      }
    }
    if (!prefix) {
      return { ns, local }
    }
    return { ns, local, prefix }
  }

  /**
   * Clean up after the parser.  REQUIRED, since there is not currently
   * memory management for WASM code.
   *
   * @memberOf XmlParser
   */
  destroy () {
    XmlParser.XML_ParserFree(this.parser)
    delete this.parser
    XmlParser.pointers.remove(this.id)
    delete this.id
  }
}
/**
 * Use as the separator to treat namespaces in legacy mode.
 */
XmlParser.NO_NAMESPACES = Symbol('NO_NAMESPACES')
module.exports = XmlParser
