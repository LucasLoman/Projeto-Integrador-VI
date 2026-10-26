import { FormEvent, useEffect, useMemo, useState } from 'react'
import { api } from '../api'

type Product = {
  id: number
  sku: string
  name: string
  quantity: number
  active: boolean
}

type Movement = {
  id: number
  product: number
  product_name: string
  product_sku: string
  movement_type: 'IN' | 'OUT' | 'ADJ'
  quantity: number
  unit_cost?: string | null
  note?: string
  created_at: string
}

const typeLabel: Record<Movement['movement_type'], string> = {
  IN: 'Entrada',
  OUT: 'Saída',
  ADJ: 'Ajuste',
}

export default function Movements() {
  const [products, setProducts] = useState<Product[]>([])
  const [moves, setMoves] = useState<Movement[]>([])
  const [product, setProduct] = useState('')
  const [type, setType] = useState<Movement['movement_type']>('IN')
  const [qty, setQty] = useState(1)
  const [unitCost, setUnitCost] = useState('')
  const [note, setNote] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [p, m] = await Promise.all([
        api.get('/products/?search='),
        api.get('/movements/'),
      ])
      setProducts(p.data.filter((item: Product) => item.active))
      setMoves(m.data)
    } catch {
      setError('Não foi possível carregar as movimentações.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const selectedProduct = useMemo(
    () => products.find((item) => item.id === Number(product)),
    [products, product],
  )

  const filteredMoves = useMemo(() => {
    const term = search.toLowerCase().trim()

    return moves.filter((move) => {
      const matchesSearch =
        !term ||
        move.product_name.toLowerCase().includes(term) ||
        move.product_sku.toLowerCase().includes(term) ||
        (move.note || '').toLowerCase().includes(term)

      const matchesType = !typeFilter || move.movement_type === typeFilter

      return matchesSearch && matchesType
    })
  }, [moves, search, typeFilter])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!product) {
      setError('Selecione um produto.')
      return
    }

    if (!Number.isInteger(qty) || qty <= 0) {
      setError('Informe uma quantidade válida.')
      return
    }

    if (type === 'OUT' && selectedProduct && qty > selectedProduct.quantity) {
      setError(`Estoque insuficiente. Disponível: ${selectedProduct.quantity}.`)
      return
    }

    try {
      setSaving(true)

      const payload: Record<string, unknown> = {
        product: Number(product),
        movement_type: type,
        quantity: qty,
        note: note.trim(),
      }

      if (type === 'IN' && unitCost) {
        payload.unit_cost = Number(unitCost)
      }

      await api.post('/movements/', payload)

      setQty(1)
      setUnitCost('')
      setNote('')
      setSuccess(
        type === 'ADJ'
          ? 'Ajuste de estoque registrado.'
          : 'Movimentação registrada com sucesso.',
      )

      await load()
    } catch (err: any) {
      const data = err?.response?.data
      const message =
        data?.quantity?.[0] ||
        data?.product?.[0] ||
        data?.non_field_errors?.[0] ||
        'Não foi possível registrar a movimentação.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Movimentações de estoque</h2>
          <p className="muted">
            Registre entradas, saídas e ajustes mantendo o histórico do estoque.
          </p>
        </div>
      </div>

      <form className="gridform" onSubmit={submit}>
        <select value={product} onChange={(e) => setProduct(e.target.value)} required>
          <option value="">Selecione o produto</option>
          {products.map((item) => (
            <option key={item.id} value={item.id}>
              {item.sku} - {item.name} | Estoque: {item.quantity}
            </option>
          ))}
        </select>

        <select
          value={type}
          onChange={(e) => setType(e.target.value as Movement['movement_type'])}
        >
          <option value="IN">Entrada</option>
          <option value="OUT">Saída</option>
          <option value="ADJ">Ajuste de estoque</option>
        </select>

        <input
          type="number"
          min="1"
          step="1"
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          placeholder={type === 'ADJ' ? 'Novo estoque' : 'Quantidade'}
          required
        />

        {type === 'IN' && (
          <input
            type="number"
            min="0"
            step="0.01"
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
            placeholder="Custo unitário (opcional)"
          />
        )}

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Observação (opcional)"
          maxLength={255}
        />

        <button disabled={saving}>
          {saving ? 'Registrando...' : 'Registrar movimentação'}
        </button>
      </form>

      {selectedProduct && (
        <p className="muted">
          Estoque atual de <strong>{selectedProduct.name}</strong>: {selectedProduct.quantity}
          {type === 'ADJ' && ' — no ajuste, a quantidade informada passa a ser o novo saldo.'}
        </p>
      )}

      {error && <p className="error">{error}</p>}
      {success && <p>{success}</p>}

      <div className="toolbar">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar por SKU, produto ou observação"
        />

        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">Todos os tipos</option>
          <option value="IN">Entradas</option>
          <option value="OUT">Saídas</option>
          <option value="ADJ">Ajustes</option>
        </select>

        <span className="muted">{filteredMoves.length} movimentação(ões)</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Produto</th>
              <th>Tipo</th>
              <th>Quantidade</th>
              <th>Custo unitário</th>
              <th>Observação</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6}>Carregando...</td>
              </tr>
            ) : filteredMoves.length === 0 ? (
              <tr>
                <td colSpan={6}>Nenhuma movimentação encontrada.</td>
              </tr>
            ) : (
              filteredMoves.map((move) => (
                <tr key={move.id}>
                  <td>{new Date(move.created_at).toLocaleString('pt-BR')}</td>
                  <td>
                    {move.product_sku} - {move.product_name}
                  </td>
                  <td>{typeLabel[move.movement_type]}</td>
                  <td>{move.quantity}</td>
                  <td>
                    {move.unit_cost
                      ? Number(move.unit_cost).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })
                      : '-'}
                  </td>
                  <td>{move.note || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
