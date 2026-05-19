#!/usr/bin/env node
/**
 * Runs `npm audit --audit-level=high` and exits non-zero only when
 * high/critical vulnerabilities are found.  Network errors (e.g. no
 * connectivity to registry.npmjs.org) are treated as non-fatal so that
 * offline or corporate-proxy commits are not blocked.
 */
import { execSync } from 'node:child_process'

try {
  const result = execSync('npm audit --audit-level=high', { stdio: 'pipe' })
  process.stdout.write(result)
} catch (err) {
  if (err.stdout) process.stdout.write(err.stdout)
  if (err.stderr) process.stderr.write(err.stderr)
  const output = String(err.stdout ?? '') + String(err.stderr ?? '')
  const isNetworkError =
    output.includes('audit endpoint returned an error') ||
    output.includes('ENOTFOUND') ||
    output.includes('ETIMEDOUT') ||
    output.includes('ECONNREFUSED') ||
    output.includes('network request failed')

  if (isNetworkError) {
    console.warn(
      '\n⚠️  npm audit skipped: could not reach the npm registry (network unavailable).\n'
    )
    process.exit(0)
  }

  // Real vulnerabilities found — let the commit fail
  process.exit(err.status ?? 1)
}
