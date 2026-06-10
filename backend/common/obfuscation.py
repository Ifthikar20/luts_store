"""
UI payload obfuscation (decode side).

The storefront wraps its JSON POST bodies in an envelope —
``{"_obf": "<base64(xor(json))>"}`` — so request payloads aren't casually
readable/replayable from browser DevTools or naive traffic captures. The
middleware below transparently decodes the envelope back into the original
JSON before any view/parser runs.

THIS IS OBFUSCATION, NOT SECURITY. The XOR key ships inside the public JS
bundle by necessity, so anyone determined can decode it. Confidentiality in
transit comes from TLS; integrity comes from server-side validation (prices,
allowlists, signed webhooks). This layer only raises the bar for casual
inspection and copy-paste API abuse — never rely on it for anything more.

Plain (non-enveloped) JSON is always accepted too, so server-to-server
callers — Stripe/Shopify webhooks, curl, the test suite — are unaffected.
"""
from __future__ import annotations

import base64
import json

# Shared with frontend/src/lib/obfuscate.ts — keep the two in sync.
_KEY = b"luts-store.payload.v1"

ENVELOPE_FIELD = "_obf"


def encode_payload(raw_json: bytes | str) -> str:
    """XOR + base64 a JSON string (used by tests; mirror of the JS encoder)."""
    data = raw_json.encode("utf-8") if isinstance(raw_json, str) else raw_json
    mixed = bytes(b ^ _KEY[i % len(_KEY)] for i, b in enumerate(data))
    return base64.b64encode(mixed).decode("ascii")


def decode_payload(payload: str) -> bytes:
    """Reverse of ``encode_payload``. Raises on malformed base64."""
    raw = base64.b64decode(payload, validate=True)
    return bytes(b ^ _KEY[i % len(_KEY)] for i, b in enumerate(raw))


class ObfuscatedPayloadMiddleware:
    """Transparently unwrap ``{"_obf": …}`` JSON request bodies.

    Runs before view/parser code touches the body. On any decoding problem the
    original body is left untouched (the view's own validation then rejects
    it) — this middleware must never 500 a request.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if (
            request.method in ("POST", "PUT", "PATCH", "DELETE")
            and request.content_type == "application/json"
        ):
            try:
                body = request.body  # cached by Django on first access
                # Cheap pre-check before a full JSON parse.
                if body[:1] == b"{" and ENVELOPE_FIELD.encode() in body[:16]:
                    data = json.loads(body)
                    if (
                        isinstance(data, dict)
                        and set(data.keys()) == {ENVELOPE_FIELD}
                        and isinstance(data[ENVELOPE_FIELD], str)
                    ):
                        decoded = decode_payload(data[ENVELOPE_FIELD])
                        json.loads(decoded)  # must round-trip to valid JSON
                        request._body = decoded
                        request.META["CONTENT_LENGTH"] = str(len(decoded))
            except Exception:  # noqa: BLE001 - malformed envelope -> leave as-is
                pass
        return self.get_response(request)
