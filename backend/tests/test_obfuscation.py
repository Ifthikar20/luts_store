"""
Obfuscated-payload envelope tests.

The storefront wraps JSON POST bodies as {"_obf": base64(xor(json))}; the
middleware must transparently unwrap them while leaving plain JSON (webhooks,
curl, tests) untouched, and must never 500 on garbage.
"""
import json

import pytest
from rest_framework.test import APIClient

from common.obfuscation import decode_payload, encode_payload

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


def _obf_post(client, path, payload):
    body = json.dumps({"_obf": encode_payload(json.dumps(payload))})
    return client.post(path, data=body, content_type="application/json")


def test_codec_round_trips_unicode():
    original = json.dumps({"q": "crème brûlée ✨", "n": 3})
    assert decode_payload(encode_payload(original)).decode("utf-8") == original


def test_obfuscated_cart_create_works(client):
    from catalog import mockdata

    variant_id = mockdata.get_product("midnight-noir")["variants"][0]["id"]
    resp = _obf_post(
        client,
        "/api/cart",
        {"lines": [{"merchandiseId": variant_id, "quantity": 2}]},
    )
    assert resp.status_code == 201
    cart = resp.json()
    assert cart["totalQuantity"] == 2
    assert cart["lines"][0]["merchandise"]["product"]["handle"] == "midnight-noir"


def test_obfuscated_events_ingest_works(client):
    from analytics.models import Event

    resp = _obf_post(
        client,
        "/api/events",
        {"session": "obf1", "events": [{"name": "page_view", "path": "/"}]},
    )
    assert resp.status_code == 202
    assert resp.json()["stored"] == 1
    assert Event.objects.filter(session="obf1", name="page_view").exists()


def test_plain_json_still_accepted(client):
    """Server-to-server callers (webhooks/curl) never use the envelope."""
    resp = client.post("/api/cart", data={"lines": []}, format="json")
    assert resp.status_code == 201


def test_garbage_envelope_does_not_500(client):
    for bad in ["not-base64!!!", encode_payload("not json"), 123]:
        resp = client.post(
            "/api/cart",
            data=json.dumps({"_obf": bad}),
            content_type="application/json",
        )
        # Falls through with the original body: the view sees {"_obf": ...},
        # finds no valid lines, and responds normally (empty cart) — never 500.
        assert resp.status_code in (201, 400)


def test_envelope_key_alongside_other_keys_is_left_alone(client):
    """Only a pure single-key envelope is unwrapped."""
    resp = client.post(
        "/api/cart",
        data=json.dumps({"_obf": encode_payload("{}"), "lines": []}),
        content_type="application/json",
    )
    assert resp.status_code == 201
    assert resp.json()["totalQuantity"] == 0
