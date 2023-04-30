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
    constructor(parser: number);
    code: number;
    xmlMessage: string;
    line: number;
    column: number;
    byteOffset: number;
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
    static "__#2@#pointers": Pointers;
    /**
     * @type {Record<string,function>}
     */
    static "__#2@#CB_TYPES": Record<string, Function>;
    /**
     * @type {Record<string,function>}
     */
    static "__#2@#EVENTS": Record<string, Function>;
    /**
     * Use as the separator to treat namespaces in legacy mode.
     */
    static NO_NAMESPACES: symbol;
    /**
     * @returns {string} Current expat version number.
     */
    static XML_ExpatVersion(): string;
    /**
     * Function to deallocate the model argument passed to the
     * XML_ElementDeclHandler callback set using XML_ElementDeclHandler.
     *
     * @param {number} parser
     * @param {number} model
     */
    static XML_FreeContentModel(parser: number, model: number): void;
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
    static XML_ParserCreate(encoding?: "US-ASCII" | "UTF-8" | "UTF-16" | "ISO-8859-1" | null | undefined): number;
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
    static XML_ParserCreateNS(encoding: "US-ASCII" | "UTF-8" | "UTF-16" | "ISO-8859-1" | null | undefined, sep: number): number;
    /**
     * Free memory used by the parser. Your application is responsible for
     * freeing any memory associated with user data.
     *
     * @param {number} parser
     */
    static XML_ParserFree(parser: number): void;
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
    static XML_Parse(parser: number, str: Uint8Array | Uint8ClampedArray, len: number, isFinal: number): number;
    static XML_PARAM_ENTITY_PARSING_NEVER: number;
    static XML_PARAM_ENTITY_PARSING_UNLESS_STANDALONE: number;
    static XML_PARAM_ENTITY_PARSING_ALWAYS: number;
    /**
     * Controls parsing of parameter entities (including the external DTD
     * subset). If parsing of parameter entities is enabled, then references to
     * external parameter entities (including the external DTD subset) will be
     * passed to the handler set with XML_SetExternalEntityRefHandler.  The
     * context passed will be 0.
     *
     * Unlike external general entities, external parameter entities can only be
     * parsed synchronously.  If the external parameter entity is to be parsed,
     * it must be parsed during the call to the external entity ref handler: the
     * complete sequence of XML_ExternalEntityParserCreate,
     * XML_Parse/XML_ParseBuffer and XML_ParserFree calls must be made during
     * this call.  After XML_ExternalEntityParserCreate has been called to
     * create the parser for the external parameter entity (context must be 0
     * for this call), it is illegal to make any calls on the old parser until
     * XML_ParserFree has been called on the newly created parser. If the
     * library has been compiled without support for parameter entity parsing
     * (ie without XML_DTD being defined), then XML_SetParamEntityParsing will
     * return 0 if parsing of parameter entities is requested; otherwise it will
     * return non-zero. Note: If XML_SetParamEntityParsing is called after
     * XML_Parse or XML_ParseBuffer, then it has no effect and will always
     * return 0. Note: If parser == NULL, the function will do nothing and
     * return 0.
     *
     * @param {number} parser
     * @param {number} code
     * @returns {number} 0 on fail
     */
    static XML_SetParamEntityParsing(parser: number, code: number): number;
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
    static XML_SetReturnNSTriplet(parser: number, doNst: number): void;
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
    static XML_ParserReset(parser: number, encoding: "US-ASCII" | "UTF-8" | "UTF-16" | "ISO-8859-1" | null | undefined): number;
    /**
     * If XML_Parse or XML_ParseBuffer have returned XML_STATUS_ERROR, then
     * XML_GetErrorCode returns information about the error.
     *
     * @param {number} parser
     * @returns {number} Error code
     */
    static XML_GetErrorCode(parser: number): number;
    /**
     * Returns a string describing the error.
     *
     * @param {number} code
     * @returns {string} Error description in English.
     */
    static XML_ErrorString(code: number): string;
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
    static XML_GetCurrentLineNumber(parser: number): number;
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
    static XML_GetCurrentColumnNumber(parser: number): number;
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
    static XML_GetCurrentByteIndex(parser: number): number;
    /**
     * This value is passed as the userData argument to callbacks.
     *
     * @param {number} parser
     * @param {number} userData
     */
    static XML_SetUserData(parser: number, userData: number): void;
    /**
     * Create a parser instance.
     *
     * @param {XML_Encoding} [encoding] null will do content sniffing.
     * @param {string|XmlParser.NO_NAMESPACES} [separator='|'] the separator
     *   for namespace URI and element/attribute name.  Use
     *   XmlParser.NO_NAMESPACES to get Expat's old, broken namespace
     *   non-implementation via XmlParserCreate instead of XmlParserCreateNS.
     */
    constructor(encoding?: "US-ASCII" | "UTF-8" | "UTF-16" | "ISO-8859-1" | null | undefined, separator?: string | symbol | undefined);
    /**
     * @type {string|XmlParser.NO_NAMESPACES}
     * @private
     */
    private separator;
    /**
     * @type {number|undefined}
     * @private
     */
    private parser;
    /**
     * @type {number|undefined}
     * @private
     */
    private id;
    /**
     * @type {XML_Encoding}
     * @private
     */
    private xmlEncoding;
    /**
     * @type {BufferEncoding}
     * @private
     */
    private encoding;
    _registerHandlers(): void;
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
    private _startElement;
    /**
     * @param {string} event
     * @param {number} txt
     * @param {number} len
     * @returns {boolean}
     * @private
     */
    private _characterData;
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
    private _xmlDecl;
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
    private _startDoctypeDecl;
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
    private _unpackModel;
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
    private _elementDecl;
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
    private _attlistDecl;
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
    private _entityDecl;
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
    private _simpleEvent;
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
    parse(chunk: string | Buffer | Uint8Array | Uint8ClampedArray, final?: number | undefined): number;
    /**
     * Reset the parser state, so that a new document can be parsed.
     */
    reset(): void;
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
    triple(name: string): {
        /**
         * the namespace URI
         */
        ns?: string | undefined;
        /**
         * the local name, or the EVENTS name if no namespace
         */
        local: string;
        /**
         * - the prefix used for the current name
         */
        prefix?: string | undefined;
    };
    /**
     * Clean up after the parser.  REQUIRED, since there is not currently
     * memory management for WASM code.
     *
     * @memberOf XmlParser
     */
    destroy(): void;
}
export default XmlParser;
import { EventEmitter } from 'events';
import { Pointers } from './pointers.js';
