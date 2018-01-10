'use strict'
const test = require('ava')
const XmlParser = require('../lib/evented')

test('parse', async t => {
  t.plan(4)
  t.throws(() => new XmlParser())
  const p = await XmlParser.create()
  const prom = Promise.all([
    new Promise((resolve) => p.on('startElement', (nm, at) => resolve([nm, at]))),
    new Promise((resolve) => p.on('characterData', resolve)),
    new Promise((resolve) => p.on('endElement', resolve))
  ])
  p.parse('<foo a="b">bar</foo>')
  const [[start, at], txt, end] = await prom
  t.is(start, end)
  t.deepEqual(at, {a: 'b'})
  t.is(txt, 'bar')
  p.destroy()
})

test('error', async t => {
  const p = await XmlParser.create()
  t.throws(() => p.parse('>>'))
  p.destroy()
})
