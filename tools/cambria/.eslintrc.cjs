// This is a workaround for https://github.com/eslint/eslint/issues/3458
require('@rushstack/eslint-config/patch/modern-module-resolution');

module.exports = {
  extends: [
    '@rushstack/eslint-config/profile/node-trusted-tool',
    'plugin:import/recommended',
    'plugin:import/typescript'
  ],
  parserOptions: { tsconfigRootDir: __dirname },
  settings: {
    'import/resolver': {
      typescript: true,
      node: true
    },
    'import/ignore': ['node_modules/json-schema-typed/draft-07\\.js$']
  },
  plugins: ['json-files'],
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn', // or "error"
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }
    ],
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true
        }
      }
    ],
    'json-files/sort-package-json': 'error'
  }
};
