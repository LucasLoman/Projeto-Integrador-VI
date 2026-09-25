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

type ReplenishmentRisk = 'RUPTURA' | 'REPOR' | 'ATENCAO' | 'OK' | 'SEM_GIRO'

type ReplenishmentItem = {
  product_id: number
  sku: string
  name: string
  supplier?: string | null
  quantity: number
  min_stock: number
  sold_qty: number
  avg_daily: number
  lead_time_days: number
  safety_days: number
  safety_stock: number
  reorder_point: number
  target_days: number
  target_stock: number
  coverage_days: number | null
  risk: ReplenishmentRisk
  suggested_purchase: number
  cost_price: string
  estimated_purchase_cost: string
}

type ReplenishmentResponse = {
  analysis_days: number
  safety_days: number
  target_days: number
  summary: {
    products_to_buy: number
    total_units: number
    estimated_cost: string
  }
  items: ReplenishmentItem[]
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


type RuptureRisk = 'RUPTURA' | 'CRITICO' | 'ATENCAO' | 'OK' | 'SEM_HISTORICO'

type RuptureItem = {
  product_id: number
  sku: string
  name: string
  quantity: number
  sold_qty: number
  analysis_days: number
  avg_daily: number
  lead_time_days: number
  safety_days: number
  coverage_days: number | null
  rupture_date: string | null
  risk: RuptureRisk
  supplier?: string | null
}

type RuptureResponse = {
  analysis_days: number
  safety_days: number
  summary: Record<RuptureRisk, number>
  items: RuptureItem[]
}

const money = (value: string | number) =>
  Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })

