# CI/CD va GitHub Actions — Webase da nima ishlaydi

O'zim sozlagan yoki qayta ishlagan to'rtta frontend pipeline i va ularning
umumiy tuzilishi haqida hujjat.

| Loyiha | Nima qildim | Yetkazish usuli |
| --- | --- | --- |
| [`wb_imzo_frontend`](https://github.com/WeBaseLTD/wb_imzo_frontend) | mavjud pipeline ni optimizatsiya qildim (build ishi ikki baravar kamaydi) | Docker Swarm service update |
| [`wb_edu_management_frontend`](https://github.com/WeBaseLTD/wb_edu_management_frontend) | noldan to'liq o'zim qurdim | belgilangan hostda `docker run` |
| [`wb_cash_management_frontend`](https://github.com/WeBaseLTD/wb_cash_management_frontend) | bitta commit → bizning test **va** bank testi | GitOps (Argo) + registry orqali topshirish |
| [`wb_clearing_frontend`](https://github.com/WeBaseLTD/wb_clearing_frontend) | yangi repoda CI/CD ni implement qildim | bitta hostda ikkita portda `docker run` |

---

## 1. Pipeline asoslari

Har bir repoda bir xil ikkita workflow oilasi bor. Bu ajratish muhim: ular
har xil savolga javob beradi va har xil yiqilishga haqli.

```
                      ┌────────────────────────────────────┐
  PR ochilgan/push ──►│ ci.yml — "kod to'g'rimi?"           │──► required status check
                      └────────────────────────────────────┘
                                     │ merge
                                     ▼
                      ┌────────────────────────────────────┐
                      │ deploy-*.yml — "chiqaramiz"        │──► test / prod server
                      └────────────────────────────────────┘
```

### 1.1 Trigger'lar

```yaml
# ci.yml — PR ochiq turganda, unga har push bo'lganda ishlaydi
on:
  pull_request:
    branches: [main, develop]
    types: [opened, synchronize, reopened]

# deploy-*.yml — faqat PR haqiqatan merge bo'lgandan keyin
on:
  pull_request:
    types: [closed]
    branches: [develop]
jobs:
  build:
    if: github.event.pull_request.merged == true   # closed ≠ merged
```

`types: [closed]` **rad etilgan** PR uchun ham ishga tushadi. `merged == true`
himoyasi bo'lmasa, PR ni merge qilmasdan yopish oldingi `develop` holatini
deploy qiladi — jimgina, tushunarsiz rollback. Bu himoya to'rtala repoda ham
har bir deploy jobida turadi.

### 1.2 Runner'lar

Hech narsa `ubuntu-latest` da ishlamaydi. Har bir job label orqali self-hosted
runner ga yo'naltirilgan:

```yaml
runs-on: [self-hosted, erp]         # build mashinasi (Docker + registry huquqi)
runs-on: [self-hosted, server-227]  # ilova haqiqatan turgan mashina
```

Buni hisobga olib loyihalash kerak bo'lgan oqibatlar:

- **Workspace run'lar orasida tozalanmaydi.** Qolib ketgan `sparse-checkout`
  konfiguratsiyasi, `node_modules` va eski `dist` papkalari saqlanib qoladi.
  `wb_imzo_frontend` har bir jobni ochiq `rm -rf "${GITHUB_WORKSPACE:?}"/*`
  bilan boshlaydi; `wb_cash_management_frontend` har checkout dan oldin
  sparse-checkout ni tiklaydi.
- **pnpm store umumiy va doimiy** — maqsad ham shu:
  `pnpm config set store-dir /etc/actions-runner/.pnpm-store` ikkinchi run da
  `pnpm install` ni deyarli bir zumda bajaradi.
- **`sudo` bo'lishi ham, bo'lmasligi ham mumkin.** `update-chart` jobi `yq` ni
  o'rnatish o'rniga `$RUNNER_TEMP` ga yuklab oladi.
- **Deploy runner — bu maqsad hostning o'zi**, shuning uchun deploy lokal
  `docker service update` / `docker run` dan iborat — SSH ham, kalit
  boshqaruvi ham kerak emas.

### 1.3 Concurrency

```yaml
concurrency:
  group: deploy-${{ github.base_ref }}
  cancel-in-progress: true      # CI uslubi: yangi commit g'olib
```

`cancel-in-progress` job idempotent bo'lganda (build, test) to'g'ri. Ko'p
maqsadli deploy uchun esa **noto'g'ri**: o'rtada bekor qilinsa bitta muhit
yangilanib, ikkinchisi eski qoladi. Shuning uchun
`wb_cash_management_frontend` bekor qilmaydi, navbatga qo'yadi:

```yaml
concurrency:
  group: deploy-vue2-develop
  cancel-in-progress: false
```

### 1.4 O'zgarmas deployment ID

```yaml
- id: generate-id
  working-directory: /tmp        # repo checkout hali bo'lmasligi mumkin
  run: echo "deployment-id=deploy-$(date +%Y%m%d%H%M%S)-$RANDOM" >> $GITHUB_OUTPUT
```

Har bir image o'zgarmas (immutable) tag bilan push qilinadi. `latest` esa
yoki qo'shimcha qulaylik tagi, yoki umuman yo'q, chunki:

- `latest` ni pull qilsangiz *oxirgi push qilingani* keladi — qaysi commit
  ishlab turganini aniqlay olmaysiz;
- Docker `latest` ni lokal keshlaydi, ya'ni `docker pull` jimgina hech nima
  qilmasligi mumkin;
- rollback uchun "shundan oldingi versiya" ning nomi kerak.

`wb_cash_management_frontend` **faqat** o'zgarmas tag ni push qiladi va uni
Telegram/Slack xabariga yozadi — bank GitHub Actions ni ochmasdan nusxa oladi.

### 1.5 Push dan oldin smoke test

Buzuq image ni push qilish build yiqilishidan battar — kimdir baribir uni
pull qiladi. Shuning uchun image avval build mashinasida ko'tariladi:

```yaml
- name: Smoke test before push
  env: { TEST_CONTAINER: smoke_test_x, TEST_PORT: 9999 }
  run: |
    docker run -d --name $TEST_CONTAINER -p $TEST_PORT:80 $IMAGE:$TAG
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$TEST_PORT)
    docker rm -f $TEST_CONTAINER
    case "$HTTP_STATUS" in 200|301|302) ;; *) exit 1 ;; esac
```

Bu build ushlay olmaydigan xatolarni ushlaydi: buzuq `nginx.conf`, noto'g'ri
yo'lga ko'chirilgan asset lar, darrov o'chib qoladigan konteyner.

### 1.6 Health check va rollback

Deploy jobi `docker run` ning 0 qaytarishiga hech qachon ishonmaydi. U
so'rovni takrorlaydi va orqaga qaytishni biladi:

```yaml
- name: Save previous image tag for rollback
  run: docker inspect --format='{{.Config.Image}}' $CONTAINER_NAME | sed 's/.*://' > $ROLLBACK_FILE

- name: Health check
  id: health
  run: |
    for i in $(seq 1 15); do
      HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 1 $HEALTH_URL || echo 000)
      case "$HTTP_STATUS" in 200|301|302) echo "health=passed" >> $GITHUB_OUTPUT; exit 0 ;; esac
      sleep 1
    done
    echo "health=failed" >> $GITHUB_OUTPUT; exit 1

- name: Rollback on failure
  if: failure() && steps.health.outputs.health == 'failed'
```

`if: failure() && steps.health.outputs.health == 'failed'` — quruq `failure()`
emas. *Pull* yoki *login* dagi xato rollback ni ishga tushirmasligi kerak;
qaytadigan joy yo'q va eski konteyner hali ham soz turibdi.

### 1.7 Bildirishnomalar

`notify` jobi `if: always()` bilan ishlaydi, `build-and-push` va `deploy` ga
bog'lanadi va xabarni `needs.deploy.result` ga qarab tanlaydi. PR matnini
(`## Summary`, `## Task Reference`, `## Changes Made` — bizning
`PULL_REQUEST_TEMPLATE.md` majburlaydigan bo'limlar) `sed` bilan parse qiladi,
shuning uchun Telegram xabari commit SHA emas, o'qiladigan changelog bo'ladi.

Auditoriya bo'yicha ajratilgan: **Telegram faqat muvaffaqiyatda** (jamoa
kanali, testerlar), **Slack har qanday natijada** (muhandislik kanali,
xatolar bilan birga).

---

## 2. Docker: bitta multi-stage fayl, bir nechta rol

Hamma joyda asos bir xil — Node da yig'iladi, nginx dan beriladi, faqat
`dist` chiqadi:

```dockerfile
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.15.2 --activate
COPY package.json pnpm-lock.yaml ./     # avval dependency layer
RUN pnpm install --frozen-lockfile
COPY . .                                # source layer — har commitda buziladi
ARG BUILD_MODE=production
RUN pnpm build:${BUILD_MODE}

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

Ko'rinishidan muhimroq uchta narsa:

**pnpm versiyasini qadang.** `wb_imzo_frontend` da dastlab
`corepack prepare pnpm@latest` turgan edi — bir kuni `latest` lockfile
versiyasidan o'tib ketdi va `--frozen-lockfile` yiqila boshladi. Runner
ishlatadigan versiyaga qadab qo'ying.

**`--target` quality gate ni tekinga oladi.** `docker build --target builder`
build stage'idan keyin to'xtaydi, ya'ni CI type-check va lint ni ilova
yig'iladigan aynan o'sha image ichida yurgiza oladi:

```yaml
docker build --target builder -t quality-check:${{ github.sha }} .
docker run --rm quality-check:${{ github.sha }} pnpm vue-tsc --noEmit
```

`wb_cash_management_frontend` bundan ham nariga boradi: `deps` dan ajralib
chiqadigan alohida `lint` stage'i bor, shuning uchun lint o'rnatilgan
dependency layer ini qayta ishlatadi.

**Build vaqti va run vaqti konfiguratsiyasi.** Vite `VITE_*` ni **build
vaqtida** bundle ichiga inline qiladi — har muhit uchun alohida image, boshqa
yo'li yo'q. nginx ga kerak narsa esa run vaqtida qolishi mumkin:
`wb_clearing_frontend` `nginx.conf.template` ni `/etc/nginx/templates/` ga
qo'yadi, nginx image ining o'z entrypoint i konteyner ko'tarilganda
`${API_HOST}` ni `envsubst` qiladi. Bir xil image, har muhitga
`-e API_HOST=...`.

---

## 3. Loyihalar bo'yicha

### 3.1 `wb_imzo_frontend` — mavjud pipeline ni tezlashtirish

Pipeline bor edi va ishlardi. Faqat hamma ishni ikki marta qilardi.

**Oldin** (`quality-checks` → `build-and-push`, ketma-ket ikkita job):

```
quality-checks:  docker build --target builder   → pnpm install + vite build
                 docker run ... vue-tsc --noEmit
build-and-push:  docker build                    → pnpm install + vite build  (yana)
```

`COPY . .` har commitda layer cache ni buzadi, shuning uchun ikkinchi build
butun install va butun Vite build ni qaytadan bajarardi. Har deployga ikkita
to'liq build, biri ikkinchisidan keyin.

**Keyin** — [`af6f302` · PR #418](https://github.com/WeBaseLTD/wb_imzo_frontend/pull/418)
*"perf: collapse quality-checks into Docker build and add pnpm cache mount"*:

1. **`quality-checks` jobi yo'q qilindi.** Type check Dockerfile ichiga,
   build bilan bitta `RUN` ga ko'chdi:

   ```dockerfile
   RUN pnpm run type-check && pnpm run build:${BUILD_MODE}
   ```

   Ikkita build o'rniga bitta, va type xatosi baribir image ning umuman
   paydo bo'lishiga yo'l qo'ymaydi.

2. **pnpm store uchun BuildKit cache mount:**

   ```dockerfile
   # syntax=docker/dockerfile:1.7
   RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
       pnpm install --frozen-lockfile --store-dir=/pnpm-store
   ```

   Cache mount oddiy layer dan farqli o'laroq layer buzilganda ham
   saqlanadi — istalgan source faylini tahrirlash uni yo'q qilmaydi. Runner
   paketlarni qaytadan yuklab olmasdan store dan link qiladi. Job env ida
   `DOCKER_BUILDKIT: "1"` kerak.

3. **Qat'iy `sleep` lar polling ga almashtirildi.** `sleep 3` va
   `RETRY_INTERVAL=2` o'rniga `curl --max-time 1` bilan 1 sekundlik poll
   sikli — smoke test da ham, health check da ham. Endi pipeline eng yomon
   holat taymerini kutmasdan, konteyner javob berishi bilan tugaydi.

4. **Type check ma'nosini yo'qotmadi.** Uni Dockerfile ga ko'chirish faqat
   shuning uchun xavfsiz: u artefakt paydo bo'lishidan *oldin* ishlaydi —
   yiqilgan type check `docker build` ni yiqitadi, demak image yaratilmaydi
   va hech narsa push qilinmaydi.

Yana ikkita o'zgarish:

- [`571df3f` · PR #462](https://github.com/WeBaseLTD/wb_imzo_frontend/pull/462) —
  `ci.yml` Webase pipeline standartiga moslashtirildi: o'zgargan fayllarni
  aniqlash (Vitest uchun tayyor), `dist` ni 7 kunlik artifact sifatida
  yuklash, va lint *pre-commit* ishi ekanini hujjatlashtirish — hook uni
  allaqachon bloklaydi, CI da qayta yurgizish faqat vaqt yeydi.
- [`14c408ff`](https://github.com/WeBaseLTD/wb_imzo_frontend/commit/14c408ffc900749fffd387e8b685a3829e2a5bef)
  (to'g'ridan-to'g'ri `develop` ga push qilingan, PR siz) — develop deploy i
  `docker run` dan **Docker Swarm** ga ko'chdi:

  ```yaml
  docker service update \
    --image $IMAGE:$DEPLOYMENT_ID \
    --update-order stop-first \
    --update-failure-action rollback \
    --with-registry-auth \
    Staging_frontend_web_imzo_frontend
  ```

  Bu qo'lda yozilgan ~96 qator rollback mantiqini o'chirdi (eski image ni
  tag qil, `:previous` deb push qil, yiqilsa qaytarib pull qil). Swarm
  oldingi service spec ini o'zi saqlaydi, shuning uchun rollback —
  `docker service rollback $SERVICE_NAME`. `--with-registry-auth` runner ning
  registry login ini Swarm node lariga uzatadi — usiz node lar yopiq image ni
  pull qila olmaydi. Health check endi **ikkalasini ham** talab qiladi:
  `replicas == 1/1` va HTTP 200/301/302.

`main` hamon `webimzo` runner ida oddiy konteyner usulida deploy bo'ladi
(`webimzo-front`, 8880-port) — production Swarm ga ko'chirilmagan.

**Pull request lar**

- [#270](https://github.com/WeBaseLTD/wb_imzo_frontend/pull/270) `chore/webimzo-ci-cd` — bu ish boshlangan asos: env fayllar standartlashtirildi, multi-stage Dockerfile, birinchi CI/CD workflow lar
- [#282](https://github.com/WeBaseLTD/wb_imzo_frontend/pull/282) `chore/cleanup-cicd` — workflow tozalash, `webimzo` branchi `main` ga qayta nomlandi
- [#418](https://github.com/WeBaseLTD/wb_imzo_frontend/pull/418) `perf/ci-optimize` — **optimizatsiya**: quality-checks Docker build ichiga yig'ildi, pnpm cache mount, sleep o'rniga polling
- [#462](https://github.com/WeBaseLTD/wb_imzo_frontend/pull/462) `chore/frontend-standardization` — `ci.yml` Webase standartiga moslashtirildi, CONTRIBUTING va PR template
- [`14c408ff`](https://github.com/WeBaseLTD/wb_imzo_frontend/commit/14c408ffc900749fffd387e8b685a3829e2a5bef) — Docker Swarm deploy, PR siz to'g'ridan-to'g'ri `develop` ga push qilingan

### 3.2 `wb_edu_management_frontend` — noldan qurish

Hech narsa yo'q edi. Qanday tartibda qurilgani va nega:

| Qadam | Commit | Nima tushdi |
| --- | --- | --- |
| 1 | [`3a60656`, `af79a66`, `568ee33` · PR #2](https://github.com/WeBaseLTD/wb_edu_management_frontend/pull/2) | `ci.yml`: install → lint → type check |
| 2 | [`81a5d66` · PR #4](https://github.com/WeBaseLTD/wb_edu_management_frontend/pull/4) | `deploy-develop.yml`, `deploy-main.yml` (va keyin olib tashlangan `version-bump.yml`) |
| 3 | [`79e0e42` · PR #5](https://github.com/WeBaseLTD/wb_edu_management_frontend/pull/5) | `notify` jobi — Telegram va Slack |
| 4 | [`ebbd413` · PR #10](https://github.com/WeBaseLTD/wb_edu_management_frontend/pull/10), [`5077f45` · PR #11](https://github.com/WeBaseLTD/wb_edu_management_frontend/pull/11), [`1fd581c` · PR #23](https://github.com/WeBaseLTD/wb_edu_management_frontend/pull/23) | registry login lari bilan kurash (pastda) |
| 5 | [`bbfb9dd`, `a63f40c` · PR #84](https://github.com/WeBaseLTD/wb_edu_management_frontend/pull/84) | PR pipeline ida unit va E2E testlar, Trivy skanerlash |
| 6 | [`d570814` · PR #187](https://github.com/WeBaseLTD/wb_edu_management_frontend/pull/187), [`78335ab` · PR #205](https://github.com/WeBaseLTD/wb_edu_management_frontend/pull/205) | design-token va i18n gate lari |

**Deploy pipeline i** — to'rtta job: `quality-checks → build-and-push →
deploy → notify`, va quality gate bilan parallel ishlaydigan
`security-scan-source`:

```
quality-checks ──┐
                 ├─► build-and-push ─► deploy ─► notify (always)
security-scan ───┘
```

- Quality check lar `--target builder` ichida ishlaydi, shuning uchun CI va
  image toolchain bo'yicha bayt-ma-bayt kelishadi.
- Trivy **ikki marta** ishlaydi: source ustidan `trivy fs`
  (`--scanners vuln,secret` — commit qilingan kalitni ham ushlaydi) va smoke
  testdan oldin yig'ilgan image ustidan `trivy image`. Ikkalasi ham
  `--severity CRITICAL --ignore-unfixed --exit-code 1`: faqat haqiqatan
  tuzatib bo'ladigan critical topilmalar deploy ni bloklaydi, aks holda gate
  bir hafta ichida e'tibordan qoladi.
- Trivy **client/server rejimida** ishlaydi (`--server http://127.0.0.1:4954`),
  shuning uchun zaifliklar bazasi har jobda emas, server tomonidan bir marta
  yuklab olinadi.
- Deploy: oldingi tag ni saqlash → pull → stop/rm/run → health check →
  `/tmp/tiu-frontend_previous_tag` dan rollback.

**Bu repoda qattiq turgani — CI pipeline i**, build dan oldin oltita gate:

```yaml
- run: pnpm exec vue-tsc --noEmit
- run: pnpm lint
- run: pnpm i18n:pull --soft && pnpm i18n:check   # PR #205
- run: bash scripts/check-tokens.sh --range origin/${{ github.base_ref }}  # PR #187
- run: pnpm test
- run: pnpm exec playwright install chromium && pnpm test:e2e
```

Ulardan ikkitasi ko'chirib olishga arziydi:

- **i18n gate** — biror kalit locale da yo'q bo'lsa PR ni yiqitadi.
  Production da topilgan tarjima xatosi redeploy turadi; PR da topilgani bir
  qator turadi.
- **Design-token gate, diff ga bog'liq** — `--range origin/<base>` faqat shu
  PR **qo'shayotgan** qatorlarni tekshiradi. Qattiq yozilgan hex qiymatlarning
  eski qarzi hech kimni bloklamaydi, lekin yangisi o'tmaydi. Birinchi kunda
  o'z o'zgarishingizga aloqasi yo'q sabab bilan yiqiladigan gate ikkinchi kuni
  o'chiriladi; uni diff bilan cheklash yashovchan qiladi. Shu skript husky
  pre-commit hook ida `--staged` bilan ham ishlaydi.

**Yo'lda hal qilingan muammolar:**

- *Registry secret lari.* [`ebbd413` · PR #10](https://github.com/WeBaseLTD/wb_edu_management_frontend/pull/10) → [`5077f45` · PR #11](https://github.com/WeBaseLTD/wb_edu_management_frontend/pull/11) → [`1fd581c` · PR #23](https://github.com/WeBaseLTD/wb_edu_management_frontend/pull/23):
  develop va main workflow lari bitta registry uchun har xil secret nomiga
  ketib qolgan edi. `DOCKER_REGISTRY_USERNAME` / `DOCKER_REGISTRY_TOKEN` ga
  birlashtirildi.
- *`fetch-depth: 0`.* Token check base branch ga nisbatan diff oladi, standart
  shallow checkout da esa diff qiladigan base branch yo'q.
- *Playwright va apt lock* ([`1379fd7` · PR #127](https://github.com/WeBaseLTD/wb_edu_management_frontend/pull/127)).
  `playwright install --with-deps` `apt-get` ni chaqiradi va umumiy runner dagi
  boshqa jarayonlar bilan vaqti-vaqti bilan deadlock ga tushardi. Doimiy
  runner da OS darajasidagi brauzer paketlari allaqachon o'rnatilgan, shuning
  uchun `--with-deps` olib tashlandi — bu flag bir martalik CI mashinalari
  uchun.
- *Sentry source map lari* ([`853481f` · PR #71](https://github.com/WeBaseLTD/wb_edu_management_frontend/pull/71), [`6939389` · PR #72](https://github.com/WeBaseLTD/wb_edu_management_frontend/pull/72)).
  `SENTRY_AUTH_TOKEN` `--build-arg` sifatida uzatiladi va qo'shtirnoqqa
  olinishi shart: `--build-arg "SENTRY_AUTH_TOKEN=${{ secrets.SENTRY_AUTH_TOKEN }}"`.
  Qo'shtirnoqsiz, ichida shell metabelgisi bor token build buyrug'ini buzadi.

**Pull request lar**

- [#2](https://github.com/WeBaseLTD/wb_edu_management_frontend/pull/2) `dev` — birinchi `ci.yml`: install, lint, type check
- [#4](https://github.com/WeBaseLTD/wb_edu_management_frontend/pull/4) `feat/ci-cd` — `deploy-develop.yml` va `deploy-main.yml`
- [#5](https://github.com/WeBaseLTD/wb_edu_management_frontend/pull/5) `feat/ci-cd` — `notify` jobi (Telegram + Slack)
- [#10](https://github.com/WeBaseLTD/wb_edu_management_frontend/pull/10) `feat/ci-cd` — registry username/password tuzatildi
- [#11](https://github.com/WeBaseLTD/wb_edu_management_frontend/pull/11) `feat/ci-cd` — registry nomi tuzatildi
- [#23](https://github.com/WeBaseLTD/wb_edu_management_frontend/pull/23) `ci/unify-docker-registry-secrets` — ikkala workflow uchun bitta secret nomi
- [#26](https://github.com/WeBaseLTD/wb_edu_management_frontend/pull/26) `ci/unify-docker-registry-secrets` — registry image yo'li va production runner label i
- [#35](https://github.com/WeBaseLTD/wb_edu_management_frontend/pull/35) `feature/sync-develop-registry-login` — deploy jobidan inline docker login olib tashlandi, fayl orqali rollback
- [#71](https://github.com/WeBaseLTD/wb_edu_management_frontend/pull/71) `feat/sentry-integration` — Sentry error tracking va Docker build dan source map yuklash
- [#72](https://github.com/WeBaseLTD/wb_edu_management_frontend/pull/72) `feat/sentry-integration` — `--build-arg` dagi `SENTRY_AUTH_TOKEN` qo'shtirnoqqa olindi
- [#84](https://github.com/WeBaseLTD/wb_edu_management_frontend/pull/84) `chore/add-trivy` — Trivy fs va image skanerlari, PR pipeline ida unit va E2E testlar
- [#127](https://github.com/WeBaseLTD/wb_edu_management_frontend/pull/127) `feature/finance-dept-label` — `playwright install --with-deps` olib tashlandi (umumiy runner da apt lock)
- [#128](https://github.com/WeBaseLTD/wb_edu_management_frontend/pull/128) `ci/trivy-server-localhost` — Trivy client i lokal skan serveriga yo'naltirildi
- [#187](https://github.com/WeBaseLTD/wb_edu_management_frontend/pull/187) `chore/design-token-checks` — pre-commit va CI da diff ga bog'liq design-token gate
- [#205](https://github.com/WeBaseLTD/wb_edu_management_frontend/pull/205) `chore/i18n-missing-key-check` — tarjima kaliti yo'q bo'lsa build yiqiladi

### 3.3 `wb_cash_management_frontend` — bitta commit, ikkita iste'molchi

Talab: bir xil versiya **bizning test muhitimizga** ham, **bankning test
muhitiga** ham yetib borishi kerak. Ular har xil tarmoqda, har xil registry,
har xil API va har xil mexanizm bilan yangilanadi.

| Muhit | Registry | Kim uchun | Qanday yetkaziladi |
| --- | --- | --- | --- |
| `xb-test` | `registry.webase.uz/banking/xb_frontend` | biz, `xbdev.apptest.uz` | GitOps — Argo `helm_charts` ni kuzatadi |
| `bank-test` | `hub.xb.uz/cashbox/test-front` | bank | image push qilinadi, bank o'zi pull qiladi |

Vite `VITE_*` ni build vaqtida inline qiladi, shuning uchun "bitta image,
ikkita muhit" imkonsiz — bitta commit dan ikkita image bo'lishi shart.

```
PR merged → develop-vue2-backup
     │
   [prepare]         bitta deployment-id + maqsadlar ro'yxati (matrix uchun)
     │
   [quality-checks]  docker build --target lint   (continue-on-error)
     │
   [build-and-push]  matrix: xb-test, bank-test   (max-parallel: 1)
     │               build → smoke test → push  (faqat o'zgarmas tag)
     │
   [update-chart]    faqat VALUES_FILE to'ldirilgan muhitlar
     │               helm_charts: .image.tag = <tag>  → Argo sync qiladi
     │
   [notify]          Telegram + Slack, ikkala tag ko'rsatiladi
```

**Butun yechimni ushlab turgan qaror: konfiguratsiya repoda turadi, GitHub da
emas.** Har muhit uchun bitta commit qilingan fayl,
`apps/xb/.env.<muhit>`:

```dotenv
# apps/xb/.env.bank-test
VITE_API_BASE_URL=http://172.28.2.191:30805
IMAGE=hub.xb.uz/cashbox/test-front
VALUES_FILE=
LATEST_TAG=
```

Fayl ikki marta o'qiladi — `VITE_*` kalitlar uchun
`vite build --mode <muhit>` tomonidan, yetkazish kalitlari uchun esa
workflow ning o'zi tomonidan (`set -a; . "$ENV_FILE"; set +a`). `VITE_`
prefiksi yo'q kalitlar bundle ga hech qachon tushmaydi; bu Vite ning o'z
qoidasi, qo'lda yozilgan filtr emas.

Bundan yutuq: **yangi muhit qo'shish = yangi `.env.<nom>` fayli va
`build:<nom>` skripti. Workflow ga tegilmaydi.** GitHub Environments ham,
`vars.*` ham, environment secret lari ham ishlatilmaydi, konfiguratsiya esa
PR da ko'rib chiqiladi va git tarixiga ega.

Yetkazish usuli — kod ichidagi shart emas, ma'lumot:

- `VALUES_FILE` to'ldirilgan → `update-chart` `WeBaseLTD/helm_charts` ni
  klon qiladi, `yq` bilan `.image.tag` ni yozadi, push qiladi. Argo/Helm
  o'zi tortadi.
- `VALUES_FILE` bo'sh → faqat push. Bank tag ni o'zi pull qiladi.

Registry hosti hisoblab olinadi, shuning uchun bitta push qadami ikkala
registry ga xizmat qiladi:

```bash
REGISTRY="${IMAGE%%/*}"          # registry.webase.uz | hub.xb.uz
echo "$REGISTRY_PASSWORD" | docker login -u "$REGISTRY_USER" --password-stdin "$REGISTRY"
```

**Saqlashga arziydigan tafsilotlar:**

- Matritsada `max-parallel: 1` — umumiy runner da ikkita parallel Vite build
  xotirani tugatadi (builder allaqachon
  `NODE_OPTIONS=--max-old-space-size=4096` qo'yadi).
- `fail-fast: false` — bank build i yiqilsa ham bizning muhitimiz chiqadi.
- `update-chart` da **`if:` yo'q** va u `build-and-push` muvaffaqiyatini
  talab qiladi: chart ni hech qachon push qilinmagan tag ga yo'naltirishdan
  ko'ra, uni yangilamaslik yaxshiroq.
- `helm_charts` ga push **5 marta takrorlanadi**, urinishlar orasida
  `git reset --hard origin/main`. U repoga bir nechta loyiha push qiladi,
  shuning uchun rad etilgan push xato emas, oddiy hol. 5 urinishdan keyin
  `exit 1` — jimgina o'tkazib yuborilsa, pipeline yashil bo'lib turadi-yu,
  chart yangilanmagan bo'ladi.
- `yq` o'rnatilmagan bo'lsa `$RUNNER_TEMP` ga yuklab olinadi (runner da
  `sudo` yo'q), klon esa yangi `$RUNNER_TEMP/helm_charts` ga tushadi, chunki
  self-hosted workspace tozalanmaydi.
- `HELM_CHARTS_PAT` bo'lmasa **ogohlantirib o'tkazib yuboradi**, yiqilmaydi —
  PAT kelguncha build va push ishlayveradi.
- Lint `continue-on-error: true`: eski Vue 2 kodida katta lint qarzi bor. U
  Actions da qizil ko'rinadi, lekin deploy ni bloklamaydi. Qarz yopilgach shu
  bitta qatorni o'chirish uni bloklovchi gate ga aylantiradi.

Shu repodagi ikkita oldingi tuzatish:

- [`46997ae` · PR #148](https://github.com/WeBaseLTD/wb_cash_management_frontend/pull/148) —
  branch ruleset i `CI Pipeline` status check ini talab qilardi, lekin uni
  hech bir workflow bermasdi, natijada **har bir PR abadiy bloklangan edi**.
  Sababi: workflow fayli `.github/workflows/ci.yml` emas, `workflows/ci.yml`
  da turardi — GitHub uni umuman o'qimagan.
- [`71d89c0` · PR #148](https://github.com/WeBaseLTD/wb_cash_management_frontend/pull/148) —
  quality check lar **nginx** image iga qarshi ishlardi (u yerda `pnpm` yo'q)
  va `|| true` bilan bo'g'ilgan edi, ya'ni hech qachon haqiqatan ishlamagan.
  `--target builder` ga o'tkazilib, `|| true` olib tashlandi.

> ⚠️ Ma'lum muammo, ataylab qilingan va hujjatlashtirilgan: `hub.xb.uz`
> login i push qadamida **qattiq yozilgan**. `BANK_REGISTRY_USER` /
> `BANK_REGISTRY_PASSWORD` repo secret lari allaqachon bor — guard blokini
> o'chirish kifoya. Buni yopish kerak; workflow faylidagi parol git tarixida
> abadiy qoladi.

To'liq operatsion qo'llanma (troubleshooting jadvali, qo'lda deploy,
`helm_charts` revert orqali rollback) o'sha repoda: `docs/guides/CI_CD.md`.

**Pull request lar**

- [#148](https://github.com/WeBaseLTD/wb_cash_management_frontend/pull/148) `fix/lint-vue3-migration` — `.github/workflows/ci.yml` yaratildi (hech bir workflow bermayotgan `CI Pipeline` check i), quality gate haqiqiy qilindi
- [#156](https://github.com/WeBaseLTD/wb_cash_management_frontend/pull/156) `chore/xb-registry-cash-front` — registry `xbdev/cash-front` ga o'tkazildi
- [#185](https://github.com/WeBaseLTD/wb_cash_management_frontend/pull/185) `feat/ci-cd-develop-vue2-backup` — **ko'p muhitli workflow**: matrix build, GitOps `update-chart`, `hub.xb.uz` ga yetkazish, `deploy` jobi olib tashlandi
- [#186](https://github.com/WeBaseLTD/wb_cash_management_frontend/pull/186) `feat/ci-cd-develop-vue2-backup` — konfiguratsiya repoga ko'chdi: `apps/xb/.env.xb-test` / `.env.bank-test`
- [#187](https://github.com/WeBaseLTD/wb_cash_management_frontend/pull/187) `feat/ci-cd-develop-vue2-backup` — `docs/guides/CI_CD.md`, eskirgan `deploy-xb-develop.yml` o'chirildi

### 3.4 `wb_clearing_frontend` — yangi repoda CI/CD

Turborepo monorepo sifatida boshlangan (`apps/admin` + `apps/landing`), har
ilova uchun alohida workflow bilan. Landing olib tashlanganda
[`8b6b31d` · PR #1](https://github.com/WeBaseLTD/wb_clearing_frontend/pull/1)
uni bitta ilovaga yig'di: `deploy-admin-dev.yml` → `deploy-develop.yml`,
`deploy-landing-dev.yml` → `deploy-main.yml`, `apps/admin/Dockerfile` →
root dagi `Dockerfile`, va haqiqiy `ci.yml` qo'shildi.

Uchta workflow, standart tuzilish:

- `ci.yml` — type check → lint → build → `dist` ni yuklash. Node 22.
- `deploy-develop.yml` — `BUILD_MODE=dev` → `wb_clearing_admin`, 8091-port.
- `deploy-main.yml` — `BUILD_MODE=prod` → `wb_clearing_prod`, 8074-port.

Ikkalasi ham bitta `217-nginx` runner iga, har xil portga deploy qiladi.

**Bu repoga xos narsa: API hosti run vaqtidagi o'zgaruvchi.** Frontend
backend bilan o'z konteyneri ichidagi nginx orqali gaplashadi, shuning uchun
bitta image hamma muhitga xizmat qila oladi:

```dockerfile
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
ENV API_HOST=api-clearing.apptest.uz    # standart = test
```

```nginx
location /api/ {
  proxy_pass https://${API_HOST};
  proxy_ssl_server_name on;             # ← shart
  proxy_set_header Host ${API_HOST};
}
location /hubs/ {                        # SignalR / WebSocket
  proxy_pass https://${API_HOST};
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
}
```

`/etc/nginx/templates/` dagi fayllarni nginx image ining o'z entrypoint i
konteyner ko'tarilganda `envsubst` qilib `/etc/nginx/conf.d/` ga qo'yadi,
shuning uchun prod qiymatni `docker run` da almashtiradi:

```yaml
env:
  API_HOST: api-clearing.webase.uz
run: docker run --name $CONTAINER_NAME -e API_HOST=$API_HOST -p 8074:80 -d -t $IMAGE:$TAG
```

Eng ko'p vaqt olgan xato — `proxy_ssl_server_name on`
([`3ddf0df` · PR #4](https://github.com/WeBaseLTD/wb_clearing_frontend/pull/4)):
SNI bo'lmasa upstream o'zining **standart vhost** idan javob berardi va API
JSON o'rniga `200` bilan HTML sahifa qaytarardi. Javob 200 bo'lgani uchun,
frontend uni parse qilmaguncha hech narsa buzilganga o'xshamasdi.

Proxy CORS ni ham butunlay olib tashlaydi: brauzer faqat o'z origin i bilan
gaplashadi.

`ci.yml` da test qadami yo'q va buni ochiq yozib qo'yilgan:

```yaml
# ponytail: no unit/e2e tests in the repo yet — add `pnpm test` here once
# test files exist (vitest run fails on an empty suite otherwise).
```

**Pull request lar**

- [#1](https://github.com/WeBaseLTD/wb_clearing_frontend/pull/1) `feat/single-app` — monorepo bitta ilovaga yig'ildi, `ci.yml` + `deploy-develop.yml` + `deploy-main.yml`, root dagi `Dockerfile`
- [#4](https://github.com/WeBaseLTD/wb_clearing_frontend/pull/4) `fix/api-proxy-upstream` — `proxy_ssl_server_name on`, API JSON o'rniga 200 + HTML qaytargan SNI xatosi

---

## 4. Yonma-yon

| | imzo | edu_management | cash_management | clearing |
| --- | --- | --- | --- | --- |
| CI gate lari | type check, build | type check, lint, i18n, token, unit, E2E | lint (bloklamaydi) | type check, lint, build |
| Xavfsizlik skani | — | Trivy fs + image | — | — |
| Quality gate qayerda | Dockerfile `RUN` | `--target builder` | `--target lint` stage | `--target builder` |
| Build kesh | BuildKit cache mount | layer cache | BuildKit cache mount | layer cache |
| Tag lar | `deploy-<ts>-<rand>` + `latest` | `deploy-<ts>-<rand>` + `latest` | faqat `<muhit>-deploy-<ts>-<rand>` | `<branch>-deploy-<ts>-<rand>` |
| Yetkazish | Swarm service update (dev) | `docker run` | GitOps + registry orqali | `docker run` |
| Rollback | `docker service rollback` | `/tmp` dagi oldingi tag | `helm_charts` revert | `/tmp` dagi oldingi tag |
| Muhitlar | 2 (develop, main) | 2 (develop, main) | 1 branchdan 2 maqsad | 2 (develop, main) |
| Konfiguratsiya manbai | workflow `env:` | workflow `env:` | commit qilingan `.env.<muhit>` | workflow `env:` + run vaqtida `-e` |

---

## 5. Xulosalar

1. **`types: [closed]` "merged" degani emas.** Har bir deploy jobini
   `github.event.pull_request.merged == true` bilan himoyalang.
2. **Workflow fayli `.github/workflows/` da bo'lishi shart.** Hech bir
   workflow bermaydigan required status check har bir PR ni abadiy bloklaydi
   va hech qayerda xato xabari chiqmaydi.
3. **Noto'g'ri image ga qarshi ishlaydigan yoki `|| true` bilan bo'g'ilgan
   quality gate — gate yo'qligidan battar**: yashil hisobot beradi va hech
   kim boshqa qaramaydi.
4. **Bir narsani ikki marta build qilmang.** Dockerfile allaqachon install va
   build qilayotgan bo'lsa, type check ni ham o'sha `RUN` ichida yurgizing.
   Bitta build, lekin xato baribir image ni to'xtatadi.
5. **Paket store lari uchun BuildKit cache mount layer keshdan ustun.** Layer
   kesh birinchi source o'zgarishida o'ladi, cache mount esa yo'q.
6. **`sleep` emas, poll qiling.** `sleep 3` har run da 3 sekund turadi;
   1 sekundlik poll konteyner qancha kerak bo'lsa shuncha turadi.
7. **Paket menejerini qadab qo'ying.** Dockerfile dagi `pnpm@latest` — siz
   hech narsa o'zgartirmagan kuni buziladigan build.
8. **Har doim o'zgarmas tag.** `latest` "qaysi versiya ishlab turibdi?"
   degan savolni javobsiz qoldiradi va rollback ni imkonsiz qiladi.
9. **Repodagi konfiguratsiya GitHub dagisidan ustun** — ko'rib chiqiladi,
   diff qilinadi, tarixi bor, va yangi muhit qo'shish workflow ni tahrirlash
   bo'lmay qoladi.
10. **Yangi gate ni diff bilan cheklang.** Birinchi kunda o'z o'zgarishingizga
    aloqasi yo'q sabab bilan yiqiladigan check ikkinchi kuni o'chiriladi.
11. **Self-hosted runner — bu uzoq yashaydigan mashina, yangi VM emas.**
    Workspace ni tozalang, paket store ni qayta ishlating, `sudo` bor deb
    o'ylamang va har run da tizim paketlarini o'rnatmang.
12. **Faqat orqaga qaytara oladigan xatoda rollback qiling** —
    `failure() && steps.health.outputs.health == 'failed'`, quruq `failure()`
    emas.
13. **Orkestrator allaqachon hal qilgan bo'lsa, o'zingiznikini o'chiring.**
    Docker Swarm ning `--update-failure-action rollback` i qo'lda yozilgan
    ~96 qator tag-va-tiklash mantiqini almashtirdi.
