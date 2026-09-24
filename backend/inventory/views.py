from datetime import timedelta
from decimal import Decimal
from django.db.models import Sum, F, DecimalField, ExpressionWrapper
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


class StockMovementViewSet(viewsets.ModelViewSet):
    queryset = StockMovement.objects.select_related('product').all().order_by('-created_at')
    serializer_class = StockMovementSerializer
    http_method_names = ['get', 'post', 'head', 'options']


class SaleViewSet(viewsets.ModelViewSet):
    queryset = Sale.objects.prefetch_related('items__product').all().order_by('-created_at')
    serializer_class = SaleSerializer
    http_method_names = ['get', 'post', 'head', 'options']


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def dashboard(request):
    today = timezone.now()
    since30 = today - timedelta(days=30)
    since90 = today - timedelta(days=90)
    products = Product.objects.filter(active=True)
    low_stock = products.filter(quantity__lte=F('min_stock')).count()
    inventory_value = products.aggregate(
        v=Sum(
            ExpressionWrapper(
                F('quantity') * F('cost_price'),
                output_field=DecimalField(max_digits=16, decimal_places=2),
            )
        )
    )['v'] or 0
    sales30 = Sale.objects.filter(created_at__gte=since30).aggregate(v=Sum('total'))['v'] or 0
    top = list(
        SaleItem.objects.filter(sale__created_at__gte=since30)
        .values('product__id', 'product__name')
        .annotate(qty=Sum('quantity'), revenue=Sum('subtotal'))
        .order_by('-revenue')[:10]
    )
    sold_ids = SaleItem.objects.filter(sale__created_at__gte=since90).values_list('product_id', flat=True)
    slow = list(products.exclude(id__in=sold_ids).values('id', 'sku', 'name', 'quantity')[:20])
    return Response(
        {
            'products': products.count(),
            'low_stock': low_stock,
            'inventory_value': inventory_value,
            'sales_30d': sales30,
            'top_products': top,
            'slow_products': slow,
        }
    )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def abc_analysis(request):
    since = timezone.now() - timedelta(days=90)
    rows = list(
        SaleItem.objects.filter(sale__created_at__gte=since)
        .values('product__id', 'product__sku', 'product__name')
        .annotate(revenue=Sum('subtotal'))
        .order_by('-revenue')
    )
    total = sum(Decimal(str(r['revenue'] or 0)) for r in rows) or Decimal('1')
    cumulative = Decimal('0')
    out = []
    for r in rows:
        rev = Decimal(str(r['revenue'] or 0))
        cumulative += rev
        pct = float(cumulative / total * 100)
        cls = 'A' if pct <= 80 else ('B' if pct <= 95 else 'C')
        out.append({**r, 'revenue': rev, 'cumulative_pct': round(pct, 2), 'class': cls})
    return Response(out)


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
