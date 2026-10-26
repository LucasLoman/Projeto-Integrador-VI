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

    def validate_name(self, value):
        value = value.strip()
        if len(value) < 2:
            raise serializers.ValidationError('Informe um nome válido para a marca.')

        queryset = Brand.objects.filter(name__iexact=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError('Já existe uma marca com esse nome.')
        return value


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
    stock_status = serializers.SerializerMethodField(read_only=True)
    stock_difference = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Product
        fields = '__all__'
        read_only_fields = ['quantity', 'created_at', 'updated_at']

    def get_stock_status(self, obj):
        if obj.quantity <= 0:
            return 'SEM_ESTOQUE'
        if obj.quantity <= obj.min_stock:
            return 'ESTOQUE_BAIXO'
        return 'OK'

    def get_stock_difference(self, obj):
        return max(obj.min_stock - obj.quantity, 0)

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
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    stock_after = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = StockMovement
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at']

    def get_stock_after(self, obj):
        return obj.product.quantity

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError('A quantidade deve ser maior que zero.')
        return value

    def validate(self, attrs):
        product = attrs.get('product')
        movement_type = attrs.get('movement_type')

        if product and not product.active:
            raise serializers.ValidationError({'product': 'O produto está inativo.'})

        if movement_type == StockMovement.OUT and product:
            quantity = attrs.get('quantity', 0)
            if product.quantity < quantity:
                raise serializers.ValidationError(
                    {'quantity': f'Estoque insuficiente. Disponível: {product.quantity}.'}
                )

        return attrs

    def create(self, validated_data):
        try:
            validated_data['created_by'] = self.context['request'].user
            return super().create(validated_data)
        except ValueError as e:
            raise serializers.ValidationError({'quantity': str(e)})


class SaleItemInputSerializer(serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.filter(active=True))
    quantity = serializers.IntegerField(min_value=1)
    unit_price = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        min_value=0,
    )


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemInputSerializer(many=True, write_only=True)
    items_detail = serializers.SerializerMethodField(read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = Sale
        fields = [
            'id',
            'customer_name',
            'total',
            'created_at',
            'created_by_name',
            'items',
            'items_detail',
        ]
        read_only_fields = ['total', 'created_at', 'created_by_name']

    def get_items_detail(self, obj):
        return [
            {
                'product': item.product_id,
                'product_sku': item.product.sku,
                'product_name': item.product.name,
                'quantity': item.quantity,
                'unit_price': item.unit_price,
                'subtotal': item.subtotal,
            }
            for item in obj.items.all()
        ]

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError('Adicione pelo menos um produto à venda.')

        seen = set()
        for item in items:
            product_id = item['product'].id
            if product_id in seen:
                raise serializers.ValidationError(
                    'O mesmo produto foi adicionado mais de uma vez. Ajuste a quantidade em um único item.'
                )
            seen.add(product_id)

        return items

    @transaction.atomic
    def create(self, validated_data):
        items = validated_data.pop('items')
        request = self.context['request']

        # Primeiro bloqueia e valida todos os produtos para evitar venda parcial.
        locked_products = {}
        for item in items:
            product = Product.objects.select_for_update().get(pk=item['product'].pk)
            if not product.active:
                raise serializers.ValidationError(
                    {'items': f'O produto {product.name} está inativo.'}
                )

            quantity = item['quantity']
            if product.quantity < quantity:
                raise serializers.ValidationError(
                    {
                        'items': (
                            f'Estoque insuficiente para {product.name}. '
                            f'Disponível: {product.quantity}.'
                        )
                    }
                )
            locked_products[product.id] = product

        sale = Sale.objects.create(
            created_by=request.user,
            customer_name=validated_data.get('customer_name', '').strip(),
        )

        total = 0
        for item in items:
            product = locked_products[item['product'].id]
            quantity = item['quantity']
            unit_price = item.get('unit_price')
            if unit_price is None:
                unit_price = product.sale_price

            sale_item = SaleItem.objects.create(
                sale=sale,
                product=product,
                quantity=quantity,
                unit_price=unit_price,
            )

            # StockMovement faz a baixa automática no saldo do produto.
            StockMovement.objects.create(
                product=product,
                movement_type=StockMovement.OUT,
                quantity=quantity,
                note=f'Venda #{sale.id}',
                created_by=request.user,
            )

            total += sale_item.subtotal

        sale.total = total
        sale.save(update_fields=['total'])
        return sale
