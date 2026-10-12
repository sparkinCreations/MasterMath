// Reads the global (`/*`) block of public/_headers, Netlify's response-header
// file, into a { name: value } map. vite.config.js serves the result from
// `vite preview` so the smoke test runs under the production policy, and
// tests/securityHeaders.test.js checks it.
import fs from 'fs'

export function readGlobalHeaders(file) {
  const headers = {}
  let inGlobal = false
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue
    if (!/^\s/.test(line)) { inGlobal = line.trim() === '/*'; continue }
    if (!inGlobal) continue
    const colon = line.indexOf(':')
    headers[line.slice(0, colon).trim()] = line.slice(colon + 1).trim()
  }
  return headers
}
