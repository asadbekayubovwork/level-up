# MC-01: Monorepo asoslari

## Nima qildim

pnpm workspaces + Turborepo asosida monorepo qurdim: 2 ta app (`web`, `admin`) va 1 ta shared paket (`@level-up/ui`). Ichki dependency `workspace:*` orqali symlink bilan bog'langan, shared paket TypeScript type'lari app'larda to'g'ridan-to'g'ri ishlaydi (JIT package pattern — build step yo'q). Yangi app qo'shish `pnpm new:app <name>` bilan **~10 soniya**, generator o'zi test bilan qoplangan.

## Kod qayerda

| Fayl | Nima uchun |
|---|---|
| [pnpm-workspace.yaml](../../../pnpm-workspace.yaml) | workspace glob'lari + `onlyBuiltDependencies` |
| [turbo.json](../../../turbo.json) | task graph (`build` → `^build`), cache, `dev` persistent |
| [packages/ui/turbo.json](../../../packages/ui/turbo.json) | typecheck-only paket uchun `outputs: []` override |
| [package.json](../../../package.json) | root scriptlar: `dev` / `build` / `typecheck` / `new:app` / `test:scripts` |
| [tsconfig.base.json](../../../tsconfig.base.json) | barcha paketlar uchun umumiy TS config |
| [scripts/new-app.mjs](../../../scripts/new-app.mjs) | app generator — 0 dependency, faqat node stdlib |
| [scripts/new-app.test.mjs](../../../scripts/new-app.test.mjs) | `node:test` — oxirgi test yaratilgan app'ni haqiqatan build qiladi |
| [docs/monorepo.md](../../../docs/monorepo.md) | workspace pattern'lari, qarorlar, tuzoqlar |
| [packages/ui/](../../../packages/ui/) | UI qatlami — `@webaseltd/ui` re-export + theme/token'lar |
| [apps/web/](../../../apps/web/) | 1-app, port 5173 |
| [apps/admin/](../../../apps/admin/) | 2-app, port 5174 |

## Kriteriylar

**🟢 Green**
- [x] pnpm workspace 2+ app/paket bilan sozlangan — `apps/web`, `apps/admin`, `packages/ui`
- [x] Ichki dependency'lar `workspace:*` protokoli bilan — `apps/*/package.json` da `"@level-up/ui": "workspace:*"`
- [x] `pnpm build` barcha paketlarda muvaffaqiyatli

**🟡 Yellow**
- [x] Turborepo integratsiya — `turbo.json`, `build` → `dependsOn: ["^build"]`, cache: **6.2s → 21ms (FULL TURBO)**
- [x] Shared paketlar to'g'ri typed — `ButtonVariant` union app'da IntelliSense va `vue-tsc` bilan tekshiriladi
- [x] Yangi loyiha setup < 30 daqiqa — o'lchandi: **10.2s** (`new:app` + `install` + `build`)

**🔵 Blue**
- [x] Monorepo template sifatida xizmat qiladi — `pnpm new:app <name>`, 0 dependency, test bilan qoplangan
- [x] Workspace pattern'lar hujjatlashtirilgan — [docs/monorepo.md](../../../docs/monorepo.md)
- [ ] Jamoa yangi loyihalarni mustaqil qo'shadi — *repo tayyor, lekin buni haqiqiy jamoa ishlatishi tasdiqlashi kerak (mentorga: 1-2 hamkasb `pnpm new:app` bilan app qo'shsa, PR link'i shu yerga qo'yiladi)*

## Verification (mentor uchun)

```bash
git clone <repo> && cd level-up
pnpm install
pnpm build          # 3 ta paket ham o'tadi
pnpm dev            # web :5173, admin :5174 — ikkalasi ham @level-up/ui dan render qiladi
```

**1. Ichki dependency haqiqatan link:**

```bash
pnpm ls --filter @level-up/web --depth 0
# → @level-up/ui@link:../../packages/ui
```

**2. Cross-package type safety ishlaydi:**
`apps/web/src/router.ts` da `permissions: ['role.manage']` → `['role.manag']` qiling:

```
src/router.ts(20,49): error TS2820: Type '"role.manag"' is not assignable to type 'Permission'.
  Did you mean '"role.manage"'?
```

**3. Turbo cache ishlaydi:**

```bash
rm -rf .turbo apps/*/dist && pnpm build   # Time: 6.238s, Cached: 0/3
pnpm build                                 # Time: 21ms >>> FULL TURBO, Cached: 3/3
```

**4. Template generator ishlaydi:**

```bash
pnpm test:scripts    # 3/3 pass — oxirgisi app yaratib, uni build qilib, keyin o'chiradi
pnpm new:app reports && pnpm install && pnpm --filter @level-up/reports dev
```

## Oxirgi build natijasi

```
Tasks:    3 successful, 3 total
Cached:   0 cached, 3 total          → keyingi run: 3 cached, 21ms FULL TURBO
Time:     6.238s

apps/admin  ✓ 19 modules → 62.81 kB (gzip 25.18 kB)
apps/web    ✓ 19 modules → 63.33 kB (gzip 25.31 kB)
packages/ui vue-tsc --noEmit ✓
```

```
# pnpm test:scripts
ok 1 - nextPort mavjud portlardan keyingisini oladi
ok 2 - nom validatsiya qilinadi
ok 3 - yangi app to'g'ri nom, port va sarlavha bilan yaratiladi
# pass 3  # fail 0
```

Versiyalar: Node 20.20.2 · pnpm 10.33.0 · Turborepo 2.10.7 · Vite 7.3.6 · Vue 3.5.40 · TypeScript 5.9.3

## Nimani o'rgandim

- pnpm 10 postinstall skriptlarini default'da bloklaydi — `esbuild` uchun `pnpm-workspace.yaml` ga `onlyBuiltDependencies` qo'shish kerak bo'ldi.
- Shared paketni **build qilmasdan** source (`main: ./src/index.ts`) sifatida export qilish mumkin — Vite symlink'ni real path'ga resolve qilib, `.vue` fayllarni oddiy source kabi transform qiladi. Bitta build step kamayadi. Narxi: paketni npm'ga publish qilib bo'lmaydi.
- Turbo typecheck-only paketda "no output files" deb ogohlantiradi — per-package `turbo.json` da `outputs: []` bilan yopiladi.
- Generator uchun `plop`/`hygen` kerak emas: `node:fs` ning `cpSync` + `filter` i 40 qatorda hal qiladi, `node:test` esa uni tekshiradi. Bitta dependency ham qo'shilmadi.
