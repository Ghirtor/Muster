import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

/**
 * Two kinds of code, two projects: the dashboard runs in jsdom, the supervisor in node, compiled by
 * SWC so its tests see the decorator metadata Nest injects by.
 */
export default defineConfig({
  test: {
    globals: true,
    ...(process.env.CI === 'true' ? {} : { maxWorkers: '50%' }),
    reporters: ['default', ['junit', { outputFile: 'junit.xml' }]],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov', 'cobertura'],
      include: ['src/**/*.{ts,tsx,js,jsx}'],
      exclude: [
        '**/*.d.ts',
        '**/*.{test,spec}.{ts,tsx,js,jsx}',
        '**/__mocks__/**',
        'src/server/main.ts',
        'src/server/cli.ts',
        'src/web/main.tsx'
      ]
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'web',
          environment: 'jsdom',
          include: ['src/web/**/*.test.{ts,tsx}'],
          setupFiles: ['src/web/__mocks__/vitest.setup.ts']
        }
      },
      {
        extends: true,
        plugins: [swc.vite({ tsconfigFile: 'src/server/tsconfig.json' })],
        test: {
          name: 'server',
          environment: 'node',
          include: ['src/server/**/*.test.ts']
        }
      }
    ]
  }
})
