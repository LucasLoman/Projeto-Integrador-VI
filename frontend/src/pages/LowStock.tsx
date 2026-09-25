import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'

type Product = {
  id: number
  sku: string
  name: string
  quantity: number
  min_stock: number
  stock_status: 'SEM_ESTOQUE' | 'ESTOQUE_BAIXO' | 'OK'
  stock_difference: number
  supplier_name?: string | null
  location?: string
  active: boolean
}

function statusLabel(status: Product['stock_status']) {
  if (status === 'SEM_ESTOQUE') return 'Sem estoque'
  if (status === 'ESTOQUE_BAIXO') return 'Estoque baixo'
  return 'Normal'
}

export default function LowStock() {
  const [items, setItems] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const response = await api.get('/products/?low_stock=true&active=true')
      setItems(response.data)
    } catch {
      setError('Não foi possível carregar os produtos com estoque baixo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim()
    if (!term) return items

    return items.filter((item) =>
      [
        item.sku,
        item.name,
        item.supplier_name || '',
        item.location || '',
      ].some((value) => value.toLowerCase().includes(term)),
    )
  }, [items, search])

  const zeroCount = items.filter((item) => item.stock_status === 'SEM_ESTOQUE').length

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Estoque mínimo</h2>
          <p className="muted">
            Produtos que chegaram ao estoque mínimo ou já estão sem saldo.
          </p>
        </div>
        <button type="button" onClick={load}>Atualizar</button>
      </div>

      <div className="cards">
        <div className="card">
          <span className="muted">Produtos em atenção</span>
          <strong>{items.length}</strong>
        </div>
        <div className="card">
          <span className="muted">Produtos zerados</span>
          <strong>{zeroCount}</strong>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="toolbar">
        <input
          placeholder="Pesquisar SKU, produto, fornecedor ou localização"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="muted">{filtered.length} produto(s)</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>SKU</th>
              <th>Produto</th>
              <th>Estoque atual</th>
              <th>Estoque mínimo</th>
              <th>Déficit</th>
              <th>Fornecedor</th>
              <th>Localização</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8}>Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8}>Nenhum produto abaixo do estoque mínimo.</td></tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id}>
                  <td><strong>{statusLabel(item.stock_status)}</strong></td>
                  <td>{item.sku}</td>
                  <td>{item.name}</td>
                  <td>{item.quantity}</td>
                  <td>{item.min_stock}</td>
                  <td>
                    {item.stock_difference > 0
                      ? `${item.stock_difference} un.`
                      : 'No limite'}
                  </td>
                  <td>{item.supplier_name || '-'}</td>
                  <td>{item.location || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
