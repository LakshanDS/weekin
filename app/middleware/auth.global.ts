// Single global guard: resolves the session, then —
// public pages redirect authed users home, protected pages require a session,
// role pages gate on definePageMeta({ role }), PENDING users are locked to /pending.
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
