import { EventEmitter } from 'events'
import { Pointers } from './pointers.js'
import expatWasm from './expat.js'

const expat = await expatWasm()

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
export class XmlParseError extends Error {
  /**
   * Create an error from the current parser state.
   *
   * @param {number} parser
   */
  constructor (parser) {
    const code = XmlParser.XML_GetErrorCode(parser)
    const msg = XmlParser.XML_ErrorString(code)
    super('XML Parse Error: ' + msg)
    this.code = code
    this.xmlMessage = msg
    this.line = XmlParser.XML_GetCurrentLineNumber(parser)
    this.column = XmlParser.XML_GetCurrentColumnNumber(parser)
    this.byteOffset = XmlParser.XML_GetCurrentByteIndex(parser)
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
export class XmlParser extends EventEmitter {
  /**
   * Global pointer namespace.
   */
  static #pointers = new Pointers()
  /**
   * @type {Record<string,function>}
   */
  static #CB_TYPES = {}
  /**
   * @type {Record<string,function>}
   */
  static #EVENTS = {}

  static {
    // Create callback functions that can be reused for each of the different
    // events.  We can't use a per-parser-instance closure (which would be
    // much more idiomatic JS) because emscripten requires us to declare the
    // max number of active callbacks as a small integer.

    // The approach is to arrange for expat to call these functions with an
    // integer as the first parameter; that integer looks up the correct
    // XmlParser instance inside of Pointers, and calls the correct function
    // with the event name as the first parameter.

    this.#EVENTS = /** @type {[string, number, boolean][]} */ ([
      ['AttlistDecl', 5, false],
      ['CharacterData', 2, false],
      ['Comment', 1, true],
      ['ElementDecl', 2, false],
      ['EndCdataSection', 0, true],
      ['EndDoctypeDecl', 0, true],
      ['EndElement', 1, true],
      ['EndNamespaceDecl', 1, true],
      ['EntityDecl', 8, false],
      ['NotationDecl', 4, true],
      ['ProcessingInstruction', 2, true],
      ['StartCdataSection', 0, true],
      ['StartDoctypeDecl', 4, false],
      ['StartElement', 2, false],
      ['StartNamespaceDecl', 2, true],
      ['XmlDecl', 3, false]
    ]).reduce((events, [s, num, simple]) => {
      const lc = s[0].toLowerCase() + s.slice(1)
      events[lc] = expat.cwrap(
        `XML_Set${s}Handler`,
        'void',
        ['number', 'function']
      )
      this.#CB_TYPES[lc] = expat.addFunction(
        this.#pointers.bind(simple ? '_simpleEvent' : `_${lc}`, lc),
        'v'.padEnd(num + 2, 'i')
      )
      return events
    }, /** @type {Record<string,function>} */({}))
  }

  /**
   * Use as the separator to treat namespaces in legacy mode.
   */
  static NO_NAMESPACES = Symbol('NO_NAMESPACES')

  /**
   * @returns {string} Current expat version number.
   */
  static XML_ExpatVersion () {
    return expat.ccall('XML_ExpatVersion', 'string')
  }

  /**
   * Function to deallocate the model argument passed to the
   * XML_ElementDeclHandler callback set using XML_ElementDeclHandler.
   *
   * @param {number} parser
   * @param {number} model
   */
  static XML_FreeContentModel (parser, model) {
    expat.ccall(
      'XML_FreeContentModel', 'void',
      ['number', 'number'],
      [parser, model]
    )
  }

  /**
   * Encodings that expat supports.
   *
   * @typedef {undefined|null|"US-ASCII"|"UTF-8"| "UTF-16"| "ISO-8859-1"} XML_Encoding
   */

  /**
   * Construct a new parser. If encoding is non-null, it specifies a character
   * encoding to use for the document. This overrides the document encoding
   * declaration. There are four built-in encodings:
   * - US-ASCII
   * - UTF-8
   * - UTF-16
   * - ISO-8859-1
   * Any other value will invoke a call to the UnknownEncodingHandler.
   *
   * @param {XML_Encoding} [encoding]
   * @returns {number} Parser pointer
   */
  static XML_ParserCreate (encoding) {
    return expat.ccall('XML_ParserCreate', 'number', ['string'], [encoding])
  }

  /**
   * Constructs a new parser that has namespace processing in effect.
   * Namespace expanded element names and attribute names are returned as a
   * concatenation of the namespace URI, sep, and the local part of the name.
   * This means that you should pick a character for sep that can't be part of
   * an URI. Since Expat does not check namespace URIs for conformance, the
   * only safe choice for a namespace separator is a character that is illegal
   * in XML. For instance, '\xFF' is not legal in UTF-8, and '\xFFFF' is not
   * legal in UTF-16. There is a special case when sep is the null character
   * '\0': the namespace URI and the local part will be concatenated without
   * any separator - this is intended to support RDF processors. It is a
   * programming error to use the null separator with namespace triplets.
   *
   * Note: Expat does not validate namespace URIs (beyond encoding) against
   * RFC 3986 today (and is not required to do so with regard to the XML 1.0
   * namespaces specification) but it may start doing that in future releases.
   * Before that, an application using Expat must be ready to receive
   * namespace URIs containing non-URI characters.
   *
   * @param {XML_Encoding} encoding
   * @param {number} sep The ASCII number value of the separator character
   * @returns {number} The created parser
   */
  static XML_ParserCreateNS (encoding, sep) {
    return expat.ccall(
      'XML_ParserCreateNS', 'number',
      ['string', 'number'],
      [encoding, sep]
    )
  }

  /**
   * Free memory used by the parser. Your application is responsible for
   * freeing any memory associated with user data.
   *
   * @param {number} parser
   */
  static XML_ParserFree (parser) {
    expat.ccall('XML_ParserFree', 'void', ['number'], [parser])
  }

  /**
   * Parse some more of the document. The string s is a buffer containing part
   * (or perhaps all) of the document. The number of bytes of s that are part
   * of the document is indicated by len. This means that s doesn't have to be
   * null terminated. It also means that if len is larger than the number of
   * bytes in the block of memory that s points at, then a memory fault is
   * likely. The isFinal parameter informs the parser that this is the last
   * piece of the document. Frequently, the last piece is empty (i.e. len is
   * zero.) If a parse error occurred, it returns XML_STATUS_ERROR. Otherwise
   * it returns XML_STATUS_OK value.
   *
   * @param {number} parser
   * @param {Uint8Array|Uint8ClampedArray} str
   * @param {number} len
   * @param {number} isFinal
   * @returns {number} ERROR=0, OK=1, SUSPENDED=2
   */
  static XML_Parse (parser, str, len, isFinal) {
    return expat.ccall(
      'XML_Parse', 'void',
      ['number', 'array', 'number', 'number'],
      [parser, str, len, isFinal]
    )
  }

  /**
   * This function only has an effect when using a parser created with
   * XML_ParserCreateNS, i.e. when namespace processing is in effect. The
   * doNst flag sets whether or not prefixes are returned with names qualified
   * with a namespace prefix. If this function is called with doNst non-zero,
   * then afterwards namespace qualified names (that is qualified with a
   * prefix as opposed to belonging to a default namespace) are returned as a
   * triplet with the three parts separated by the namespace separator
   * specified when the parser was created. The order of returned parts is
   * URI, local name, and prefix.
   *
   * If doNst is zero, then namespaces are reported in the default manner,
   * URI then local_name separated by the namespace separator.
   *
   * @param {number} parser
   * @param {number} doNst
   */
  static XML_SetReturnNSTriplet (parser, doNst) {
    expat.ccall(
      'XML_SetReturnNSTriplet', 'void',
      ['number', 'number'],
      [parser, doNst]
    )
  }

  /**
   * Prepare a parser object to be re-used.  This is particularly valuable
   * when memory allocation overhead is disproportionately high, such as when
   * a large number of small documnents need to be parsed. All handlers are
   * cleared from the parser, except for the unknownEncodingHandler. The
   * parser's external state is re-initialized except for the values of ns and
   * ns_triplets.
   *
   * @param {number} parser
   * @param {XML_Encoding} encoding
   * @returns {number} Undocumented
   */
  static XML_ParserReset (parser, encoding) {
    return expat.ccall(
      'XML_ParserReset', 'number',
      ['number', 'string'],
      [parser, encoding]
    )
  }

  /**
   * If XML_Parse or XML_ParseBuffer have returned XML_STATUS_ERROR, then
   * XML_GetErrorCode returns information about the error.
   *
   * @param {number} parser
   * @returns {number} Error code
   */
  static XML_GetErrorCode (parser) {
    return expat.ccall('XML_GetErrorCode', 'number', ['number'], [parser])
  }

  /**
   * Returns a string describing the error.
   *
   * @param {number} code
   * @returns {string} Error description in English.
   */
  static XML_ErrorString (code) {
    return expat.ccall('XML_ErrorString', 'string', ['number'], [code])
  }

  /**
   * These functions return information about the current parse location.
   * They may be called from any callback called to report some parse event;
   * in this case the location is the location of the first of the sequence of
   * characters that generated the event.  When called from callbacks
   * generated by declarations in the document prologue, the location
   * identified isn't as neatly defined, but will be within the relevant
   * markup.  When called outside of the callback functions, the position
   * indicated will be just past the last parse event (regardless of whether
   * there was an associated callback).
   *
   * They may also be called after returning from a call to XML_Parse or
   * XML_ParseBuffer.  If the return value is XML_STATUS_ERROR then the
   * location is the location of the character at which the error was
   * detected; otherwise the location is the location of the last parse event,
   * as described above.
   *
   * @param {number} parser
   * @returns {number} 0 on error, or line number.
   */
  static XML_GetCurrentLineNumber (parser) {
    return expat.ccall('XML_GetCurrentLineNumber', 'number', ['number'], [parser])
  }

  /**
   * These functions return information about the current parse location.
   * They may be called from any callback called to report some parse event;
   * in this case the location is the location of the first of the sequence of
   * characters that generated the event.  When called from callbacks
   * generated by declarations in the document prologue, the location
   * identified isn't as neatly defined, but will be within the relevant
   * markup.  When called outside of the callback functions, the position
   * indicated will be just past the last parse event (regardless of whether
   * there was an associated callback).
   *
   * They may also be called after returning from a call to XML_Parse or
   * XML_ParseBuffer.  If the return value is XML_STATUS_ERROR then the
   * location is the location of the character at which the error was
   * detected; otherwise the location is the location of the last parse event,
   * as described above.
   *
   * @param {number} parser
   * @returns {number} 0 on error, or column number.
   */
  static XML_GetCurrentColumnNumber (parser) {
    return expat.ccall('XML_GetCurrentColumnNumber', 'number', ['number'], [parser])
  }

  /**
   * These functions return information about the current parse location.
   * They may be called from any callback called to report some parse event;
   * in this case the location is the location of the first of the sequence of
   * characters that generated the event.  When called from callbacks
   * generated by declarations in the document prologue, the location
   * identified isn't as neatly defined, but will be within the relevant
   * markup.  When called outside of the callback functions, the position
   * indicated will be just past the last parse event (regardless of whether
   * there was an associated callback).
   *
   * They may also be called after returning from a call to XML_Parse or
   * XML_ParseBuffer.  If the return value is XML_STATUS_ERROR then the
   * location is the location of the character at which the error was
   * detected; otherwise the location is the location of the last parse event,
   * as described above.
   *
   * @param {number} parser
   * @returns {number} -1 on error, or byte offset.
   */
  static XML_GetCurrentByteIndex (parser) {
    return expat.ccall('XML_GetCurrentByteIndex', 'number', ['number'], [parser])
  }

  /**
   * This value is passed as the userData argument to callbacks.
   *
   * @param {number} parser
   * @param {number} userData
   */
  static XML_SetUserData (parser, userData) {
    expat.ccall(
      'XML_SetUserData', 'void',
      ['number', 'number'],
      [parser, userData]
    )
  }

  /**
   * Create a parser instance.
   *
   * @param {XML_Encoding} [encoding] null will do content sniffing.
   * @param {string|XmlParser.NO_NAMESPACES} [separator='|'] the separator
   *   for namespace URI and element/attribute name.  Use
   *   XmlParser.NO_NAMESPACES to get Expat's old, broken namespace
   *   non-implementation via XmlParserCreate instead of XmlParserCreateNS.
   */
  constructor (encoding, separator = '|') {
    super()

    /**
     * @type {string|XmlParser.NO_NAMESPACES}
     * @private
     */
    this.separator = separator

    /**
     * @type {number|undefined}
     * @private
     */
    this.parser = (() => {
      if (typeof separator === 'symbol') {
        if (separator === XmlParser.NO_NAMESPACES) {
          return XmlParser.XML_ParserCreate(encoding)
        }
      } else {
        const p = XmlParser.XML_ParserCreateNS(encoding, separator.charCodeAt(0))
        XmlParser.XML_SetReturnNSTriplet(p, 1)
        return p
      }
    })()

    // Assert, so that TS is happy
    /* c8 ignore start */
    if (!this.parser) {
      throw new Error('Unknown separator symbol')
    }
    /* c8 ignore stop */

    /**
     * @type {number|undefined}
     * @private
     */
    this.id = XmlParser.#pointers.add(this)
    XmlParser.XML_SetUserData(this.parser, this.id)

    /**
     * @type {XML_Encoding}
     * @private
     */
    this.xmlEncoding = encoding

    /**
     * @type {BufferEncoding}
     * @private
     */
    this.encoding = !encoding
      ? 'utf8'
      : /** @type {Record<string,BufferEncoding>} */ ({
          'US-ASCII': 'ascii',
          'UTF-8': 'utf8',
          'UTF-16': 'utf16le',
          'ISO-8859-1': 'latin1'
        })[encoding] || 'utf8'
    this._registerHandlers()
  }

  _registerHandlers () {
    for (const [k, setEventHandler] of Object.entries(XmlParser.#EVENTS)) {
      setEventHandler(this.parser, XmlParser.#CB_TYPES[k])
    }
  }

  /**
   * @event "*"
   * @param {string} eventName Name of the event
   * @param {...any} args All other event arguments
   */

  /**
   * Emit an event, and copy it onto the '*' event.
   *
   * @param {string|symbol} eventName Name of the event that fired
   * @param {...any} args The parameters for the event
   * @returns {boolean} True if there were listeners
   */
  emit (eventName, ...args) {
    const r = super.emit(eventName, ...args)
    super.emit('*', eventName, ...args)
    return r
  }

  /**
   * Start of an Element.
   *
   * @event XmlParser#startElement
   * @param {string} name - the name of the element.  If the element is in
   *   a namespace, the name will be URI+separator+name.
   * @param {object} attribs - attributes for this element as name/value
   *   pairs.  Names are similar to element name; URI+separator+name.
   */

  /**
   * @param {string} event
   * @param {number} name
   * @param {number} attr
   * @returns {boolean}
   * @private
   */
  _startElement (event, name, attr) {
    /** @type {Record<string,string>} */
    const attribs = {}
    // Name/value pairs, starting at attr, until we get to a null.
    for (let a = attr / 4; expat.HEAPU32[a]; a += 2) {
      attribs[expat.UTF8ToString(expat.HEAPU32[a])] =
        expat.UTF8ToString(expat.HEAPU32[a + 1])
    }
    return this.emit(event, expat.UTF8ToString(name), attribs)
  }

  /**
   * @param {string} event
   * @param {number} txt
   * @param {number} len
   * @returns {boolean}
   * @private
   */
  _characterData (event, txt, len) {
    return this.emit(event, expat.UTF8ToString(txt, len))
  }

  /**
   * XML Declaration.
   *
   * @event XmlParser#xmlDecl
   * @param {string} version
   * @param {string} encoding
   * @param {boolean} standalone
   */

  /**
   *
   * @param {string} event
   * @param {number} version
   * @param {number} encoding
   * @param {number} standalone
   * @returns {boolean}
   * @private
   */
  _xmlDecl (event, version, encoding, standalone) {
    return this.emit(event,
      expat.UTF8ToString(version),
      expat.UTF8ToString(encoding),
      !!standalone)
  }

  /**
   * Start of a DOCTYPE
   *
   * @event XmlParser#startDoctypeDecl
   * @param {string} doctypeName
   * @param {string} sysid
   * @param {string} pubid
   * @param {boolean} hasInternalSubset
   */

  /**
   * @param {string} event
   * @param {number} doctypeName
   * @param {number} sysid
   * @param {number} pubid
   * @param {number} hasInternalSubset
   * @returns {boolean}
   * @private
   */
  _startDoctypeDecl (event, doctypeName, sysid, pubid, hasInternalSubset) {
    return this.emit(event,
      expat.UTF8ToString(doctypeName),
      expat.UTF8ToString(sysid),
      expat.UTF8ToString(pubid),
      !!hasInternalSubset)
  }

  /**
   * @typedef {Object} Model
   * @property {string} [name] - Name of the model
   * @property {number} [type] - Empty=1, Any, Mixed, Name, Choice, Seq
   * @property {number} [quant] - None=0, Optional, Star, Plus
   * @property {Model[]} [children]
   */

  /**
   * Fill in a Model and its children, starting from a memory offset.
   *
   * @param {number} offset
   * @param {Model} model
   * @private
   */
  _unpackModel (offset, model = {}) {
    const a = offset / 4 // Offset in U32's
    const [type, quant, name, numchildren, children] = expat.HEAPU32.slice(a, a + 5)
    model.type = type
    model.quant = quant
    if (name) {
      model.name = expat.UTF8ToString(name)
    }
    model.children = []
    for (let c = 0; c < numchildren; c++) {
      // 5 U32's per entry.
      model.children.push(this._unpackModel(children + (20 * c)))
    }
    return model
  }

  /**
   * DTD Element declaration
   *
   * @event XmlParser#elementDecl
   * @param {string} name The name of the element
   * @param {Model} model Description of the element
   */

  /**
   * @param {string} event
   * @param {number} nm
   * @param {number} model
   * @returns {boolean}
   * @private
   */
  _elementDecl (event, nm, model) {
    try {
      const name = expat.UTF8ToString(nm)
      const m = this._unpackModel(model, { name })
      return this.emit(event, name, m)
    } finally {
      if (this.parser) {
        XmlParser.XML_FreeContentModel(this.parser, model)
      }
    }
  }

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

  /**
   * @param {string} event
   * @param {number} elname
   * @param {number} attname
   * @param {number} attType
   * @param {number} dflt
   * @param {number} isrequired
   * @returns {boolean}
   * @private
   */
  _attlistDecl (event, elname, attname, attType, dflt, isrequired) {
    return this.emit(
      event,
      expat.UTF8ToString(elname),
      expat.UTF8ToString(attname),
      expat.UTF8ToString(attType),
      expat.UTF8ToString(dflt),
      !!isrequired)
  }

  /**
   * Declaration of an entity.
   *
   * @event XmlParser#entityDecl
   * @param {string} entityName
   * @param {boolean} isParameterEntity
   * @param {string|null} value (+1 parameter for length)
   * @param {string} base
   * @param {string} systemId
   * @param {string} publicId
   * @param {string} notationName
   */

  /**
   * @param {string} event
   * @param {number} entityName
   * @param {number} isParameterEntity
   * @param {number} value
   * @param {number} valueLength
   * @param {number} base
   * @param {number} systemId
   * @param {number} publicId
   * @param {number} notationName
   * @private
   */
  _entityDecl (
    event,
    entityName,
    isParameterEntity,
    value,
    valueLength,
    base,
    systemId,
    publicId,
    notationName
  ) {
    return this.emit(
      event,
      expat.UTF8ToString(entityName),
      !!isParameterEntity,
      value ? expat.UTF8ToString(value, valueLength) : null,
      expat.UTF8ToString(base),
      expat.UTF8ToString(systemId),
      expat.UTF8ToString(publicId),
      expat.UTF8ToString(notationName))
  }

  /**
   * Plain text, or text that has been generated by an entity (e.g.)
   *
   * @event XmlParser#characterData
   * @param {string} text - the text that was found (+1 parameter for length)
   */

  /**
   * Comment
   *
   * @event XmlParser#comment
   * @param {string} text - the comment text
   */

  /**
   * End of a CData section
   *
   * @event XmlParser#endCdataSection
   */

  /**
   * End of a DTD
   *
   * @event XmlParser#endDoctypeDecl
   */

  /**
   * End of an Element.
   *
   * @event XmlParser#endElement
   * @param {string} name - the name of the element.  If the element is in
   *   a namespace, the name will be URI+separator+name.
   */

  /**
   * A namespace declaration went out of scope
   *
   * @event XmlParser#endNamespaceDecl
   * @param {string} prefix - the prefix that went out of scope
   */

  /**
   * Notation declaration.
   *
   * @event XmlParser#notationDecl
   * @param {string} notationName
   * @param {string} base
   * @param {string} systemId
   * @param {string} publicId
   */

  /**
   * Processing Instruction
   *
   * @event XmlParser#processingInstruction
   * @param {string} target
   * @param {string} data
   */

  /**
   * CDATA Section.  Expect events for child text next.
   *
   * @event XmlParser#startCdataSection
   */

  /**
   * Namespace declaration comes into scope.  Fires before startElement.
   *
   * @event XmlParser#startNamespaceDecl
   * @param {string} prefix
   * @param {string} uri
   */

  /**
   * All events that take only string pointers.
   *
   * @param {string} event
   * @param  {...number} args
   * @returns {boolean} True if event fired
   * @private
   */
  _simpleEvent (event, ...args) {
    return this.emit(event, ...args.map(s => expat.UTF8ToString(s)))
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
    if (!this.parser) {
      throw new Error('Invalid state')
    }
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
      const e = new XmlParseError(this.parser)
      this.reset()
      throw e
    } else if ((res === 1) && (final === 1)) {
      this.reset()
    }
    return res
  }

  /**
   * Reset the parser state, so that a new document can be parsed.
   */
  reset () {
    if (!this.parser) {
      throw new Error('Invalid state')
    }

    XmlParser.XML_ParserReset(this.parser, this.xmlEncoding)
    this._registerHandlers()
  }

  /**
   * @typedef {Object} Pieces
   * @property {string} [ns] the namespace URI
   * @property {string} local the local name, or the EVENTS name if no namespace
   * @property {string} [prefix] - the prefix used for the current name
   */

  /**
   * Parse an element or attribute name.
   *
   * @param {string} name - a EVENTS name, or a URI+local+prefix triple
   * @returns {Pieces} pieces - the pieces of the name
   */
  triple (name) {
    if (typeof this.separator !== 'string') {
      throw new Error('Invalid separator')
    }
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
    if (this.parser) {
      XmlParser.XML_ParserFree(this.parser)
      delete this.parser
    }
    if (this.id) {
      XmlParser.#pointers.remove(this.id)
      delete this.id
    }
  }
}

export default XmlParser
