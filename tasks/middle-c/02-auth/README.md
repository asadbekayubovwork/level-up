# MC-02: Authentication pattern'lar — JWT, OAuth, role-based access

## Nima qildim

`@level-up/auth` — 2 ta app'da ishlatiladigan auth moduli. Access token **xotirada**, refresh token **httpOnly cookie**da. Refresh proaktiv (so'rovdan oldin, 401 kutmaydi) va parallel chaqiruvlar bitta so'rovga birlashadi. Permission'lar union type, `RouteMeta` augmentation bilan — noto'g'ri permission **build paytida** ushlanadi.

Ish boshlanishidan oldin production loyihasi tahlil qilingan: [case study — wb_imzo_frontend](./case-study-wb-imzo.md). Nima olingani va nima almashtirilgani o'sha yerda asoslangan.

## Kod qayerda

| Fayl | Nima uchun |
|---|---|
| [packages/auth/src/types.ts](../../../packages/auth/src/types.ts) | `Permission` union + `RouteMeta` augmentation |
| [packages/auth/src/session.ts](../../../packages/auth/src/session.ts) | token xotirada, refresh dedupe, sessiya tiklash |
| [packages/auth/src/client.ts](../../../packages/auth/src/client.ts) | proaktiv refresh'li fetch wrapper, 401 → bitta retry |
| [packages/auth/src/guard.ts](../../../packages/auth/src/guard.ts) | `createAuthGuard` — sof funksiyalar zanjiri |
| [packages/auth/dev-server.mjs](../../../packages/auth/dev-server.mjs) | 0-dependency auth backend (httpOnly cookie uchun shart) |
| [docs/auth-security.md](../../../docs/auth-security.md) | qarorlar, nima qilinmagani, prod checklist |
| [apps/web/src/router.ts](../../../apps/web/src/router.ts) | typed `meta: { requiresAuth, permissions }` |
| [apps/admin/src/router.ts](../../../apps/admin/src/router.ts) | bir xil paket, ikkinchi app |

## Kriteriyalar

**🟢 Green**
- [x] JWT login/logout ishlaydi — HS256, `node:crypto`
- [x] Token'lar xavfsiz saqlangan — refresh `HttpOnly; SameSite=Lax` cookie'da, access xotirada (localStorage **umuman ishlatilmagan**)
- [x] Himoyalangan route'lar ruxsatsiz kirishni bloklaydi — `checkAuth`, qaytish yo'lini saqlaydi

**🟡 Yellow**
- [x] Token refresh logikasi — proaktiv + parallel dedupe + rotatsiya
- [x] OAuth2 provider integratsiya — GitHub OAuth (`/auth/github` → `/auth/callback`), real OAuth App bilan **uchidan-uchiga sinalgan**
- [x] Role-based route guard'lar TypeScript bilan — `RouteMeta` augmentation, noto'g'ri permission `TS2820` bilan yiqiladi

**🔵 Blue**
- [x] Loyihalar aro qayta ishlatiladi — `apps/web` va `apps/admin`, bir xil guard, kod ko'chirilmagan
- [x] Security best practice'lar hujjatlashtirilgan — [docs/auth-security.md](../../../docs/auth-security.md)
- [x] Modul production-ready — 28 test, jumladan imzo buzish va payload o'zgartirish

> **Cheklov:** `dev-server.mjs` — **dev uchun**, prod backend emas (rate limiting, parol hash, `state` tekshiruvi yo'q — [docs/auth-security.md §6](../../../docs/auth-security.md) da ro'yxati bor). Client paketi haqiqiy backend'ga ulanganda o'zgarmaydi.

---

## Verification (mentor uchun)

```bash
pnpm install
pnpm dev      # :4000 auth-server · :5173 web · :5174 admin
```

### 1. Login → himoyalangan sahifa

1. `http://localhost:5173/profile` oching — login'siz → `/login` ga otadi, `?next=/profile` saqlanadi
2. `admin` / `demo` bilan kiring → `/profile` ga qaytaradi

### 2. Token httpOnly ekanini isbotlash

DevTools → **Application → Cookies → localhost:5173**:
- `refresh_token` bor, `HttpOnly` ustunida **✓**

