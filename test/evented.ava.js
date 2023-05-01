import {Buffer} from 'buffer'
import XmlParser from '../lib/index.js'
import test from 'ava'

/** @typedef {[string, ...any]} Event */

class ParseStream {
  /**
   *
   * @param {XmlParser} parser
   */
  constructor(parser) {
    /**
     * @type {Event[]}
     */
    this.events = []
    this.parser = parser
    parser.on('*', /** @param {string} event */ (event, ...args) => {
      this.events.push([event, ...args])
    })
  }

  read() {
    return this.events.shift()
  }
}

test('version', t => {
  t.is(XmlParser.XML_ExpatVersion(), 'expat_2.5.0')
})

test('parse', t => {
  const p = new XmlParser()
  const ps = new ParseStream(p)
  p.parse(`<?xml version="1.0" standalone="yes"?>
<?xml-stylesheet href="mystyle.css" type="text/css"?>
<!DOCTYPE author [
  <!ENTITY js "EcmaScript">
  <!ENTITY logo SYSTEM "images/logo.gif" NDATA gif>
  <!NOTATION jpeg PUBLIC "JPG 1.0">
]>
<x:foo a="b" xmlns:x="urn:f">
  <!--ack-->
  <a>bar</a>
  <b></b>
  <boo/>
  <coo><![CDATA[< & >]]></coo>
  <baz xmlns="urn:f" x:c="no">&js;</baz>
</x:foo>`)

  t.deepEqual(p.triple('foo'), {local: 'foo'})
  t.deepEqual(p.triple('urn:f|foo|x'), {ns: 'urn:f', local: 'foo', prefix: 'x'})
  t.deepEqual(p.triple('urn:f|foo'), {ns: 'urn:f', local: 'foo'})

  t.deepEqual(ps.read(), ['xmlDecl', '1.0', '', true])
  t.deepEqual(ps.read(), ['processingInstruction', 'xml-stylesheet', 'href="mystyle.css" type="text/css"'])
  t.deepEqual(ps.read(), ['startDoctypeDecl', 'author', '', '', true])
  t.deepEqual(ps.read(), ['entityDecl', 'js', false, 'EcmaScript', '', '', '', ''])
  t.deepEqual(ps.read(), ['entityDecl', 'logo', false, null, '', 'images/logo.gif', '', 'gif'])
  t.deepEqual(ps.read(), ['notationDecl', 'jpeg', '', '', 'JPG 1.0'])
  t.deepEqual(ps.read(), ['endDoctypeDecl'])
  t.deepEqual(ps.read(), ['startNamespaceDecl', 'x', 'urn:f'])
  t.deepEqual(ps.read(), ['startElement', 'urn:f|foo|x', {a: 'b'}])
  t.deepEqual(ps.read(), ['characterData', '\n'])
  t.deepEqual(ps.read(), ['characterData', '  '])
  t.deepEqual(ps.read(), ['comment', 'ack'])
  t.deepEqual(ps.read(), ['characterData', '\n'])
  t.deepEqual(ps.read(), ['characterData', '  '])
  t.deepEqual(ps.read(), ['startElement', 'a', {}])
  t.deepEqual(ps.read(), ['characterData', 'bar'])
  t.deepEqual(ps.read(), ['endElement', 'a'])
  t.deepEqual(ps.read(), ['characterData', '\n'])
  t.deepEqual(ps.read(), ['characterData', '  '])
  t.deepEqual(ps.read(), ['startElement', 'b', {}])
  t.deepEqual(ps.read(), ['endElement', 'b'])
  t.deepEqual(ps.read(), ['characterData', '\n'])
  t.deepEqual(ps.read(), ['characterData', '  '])
  t.deepEqual(ps.read(), ['startElement', 'boo', {}])
  t.deepEqual(ps.read(), ['endElement', 'boo'])
  t.deepEqual(ps.read(), ['characterData', '\n'])
  t.deepEqual(ps.read(), ['characterData', '  '])
  t.deepEqual(ps.read(), ['startElement', 'coo', {}])
  t.deepEqual(ps.read(), ['startCdataSection'])
  t.deepEqual(ps.read(), ['characterData', '< & >'])
  t.deepEqual(ps.read(), ['endCdataSection'])
  t.deepEqual(ps.read(), ['endElement', 'coo'])
  t.deepEqual(ps.read(), ['characterData', '\n'])
  t.deepEqual(ps.read(), ['characterData', '  '])
  t.deepEqual(ps.read(), ['startNamespaceDecl', '', 'urn:f'])
  t.deepEqual(ps.read(), ['startElement', 'urn:f|baz', {'urn:f|c|x': 'no'}])
  t.deepEqual(ps.read(), ['characterData', 'EcmaScript'])
  t.deepEqual(ps.read(), ['endElement', 'urn:f|baz'])
  t.deepEqual(ps.read(), ['endNamespaceDecl', ''])
  t.deepEqual(ps.read(), ['characterData', '\n'])
  t.deepEqual(ps.read(), ['endElement', 'urn:f|foo|x'])
  t.deepEqual(ps.read(), ['endNamespaceDecl', 'x'])
  t.deepEqual(ps.read(), undefined)

  p.destroy()
})

