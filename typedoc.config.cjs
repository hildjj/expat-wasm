'use strict';

module.exports = {
  entryPoints: 'lib/index.js',
  out: 'docs',
  cleanOutputDir: true,
  sidebarLinks: {
    GitHub: 'https://github.com/hildjj/expat-wasm/',
    Documentation: 'https://hildjj.github.io/expat-wasm/',
    Demo: 'webpack-demo/index.html',
    expat: 'https://github.com/libexpat/libexpat',
  },
  navigation: {
    includeCategories: false,
    includeGroups: false,
  },
  categorizeByGroup: false,
  sort: ['static-first', 'alphabetical'],
};
