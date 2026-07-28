# Case study: wb_imzo_frontend auth arxitekturasi

> **Maqsad:** production'da ishlayotgan real auth tizimini MC-02 kriteriyalari bo'yicha tahlil qilish — nima to'g'ri, nima noto'g'ri, va `packages/auth` da nimani boshqacha qilaman.
>
> **Eslatma:** bu tahlil, ko'chirma emas. wb_imzo ish loyihasi — bu yerda faqat pattern'lar va qisqa iqtiboslar bor, kod nusxalanmagan. Repo public bo'lsa, rahbardan tasdiq olinishi kerak.
>
> Tahlil sanasi: 2026-07-28 · Manba: `wb_imzo_frontend` (Vue 3 + Vite + Pinia + vue-router)

---

## 1. Arxitektura qisqacha

Bu **klassik JWT login emas** — **Keycloak (OIDC) redirect flow**:

```
Foydalanuvchi → redirectToLogin() → Keycloak IdP → redirect back with code
  → keycloak-js token'ni oladi → localStorage'ga saqlanadi
  → axios request interceptor har so'rovda updateToken(30) qiladi
  → router.beforeEach `meta.requiresAuth` ni tekshiradi
```

Asosiy fayllar:

| Fayl | Qatorlar | Vazifasi |
|---|---|---|
| `src/lib/keycloak.ts` | 69 | Keycloak client, token persistence, login redirect |
| `src/stores/auth.ts` | 144 | Pinia store: user, logout, `can()`, SSO tekshiruvi |
| `src/services/api.ts` | 122 | axios instance + request/response interceptor'lar |
| `src/router/index.ts` | 199 | `beforeEach` — 8 bosqichli guard zanjiri |
| `src/composables/usePermission.ts` | 12 | invoice modul uchun `can()` |

---

## 2. MC-02 kriteriyalari bo'yicha

| Kriteriya | Holat | Dalil |
|---|---|---|
| 🟢 JWT login/logout ishlaydi | ✅ | `keycloak.ts:54 redirectToLogin()`, `auth.ts:47 logout()` |
| 🟢 Token'lar xavfsiz saqlangan (httpOnly afzal) | ❌ | `keycloak.ts:30-35` — localStorage |
| 🟢 Himoyalangan route'lar bloklaydi | ✅ | `router/index.ts:55` |
| 🟡 Token refresh logikasi | ✅ | `api.ts:27` — `keycloak.updateToken(30)` |
| 🟡 OAuth2 provider integratsiya | ✅ | Keycloak = to'liq OAuth2/OIDC IdP |
| 🟡 Role-based guard'lar **TypeScript bilan** | ⚠️ | Logika bor, type safety yo'q |
| 🔵 Loyihalar aro qayta ishlatiladi | ❌ | domen logikasiga chirmashgan |
| 🔵 Security hujjatlashtirilgan | ❌ | yo'q |

---

## 3. To'g'ri qilingan: proaktiv token refresh

`src/services/api.ts:22-33` — request interceptor har so'rovdan **oldin** token muddatini tekshiradi:

```ts
if (keycloak.authenticated) {
  await keycloak.updateToken(30)   // 30s ichida tugasa — yangilaydi
  config.headers.Authorization = `Bearer ${keycloak.token}`
}
```

Ko'pchilik tutorial'lar **reaktiv** pattern o'rgatadi: so'rov ketadi → 401 keladi → refresh → so'rovni qayta yuborish. Bu yerdagi yondashuv yaxshiroq, sabablari:

1. **401 umuman sodir bo'lmaydi** — foydalanuvchi kechikish ko'rmaydi
2. **Retry logikasi kerak emas** — original request config'ni saqlab qayta yuborish, `_retry` flag, cheksiz sikldan himoya — hech biri yozilmagan
3. **Parallel so'rov muammosi yo'q** — 10 ta so'rov bir vaqtda 401 olsa, reaktiv pattern'da 10 ta refresh ketadi (yoki mutex yozish kerak). `keycloak-js` `updateToken` ni ichida deduplicate qiladi

Refresh muvaffaqiyatsiz bo'lsa (`catch`) — darhol login'ga redirect va `Promise.reject`. So'rov "osilib qolmaydi".

**Xulosa:** bu pattern'ni `packages/auth` ga olib o'taman.

---

## 4. Xato: token'lar localStorage'da

`src/lib/keycloak.ts:26-40`:

```ts
const KC_TOKEN_KEY = "kc_token"
const KC_REFRESH_TOKEN_KEY = "kc_refresh_token"
localStorage.setItem(KC_TOKEN_KEY, keycloak.token)
```

**Muammo:** localStorage JavaScript'ga to'liq ochiq. Sahifada bitta XSS bo'lsa — access token ham, **refresh token ham** o'g'irlanadi. Refresh token o'g'irlanishi og'irroq: u uzoq yashaydi, ya'ni hujumchi sessiyani cheksiz uzaytiradi.

**Nega shunday qilingan (adolatli baho):** `keycloak-js` SPA rejimida token'ni xotirada ushlaydi, sahifa yangilanishida yo'qoladi. Ikkita real ehtiyoj bor edi — refresh'dan keyin sessiya saqlansin va yangi tab'da qayta login so'ralmasin. localStorage — eng tez yechim.

**To'g'ri yechimlar, narxi bo'yicha:**

| Yechim | Xavfsizlik | Narxi |
|---|---|---|
| httpOnly + Secure + SameSite cookie (BFF pattern) | eng yaxshi | backend endpoint kerak — token'ni frontend ko'rmaydi |
| Keycloak `check-sso` + silent iframe | yaxshi | localStorage kerak emas, IdP session'ga tayanadi. 3rd-party cookie bloklariga sezgir |
| Access token xotirada, refresh token httpOnly cookie'da | yaxshi | o'rtacha — backend refresh endpoint |
| localStorage | **yomon** | 0 |

