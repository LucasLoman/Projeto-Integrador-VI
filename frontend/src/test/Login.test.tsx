import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import Login from '../pages/Login'

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
  },
}))

describe('Login', () => {
  it('exibe erro quando usuário ou senha são inválidos', async () => {
    vi.mocked(axios.post).mockRejectedValue(new Error('401'))
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Login />
      </MemoryRouter>,
    )

    await user.type(screen.getByPlaceholderText('Usuário'), 'usuario')
    await user.type(screen.getByPlaceholderText('Senha'), 'senha-errada')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(
      await screen.findByText('Usuário ou senha inválidos'),
    ).toBeInTheDocument()
  })
})
