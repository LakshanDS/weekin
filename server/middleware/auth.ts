// Attach the authenticated user (if any) to every /api request.
// Route handlers then just call requireUser() / requireManager().
export default defineEventHandler(async (event) => {
  if (event.path.startsWith('/api/')) {
    event.context.user = await getSessionUser(event)
  }
})
