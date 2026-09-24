import re
from rest_framework import serializers
from django.db import transaction
from .models import Category, Brand, Supplier, Product, StockMovement, Sale, SaleItem


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'

    def validate_name(self, value):
        value = value.strip()
        if len(value) < 2:
            raise serializers.ValidationError('Informe um nome válido para a categoria.')

        queryset = Category.objects.filter(name__iexact=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError('Já existe uma categoria com esse nome.')
        return value


class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = '__all__'


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = '__all__'

    def validate_name(self, value):
        value = value.strip()
        if len(value) < 2:
            raise serializers.ValidationError('Informe um nome válido para o fornecedor.')
        return value

    def validate_cnpj(self, value):
        if not value:
            return ''
        digits = re.sub(r'\D', '', value)
        if len(digits) != 14:
            raise serializers.ValidationError('O CNPJ deve possuir 14 dígitos.')
        return digits

    def validate_phone(self, value):
        return value.strip() if value else ''

    def validate_lead_time_days(self, value):
        if value < 0:
            raise serializers.ValidationError('O prazo de entrega não pode ser negativo.')
        return value


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    brand_name = serializers.CharField(source='brand.name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)

    class Meta:
        model = Product
        fields = '__all__'
        read_only_fields = ['quantity', 'created_at', 'updated_at']

    def validate_sku(self, value):
        return value.strip().upper()

    def validate(self, attrs):
        for field in ('cost_price', 'sale_price'):
            value = attrs.get(field)
            if value is not None and value < 0:
                raise serializers.ValidationError({field: 'O valor não pode ser negativo.'})

        min_stock = attrs.get('min_stock')
        if min_stock is not None and min_stock < 0:
            raise serializers.ValidationError({'min_stock': 'O estoque mínimo não pode ser negativo.'})

        return attrs


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = StockMovement
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at']

    def create(self, validated_data):
        try:
            validated_data['created_by'] = self.context['request'].user
            return super().create(validated_data)
        except ValueError as e:
            raise serializers.ValidationError({'quantity': str(e)})


class SaleItemInputSerializer(serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.filter(active=True))
    quantity = serializers.IntegerField(min_value=1)
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemInputSerializer(many=True, write_only=True)
    items_detail = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Sale
        fields = ['id', 'customer_name', 'total', 'created_at', 'items', 'items_detail']
        read_only_fields = ['total', 'created_at']

    def get_items_detail(self, obj):
        return [
            {
                'product': i.product_id,
                'product_name': i.product.name,
                'quantity': i.quantity,
                'unit_price': i.unit_price,
                'subtotal': i.subtotal,
            }
            for i in obj.items.all()
        ]

    @transaction.atomic
    def create(self, validated_data):
        items = validated_data.pop('items')
        sale = Sale.objects.create(created_by=self.context['request'].user, **validated_data)
        total = 0
        for item in items:
            product = Product.objects.select_for_update().get(pk=item['product'].pk)
            qty = item['quantity']
            if product.quantity < qty:
                raise serializers.ValidationError({'items': f'Estoque insuficiente para {product.name}'})
            price = item.get('unit_price') or product.sale_price
            SaleItem.objects.create(
                sale=sale,
                product=product,
                quantity=qty,
                unit_price=price,
            )
            StockMovement.objects.create(
                product=product,
                movement_type=StockMovement.OUT,
                quantity=qty,
                note=f'Venda #{sale.id}',
                created_by=self.context['request'].user,
            )
            total += qty * price
        sale.total = total
        sale.save(update_fields=['total'])
        return sale
