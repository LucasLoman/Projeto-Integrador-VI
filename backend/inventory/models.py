from django.db import models, transaction
from django.contrib.auth import get_user_model

User=get_user_model()

class Category(models.Model):
    name=models.CharField(max_length=120, unique=True)
    def __str__(self): return self.name

class Brand(models.Model):
    name=models.CharField(max_length=120, unique=True)
    def __str__(self): return self.name

class Supplier(models.Model):
    name=models.CharField(max_length=160)
    cnpj=models.CharField(max_length=18, blank=True)
    phone=models.CharField(max_length=30, blank=True)
    email=models.EmailField(blank=True)
    lead_time_days=models.PositiveIntegerField(default=7)
    def __str__(self): return self.name

class Product(models.Model):
    sku=models.CharField(max_length=60, unique=True)
    name=models.CharField(max_length=180)
    category=models.ForeignKey(Category,on_delete=models.SET_NULL,null=True,blank=True,related_name='products')
    brand=models.ForeignKey(Brand,on_delete=models.SET_NULL,null=True,blank=True,related_name='products')
    supplier=models.ForeignKey(Supplier,on_delete=models.SET_NULL,null=True,blank=True,related_name='products')
    cost_price=models.DecimalField(max_digits=12,decimal_places=2,default=0)
    sale_price=models.DecimalField(max_digits=12,decimal_places=2,default=0)
    quantity=models.IntegerField(default=0)
    min_stock=models.PositiveIntegerField(default=0)
    location=models.CharField(max_length=80,blank=True)
    active=models.BooleanField(default=True)
    created_at=models.DateTimeField(auto_now_add=True)
    updated_at=models.DateTimeField(auto_now=True)
    def __str__(self): return f'{self.sku} - {self.name}'

class StockMovement(models.Model):
    IN='IN'; OUT='OUT'; ADJ='ADJ'
    TYPES=[(IN,'Entrada'),(OUT,'Saída'),(ADJ,'Ajuste')]
    product=models.ForeignKey(Product,on_delete=models.CASCADE,related_name='movements')
    movement_type=models.CharField(max_length=3,choices=TYPES)
    quantity=models.PositiveIntegerField()
    unit_cost=models.DecimalField(max_digits=12,decimal_places=2,null=True,blank=True)
    note=models.CharField(max_length=255,blank=True)
    created_by=models.ForeignKey(User,on_delete=models.SET_NULL,null=True,blank=True)
    created_at=models.DateTimeField(auto_now_add=True)

    def save(self,*args,**kwargs):
        if self.pk:
            return super().save(*args,**kwargs)
        with transaction.atomic():
            product=Product.objects.select_for_update().get(pk=self.product_id)
            if self.movement_type==self.IN:
                product.quantity += self.quantity
            elif self.movement_type==self.OUT:
                if product.quantity < self.quantity:
                    raise ValueError('Estoque insuficiente')
                product.quantity -= self.quantity
            elif self.movement_type==self.ADJ:
                product.quantity = self.quantity
            product.save(update_fields=['quantity','updated_at'])
            super().save(*args,**kwargs)

class Sale(models.Model):
    customer_name=models.CharField(max_length=160,blank=True)
    total=models.DecimalField(max_digits=12,decimal_places=2,default=0)
    created_by=models.ForeignKey(User,on_delete=models.SET_NULL,null=True,blank=True)
    created_at=models.DateTimeField(auto_now_add=True)

class SaleItem(models.Model):
    sale=models.ForeignKey(Sale,on_delete=models.CASCADE,related_name='items')
    product=models.ForeignKey(Product,on_delete=models.PROTECT)
    quantity=models.PositiveIntegerField()
    unit_price=models.DecimalField(max_digits=12,decimal_places=2)
    subtotal=models.DecimalField(max_digits=12,decimal_places=2,default=0)

    def save(self,*args,**kwargs):
        self.subtotal=self.quantity*self.unit_price
        super().save(*args,**kwargs)
