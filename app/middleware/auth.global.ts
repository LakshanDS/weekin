// Single global guard: resolves the session, then enforces
//   public pages   — login/register (redirect authed users home)
//   protected pages — require a session (redirect to /login?redirect=…)
//   role pages     — definePageMeta({ role: 'MANAGER' }) restricts by role
//   pending users  — locked to the /pending waiting screen until approved
export default defineNuxtRouteMiddleware(async (to) => {
  const { user, fetchMe } = useAuth()
  await fetchMe()

  const isPublic = to.meta.public === true
  if (!user.value && !isPublic) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
  if (user.value && isPublic) {
    return navigateTo('/')
  }

  if (user.value?.status === 'PENDING' && to.path !== '/pending') {
    return navigateTo('/pending')
  }
  if (user.value?.status === 'ACTIVE' && to.path === '/pending') {
    return navigateTo('/')
  }

  const role = to.meta.role as 'MANAGER' | undefined
  if (role && user.value?.role !== role) {
    return navigateTo('/')
  }
})
