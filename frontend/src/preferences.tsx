import { useState } from 'react'

export const FONT_SCALES = [0.9, 1, 1.12, 1.25, 1.4]
type Theme = 'light' | 'dark'

function readTheme(): Theme {
  try {
    const saved = localStorage.getItem('theme')
    if (saved === 'light' || saved === 'dark') return saved
  } catch {}
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function readScale(): number {
  try {
    const saved = localStorage.getItem('fontScale')
    const index = Number(saved)
    if (saved !== null && Number.isInteger(index) && index >= 0 && index < FONT_SCALES.length) return index
  } catch {}
  return 1
}

function apply(theme: Theme, scale: number) {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.setProperty('--fs', String(FONT_SCALES[scale]))
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {}
}

export function DisplayControls() {
  const [theme, setTheme] = useState<Theme>(readTheme)
  const [scale, setScale] = useState<number>(readScale)

  function changeTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    save('theme', next)
    apply(next, scale)
  }

  function changeScale(step: number) {
    const next = Math.min(FONT_SCALES.length - 1, Math.max(0, scale + step))
    setScale(next)
    save('fontScale', String(next))
    apply(theme, next)
  }

  return (
    <div className="prefs">
      <button
        type="button"
        className="secondary small"
        aria-label="Diminuir fonte"
        title="Diminuir fonte"
        disabled={scale === 0}
        onClick={() => changeScale(-1)}
      >
        A−
      </button>
      <button
        type="button"
        className="secondary small"
        aria-label="Aumentar fonte"
        title="Aumentar fonte"
        disabled={scale === FONT_SCALES.length - 1}
        onClick={() => changeScale(1)}
      >
        A+
      </button>
      <button
        type="button"
        className="secondary small"
        aria-pressed={theme === 'dark'}
        onClick={changeTheme}
      >
        {theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
      </button>
    </div>
  )
}
