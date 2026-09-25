from datetime import timedelta
from decimal import Decimal
from django.db.models import Sum, F, Max, DecimalField, ExpressionWrapper
from django.utils import timezone
from rest_framework import viewsets, permissions, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from .models import Category, Brand, Supplier, Product, StockMovement, Sale, SaleItem
from .serializers import (
    CategorySerializer,
    BrandSerializer,
    SupplierSerializer,
    ProductSerializer,
    StockMovementSerializer,
    SaleSerializer,
)


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all().order_by('name')
    serializer_class = CategorySerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']


class BrandViewSet(viewsets.ModelViewSet):
    queryset = Brand.objects.all().order_by('name')
    serializer_class = BrandSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all().order_by('name')
    serializer_class = SupplierSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'cnpj', 'phone', 'email']


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.select_related('category', 'brand', 'supplier').all().order_by('name')
    serializer_class = ProductSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['sku', 'name', 'category__name', 'brand__name', 'supplier__name', 'location']

    def get_queryset(self):
        queryset = super().get_queryset()

        low_stock = self.request.query_params.get('low_stock')
        active = self.request.query_params.get('active')

        if low_stock and low_stock.lower() in {'1', 'true', 'sim', 'yes'}:
            queryset = queryset.filter(quantity__lte=F('min_stock'))

        if active is not None:
            if active.lower() in {'1', 'true', 'sim', 'yes'}:
                queryset = queryset.filter(active=True)
            elif active.lower() in {'0', 'false', 'nao', 'não', 'no'}:
                queryset = queryset.filter(active=False)

        return queryset


class StockMovementViewSet(viewsets.ModelViewSet):
    queryset = StockMovement.objects.select_related('product', 'created_by').all().order_by('-created_at')
    serializer_class = StockMovementSerializer
    http_method_names = ['get', 'post', 'head', 'options']
    filter_backends = [filters.SearchFilter]
    search_fields = ['product__sku', 'product__name', 'note']

    def get_queryset(self):
        queryset = super().get_queryset()

        product_id = self.request.query_params.get('product')
        movement_type = self.request.query_params.get('type')

        if product_id:
            queryset = queryset.filter(product_id=product_id)

        if movement_type in {StockMovement.IN, StockMovement.OUT, StockMovement.ADJ}:
            queryset = queryset.filter(movement_type=movement_type)

        return queryset


