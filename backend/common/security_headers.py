"""
Response security headers.

Adds defense-in-depth headers Django doesn't set by default:

* ``Content-Security-Policy`` — a LOCKED-DOWN policy on JSON API responses
  (``default-src 'none'``). The API serves only data; a JSON body has no need
  to load scripts, frames, etc., so this neutralizes any reflected-content or
  embedding tricks. HTML responses (the Django admin) are left alone so their
  own assets keep working.
* ``Permissions-Policy`` — disables powerful browser features we never use.
* ``Cross-Origin-Resource-Policy`` — blocks other sites from embedding our
  responses as no-cors subresources (CORS fetches are unaffected).

(HSTS, nosniff, X-Frame-Options, Referrer-Policy and COOP are configured on
Django's SecurityMiddleware via settings.)
"""
from __future__ import annotations

# JSON has no legitimate need for any resource origin.
_JSON_CSP = (
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; "
    "form-action 'none'"
)
_PERMISSIONS_POLICY = (
    "camera=(), microphone=(), geolocation=(), usb=(), browsing-topics=()"
)


class SecurityHeadersMiddleware:
    """Attach CSP / Permissions-Policy / CORP to every response."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Use setdefault so an explicit per-view header is never overwritten.
        response.setdefault("Permissions-Policy", _PERMISSIONS_POLICY)
        response.setdefault("Cross-Origin-Resource-Policy", "same-site")

        content_type = response.get("Content-Type", "")
        if content_type.startswith("application/json"):
            response.setdefault("Content-Security-Policy", _JSON_CSP)

        return response
