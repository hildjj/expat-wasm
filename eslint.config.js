import es6 from '@cto.af/eslint-config/es6.js';
import globals from '@cto.af/eslint-config/globals.js';

export default [
  {
    ignores: [
      'lib/expat.js',
      'test/using.ava.js',
      'webpack-demo/dist/**',
    ],
  },
  ...es6,
  {
    files: ['**/*.js'],
    rules: {
      'new-cap': ['error', {
        newIsCap: true,
        capIsNew: false,
        properties: true,
      }],
      'n/prefer-node-protocol': 'off',
      'n/no-top-level-await': 'off',
    },
  },
  {
    files: ['webpack-demo/**'],
    languageOptions: {
      globals: globals.browser,
    },
  },
];
