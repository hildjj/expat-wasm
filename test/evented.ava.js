import {Buffer} from 'buffer'
import XmlParser from '../lib/index.js'
import fs from 'fs/promises'
import path from 'path'
import test from 'ava'
import url from 'url'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
  t.snapshot(ps.events)

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

  t.snapshot(ps.events)
})

test('error', t => {
  const p = new XmlParser({
    base: 'file:///fixtures/external.xml',
  })
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

test('separator', t => {
  t.throws(() => new XmlParser(null, Symbol('wrong')))
  const p = new XmlParser(null, ',')
  const ps = new ParseStream(p)
  p.parse('<f:g xmlns:f="foo"/>')
  t.deepEqual(ps.events, [
    ['startNamespaceDecl', 'f', 'foo'],
    ['startElement', 'foo,g,f', {}],
    ['endElement', 'foo,g,f'],
    ['endNamespaceDecl', 'f'],
  ])
  p.destroy()
})

test('base', async t => {
  const basePath = path.join(__dirname, 'fixtures', 'external.xml')
  const external = await fs.readFile(basePath)
  const address = await fs.readFile(path.join(__dirname, 'fixtures', 'address.dtd'))

  // Fake up some URLs so that the real fully-qualified pathname doesn't
  // end up in the snapshot
  let p = new XmlParser({
    base: 'file:///fixtures/external.xml',
    systemEntity(base, sysId, pubId) {
      t.is(sysId, 'address.dtd')
      return {
        base: new URL(sysId, base).toString(),
        data: address,
      }
    },
  })
  let ps = new ParseStream(p)
  p.parse(external)

  p.destroy()
  t.snapshot(ps.events)

  t.throws(() => new XmlParser({base: {foo: 1}}))

  p = new XmlParser({
    expandInternalEntities: false,
  })
  ps = new ParseStream(p)
  p.parse(external)
  p.destroy()
  t.snapshot(ps.events)

  p = new XmlParser({systemEntity: 1})
  ps = new ParseStream(p)
  p.parse(external)
  p.destroy()
  t.snapshot(ps.events)

  p = new XmlParser({systemEntity() {
    // Dummy
  }})
  const {parser} = p
  p.on('comment', () => (p.parser = null))
  t.throws(() => p.parse(external))
  p.parser = parser
  p.destroy()

  p = new XmlParser({systemEntity() {
    throw new Error('Intentional error')
  }})
  let er = null
  p.on('error', e => (er = e))
  t.throws(() => p.parse(external))
  p.destroy()
  t.truthy(er)

  const badPath = path.join(__dirname, 'fixtures', 'badExternal.xml')
  const bad = await fs.readFile(badPath)
  const badDTD = await fs.readFile(path.join(__dirname, 'fixtures', 'bad.dtd'))

  const q = new XmlParser({
    base: 'file:///fixtures/bad.xml',
    systemEntity(base, sysId, pubId) {
      t.is(sysId, 'bad.dtd')
      return {
        base: new URL(sysId, base).toString(),
        data: badDTD,
      }
    },
  })
  t.throws(() => q.parse(bad))
  q.destroy()
})

test('stop parser', t => {
  const p = new XmlParser()
  const ps = new ParseStream(p)
  p.on('startElement', () => p.stop())
  t.throws(() => p.parse('<foo><bar/></foo>'))
  p.destroy()
  t.snapshot(ps.events)
  t.throws(() => p.stop())

  const q = new XmlParser()
  q.stop()
  t.throws(() => q.stop())
})
