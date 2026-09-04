export interface AuthUser {
  id: number
  name: string
  email: string
  role: 'MEMBER' | 'MANAGER'
}

export function useAuth() {
  const user = useState<AuthUser | null>('auth:user', () => null)
  const initialized = useState('auth:initialized', () => false)
  const requestFetch = useRequestFetch()

  // Resolve the session once per app load; the httpOnly cookie travels
  // automatically (useRequestFetch forwards it during SSR).
  async function fetchMe() {
    if (initialized.value) return
    initialized.value = true
    user.value = await requestFetch<{ user: AuthUser }>('/api/auth/me')
      .then((res) => res.user)
      .catch(() => null)
  }

  async function login(email: string, password: string) {
    const res = await $fetch<{ user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    user.value = res.user
  }

  async function register(name: string, email: string, password: string) {
    const res = await $fetch<{ user: AuthUser }>('/api/auth/register', {
      method: 'POST',
      body: { name, email, password },
    })
    user.value = res.user
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
    navigateTo('/login')
  }

  return { user, initialized, fetchMe, login, register, logout }
}
