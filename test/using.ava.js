import {ParseStream} from './stream.js';
import XmlParser from '../lib/index.js';
import test from 'ava';

test('using', t => {
  let destroy = false;
  let valid = null;
  {
    using p = new XmlParser();
    const ps = new ParseStream(p);
    p.on('destroy', (v) => {
      destroy = true;
      valid = v;
    });
    p.parse(`<foo/>`);
  }
  t.true(destroy);
  t.true(valid);
});
