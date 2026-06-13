"""
Order ingestion service.

Turns a verified Shopify ``orders/paid`` webhook payload into ``Order`` +
``Purchase`` rows and issues ``DownloadGrant`` rows for each purchased line.

Idempotency: keyed on ``shopify_order_id``. If an order already exists we
return it unchanged so webhook retries are safe.
"""
from __future__ import annotations

import logging
from decimal import Decimal, InvalidOperation
from typing import Any

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import Order, Purchase

logger = logging.getLogger(__name__)


class OrderNotFound(Exception):
    """Raised when an order/confirmation token cannot be resolved."""


def _to_decimal(value: Any) -> Decimal:
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal("0")


def _extract_handle(line_item: dict[str, Any]) -> str:
    """Best-effort product handle from a Shopify line item.

    Shopify line items do not always carry the handle directly; we fall back to
    a slugified title so downstream download grants always have an identifier.
    """
    handle = line_item.get("handle") or line_item.get("product_handle")
    if handle:
        return str(handle)
    title = (line_item.get("title") or "").strip().lower()
    return "-".join(title.split())


@transaction.atomic
def ingest_paid_order(payload: dict[str, Any]) -> tuple[Order, bool]:
    """Create Order/Purchases/DownloadGrants from a webhook payload.

    Returns ``(order, created)``. When ``created`` is False the order already
    existed (idempotent no-op).
    """
    shopify_order_id = str(payload.get("id") or payload.get("order_id") or "")
    if not shopify_order_id:
        raise ValueError("Webhook payload missing order id.")

    existing = Order.objects.filter(shopify_order_id=shopify_order_id).first()
    if existing is not None:
        return existing, False

    email = payload.get("email") or payload.get("contact_email") or ""
    currency = payload.get("currency") or "USD"
    total = _to_decimal(
        payload.get("total_price") or payload.get("current_total_price") or 0
    )

    order = Order.objects.create(
        shopify_order_id=shopify_order_id,
        email=email,
        total=total,
        currency=currency,
        raw_json=payload,
    )

    # Imports here to avoid circular imports at module load.
    from django.contrib.auth.models import User

    from delivery.models import DownloadGrant

    # If a customer account already exists for this order's email, attach the
    # grants to that user too so they appear in their download library
    # immediately. Grants stay keyed by email as well, so a purchase made
    # before signup can still be matched to a user later.
    user = None
    if email:
        user = User.objects.filter(email__iexact=email).first()

    from catalog import source

    for item in payload.get("line_items", []) or []:
        handle = _extract_handle(item)
        title = item.get("title", "")
        quantity = int(item.get("quantity", 1) or 1)
        Purchase.objects.create(
            order=order,
            product_handle=handle,
            title=title,
            quantity=quantity,
        )
        # A bundle delivers each of its member packs; a normal product delivers
        # itself. One grant per deliverable file so every pack is downloadable.
        for deliver_handle in source.active().deliverable_handles(handle):
            DownloadGrant.objects.get_or_create(
                order=order,
                product_handle=deliver_handle,
                defaults={"user": user, "email": email},
            )

    # Send the confirmation email AFTER grants exist. Idempotent + best-effort:
    # a mail failure must never break webhook ingestion (Shopify would retry and
    # we'd duplicate work). We commit the grant/order work first via
    # ``on_commit`` so the email reflects committed state and a send failure
    # doesn't roll back the order.
    transaction.on_commit(lambda: send_confirmation_email(order.id))

    return order, True


def send_confirmation_email(order_id: int, *, force: bool = False) -> bool:
    """Send the order-confirmation email for an order, idempotently.

    Idempotency: only sends if ``confirmation_email_sent_at`` is unset (unless
    ``force`` is given, e.g. the resend endpoint). Sets the timestamp after a
    successful send. Wrapped in try/except so a mail-backend failure is logged
    and swallowed — it must never break the calling flow (webhook ingest).

    Returns ``True`` if an email was sent, ``False`` otherwise.
    """
    from delivery.emails import send_order_confirmation

    order = Order.objects.filter(id=order_id).first()
    if order is None:  # pragma: no cover - defensive
        return False
    if not force and order.confirmation_email_sent_at is not None:
        return False
    if not order.email:
        return False

    try:
        send_order_confirmation(order)
    except Exception:  # noqa: BLE001 - never let mail break the caller
        logger.exception(
            "Failed to send confirmation email for order %s", order.shopify_order_id
        )
        return False

    # Record the send so we never duplicate it. Use update() to avoid
    # re-triggering any save-time side effects and to be cheap.
    Order.objects.filter(id=order.id).update(
        confirmation_email_sent_at=timezone.now()
    )
    return True


