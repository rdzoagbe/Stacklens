import js from '@eslint/js';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import security from 'eslint-plugin-security';

export default [
  { ignores: ['dist/**', 'functions/**', 'node_modules/**'] },

  js.configs.recommended,
  security.configs.recommended,

  {
    files: ['**/*.{js,jsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      security,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // Browser globals
        window: 'readonly', document: 'readonly', navigator: 'readonly',
        location: 'readonly', history: 'readonly',
        localStorage: 'readonly', sessionStorage: 'readonly',
        console: 'readonly', alert: 'readonly', confirm: 'readonly', prompt: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly',
        setInterval: 'readonly', clearInterval: 'readonly',
        requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly',
        fetch: 'readonly', URL: 'readonly', URLSearchParams: 'readonly',
        atob: 'readonly', btoa: 'readonly', structuredClone: 'readonly',
        MutationObserver: 'readonly', ResizeObserver: 'readonly',
        IntersectionObserver: 'readonly', AbortController: 'readonly',
        FormData: 'readonly', File: 'readonly', FileReader: 'readonly', Blob: 'readonly',
        crypto: 'readonly', performance: 'readonly', EventSource: 'readonly',
        TextEncoder: 'readonly', TextDecoder: 'readonly',
        // Third-party globals
        gtag: 'readonly',
        // Node globals (used in vite.config, etc.)
        process: 'readonly', module: 'readonly', require: 'readonly',
        __dirname: 'readonly', __filename: 'readonly',
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: '19' } },
    rules: {
      // React
      ...reactPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // Security — upgrade critical ones to errors
      'security/detect-eval-with-expression': 'error',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-object-injection': 'off', // too noisy for bracket notation in React apps
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-non-literal-regexp': 'warn',

      // General correctness
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
    },
  },
];
