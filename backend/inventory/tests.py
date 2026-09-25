from django.contrib.auth.models import User
from rest_framework.test import APITestCase
from rest_framework import status
from .models import Product, StockMovement, Sale, SaleItem


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
        self.user = User.objects.create_user(username='estoque_teste', password='teste123')
        self.client.force_authenticate(self.user)
        self.product = Product.objects.create(
            sku='P001',
            name='Produto Teste',
            quantity=10,
            min_stock=2,
        )

    def test_stock_increases_on_entry(self):
        response = self.client.post(
            '/api/movements/',
            {
                'product': self.product.id,
                'movement_type': 'IN',
                'quantity': 5,
                'unit_cost': '20.50',
                'note': 'Compra do fornecedor',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.product.refresh_from_db()
        self.assertEqual(self.product.quantity, 15)

    def test_stock_decreases_on_exit(self):
        response = self.client.post(
            '/api/movements/',
            {'product': self.product.id, 'movement_type': 'OUT', 'quantity': 4},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.product.refresh_from_db()
        self.assertEqual(self.product.quantity, 6)

    def test_reject_exit_when_stock_is_insufficient(self):
        response = self.client.post(
            '/api/movements/',
            {'product': self.product.id, 'movement_type': 'OUT', 'quantity': 11},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.product.refresh_from_db()
        self.assertEqual(self.product.quantity, 10)

    def test_adjustment_sets_exact_stock(self):
        response = self.client.post(
            '/api/movements/',
            {'product': self.product.id, 'movement_type': 'ADJ', 'quantity': 7},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.product.refresh_from_db()
        self.assertEqual(self.product.quantity, 7)

    def test_movement_records_authenticated_user(self):
        response = self.client.post(
            '/api/movements/',
            {'product': self.product.id, 'movement_type': 'IN', 'quantity': 1},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        movement = StockMovement.objects.latest('id')
        self.assertEqual(movement.created_by, self.user)

    def test_filter_movements_by_type(self):
        StockMovement.objects.create(
            product=self.product,
            movement_type=StockMovement.IN,
            quantity=2,
            created_by=self.user,
        )
        StockMovement.objects.create(
            product=self.product,
            movement_type=StockMovement.OUT,
            quantity=1,
            created_by=self.user,
        )
        response = self.client.get('/api/movements/?type=IN')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['movement_type'], 'IN')


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


class CategoryCrudTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='categoria_teste', password='teste123')
        self.client.force_authenticate(self.user)

    def test_create_category(self):
        response = self.client.post('/api/categories/', {'name': 'Freios'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Freios')

    def test_reject_duplicate_category_ignoring_case(self):
        from .models import Category
        Category.objects.create(name='Filtros')
        response = self.client.post('/api/categories/', {'name': 'filtros'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_update_category(self):
        from .models import Category
        category = Category.objects.create(name='Suspensão')
        response = self.client.patch(
            f'/api/categories/{category.id}/',
            {'name': 'Suspensão e Direção'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        category.refresh_from_db()
        self.assertEqual(category.name, 'Suspensão e Direção')

    def test_delete_category(self):
        from .models import Category
        category = Category.objects.create(name='Elétrica')
        response = self.client.delete(f'/api/categories/{category.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Category.objects.filter(id=category.id).exists())

    def test_search_category(self):
        from .models import Category
        Category.objects.create(name='Freios')
        Category.objects.create(name='Filtros')
        response = self.client.get('/api/categories/?search=Freio')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'Freios')

class BrandCrudTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='marca_teste', password='teste123')
        self.client.force_authenticate(self.user)

    def test_create_brand(self):
        response = self.client.post('/api/brands/', {'name': 'Bosch'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Bosch')

    def test_reject_duplicate_brand_ignoring_case(self):
        from .models import Brand
        Brand.objects.create(name='Cobreq')
        response = self.client.post('/api/brands/', {'name': 'cobreq'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_update_brand(self):
        from .models import Brand
        brand = Brand.objects.create(name='Mann')
        response = self.client.patch(
            f'/api/brands/{brand.id}/',
            {'name': 'MANN-FILTER'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        brand.refresh_from_db()
        self.assertEqual(brand.name, 'MANN-FILTER')

    def test_delete_brand(self):
        from .models import Brand
        brand = Brand.objects.create(name='Gates')
        response = self.client.delete(f'/api/brands/{brand.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Brand.objects.filter(id=brand.id).exists())

    def test_search_brand(self):
        from .models import Brand
        Brand.objects.create(name='Bosch')
        Brand.objects.create(name='Fremax')
        response = self.client.get('/api/brands/?search=Bos')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'Bosch')

class SaleTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='vendas_teste', password='teste123')
        self.client.force_authenticate(self.user)
        self.product_a = Product.objects.create(
            sku='PA001',
            name='Pastilha de Freio',
            quantity=10,
            min_stock=2,
            sale_price='100.00',
        )
        self.product_b = Product.objects.create(
            sku='OL001',
            name='Óleo 5W30',
            quantity=20,
            min_stock=5,
            sale_price='40.00',
        )

    def test_create_sale_with_multiple_items_and_reduce_stock(self):
        response = self.client.post(
            '/api/sales/',
            {
                'customer_name': 'Cliente Teste',
                'items': [
                    {'product': self.product_a.id, 'quantity': 2},
                    {'product': self.product_b.id, 'quantity': 3},
                ],
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(str(response.data['total']), '320.00')

        self.product_a.refresh_from_db()
        self.product_b.refresh_from_db()
        self.assertEqual(self.product_a.quantity, 8)
        self.assertEqual(self.product_b.quantity, 17)

        sale = Sale.objects.get(pk=response.data['id'])
        self.assertEqual(sale.items.count(), 2)
        self.assertEqual(
            StockMovement.objects.filter(note=f'Venda #{sale.id}').count(),
            2,
        )

    def test_sale_accepts_custom_unit_price(self):
        response = self.client.post(
            '/api/sales/',
            {
                'items': [
                    {
                        'product': self.product_a.id,
                        'quantity': 2,
                        'unit_price': '90.00',
                    }
                ],
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(str(response.data['total']), '180.00')

    def test_sale_fails_when_stock_is_insufficient_and_does_not_create_partial_sale(self):
        response = self.client.post(
            '/api/sales/',
            {
                'items': [
                    {'product': self.product_a.id, 'quantity': 2},
                    {'product': self.product_b.id, 'quantity': 50},
                ],
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Sale.objects.count(), 0)
        self.assertEqual(SaleItem.objects.count(), 0)

        self.product_a.refresh_from_db()
        self.product_b.refresh_from_db()
        self.assertEqual(self.product_a.quantity, 10)
        self.assertEqual(self.product_b.quantity, 20)

    def test_sale_rejects_duplicate_product_items(self):
        response = self.client.post(
            '/api/sales/',
            {
                'items': [
                    {'product': self.product_a.id, 'quantity': 1},
                    {'product': self.product_a.id, 'quantity': 2},
                ],
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Sale.objects.count(), 0)

    def test_sale_requires_at_least_one_item(self):
        response = self.client.post(
            '/api/sales/',
            {'customer_name': 'Cliente', 'items': []},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

class MinimumStockTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='estoque_minimo_teste', password='teste123')
        self.client.force_authenticate(self.user)

        self.low = Product.objects.create(
            sku='LOW001',
            name='Produto Baixo',
            quantity=3,
            min_stock=5,
            sale_price='10.00',
        )
        self.zero = Product.objects.create(
            sku='ZERO001',
            name='Produto Zerado',
            quantity=0,
            min_stock=2,
            sale_price='20.00',
        )
        self.ok = Product.objects.create(
            sku='OK001',
            name='Produto OK',
            quantity=10,
            min_stock=4,
            sale_price='30.00',
        )

    def test_filter_low_stock_products(self):
        response = self.client.get('/api/products/?low_stock=true')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        skus = {item['sku'] for item in response.data}
        self.assertIn('LOW001', skus)
        self.assertIn('ZERO001', skus)
        self.assertNotIn('OK001', skus)

    def test_stock_status_for_low_product(self):
        response = self.client.get(f'/api/products/{self.low.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['stock_status'], 'ESTOQUE_BAIXO')
        self.assertEqual(response.data['stock_difference'], 2)

    def test_stock_status_for_zero_product(self):
        response = self.client.get(f'/api/products/{self.zero.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['stock_status'], 'SEM_ESTOQUE')

    def test_stock_status_for_normal_product(self):
        response = self.client.get(f'/api/products/{self.ok.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['stock_status'], 'OK')
        self.assertEqual(response.data['stock_difference'], 0)

