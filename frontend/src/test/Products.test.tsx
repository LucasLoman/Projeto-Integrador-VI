import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import Products from '../pages/Products'
import { api } from '../api'

vi.mock('../api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

const mockedGet = vi.mocked(api.get)

function mockInitialLoad() {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/products/') {
      return Promise.resolve({
        data: [
          {
            id: 1,
            sku: 'PAST-001',
            name: 'Pastilha de Freio',
            category: 1,
            category_name: 'Freios',
            brand: 1,
            brand_name: 'Cobreq',
            supplier: 1,
            supplier_name: 'Fornecedor A',
            cost_price: '50.00',
            sale_price: '100.00',
            quantity: 12,
            min_stock: 5,
            location: 'A-01',
            active: true,
          },
          {
            id: 2,
            sku: 'OLEO-001',
            name: 'Óleo 5W30',
            category: 2,
            category_name: 'Lubrificantes',
            brand: 2,
            brand_name: 'Marca B',
            supplier: 1,
            supplier_name: 'Fornecedor A',
            cost_price: '20.00',
            sale_price: '40.00',
            quantity: 3,
            min_stock: 5,
            location: 'B-02',
            active: true,
          },
        ],
      }) as any
    }

    if (url === '/categories/') {
      return Promise.resolve({ data: [{ id: 1, name: 'Freios' }] }) as any
    }

    if (url === '/brands/') {
      return Promise.resolve({ data: [{ id: 1, name: 'Cobreq' }] }) as any
    }

    if (url === '/suppliers/') {
      return Promise.resolve({ data: [{ id: 1, name: 'Fornecedor A' }] }) as any
    }

    return Promise.reject(new Error(`URL não simulada: ${url}`))
  })
}

describe('Produtos', () => {
  it('carrega e exibe produtos vindos da API', async () => {
    mockInitialLoad()

    render(
      <MemoryRouter>
        <Products />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Pastilha de Freio')).toBeInTheDocument()
    expect(screen.getByText('Óleo 5W30')).toBeInTheDocument()
    expect(screen.getByText('2 produto(s)')).toBeInTheDocument()
  })

  it('filtra a listagem pela pesquisa', async () => {
    mockInitialLoad()
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <Products />
      </MemoryRouter>,
    )

    await screen.findByText('Pastilha de Freio')

    const search = screen.getByPlaceholderText(
      'Pesquisar por SKU, nome, marca, categoria ou localização...',
    )
    await user.type(search, 'PAST')

    expect(screen.getByText('Pastilha de Freio')).toBeInTheDocument()
    expect(screen.queryByText('Óleo 5W30')).not.toBeInTheDocument()
    expect(screen.getByText('1 produto(s)')).toBeInTheDocument()
  })

  it('envia um novo cadastro para a API', async () => {
    mockInitialLoad()
    vi.mocked(api.post).mockResolvedValue({ data: {} } as any)

    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <Products />
      </MemoryRouter>,
    )

    await screen.findByText('Pastilha de Freio')

    await user.type(screen.getByPlaceholderText('SKU / Código'), 'NOVO-001')
    await user.type(screen.getByPlaceholderText('Nome do produto'), 'Produto Novo')
    await user.click(screen.getByRole('button', { name: 'Cadastrar produto' }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/products/',
        expect.objectContaining({
          sku: 'NOVO-001',
          name: 'Produto Novo',
          active: true,
        }),
      )
    })
  })
})
