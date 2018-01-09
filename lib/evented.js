'use strict'
const {EventEmitter} = require('events')
const expat = require('./expat')
const expatInit = new Promise(resolve => {
  expat['onRuntimeInitialized'] = resolve
})

module.exports = class XmlParser extends EventEmitter {
  static initialize () {
    if (this._intialized != null) {
      return this._intialized
    }
    this._intialized = expatInit.then(() => {
      [
        ['XML_ParserCreateNS', 'number', ['string', 'number']],
        ['XML_ParserFree', 'void', ['number']],
        ['XML_Parse', 'void', ['number', 'string', 'number', 'number']],
        ['XML_SetElementHandler', 'void', ['number', 'function', 'function']],
        ['XML_SetCharacterDataHandler', 'void', ['number', 'function']],
        ['XML_GetErrorCode', 'number', ['number']],
        ['XML_ErrorString', 'string', ['number']],
        ['XML_GetCurrentLineNumber', 'number', ['number']],
        ['XML_GetCurrentColumnNumber', 'number', ['number']]
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
      return this
    })
    return this._intialized
  }

  constructor (encoding, separator = '|') {
    super()
    this.parser = XmlParser.XML_ParserCreateNS(encoding, separator.charCodeAt(0))
    this.funcs = []
    XmlParser.XML_SetElementHandler(
      this.parser,
      this._func(this._startElement),
      this._func(this._simple, 'endElement'))
    XmlParser.XML_SetCharacterDataHandler(
      this.parser,
      this._func(this._characterData))
    for (const [k, v] of Object.entries(XmlParser.START_END)) {
      v(this.parser,
        this._func(this._simple, 'start' + k),
        this._func(this._simple, 'end' + k))
    }
    for (const [k, v] of Object.entries(XmlParser.SIMPLE)) {
      v(this.parser, this._func(this._simple, k))
    }
  }

  _func (f, ...extra) {
    const i = expat.addFunction(f.bind(this, ...extra))
    this.funcs.push(i)
    return i
  }

  _startElement (_, name, attr) {
    const attribs = {}
    for (let a = attr / 4; expat.HEAPU32[a]; a += 2) {
      attribs[expat.Pointer_stringify(expat.HEAPU32[a])] =
        expat.Pointer_stringify(expat.HEAPU32[a + 1])
    }
    this.emit('startElement', expat.Pointer_stringify(name), attribs)
  }
  _characterData (_, txt, len) {
    this.emit('characterData', expat.Pointer_stringify(txt, len))
  }
  _simple (event, _, ...args) {
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
    for (const f of this.funcs) {
      expat.removeFunction(f)
    }
    this.funcs = []
  }
}
