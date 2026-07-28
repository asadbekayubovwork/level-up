# Auth: xavfsizlik qarorlari

`@level-up/auth` da qabul qilingan qarorlar, sabablari va nima **qilinmagani**.
Asosiy fon: [wb_imzo case study](../tasks/middle-c/02-auth/case-study-wb-imzo.md).

---

## 1. Token'lar qayerda saqlanadi

| Token | Joyi | Sabab |
|---|---|---|
| Access token | **JS xotirasi** (`session.ts` module-scope) | localStorage/sessionStorage XSS'ga ochiq. Xotiradagi token tab yopilishi bilan yo'qoladi va `document.cookie` orqali ham o'qib bo'lmaydi |
| Refresh token | **httpOnly cookie** | JS umuman ko'ra olmaydi. XSS bo'lsa ham hujumchi uzoq yashovchi tokenni o'g'irlay olmaydi |

Cookie bayroqlari (`dev-server.mjs`):

```
refresh_token=<jti>; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800
```

- **HttpOnly** — XSS himoyasi. Bu bandsiz butun sxema ma'nosini yo'qotadi.
- **SameSite=Lax** — CSRF himoyasi. Boshqa saytdan yuborilgan POST'ga cookie qo'shilmaydi.
- **Secure** — dev'da yo'q (localhost `http`). **Prod'da majburiy**, aks holda token tarmoqda ochiq ketadi.

### Sahifa yangilanganda nima bo'ladi

Access token xotirada edi — yo'qoldi. `createAuthGuard` birinchi navigatsiyada `restoreSession()` chaqiradi, u cookie bilan `/auth/refresh` ga boradi va yangi access token oladi. Foydalanuvchi qayta login qilmaydi.

Narxi: sahifa yuklanganda **bitta qo'shimcha so'rov**. localStorage bunga muhtoj emas — lekin XSS bilan to'lanadigan narx ancha qimmat.

---

## 2. Refresh strategiyasi

**Proaktiv** — `client.ts` har so'rovdan oldin muddatni tekshiradi:

```ts
if (getAccessToken() && isExpiringSoon()) await refresh()
```

wb_imzo'dagi `keycloak.updateToken(30)` pattern'i. Reaktiv (401 → refresh → retry) variantdan afzalligi:

| | Proaktiv | Reaktiv |
|---|---|---|
| Foydalanuvchi 401 ko'radimi | yo'q | ha (yashiriladi, lekin sodir bo'ladi) |
| Retry logikasi | kerak emas | request config saqlash + `_retry` bayrog'i |
| 10 ta parallel so'rov | 1 refresh | 10 refresh (yoki mutex yozish kerak) |

401 baribir kelsa (server tokenni bekor qilgan) — **aynan bitta** refresh + retry, keyin `ApiError(401)`. Cheksiz sikl bo'lishi mumkin emas, chunki retry bayroq bilan emas, kod strukturasi bilan cheklangan.

Parallel `refresh()` chaqiruvlari bitta in-flight promise'ga birlashadi (`session.ts`) — test bilan qoplangan.

### Refresh token rotatsiyasi

Har `/auth/refresh` da eski `jti` o'chiriladi, yangisi beriladi. O'g'irlangan refresh token bir martadan ko'p ishlamaydi.

> **Qilinmagan:** rotatsiya buzilishini aniqlash (o'g'irlangan token ishlatilsa — butun oilani bekor qilish). Prod'da kerak, dev-server uchun ortiqcha.

---

## 3. Permission'lar type-safe

```ts
export type Permission = 'user.view' | 'user.edit' | 'role.manage'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    permissions?: Permission[]
  }
}
```

Xato yozilsa build yiqiladi:

```
src/router.ts(20,49): error TS2820: Type '"role.manag"' is not assignable to type 'Permission'.
  Did you mean '"role.manage"'?
```

Bu shunchaki qulaylik emas — **xavfsizlik nazorati**. wb_imzo'da `to.meta.permission as string` edi: `meta.permision` deb xato yozsangiz TypeScript jim turadi, guard esa tekshiruvsiz o'tkazib yuboradi.

> **Qilinmagan:** permission'lar 200 tadan oshsa qo'lda boqib bo'lmaydi — backend'dan codegen kerak bo'ladi.

---

## 4. Guard faqat UI, server ham tekshiradi

Route guard — **foydalanuvchi qulayligi**, xavfsizlik chegarasi emas. Brauzerdagi hamma narsani chetlab o'tish mumkin.

Shuning uchun `/api/admin/roles` serverda mustaqil tekshiradi:

```js
if (!claims.permissions?.includes('role.manage')) {
  return json(res, 403, { error: '"role.manage" huquqi kerak' })
}
```

Test buni tasdiqlaydi: `user` tokeni bilan guard'siz to'g'ridan-to'g'ri endpoint'ga borilsa — 403.

---

## 5. JWT tekshiruvi

`dev-server.mjs` da HS256, `node:crypto` bilan — `jsonwebtoken` kerak emas (~20 qator).

Muhim tafsilotlar:

- **`timingSafeEqual`** — imzoni oddiy `===` bilan solishtirish timing attack'ga ochiq
- Uzunlik avval tekshiriladi — `timingSafeEqual` teng uzunlik talab qiladi, aks holda throw qiladi
- `exp` har doim tekshiriladi

Testlar: buzilgan imzo → 401, payload'ga qo'lda `role.manage` qo'shilgan token → 401, muddati tugagan → 401.

> **Prod'da boshqacha:** o'z JWT'ingizni yozmang. Keycloak/Auth0/Ory kabi tayyor IdP ishlating. Bu yerdagi implementatsiya — mexanizmni ko'rsatish uchun.

---

## 6. Nima ataylab qilinmagan

| | Sabab |
|---|---|
| CSRF token | `SameSite=Lax` + `Authorization` header yetarli. Cookie-based session'da kerak bo'lardi |
| OAuth `state` tekshiruvi | dev-server'da generatsiya qilinadi, lekin solishtirilmaydi. **Prod'da majburiy** — CSRF himoyasi |
| Rate limiting | dev-server'da yo'q. Prod'da login endpoint'da shart |
| Parol hash (bcrypt/argon2) | demo user'lar in-memory, parol `demo`. Real DB bo'lganda shart |
| `Secure` cookie bayrog'i | localhost `http` — prod'da qo'shiladi |
| Token oilasi bekor qilish | rotatsiya bor, buzilishni aniqlash yo'q |

Bularning hammasi — **dev-server** cheklovlari. Client paketi (`src/`) bu qarorlarga bog'liq emas: haqiqiy backend'ga ulanganda o'zgarmaydi.

---

## 7. Prod'ga chiqishdan oldin checklist

- [ ] Cookie'ga `Secure` qo'shilgan, HTTPS majburiy
- [ ] `AUTH_SECRET` — secret manager'dan, kamida 32 bayt tasodifiy
- [ ] Access TTL 5–15 daqiqa (dev'dagi 30s emas)
- [ ] OAuth `state` session'ga bog'lanib tekshiriladi
- [ ] Login endpoint'da rate limiting
- [ ] Refresh rotatsiya buzilishi aniqlanadi va oila bekor qilinadi
- [ ] CSP header'lar (XSS ehtimolini kamaytiradi)
- [ ] Har bir himoyalangan endpoint serverda mustaqil tekshiriladi
