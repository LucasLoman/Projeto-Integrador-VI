import pytest

from inventory.models import Product, StockMovement, Sale


@pytest.mark.django_db
def test_complete_inventory_and_sale_workflow(authenticated_client):
    # 1. Cadastros auxiliares.
    category = authenticated_client.post(
        '/api/categories/',
        {'name': 'Freios'},
        format='json',
    )
    assert category.status_code == 201

    brand = authenticated_client.post(
        '/api/brands/',
        {'name': 'Marca Teste'},
        format='json',
    )
    assert brand.status_code == 201

    supplier = authenticated_client.post(
        '/api/suppliers/',
        {
            'name': 'Fornecedor Teste',
            'cnpj': '12.345.678/0001-90',
            'phone': '(15) 99999-9999',
            'email': 'fornecedor@example.com',
            'lead_time_days': 7,
        },
        format='json',
    )
    assert supplier.status_code == 201

    # 2. Produto novo começa sem saldo, pois estoque é alterado por movimentação.
    product_response = authenticated_client.post(
        '/api/products/',
        {
            'sku': 'PAST-001',
            'name': 'Pastilha de Freio Teste',
            'category': category.data['id'],
            'brand': brand.data['id'],
            'supplier': supplier.data['id'],
            'cost_price': '50.00',
            'sale_price': '100.00',
            'min_stock': 5,
            'location': 'A-01',
            'active': True,
        },
        format='json',
    )
    assert product_response.status_code == 201

    product_id = product_response.data['id']
    product = Product.objects.get(pk=product_id)
    assert product.quantity == 0

    # 3. Entrada de 20 unidades.
    movement = authenticated_client.post(
        '/api/movements/',
        {
            'product': product_id,
            'movement_type': 'IN',
            'quantity': 20,
            'unit_cost': '50.00',
            'note': 'Entrada de teste',
        },
        format='json',
    )
    assert movement.status_code == 201

    product.refresh_from_db()
    assert product.quantity == 20

    # 4. Venda de 4 unidades deve baixar o estoque automaticamente.
    sale_response = authenticated_client.post(
        '/api/sales/',
        {
            'customer_name': 'Cliente Teste',
            'items': [
                {
                    'product': product_id,
                    'quantity': 4,
                }
            ],
        },
        format='json',
    )
    assert sale_response.status_code == 201
    assert str(sale_response.data['total']) == '400.00'

    product.refresh_from_db()
    assert product.quantity == 16

    # 5. A venda também gera movimentação de saída.
    sale_id = sale_response.data['id']
    assert Sale.objects.filter(pk=sale_id).exists()
    assert StockMovement.objects.filter(
        product=product,
        movement_type=StockMovement.OUT,
        note=f'Venda #{sale_id}',
    ).exists()

    # 6. Os módulos analíticos continuam acessíveis após o fluxo.
    dashboard = authenticated_client.get('/api/dashboard/')
    assert dashboard.status_code == 200

    rupture = authenticated_client.get(
        '/api/analytics/rupture-forecast/?days=30'
    )
    assert rupture.status_code == 200

    replenishment = authenticated_client.get(
        '/api/analytics/replenishment/?days=30&safety_days=3&target_days=15'
    )
    assert replenishment.status_code == 200


@pytest.mark.django_db
def test_sale_above_available_stock_is_rejected(authenticated_client):
    product = Product.objects.create(
        sku='EST-001',
        name='Produto Estoque Limitado',
        quantity=3,
        min_stock=1,
        cost_price='10.00',
        sale_price='20.00',
    )

    response = authenticated_client.post(
        '/api/sales/',
        {
            'customer_name': 'Cliente',
            'items': [
                {
                    'product': product.id,
                    'quantity': 5,
                }
            ],
        },
        format='json',
    )

    assert response.status_code == 400

    product.refresh_from_db()
    assert product.quantity == 3
    assert Sale.objects.count() == 0


@pytest.mark.django_db
def test_stock_exit_above_available_quantity_is_rejected(authenticated_client):
    product = Product.objects.create(
        sku='EST-002',
        name='Produto Movimento',
        quantity=2,
        min_stock=1,
        cost_price='10.00',
        sale_price='20.00',
    )

    response = authenticated_client.post(
        '/api/movements/',
        {
            'product': product.id,
            'movement_type': 'OUT',
            'quantity': 3,
        },
        format='json',
    )

    assert response.status_code == 400

    product.refresh_from_db()
    assert product.quantity == 2
