import eslintReact from '@eslint-react/eslint-plugin'
import js from '@eslint/js'
import { defineConfig } from 'oxlint'
import tseslint from 'typescript-eslint'

type Rules = Record<string, unknown>

// oxlint has no presets of its own for these, so the rule lists still come from the ESLint
// packages; nothing here runs ESLint itself

// typescript-eslint extension rules oxlint implements in its core rule, which already reads TS
const CORE_EXTENSIONS = new Set([
  'no-array-constructor',
  'no-empty-function',
  'no-unused-expressions',
  'no-unused-vars',
  'no-useless-constructor'
])
// in the presets but not in oxlint: strict mode, which every ES module runs in, forbids both
const UNSUPPORTED = new Set(['no-dupe-args', 'no-octal'])
// need type information, which oxlint does not give JS plugins: the rule throws on every file
const TYPE_AWARE_JS = new Set([
  '@eslint-react/no-leaked-conditional-rendering',
  '@eslint-react/no-unused-props'
])

const isOff = (value: unknown): boolean => {
  const severity: unknown = Array.isArray(value) ? value[0] : value
  return severity === 'off' || severity === 0
}

// ESLint rule names to oxlint ones; a core rule typescript-eslint extends is dropped in favour of
// the extension, which is the one the presets switch on. A rule the presets leave off is dropped
// too: nothing is on by default, and oxlint rejects off rules it does not know (no-new-symbol)
const dropped = (name: string, value: unknown): boolean =>
  isOff(value) || UNSUPPORTED.has(name) || TYPE_AWARE_JS.has(name) || CORE_EXTENSIONS.has(name)

const toOxlint = (rules: Rules): Rules =>
  Object.fromEntries(
    Object.entries(rules).flatMap(([name, value]) => {
      if (dropped(name, value)) return []
      const typescriptRule = name.replace(/^@typescript-eslint\//, '')
      if (typescriptRule === name) return [[name, value]]
      const oxlintName = CORE_EXTENSIONS.has(typescriptRule)
        ? typescriptRule
        : `typescript/${typescriptRule}`
      return [[oxlintName, value]]
    })
  )

// typescript-eslint types a preset's rules as a bare `object` so it fits every ESLint version;
// they are a rule record all the same
const rulesOf = (configs: { rules?: object }[]): Rules =>
  toOxlint(configs.reduce<Rules>((merged, { rules }) => ({ ...merged, ...(rules as Rules) }), {}))

const reactPreset = eslintReact.configs['strict-type-checked']

export default defineConfig({
  plugins: [],
  jsPlugins: [
    '@eslint-react/eslint-plugin',
    'eslint-plugin-react-refresh',
    './oxlint-plugins/house.js'
  ],
  categories: { correctness: 'off' },
  options: { typeAware: true },
  settings: reactPreset.settings,
  env: { builtin: true },
  ignorePatterns: [
    'node_modules/',
    '.npm/',
    'out/',
    'build/',
    'dist/',
    'public/',
    'tmp/',
    '.vite/',
    'design/',
    'reference/',
    'coverage/',
    'src-tauri/target/',
    'src-tauri/gen/'
  ],
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      plugins: ['typescript'],
      rules: {
        ...rulesOf([
          reactPreset,
          js.configs.recommended,
          ...tseslint.configs.strictTypeChecked,
          ...tseslint.configs.stylisticTypeChecked
        ]),
        // the one preset rule eslint-config-prettier switched off: it fights the formatter's line breaks
        'no-unexpected-multiline': 'off',
        // both conflict with react compiler
        '@eslint-react/no-unstable-context-value': 'off',
        '@eslint-react/no-unstable-default-props': 'off',
        'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
        'typescript/restrict-template-expressions': 'off',
        'no-unused-vars': 'error',
        'prefer-const': 'error',
        'typescript/return-await': ['error', 'always'],
        'typescript/promise-function-async': 'error',
        'typescript/no-deprecated': 'warn',
        'typescript/no-non-null-assertion': 'off',
        eqeqeq: 'error',
        'typescript/no-unnecessary-condition': ['error', { allowConstantLoopConditions: true }],
        'house/module-shape': 'error',
        'house/colour-tokens': 'error',
        'no-inline-comments': 'error'
      }
    },
    // the dashboard talks to the supervisor over HTTP only: it must never pull in node code
    {
      files: ['src/web/**/*.ts', 'src/web/**/*.tsx'],
      plugins: ['typescript'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['**/server/**', 'node:*'],
                message:
                  'The web app reaches the supervisor through its HTTP/WebSocket API, never by importing server code.'
              }
            ]
          }
        ]
      }
    },
    // a component or a hook is what its file is for: it is default exported, and nothing else is
    {
      files: ['src/**/[A-Z]*.tsx', 'src/**/use[A-Z]*.ts', 'src/**/use[A-Z]*.tsx'],
      plugins: ['import'],
      rules: { 'import/no-named-export': 'error' }
    },
    {
      files: ['**/*.test.*', '**/*.utils.*', '**/*.context.*', '**/*.types.ts'],
      plugins: ['import'],
      rules: { 'import/no-named-export': 'off' }
    },
    // colour data, not theme: the token sheets themselves, the server (which paints nothing), and
    // tests that assert the exact values the app paints
    {
      files: ['src/web/styles/**', 'src/server/**', '**/*.test.ts', '**/*.test.tsx'],
      rules: { 'house/colour-tokens': 'off' }
    }
  ]
})
