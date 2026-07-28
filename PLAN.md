# Level Up: Middle C + Middle B — Tayyorgarlik Rejasi

> Manba: [02. 🚀 Level Up](https://confluence.webase.uz/spaces/CH/pages/40994116) · [06. Middle C](https://confluence.webase.uz/spaces/CH/pages/57977722) · [07. Middle B](https://confluence.webase.uz/spaces/CH/pages/57977723)
>
> Imtihon: **2026-yil noyabr** · Jami: **14 task** (Middle C — 7, Middle B — 7)

---

## 1. Asosiy strategiya

**14 ta alohida loyiha qilmang. Bitta monorepo quring, har bir task uni to'ldirsin.**

Sabab: Confluence'ning o'zi shuni talab qiladi — MC-01 monorepo, MB-03 "monorepo'da component kutubxonasi", MB-01 host+remote app. Agar birinchi haftada to'g'ri monorepo qursangiz, qolgan 13 task shu skeletga package/app qo'shish bo'lib qoladi. CI/CD, testing, security audit, a11y — hammasi bitta repo ustida ishlaydi va bir marta sozlanadi.

Har bir task uchun `tasks/` ichida alohida papka bo'ladi, lekin unda **kod emas — dalil (proof) turadi**: README, screenshot, before/after, verification qadamlari. Mentor shu papkani ochadi va tekshiradi.

---

## 2. Repo tuzilishi

```
level-up/
├── PLAN.md                      ← shu fayl
├── README.md                    ← repo kirish + navigatsiya
├── pnpm-workspace.yaml          ← MC-01
├── turbo.json                   ← MC-01 (Yellow)
├── package.json
│
├── apps/
│   ├── web/                     ← asosiy app: auth, i18n, ws, error, PWA, a11y
│   ├── admin/                   ← 2-app: workspace + design system reuse dalili
│   └── remote-widget/           ← MB-01 remote micro-frontend
│
├── packages/
│   ├── ui/                      ← MB-03 design system + Storybook + tokens
│   ├── auth/                    ← MC-02 JWT/OAuth/guards
│   ├── i18n/                    ← MC-03
│   ├── ws/                      ← MC-04 WebSocket service
│   ├── logger/                  ← MC-05 error handler + Sentry
│   └── config/                  ← shared tsconfig/eslint (bonus, MC-01 Blue)
│
├── .github/workflows/           ← MC-06 CI/CD, MB-06 security scan
├── docker/                      ← MC-06 Dockerfile + compose
├── load-tests/                  ← MB-05 k6 skriptlari
│
└── tasks/
    ├── middle-c/
    │   ├── 01-monorepo/README.md
    │   ├── 02-auth/README.md
    │   ├── 03-i18n/README.md
    │   ├── 04-websocket/README.md
    │   ├── 05-error-handling/README.md
    │   ├── 06-cicd-docker/README.md
    │   └── 07-design-patterns/README.md
    └── middle-b/
        ├── 01-micro-frontend/README.md
        ├── 02-pwa/README.md
        ├── 03-design-system/README.md
        ├── 04-advanced-testing/README.md
        ├── 05-load-testing/README.md
        ├── 06-security-audit/README.md
        └── 07-accessibility/README.md
```

### Har bir `tasks/**/README.md` shabloni

```markdown
# MC-0X: <task nomi>

## Nima qildim
2-3 gap.

## Kod qayerda
- `packages/auth/src/...` — JWT service
- `apps/web/src/router/guards.ts` — route guard

## Kriteriylar
- [x] Green: ...
- [x] Yellow: ...
- [ ] Blue: ...

## Verification (mentor uchun)
1. `pnpm install && pnpm dev`
2. `/login` → admin/admin
3. ...

## Screenshot / dalil
![](./proof/login.png)

## Nimani o'rgandim / qiyin bo'lgan joyi
```

---

## 3. Taqvim

| Hafta | Sana | Task |
|---|---|---|
| W1 | Avg 3–9 | MC-01 Monorepo |
| W2 | Avg 10–16 | MC-02 Auth (JWT/OAuth/RBAC) |
| W3 | Avg 17–23 | MC-03 i18n |
| W4 | Avg 24–30 | MC-04 WebSocket |
| W5 | Avg 31–Sen 6 | MC-05 Error handling + Sentry |
| W6 | Sen 7–13 | MC-06 CI/CD + Docker |
| W7 | Sen 14–20 | MC-07 Design patterns / SOLID |
| **W8** | **Sen 21–27** | **Middle C — to'liq review, mentor verification** |
| W9 | Sen 28–Okt 4 | MB-01 Micro-frontend |
| W10 | Okt 5–11 | MB-02 PWA |
| W11 | Okt 12–18 | MB-03 Design System + Storybook |
| W12 | Okt 19–25 | MB-04 Advanced testing |
| W13 | Okt 26–Noy 1 | MB-05 Load testing + Web Vitals |
| W14 | Noy 2–8 | MB-06 Security audit |
| W15 | Noy 9–15 | MB-07 Accessibility |
| **W16** | **Noy 16–22** | **Final review + demo tayyorlash** |

> ⚠️ Imtihon noyabr **boshida** bo'lsa: MB-06 va MB-07 ikkalasi ham audit-tipdagi (3–4 kunlik) — ularni W13 ga birlashtiring va 2 hafta yutasiz.

**Haftalik ritm:** Du–Se kod → Chor–Pay polish + Yellow/Blue kriteriylar → Ju README + screenshot → Sha/Ya bo'sh (bufer).

---

## 4. MIDDLE C — Checklist

### 🔵 MC-01. Monorepo asoslari — *Blue* → [tasks/middle-c/01-monorepo](tasks/middle-c/01-monorepo/README.md)
> `pnpm workspaces` bilan monorepo. Loyihalar va shared paketlar, ichki dependency boshqaruvi.

**🟢 Green (minimum)**
- [x] pnpm workspace 2+ app/paket bilan sozlangan (`apps/web`, `apps/admin`, `packages/ui`)
- [x] Ichki dependency'lar `workspace:*` protokoli bilan
- [x] `pnpm build` barcha paketlarda muvaffaqiyatli

**🟡 Yellow (good)**
- [x] Turborepo task orchestration (`turbo.json`) — cache: 6.2s → **21ms FULL TURBO**
- [x] Shared paketlar to'g'ri typed (`vue-tsc` cross-package prop type'larni ushlaydi)
- [x] Yangi loyiha setup < 30 daqiqa — o'lchandi: **10.2s**

**🔵 Blue (excellent)**
- [x] Monorepo template sifatida xizmat qiladi — `pnpm new:app <name>` (0 dependency, testli)
- [x] Workspace pattern'lar hujjatlashtirilgan — [docs/monorepo.md](docs/monorepo.md)
- [ ] Jamoa yangi loyihalarni mustaqil qo'shadi — **repo tayyor, jamoa dalili kerak** (hamkasb `pnpm new:app` bilan app qo'shsin → PR link'ini task README'ga qo'ying)

**Deliverables:** repo tuzilishi · `package.json` workspaces · shared paketlar · setup hujjati
**Verification:** clone → `pnpm install` → `pnpm build` hammasi o'tadi → ichki dependency'lar to'g'ri resolve bo'ladi

---

### ☐ MC-02. Authentication: JWT, OAuth, role-based access
> To'liq JWT flow (login, saqlash, refresh, himoyalangan route). OAuth2 + role-based UI/route access.

**🟢 Green**
- [ ] JWT login/logout ishlaydi
- [ ] Token'lar xavfsiz saqlangan (**httpOnly cookie afzal**, localStorage emas)
- [ ] Himoyalangan route'lar ruxsatsiz kirishni bloklaydi

**🟡 Yellow**
- [ ] Token refresh logikasi (401 → refresh → retry, bitta parallel refresh)
- [ ] OAuth2 provider integratsiya (Google yoki GitHub)
- [ ] Role-based route guard'lar TypeScript bilan (`meta.roles`, typed)

**🔵 Blue**
- [ ] `packages/auth` production-ready va loyihalar aro qayta ishlatiladi (`apps/admin` ham ishlatadi)
- [ ] Security best practice'lar hujjatlashtirilgan (XSS/CSRF, token TTL, rotation)

**Deliverables:** auth service moduli · JWT utility'lar · route guard misollari · OAuth integratsiya · security hujjati
**Verification:** login → JWT → himoyalangan sahifa → token expire → refresh → role-based access

---

### ☐ MC-03. i18n va localization
> `vue-i18n`, tarjima fayllari, locale switch, sana/raqam formatlash.

**🟢 Green**
- [ ] vue-i18n 2+ locale bilan sozlangan (uz / ru / en)
- [ ] Locale almashtirish ishlaydi
- [ ] Tarjima fayllari tuzilmali (namespace bo'yicha, flat emas)

**🟡 Yellow**
- [ ] Sana/raqam formatlash lokalizatsiya qilingan (`Intl` API)
- [ ] Tarjima fayllarini lazy yuklash (dynamic import, bundle'ga hammasi kirmaydi)
- [ ] Pluralizatsiya qoidalari (ru uchun 3 forma!)

**🔵 Blue**
- [ ] Production-ready: missing-key detector / CI'da tekshiruv
- [ ] Tarjima workflow hujjatlashtirilgan
- [ ] Jamoa yangi locale mustaqil qo'sha oladi

**Deliverables:** i18n konfiguratsiya · tarjima JSON'lar · locale switcher · formatting utility'lar
**Verification:** locale almashtiring → butun matn darhol o'zgaradi → sana/raqam to'g'ri formatlanadi

---

### ☐ MC-04. Real-time: WebSocket
> Socket.io client yoki native WS. Live chat yoki notification.

**🟢 Green**
- [ ] Client serverga ulanadi
- [ ] Xabarlar yuboriladi/olinadi
- [ ] Real-time UI yangilanishlari (chat yoki notification)

**🟡 Yellow**
- [ ] Reconnection logikasi (exponential backoff)
- [ ] Heartbeat / keepalive (ping-pong)
- [ ] Error handling + user feedback (banner: "Aloqa uzildi, qayta ulanmoqda…")
- [ ] Connection state tracking (`connecting | open | reconnecting | closed`)

**🔵 Blue**
- [ ] `packages/ws` production-ready, connection state to'g'ri boshqariladi (unmount'da cleanup, memory leak yo'q)
- [ ] Qayta ishlatiluvchi pattern'lar hujjatlashtirilgan (`useSocket()` composable)

**Deliverables:** WebSocket service moduli · real-time component misoli · connection management utility'lar
**Verification:** 2 tab oching → birida xabar → ikkinchisida darhol → serverni o'chiring → avtomatik qayta ulanadi

> 💡 Mock server kerak: `packages/ws/mock-server.js` — 30 qatorlik `ws` echo server yetadi.

---

### ☐ MC-05. Error handling va logging
> Global Vue error handler + API error handling + remote logging service.

**🟢 Green**
- [ ] `app.config.errorHandler` xatolarni ushlaydi
- [ ] Error logging service (console + remote'ga yuboradi)

**🟡 Yellow**
- [ ] Error kategoriyalari aniqlangan va turlicha handled (network / validation / auth / unknown)
- [ ] Sentry (yoki shunga o'xshash APM) integratsiya, source map upload bilan
- [ ] User-friendly error xabarlari (stack trace foydalanuvchiga ko'rinmaydi)

**🔵 Blue**
- [ ] Strategiya to'liq: `onErrorCaptured` boundary component'lar, unhandled promise rejection ham ushlanadi
- [ ] Production'da 0 handled bo'lmagan xato
- [ ] Pattern'lar hujjatlashtirilgan

**Deliverables:** global error handler · logging service · error boundary'lar · Sentry konfiguratsiyasi
**Verification:** turli xatolarni trigger qiling → ushlangan → service'ga logged → foydalanuvchi do'stona xabar ko'radi

---

### ☐ MC-06. CI/CD, GitHub Actions, Docker
> Har push'da test+build. Dockerfile va registry'ga push.

**🟢 Green**
- [ ] GitHub Actions har push'da test + build ishga tushiradi
- [ ] Dockerfile muvaffaqiyatli build bo'ladi
- [ ] Docker image registry'ga push qilinadi (GHCR bepul)

**🟡 Yellow**
- [ ] Pipeline bosqichlari: lint → test → build → deploy
- [ ] Staging/production'ga avtomatik deployment
- [ ] Pipeline < 5 daqiqa (pnpm cache + turbo remote cache)

**🔵 Blue**
- [ ] Ishonchli tizim, 0 buzilgan deployment
- [ ] Jamoa deployment uchun pipeline'ga tayanadi (qo'lda deploy yo'q)
- [ ] Pipeline maintenance hujjatlashtirilgan

**Deliverables:** workflow fayllari · Dockerfile · docker-compose · deployment skriptlari · CI/CD hujjati
**Verification:** branch'ga push → CI ishlaydi → image build → testlar o'tadi → deployment muvaffaqiyatli

> 💡 Multi-stage Dockerfile: `node:22-alpine` build → `nginx:alpine` serve. Image < 50MB bo'lsin — bu Blue uchun kuchli dalil.

---

### ☐ MC-07. Design Pattern'lar: Clean Code va SOLID (Vue kontekstida)
> Murakkab component'ni SRP bo'yicha bo'lish. Composition over inheritance, `provide/inject` DI.

**🟢 Green**
- [ ] 1 ta murakkab component Single Responsibility bo'yicha refactor qilingan
- [ ] `provide/inject` dependency injection uchun ishlatilgan

**🟡 Yellow**
- [ ] 3+ design pattern qo'llanilgan (Composition, Strategy, Observer)
- [ ] Kod before/after misollar bilan **o'lchanadigan** tarzda toza (qator soni, cyclomatic complexity, component soni)

**🔵 Blue**
- [ ] Pattern'lar misollar bilan hujjatlashtirilgan
- [ ] Jamoa code review'larda pattern'larni qo'llaydi

**Deliverables:** refactor qilingan component'lar · pattern hujjati · before/after comparison
**Verification:** code review — before/after solishtirish → pattern tanlovini tushuntirish → maintainability yaxshilanganini ko'rsatish

> 💡 Eng yaxshi manba: **avvalgi loyihangizdagi haqiqiy 400-qatorli component**. Sun'iy misol Blue olmaydi. `git log` orqali real commit ko'rsating.

---

## 5. MIDDLE B — Checklist

### ☐ MB-01. Micro-frontend (Module Federation)
**🟢 Green**
- [ ] Host app va remote app sozlangan
- [ ] Remote component host'da renderlanadi
- [ ] Module Federation (yoki iframe) yondashuvi ishlaydi

**🟡 Yellow**
- [ ] Shared dependency'lar to'g'ri sozlangan (Vue bir marta yuklanadi — Network tab'da isbotlang)
- [ ] Remote failure uchun fallback handling
- [ ] Versioning strategiyasi

**🔵 Blue**
- [ ] Arxitektura hujjatlashtirilgan (diagram bilan)
- [ ] Jamoa yangi micro-frontend mustaqil qo'shadi
- [ ] Deployment strategiyasi version va rollback'ni handle qiladi

**Deliverables:** host app · remote app · shared dependency konfiguratsiyasi · arxitektura hujjati
**Verification:** ikkala app'ni ishga tushiring → remote host ichida renderlanadi → shared dep bir marta yuklanadi → remote'ni o'chiring → fallback ishlaydi

> 💡 `@originjs/vite-plugin-federation` yoki Vite 6 native `moduleFederation`.

---

### ☐ MB-02. PWA: Service Worker, offline, install
**🟢 Green**
- [ ] Service Worker ro'yxatdan o'tadi
- [ ] Asosiy caching strategiya ishlaydi
- [ ] Cache'langan resurslar uchun offline ishlaydi
- [ ] O'rnatish taklifi (install prompt) paydo bo'ladi

**🟡 Yellow**
- [ ] Ilg'or caching strategiyalari (cache-first statik, network-first API)
- [ ] Background sync
- [ ] Push notification'lar
- [ ] Offline sahifa UX feedback bilan

**🔵 Blue**
- [ ] Lighthouse PWA ball **90+** (screenshot majburiy)
- [ ] Mobile va desktop'da o'rnatiladigan
- [ ] Offline tajriba native app'dan farq qilmaydi

**Deliverables:** PWA manifest · service worker · caching strategiyalari · offline component'lar
**Verification:** o'rnating → offline ishlaydi → background sync → push notification → Lighthouse audit o'tadi

> 💡 `vite-plugin-pwa` (Workbox ustida) — qo'lda SW yozmang, Yellow kriteriylar undan tekinga keladi.

---

### ☐ MB-03. Design System + Storybook
**🟢 Green**
- [ ] 5+ qayta ishlatiluvchi component monorepo'da (`packages/ui`)
- [ ] Component'lar boshqa app'lardan import qilinadi (`apps/web` **va** `apps/admin`)
- [ ] Asosiy Storybook hujjatlari

**🟡 Yellow**
- [ ] Storybook har component uchun interaktiv doc'lar bilan (Controls, Docs page)
- [ ] Changesets bilan versioning
- [ ] Theming qo'llab-quvvatlash (light/dark, CSS variables)

**🔵 Blue**
- [ ] Design system 2+ loyihada ishlatiladi
- [ ] Visual regression test'lar (Chromatic yoki Playwright screenshot)
- [ ] Design token'lar aniqlangan (`tokens.json` / CSS custom properties)
- [ ] Jamoa component qo'shadi

**Deliverables:** component kutubxona paketlari · Storybook instance · versioned release'lar · design token'lar · VRT setup
**Verification:** Storybook oching → hujjatlangan component'lar → app'da import → theme bilan ishlaydi → CHANGELOG tekshiring

> 💡 Storybook'ni GitHub Pages'ga deploy qiling (MC-06 pipeline'ga bir step) — mentor uchun jonli link Blue'ga eng arzon yo'l.

---

### ☐ MB-04. Ilg'or testing (mocking, integration)
**🟢 Green**
- [ ] API/store mock'lar izolatsiya uchun yaratilgan
- [ ] 3+ integration test ko'p component workflow'ni qamrab oladi
- [ ] CI test'larni ishonchli ishga tushiradi (flaky test yo'q)

**🟡 Yellow**
- [ ] 10+ integration test
- [ ] Ko'p component user flow'lar end-to-end test qilingan (Playwright)
- [ ] Test coverage **60%+**

**🔵 Blue**
- [ ] Testing strategiyasi to'liq va hujjatlashtirilgan
- [ ] CI'da coverage tracking (badge / PR comment)
- [ ] Jamoa yangi feature uchun integration test yozadi

**Deliverables:** mock utility'lar · integration test fayllari · coverage hisobotlari · testing qo'llanma
**Verification:** test suite → hammasi o'tadi → coverage hisoboti → integration test'lar muhim flow'larni qamrab oladi

> 💡 `msw` (Mock Service Worker) API mock uchun — bir marta yozilgan handler'lar Vitest'da ham, Storybook'da ham, Playwright'da ham ishlaydi. MB-03 va MB-04 ni bir vaqtda yopadi.

---

### ☐ MB-05. Load testing va performance monitoring
**🟢 Green**
- [ ] k6 load testing skripti yaratilgan va bajarilgan
- [ ] Web Vitals metrikalar muhim sahifalar uchun o'lchangan

**🟡 Yellow**
- [ ] Web Vitals monitoring (LCP, INP/FID, CLS) — `web-vitals` paketi + remote yuborish
- [ ] CI'da performance budget'lar aniqlangan (Lighthouse CI, budget buzilsa build fail)
- [ ] Load testing development workflow'ga integratsiya

**🔵 Blue**
- [ ] Monitoring production-ready
- [ ] Regression uchun alert'lar sozlangan
- [ ] Jamoa metrikalarni doimiy kuzatadi (dashboard link)

**Deliverables:** k6 skriptlari · Web Vitals dashboard · performance budget konfiguratsiyasi · monitoring hujjati
**Verification:** k6 load test → hisobot → Web Vitals metrikalar → CI'da budget tekshiruvi

> 💡 Web Vitals'ni MC-05 dagi `packages/logger` ga ulang — yangi backend kerak emas.

---

### ☐ MB-06. Dependency management va security auditing
**🟢 Green**
- [ ] `pnpm audit` bajarilgan
- [ ] Ma'lum zaifliklar aniqlangan va hujjatlashtirilgan
- [ ] CI'da asosiy security tekshiruvlar

**🟡 Yellow**
- [ ] Snyk (yoki Dependabot + CodeQL) integratsiya
- [ ] CI pipeline'da avtomatlashtirilgan security tekshiruvlar
- [ ] High/critical zaifliklar tuzatilgan

**🔵 Blue**
- [ ] Security jarayoni to'liq avtomatlashtirilgan (Dependabot auto-PR + auto-merge patch)
- [ ] Production'da 0 high/critical zaiflik
- [ ] Security policy hujjatlashtirilgan (`SECURITY.md`)

**Deliverables:** audit hisobotlari · CI security pipeline · zaiflik fix PR'lari · security policy
**Verification:** audit → zaiflik hisoboti → CI security tekshiruvlari o'tadi → 0 high/critical

---

### ☐ MB-07. Accessibility (a11y)
**🟢 Green**
- [ ] Semantic HTML ishlatilgan (`div`-soup emas)
- [ ] Interaktiv element'larga ARIA attribute'lar
- [ ] Klaviatura navigatsiya ishlaydi (focus trap modal'da, focus-visible ring)

**🟡 Yellow**
- [ ] a11y audit tool integratsiya (`axe` / `pa11y` CI'da)
- [ ] Aniqlangan muammolar tuzatilgan
- [ ] Screen reader compatibility test qilingan (NVDA yoki VoiceOver — video/yozma hisobot)

**🔵 Blue**
- [ ] Accessibility ball **90%+**
- [ ] a11y code review jarayoniga kiritilgan (PR checklist)
- [ ] Jamoa standartlarga o'rgatilgan

**Deliverables:** a11y audit hisobotlari · ARIA implementatsiya misollari · klaviatura navigatsiya hujjati · screen reader test natijalari
**Verification:** butun app bo'ylab `Tab` → barcha interaktiv element accessible → axe audit → 90%+

> 💡 `eslint-plugin-vuejs-accessibility` + `@axe-core/playwright` — MB-04 test suite'iga qo'shiladi, Yellow bepul keladi.

---

## 6. Sifat qoidalari (har bir task uchun majburiy)

- [ ] Har task **alohida branch**da: `feat/mc-02-auth` → PR → merge. Mentor PR'lardan progressni ko'radi.
- [ ] Har task oxirida `tasks/**/README.md` to'ldirilgan (shablon bo'yicha).
- [ ] Screenshot/GIF `tasks/**/proof/` ichida. **"Ishlaydi" degan gap dalil emas.**
- [ ] Root `README.md` da task'lar jadvali va status (🟢/🟡/🔵) yangilanib boradi.
- [ ] Har task'ning verification qadamlari **toza clone'dan** sinab ko'rilgan (`git clone` → `pnpm install` → ishlaydi).

## 7. Umumiy progress

**Middle C:** 🔵☐☐☐☐☐☐ (1/7 — MC-01 Blue)
**Middle B:** ☐☐☐☐☐☐☐ (0/7)

---

## 8. Birinchi qadam (bugun)

1. [ ] Confluence'dan aniq imtihon sanasini bilib oling → taqvimni (§3) shunga moslang
2. [ ] Mentordan so'rang: **oldingi ish loyihalaringizni** dalil sifatida ishlatsa bo'ladimi? (MC-02, MC-07, MB-03 uchun bu haftalab vaqt tejaydi)
3. [ ] `pnpm init` + `pnpm-workspace.yaml` → MC-01 boshlandi
