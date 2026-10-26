import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { DisplayControls } from '../preferences'

describe('Preferências de exibição', () => {
  it('alterna o modo escuro e guarda a escolha', async () => {
    const user = userEvent.setup()
    render(<DisplayControls />)

    await user.click(screen.getByRole('button', { name: 'Modo escuro' }))

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(screen.getByRole('button', { name: 'Modo claro' })).toBeInTheDocument()
  })

  it('aumenta e diminui a fonte', async () => {
    const user = userEvent.setup()
    render(<DisplayControls />)

    await user.click(screen.getByRole('button', { name: 'Aumentar fonte' }))
    expect(document.documentElement.style.getPropertyValue('--fs')).toBe('1.12')

    await user.click(screen.getByRole('button', { name: 'Diminuir fonte' }))
    await user.click(screen.getByRole('button', { name: 'Diminuir fonte' }))
    expect(document.documentElement.style.getPropertyValue('--fs')).toBe('0.9')
    expect(screen.getByRole('button', { name: 'Diminuir fonte' })).toBeDisabled()
  })
})
