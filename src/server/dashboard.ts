import fs from 'node:fs'
import type http from 'node:http'
import path from 'node:path'

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
}

/**
 * The file under `root` that answers `urlPath`, or null when the path escapes `root`. A path that
 * names no file is a dashboard route, so it gets `index.html` and the client router takes over.
 */
export const resolveAsset = (root: string, urlPath: string): string | null => {
  const pathname = decodeURIComponent(urlPath.split('?')[0] ?? '/')
  const file = path.resolve(root, `.${pathname}`)
  if (file !== root && !file.startsWith(root + path.sep)) return null
  if (fs.statSync(file, { throwIfNoEntry: false })?.isFile() === true) return file
  return path.join(root, 'index.html')
}

/**
 * Serves the built dashboard from `root`. The desktop app loads it from the supervisor rather than
 * from Tauri's own protocol, so the page and `/api` share one origin, as they do behind Vite's proxy.
 */
export const serveDashboard = (
  root: string,
  request: http.IncomingMessage,
  response: http.ServerResponse
): void => {
  const file = resolveAsset(path.resolve(root), request.url ?? '/')
  if (file === null) {
    response.writeHead(403).end()
    return
  }
  fs.readFile(file, (error, body) => {
    if (error !== null) {
      response.writeHead(404).end()
      return
    }
    response.writeHead(200, {
      'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream'
    })
    response.end(body)
  })
}
