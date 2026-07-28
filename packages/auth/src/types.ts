// wb_imzo'da permission'lar oddiy string edi — `can("LicenseView")`. Typo faqat runtime'da
// bilinardi. Bu yerda union type: xato yozsangiz build yiqiladi.
export type Permission = 'user.view' | 'user.edit' | 'role.manage'

export interface User {
  id: string
  name: string
  permissions: Permission[]
}

export interface SessionResponse {
  accessToken: string
  expiresIn: number
  user: User
}

// wb_imzo'da `to.meta.permission as string` — cast, tekshiruv emas.
// Augmentation bilan `meta.permissions` typed bo'ladi va noto'g'ri permission build'da ushlanadi.
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    permissions?: Permission[]
  }
}
