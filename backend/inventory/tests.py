from django.contrib.auth.models import User
from rest_framework.test import APITestCase
from rest_framework import status
from .models import Product, StockMovement


class ProductCrudTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='teste', password='teste123')
        self.client.force_authenticate(self.user)

    def test_create_product(self):
        response = self.client.post(
            '/api/products/',
            {
                'sku': 'abc-001',
                'name': 'Pastilha de Freio',
                'cost_price': '80.00',
                'sale_price': '129.90',
                'min_stock': 5,
                'location': 'A-01',
                'active': True,
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Product.objects.count(), 1)
        self.assertEqual(Product.objects.first().sku, 'ABC-001')

    def test_list_products(self):
        Product.objects.create(sku='P001', name='Filtro de Óleo', sale_price=30)
        response = self.client.get('/api/products/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_update_product(self):
        product = Product.objects.create(sku='P001', name='Filtro', sale_price=30)
        response = self.client.patch(
            f'/api/products/{product.id}/',
            {'name': 'Filtro de Óleo', 'sale_price': '35.00'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        product.refresh_from_db()
        self.assertEqual(product.name, 'Filtro de Óleo')

    def test_delete_product(self):
        product = Product.objects.create(sku='P001', name='Filtro')
        response = self.client.delete(f'/api/products/{product.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Product.objects.filter(id=product.id).exists())

    def test_search_product(self):
        Product.objects.create(sku='P001', name='Pastilha de Freio')
        Product.objects.create(sku='P002', name='Filtro de Óleo')
        response = self.client.get('/api/products/?search=Pastilha')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['sku'], 'P001')


class StockMovementTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='teste', password='teste123')
        self.client.force_authenticate(self.user)
        self.product = Product.objects.create(sku='P001', name='Produto Teste', quantity=10, min_stock=2)

    def test_stock_increases_on_entry(self):
        response = self.client.post(
            '/api/movements/',
            {'product': self.product.id, 'movement_type': 'IN', 'quantity': 5},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.product.refresh_from_db()
        self.assertEqual(self.product.quantity, 15)
