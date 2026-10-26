from django.contrib import admin
from .models import Category,Brand,Supplier,Product,StockMovement,Sale,SaleItem
admin.site.register([Category,Brand,Supplier,Product,StockMovement,Sale,SaleItem])
