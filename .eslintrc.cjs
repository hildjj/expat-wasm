module.exports = {
  root: true,
  extends: '@cto.af/eslint-config/modules',
  ignorePatterns: [
    'docs/',
    'coverage/',
    'lib/expat.js',
  ],
  env: {
    es2020: true,
  },
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2022,
  },
  rules: {
    'new-cap': ['error', {
      newIsCap: true,
      capIsNew: false,
      properties: true,
    }],
  },
};
