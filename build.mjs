/**
 * Build the two faces of the bundle.
 *
 * Host: plain ESM for Node. DSH-provided packages stay external.
 * Client: one CJS bundle wrapped in the DSH module-loader handshake. React and
 * the JSX runtime are supplied by the page, never bundled.
 */
import { build } from 'esbuild'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'))
const NAME = pkg.name

mkdirSync(resolve(ROOT, 'lib'), { recursive: true })

const hostExternal = [
  '@deepseek-ai/cordis',
  '@deepseek-ai/schemastery',
  '@deepseek-ai/dsh-*',
]

const clientExternal = [
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-*',
  'react',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
]

await build({
  entryPoints: [resolve(ROOT, 'src/index.ts')],
  outfile: resolve(ROOT, 'lib/index.js'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['node24'],
  sourcemap: true,
  external: hostExternal,
  logLevel: 'info',
})

await build({
  entryPoints: [resolve(ROOT, 'src/client/index.ts')],
  outfile: resolve(ROOT, 'lib/client.js'),
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['es2022'],
  sourcemap: true,
  jsx: 'automatic',
  external: clientExternal,
  banner: {
    js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(NAME)}, factory: (require) => { var module = { exports: {} }; var exports = module.exports;`,
  },
  footer: {
    js: 'return module.exports; } });',
  },
  logLevel: 'info',
})

console.log(`built ${NAME} → lib/index.js, lib/client.js`)