DevTools → **Console**:
```js
document.cookie          // refresh_token KO'RINMAYDI
localStorage             // bo'sh — token umuman yozilmaydi
```

### 3. Refresh'ni jonli ko'rish

Access token TTL — **30 soniya**. `/profile` da:
1. Network tab'ni oching
2. 30 soniya kuting
3. "**/api/me ni chaqirish**" tugmasini bosing

Ketma-ketlik: `/auth/refresh` → **keyin** `/api/me`. 401 umuman ko'rinmaydi.

### 4. Role-based access

| Kim | `/admin` route | `/api/admin/roles` |
|---|---|---|
| `admin`/`demo` | ochiladi | `200 {"roles":[...]}` |
| `user`/`demo` | `/403` ga otadi | `403` |

Server mustaqil tekshiradi — guard'ni chetlab o'tsangiz ham:

```bash
T=$(curl -s -X POST localhost:4000/auth/login -H 'Content-Type: application/json' \
     -d '{"username":"user","password":"demo"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['accessToken'])")
curl -s localhost:4000/api/admin/roles -H "Authorization: Bearer $T"
# → {"error":"\"role.manage\" huquqi kerak"}
```

### 5. Type safety

`apps/web/src/router.ts:20` da `'role.manage'` → `'role.manag'` qiling:

```
$ pnpm --filter @level-up/web typecheck
src/router.ts(20,49): error TS2820: Type '"role.manag"' is not assignable to type 'Permission'.
  Did you mean '"role.manage"'?
```

### 6. Ikkinchi app — bir xil paket

`http://localhost:5174` → "user sifatida kirish" → `/roles` **403** beradi. "admin sifatida kirish" → rollar chiqadi. Kod ko'chirilmagan, faqat import.

### 7. GitHub OAuth (ixtiyoriy)

```bash
cp .env.example .env    # GITHUB_CLIENT_ID / SECRET to'ldiring
```
github.com/settings/developers → New OAuth App, callback: `http://localhost:5173/auth/callback`

GitHub orqali kirgan foydalanuvchi `user.view` huquqini oladi → `/admin` unga yopiq (RBAC jonli ko'rinadi).

---

## Testlar

```
 ✓ src/session.test.ts   (9)   refresh dedupe, proaktiv refresh, 401 retry, sikl yo'qligi
 ✓ src/guard.test.ts     (7)   auth gate, permission gate, qaytish yo'li
 ✓ dev-server.test.mjs  (12)   httpOnly bayroqlari, imzo buzish, payload o'zgartirish,
                                muddat, rotatsiya, logout, 403
 Test Files  3 passed        Tests  28 passed
```

Eng muhim uchtasi:

| Test | Nimani himoya qiladi |
|---|---|
| `parallel chaqiruvlar bitta so'rovga birlashadi` | 10 ta so'rov 10 ta refresh qilmasin |
| `o'zgartirilgan payload (huquq qo'shish) → 401` | JWT'ga qo'lda `role.manage` qo'shib bo'lmasin |
| `role.manage yo'q → 403` | guard chetlab o'tilsa ham server to'xtatsin |

## Nimani o'rgandim

- **httpOnly'ning narxi bor:** access token xotirada bo'lgani uchun har sahifa yangilanishida qo'shimcha `/auth/refresh` so'rovi ketadi. localStorage bunga muhtoj emas — lekin XSS bilan to'lanadigan narx qimmatroq.
- **Proaktiv refresh reaktivdan sodda.** Intuitiv emas: "401 kutamiz" ko'proq ish (retry, `_retry` bayroq, parallel mutex), "oldindan tekshiramiz" kamroq kod.
- **`timingSafeEqual` teng uzunlik talab qiladi** — aks holda throw qiladi, ya'ni uzunlikni oldin tekshirmasangiz DoS vektori paydo bo'ladi.
- **Type safety = xavfsizlik nazorati.** `as string` cast bilan permission tekshiruvi jim ravishda o'chib qolishi mumkin. Union type buni build'ga ko'taradi.
- **JWT'ni qo'lda yozish 20 qator**, lekin prod'da bunday qilmaslik kerak — mexanizmni tushunish uchun bir marta yozish foydali.
