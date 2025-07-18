import {Buffer} from 'buffer';
import {EventEmitter} from 'events';
import {Pointers} from './pointers.js';
import expatWasm from './expat.js';

const expat = await expatWasm();
// This should work on node 20 and 22, even though `using`
// isn't supported.
const DISPOSE = Symbol.dispose ?? Symbol.for('Symbol.dispose');

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
   * @param {string} [extra] Extra string to add to message
   */
  constructor(parser, extra = '') {
    /* eslint-disable no-use-before-define */
    const code = XmlParser.XML_GetErrorCode(parser);
    const msg = XmlParser.XML_ErrorString(code) + extra;
    super(`XML Parse Error: "${msg}"`);
    this.code = code;
    this.xmlMessage = msg;
    this.line = XmlParser.XML_GetCurrentLineNumber(parser);
    this.column = XmlParser.XML_GetCurrentColumnNumber(parser);
    this.byteOffset = XmlParser.XML_GetCurrentByteIndex(parser);

    const base = XmlParser.XML_GetBase(parser);
    if (base) {
      this.base = base;
    }
    /* eslint-enable no-use-before-define */
  }
}

/**
 * Encodings that expat supports.
 *
 * @typedef { undefined
 * | null
 * | "US-ASCII"
 * | "UTF-8"
 * | "UTF-16"
 * | "ISO-8859-1"
 * } XML_Encoding
 */

/**
 * @typedef {object} ParserOptions
 * @prop {XML_Encoding} [encoding] null will do content
 *   sniffing.
 * @prop {string|XmlParser.NO_NAMESPACES} [separator='|'] the separator
 *   for namespace URI and element/attribute name.  Use
 *   XmlParser.NO_NAMESPACES to get Expat's old, broken namespace
 *   non-implementation via XmlParserCreate instead of XmlParserCreateNS.
 * @prop {boolean} [expandInternalEntities] expand internal entities
 * @prop {ReadEntity|null} [systemEntity] expand external entities using this
 *   callback
 * @prop {string|null} [base] Base URI for inclusions
 */

/**
 * @typedef {Object} Model
 * @property {string} [name] - Name of the model
 * @property {number} [type] - Empty=1, Any, Mixed, Name, Choice, Seq
 * @property {number} [quant] - None=0, Optional, Star, Plus
 * @property {Model[]} [children]
 */

/**
 * @typedef {Object} Pieces
 * @property {string} [ns] the namespace URI
 * @property {string} local the local name, or the EVENTS name if no namespace
 * @property {string} [prefix] - the prefix used for the current name
 */

/**
 * @typedef {"comment"
 * | "endCdataSection"
 * | "endDoctypeDecl"
 * | "endElement"
 * | "endNamespaceDecl"
 * | "notationDecl"
 * | "processingInstruction"
 * | "startCdataSection"
 * | "startNamespaceDecl"
 * } SimpleEventName
 */

/**
 * @typedef {object} EntityInfo
 * @prop {string} base Fully-qualified URL for this entity
 * @prop {string|Buffer|Uint8Array|Uint8ClampedArray} data Data associated
 *   with the entity, perhaps read from a file or network.
 */

/**
 * Read data associated with an entity.  MUST be synchronous.
 *
 * @callback ReadEntity
 * @param {string} base Base URL to compute entity URL from
 * @param {string} systemId URL pieces relative to base
 * @param {string} [publicId] For special local processing, like caching.
 * @returns {EntityInfo}
 */

