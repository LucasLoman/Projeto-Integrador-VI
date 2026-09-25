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

type TopProduct = {
  product__id: number
  product__sku: string
  product__name: string
  qty: number
  revenue: string
}

type StockProduct = {
  id: number
  sku: string
  name: string
  quantity: number
  min_stock: number
}

type RecentSale = {
  id: number
  customer_name: string
  total: string
  created_at: string
}

type DashboardData = {
  products: number
  low_stock: number
  out_of_stock: number
  inventory_units: number
  inventory_value: string
  sales_30d: string
  sales_count_30d: number
  avg_ticket_30d: string
  top_products: TopProduct[]
  slow_products: StockProduct[]
  low_stock_products: StockProduct[]
  recent_sales: RecentSale[]
}

const money = (value: string | number) =>
  Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const response = await api.get('/dashboard/')
      setData(response.data)
    } catch {
      setError('Não foi possível carregar o dashboard.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const chartData = useMemo(
    () =>
      (data?.top_products || []).map((item) => ({
        ...item,
        revenue_number: Number(item.revenue),
        label:
          item.product__name.length > 18
            ? `${item.product__name.slice(0, 18)}…`
            : item.product__name,
      })),
    [data],
  )

  if (loading && !data) return <p>Carregando dashboard...</p>

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p className="muted">
            Visão geral do estoque e das vendas do AutoStock.
          </p>
        </div>
        <button type="button" onClick={load}>Atualizar</button>
      </div>

      {error && <p className="error">{error}</p>}

      {data && (
        <>
          <div className="dashboard-cards">
            <div className="card">
              <span className="muted">Produtos ativos</span>
              <strong>{data.products}</strong>
            </div>

            <div className="card">
              <span className="muted">Estoque baixo</span>
              <strong>{data.low_stock}</strong>
            </div>

            <div className="card">
              <span className="muted">Produtos zerados</span>
              <strong>{data.out_of_stock}</strong>
            </div>

            <div className="card">
              <span className="muted">Unidades em estoque</span>
              <strong>{data.inventory_units}</strong>
            </div>

            <div className="card">
              <span className="muted">Valor do estoque</span>
              <strong>{money(data.inventory_value)}</strong>
            </div>

            <div className="card">
              <span className="muted">Vendas - 30 dias</span>
              <strong>{money(data.sales_30d)}</strong>
            </div>

            <div className="card">
              <span className="muted">Nº de vendas - 30 dias</span>
              <strong>{data.sales_count_30d}</strong>
            </div>

            <div className="card">
              <span className="muted">Ticket médio - 30 dias</span>
              <strong>{money(data.avg_ticket_30d)}</strong>
            </div>
          </div>

          <div className="dashboard-grid">
            <section>
              <h3>Produtos mais vendidos - últimos 30 dias</h3>

              {chartData.length === 0 ? (
                <p className="muted">Ainda não há vendas suficientes para o gráfico.</p>
              ) : (
                <div className="chart-box">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" angle={-15} textAnchor="end" height={65} />
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
            </section>

            <section>
              <h3>Estoque em atenção</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Produto</th>
                      <th>Atual</th>
                      <th>Mínimo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.low_stock_products.length === 0 ? (
                      <tr><td colSpan={4}>Nenhum produto em estoque crítico.</td></tr>
                    ) : (
                      data.low_stock_products.map((product) => (
                        <tr key={product.id}>
                          <td>{product.sku}</td>
                          <td>{product.name}</td>
                          <td><strong>{product.quantity}</strong></td>
                          <td>{product.min_stock}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="dashboard-grid">
            <section>
              <h3>Últimas vendas</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Cliente</th>
                      <th>Data</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_sales.length === 0 ? (
                      <tr><td colSpan={4}>Nenhuma venda registrada.</td></tr>
                    ) : (
                      data.recent_sales.map((sale) => (
                        <tr key={sale.id}>
                          <td>{sale.id}</td>
                          <td>{sale.customer_name || '-'}</td>
                          <td>{new Date(sale.created_at).toLocaleString('pt-BR')}</td>
                          <td>{money(sale.total)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h3>Sem vendas nos últimos 90 dias</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Produto</th>
                      <th>Estoque</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.slow_products.length === 0 ? (
                      <tr><td colSpan={3}>Nenhum produto parado identificado.</td></tr>
                    ) : (
                      data.slow_products.map((product) => (
                        <tr key={product.id}>
                          <td>{product.sku}</td>
                          <td>{product.name}</td>
                          <td>{product.quantity}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}
    </>
  )
}
