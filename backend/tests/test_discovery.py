"""
Discovery API tests in mock mode.

Covers the search/sort/filter query params on GET /api/products plus the
GET /api/facets endpoint. All assertions are against the public camelCase
contract the storefront depends on.
"""
import pytest
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


def _products(client, query=""):
    resp = client.get(f"/api/products{query}")
    assert resp.status_code == 200
    return resp.json()["products"]


def _min_price(product):
    return float(product["priceRange"]["min"]["amount"])


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------
def test_search_hit_by_title(client):
    products = _products(client, "?search=midnight")
    handles = {p["handle"] for p in products}
    assert "midnight-noir" in handles


def test_search_hit_by_tag(client):
    # "d-log" is a tag on the DJI aerial pack, not in its title.
    products = _products(client, "?search=d-log")
    handles = {p["handle"] for p in products}
    assert "dji-aerial-vivid" in handles


def test_search_is_case_insensitive(client):
    lower = {p["handle"] for p in _products(client, "?search=kodak")}
    upper = {p["handle"] for p in _products(client, "?search=KODAK")}
    assert lower == upper
    assert "kodak-2383-emulation" in lower


def test_search_miss_returns_empty(client):
    assert _products(client, "?search=zzzznotathing") == []


# ---------------------------------------------------------------------------
# Sort
# ---------------------------------------------------------------------------
def test_sort_price_asc(client):
    prices = [_min_price(p) for p in _products(client, "?sort=price-asc")]
    assert prices == sorted(prices)


def test_sort_price_desc(client):
    prices = [_min_price(p) for p in _products(client, "?sort=price-desc")]
    assert prices == sorted(prices, reverse=True)


def test_sort_title_asc(client):
    titles = [p["title"].lower() for p in _products(client, "?sort=title-asc")]
    assert titles == sorted(titles)


def test_sort_newest_by_id_desc(client):
    products = _products(client, "?sort=newest")
    ids = [int(p["id"].rsplit("/", 1)[-1]) for p in products]
    assert ids == sorted(ids, reverse=True)


def test_sort_featured_default_floats_featured_first(client):
    products = _products(client)  # default == featured
    flags = [bool(p.get("featured")) for p in products]
    # Once we hit a non-featured product, no featured product may follow.
    seen_non_featured = False
    for is_featured in flags:
        if not is_featured:
            seen_non_featured = True
        elif seen_non_featured:
            pytest.fail("featured product appeared after a non-featured one")
    assert any(flags)


def test_unknown_sort_falls_back_to_default(client):
    bogus = [p["handle"] for p in _products(client, "?sort=bogus")]
    default = [p["handle"] for p in _products(client)]
    assert bogus == default


# ---------------------------------------------------------------------------
# Price range filter
# ---------------------------------------------------------------------------
def test_min_price_filter(client):
    products = _products(client, "?minPrice=40")
    assert products
    assert all(_min_price(p) >= 40 for p in products)


def test_max_price_filter(client):
    products = _products(client, "?maxPrice=15")
    assert products
    assert all(_min_price(p) <= 15 for p in products)


def test_price_range_filter(client):
    products = _products(client, "?minPrice=30&maxPrice=45")
    assert products
    assert all(30 <= _min_price(p) <= 45 for p in products)


# ---------------------------------------------------------------------------
# Tag filter (any-match)
# ---------------------------------------------------------------------------
def test_tag_filter_single(client):
    products = _products(client, "?tags=drone")
    assert products
    assert all("drone" in p["tags"] for p in products)


def test_tag_filter_any_match(client):
    products = _products(client, "?tags=kodak,portra")
    handles = {p["handle"] for p in products}
    # ANY-match: products carrying either tag are included.
    assert "kodak-2383-emulation" in handles
    assert "portra-400-still" in handles
    assert all(
        ("kodak" in p["tags"]) or ("portra" in p["tags"]) for p in products
    )


def test_tag_filter_is_case_insensitive(client):
    lower = {p["handle"] for p in _products(client, "?tags=drone")}
    upper = {p["handle"] for p in _products(client, "?tags=DRONE")}
    assert lower == upper and lower


# ---------------------------------------------------------------------------
# Composition + collection scope
# ---------------------------------------------------------------------------
def test_filters_compose_within_collection(client):
    products = _products(
        client, "?collection=cinematic&minPrice=40&sort=price-asc"
    )
    assert products
    prices = [_min_price(p) for p in products]
    assert prices == sorted(prices)
    assert all(_min_price(p) >= 40 for p in products)
    assert all(
        any(c["handle"] == "cinematic" for c in p["collections"])
        for p in products
    )


# ---------------------------------------------------------------------------
# Facets
# ---------------------------------------------------------------------------
def test_facets_shape(client):
    resp = client.get("/api/facets")
    assert resp.status_code == 200
    data = resp.json()
    assert {"priceRange", "tags", "productTypes"} <= set(data)
    assert {"min", "max"} <= set(data["priceRange"])
    assert isinstance(data["priceRange"]["min"], (int, float))
    assert isinstance(data["priceRange"]["max"], (int, float))
    assert data["priceRange"]["min"] <= data["priceRange"]["max"]
    for facet in data["tags"] + data["productTypes"]:
        assert {"value", "count"} <= set(facet)
        assert isinstance(facet["value"], str)
        assert isinstance(facet["count"], int)
        assert facet["count"] >= 1


def test_facets_counts_match_mockdata(client):
    data = client.get("/api/facets").json()
    type_counts = {t["value"]: t["count"] for t in data["productTypes"]}
    # 3 bundles + 13 individual LUT packs (incl. the weekly free LUT) in the fixture.
    assert type_counts.get("Bundle") == 3
    assert type_counts.get("LUT Pack") == 13

    tag_counts = {t["value"]: t["count"] for t in data["tags"]}
    # Every bundle carries the "value" tag.
    assert tag_counts.get("value") == 3
    # The weekly free LUT is tagged "free".
    assert tag_counts.get("free") == 1
    # The price range spans the free LUT ($0) to the everything bundle.
    assert data["priceRange"]["min"] == 0.0
    assert data["priceRange"]["max"] == 129.0


def test_facets_scoped_to_collection(client):
    data = client.get("/api/facets?collection=mobile-capcut").json()
    tag_values = {t["value"] for t in data["tags"]}
    # Mobile collection tags only — no film/drone tags leak in.
    assert "capcut" in tag_values
    assert "kodak" not in tag_values
    # The everything-bundle also lists mobile-capcut, so Bundle appears too.
    type_values = {t["value"] for t in data["productTypes"]}
    assert "LUT Pack" in type_values
