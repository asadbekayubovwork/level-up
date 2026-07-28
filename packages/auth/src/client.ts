import { clearSession, getAccessToken, isExpiringSoon, refresh } from './session'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

/**
 * Auth'li fetch wrapper.
 *
 * Refresh PROAKTIV — so'rovdan oldin token muddati tekshiriladi (wb_imzo'dagi
 * `keycloak.updateToken(30)` pattern'i). Foydalanuvchi 401 ko'rmaydi, retry logikasi
 * kerak emas, parallel so'rovlar refresh'ni takrorlamaydi.
 *
 * 401 baribir kelsa (server tokenni bekor qilgan) — bir marta refresh + retry, keyin taslim.
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (getAccessToken() && isExpiringSoon()) await refresh()

  let res = await send(path, init)

  if (res.status === 401) {
    // ponytail: aynan bitta retry. Sikl bo'lmasligi uchun bayroq ham kerak emas.
    const ok = await refresh()
    if (!ok) {
      clearSession()
      throw new ApiError(401, 'Sessiya tugadi')
    }
    res = await send(path, init)
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`)
  }

  return (await res.json()) as T
}

function send(path: string, init: RequestInit): Promise<Response> {
  const token = getAccessToken()
  return fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: {
      ...init.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}