# ---------------------------------------------------------------------------
# Order confirmation (thank-you page)
# ---------------------------------------------------------------------------
def _confirmation_downloads(grants) -> list[dict[str, Any]]:
    """Serialize grants into the confirmation ``downloads`` shape."""
    from delivery.services import serialize_grant

    out: list[dict[str, Any]] = []
    for grant in grants:
        item = serialize_grant(grant)
        out.append(
            {
                "title": item["title"],
                "downloadUrl": item["downloadUrl"],
                "expiresAt": item["expiresAt"],
            }
        )
    return out


def _line_price(handle: str, quantity: int, currency: str) -> dict[str, str] | None:
    """Per-line money (unit price × quantity), looked up from the catalog.

    Orders persist title + quantity but not price, so we derive each line total
    from the current catalog by handle. Returns None when the product/price is
    unavailable (the line then renders without a price rather than a wrong one).
    """
    if not handle:
        return None
    from catalog import services as catalog_services

    product = catalog_services.get_product(handle)
    if not product:
        return None
    try:
        unit = product["priceRange"]["min"]
        amount = float(unit["amount"]) * max(int(quantity), 1)
    except (KeyError, TypeError, ValueError):
        return None
    return {
        "amount": f"{amount:.2f}",
        "currencyCode": unit.get("currencyCode", currency),
    }


def _confirm_line(
    title: str, quantity: int, handle: str, currency: str
) -> dict[str, Any]:
    line: dict[str, Any] = {"title": title, "quantity": quantity, "handle": handle}
    price = _line_price(handle, quantity, currency)
    if price:
        line["price"] = price
    return line


def _confirm_from_order(order: Order) -> dict[str, Any]:
    lines = [
        _confirm_line(p.title, p.quantity, p.product_handle, order.currency)
        for p in order.purchases.all()
    ]
    downloads = _confirmation_downloads(
        order.download_grants.filter(revoked_at__isnull=True)
    )
    return {
        "orderId": order.shopify_order_id,
        "email": order.email,
        "lines": lines,
        "total": {
            "amount": f"{order.total:.2f}",
            "currencyCode": order.currency,
        },
        "downloads": downloads,
    }


def _confirm_from_mock_cart(cart_id: str) -> dict[str, Any]:
    """MOCK_MODE ONLY: synthesize a confirmation from a cart id.

    The placeholder ``checkoutUrl`` produced in mock mode ends with the cart id,
    so the thank-you page can pass that id here to demo the full funnel without a
    real Shopify order/webhook. We resolve the cart's lines, then create (or
    reuse) ephemeral DownloadGrants so the returned download links are valid
    against the existing signed-token endpoint.
    """
    from cart import services as cart_services
    from delivery.models import DownloadGrant

    try:
        cart = cart_services.get_cart(cart_id)
    except cart_services.CartNotFound as exc:
        raise OrderNotFound(cart_id) from exc

    currency = cart["cost"]["total"].get("currencyCode", "USD")
    lines = [
        _confirm_line(
            line["merchandise"]["product"]["title"],
            line["quantity"],
            line["merchandise"]["product"].get("handle", ""),
            currency,
        )
        for line in cart.get("lines", [])
    ]

    # Use a deterministic synthetic order id so re-visiting the thank-you page
    # for the same cart is idempotent (does not duplicate grants).
    synthetic_id = f"mock-cart-{cart_id}"
    grants = []
    for line in cart.get("lines", []):
        handle = line["merchandise"]["product"]["handle"]
        grant = (
            DownloadGrant.objects.filter(
                email="", product_handle=handle, order=None, user=None
            ).first()
            or DownloadGrant.objects.create(email="", product_handle=handle)
        )
        grants.append(grant)

    return {
        "orderId": synthetic_id,
        "email": cart.get("email", ""),
        "lines": lines,
        "total": cart["cost"]["total"],
        "downloads": _confirmation_downloads(grants),
    }


def confirm_order(id_or_token: str) -> dict[str, Any]:
    """Resolve a thank-you confirmation by order id (or, in mock mode, cart id).

    Lookup order:
    1. A real ``Order`` by its ``shopify_order_id``.
    2. In MOCK_MODE, a cart id (the placeholder checkout URL ends with it) ->
       synthesize a confirmation so the funnel is demoable end to end.

    Raises ``OrderNotFound`` when nothing matches.
    """
    if not id_or_token:
        raise OrderNotFound("")

    order = Order.objects.filter(shopify_order_id=str(id_or_token)).first()
    if order is not None:
        return _confirm_from_order(order)

    # Stripe fallback: the success redirect can beat the webhook. If this is a
    # Stripe session id with no order yet, retrieve the session and (if paid)
    # ingest it synchronously so the thank-you page is never empty. Idempotent
    # with the webhook (both key on the same stripe-<session> id).
    if settings.STRIPE_ENABLED and str(id_or_token).startswith("stripe-"):
        order = _ensure_stripe_order(str(id_or_token))
        if order is not None:
            return _confirm_from_order(order)

    if settings.MOCK_MODE:
        return _confirm_from_mock_cart(str(id_or_token))

    raise OrderNotFound(str(id_or_token))


