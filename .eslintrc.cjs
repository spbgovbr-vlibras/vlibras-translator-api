module.exports = {
  env: {
    es2022: true,
    node: true,
  },
  extends: [
    'airbnb-base',
  ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js'],
      },
    },
  },
  rules: {
    'import/extensions': 'off',
    'no-underscore-dangle': [
      'error',
      {
        allow: [
          '_id',
        ],
      },
    ],
    'no-console': [
      'error',
      {
        allow: [
          'error',
        ],
      },
    ],
    'no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
      },
    ],
  },
  overrides: [
    {
      files: ['src/test/**/*.js'],
      env: {
        jest: true,
      },
    },
  ],
};
