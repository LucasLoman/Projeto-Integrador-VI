import { FormEvent, useEffect, useMemo, useState } from 'react'
import { api } from '../api'

type Category = {
  id: number
  name: string
}

export default function Categories() {
  const [items, setItems] = useState<Category[]>([])
  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    try {
      setLoading(true)
      const response = await api.get('/categories/')
      setItems(response.data)
    } catch {
      setError('Não foi possível carregar as categorias.')
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
    return items.filter((item) => item.name.toLowerCase().includes(term))
  }, [items, search])

  function clearForm() {
    setName('')
    setEditingId(null)
    setError('')
  }

  function editCategory(item: Category) {
    setEditingId(item.id)
    setName(item.name)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (name.trim().length < 2) {
      setError('Informe um nome válido para a categoria.')
      return
    }

    try {
      if (editingId) {
        await api.put(`/categories/${editingId}/`, { name })
      } else {
        await api.post('/categories/', { name })
      }
      clearForm()
      await load()
    } catch (err: any) {
      const message = err?.response?.data?.name?.[0]
      setError(message || 'Não foi possível salvar a categoria.')
    }
  }

  async function removeCategory(item: Category) {
    const confirmed = window.confirm(`Excluir a categoria "${item.name}"?`)
    if (!confirmed) return

    try {
      await api.delete(`/categories/${item.id}/`)
      if (editingId === item.id) clearForm()
      await load()
    } catch {
      setError('Não foi possível excluir a categoria.')
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Categorias</h2>
          <p className="muted">Organize as peças por grupos, como freios, filtros, suspensão e elétrica.</p>
        </div>
      </div>

      <form className="category-form" onSubmit={submit}>
        <input
          placeholder="Nome da categoria *"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="form-actions">
          <button type="submit">{editingId ? 'Salvar alterações' : 'Cadastrar categoria'}</button>
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
          placeholder="Pesquisar categoria"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="muted">{filtered.length} categoria(s)</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Categoria</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={2}>Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={2}>Nenhuma categoria encontrada.</td></tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>
                    <div className="row-actions">
                      <button className="small" onClick={() => editCategory(item)}>Editar</button>
                      <button className="small danger" onClick={() => removeCategory(item)}>Excluir</button>
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