/* eslint-disable @stylistic/max-len */
/**
 * @typedef {object} XmlEvents
 * @prop {[name: string | symbol, ...args: any[]]} star
 * @prop {[elname: string, attname: string, attType: string, dflt: string, isrequired: boolean]} attlistDecl
 * @prop {[value: string]} characterData
 * @prop {[value: string]} comment
 * @prop {[value: string]} default
 * @prop {[name: string, model: Model]} elementDecl
 * @prop {[base: string]} endBase
 * @prop {[]} endCdataSection
 * @prop {[]} endDoctypeDecl
 * @prop {[]} endDoctypeDecl
 * @prop {[name: string]} endElement
 * @prop {[prefix: string]} endNamespaceDecl
 * @prop {[entityName: string, isParameterEntity: boolean, value: string | null, base: string, systemId: string, publicId: string, notationName: string]} entityDecl
 * @prop {[error: unknown]} error
 * @prop {[notationName: string, base: NamedCurve, systemId: string, publicId: string]} notationDecl
 * @prop {[target: string, data: string]} processingInstruction
 * @prop {[entityName: string, isParameterEntity: boolean]} skippedEntity
 * @prop {[base: string]} startBase
 * @prop {[]} startCdataSection
 * @prop {[doctypeName: string, sysid: string, pubid: string, hasInternalSubset: boolean]} startDoctypeDecl
 * @prop {[name: string, attribs: object]} startElement
 * @prop {[prefix: string, nsURI: string]} startNamespaceDecl
 * @prop {[version: string, encoding: string, standalone: boolean]} xmlDecl
 * @prop {[valid: boolean]} destroy
 */
/* eslint-enable @stylistic/max-len */

/**
 * An evented parser based on a WASM-compiled version of expat. NOTE: Please
 * make sure to call {@link XmlParser#destroy destroy()} when you are done, or
 * ensure that you have used `using` to get explicit resource disposal
 * (if that is supported in your environment).
 *
 * @class XmlParser
 * @extends {EventEmitter<XmlEvents>}
 */
export class XmlParser extends EventEmitter {
  static CHUNK_SIZE = 4096;

  /**
   * Global pointer namespace.
   * @hidden
   */
  static #pointers = new Pointers();

  /**
   * @type {Record<string,function>}
   */
  static #CB_TYPES = {};

