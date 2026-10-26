import { FormEvent, useEffect, useMemo, useState } from 'react'
import { api } from '../api'

type Product = {
  id: number
  sku: string
  name: string
  quantity: number
  sale_price: string
  active: boolean
}

type SaleItemForm = {
  product: string
  quantity: number
  unit_price: string
}

type SaleItemDetail = {
  product: number
  product_sku: string
  product_name: string
  quantity: number
  unit_price: string
  subtotal: string
}

type Sale = {
  id: number
  customer_name: string
  total: string
  created_at: string
  created_by_name?: string
  items_detail: SaleItemDetail[]
}

const emptyItem = (): SaleItemForm => ({
  product: '',
  quantity: 1,
  unit_price: '',
})

export default function Sales() {
  const [products, setProducts] = useState<Product[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [customer, setCustomer] = useState('')
  const [items, setItems] = useState<SaleItemForm[]>([emptyItem()])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [expandedSale, setExpandedSale] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [productResponse, salesResponse] = await Promise.all([
        api.get('/products/'),
        api.get('/sales/'),
      ])
      setProducts(productResponse.data.filter((p: Product) => p.active))
      setSales(salesResponse.data)
    } catch {
      setError('Não foi possível carregar os dados de vendas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filteredSales = useMemo(() => {
    const term = search.toLowerCase().trim()
    if (!term) return sales

    return sales.filter((sale) => {
      const customerMatch = (sale.customer_name || '').toLowerCase().includes(term)
      const idMatch = String(sale.id).includes(term)
      const itemMatch = sale.items_detail.some(
        (item) =>
          item.product_name.toLowerCase().includes(term) ||
          item.product_sku.toLowerCase().includes(term),
      )
      return customerMatch || idMatch || itemMatch
    })
  }, [sales, search])

  const estimatedTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const product = products.find((p) => p.id === Number(item.product))
      const price = item.unit_price
        ? Number(item.unit_price)
        : Number(product?.sale_price || 0)
      return sum + price * Number(item.quantity || 0)
    }, 0)
  }, [items, products])

  function updateItem(index: number, key: keyof SaleItemForm, value: string | number) {
    setItems((current) =>
      current.map((item, position) => {
        if (position !== index) return item

        const updated = { ...item, [key]: value }

        if (key === 'product') {
          const selected = products.find((p) => p.id === Number(value))
          updated.unit_price = selected?.sale_price || ''
        }

        return updated
      }),
    )
  }

  function addItem() {
    setItems((current) => [...current, emptyItem()])
  }

  function removeItem(index: number) {
    setItems((current) => {
      if (current.length === 1) return [emptyItem()]
      return current.filter((_, position) => position !== index)
    })
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    const validItems = items.filter((item) => item.product)

    if (!validItems.length) {
      setError('Adicione pelo menos um produto à venda.')
      return
    }

    const productIds = validItems.map((item) => item.product)
    if (new Set(productIds).size !== productIds.length) {
      setError('O mesmo produto não pode aparecer duas vezes na mesma venda.')
      return
    }

    for (const item of validItems) {
      const product = products.find((p) => p.id === Number(item.product))
      if (!product) continue

      if (!Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0) {
        setError('Todas as quantidades devem ser números inteiros maiores que zero.')
        return
      }

      if (Number(item.quantity) > product.quantity) {
        setError(
          `Estoque insuficiente para ${product.name}. Disponível: ${product.quantity}.`,
        )
        return
      }
    }

    try {
      setSaving(true)

      await api.post('/sales/', {
        customer_name: customer.trim(),
        items: validItems.map((item) => ({
          product: Number(item.product),
          quantity: Number(item.quantity),
          unit_price: item.unit_price ? Number(item.unit_price) : undefined,
        })),
      })

      setCustomer('')
      setItems([emptyItem()])
      setSuccess('Venda registrada e estoque atualizado com sucesso.')
      await load()
    } catch (err: any) {
      const data = err?.response?.data
      const message =
        data?.items?.[0] ||
        data?.items ||
        data?.detail ||
        'Não foi possível registrar a venda.'
      setError(typeof message === 'string' ? message : 'Não foi possível registrar a venda.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Vendas</h2>
          <p className="muted">
            Registre vendas e faça a baixa automática dos produtos no estoque.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="saleform">
        <input
          placeholder="Cliente (opcional)"
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
        />

        {items.map((item, index) => {
          const selected = products.find((p) => p.id === Number(item.product))

          return (
            <div className="saleitem" key={index}>
              <select
                value={item.product}
                onChange={(e) => updateItem(index, 'product', e.target.value)}
                required
              >
                <option value="">Selecione o produto</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku} - {product.name} | Estoque: {product.quantity}
                  </option>
                ))}
              </select>

              <input
                type="number"
                min="1"
                step="1"
                value={item.quantity}
                onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                placeholder="Quantidade"
              />

              <input
                type="number"
                min="0"
                step="0.01"
                value={item.unit_price}
                onChange={(e) => updateItem(index, 'unit_price', e.target.value)}
                placeholder="Preço unitário"
              />

              <button
                type="button"
                className="small danger"
                onClick={() => removeItem(index)}
              >
                Remover
              </button>

              {selected && (
                <span className="muted">
                  Subtotal: {(Number(item.unit_price || selected.sale_price) * item.quantity).toLocaleString(
                    'pt-BR',
                    { style: 'currency', currency: 'BRL' },
                  )}
                </span>
              )}
            </div>
          )
        })}

        <div className="form-actions">
          <button type="button" className="secondary" onClick={addItem}>
            + Adicionar item
          </button>
          <strong>
            Total estimado:{' '}
            {estimatedTotal.toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            })}
          </strong>
          <button disabled={saving}>
            {saving ? 'Registrando...' : 'Registrar venda'}
          </button>
        </div>
      </form>

      {error && <p className="error">{error}</p>}
      {success && <p>{success}</p>}

      <div className="toolbar">
        <input
          placeholder="Pesquisar por venda, cliente, SKU ou produto"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="muted">{filteredSales.length} venda(s)</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Data</th>
              <th>Cliente</th>
              <th>Itens</th>
              <th>Total</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6}>Carregando...</td></tr>
            ) : filteredSales.length === 0 ? (
              <tr><td colSpan={6}>Nenhuma venda encontrada.</td></tr>
            ) : (
              filteredSales.map((sale) => (
                <>
                  <tr key={sale.id}>
                    <td>{sale.id}</td>
                    <td>{new Date(sale.created_at).toLocaleString('pt-BR')}</td>
                    <td>{sale.customer_name || '-'}</td>
                    <td>
                      {sale.items_detail.reduce((sum, item) => sum + item.quantity, 0)}
                    </td>
                    <td>
                      {Number(sale.total).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="small"
                        onClick={() =>
                          setExpandedSale(expandedSale === sale.id ? null : sale.id)
                        }
                      >
                        {expandedSale === sale.id ? 'Ocultar' : 'Ver itens'}
                      </button>
                    </td>
                  </tr>

                  {expandedSale === sale.id && (
                    <tr key={`detail-${sale.id}`}>
                      <td colSpan={6}>
                        <strong>Itens da venda #{sale.id}</strong>
                        <ul>
                          {sale.items_detail.map((item) => (
                            <li key={`${sale.id}-${item.product}`}>
                              {item.product_sku} - {item.product_name}: {item.quantity} ×{' '}
                              {Number(item.unit_price).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}{' '}
                              ={' '}
                              {Number(item.subtotal).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
