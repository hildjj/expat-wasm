'use strict'

module.exports = class Pointers {
  constructor () {
    this.pointers = []
    this.unused = []
  }

  add (obj) {
    let index = this.unused.pop()
    if (index == null) {
      index = this.pointers.push(obj) - 1
    } else {
      this.pointers[index] = obj
    }
    return index
  }

  remove (index) {
    delete this.pointers[index]
    this.unused.push(index)
  }

  get (index) {
    return this.pointers[index]
  }

  // Set up for bind() to work better.
  call (funcName, event, index, ...args) {
    const o = this.get(index)
    if (!o || (typeof o[funcName] !== 'function')) {
      throw new TypeError(`Invalid object for function: "${funcName}" ${!!o} ${o && typeof (o[funcName])}`)
    }
    return o[funcName](event, ...args)
  }

  bind (funcName, event) {
    return this.call.bind(this, funcName, event)
  }
}
