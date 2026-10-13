import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import ProductQR from '../pages/ProductQR'
import { api } from '../api'

vi.mock('../api', () => ({
  api: {
    get: vi.fn(),
  },
}))

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value, title }: { value: string; title?: string }) => (
    <svg data-testid="qrcode" data-value={value}>
      <title>{title}</title>
    </svg>
  ),
}))

describe('QR Code do produto', () => {
  it('carrega o produto e gera o QR com link direto', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        id: 7,
        sku: 'QR-007',
        name: 'Filtro de Óleo',
        category_name: 'Filtros',
        brand_name: 'Marca Teste',
        supplier_name: 'Fornecedor Teste',
        sale_price: '45.90',
        quantity: 9,
        min_stock: 3,
        location: 'C-04',
        active: true,
      },
    } as any)

    render(
      <MemoryRouter initialEntries={['/produto/7']}>
        <Routes>
          <Route path="/produto/:id" element={<ProductQR />} />
        </Routes>
      </MemoryRouter>,
    )

    
    expect((await screen.findAllByText('Filtro de Óleo')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('QR-007').length).toBeGreaterThan(0)

    const qr = screen.getByTestId('qrcode')
    expect(qr.getAttribute('data-value')).toContain('/produto/7')
  })

  it('mostra mensagem quando a API falha', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('erro'))

    render(
      <MemoryRouter initialEntries={['/produto/99']}>
        <Routes>
          <Route path="/produto/:id" element={<ProductQR />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(
      await screen.findByText('Não foi possível carregar o produto.'),
    ).toBeInTheDocument()
  })
})
