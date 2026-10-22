const runningInCi = process.env.CI === 'true'

const transformOf = (useESM, tsconfig) => ({
  '^.+\\.[jt]sx?$': ['ts-jest', { useESM, tsconfig, diagnostics: false }]
})

const shared = {
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' }
}

export default {
  ...(runningInCi ? {} : { maxWorkers: '50%' }),
  reporters: ['default', ['jest-junit', { outputDirectory: '<rootDir>', outputName: 'junit.xml' }]],
  coverageReporters: ['text', 'text-summary', 'lcov', 'cobertura'],
  collectCoverageFrom: [
    '<rootDir>/src/**/*.{ts,tsx,js,jsx}',
    '!**/*.d.ts',
    '!**/*.{test,spec}.{ts,tsx,js,jsx}',
    '!**/__mocks__/**',
    '!<rootDir>/src/server/main.ts',
    '!<rootDir>/src/server/cli.ts',
    '!<rootDir>/src/web/main.tsx'
  ],
  // Two kinds of code, two environments: the dashboard runs in jsdom, the supervisor in node.
  projects: [
    {
      ...shared,
      displayName: 'web',
      // CommonJS, so that jest.mock is hoisted above the imports it replaces
      preset: 'ts-jest',
      transform: transformOf(false, '<rootDir>/src/web/tsconfig.json'),
      testEnvironment: 'jsdom',
      roots: ['<rootDir>/src/web'],
      setupFilesAfterEnv: ['<rootDir>/src/web/__mocks__/jest.setup.ts'],
      moduleNameMapper: {
        ...shared.moduleNameMapper,
        '\\.css$': '<rootDir>/src/web/__mocks__/styleMock.js',
        '\\.(svg|png|jpg|jpeg|gif|ico|webp)$': '<rootDir>/src/web/__mocks__/fileMock.js'
      }
    },
    {
      ...shared,
      displayName: 'server',
      // native ESM (node --experimental-vm-modules): NestJS ships as ES modules only
      preset: 'ts-jest/presets/default-esm',
      extensionsToTreatAsEsm: ['.ts'],
      transform: transformOf(true, '<rootDir>/src/server/tsconfig.json'),
      testEnvironment: 'node',
      roots: ['<rootDir>/src/server']
    }
  ]
}
