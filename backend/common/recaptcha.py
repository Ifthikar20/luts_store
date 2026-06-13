"""
Google reCAPTCHA v3 server-side verification.

The frontend obtains a short-lived token (``grecaptcha.execute(siteKey, {action})``)
and sends it with the request; here we verify it against Google's siteverify API
using the SECRET key and accept only a sufficiently human score.

Config-gated: when ``settings.RECAPTCHA_SECRET_KEY`` is unset, ``verify()`` is a
no-op that returns True, so dev/CI and un-keyed deployments behave exactly as
before. Availability note: on a network/parse error talking to Google we FAIL
OPEN (return True) so a Google outage can't lock users out — the endpoints are
still protected by rate-limiting (and, for reviews, the verified-purchase gate).
A definitive *bot* verdict (success=false or a low score) always FAILS CLOSED.
"""
from __future__ import annotations

import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify"


def enabled() -> bool:
    return bool(getattr(settings, "RECAPTCHA_SECRET_KEY", "").strip())


def client_ip(request) -> str | None:
    """Best-effort client IP for the optional remoteip hint."""
    fwd = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def verify(token: str | None, action: str = "", remote_ip: str | None = None) -> bool:
    """Return True if the token is a verified human (or reCAPTCHA is disabled)."""
    if not enabled():
        return True
    if not token:
        return False
    try:
        resp = requests.post(
            VERIFY_URL,
            data={
                "secret": settings.RECAPTCHA_SECRET_KEY,
                "response": token,
                **({"remoteip": remote_ip} if remote_ip else {}),
            },
            timeout=10,
        )
        data = resp.json()
    except Exception:  # noqa: BLE001 - never let an outage block all logins
        logger.exception("reCAPTCHA verify request failed — failing open")
        return True

    if not data.get("success"):
        return False
    score = data.get("score", 0.0)
    if score < settings.RECAPTCHA_MIN_SCORE:
        logger.info("reCAPTCHA low score %.2f for action=%s", score, action)
        return False
    # Action is advisory in v3 — log a mismatch but don't hard-fail on it.
    returned = data.get("action")
    if action and returned and returned != action:
        logger.warning("reCAPTCHA action mismatch: expected %s got %s", action, returned)
    return True
