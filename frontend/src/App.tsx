import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Login from './pages/Login'
import ProductQR from './pages/ProductQR'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import Movements from './pages/Movements'
import Suppliers from './pages/Suppliers'
import Analytics from './pages/Analytics'
import Sales from './pages/Sales'
import Categories from './pages/Categories'
import Brands from './pages/Brands'
import LowStock from './pages/LowStock'

const menu = [
  {
    title: 'Operação',
    links: [
      { to: '/', label: 'Dashboard' },
      { to: '/produtos', label: 'Produtos' },
      { to: '/movimentacoes', label: 'Movimentações' },
      { to: '/vendas', label: 'Vendas' },
    ],
  },
  {
    title: 'Cadastros',
    links: [
      { to: '/fornecedores', label: 'Fornecedores' },
      { to: '/categorias', label: 'Categorias' },
      { to: '/marcas', label: 'Marcas' },
    ],
  },
  {
    title: 'Acompanhamento',
    links: [
      { to: '/estoque-minimo', label: 'Estoque mínimo' },
      { to: '/analises', label: 'Análises' },
    ],
  },
]

function Layout() {
  const navigate = useNavigate()
  const logout = () => {
    localStorage.clear()
    navigate('/login')
  }

  return (
    <div className="app">
      <aside>
        <h1 className="brand">AutoStock</h1>
        <nav>
          {menu.map((group) => (
            <div key={group.title}>
              <div className="nav-title">{group.title}</div>
              {group.links.map((link) => (
                <NavLink key={link.to} to={link.to} end={link.to === '/'}>
                  {link.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <button className="secondary" onClick={logout}>Sair</button>
      </aside>
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/produtos" element={<Products />} />
          <Route path="/produto/:id" element={<ProductQR />} />
          <Route path="/movimentacoes" element={<Movements />} />
          <Route path="/vendas" element={<Sales />} />
          <Route path="/fornecedores" element={<Suppliers />} />
          <Route path="/categorias" element={<Categories />} />
          <Route path="/marcas" element={<Brands />} />
          <Route path="/estoque-minimo" element={<LowStock />} />
          <Route path="/analises" element={<Analytics />} />
        </Routes>
      </main>
    </div>
  )
}

function RequireAuth() {
  const logged = !!localStorage.getItem('access')
  const location = useLocation()
  return logged ? (
    <Layout />
  ) : (
    <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={<RequireAuth />} />
    </Routes>
  )
}
