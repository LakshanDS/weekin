// The browser's native search-clear button is unreliable (blue / missing), so main.css
// paints a gray × on non-empty search fields and this plugin clears on clicks in that zone.
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:mounted', () => {
    document.addEventListener('click', (event) => {
      const target = event.target
      if (!(target instanceof HTMLInputElement) || target.type !== 'search' || !target.value) return
      const rect = target.getBoundingClientRect()
      const x = event.clientX
      if (x >= rect.right - 26 && x <= rect.right - 10) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
        setter.call(target, '')
        target.dispatchEvent(new Event('input', { bubbles: true }))
        target.focus()
      }
    })
  })
})
