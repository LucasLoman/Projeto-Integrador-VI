import { FocusEvent, FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import { useNavigate } from 'react-router-dom'

type Option = { id: number; name: string }

type Product = {
  id: number
  sku: string
  name: string
  category: number | null
  category_name?: string
  brand: number | null
  brand_name?: string
  supplier: number | null
  supplier_name?: string
  cost_price: string
  sale_price: string
  quantity: number
  min_stock: number
  location: string
  active: boolean
}

type ProductForm = {
  sku: string
  name: string
  category: string
  brand: string
  supplier: string
  cost_price: string
  sale_price: string
  min_stock: string
  location: string
  active: boolean
}

const emptyForm: ProductForm = {
  sku: '',
  name: '',
  category: '',
  brand: '',
  supplier: '',
  cost_price: '0.00',
  sale_price: '0.00',
  min_stock: '0',
  location: '',
  active: true,
}

const FIELD_LABELS: Record<string, string> = {
  sku: 'SKU',
  name: 'Nome',
  category: 'Categoria',
  brand: 'Marca',
  supplier: 'Fornecedor',
  cost_price: 'Preço de custo',
  sale_price: 'Preço de venda',
  min_stock: 'Estoque mínimo',
  location: 'Localização',
}

function formatApiError(data: unknown): string {
  if (!data || typeof data !== 'object') return 'Não foi possível salvar o produto.'
  return Object.entries(data as Record<string, unknown>)
    .map(([key, value]) => {
      const text = (Array.isArray(value) ? value.join(' ') : String(value))
        .replace(/.*already exists.*/i, 'já existe um produto com este valor.')
        .replace(/.*may not be blank.*/i, 'preencha este campo.')
      return `${FIELD_LABELS[key] ?? key}: ${text}`
    })
    .join(' ')
}

function Field({ label, span, hint, bad, children }: {
  label: string
  span: 'c3' | 'c4' | 'c9' | 'c12'
  hint?: string
  bad?: boolean
  children: ReactNode
}) {
  return (
    <label className={`field ${span}`}>
      {label}
      {children}
      {hint && <span className={`field-hint${bad ? ' bad' : ''}`}>{hint}</span>}
    </label>
  )
}

export default function Products() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Product[]>([])
  const [categories, setCategories] = useState<Option[]>([])
  const [brands, setBrands] = useState<Option[]>([])
  const [suppliers, setSuppliers] = useState<Option[]>([])
  const [form, setForm] = useState<ProductForm>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const skuRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [products, cats, brandList, supplierList] = await Promise.all([
        api.get('/products/'),
        api.get('/categories/'),
        api.get('/brands/'),
        api.get('/suppliers/'),
      ])
      setItems(products.data)
      setCategories(cats.data)
      setBrands(brandList.data)
      setSuppliers(supplierList.data)
    } catch {
      setError('Não foi possível carregar os produtos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return items
    return items.filter((product) =>
      [
        product.sku,
        product.name,
        product.category_name,
        product.brand_name,
        product.supplier_name,
        product.location,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    )
  }, [items, search])

  const cost = Number(form.cost_price)
  const sale = Number(form.sale_price)
  const marginHint =
    sale > 0
      ? sale < cost
        ? 'Venda abaixo do custo'
        : `Margem de ${Math.round(((sale - cost) / sale) * 100)}%`
      : undefined

  function toPayload() {
    return {
      sku: form.sku.trim(),
      name: form.name.trim(),
      category: form.category ? Number(form.category) : null,
      brand: form.brand ? Number(form.brand) : null,
      supplier: form.supplier ? Number(form.supplier) : null,
      cost_price: form.cost_price || '0.00',
      sale_price: form.sale_price || '0.00',
      min_stock: Number(form.min_stock || 0),
      location: form.location.trim(),
      active: form.active,
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')
    const wasEditing = editingId !== null
    try {
      if (editingId) {
        await api.patch(`/products/${editingId}/`, toPayload())
      } else {
        await api.post('/products/', toPayload())
      }
      cancelEdit()
      await load()
      setNotice(wasEditing ? 'Alterações salvas.' : 'Produto cadastrado. Pode cadastrar o próximo.')
      skuRef.current?.focus()
    } catch (err: any) {
      setError(formatApiError(err?.response?.data))
    }
  }

  function startEdit(product: Product) {
    setEditingId(product.id)
    setForm({
      sku: product.sku,
      name: product.name,
      category: product.category ? String(product.category) : '',
      brand: product.brand ? String(product.brand) : '',
      supplier: product.supplier ? String(product.supplier) : '',
      cost_price: product.cost_price,
      sale_price: product.sale_price,
      min_stock: String(product.min_stock),
      location: product.location || '',
      active: product.active,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm)
  }

  async function removeProduct(product: Product) {
    if (!window.confirm(`Excluir o produto ${product.sku} - ${product.name}?`)) return
    setError('')
    try {
      await api.delete(`/products/${product.id}/`)
      if (editingId === product.id) cancelEdit()
      await load()
    } catch {
      setError('Não foi possível excluir o produto. Verifique se ele já possui movimentações ou vendas.')
    }
  }

  const selectAll = (e: FocusEvent<HTMLInputElement>) => e.target.select()

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Produtos</h2>
          <p className="muted">Cadastre, pesquise, edite e consulte os produtos do estoque.</p>
        </div>
      </div>

      <form className="product-form" onSubmit={submit}>
        <div className="form-title">
          <h3>{editingId ? 'Editar produto' : 'Novo produto'}</h3>
          <span className="muted">Campos com * são obrigatórios</span>
        </div>

        <div className="fields">
          <Field label="SKU / Código *" span="c3">
            <input
              ref={skuRef}
              required
              placeholder="SKU / Código"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
            />
          </Field>
          <Field label="Nome do produto *" span="c9">
            <input
              required
              placeholder="Nome do produto"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>

          <Field label="Categoria" span="c4">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="">Sem categoria</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Marca" span="c4">
            <select value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })}>
              <option value="">Sem marca</option>
              {brands.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Fornecedor" span="c4">
            <select value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })}>
              <option value="">Sem fornecedor</option>
              {suppliers.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Preço de custo (R$)" span="c3">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={form.cost_price}
              onFocus={selectAll}
              onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
            />
          </Field>
          <Field label="Preço de venda (R$)" span="c3" hint={marginHint} bad={sale > 0 && sale < cost}>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={form.sale_price}
              onFocus={selectAll}
              onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
            />
          </Field>
          <Field label="Estoque mínimo" span="c3" hint="Abaixo disso entra em alerta">
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={form.min_stock}
              onFocus={selectAll}
              onChange={(e) => setForm({ ...form, min_stock: e.target.value })}
            />
          </Field>
          <Field label="Localização" span="c3" hint="Ex.: A-01, prateleira 3">
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </Field>
        </div>

        <div className="form-footer">
          <label className="check-field">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Produto ativo
          </label>
          <div className="form-actions">
            {editingId && <button type="button" className="secondary" onClick={cancelEdit}>Cancelar</button>}
            <button type="submit">{editingId ? 'Salvar alterações' : 'Cadastrar produto'}</button>
          </div>
        </div>
      </form>

      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}

      <div className="toolbar">
        <input
          placeholder="Pesquisar por SKU, nome, marca, categoria ou localização..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span>{filteredItems.length} produto(s)</span>
      </div>

      {loading && items.length === 0 ? (
        <p className="muted">Carregando...</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Produto</th>
                <th>Fornecedor</th>
                <th>Estoque</th>
                <th>Venda</th>
                <th>Local</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((product) => (
                <tr key={product.id}>
                  <td>{product.sku}</td>
                  <td>
                    <div className="cell-main">
                      <strong>{product.name}</strong>
                      <small>{[product.category_name, product.brand_name].filter(Boolean).join(', ') || 'Sem categoria'}</small>
                    </div>
                  </td>
                  <td>{product.supplier_name || '-'}</td>
                  <td>
                    <div className="cell-main">
                      <span className={product.quantity <= product.min_stock ? 'stock-low' : ''}>{product.quantity}</span>
                      <small>mínimo {product.min_stock}</small>
                    </div>
                  </td>
                  <td>R$ {Number(product.sale_price).toFixed(2)}</td>
                  <td>{product.location || '-'}</td>
                  <td>
                    <span className={`badge ${product.active ? 'ok' : ''}`}>{product.active ? 'Ativo' : 'Inativo'}</span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="small" onClick={() => navigate(`/produto/${product.id}`)}>QR Code</button>
                      <button type="button" className="small" onClick={() => startEdit(product)}>Editar</button>
                      <button type="button" className="small danger" onClick={() => removeProduct(product)}>Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty">
                    {items.length === 0
                      ? 'Nenhum produto cadastrado ainda. Preencha o formulário acima para adicionar o primeiro.'
                      : 'Nenhum produto corresponde à pesquisa.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
