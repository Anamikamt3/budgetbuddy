"""Settings used ONLY when running the tests.
Run the tests with:  python manage.py test --settings=config.test_settings"""
from .settings import *  # noqa: F401,F403

# A fast in-memory database, so no PostgreSQL permissions are needed for testing
DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}}

# Weak but fast password hashing (tests only)
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']

# Plain static files storage, so tests do not need collectstatic
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}

# Do not let the login rate limit disturb the tests
REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # noqa: F405
    'DEFAULT_THROTTLE_RATES': {'anon': '10000/minute'},
}

# The test client talks plain http, so do not force https while testing
SECURE_SSL_REDIRECT = False
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False