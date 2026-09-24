import { FormEvent, useEffect, useMemo, useState } from 'react'
import { api } from '../api'

type Supplier = {
  id: number
  name: string
  cnpj: string
  phone: string
  email: string
  lead_time_days: number
}

type SupplierForm = {
  name: string
  cnpj: string
  phone: string
  email: string
  lead_time_days: number
}

const emptyForm: SupplierForm = {
  name: '',
  cnpj: '',
  phone: '',
  email: '',
  lead_time_days: 7,
}

export default function Suppliers() {
  const [items, setItems] = useState<Supplier[]>([])
  const [form, setForm] = useState<SupplierForm>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    try {
      setLoading(true)
      const response = await api.get('/suppliers/')
      setItems(response.data)
    } catch {
      setError('Não foi possível carregar os fornecedores.')
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
      [item.name, item.cnpj, item.phone, item.email]
        .join(' ')
        .toLowerCase()
        .includes(term),
    )
  }, [items, search])

  function updateField<K extends keyof SupplierForm>(field: K, value: SupplierForm[K]) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function clearForm() {
    setForm(emptyForm)
    setEditingId(null)
    setError('')
  }

  function editSupplier(item: Supplier) {
    setEditingId(item.id)
    setForm({
      name: item.name,
      cnpj: item.cnpj || '',
      phone: item.phone || '',
      email: item.email || '',
      lead_time_days: item.lead_time_days,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.name.trim()) {
      setError('Informe o nome do fornecedor.')
      return
    }

    try {
      if (editingId) {
        await api.put(`/suppliers/${editingId}/`, form)
      } else {
        await api.post('/suppliers/', form)
      }
      clearForm()
      await load()
    } catch (err: any) {
      const data = err?.response?.data
      if (data?.cnpj?.[0]) setError(data.cnpj[0])
      else if (data?.name?.[0]) setError(data.name[0])
      else setError('Não foi possível salvar o fornecedor.')
    }
  }

  async function removeSupplier(item: Supplier) {
    const confirmed = window.confirm(`Excluir o fornecedor "${item.name}"?`)
    if (!confirmed) return

    try {
      await api.delete(`/suppliers/${item.id}/`)
      if (editingId === item.id) clearForm()
      await load()
    } catch {
      setError('Não foi possível excluir o fornecedor. Ele pode estar vinculado a outros registros.')
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Fornecedores</h2>
          <p className="muted">Cadastre fornecedores e seus prazos médios de entrega.</p>
        </div>
      </div>

      <form className="gridform" onSubmit={submit}>
        <input
          placeholder="Nome / Razão social *"
          value={form.name}
          onChange={(e) => updateField('name', e.target.value)}
        />
        <input
          placeholder="CNPJ"
          value={form.cnpj}
          onChange={(e) => updateField('cnpj', e.target.value)}
        />
        <input
          placeholder="Telefone"
          value={form.phone}
          onChange={(e) => updateField('phone', e.target.value)}
        />
        <input
          type="email"
          placeholder="E-mail"
          value={form.email}
          onChange={(e) => updateField('email', e.target.value)}
        />
        <label className="field-stack">
          <span>Prazo médio de entrega (dias)</span>
          <input
            type="number"
            min="0"
            value={form.lead_time_days}
            onChange={(e) => updateField('lead_time_days', Number(e.target.value))}
          />
        </label>
        <div className="form-actions">
          <button type="submit">{editingId ? 'Salvar alterações' : 'Cadastrar fornecedor'}</button>
          {editingId && (
            <button type="button" className="secondary" onClick={clearForm}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      {error && <p className="error">{error}</p>}

      <div className="toolbar">
        <input
          placeholder="Pesquisar por nome, CNPJ, telefone ou e-mail"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="muted">{filtered.length} fornecedor(es)</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fornecedor</th>
              <th>CNPJ</th>
              <th>Telefone</th>
              <th>E-mail</th>
              <th>Prazo</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6}>Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6}>Nenhum fornecedor encontrado.</td></tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.cnpj || '-'}</td>
                  <td>{item.phone || '-'}</td>
                  <td>{item.email || '-'}</td>
                  <td>{item.lead_time_days} dia(s)</td>
                  <td>
                    <div className="row-actions">
                      <button className="small" onClick={() => editSupplier(item)}>Editar</button>
                      <button className="small danger" onClick={() => removeSupplier(item)}>Excluir</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
