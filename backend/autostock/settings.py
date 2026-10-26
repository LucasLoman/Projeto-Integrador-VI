from pathlib import Path
import os

import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'dev-secret-key')
DEBUG = os.getenv('DJANGO_DEBUG', 'True').lower() == 'true'

ALLOWED_HOSTS = [
    value.strip()
    for value in os.getenv(
        'DJANGO_ALLOWED_HOSTS',
        'localhost,127.0.0.1,backend',
    ).split(',')
    if value.strip()
]

render_hostname = os.getenv('RENDER_EXTERNAL_HOSTNAME')
if render_hostname and render_hostname not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(render_hostname)

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt',
    'inventory',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'autostock.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ]
        },
    }
]

WSGI_APPLICATION = 'autostock.wsgi.application'

local_database_url = (
    'postgresql://'
    f"{os.getenv('POSTGRES_USER', 'autostock')}:"
    f"{os.getenv('POSTGRES_PASSWORD', 'autostock')}@"
    f"{os.getenv('POSTGRES_HOST', 'localhost')}:"
    f"{os.getenv('POSTGRES_PORT', '5432')}/"
    f"{os.getenv('POSTGRES_DB', 'autostock')}"
)

DATABASES = {
    'default': dj_database_url.config(
        default=local_database_url,
        conn_max_age=600,
        conn_health_checks=True,
    )
}

AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = 'pt-br'
TIME_ZONE = 'America/Sao_Paulo'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': (
            'whitenoise.storage.CompressedManifestStaticFilesStorage'
            if not DEBUG
            else 'django.contrib.staticfiles.storage.StaticFilesStorage'
        ),
    },
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

CORS_ALLOWED_ORIGINS = [
    value.strip()
    for value in os.getenv(
        'CORS_ALLOWED_ORIGINS',
        'http://localhost:5173',
    ).split(',')
    if value.strip()
]

CORS_ALLOWED_ORIGIN_REGEXES = [
    value.strip()
    for value in os.getenv(
        'CORS_ALLOWED_ORIGIN_REGEXES',
        '',
    ).split(',')
    if value.strip()
]

CSRF_TRUSTED_ORIGINS = [
    value.strip()
    for value in os.getenv(
        'CSRF_TRUSTED_ORIGINS',
        '',
    ).split(',')
    if value.strip()
]

render_external_url = os.getenv('RENDER_EXTERNAL_URL')
if render_external_url and render_external_url not in CSRF_TRUSTED_ORIGINS:
    CSRF_TRUSTED_ORIGINS.append(render_external_url)

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
