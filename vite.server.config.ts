import { type PluginOption, defineConfig } from 'vite'

/**
 * The supervisor and the CLI, bundled with every dependency: the desktop app ships `dist/server`
 * without `node_modules`. What stays out is what Nest and ws only try to load, and do without; ws
 * is told to skip its native add-ons outright, as their bundled stand-ins are empty.
 */
const OPTIONAL = [
  '@nestjs/microservices',
  '@nestjs/platform-socket.io',
  '@fastify/static',
  'class-transformer',
  'class-validator',
  'bufferutil',
  'utf-8-validate'
]

const WS_REQUIRE = "createRequire(import.meta.url)('ws')"

/**
 * Nest's ws adapter loads `ws` through `createRequire`, which a bundler cannot follow, so the bundle
 * would look for a `node_modules/ws` it does not ship. This makes that load a static import.
 */
const bundleWs = (): PluginOption => ({
  name: 'bundle-ws',
  transform(code, id) {
    if (!id.replaceAll('\\', '/').includes('@nestjs/platform-ws/') || !code.includes(WS_REQUIRE)) {
      return null
    }
    return {
      code: `import * as bundledWs from 'ws'\n${code.replace(WS_REQUIRE, 'bundledWs')}`,
      map: null
    }
  }
})

export default defineConfig({
  plugins: [bundleWs()],
  define: {
    'process.env.WS_NO_BUFFER_UTIL': '"1"',
    'process.env.WS_NO_UTF_8_VALIDATE': '"1"'
  },
  ssr: { noExternal: true, external: OPTIONAL },
  build: {
    ssr: true,
    target: 'node22',
    outDir: 'dist/server',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: { main: 'src/server/main.ts', cli: 'src/server/cli.ts' },
      output: { entryFileNames: '[name].js' }
    }
  }
})
