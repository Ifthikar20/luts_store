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
        "DEFAULT_THROTTLE_RATES": {"anon": None, "user": None},
    }
    # Clear any throttle history accumulated across tests.
    SimpleRateThrottle.cache.clear()
    yield
