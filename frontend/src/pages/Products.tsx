import { FormEvent, useEffect, useMemo, useState } from 'react'
import { api } from '../api'

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

export default function Products() {
  const [items, setItems] = useState<Product[]>([])
  const [categories, setCategories] = useState<Option[]>([])
  const [brands, setBrands] = useState<Option[]>([])
  const [suppliers, setSuppliers] = useState<Option[]>([])
  const [form, setForm] = useState<ProductForm>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
    try {
      if (editingId) {
        await api.patch(`/products/${editingId}/`, toPayload())
      } else {
        await api.post('/products/', toPayload())
      }
      cancelEdit()
      await load()
    } catch (err: any) {
      const data = err?.response?.data
      setError(data ? JSON.stringify(data) : 'Não foi possível salvar o produto.')
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

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Produtos</h2>
          <p className="muted">Cadastre, pesquise, edite e consulte os produtos do estoque.</p>
        </div>
      </div>

      <form className="gridform" onSubmit={submit}>
        <input
          required
          placeholder="SKU / Código"
          value={form.sku}
          onChange={(e) => setForm({ ...form, sku: e.target.value })}
        />
        <input
          required
          placeholder="Nome do produto"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          <option value="">Categoria</option>
          {categories.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        <select value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })}>
          <option value="">Marca</option>
          {brands.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        <select value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })}>
          <option value="">Fornecedor</option>
          {suppliers.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Preço de custo"
          value={form.cost_price}
          onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
        />
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Preço de venda"
          value={form.sale_price}
          onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
        />
        <input
          type="number"
          min="0"
          placeholder="Estoque mínimo"
          value={form.min_stock}
          onChange={(e) => setForm({ ...form, min_stock: e.target.value })}
        />
        <input
          placeholder="Localização no estoque"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
        />
        <label className="check-field">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          Produto ativo
        </label>
        <div className="form-actions">
          <button type="submit">{editingId ? 'Salvar alterações' : 'Cadastrar produto'}</button>
          {editingId && <button type="button" className="secondary" onClick={cancelEdit}>Cancelar</button>}
        </div>
      </form>

      {error && <p className="error">{error}</p>}

      <div className="toolbar">
        <input
          placeholder="Pesquisar por SKU, nome, marca, categoria ou localização..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span>{filteredItems.length} produto(s)</span>
      </div>

      {loading ? (
        <p>Carregando...</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Produto</th>
                <th>Categoria</th>
                <th>Marca</th>
                <th>Fornecedor</th>
                <th>Estoque</th>
                <th>Mín.</th>
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
                  <td>{product.name}</td>
                  <td>{product.category_name || '-'}</td>
                  <td>{product.brand_name || '-'}</td>
                  <td>{product.supplier_name || '-'}</td>
                  <td className={product.quantity <= product.min_stock ? 'stock-low' : ''}>{product.quantity}</td>
                  <td>{product.min_stock}</td>
                  <td>R$ {Number(product.sale_price).toFixed(2)}</td>
                  <td>{product.location || '-'}</td>
                  <td>{product.active ? 'Ativo' : 'Inativo'}</td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="secondary small" onClick={() => startEdit(product)}>Editar</button>
                      <button type="button" className="danger small" onClick={() => removeProduct(product)}>Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={11}>Nenhum produto encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
