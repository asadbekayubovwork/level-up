import type { GlobalThemeOverrides } from '@webaseltd/ui'

// Design token'lar shu yerda — bitta joyda. Apps'lar rangni qo'lda yozmaydi.
// MB-03 da bu tokens.json ga chiqariladi va Storybook'da hujjatlanadi.
export const tokens = {
  primary: '#3b82f6',
  primaryHover: '#60a5fa',
  primaryPressed: '#2563eb',
  danger: '#ef4444',
  radius: '6px',
} as const

export const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: tokens.primary,
    primaryColorHover: tokens.primaryHover,
    primaryColorPressed: tokens.primaryPressed,
    errorColor: tokens.danger,
    borderRadius: tokens.radius,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
}
