/**
 * Maintain a bi-directional mapping between objects and small integers, which
 * can be use as fake "pointers" to pass back and forth to WASM.
 * @private
 */
export class Pointers {
  /**
   * @type {object[]}
   */
  #pointers = []

  /**
   * @type {number[]}
   */
  #unused = []

  get size () {
    return this.#pointers.length
  }

  get available () {
    return this.#unused.length
  }

  /**
   * Track an object, return its "pointer".
   *
   * @param {object} obj
   * @returns {number}
   */
  add (obj) {
    let index = this.#unused.pop()
    if (index == null) {
      index = this.#pointers.push(obj) - 1
    } else {
      this.#pointers[index] = obj
    }
    return index
  }

  /**
   * Remove a given object from tracking.  Will reuse the "pointer" later if
   * possible.
   *
   * @param {number} index
   */
  remove (index) {
    if (this.#unused.indexOf(index) !== -1) {
      throw new Error('Already deleted')
    }
    delete this.#pointers[index]
    this.#unused.push(index)
  }

  /**
   * Dereference the "pointer", returning the object associated with this index.
   *
   * @param {number} index
   * @returns {object|undefined} The object, if it exists, otherwise undefined.
   */
  get (index) {
    return this.#pointers[index]
  }

  /**
   * Call a function on the object stored at the given index. Set up for
   * bind() to work better.
   *
   * @param {string} funcName The name of the function on *index
   * @param {string} event The first parameter of the function call.  Usually
   *   an event name.
   * @param {number} index Index of the object to call through.
   * @param  {...any} args Other function call arguments
   * @returns {any} Whatever the function returns.
   */
  call (funcName, event, index, ...args) {
    const o = this.get(index)
    if (!o) {
      throw new TypeError(`Invalid object index: ${index}`)
    }
    // @ts-ignore
    const func = o[funcName]
    const ftyp = typeof func
    if (ftyp !== 'function') {
      throw new TypeError(`Invalid object for function: "${funcName}" ${ftyp} ${func}`)
    }
    return func.call(o, event, ...args)
  }

  /**
   * Bind a function call on a particular function name and event name.
   *
   * @param {string} funcName The name of the function on *index
   * @param {string} event The first parameter of the function call.  Usually
   *   an event name.
   * @returns {function}
   */
  bind (funcName, event) {
    // Bind to this, so that this.get works
    return this.call.bind(this, funcName, event)
  }
}