test('tdt', t => {
  const p = new XmlParser()
  const ps = new ParseStream(p)
  p.parse(`<!DOCTYPE TVSCHEDULE [
  <!ELEMENT TVSCHEDULE (CHANNEL+)>
  <!ELEMENT CHANNEL (#PCDATA)>
  <!ATTLIST TVSCHEDULE NAME CDATA #REQUIRED>
  <!ATTLIST CHANNEL CHAN (t|f) "t">
]>
<TVSCHEDULE><CHANNEL/></TVSCHEDULE>`)
  p.destroy()

  t.deepEqual(ps.events, [
    ['startDoctypeDecl', 'TVSCHEDULE', '', '', true],
    ['elementDecl', 'TVSCHEDULE', {
      name: 'TVSCHEDULE',
      quant: 0,
      type: 6,
      children: [
        {
          name: 'CHANNEL',
          quant: 3,
          type: 4,
          children: [],
        },
      ],
    }],
    ['elementDecl', 'CHANNEL', {
      name: 'CHANNEL',
      quant: 0,
      type: 3,
      children: [],
    }],
    ['attlistDecl', 'TVSCHEDULE', 'NAME', 'CDATA', '', true],
    ['attlistDecl', 'CHANNEL', 'CHAN', '(t|f)', 't', false],
    ['endDoctypeDecl'],
    ['startElement', 'TVSCHEDULE', {}],
    ['startElement', 'CHANNEL', {CHAN: 't'}],
    ['endElement', 'CHANNEL'],
    ['endElement', 'TVSCHEDULE'],
  ])
})

test('error', t => {
  const p = new XmlParser()
  t.throws(() => p.parse('>>'))
  p.destroy()
  t.throws(() => p.parse('<foo/>'))
  t.throws(() => p.reset())

  const q = new XmlParser(null, XmlParser.NO_NAMESPACES)
  t.throws(() => q.triple('foo|bar|baz'))
  q.destroy()
})

test('chunks', t => {
  const p = new XmlParser()
  const ps = new ParseStream(p)
  p.parse('<fo', 0)
  p.parse('o/>')
  t.deepEqual(ps.events, [
    ['startElement', 'foo', {}],
    ['endElement', 'foo'],
  ])
})

test('no namespaces', t => {
  const p = new XmlParser(null, XmlParser.NO_NAMESPACES)
  const ps = new ParseStream(p)
  p.parse(Buffer.from('<foo xmlns='), 0)

  /** @type {Buffer|Uint8ClampedArray|Uint8Array} */
  let chunk = Buffer.from('"urn:bar">')
  chunk = new Uint8Array(chunk, 0, chunk.length)
  p.parse(chunk, 0)
  chunk = Buffer.from('<b:boo xmlns:b="urn:b"/></foo>')
  chunk = new Uint8ClampedArray(chunk, 0, chunk.length)
  p.parse(chunk, 1)
  t.deepEqual(ps.events, [
    ['startElement', 'foo', {xmlns: 'urn:bar'}],
    ['startElement', 'b:boo', {'xmlns:b': 'urn:b'}],
    ['endElement', 'b:boo'],
    ['endElement', 'foo'],
  ])
})

test('input types', t => {
  const p = new XmlParser()
  // @ts-ignore
  t.throws(() => p.parse(null))
  // @ts-ignore
  t.throws(() => p.parse({}))
})

test('encoding', t => {
  const p = new XmlParser('UTF-16')
  const ps = new ParseStream(p)
  p.parse(Buffer.from('<foo/>', 'utf16le'))
  t.deepEqual(ps.events, [
    ['startElement', 'foo', {}],
    ['endElement', 'foo'],
  ])
  p.destroy()
  const q = new XmlParser('unknown')
  t.is(q.encoding, 'utf8')
  q.destroy()
})
