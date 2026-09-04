export interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  tone?: 'danger' | 'default'
}

interface ConfirmState {
  options: ConfirmOptions | null
  resolve: ((v: boolean) => void) | null
}

// Awaitable confirmation dialog: `if (await confirm({ title, message })) …`
// Backed by one <AppConfirmDialog /> mounted in app.vue.
export function useConfirm() {
  const state = useState<ConfirmState>('confirm-dialog', () => ({ options: null, resolve: null }))

  function confirm(options: ConfirmOptions): Promise<boolean> {
    state.value.options = options
    return new Promise((resolve) => {
      state.value.resolve = resolve
    })
  }

  function answer(value: boolean) {
    state.value.resolve?.(value)
    state.value = { options: null, resolve: null }
  }

  return { state, confirm, answer }
}
