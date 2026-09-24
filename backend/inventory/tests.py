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


class SupplierCrudTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='fornecedor_teste', password='teste123')
        self.client.force_authenticate(self.user)

    def test_create_supplier(self):
        response = self.client.post(
            '/api/suppliers/',
            {
                'name': 'Distribuidora Teste',
                'cnpj': '12345678000199',
                'phone': '(15) 99999-9999',
                'email': 'contato@teste.com.br',
                'lead_time_days': 5,
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Distribuidora Teste')
        self.assertEqual(response.data['lead_time_days'], 5)

    def test_reject_invalid_cnpj(self):
        response = self.client.post(
            '/api/suppliers/',
            {'name': 'Fornecedor Inválido', 'cnpj': '123', 'lead_time_days': 7},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('cnpj', response.data)

    def test_update_supplier(self):
        from .models import Supplier
        supplier = Supplier.objects.create(name='Fornecedor A', lead_time_days=7)
        response = self.client.patch(
            f'/api/suppliers/{supplier.id}/',
            {'lead_time_days': 3, 'phone': '15999999999'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        supplier.refresh_from_db()
        self.assertEqual(supplier.lead_time_days, 3)

    def test_search_supplier(self):
        from .models import Supplier
        Supplier.objects.create(name='Auto Distribuidora Sul', cnpj='12345678000199')
        Supplier.objects.create(name='Peças Norte', cnpj='98765432000188')
        response = self.client.get('/api/suppliers/?search=Sul')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'Auto Distribuidora Sul')
