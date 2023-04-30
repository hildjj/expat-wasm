import test from 'ava'
import { Pointers } from '../lib/pointers.js'

class Counted {
  constructor () {
    this.id = Counted.count++
  }

  /**
   * @param {string} event
   * @param {number} extra
   * @returns
   */
  count (event, extra) {
    return [event, this.id + extra]
  }
}
Counted.count = 0

test('create', t => {
  const p = new Pointers()
  t.truthy(p)
})

test('add-remove', t => {
  const p = new Pointers()
  const d = new Counted()
  const i0 = p.add(d)
  const i1 = p.add(new Counted())
  const i2 = p.add(new Counted())
  t.is(i0, 0)
  t.is(i1, 1)
  t.is(i2, 2)
  p.remove(i1)
  t.is(p.size, 3)
  t.falsy(p.get(1))
  t.falsy(p.get(i1))
  // @ts-ignore
  t.is(p.get(i0)?.id, d.id)
  t.deepEqual(p.available, 1)
  t.is(p.add(new Counted()), 1)

  p.remove(1)
  t.throws(() => p.remove(1))
  t.throws(() => p.remove(10001))
})

test('call', t => {
  const p = new Pointers()
  const c = new Counted()
  const i = p.add(c)
  const f = p.call.bind(p, 'count', 'counted')
  t.deepEqual(f(i, i), ['counted', c.id + i])
})

test('bad call', t => {
  const p = new Pointers()
  t.is(p.get(0), undefined)
  t.throws(() => p.call('count', 'counted', 0))
  p.add(new Counted())
  t.throws(() => p.call('mumps', 'mump', 0))
})
