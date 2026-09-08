;(() => {
  try {
    const saved = JSON.parse(localStorage.getItem('homedash.preferences.v1') || '{}')
    const choice = ['system', 'light', 'dark'].includes(saved.appearance)
      ? saved.appearance
      : 'system'
    const dark =
      choice === 'dark' ||
      (choice === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.dataset.appearance = dark ? 'dark' : 'light'
  } catch {
    document.documentElement.dataset.appearance = matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }
})()
