import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
    {
        ignores: ['dist/**'],
    },
    {
        files: ['**/*.{js,jsx}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.es2022,
            },
            parserOptions: {
                ecmaFeatures: { jsx: true },
            },
        },
        plugins: {
            react,
            'react-hooks': reactHooks,
        },
        rules: {
            'no-undef': 'error',
            'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'react/jsx-uses-react': 'error',
            'react/jsx-uses-vars': 'error',
            ...reactHooks.configs.recommended.rules,
        },
    },
    {
        files: ['*.config.js'],
        languageOptions: {
            globals: globals.node,
        },
    },
];
