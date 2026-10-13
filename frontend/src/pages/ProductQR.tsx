import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { api } from '../api'

type Product = {
  id: number
  sku: string
  name: string
  category_name?: string
  brand_name?: string
  supplier_name?: string
  sale_price: string
  quantity: number
  min_stock: number
  location: string
  active: boolean
}

export default function ProductQR() {
  const { id } = useParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const qrRef = useRef<HTMLDivElement>(null)

  const productUrl = useMemo(() => {
    const configured = import.meta.env.VITE_APP_URL
    const base = configured
      ? String(configured).replace(/\/$/, '')
      : window.location.origin
    return `${base}/produto/${id}`
  }, [id])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        const response = await api.get(`/products/${id}/`)
        setProduct(response.data)
      } catch {
        setError('Não foi possível carregar o produto.')
      } finally {
        setLoading(false)
      }
    }

    if (id) load()
  }, [id])

  function downloadQRCode() {
    const svg = qrRef.current?.querySelector('svg')
    if (!svg || !product) return

    const serializer = new XMLSerializer()
    const source = serializer.serializeToString(svg)
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = `qrcode-${product.sku}.svg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (loading) return <p>Carregando produto...</p>

  if (error || !product) {
    return (
      <>
        <p className="error">{error || 'Produto não encontrado.'}</p>
        <Link to="/produtos">Voltar para produtos</Link>
      </>
    )
  }

  return (
    <>
      <div className="page-header no-print">
        <div>
          <h2>QR Code do produto</h2>
          <p className="muted">
            Imprima a etiqueta ou salve o QR Code para identificar o produto.
          </p>
        </div>

        <div className="form-actions">
          <Link className="link-button secondary" to="/produtos">
            Voltar
          </Link>
          <button type="button" className="secondary" onClick={downloadQRCode}>
            Baixar QR
          </button>
          <button type="button" onClick={() => window.print()}>
            Imprimir etiqueta
          </button>
        </div>
      </div>

      <div className="qr-page">
        <div className="qr-label" ref={qrRef}>
          <div className="qr-brand">AutoStock</div>

          <QRCodeSVG
            value={productUrl}
            size={220}
            level="M"
            includeMargin
            title={`QR Code do produto ${product.sku}`}
          />

          <strong className="qr-product-name">{product.name}</strong>
          <span className="qr-sku">{product.sku}</span>

          <div className="qr-meta">
            <span><b>Local:</b> {product.location || '-'}</span>
            <span><b>Estoque:</b> {product.quantity}</span>
          </div>
        </div>

        <section className="qr-details no-print">
          <h3>Informações do produto</h3>
          <dl className="product-detail-list">
            <div><dt>SKU</dt><dd>{product.sku}</dd></div>
            <div><dt>Produto</dt><dd>{product.name}</dd></div>
            <div><dt>Categoria</dt><dd>{product.category_name || '-'}</dd></div>
            <div><dt>Marca</dt><dd>{product.brand_name || '-'}</dd></div>
            <div><dt>Fornecedor</dt><dd>{product.supplier_name || '-'}</dd></div>
            <div><dt>Estoque atual</dt><dd>{product.quantity}</dd></div>
            <div><dt>Estoque mínimo</dt><dd>{product.min_stock}</dd></div>
            <div><dt>Localização</dt><dd>{product.location || '-'}</dd></div>
            <div>
              <dt>Preço de venda</dt>
              <dd>
                {Number(product.sale_price).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </dd>
            </div>
            <div><dt>Status</dt><dd>{product.active ? 'Ativo' : 'Inativo'}</dd></div>
          </dl>

          <p className="muted qr-url">
            O QR abre: <code>{productUrl}</code>
          </p>
        </section>
      </div>
    </>
  )
}
