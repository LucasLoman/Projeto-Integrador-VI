from django.contrib.auth.models import User
from rest_framework.test import APITestCase
from rest_framework import status
from .models import Product, StockMovement

class StockMovementTests(APITestCase):
    def setUp(self):
        self.user=User.objects.create_user(username='teste',password='teste123')
        self.client.force_authenticate(self.user)
        self.product=Product.objects.create(sku='P001',name='Produto Teste',quantity=10,min_stock=2)

    def test_stock_increases_on_entry(self):
        response=self.client.post('/api/movements/',{'product':self.product.id,'movement_type':'IN','quantity':5},format='json')
        self.assertEqual(response.status_code,status.HTTP_201_CREATED)
        self.product.refresh_from_db()
        self.assertEqual(self.product.quantity,15)
