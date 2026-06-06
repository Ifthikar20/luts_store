"""
Pytest configuration.

We relax DRF throttle rates during tests so the smoke suite (which fires many
requests from the same client IP) is not rate-limited. Throttling itself is
still verified to be wired up via settings in production config.
"""
import pytest
from rest_framework.throttling import SimpleRateThrottle


@pytest.fixture(autouse=True)
def _disable_throttling(settings):
    settings.REST_FRAMEWORK = {
        **settings.REST_FRAMEWORK,
        "DEFAULT_THROTTLE_RATES": {
            "anon": None,
            "user": None,
            "auth": None,
            "sensitive": None,
        },
    }
    # Clear any throttle history accumulated across tests.
    SimpleRateThrottle.cache.clear()
    yield


@pytest.fixture(autouse=True)
def _locmem_email(settings):
    """Use Django's in-memory email backend in tests so mail.outbox works.

    The dev default stays the console backend (see config/settings.py); tests
    capture sent messages via ``django.core.mail.outbox`` instead of printing.
    """
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    yield
