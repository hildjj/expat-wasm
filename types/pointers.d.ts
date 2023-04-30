/**
 * Maintain a bi-directional mapping between objects and small integers, which
 * can be use as fake "pointers" to pass back and forth to WASM.
 * @private
 */
export class Pointers {
    get size(): number;
    get available(): number;
    /**
     * Track an object, return its "pointer".
     *
     * @param {object} obj
     * @returns {number}
     */
    add(obj: object): number;
    /**
     * Remove a given object from tracking.  Will reuse the "pointer" later if
     * possible.
     *
     * @param {number} index
     */
    remove(index: number): void;
    /**
     * Dereference the "pointer", returning the object associated with this index.
     *
     * @param {number} index
     * @returns {object|undefined} The object, if it exists, otherwise undefined.
     */
    get(index: number): object | undefined;
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
    call(funcName: string, event: string, index: number, ...args: any[]): any;
    /**
     * Bind a function call on a particular function name and event name.
     *
     * @param {string} funcName The name of the function on *index
     * @param {string} event The first parameter of the function call.  Usually
     *   an event name.
     * @returns {function}
     */
    bind(funcName: string, event: string): Function;
    #private;
}
