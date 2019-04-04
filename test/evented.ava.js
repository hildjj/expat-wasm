'use strict'
const test = require('ava')
const XmlParser = require('../lib/index')

class ParseStream {
  constructor (parser) {
    this.events = []
    this.parser = parser
    parser.on('*', (event, ...args) => {
      this.events.push([event, ...args])
    })
  }
  read () {
    return this.events.shift()
  }
}

test('version', async t => {
  t.is(await XmlParser.version(), 'expat_2.2.6')
})

test('parse', async t => {
  t.throws(() => new XmlParser())
  const p = await XmlParser.create()
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

  t.deepEqual(p.triple('foo'), { local: 'foo' })
  t.deepEqual(p.triple('urn:f|foo|x'), { ns: 'urn:f', local: 'foo', prefix: 'x' })
  t.deepEqual(p.triple('urn:f|foo'), { ns: 'urn:f', local: 'foo' })

  t.deepEqual(ps.read(), ['xmlDecl', '1.0', '', true])
  t.deepEqual(ps.read(), ['processingInstruction', 'xml-stylesheet', 'href="mystyle.css" type="text/css"'])
  t.deepEqual(ps.read(), ['startDoctypeDecl', 'author', '', '', true])
  t.deepEqual(ps.read(), ['entityDecl', 'js', false, 'EcmaScript', '', '', '', ''])
  t.deepEqual(ps.read(), ['entityDecl', 'logo', false, null, '', 'images/logo.gif', '', 'gif'])
  t.deepEqual(ps.read(), ['notationDecl', 'jpeg', '', '', 'JPG 1.0'])
  t.deepEqual(ps.read(), ['endDoctypeDecl'])
  t.deepEqual(ps.read(), ['startNamespaceDecl', 'x', 'urn:f'])
  t.deepEqual(ps.read(), ['startElement', 'urn:f|foo|x', { a: 'b' }])
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
  t.deepEqual(ps.read(), ['startElement', 'urn:f|baz', { 'urn:f|c|x': 'no' }])
  t.deepEqual(ps.read(), ['characterData', 'EcmaScript'])
  t.deepEqual(ps.read(), ['endElement', 'urn:f|baz'])
  t.deepEqual(ps.read(), ['endNamespaceDecl', ''])
  t.deepEqual(ps.read(), ['characterData', '\n'])
  t.deepEqual(ps.read(), ['endElement', 'urn:f|foo|x'])
  t.deepEqual(ps.read(), ['endNamespaceDecl', 'x'])
  t.deepEqual(ps.read(), undefined)

  p.destroy()
})

test('tdt', async t => {
  const p = await XmlParser.create()
  const ps = new ParseStream(p)
  p.parse(`<!DOCTYPE TVSCHEDULE [
  <!ELEMENT TVSCHEDULE (CHANNEL+)>
  <!ELEMENT CHANNEL (#PCDATA)>
  <!ATTLIST TVSCHEDULE NAME CDATA #REQUIRED>
  <!ATTLIST CHANNEL CHAN (t|f) "t">
]>
<TVSCHEDULE><CHANNEL/></TVSCHEDULE>`)

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
          children: []
        }
      ]
    }],
    ['elementDecl', 'CHANNEL', {
      name: 'CHANNEL',
      quant: 0,
      type: 3,
      children: []
    }],
    ['attlistDecl', 'TVSCHEDULE', 'NAME', 'CDATA', '', true],
    ['attlistDecl', 'CHANNEL', 'CHAN', '(t|f)', 't', false],
    ['endDoctypeDecl'],
    ['startElement', 'TVSCHEDULE', {}],
    ['startElement', 'CHANNEL', { CHAN: 't' }],
    ['endElement', 'CHANNEL'],
    ['endElement', 'TVSCHEDULE']
  ])
})

test('error', async t => {
  t.throws(() => new XmlParser())
  t.throws(() => XmlParser._initialize())
  const p = await XmlParser.create()
  t.throws(() => p.parse('>>'))
  p.destroy()
})

test('chunks', async t => {
  const p = await XmlParser.create()
  const ps = new ParseStream(p)
  p.parse('<fo', 0)
  p.parse('o/>')
  t.deepEqual(ps.events, [
    ['startElement', 'foo', {}],
    ['endElement', 'foo']
  ])
})
