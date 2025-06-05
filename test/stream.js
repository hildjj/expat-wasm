/** @typedef {[string, ...any]} Event */

export class ParseStream {
  /**
   *
   * @param {XmlParser} parser
   */
  constructor(parser) {
    /**
     * @type {Event[]}
     */
    this.events = [];
    this.parser = parser;
    parser.on('*', /** @param {string} event */ (event, ...args) => {
      this.events.push([event, ...args]);
    });
  }

  read() {
    return this.events.shift();
  }
}
