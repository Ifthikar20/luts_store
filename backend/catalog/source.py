"""
Catalog source selector.

Returns the active in-process catalog source for MOCK_MODE: the database
(``db_source``) once the admin has published any products, otherwise the in-repo
``mockdata`` fixture. This is what lets the Django admin take over the store with
zero other changes — the moment a Product row is published, the store serves it.
"""
from __future__ import annotations

from . import db_source, mockdata


def active():
    """Return ``db_source`` if published DB products exist, else ``mockdata``."""
    try:
        from .models import Product

        if Product.objects.filter(published=True).exists():
            return db_source
    except Exception:
        # DB not migrated yet / unavailable — fall back to the fixture.
        pass
    return mockdata
