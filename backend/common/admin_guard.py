"""
Optional IP allowlist for the Django admin.

When ``settings.ADMIN_IP_ALLOWLIST`` is non-empty, any request to ``/admin/``
from a client IP not on the list gets a 404 (not 403 — we don't reveal that an
admin exists). Empty list = no restriction (the default), so dev is unaffected.

Client IP is taken from the left-most ``X-Forwarded-For`` entry when behind a
trusted proxy/CDN, else ``REMOTE_ADDR``.
"""
from __future__ import annotations

from django.conf import settings
from django.http import Http404


def _client_ip(request) -> str:
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


class AdminIPAllowlistMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        allowlist = getattr(settings, "ADMIN_IP_ALLOWLIST", [])
        if allowlist and request.path.startswith("/admin"):
            if _client_ip(request) not in allowlist:
                raise Http404()
        return self.get_response(request)