**`packages/auth` da:** access token faqat xotirada (module-scope `ref`), refresh token httpOnly cookie'da. Bu MC-02 Green'dagi "httpOnly cookie afzal" ni to'g'ridan-to'g'ri yopadi.

---

## 5. Zaif: role/permission tizimida type safety yo'q

Uchta alohida muammo.

**5.1. `RouteMeta` augmentation yo'q.** Repo bo'ylab `declare module "vue-router"` topilmadi. Natijada `router/index.ts:185`:

```ts
const permissionRequired = to.meta.permission as string | undefined
```

`as` — cast, tekshiruv emas. `meta.permision` deb xato yozsangiz, TypeScript jim turadi, guard esa jim o'tkazib yuboradi. **Xavfsizlik teshigi type xatosi ko'rinishida.**

**5.2. Permission'lar — magic string.** `sidebar.config.ts` da: `authStore.can("ContactEmailView")`, `can("RoleViewAll")`, `can("LicenseViewAll")`. Autocomplete yo'q, rename yo'q, typo'ni faqat runtime'da bilib olasiz — ya'ni foydalanuvchi menyu bandini ko'rmay qolganda.

**5.3. Ikkita parallel permission tizimi.**

| | Manba | API |
|---|---|---|
| Asosiy app | `authStore.user.permissions` | `authStore.can()` |
| Invoice moduli | `invoiceStore.permissions` | `usePermission().can()` / `invoiceStore.hasPermission()` |

Bir xil nomdagi ikki funksiya, ikki xil ma'lumot manbasi. Yangi odam qaysi birini ishlatishni bilmaydi va noto'g'ri tanlasa — permission har doim `false` qaytaradi.

**`packages/auth` da:**

```ts
// permission'lar — union type, string emas
export type Permission = 'user.view' | 'user.edit' | 'role.manage'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    permissions?: Permission[]
  }
}
```

Endi `meta.permissions: ['user.veiw']` — **build paytida** yiqiladi. Bitta `can()`, bitta manba.

---

## 6. Zaif: guard 161 qator, 8 ta mas'uliyat

`router/index.ts:37-197` — bitta `beforeEach` ichida:

1. Public signing shortcut (query param bo'yicha redirect)
2. Public route whitelist
3. Keycloak auth gate
4. SSO ro'yxatdan o'tish tekshiruvi (parallel, 2 ta store)
5. User fetch
6. "Workplace prelude" — tashkilot tanlash, cookie yozish, provider binding tekshiruvi (~65 qator, ichida 3 daraja nesting)
7. Admin tekshiruvi
8. Invoice permission tekshiruvi

`next()` **16 marta** har xil joydan chaqiriladi, guard ichida **7 ta `await`** — ya'ni har navigatsiya bir nechta network so'rovni kutadi. Sekinlashuv ustiga, tarmoq xatosi navigatsiyani sindiradi.

Bu **auth muammosi emas, SRP muammosi** — shuning uchun bu bo'lim [MC-07 (Design Patterns / SOLID)](../07-design-patterns/) uchun ham asosiy material bo'ladi. Refactor yo'nalishi: har bosqich alohida guard funksiya, `router.beforeEach` ga zanjir qilib berish; org/workplace logikasi auth'dan ajratiladi.

---

## 7. Yo'q: auth testlari

`src/utils/tests/` da atigi 2 ta spec (`unmask`, `formatters`). Auth, guard, interceptor — **0 test**.

Auth — eng xavfli joy: bug bo'lsa yo hamma kiradi, yo hech kim kirmaydi. `packages/auth` da minimal test to'plami:

- guard: token yo'q → login'ga redirect
- guard: permission yetmaydi → 403 sahifa
- interceptor: token muddati tugagan → refresh chaqiriladi → so'rov davom etadi
- interceptor: refresh yiqildi → logout, cheksiz sikl yo'q

---

## 8. Xulosa: `packages/auth` ga nima o'tadi

| wb_imzo'dan | Qaror |
|---|---|
| Proaktiv `updateToken(30)` request interceptor'da | ✅ olinadi |
| Keycloak/OIDC redirect flow | ✅ olinadi (OAuth2 kriteriyasi) |
| `meta.requiresAuth` guard | ✅ olinadi, lekin typed `RouteMeta` bilan |
| localStorage token storage | ❌ almashtiriladi — xotira + httpOnly cookie |
| `as string` cast, magic string permission | ❌ almashtiriladi — union type |
| Ikkita permission tizimi | ❌ bitta qilinadi |
| 161 qatorli monolit guard | ❌ guard zanjiriga bo'linadi |
| Domen logikasi (org, invoice, telegram) auth ichida | ❌ paketdan tashqarida qoladi |

---

## 9. Mentor uchun muhokama savollari

1. localStorage → httpOnly migratsiyasi wb_imzo'da qancha turadi? (backend BFF endpoint + barcha tab-sync logikasini qayta yozish — taxminan 1 sprint). Bu **hozir** qilishga arziydimi, yoki qabul qilingan risk sifatida qoldirilsinmi?
2. Keycloak `check-sso` + silent SSO iframe localStorage'siz yechim beradi — nega tanlanmagan? (3rd-party cookie bloklari? Telegram WebView?)
3. Permission union type 200+ permission bo'lganda qo'lda boqib bo'lmaydi — backend'dan codegen qilish kerakmi?
