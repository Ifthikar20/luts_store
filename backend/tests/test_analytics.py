"""
First-party analytics tests: ingestion hygiene + staff-only summary.
"""
import pytest
from rest_framework.test import APIClient

from analytics.models import Event

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


def _post(client, body):
    return client.post("/api/events", data=body, format="json")


def test_ingest_stores_allowlisted_events(client):
    resp = _post(
        client,
        {
            "session": "abc123",
            "events": [
                {"name": "page_view", "path": "/luts/midnight-noir", "referrer": "https://g.co"},
                {"name": "add_to_cart", "handle": "midnight-noir"},
            ],
        },
    )
    assert resp.status_code == 202
    assert resp.json()["stored"] == 2
    assert Event.objects.filter(name="page_view", path="/luts/midnight-noir").exists()
    assert Event.objects.filter(name="add_to_cart", product_handle="midnight-noir").exists()


def test_ingest_drops_garbage_silently(client):
    resp = _post(
        client,
        {
            "session": "abc123",
            "events": [
                {"name": "evil_event", "path": "/x"},   # not allowlisted
                "not-a-dict",
                {"path": "/no-name"},
                {"name": "page_view", "path": "x" * 9999},  # truncated, kept
            ],
        },
    )
    assert resp.status_code == 202
    assert resp.json()["stored"] == 1
    event = Event.objects.get()
    assert event.name == "page_view"
    assert len(event.path) == 300  # hard cap


def test_ingest_requires_session_and_caps_batch(client):
    assert _post(client, {"events": [{"name": "page_view"}]}).json()["stored"] == 0
    big = {"session": "s", "events": [{"name": "page_view"}] * 50}
    assert _post(client, big).json()["stored"] == 20  # MAX_BATCH


def test_ingest_stores_no_pii(client):
    _post(client, {"session": "s1", "events": [{"name": "page_view", "path": "/"}]})
    event = Event.objects.get()
    field_names = {f.name for f in Event._meta.get_fields()}
    assert "ip" not in field_names and "user_agent" not in field_names
    assert event.session == "s1"


def test_summary_is_staff_only_and_aggregates(client):
    from django.contrib.auth.models import User

    for i in range(3):
        _post(client, {"session": f"s{i}", "events": [{"name": "page_view", "path": "/"}]})
    _post(client, {"session": "s0", "events": [{"name": "add_to_cart", "handle": "midnight-noir"}]})
    _post(client, {"session": "s0", "events": [{"name": "begin_checkout"}, {"name": "purchase"}]})

    # Anonymous and non-staff -> denied.
    assert client.get("/api/analytics/summary").status_code in (401, 403)
    user = User.objects.create_user("shopper", "s@e.com", "pw12345!")
    shopper = APIClient()
    shopper.force_authenticate(user=user)
    assert shopper.get("/api/analytics/summary").status_code == 403

    admin = APIClient()
    admin.force_authenticate(
        user=User.objects.create_user("boss", "b@e.com", "pw12345!", is_staff=True)
    )
    body = admin.get("/api/analytics/summary").json()
    assert body["uniqueSessions"] == 3
    assert body["events"] == {
        "page_view": 3,
        "add_to_cart": 1,
        "begin_checkout": 1,
        "purchase": 1,
    }
    assert body["topProducts"][0]["product_handle"] == "midnight-noir"
