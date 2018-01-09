'use strict'
const test = require('ava')
const XmlParser = require('../lib/evented')

test('load', t => {
  return XmlParser.initialize().then(x => {
    t.is(x, XmlParser)
  })
})

test.serial('parse', t => {
  t.plan(3)
  return XmlParser.initialize().then(() => {
    const p = new XmlParser()
    const ret = Promise.all([
      new Promise((resolve) => p.on('startElement', (nm, at) => resolve([nm, at]))),
      new Promise((resolve) => p.on('characterData', resolve)),
      new Promise((resolve) => p.on('endElement', resolve))
    ]).then(([[start, at], txt, end]) => {
      t.is(start, end)
      t.deepEqual(at, {a: 'b'})
      t.is(txt, 'bar')
      p.destroy()
    })
    p.parse('<foo a="b">bar</foo>')
    return ret
  })
})

test.serial('error', t => {
  return XmlParser.initialize().then(() => {
    const p = new XmlParser()
    t.throws(() => p.parse('>>'))
    p.destroy()
  })
})
