'use strict'
const test = require('ava')
const XmlParser = require('../lib/evented')

test('parse', async t => {
  t.throws(() => new XmlParser())
  const p = await XmlParser.create()
  const prom = Promise.all([
    new Promise((resolve) => p.on('startNamespaceDecl', (prefix, uri) => resolve([prefix, uri]))),
    new Promise((resolve) => p.on('startElement', (nm, at) => resolve([nm, at]))),
    new Promise((resolve) => p.on('comment', resolve)),
    new Promise((resolve) => p.on('characterData', resolve)),
    new Promise((resolve) => p.on('endElement', resolve)),
    new Promise((resolve) => p.on('endNamespaceDecl', resolve))
  ])
  p.parse('<x:foo a="b" xmlns:x="urn:f"><!--ack-->bar</x:foo>')
  const [[prefix, uri], [start, at], comment, txt, end, endPrefix] = await prom
  t.is(prefix, 'x')
  t.is(uri, 'urn:f')
  t.is(start, 'urn:f|foo')
  t.is(start, end)
  t.deepEqual(at, {a: 'b'})
  t.is(comment, 'ack')
  t.is(txt, 'bar')
  t.is(endPrefix, 'x')
  p.destroy()
})

test('error', async t => {
  const p = await XmlParser.create()
  t.throws(() => p.parse('>>'))
  p.destroy()
})
