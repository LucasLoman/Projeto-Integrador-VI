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


type SlowProduct = {
  product_id: number
  sku: string
  name: string
  category?: string | null
  brand?: string | null
  supplier?: string | null
  quantity: number
  cost_price: string
  inventory_value: string
  last_sale?: string | null
  never_sold: boolean
  days_without_sale: number
  location?: string
}

type SlowProductsResponse = {
  period_days: number
  count: number
  inventory_value: string
  items: SlowProduct[]
}

const money = (value: string | number) =>
  Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })

export default function Analytics() {
  const [abc, setAbc] = useState<ABCItem[]>([])
  const [replenishment, setReplenishment] = useState<ReplenishmentItem[]>([])
  const [slowProducts, setSlowProducts] = useState<SlowProductsResponse>({
    period_days: 90,
    count: 0,
    inventory_value: '0',
    items: [],
  })
  const [days, setDays] = useState(90)
  const [slowDays, setSlowDays] = useState(90)
  const [loading, setLoading] = useState(false)
  const [slowLoading, setSlowLoading] = useState(false)
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

  async function loadSlowProducts(period = slowDays) {
    setSlowLoading(true)
    try {
      const response = await api.get(`/analytics/slow-products/?days=${period}`)
      setSlowProducts(response.data)
    } catch {
      setError('Não foi possível carregar os produtos parados.')
    } finally {
      setSlowLoading(false)
    }
  }

  useEffect(() => {
    loadABC(days)
    loadSlowProducts(slowDays)
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

  function changeSlowPeriod(value: number) {
    setSlowDays(value)
    loadSlowProducts(value)
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
        <div className="page-header">
          <div>
            <h3>Produtos parados</h3>
            <p className="muted">
              Itens com saldo em estoque e sem venda durante o período selecionado.
            </p>
          </div>

          <select
            value={slowDays}
            onChange={(e) => changeSlowPeriod(Number(e.target.value))}
          >
            <option value={60}>Sem venda há 60 dias</option>
            <option value={90}>Sem venda há 90 dias</option>
            <option value={180}>Sem venda há 180 dias</option>
            <option value={365}>Sem venda há 12 meses</option>
          </select>
        </div>

        <div className="abc-summary">
          <div className="card">
            <span className="muted">Produtos parados</span>
            <strong>{slowProducts.count}</strong>
          </div>

          <div className="card">
            <span className="muted">Capital imobilizado</span>
            <strong>{money(slowProducts.inventory_value)}</strong>
          </div>

          <div className="card">
            <span className="muted">Período analisado</span>
            <strong>{slowProducts.period_days} dias</strong>
          </div>
        </div>

        <p className="muted">
          Produtos recém-cadastrados só entram nesta relação depois de completarem
          o período escolhido sem nenhuma venda. Produtos sem saldo não são considerados.
        </p>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Produto</th>
                <th>Estoque</th>
                <th>Dias sem venda</th>
                <th>Última venda</th>
                <th>Custo</th>
                <th>Valor parado</th>
                <th>Fornecedor</th>
              </tr>
            </thead>
            <tbody>
              {slowLoading ? (
                <tr><td colSpan={8}>Analisando produtos parados...</td></tr>
              ) : slowProducts.items.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    Nenhum produto parado para o período selecionado.
                  </td>
                </tr>
              ) : (
                slowProducts.items.map((item) => (
                  <tr key={item.product_id}>
                    <td>{item.sku}</td>
                    <td>
                      {item.name}
                      {item.never_sold && (
                        <>
                          <br />
                          <small className="muted">Nunca vendido</small>
                        </>
                      )}
                    </td>
                    <td>{item.quantity}</td>
                    <td><strong>{item.days_without_sale}</strong></td>
                    <td>
                      {item.last_sale
                        ? new Date(item.last_sale).toLocaleDateString('pt-BR')
                        : 'Nunca'}
                    </td>
                    <td>{money(item.cost_price)}</td>
                    <td><strong>{money(item.inventory_value)}</strong></td>
                    <td>{item.supplier || '-'}</td>
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
