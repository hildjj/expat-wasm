'use strict'
const {EventEmitter} = require('events')
const Pointers = require('./pointers')
const expat = require('./expat')
const expatInit = new Promise(resolve => {
  expat['onRuntimeInitialized'] = resolve
})
const INTERNAL = Symbol('XmlParserInternal')

module.exports = class XmlParser extends EventEmitter {
  static initialize () {
    if (this._intialized != null) {
      return this._intialized
    }
    this._intialized = expatInit.then(() => {
      this.pointers = new Pointers()
      ;[
        ['XML_ParserCreateNS', 'number', ['string', 'number']],
        ['XML_ParserFree', 'void', ['number']],
        ['XML_Parse', 'void', ['number', 'string', 'number', 'number']],
        ['XML_GetErrorCode', 'number', ['number']],
        ['XML_ErrorString', 'string', ['number']],
        ['XML_GetCurrentLineNumber', 'number', ['number']],
        ['XML_GetCurrentColumnNumber', 'number', ['number']],
        ['XML_SetUserData', 'void', ['number', 'number']],
        ['XML_SetElementHandler', 'void', ['number', 'function', 'function']],
        ['XML_SetCharacterDataHandler', 'void', ['number', 'function']]
      ].reduce((o, [name, ret, args]) => {
        this[name] = expat.cwrap(name, ret, args)
        return o
      }, {})

      this.SIMPLE = [
        'Comment',
        'ExternalEntityRef',
        'NotationDecl',
        'ProcessingInstruction',
        'UnparsedEntityDecl'
      ].reduce((o, s) => {
        const lc = s[0].toLowerCase() + s.slice(1)
        o[lc] = expat.cwrap(`XML_Set${s}Handler`, 'void', ['number', 'function'])
        return o
      }, {})

      this.START_END = [
        'CdataSection',
        'NamespaceDecl'
      ].reduce((o, s) => {
        o[s] = expat.cwrap(`XML_Set${s}Handler`, 'void', ['number', 'function', 'function'])
        return o
      }, {})

      this.CB_TYPES = {}
      for (const [k] of Object.entries(this.START_END)) {
        this.CB_TYPES[k] = [
          expat.addFunction(this.pointers.call.bind(this.pointers, '_simple', 'start' + k)),
          expat.addFunction(this.pointers.call.bind(this.pointers, '_simple', 'end' + k))
        ]
      }
      for (const [k] of Object.entries(this.SIMPLE)) {
        this.CB_TYPES[k] = [
          expat.addFunction(this.pointers.call.bind(this.pointers, '_simple', k))
        ]
      }
      this.CB_TYPES['startElement'] = expat.addFunction(this.pointers.call.bind(this.pointers, '_startElement', 'startElement'))
      this.CB_TYPES['endElement'] = expat.addFunction(this.pointers.call.bind(this.pointers, '_simple', 'endElement'))
      this.CB_TYPES['characterData'] = expat.addFunction(this.pointers.call.bind(this.pointers, '_characterData', 'characterData'))

      return this
    })
    return this._intialized
  }

  static async create (encoding, separator = '|') {
    await XmlParser.initialize()
    return new XmlParser(INTERNAL, encoding, separator)
  }

  constructor (_internalOnly, encoding, separator) {
    if (_internalOnly !== INTERNAL) {
      throw new Error('Please use "create()" factory')
    }
    super()
    this.parser = XmlParser.XML_ParserCreateNS(encoding, separator.charCodeAt(0))
    this.id = XmlParser.pointers.add(this)
    XmlParser.XML_SetUserData(this.parser, this.id)
    XmlParser.XML_SetElementHandler(
      this.parser,
      XmlParser.CB_TYPES.startElement,
      XmlParser.CB_TYPES.endElement)
    XmlParser.XML_SetCharacterDataHandler(
      this.parser,
      XmlParser.CB_TYPES.characterData)
    for (const [k, v] of Object.entries(XmlParser.START_END)) {
      v(this.parser,
        XmlParser.CB_TYPES['start' + k],
        XmlParser.CB_TYPES['end' + k])
    }
    for (const [k, v] of Object.entries(XmlParser.SIMPLE)) {
      v(this.parser, XmlParser.CB_TYPES[k])
    }
  }

  _startElement (event, name, attr) {
    const attribs = {}
    for (let a = attr / 4; expat.HEAPU32[a]; a += 2) {
      attribs[expat.Pointer_stringify(expat.HEAPU32[a])] =
        expat.Pointer_stringify(expat.HEAPU32[a + 1])
    }
    this.emit('startElement', expat.Pointer_stringify(name), attribs)
  }
  _characterData (event, txt, len) {
    this.emit('characterData', expat.Pointer_stringify(txt, len))
  }
  _simple (event, ...args) {
    this.emit(event, ...args.map(s => expat.Pointer_stringify(s)))
    return 1
  }
  parse (str, final = 1) {
    const res = XmlParser.XML_Parse(this.parser, str, str.length, final)
    if (res === 0) {
      const er = new Error('XML Parse Error')
      er.code = XmlParser.XML_GetErrorCode(this.parser)
      er.xmlMessage = XmlParser.XML_ErrorString(er.code)
      er.line = XmlParser.XML_GetCurrentLineNumber(this.parser)
      er.col = XmlParser.XML_GetCurrentColumnNumber(this.parser)
      throw er
    }
  }
  destroy () {
    XmlParser.XML_ParserFree(this.parser)
    delete this.parser
    XmlParser.pointers.remove(this.id)
    delete this.id
  }
}