export default function Analytics() {
  const [abc, setAbc] = useState<ABCItem[]>([])
  const [replenishment, setReplenishment] = useState<ReplenishmentResponse>({
    analysis_days: 30,
    safety_days: 3,
    target_days: 15,
    summary: {
      products_to_buy: 0,
      total_units: 0,
      estimated_cost: '0',
    },
    items: [],
  })
  const [replenishmentDays, setReplenishmentDays] = useState(30)
  const [replenishmentTargetDays, setReplenishmentTargetDays] = useState(15)
  const [replenishmentLoading, setReplenishmentLoading] = useState(false)
  const [slowProducts, setSlowProducts] = useState<SlowProductsResponse>({
    period_days: 90,
    count: 0,
    inventory_value: '0',
    items: [],
  })
  const [days, setDays] = useState(90)
  const [slowDays, setSlowDays] = useState(90)
  const [ruptureDays, setRuptureDays] = useState(30)
  const [rupture, setRupture] = useState<RuptureResponse>({
    analysis_days: 30,
    safety_days: 3,
    summary: {
      RUPTURA: 0,
      CRITICO: 0,
      ATENCAO: 0,
      OK: 0,
      SEM_HISTORICO: 0,
    },
    items: [],
  })
  const [loading, setLoading] = useState(false)
  const [slowLoading, setSlowLoading] = useState(false)
  const [ruptureLoading, setRuptureLoading] = useState(false)
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

  async function loadReplenishment(
    period = replenishmentDays,
    target = replenishmentTargetDays,
  ) {
    setReplenishmentLoading(true)
    try {
      const response = await api.get(
        `/analytics/replenishment/?days=${period}&safety_days=3&target_days=${target}`,
      )
      setReplenishment(response.data)
    } catch {
      setError('Não foi possível calcular a sugestão de reposição.')
    } finally {
      setReplenishmentLoading(false)
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

  async function loadRuptureForecast(period = ruptureDays) {
    setRuptureLoading(true)
    try {
      const response = await api.get(
        `/analytics/rupture-forecast/?days=${period}&safety_days=3`,
      )
      setRupture(response.data)
    } catch {
      setError('Não foi possível calcular a previsão de ruptura.')
    } finally {
      setRuptureLoading(false)
    }
  }

  useEffect(() => {
    loadABC(days)
    loadSlowProducts(slowDays)
    loadRuptureForecast(ruptureDays)
    loadReplenishment(replenishmentDays, replenishmentTargetDays)
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

  function changeRupturePeriod(value: number) {
    setRuptureDays(value)
    loadRuptureForecast(value)
  }

  function riskLabel(risk: RuptureRisk) {
    const labels: Record<RuptureRisk, string> = {
      RUPTURA: 'Sem estoque',
      CRITICO: 'Crítico',
      ATENCAO: 'Atenção',
      OK: 'Normal',
      SEM_HISTORICO: 'Sem histórico',
    }
    return labels[risk]
  }

  function replenishmentRiskLabel(risk: ReplenishmentRisk) {
    const labels: Record<ReplenishmentRisk, string> = {
      RUPTURA: 'Sem estoque',
      REPOR: 'Comprar',
      ATENCAO: 'Atenção',
      OK: 'Normal',
      SEM_GIRO: 'Sem giro',
    }
    return labels[risk]
  }

  function changeReplenishmentPeriod(value: number) {
    setReplenishmentDays(value)
    loadReplenishment(value, replenishmentTargetDays)
  }

  function changeTargetDays(value: number) {
    setReplenishmentTargetDays(value)
    loadReplenishment(replenishmentDays, value)
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
        <div className="page-header">
          <div>
            <h3>Previsão de ruptura</h3>
            <p className="muted">
              Estimativa de quantos dias o estoque atual deve durar com base no
              consumo médio recente e no prazo de entrega do fornecedor.
            </p>
          </div>

          <select
            value={ruptureDays}
            onChange={(e) => changeRupturePeriod(Number(e.target.value))}
          >
            <option value={30}>Consumo dos últimos 30 dias</option>
            <option value={60}>Consumo dos últimos 60 dias</option>
            <option value={90}>Consumo dos últimos 90 dias</option>
          </select>
        </div>

        <div className="abc-summary">
          <div className="card">
            <span className="muted">Sem estoque</span>
            <strong>{rupture.summary.RUPTURA}</strong>
          </div>

          <div className="card">
            <span className="muted">Críticos</span>
            <strong>{rupture.summary.CRITICO}</strong>
          </div>

          <div className="card">
            <span className="muted">Em atenção</span>
            <strong>{rupture.summary.ATENCAO}</strong>
          </div>

          <div className="card">
            <span className="muted">Situação normal</span>
            <strong>{rupture.summary.OK}</strong>
          </div>
        </div>

        <p className="muted">
          O risco é calculado comparando os dias de cobertura do estoque com o
          prazo médio de entrega do fornecedor, utilizando uma margem adicional
          de {rupture.safety_days} dias para o status de atenção.
        </p>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Risco</th>
                <th>SKU</th>
                <th>Produto</th>
                <th>Estoque</th>
                <th>Venda no período</th>
                <th>Média/dia</th>
                <th>Cobertura</th>
                <th>Prazo fornecedor</th>
                <th>Ruptura estimada</th>
              </tr>
            </thead>

            <tbody>
              {ruptureLoading ? (
                <tr><td colSpan={9}>Calculando previsão de ruptura...</td></tr>
              ) : rupture.items.length === 0 ? (
                <tr><td colSpan={9}>Nenhum produto disponível para análise.</td></tr>
              ) : (
                rupture.items.map((item) => (
                  <tr key={item.product_id}>
                    <td><strong>{riskLabel(item.risk)}</strong></td>
                    <td>{item.sku}</td>
                    <td>
                      {item.name}
                      <br />
                      <small className="muted">{item.supplier || 'Sem fornecedor definido'}</small>
                    </td>
                    <td>{item.quantity}</td>
                    <td>{item.sold_qty}</td>
                    <td>{item.avg_daily.toFixed(2)}</td>
                    <td>
                      {item.coverage_days === null
                        ? '-'
                        : `${item.coverage_days.toFixed(1)} dias`}
                    </td>
                    <td>{item.lead_time_days} dias</td>
                    <td>
                      {item.rupture_date
                        ? new Date(item.rupture_date).toLocaleDateString('pt-BR')
                        : 'Sem previsão'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {rupture.summary.SEM_HISTORICO > 0 && (
          <p className="muted">
            {rupture.summary.SEM_HISTORICO} produto(s) não possuem vendas no período
            analisado e, por isso, não têm previsão de ruptura calculada.
          </p>
        )}
      </section>

      <section>
        <div className="page-header">
          <div>
            <h3>Sugestão de reposição</h3>
            <p className="muted">
              Recomendação automática de quais produtos comprar e em qual quantidade,
              considerando consumo, prazo do fornecedor e estoque de segurança.
            </p>
          </div>
        </div>

        <div className="replenishment-controls">
          <label>
            Histórico de consumo
            <select
              value={replenishmentDays}
              onChange={(e) => changeReplenishmentPeriod(Number(e.target.value))}
            >
              <option value={30}>30 dias</option>
              <option value={60}>60 dias</option>
              <option value={90}>90 dias</option>
            </select>
          </label>

          <label>
            Estoque alvo após reposição
            <select
              value={replenishmentTargetDays}
              onChange={(e) => changeTargetDays(Number(e.target.value))}
            >
              <option value={7}>7 dias adicionais</option>
              <option value={15}>15 dias adicionais</option>
              <option value={30}>30 dias adicionais</option>
            </select>
          </label>
        </div>

        <div className="abc-summary">
          <div className="card">
            <span className="muted">Produtos para comprar</span>
            <strong>{replenishment.summary.products_to_buy}</strong>
          </div>

          <div className="card">
            <span className="muted">Unidades sugeridas</span>
            <strong>{replenishment.summary.total_units}</strong>
          </div>

          <div className="card">
            <span className="muted">Custo estimado da compra</span>
            <strong>{money(replenishment.summary.estimated_cost)}</strong>
          </div>
        </div>

        <p className="muted">
          O sistema calcula um ponto de reposição utilizando o consumo durante o prazo
          médio do fornecedor mais um estoque de segurança. A compra só é sugerida quando
          o saldo atual chega a esse ponto. Produtos sem giro não recebem compra automática.
        </p>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>SKU</th>
                <th>Produto</th>
                <th>Atual</th>
                <th>Média/dia</th>
                <th>Ponto de reposição</th>
                <th>Estoque alvo</th>
                <th>Comprar</th>
                <th>Custo estimado</th>
                <th>Fornecedor</th>
              </tr>
            </thead>
            <tbody>
              {replenishmentLoading ? (
                <tr><td colSpan={10}>Calculando sugestão de compra...</td></tr>
              ) : replenishment.items.length === 0 ? (
                <tr><td colSpan={10}>Nenhum produto disponível para análise.</td></tr>
              ) : (
                replenishment.items.map((item) => (
                  <tr key={item.product_id}>
                    <td><strong>{replenishmentRiskLabel(item.risk)}</strong></td>
                    <td>{item.sku}</td>
                    <td>{item.name}</td>
                    <td>{item.quantity}</td>
                    <td>{item.avg_daily.toFixed(2)}</td>
                    <td>{item.reorder_point}</td>
                    <td>{item.target_stock}</td>
                    <td>
                      <strong>
                        {item.suggested_purchase > 0
                          ? `${item.suggested_purchase} un.`
                          : '-'}
                      </strong>
                    </td>
                    <td>
                      {item.suggested_purchase > 0
                        ? money(item.estimated_purchase_cost)
                        : '-'}
                    </td>
                    <td>{item.supplier || 'Sem fornecedor'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
