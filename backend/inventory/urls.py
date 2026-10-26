from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CategoryViewSet, BrandViewSet, SupplierViewSet, ProductViewSet, StockMovementViewSet, SaleViewSet, dashboard, abc_analysis, slow_products, rupture_forecast, replenishment

router=DefaultRouter()
router.register('categories',CategoryViewSet)
router.register('brands',BrandViewSet)
router.register('suppliers',SupplierViewSet)
router.register('products',ProductViewSet)
router.register('movements',StockMovementViewSet)
router.register('sales',SaleViewSet)

urlpatterns=[
 path('',include(router.urls)),
 path('dashboard/',dashboard),
 path('analytics/abc/',abc_analysis),
 path('analytics/slow-products/',slow_products),
 path('analytics/rupture-forecast/',rupture_forecast),
 path('analytics/replenishment/',replenishment),
]
