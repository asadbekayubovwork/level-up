# Monorepo pattern'lari

Bu repo — pnpm workspaces + Turborepo. Quyida qaror va konvensiyalar: **nima uchun shunday**, va yangi odam nimani qanday qilishi kerak.

## Tuzilish

```
apps/       — deploy qilinadigan ilovalar. Bir-birini import QILMAYDI.
packages/   — shared kod. app'lar import qiladi, o'zaro ham import qilishi mumkin.
scripts/    — repo tooling (node stdlib, dependency yo'q)
tasks/      — Level Up task hujjatlari (kod emas, dalil)
```

**Qoida:** `apps/*` orasida import bo'lmasin. Ikki app'ga kerak bo'lgan narsa — `packages/*` ga chiqadi.

---

## Yangi app qo'shish

```bash
pnpm new:app reports
pnpm install
pnpm --filter @level-up/reports dev
```

`scripts/new-app.mjs` `apps/web` ni template sifatida nusxalaydi, `package.json` nomini `@level-up/<name>` ga, dev/preview portini bo'sh keyingi portga (mavjudlarning maksimumi + 1) o'zgartiradi, `index.html` va `App.vue` sarlavhalarini yangilaydi. `dist/` va `node_modules/` ko'chirilmaydi.

O'lchangan vaqt: **~10 soniya** (generatsiya + install + build). Qo'lda qilinsa ~20 daqiqa.

Generator o'zi test bilan qoplangan: `pnpm test:scripts` — oxirgi test yangi app yaratib, uni haqiqatan **build qiladi**, keyin o'chiradi.

## Yangi shared paket qo'shish

`packages/<name>/package.json`:

```json
{
  "name": "@level-up/<name>",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "build": "vue-tsc --noEmit", "typecheck": "vue-tsc --noEmit" },
  "peerDependencies": { "vue": "^3.5.0" }
}
```

`tsconfig.json` — faqat `{ "extends": "../../tsconfig.base.json", "include": [...] }`.

Agar paket build artefakt chiqarmasa (typecheck-only), yoniga `turbo.json` qo'ying:
`{ "extends": ["//"], "tasks": { "build": { "outputs": [] } } }` — aks holda turbo "no output files" deb ogohlantiradi.

---

## Asosiy qarorlar

### 1. Shared paketlar build QILINMAYDI (JIT package)

`@level-up/ui` ning `main` i `./src/index.ts` — kompilyatsiya qilingan `dist/` emas.

**Nega:** Vite symlink'ni real path'ga resolve qiladi (`preserveSymlinks: false` — default), shuning uchun `packages/ui/src/*.vue` app uchun oddiy source fayl. Natijada: build step yo'q, watch-mode yo'q, stale `dist/` muammosi yo'q, HMR paket kodiga ham ishlaydi.

**Narxi:** paketni tashqariga (npm) publish qilib bo'lmaydi va consumer'i albatta Vite/bundler bo'lishi shart. Publish kerak bo'lganda `vite build --lib` + `exports.publishConfig` qo'shiladi — hozir kerak emas.

### 2. Ichki dependency'lar `workspace:*`

```json
"dependencies": { "@level-up/ui": "workspace:*" }
```

`*` — versiya tekshiruvisiz har doim local paketga link. Tekshirish:

```bash
pnpm ls --filter @level-up/web --depth 0
# → @level-up/ui@link:../../packages/ui
```

### 3. Vue — `peerDependencies`, `dependencies` emas

Shared paketlarda Vue `peerDependencies` da. Aks holda paket o'z Vue nusxasini olib kelib, bir sahifada 2 ta Vue runtime paydo bo'ladi (`provide/inject` va reaktivlik sindiriladi).

### 4. TypeScript konfig — bitta base

Barcha paket `tsconfig.base.json` dan `extends` qiladi. Har bir tsconfig'da faqat `include` va o'ziga xos `types` qoladi.

Cross-package type safety `vue-tsc` orqali avtomatik ishlaydi — `packages/ui` da prop turini o'zgartirsangiz, uni noto'g'ri ishlatgan app **build paytida** yiqiladi.

### 5. Turborepo — task graph va cache

`turbo.json`:
- `build` → `dependsOn: ["^build"]` — paket app'dan oldin quriladi
- `dev` → `cache: false, persistent: true`

Cache samarasi: birinchi build ~6.2s, keyingisi **21ms (FULL TURBO)**.

Cache'ni tozalash: `rm -rf .turbo apps/*/dist`.

---

## Ma'lum tuzoqlar

| Muammo | Yechim |
|---|---|
| `Ignored build scripts: esbuild` | pnpm 10 postinstall'ni default bloklaydi → `pnpm-workspace.yaml` dagi `onlyBuiltDependencies` ga qo'shing |
| `no output files found for task X#build` | typecheck-only paket → `packages/X/turbo.json` da `outputs: []` |
| App boshqa app'ni import qilyapti | shared kodni `packages/*` ga chiqaring |
| Paket o'zgardi, app eski kodni ko'ryapti | `rm -rf .turbo` (JIT paketlarda odatda uchramaydi) |

## Buyruqlar

| Buyruq | Nima qiladi |
|---|---|
| `pnpm dev` | barcha app parallel |
| `pnpm build` | butun graph, turbo cache bilan |
| `pnpm typecheck` | barcha paket `vue-tsc --noEmit` |
| `pnpm new:app <name>` | yangi app skaffold |
| `pnpm test:scripts` | tooling testlari |
| `pnpm --filter @level-up/web <cmd>` | bitta paketda ishlatish |
