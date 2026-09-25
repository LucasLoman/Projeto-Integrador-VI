import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../api'

type ABCItem = {
  product__id: number
  product__sku: string
  product__name: string
  revenue: string
  qty: number
  share_pct: number
  cumulative_pct: number
  class: 'A' | 'B' | 'C'
}

type ReplenishmentItem = {
  product_id: number
  sku: string
  name: string
  quantity: number
  avg_daily: number
  lead_time_days: number
  coverage_days: number | null
  risk: string
  suggested_purchase: number
}

const money = (value: string | number) =>
  Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })

export default function Analytics() {
  const [abc, setAbc] = useState<ABCItem[]>([])
  const [replenishment, setReplenishment] = useState<ReplenishmentItem[]>([])
  const [days, setDays] = useState(90)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadABC(period = days) {
    setLoading(true)
    setError('')
    try {
      const response = await api.get(`/analytics/abc/?days=${period}`)
      setAbc(response.data)
    } catch {
      setError('Não foi possível carregar a Curva ABC.')
    } finally {
      setLoading(false)
    }
  }

  async function loadReplenishment() {
    try {
      const response = await api.get('/analytics/replenishment/')
      setReplenishment(response.data)
    } catch {
      // A reposição terá uma etapa própria posteriormente.
    }
  }

  useEffect(() => {
    loadABC(days)
    loadReplenishment()
  }, [])

  const summary = useMemo(() => {
    const initial = {
      A: { items: 0, revenue: 0 },
      B: { items: 0, revenue: 0 },
      C: { items: 0, revenue: 0 },
    }

    return abc.reduce((acc, item) => {
      acc[item.class].items += 1
      acc[item.class].revenue += Number(item.revenue)
      return acc
    }, initial)
  }, [abc])

  const totalRevenue = useMemo(
    () => abc.reduce((sum, item) => sum + Number(item.revenue), 0),
    [abc],
  )

  const chartData = useMemo(
    () =>
      abc.slice(0, 12).map((item) => ({
        ...item,
        label:
          item.product__name.length > 16
            ? `${item.product__name.slice(0, 16)}…`
            : item.product__name,
        revenue_number: Number(item.revenue),
      })),
    [abc],
  )

  function changePeriod(value: number) {
    setDays(value)
    loadABC(value)
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Análises</h2>
          <p className="muted">
            Indicadores para apoiar as decisões de estoque e compras.
          </p>
        </div>
      </div>

      <section>
        <div className="page-header">
          <div>
            <h3>Curva ABC</h3>
            <p className="muted">
              Classificação dos produtos de acordo com a participação no faturamento.
            </p>
          </div>

          <select value={days} onChange={(e) => changePeriod(Number(e.target.value))}>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
            <option value={180}>Últimos 180 dias</option>
            <option value={365}>Últimos 12 meses</option>
          </select>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="abc-summary">
          <div className="card">
            <span className="muted">Faturamento analisado</span>
            <strong>{money(totalRevenue)}</strong>
          </div>

          <div className="card">
            <span className="muted">Classe A</span>
            <strong>{summary.A.items} produto(s)</strong>
            <small>{money(summary.A.revenue)}</small>
          </div>

          <div className="card">
            <span className="muted">Classe B</span>
            <strong>{summary.B.items} produto(s)</strong>
            <small>{money(summary.B.revenue)}</small>
          </div>

          <div className="card">
            <span className="muted">Classe C</span>
            <strong>{summary.C.items} produto(s)</strong>
            <small>{money(summary.C.revenue)}</small>
          </div>
        </div>

        <p className="muted">
          Classe A: produtos que formam aproximadamente os primeiros 80% do
          faturamento; B: faixa seguinte até aproximadamente 95%; C: produtos restantes.
        </p>

        {chartData.length > 0 && (
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" angle={-20} textAnchor="end" height={75} />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => [money(value), 'Faturamento']}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.product__name || ''
                  }
                />
                <Bar dataKey="revenue_number" name="Faturamento" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Posição</th>
                <th>SKU</th>
                <th>Produto</th>
                <th>Qtd. vendida</th>
                <th>Faturamento</th>
                <th>Participação</th>
                <th>Acumulado</th>
                <th>Classe</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr><td colSpan={8}>Calculando Curva ABC...</td></tr>
              ) : abc.length === 0 ? (
                <tr><td colSpan={8}>Não há vendas no período selecionado.</td></tr>
              ) : (
                abc.map((item, index) => (
                  <tr key={item.product__id}>
                    <td>{index + 1}</td>
                    <td>{item.product__sku}</td>
                    <td>{item.product__name}</td>
                    <td>{item.qty}</td>
                    <td>{money(item.revenue)}</td>
                    <td>{item.share_pct.toFixed(2)}%</td>
                    <td>{item.cumulative_pct.toFixed(2)}%</td>
                    <td>
                      <span className={`abc-badge abc-${item.class}`}>
                        {item.class}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3>Sugestão de reposição</h3>
        <p className="muted">
          Este módulo será aprofundado nas próximas etapas do projeto.
        </p>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Produto</th>
                <th>Estoque</th>
                <th>Média/dia</th>
                <th>Cobertura</th>
                <th>Risco</th>
                <th>Comprar</th>
              </tr>
            </thead>
            <tbody>
              {replenishment.slice(0, 10).map((item) => (
                <tr key={item.product_id}>
                  <td>{item.sku}</td>
                  <td>{item.name}</td>
                  <td>{item.quantity}</td>
                  <td>{item.avg_daily}</td>
                  <td>{item.coverage_days ?? '-'}</td>
                  <td>{item.risk}</td>
                  <td><strong>{item.suggested_purchase}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
