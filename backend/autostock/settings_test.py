from .settings import *

# Banco leve e isolado para os testes automatizados.
# Assim, pytest não depende de um PostgreSQL local para executar a suíte.
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]

ALLOWED_HOSTS = ['testserver', 'localhost', '127.0.0.1']

# Evita efeitos colaterais desnecessários durante testes.
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
