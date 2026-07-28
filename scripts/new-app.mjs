#!/usr/bin/env node
// Monorepo'ga yangi app qo'shadi: apps/web ni template sifatida nusxalaydi,
// nomni va portni almashtiradi. Dependency yo'q — faqat node stdlib.
//
// Ishlatish:  pnpm new:app <name>
import { cpSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const TEMPLATE = 'web'
const APPS = 'apps'
const SCOPE = '@level-up'

export function nextPort(apps) {
  // ponytail: dev skriptidan portni regex bilan olamiz — CLI parser'i shu bitta flag uchun ortiqcha
  const ports = apps.map((s) => Number(/--port (\d+)/.exec(s)?.[1])).filter(Number.isInteger)
  return ports.length ? Math.max(...ports) + 1 : 5173
}

export function createApp(name, root = process.cwd()) {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    throw new Error(`Nom faqat kichik harf/raqam/defis bo'lsin: "${name}"`)
  }
  const dest = join(root, APPS, name)
  if (existsSync(dest)) throw new Error(`${APPS}/${name} allaqachon mavjud`)

  const devScripts = readdirSync(join(root, APPS)).map(
    (a) => JSON.parse(readFileSync(join(root, APPS, a, 'package.json'), 'utf8')).scripts?.dev ?? '',
  )
  const port = nextPort(devScripts)

  cpSync(join(root, APPS, TEMPLATE), dest, {
    recursive: true,
    filter: (src) => !/node_modules|[/\\]dist([/\\]|$)/.test(src),
  })

  const pkgPath = join(dest, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  pkg.name = `${SCOPE}/${name}`
  for (const key of ['dev', 'preview']) {
    pkg.scripts[key] = pkg.scripts[key].replace(/--port \d+/, `--port ${port}`)
  }
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

  // ponytail: faqat <title> — App.vue markup'iga tegmaymiz, aks holda template
  // har o'zgarganda generator sinadi. Qolgan nomlarni foydalanuvchi o'zi yozadi.
  const title = name[0].toUpperCase() + name.slice(1)
  const html = join(dest, 'index.html')
  writeFileSync(
    html,
    readFileSync(html, 'utf8').replace(/<title>.*<\/title>/, `<title>Level Up — ${title}</title>`),
  )

  return { name: pkg.name, dir: `${APPS}/${name}`, port }
}

if (import.meta.filename === process.argv[1]) {
  const name = process.argv[2]
  if (!name) {
    console.error('Ishlatish: pnpm new:app <name>')
    process.exit(1)
  }
  const app = createApp(name)
  console.log(`✓ ${app.name} → ${app.dir} (port ${app.port})

Keyingi qadam:
  pnpm install
  pnpm --filter ${app.name} dev`)
}
