import pytest

from inventory.models import Product


@pytest.mark.django_db
@pytest.mark.parametrize(
    'endpoint',
    [
        '/api/dashboard/',
        '/api/analytics/abc/?days=90',
        '/api/analytics/slow-products/?days=90',
        '/api/analytics/rupture-forecast/?days=30',
        '/api/analytics/replenishment/?days=30&safety_days=3&target_days=15',
    ],
)
def test_analytics_endpoints_respond(authenticated_client, endpoint):
    Product.objects.get_or_create(
        sku='SMOKE-001',
        defaults={
            'name': 'Produto Smoke Test',
            'quantity': 5,
            'min_stock': 2,
            'cost_price': '10.00',
            'sale_price': '20.00',
        },
    )

    response = authenticated_client.get(endpoint)
    assert response.status_code == 200