  /**
   * @type {Record<string,function>}
   */
  static #EVENTS = {};

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
      ['Default', 2, false],
      ['ElementDecl', 2, false],
      ['EndCdataSection', 0, true],
      ['EndDoctypeDecl', 0, true],
      ['EndElement', 1, true],
      ['EndNamespaceDecl', 1, true],
      ['EntityDecl', 8, false],
      ['ExternalEntityRef', 4, false], // First param is parser, not userdata
      ['NotationDecl', 4, true],
      ['ProcessingInstruction', 2, true],
      ['SkippedEntity', 2, false],
      ['StartCdataSection', 0, true],
      ['StartDoctypeDecl', 4, false],
      ['StartElement', 2, false],
      ['StartNamespaceDecl', 2, true],
      ['XmlDecl', 3, false],
    ]).reduce((events, [s, num, simple]) => {
      const lc = s[0].toLowerCase() + s.slice(1);
      events[lc] = expat.cwrap(
        `XML_Set${s}Handler`,
        'void',
        ['number', 'function']
      );
      if (lc === 'externalEntityRef') {
        this.#CB_TYPES[lc] =
          expat.addFunction(
            XmlParser._externalEntityRefTrampoline.bind(XmlParser),
            'iiiiii'
          );
      } else {
        this.#CB_TYPES[lc] = expat.addFunction(
          this.#pointers.bind(simple ? '_simpleEvent' : `_${lc}`, lc),
          'v'.padEnd(num + 2, 'i')
        );
      }
      return events;
    }, /** @type {Record<string,function>} */({}));

    this.#EVENTS.defaultExpand = expat.cwrap(
      'XML_SetDefaultHandlerExpand',
      'void',
      ['number', 'function']
    );
  }

  /**
   * ExternalEntityRef is special, because it takes the parser as the first
   * param.  This is so that external entities can be parsed recursively.
   *
   * @param {number} parser
   * @param {number} context
   * @param {number} base
   * @param {number} sysid
   * @param {number} pubid
   * @returns {number}
   * @private
   */
  // eslint-disable-next-line max-params
  static _externalEntityRefTrampoline(parser, context, base, sysid, pubid) {
    const userData = XmlParser.XML_GetUserData(parser);
    return this.#pointers.call(
      '_externalEntityRef',
      'externalEntityRef',
      userData,
      parser,
      context,
      base,
      sysid,
      pubid
    );
  }

  /**
   * Use as the separator to treat namespaces in legacy mode.
   */
  static NO_NAMESPACES = Symbol('NO_NAMESPACES');

  /**
   * @returns {string} Current expat version number.
   */
  static XML_ExpatVersion() {
    return expat.ccall('XML_ExpatVersion', 'string');
  }

  /**
   * Function to deallocate the model argument passed to the
   * XML_ElementDeclHandler callback set using XML_ElementDeclHandler.
   *
   * @param {number} parser
   * @param {number} model
   */
  static XML_FreeContentModel(parser, model) {
    expat.ccall(
      'XML_FreeContentModel',
      'void',
      ['number', 'number'],
      [parser, model]
    );
  }

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
  static XML_ParserCreate(encoding) {
    return expat.ccall('XML_ParserCreate', 'number', ['string'], [encoding]);
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
  static XML_ParserCreateNS(encoding, sep) {
    return expat.ccall(
      'XML_ParserCreateNS',
      'number',
      ['string', 'number'],
      [encoding, sep]
    );
  }

  /**
   * Creates an XML_Parser object that can parse an external general entity;
   * context is a '\0'-terminated string specifying the parse context;
   * encoding is a '\0'-terminated string giving the name of the externally
   * specified encoding, or NULL if there is no externally specified encoding.
   * The context string consists of a sequence of tokens separated by
   * formfeeds (\f); a token consisting of a name specifies that the general
   * entity of the name is open; a token of the form prefix=uri specifies the
   * namespace for a particular prefix; a token of the form =uri specifies the
   * default namespace.  This can be called at any point after the first call
   * to an ExternalEntityRefHandler so longer as the parser has not yet been
   * freed.  The new parser is completely independent and may safely be used
   * in a separate thread.  The handlers and userData are initialized from the
   * parser argument.  Returns NULL if out of memory. Otherwise returns a new
   * XML_Parser object.
   *
   * @param {number} parser
   * @param {number} context
   * @param {XML_Encoding} encoding
   */
  static XML_ExternalEntityParserCreate(parser, context, encoding) {
    return expat.ccall(
      'XML_ExternalEntityParserCreate',
      'number',
      ['number', 'number', 'string'],
      [parser, context, encoding]
    );
  }

  /**
   * Free memory used by the parser. Your application is responsible for
   * freeing any memory associated with user data.
   *
   * @param {number} parser
   */
  static XML_ParserFree(parser) {
    expat.ccall('XML_ParserFree', 'void', ['number'], [parser]);
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
   * @param {string|Buffer|Uint8Array|Uint8ClampedArray} str
   * @param {number} isFinal
   * @param {BufferEncoding} encoding
   * @returns {number} ERROR=0, OK=1, SUSPENDED=2
   */
  static XML_Parse(parser, str, isFinal, encoding) {
    if (typeof str === 'string') {
      str = Buffer.from(str, encoding);
    }

    const len = str.length;
    if (Buffer.isBuffer(str)) {
      str = new Uint8Array(str, 0, len);
    } else if (!(
      str instanceof Uint8Array || str instanceof Uint8ClampedArray
    )) {
      throw new Error('Expected chunk to be a string, Buffer, Uint8Array, or Uint8ClampedArray');
    }

    // Limit the chunk size going across the WASM boundary, so that expat
    // doesn't malloc a big chunk and go out of bounds.
    // Perhaps try XML_GetBuffer one day to avoid one more copy.
    let ret = 0;
    for (
      let offset = 0;
      (offset === 0) || (offset < len); // Always do the first empty chunk
      offset += this.CHUNK_SIZE
    ) {
      const chunk = str.slice(offset, offset + this.CHUNK_SIZE);
      const last = Number((offset + this.CHUNK_SIZE) >= len);
      ret = expat.ccall(
        'XML_Parse',
        'void',
        ['number', 'array', 'number', 'number'],
        [parser, chunk, chunk.length, last && isFinal]
      );

      // When parsing an external entity, ret is 1 instead of 2 for initial
      // chunks, so let's just catch errors.
      // If we didn't get a 2 (suspended) in the middle, we're not resetting,
      // so the next chunk will error, correctly.
      if (!ret) {
        return ret;
      }
    }
    return ret;
  }

  /**
   * Set the base URI for including external entities.
   *
   * @param {number} parser
   * @param {string} base
   * @returns {number} 1 on success, 0 on error
   */
  static XML_SetBase(parser, base) {
    if (typeof base !== 'string') {
      throw new Error(`base option must be string, not ${typeof base}`);
    }
    return expat.ccall('XML_SetBase', 'number', ['number', 'string'], [parser, base]);
  }

  /**
   * Get the base URI from a parser.
   *
   * @param {number} parser
   * @returns {string}
   */
  static XML_GetBase(parser) {
    const ret = expat.ccall('XML_GetBase', 'number', ['number'], [parser]);
    return expat.UTF8ToString(ret);
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
  static XML_SetReturnNSTriplet(parser, doNst) {
    expat.ccall(
      'XML_SetReturnNSTriplet',
      'void',
      ['number', 'number'],
      [parser, doNst]
    );
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
  static XML_ParserReset(parser, encoding) {
    return expat.ccall(
      'XML_ParserReset',
      'number',
      ['number', 'string'],
      [parser, encoding]
    );
  }

  /**
   * If XML_Parse or XML_ParseBuffer have returned XML_STATUS_ERROR, then
   * XML_GetErrorCode returns information about the error.
   *
   * @param {number} parser
   * @returns {number} Error code
   */
  static XML_GetErrorCode(parser) {
    return expat.ccall('XML_GetErrorCode', 'number', ['number'], [parser]);
  }

  /**
   * Returns a string describing the error.
   *
   * @param {number} code
   * @returns {string} Error description in English.
   */
  static XML_ErrorString(code) {
    return expat.ccall('XML_ErrorString', 'string', ['number'], [code]);
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
  static XML_GetCurrentLineNumber(parser) {
    return expat.ccall('XML_GetCurrentLineNumber', 'number', ['number'], [parser]);
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
  static XML_GetCurrentColumnNumber(parser) {
    return expat.ccall('XML_GetCurrentColumnNumber', 'number', ['number'], [parser]);
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
  static XML_GetCurrentByteIndex(parser) {
    return expat.ccall('XML_GetCurrentByteIndex', 'number', ['number'], [parser]);
  }

  /**
   * Controls parsing of parameter entities (including the external DTD
   * subset). If parsing of parameter entities is enabled, then references to
   * external parameter entities (including the external DTD subset) will be
   * passed to the handler set with XML_SetExternalEntityRefHandler.  The
   * context passed will be 0.  Unlike external general entities, external
   * parameter entities can only be parsed synchronously.  If the external
   * parameter entity is to be parsed, it must be parsed during the call to
   * the external entity ref handler: the complete sequence of
   * XML_ExternalEntityParserCreate, XML_Parse/XML_ParseBuffer and
   * XML_ParserFree calls must be made during this call.  After
   * XML_ExternalEntityParserCreate has been called to create the parser for
   * the external parameter entity (context must be 0 for this call), it is
   * illegal to make any calls on the old parser until XML_ParserFree has been
   * called on the newly created parser. If the library has been compiled
   * without support for parameter entity parsing (ie without XML_DTD being
   * defined), then XML_SetParamEntityParsing will return 0 if parsing of
   * parameter entities is requested; otherwise it will return non-zero. Note:
   * If XML_SetParamEntityParsing is called after XML_Parse or
   * XML_ParseBuffer, then it has no effect and will always return 0. Note: If
   * parser == NULL, the function will do nothing and return 0.
   *
   * @param {number} parser
   * @param {number} parsing NEVER=0, UNLESS_STANDALONE=1, ALWAYS=2.  If you
   *   want to turn this on, you probably want 1.
   * @returns {number} 0 on failure
   */
  static XML_SetParamEntityParsing(parser, parsing) {
    return expat.ccall(
      'XML_SetParamEntityParsing',
      'number',
      ['number', 'number'],
      [parser, parsing]
    );
  }

  /**
   * This value is passed as the userData argument to callbacks.
   *
   * @param {number} parser
   * @param {number} userData
   */
  static XML_SetUserData(parser, userData) {
    expat.ccall(
      'XML_SetUserData',
      'void',
      ['number', 'number'],
      [parser, userData]
    );
  }

  /**
   * The user data is the first four bytes of the parser struct.
   * #define XML_GetUserData(parser) (*(void **)(parser))
   *
   * @param {number} parser
   * @returns {number} User data
   */
  static XML_GetUserData(parser) {
    return expat.HEAPU32[parser / 4];
  }

  /**
   * Stop the current parser.
   *
   * @param {number} parser
   * @param {number} [resumable=0] 1 if resumable
   * @returns {number} 0 on fail, 1 on success
   */
  static XML_StopParser(parser, resumable = 0) {
    return expat.ccall(
      'XML_StopParser',
      'number',
      ['number', 'number'],
      [parser, resumable]
    );
  }

  /**
   * Create a parser instance.
   *
   * @param {XML_Encoding|ParserOptions} [encoding] null will do content
   *   sniffing. If an object, extended parser options, and the second
   *   parameter is ignored.
   * @param {string|XmlParser.NO_NAMESPACES} [separator='|'] the separator for
   *   namespace URI and element/attribute name.  Use XmlParser.NO_NAMESPACES
   *   to get Expat's old, broken namespace non-implementation via
   *   XmlParserCreate instead of XmlParserCreateNS.
   */
  constructor(encoding, separator = '|') {
    super();

    if (!encoding || (typeof encoding !== 'object')) {
      encoding = {encoding, separator};
    }

    /**
     * @type {Required<ParserOptions>}
     */
    this.opts = {
      base: null,
      encoding: null,
      expandInternalEntities: true,
      separator: '|',
      systemEntity: null,
      ...encoding,
    };

    /**
     * @type {string|XmlParser.NO_NAMESPACES}
     * @private
     */
    this.separator = this.opts.separator;

    /**
     * @type {number|undefined}
     * @private
     */
    this.parser = (() => {
      if (typeof this.separator === 'symbol') {
        if (this.separator === XmlParser.NO_NAMESPACES) {
          return XmlParser.XML_ParserCreate(this.opts.encoding);
        }
        throw new Error('Unknown separator symbol');
      }
      const p = XmlParser.XML_ParserCreateNS(
        this.opts.encoding, this.separator.charCodeAt(0)
      );
      XmlParser.XML_SetReturnNSTriplet(p, 1);
      return p;
    })();

    /**
     * @type {number|undefined}
     * @private
     */
    this.id = XmlParser.#pointers.add(this);
    XmlParser.XML_SetUserData(this.parser, this.id);

    if (this.opts.base) {
      if (XmlParser.XML_SetBase(this.parser, this.opts.base) !== 1) {
        throw new Error('XML_SetBase failed');
      }
    }

    /**
     * @type {XML_Encoding}
     * @private
     */
    this.xmlEncoding = this.opts.encoding;

    /**
     * @type {BufferEncoding}
     * @private
     */
    this.encoding = this.opts.encoding ?
    /** @type {Record<string,BufferEncoding>} */ ({
        'US-ASCII': 'ascii',
        'UTF-8': 'utf8',
        'UTF-16': 'utf16le',
        'ISO-8859-1': 'latin1',
      })[this.opts.encoding] || 'utf8' :
      'utf8';

    if (this.opts.systemEntity) {
      XmlParser.XML_SetParamEntityParsing(this.parser, 1);
      // Assert: this always returns 1
    }
    this._registerHandlers();
  }

  /**
   * Register all callbacks with the parser, pointing at the existing
   * prepared functions in #pointers.
   *
   * @private
   */
  _registerHandlers() {
    for (const [k, setEventHandler] of Object.entries(XmlParser.#EVENTS)) {
      if (!k.startsWith('default')) {
        setEventHandler(this.parser, XmlParser.#CB_TYPES[k]);
      }
    }
    if (this.opts.expandInternalEntities) {
      XmlParser.#EVENTS.defaultExpand(
        this.parser, XmlParser.#CB_TYPES.default
      );
    } else {
      XmlParser.#EVENTS.default(this.parser, XmlParser.#CB_TYPES.default);
    }
  }

  /**
   * Emit an event, and copy it onto the '*' event.
   *
   * @template {keyof XmlEvents} K
   * @param {K} eventName Name of the event that fired
   * @param {XmlEvents[K]} args The parameters for the event
   * @returns {boolean} True if there were listeners
   */
  emit(eventName, ...args) {
    // @ts-ignore
    const r = super.emit(eventName, ...args);
    // @ts-ignore
    super.emit('*', eventName, ...args);
    return r;
  }

  /**
   * All extra text.  Mostly in the DTD.
   *
   * @event XmlParser#default
   * @param {string} str The extra string
   */

  /**
   * Everything else?  Mostly odd bits of text in the DTD.
   *
   * @param {"default"} event
   * @param {number} str
   * @param {number} len
   * @returns {boolean}
   * @private
   */
  _default(event, str, len) {
    return this.emit(event, expat.UTF8ToString(str, len));
  }

  /**
   * Skipped Entities, such as when reading external entities is not enabled.
   *
   * @event XmlParser#skippedEntity
   * @param {string} entityName Entity name, without the & or ;
   * @param {boolean} isParameterEntity
   */

  /**
   * This is called in two situations:
   * 1) An entity reference is encountered for which no declaration
   *    has been read *and* this is not an error.
   * 2) An internal entity reference is read, but not expanded, because
   *    XML_SetDefaultHandler has been called.
   * Note: skipped parameter entities in declarations and skipped general
   *     entities in attribute values cannot be reported, because
   *     the event would be out of sync with the reporting of the
   *     declarations or attribute values
   *
   * @param {"skippedEntity"} event
   * @param {number} entityName
   * @param {number} isParameterEntity
   * @returns {boolean}
   * @private
   */
  _skippedEntity(event, entityName, isParameterEntity) {
    return this.emit(
      event, expat.UTF8ToString(entityName), Boolean(isParameterEntity)
    );
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
   * @param {"startElement"} event
   * @param {number} name
   * @param {number} attr
   * @returns {boolean}
   * @private
   */
  _startElement(event, name, attr) {
    /** @type {Record<string,string>} */
    const attribs = {};
    // Name/value pairs, starting at attr, until we get to a null.
    for (let a = attr / 4; expat.HEAPU32[a]; a += 2) {
      attribs[expat.UTF8ToString(expat.HEAPU32[a])] =
        expat.UTF8ToString(expat.HEAPU32[a + 1]);
    }
    return this.emit(event, expat.UTF8ToString(name), attribs);
  }

  /**
   * @param {"characterData"} event
   * @param {number} txt
   * @param {number} len
   * @returns {boolean}
   * @private
   */
  _characterData(event, txt, len) {
    return this.emit(event, expat.UTF8ToString(txt, len));
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
   * @param {"xmlDecl"} event
   * @param {number} version
   * @param {number} encoding
   * @param {number} standalone
   * @returns {boolean}
   * @private
   */
  _xmlDecl(event, version, encoding, standalone) {
    return this.emit(event,
      expat.UTF8ToString(version),
      expat.UTF8ToString(encoding),
      Boolean(standalone));
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
   * @param {"startDoctypeDecl"} event
   * @param {number} doctypeName
   * @param {number} sysid
   * @param {number} pubid
   * @param {number} hasInternalSubset
   * @returns {boolean}
   * @private
   */
  // eslint-disable-next-line max-params
  _startDoctypeDecl(event, doctypeName, sysid, pubid, hasInternalSubset) {
    return this.emit(event,
      expat.UTF8ToString(doctypeName),
      expat.UTF8ToString(sysid),
      expat.UTF8ToString(pubid),
      Boolean(hasInternalSubset));
  }

  /**
   * Fill in a Model and its children, starting from a memory offset.
   *
   * @param {number} offset
   * @param {Model} model
   * @returns {Model}
   * @private
   */
  _unpackModel(offset, model = {}) {
    const a = offset / 4; // Offset in U32's
    const [type, quant, name, numchildren, children] =
      expat.HEAPU32.slice(a, a + 5);
    model.type = type;
    model.quant = quant;
    if (name) {
      model.name = expat.UTF8ToString(name);
    }
    model.children = [];
    for (let c = 0; c < numchildren; c++) {
      // 5 U32's per entry.
      model.children.push(this._unpackModel(children + (20 * c)));
    }
    return model;
  }

  /**
   * DTD Element declaration
   *
   * @event XmlParser#elementDecl
   * @param {string} name The name of the element
   * @param {Model} model Description of the element
   */

  /**
   * @param {"elementDecl"} event
   * @param {number} nm
   * @param {number} model
   * @returns {boolean}
   * @private
   */
  _elementDecl(event, nm, model) {
    try {
      const name = expat.UTF8ToString(nm);
      const m = this._unpackModel(model, {name});
      return this.emit(event, name, m);
    } finally {
      if (this.parser) {
        XmlParser.XML_FreeContentModel(this.parser, model);
      }
    }
  }

  /**
   * DTD Attribute list defined.
   *
   * @param {string} elname - the element name
   * @param {string} attname - the attribute name
   * @param {string} attType - the attribute type
   * @param {string} dflt - the default value
   * @param {boolean} isrequired - is the attribute required
   */

  /**
   * @param {"attlistDecl"} event
   * @param {number} elname
   * @param {number} attname
   * @param {number} attType
   * @param {number} dflt
   * @param {number} isrequired
   * @returns {boolean}
   * @private
   */
  // eslint-disable-next-line max-params
  _attlistDecl(event, elname, attname, attType, dflt, isrequired) {
    return this.emit(
      event,
      expat.UTF8ToString(elname),
      expat.UTF8ToString(attname),
      expat.UTF8ToString(attType),
      expat.UTF8ToString(dflt),
      Boolean(isrequired)
    );
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
   * @param {"entityDecl"} event
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
  // eslint-disable-next-line max-params
  _entityDecl(
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
      Boolean(isParameterEntity),
      value ? expat.UTF8ToString(value, valueLength) : null,
      expat.UTF8ToString(base),
      expat.UTF8ToString(systemId),
      expat.UTF8ToString(publicId),
      expat.UTF8ToString(notationName)
    );
  }

  /**
   * Error while parsing external entity.
   *
   * @event XmlParser#error
   * @param {Error} error The error that was thrown from systemEntity.
   */

  /**
   * Started processing an external entity ref with this base URL.
   *
   * @event XmlParser#startBase
   * @param {string} base Base URL for the new external entity.
   */

  /**
   * Stopped processing an external entity ref
   *
   * @event XmlParser#endBase
   * @param {string} base Base URL for the finished entity
   */

  /**
   * @param {string} _event
   * @param {number} parser
   * @param {number} context
   * @param {number} base
   * @param {number} systemId
   * @param {number} publicId
   * @returns {number}
   * @private
   */
  // eslint-disable-next-line max-params
  _externalEntityRef(_event, parser, context, base, systemId, publicId) {
    if (typeof this.opts.systemEntity !== 'function') {
      if (typeof context === 'number') {
        const u = expat.UTF8ToString(context);
        const name = u
          .split('\f')
          .find((/** @type {string} */ c) => c.indexOf('=') === -1);
        if (name === undefined) {
          this.emit('error', `Unrecognized skipped entity: "${u}"`);
        } else {
          this.emit('skippedEntity', name, false);
        }
      }
      return 1; // Success. Keep entityRef intact
    }
    if (!this.parser) {
      return 0; // Previously destroyed
    }

    /** @type {EntityInfo|null} */
    let ent = null;
    try {
      ent = this.opts.systemEntity(
        expat.UTF8ToString(base),
        expat.UTF8ToString(systemId),
        expat.UTF8ToString(publicId)
      );
    } catch (e) {
      this.emit('error', e);
      return 0;
    }

    this.emit('startBase', ent.base);
    const eparser = XmlParser.XML_ExternalEntityParserCreate(
      parser, context, this.xmlEncoding
    );
    if (!eparser) {
      this.emit('error', new Error('Out of memory'));
      return 0;
    }
    XmlParser.XML_SetBase(eparser, ent.base);
    let ret = 1;
    if (XmlParser.XML_Parse(eparser, ent.data, 1, this.encoding) !== 1) {
      this.emit('error', new XmlParseError(eparser, ' in EntityRef'));
      ret = 0;
    }
    XmlParser.XML_ParserFree(eparser);
    this.emit('endBase', ent.base);
    return ret;
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
   * @template {SimpleEventName} K
   * @param {K} event
   * @param  {...number} args
   * @returns {boolean} True if event fired
   * @private
   */
  _simpleEvent(event, ...args) {
    const argStrings =
      /** @type {XmlEvents[K]} */ (args.map(s => expat.UTF8ToString(s)));
    return this.emit(event, ...argStrings);
  }

  /**
   * Parse a chunk of text.  If this is not the last (or only) chunk,
   * set `final` to 0.
   *
   * @param {string|Buffer|Uint8Array|Uint8ClampedArray} chunk - Input text
   * @param {number} [final=1] - 0 if not the last or only chunk.
   *
   * @throws {XmlParseError}
   */
  parse(chunk, final = 1) {
    if (!this.parser) {
      throw new Error('Invalid state');
    }

    const res = XmlParser.XML_Parse(this.parser, chunk, final, this.encoding);
    if (res === 0) {
      const e = new XmlParseError(this.parser);
      this.reset();
      throw e;
    } else if ((res === 1) && (final === 1)) {
      this.reset();
    }
    return res;
  }

  /**
   * Reset the parser state, so that a new document can be parsed.
   */
  reset() {
    if (!this.parser) {
      throw new Error('Invalid state');
    }

    XmlParser.XML_ParserReset(this.parser, this.xmlEncoding);
    this._registerHandlers();
  }

  /**
   * Parse an element or attribute name.
   *
   * @param {string} name - a EVENTS name, or a URI+local+prefix triple
   * @returns {Pieces} pieces - the pieces of the name
   */
  triple(name) {
    if (typeof this.separator !== 'string') {
      return {
        local: name,
      };
    }
    const [ns, local, prefix] = name.split(this.separator);
    if (!local) {
      return {
        local: ns,
      };
    }
    if (!prefix) {
      return {ns, local};
    }
    return {ns, local, prefix};
  }

  /**
   * Stop parsing in the middle of a document, usually from an event handler.
   * @param {number} [resumable=0] 1 for resumable
   */
  stop(resumable = 0) {
    if (!this.parser) {
      throw new Error('Invalid state');
    }
    if (XmlParser.XML_StopParser(this.parser, Number(resumable)) !== 1) {
      throw new Error('XML_StopParser failed');
    }
  }

  /**
   * Clean up after the parser.  REQUIRED, since there is not currently
   * memory management for WASM code.
   *
   * @returns {boolean} True if this is the first time destroy() was called.
   */
  destroy() {
    let parser = false;
    let id = false;
    if (this.parser) {
      XmlParser.XML_ParserFree(this.parser);
      delete this.parser;
      parser = true;
    }
    if (typeof this.id === 'number') {
      XmlParser.#pointers.remove(this.id);
      delete this.id;
      id = true;
    }
    const valid = parser && id;
    this.emit('destroy', valid);
    return valid;
  }

  [DISPOSE]() {
    this.destroy();
  }
}

export default XmlParser;