class SaleViewSet(viewsets.ModelViewSet):
    queryset = (
        Sale.objects.select_related('created_by')
        .prefetch_related('items__product')
        .all()
        .order_by('-created_at')
    )
    serializer_class = SaleSerializer
    http_method_names = ['get', 'post', 'head', 'options']
    filter_backends = [filters.SearchFilter]
    search_fields = [
        'customer_name',
        'items__product__sku',
        'items__product__name',
    ]

    def get_queryset(self):
        queryset = super().get_queryset()
        customer = self.request.query_params.get('customer')

        if customer:
            queryset = queryset.filter(customer_name__icontains=customer)

        return queryset.distinct()


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def dashboard(request):
    today = timezone.now()
    since30 = today - timedelta(days=30)
    since90 = today - timedelta(days=90)

    products = Product.objects.filter(active=True)
    sales_30_queryset = Sale.objects.filter(created_at__gte=since30)

    products_count = products.count()
    low_stock = products.filter(quantity__lte=F('min_stock')).count()
    out_of_stock = products.filter(quantity__lte=0).count()

    inventory_units = products.aggregate(v=Sum('quantity'))['v'] or 0

    inventory_value = products.aggregate(
        v=Sum(
            ExpressionWrapper(
                F('quantity') * F('cost_price'),
                output_field=DecimalField(max_digits=16, decimal_places=2),
            )
        )
    )['v'] or 0

    sales_30d = sales_30_queryset.aggregate(v=Sum('total'))['v'] or 0
    sales_count_30d = sales_30_queryset.count()
    avg_ticket_30d = (
        Decimal(str(sales_30d)) / sales_count_30d
        if sales_count_30d
        else Decimal('0')
    )

    top_products = list(
        SaleItem.objects.filter(sale__created_at__gte=since30)
        .values('product__id', 'product__sku', 'product__name')
        .annotate(qty=Sum('quantity'), revenue=Sum('subtotal'))
        .order_by('-revenue')[:10]
    )

    sold_ids_90d = SaleItem.objects.filter(
        sale__created_at__gte=since90
    ).values_list('product_id', flat=True)

    slow_products = list(
        products.exclude(id__in=sold_ids_90d)
        .values('id', 'sku', 'name', 'quantity', 'min_stock')
        .order_by('name')[:20]
    )

    low_stock_products = list(
        products.filter(quantity__lte=F('min_stock'))
        .values('id', 'sku', 'name', 'quantity', 'min_stock')
        .order_by('quantity', 'name')[:10]
    )

    recent_sales = list(
        Sale.objects.order_by('-created_at')
        .values('id', 'customer_name', 'total', 'created_at')[:5]
    )

    return Response(
        {
            'products': products_count,
            'low_stock': low_stock,
            'out_of_stock': out_of_stock,
            'inventory_units': inventory_units,
            'inventory_value': inventory_value,
            'sales_30d': sales_30d,
            'sales_count_30d': sales_count_30d,
            'avg_ticket_30d': avg_ticket_30d,
            'top_products': top_products,
            'slow_products': slow_products,
            'low_stock_products': low_stock_products,
            'recent_sales': recent_sales,
        }
    )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def abc_analysis(request):
    try:
        days = int(request.query_params.get('days', 90))
    except (TypeError, ValueError):
        days = 90

    # Evita períodos absurdos e mantém a consulta leve.
    days = max(1, min(days, 3650))
    since = timezone.now() - timedelta(days=days)

    rows = list(
        SaleItem.objects.filter(sale__created_at__gte=since)
        .values('product__id', 'product__sku', 'product__name')
        .annotate(
            revenue=Sum('subtotal'),
            qty=Sum('quantity'),
        )
        .order_by('-revenue', 'product__name')
    )

    total = sum(Decimal(str(row['revenue'] or 0)) for row in rows)

    if total <= 0:
        return Response([])

    cumulative = Decimal('0')
    result = []

    for row in rows:
        revenue = Decimal(str(row['revenue'] or 0))
        share_pct = (revenue / total) * Decimal('100')
        cumulative_before = (cumulative / total) * Decimal('100')

        # A: itens que compõem aproximadamente os primeiros 80% do faturamento.
        # B: faixa seguinte até aproximadamente 95%.
        # C: itens restantes.
        if cumulative_before < Decimal('80'):
            abc_class = 'A'
        elif cumulative_before < Decimal('95'):
            abc_class = 'B'
        else:
            abc_class = 'C'

        cumulative += revenue
        cumulative_pct = (cumulative / total) * Decimal('100')

        result.append(
            {
                **row,
                'revenue': revenue,
                'share_pct': round(float(share_pct), 2),
                'cumulative_pct': round(float(cumulative_pct), 2),
                'class': abc_class,
            }
        )

    return Response(result)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def slow_products(request):
    """
    Lista produtos considerados parados:
    - produto ativo;
    - possui saldo em estoque;
    - não teve venda dentro do período escolhido;
    - para produtos nunca vendidos, considera a data de cadastro.
    """
    try:
        days = int(request.query_params.get('days', 90))
    except (TypeError, ValueError):
        days = 90

    days = max(1, min(days, 3650))
    now = timezone.now()
    since = now - timedelta(days=days)

    # Produtos vendidos dentro do período não são considerados parados.
    recently_sold_ids = SaleItem.objects.filter(
        sale__created_at__gte=since
    ).values_list('product_id', flat=True)

    # Última venda histórica de cada produto.
    last_sales = (
        SaleItem.objects.values('product_id')
        .annotate(last_sale=Max('sale__created_at'))
    )
    last_sale_map = {
        row['product_id']: row['last_sale']
        for row in last_sales
    }

    products = (
        Product.objects.filter(active=True, quantity__gt=0)
        .exclude(id__in=recently_sold_ids)
        .select_related('category', 'brand', 'supplier')
        .order_by('name')
    )

    result = []
    total_inventory_value = Decimal('0')

    for product in products:
        last_sale = last_sale_map.get(product.id)

        # Se nunca vendeu, só classifica como parado quando já está cadastrado
        # há pelo menos o período selecionado.
        reference_date = last_sale or product.created_at
        if reference_date > since:
            continue

        days_without_sale = max((now - reference_date).days, 0)
        inventory_value = Decimal(product.cost_price) * product.quantity
        total_inventory_value += inventory_value

        result.append(
            {
                'product_id': product.id,
                'sku': product.sku,
                'name': product.name,
                'category': product.category.name if product.category else None,
                'brand': product.brand.name if product.brand else None,
                'supplier': product.supplier.name if product.supplier else None,
                'quantity': product.quantity,
                'cost_price': product.cost_price,
                'inventory_value': inventory_value,
                'last_sale': last_sale,
                'never_sold': last_sale is None,
                'days_without_sale': days_without_sale,
                'location': product.location,
            }
        )

    result.sort(
        key=lambda item: (
            -item['days_without_sale'],
            -float(item['inventory_value']),
            item['name'].lower(),
        )
    )

    return Response(
        {
            'period_days': days,
            'count': len(result),
            'inventory_value': total_inventory_value,
            'items': result,
        }
    )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def rupture_forecast(request):
    """
    Previsão simples de ruptura baseada no consumo médio diário do período escolhido.

    Fórmula principal:
        consumo médio diário = quantidade vendida no período / dias analisados
        cobertura = estoque atual / consumo médio diário

    O prazo do fornecedor é usado para indicar o nível de risco.
    """
    try:
        days = int(request.query_params.get('days', 30))
    except (TypeError, ValueError):
        days = 30

    try:
        safety_days = int(request.query_params.get('safety_days', 3))
    except (TypeError, ValueError):
        safety_days = 3

    days = max(7, min(days, 365))
    safety_days = max(0, min(safety_days, 30))

    now = timezone.now()
    since = now - timedelta(days=days)

    sales = (
        SaleItem.objects.filter(sale__created_at__gte=since)
        .values('product_id')
        .annotate(qty=Sum('quantity'))
    )
    sold_map = {row['product_id']: row['qty'] or 0 for row in sales}

    items = []
    summary = {
        'RUPTURA': 0,
        'CRITICO': 0,
        'ATENCAO': 0,
        'OK': 0,
        'SEM_HISTORICO': 0,
    }

    products = (
        Product.objects.filter(active=True)
        .select_related('supplier')
        .order_by('name')
    )

    for product in products:
        sold_qty = sold_map.get(product.id, 0)
        avg_daily = sold_qty / days
        lead_time = product.supplier.lead_time_days if product.supplier else 7

        if avg_daily <= 0:
            coverage_days = None
            rupture_date = None
            risk = 'SEM_HISTORICO'
        else:
            coverage_days = product.quantity / avg_daily
            rupture_date = now + timedelta(days=coverage_days)

            if product.quantity <= 0:
                risk = 'RUPTURA'
            elif coverage_days <= lead_time:
                risk = 'CRITICO'
            elif coverage_days <= lead_time + safety_days:
                risk = 'ATENCAO'
            else:
                risk = 'OK'

        summary[risk] += 1

        items.append(
            {
                'product_id': product.id,
                'sku': product.sku,
                'name': product.name,
                'quantity': product.quantity,
                'sold_qty': sold_qty,
                'analysis_days': days,
                'avg_daily': round(avg_daily, 2),
                'lead_time_days': lead_time,
                'safety_days': safety_days,
                'coverage_days': round(coverage_days, 1) if coverage_days is not None else None,
                'rupture_date': rupture_date,
                'risk': risk,
                'supplier': product.supplier.name if product.supplier else None,
            }
        )

    risk_order = {
        'RUPTURA': 0,
        'CRITICO': 1,
        'ATENCAO': 2,
        'OK': 3,
        'SEM_HISTORICO': 4,
    }
    items.sort(
        key=lambda item: (
            risk_order[item['risk']],
            item['coverage_days'] if item['coverage_days'] is not None else 999999,
            item['name'].lower(),
        )
    )

    return Response(
        {
            'analysis_days': days,
            'safety_days': safety_days,
            'summary': summary,
            'items': items,
        }
    )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def replenishment(request):
    days = int(request.query_params.get('days', 30))
    since = timezone.now() - timedelta(days=days)
    sales = SaleItem.objects.filter(sale__created_at__gte=since).values('product_id').annotate(qty=Sum('quantity'))
    sold = {x['product_id']: x['qty'] for x in sales}
    result = []
    for p in Product.objects.filter(active=True).select_related('supplier'):
        avg_daily = (sold.get(p.id, 0) or 0) / max(days, 1)
        lead = p.supplier.lead_time_days if p.supplier else 7
        coverage = (p.quantity / avg_daily) if avg_daily > 0 else None
        safety = max(p.min_stock, int(round(avg_daily * 3)))
        target = int(round(avg_daily * (lead + 7))) + safety
        suggested = max(0, target - p.quantity)
        risk = (
            'SEM_GIRO'
            if avg_daily == 0
            else (
                'CRITICO'
                if coverage is not None and coverage < lead
                else ('ATENCAO' if coverage is not None and coverage < lead + 3 else 'OK')
            )
        )
        result.append(
            {
                'product_id': p.id,
                'sku': p.sku,
                'name': p.name,
                'quantity': p.quantity,
                'avg_daily': round(avg_daily, 2),
                'lead_time_days': lead,
                'coverage_days': round(coverage, 1) if coverage is not None else None,
                'risk': risk,
                'suggested_purchase': suggested,
            }
        )
    result.sort(key=lambda x: ({'CRITICO': 0, 'ATENCAO': 1, 'OK': 2, 'SEM_GIRO': 3}[x['risk']], -x['suggested_purchase']))
    return Response(result)