def _ensure_stripe_order(order_id: str) -> Order | None:
    """Retrieve a Stripe session by id and ingest it if paid. Returns the Order
    or None. Best-effort: any Stripe/resolution error yields None (404 upstream).
    """
    from checkout import stripe_gateway

    session_id = order_id[len("stripe-") :]
    try:
        session = stripe_gateway.retrieve_session(session_id)
    except stripe_gateway.StripeError:
        return None

    paid = (
        session.get("payment_status")
        if isinstance(session, dict)
        else getattr(session, "payment_status", None)
    )
    if paid != "paid":
        return None

    try:
        order, _created = stripe_gateway.ingest_session(session)
    except stripe_gateway.StripeError:
        return None
    return order


# ---------------------------------------------------------------------------
# Weekly free LUT — claim by email, no payment
# ---------------------------------------------------------------------------
class FreeLutUnavailable(Exception):
    """Raised when there is no free LUT to claim this week."""


def claim_free_lut(email: str) -> Order:
    """Grant the current free LUT to ``email`` (no payment). Idempotent.

    Resolves the product tagged ``free`` and runs the shared ingest pipeline
    with a 0.00 total, so the claimer gets a DownloadGrant + the same
    confirmation/receipt email + thank-you page as a paid order. The order id
    is keyed on the product + normalized email, so re-claiming is a no-op.
    """
    from catalog import services as catalog_services

    normalized = (email or "").strip().lower()
    if not normalized:
        raise ValueError("An email is required to claim the free LUT.")

    product = catalog_services.free_lut()
    if product is None:
        raise FreeLutUnavailable("No free LUT is available this week.")

    handle = product["handle"]
    payload = {
        "id": f"free-{handle}-{normalized}",
        "email": normalized,
        "total_price": "0.00",
        "currency": product["priceRange"]["min"].get("currencyCode", "USD"),
        "line_items": [
            {"title": product["title"], "handle": handle, "quantity": 1}
        ],
    }
    order, _created = ingest_paid_order(payload)
    return order


# ---------------------------------------------------------------------------
# Refunds
# ---------------------------------------------------------------------------
@transaction.atomic
def refund_order(order: Order) -> bool:
    """Mark an order refunded and revoke its download grants, idempotently.

    Returns True if this call performed the refund, False if the order was
    already refunded (webhook replays / repeated commands are safe no-ops).
    A best-effort notice email is sent after commit; mail failures never break
    the refund itself.
    """
    # Lock the row so a concurrent webhook replay can't double-process.
    locked = Order.objects.select_for_update().get(pk=order.pk)
    if locked.refunded_at is not None:
        return False

    now = timezone.now()
    Order.objects.filter(pk=locked.pk).update(refunded_at=now)
    locked.download_grants.filter(revoked_at__isnull=True).update(revoked_at=now)

    transaction.on_commit(lambda: _send_refund_notice(locked.id))
    return True


def _send_refund_notice(order_id: int) -> None:
    """Best-effort 'your refund was processed' email (never raises)."""
    from django.core.mail import send_mail

    order = Order.objects.filter(id=order_id).first()
    if order is None or not order.email:
        return
    titles = ", ".join(p.title for p in order.purchases.all()) or "your purchase"
    try:
        send_mail(
            subject=f"Your refund for order {order.shopify_order_id}",
            message=(
                f"Hi,\n\nYour refund for {titles} has been processed. "
                "The download links for this order are no longer active.\n\n"
                "If you have any questions, just reply to this email.\n\n"
                f"— {settings.DEFAULT_FROM_EMAIL}"
            ),
            from_email=None,  # DEFAULT_FROM_EMAIL
            recipient_list=[order.email],
            fail_silently=True,
        )
    except Exception:  # noqa: BLE001 - never let mail break a refund
        logger.exception(
            "Failed to send refund notice for order %s", order.shopify_order_id
        )


def resend_downloads(email: str) -> bool:
    """Re-send the confirmation/download email for the most recent order.

    NON-ENUMERATING: callers MUST return the same generic response regardless of
    the return value here. Returns ``True`` if an email was actually queued for
    a known email, ``False`` otherwise (unknown email / no orders / send error).
    """
    normalized = (email or "").strip().lower()
    if not normalized:
        return False

    order = (
        Order.objects.filter(email__iexact=normalized)
        .order_by("-created_at")
        .first()
    )
    if order is None:
        return False

    # ``force`` so a resend works even if the original confirmation was sent.
    return send_confirmation_email(order.id, force=True)
