import { computed } from 'vue'
import {
  can,
  isRestoring,
  loginWithGitHub,
  loginWithPassword,
  logout,
  restoreSession,
  user,
} from './session'

export { api, ApiError } from './client'
export { checkAuth, checkPermissions, createAuthGuard } from './guard'
export type { AuthCheck, AuthGuardOptions } from './guard'
export type { Permission, SessionResponse, User } from './types'

export function useAuth() {
  return {
    user,
    isRestoring,
    isAuthenticated: computed(() => user.value !== null),
    can,
    loginWithPassword,
    loginWithGitHub,
    logout,
    restoreSession,
  }
}
