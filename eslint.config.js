import es6 from '@cto.af/eslint-config/es6.js';
import globals from '@cto.af/eslint-config/globals.js';

export default [
  {
    ignores: [
      'lib/expat.js',
      'webpack-demo/dist/**',
      '**/*.d.ts',
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
    },
  },
  {
    files: ['webpack-demo/**'],
    languageOptions: {
      globals: globals.browser,
    },
  },
];
