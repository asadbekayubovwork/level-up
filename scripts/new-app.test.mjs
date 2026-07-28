import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { createApp, nextPort } from './new-app.mjs'

const ROOT = join(import.meta.dirname, '..')

test('nextPort mavjud portlardan keyingisini oladi', () => {
  assert.equal(nextPort(['vite --port 5173', 'vite --port 5174']), 5175)
  assert.equal(nextPort([]), 5173)
})

test('nom validatsiya qilinadi', () => {
  assert.throws(() => createApp('Bad Name', ROOT), /kichik harf/)
  assert.throws(() => createApp('web', ROOT), /allaqachon mavjud/)
})

test('yangi app to\'g\'ri nom, port va sarlavha bilan yaratiladi', (t) => {
  t.after(() => rmSync(join(ROOT, 'apps/tmp-smoke'), { recursive: true, force: true }))

  const app = createApp('tmp-smoke', ROOT)
  assert.equal(app.name, '@level-up/tmp-smoke')
  assert.ok(app.port > 5174)

  const pkg = JSON.parse(readFileSync(join(ROOT, app.dir, 'package.json'), 'utf8'))
  assert.equal(pkg.name, '@level-up/tmp-smoke')
  assert.equal(pkg.scripts.dev, `vite --port ${app.port}`)
  assert.equal(pkg.dependencies['@level-up/ui'], 'workspace:*')

  assert.match(readFileSync(join(ROOT, app.dir, 'index.html'), 'utf8'), /<title>Level Up — Tmp-smoke<\/title>/)

  // template'dan dist/ va node_modules ko'chirilmagan
  assert.throws(() => readFileSync(join(ROOT, app.dir, 'dist/index.html')))

  // eng muhim dalil: yangi app haqiqatan build bo'ladi
  execFileSync('pnpm', ['install', '--silent'], { cwd: ROOT })
  execFileSync('pnpm', ['--filter', app.name, 'build'], { cwd: ROOT, stdio: 'pipe' })
})
