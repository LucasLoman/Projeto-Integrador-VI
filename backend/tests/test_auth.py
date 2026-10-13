import pytest


@pytest.mark.django_db
def test_token_login_returns_access_and_refresh(api_client, user):
    response = api_client.post(
        '/api/auth/token/',
        {
            'username': 'teste_integracao',
            'password': 'SenhaTeste123',
        },
        format='json',
    )

    assert response.status_code == 200
    assert response.data.get('access')
    assert response.data.get('refresh')


@pytest.mark.django_db
def test_invalid_password_is_rejected(api_client, user):
    response = api_client.post(
        '/api/auth/token/',
        {
            'username': 'teste_integracao',
            'password': 'senha-incorreta',
        },
        format='json',
    )

    assert response.status_code == 401


@pytest.mark.django_db
def test_protected_endpoint_requires_authentication(api_client):
    response = api_client.get('/api/products/')
    assert response.status_code == 401


@pytest.mark.django_db
def test_authenticated_user_can_access_products(authenticated_client):
    response = authenticated_client.get('/api/products/')
    assert response.status_code == 200
