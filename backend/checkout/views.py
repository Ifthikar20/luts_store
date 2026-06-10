"""
Checkout API views.

* POST /api/checkout          {cartId, email?} -> {mode, checkoutUrl}
* POST /api/checkout/complete {cartId, email}  -> {orderId}   (MOCK_MODE ONLY)

Both are throttled by the dedicated ``sensitive`` scope (they create
orders/grants and trigger email). The guest flow needs no auth: a shopper can
buy and download without an account.
"""
from __future__ import annotations

from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
    throttle_classes,
)
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle

from rest_framework.authentication import SessionAuthentication, TokenAuthentication

from . import services


class CsrfExemptSessionAuthentication(SessionAuthentication):
    """Session auth WITHOUT DRF's CSRF check, for the SPA checkout POST.

    The storefront runs on a different origin and our CSRF cookie is httpOnly,
    so the SPA cannot echo a CSRF token. The residual cross-site risk is low:
    ``SameSite=Lax`` already blocks cross-site POST cookies in modern browsers,
    the request needs the victim's unguessable ``cartId`` to do anything, and
    starting a checkout for the user's own cart is not a damaging state change.
    """

    def enforce_csrf(self, request):
        return  # CSRF intentionally skipped — see class docstring.


class SensitiveScopedThrottle(SimpleRateThrottle):
    """Dedicated throttle pinned to the ``sensitive`` rate (5/min by default).

    Mirrors ``orders.views.SensitiveScopedThrottle`` / ``accounts`` throttles.
    Hard-coding the scope means it always applies on these function-based views.
    Keyed per client IP to blunt abuse of the order/email-creating endpoints.
    """

    scope = "sensitive"

    def get_cache_key(self, request, view):
        return self.cache_format % {
            "scope": self.scope,
            "ident": self.get_ident(request),
        }


@api_view(["POST"])
@authentication_classes([CsrfExemptSessionAuthentication, TokenAuthentication])
@throttle_classes([AnonRateThrottle, SensitiveScopedThrottle])
def checkout(request):
    """Begin checkout for a cart. Returns ``{mode, checkoutUrl}``.

    Buying requires a signed-in account (Google/Apple). Anonymous callers get a
    401 with ``code: "login_required"`` so the storefront can prompt sign-in.
    The Django session cookie (set by any sign-in) is the primary credential;
    a legacy DRF token still works.
    """
    if not request.user or not request.user.is_authenticated:
        return Response(
            {
                "detail": "Please sign in to complete your purchase.",
                "code": "login_required",
            },
            status=401,
        )

    data = request.data if isinstance(request.data, dict) else {}
    cart_id = data.get("cartId")
    email = data.get("email")
    if not cart_id:
        return Response({"detail": "`cartId` is required."}, status=400)

    try:
        result = services.begin_checkout(str(cart_id), email)
    except services.CheckoutError as exc:
        return Response({"detail": str(exc)}, status=404)
    return Response(result)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([])
@throttle_classes([AnonRateThrottle, SensitiveScopedThrottle])
def checkout_complete(request):
    """MOCK_MODE ONLY: simulate Shopify completing payment for a cart.

    Returns 404 unless we're in the pure in-app demo (no Stripe, no Shopify). In
    production the order is completed by the payment provider's webhook (Stripe's
    ``checkout.session.completed`` or Shopify's ``orders/paid``), never here.
    Creates the Order + DownloadGrants + sends the confirmation email, then
    returns ``{orderId}``.
    """
    if settings.STRIPE_ENABLED or not settings.MOCK_MODE:
        return Response({"detail": "Not found."}, status=404)

    data = request.data if isinstance(request.data, dict) else {}
    cart_id = data.get("cartId")
    email = data.get("email")
    if not cart_id:
        return Response({"detail": "`cartId` is required."}, status=400)
    if not email:
        return Response({"detail": "`email` is required."}, status=400)

    try:
        result = services.complete_mock_checkout(str(cart_id), str(email))
    except services.CheckoutError as exc:
        return Response({"detail": str(exc)}, status=400)
    return Response(result)


@csrf_exempt
@api_view(["POST"])
@authentication_classes([])
@permission_classes([])
@throttle_classes([AnonRateThrottle])
def stripe_webhook(request):
    """Stripe webhook receiver.

    Verifies the ``Stripe-Signature`` header against ``STRIPE_WEBHOOK_SECRET``
    over the EXACT raw body, then on ``checkout.session.completed`` ingests the
    paid session (Order + DownloadGrants + confirmation email) via the shared
    pipeline. Idempotent: replayed events resolve to the same order. Always 200
    on a valid signature so Stripe stops retrying a processed event.
    """
    if not settings.STRIPE_ENABLED:
        return Response({"detail": "Not found."}, status=404)

    from . import stripe_gateway

    raw_body = request.body  # exact bytes Stripe signed
    sig_header = request.META.get("HTTP_STRIPE_SIGNATURE")
    try:
        event = stripe_gateway.construct_event(raw_body, sig_header)
    except stripe_gateway.StripeError:
        return Response({"detail": "Invalid signature."}, status=400)

    event_type = event["type"] if isinstance(event, dict) else event.type
    obj = (
        event["data"]["object"] if isinstance(event, dict) else event.data.object
    )

    if event_type == "checkout.session.completed":
        try:
            stripe_gateway.ingest_session(obj)
        except stripe_gateway.StripeError as exc:
            # Don't ask Stripe to retry forever on a bad/unresolvable session.
            return Response({"detail": str(exc)}, status=400)

    elif event_type == "charge.refunded":
        _handle_refund(obj)

    # Acknowledge all other event types without action.
    return Response({"status": "ok"}, status=200)


def _handle_refund(charge) -> None:
    """Revoke download grants for a refunded Stripe charge (best-effort).

    Resolves charge -> payment intent -> Checkout Session -> our Order
    (``stripe-<session_id>``) and runs the idempotent refund pipeline. Missing
    pieces are logged and skipped — a refund webhook must always 200 so Stripe
    doesn't retry forever.
    """
    import logging

    from . import stripe_gateway
    from orders.models import Order
    from orders.services import refund_order

    logger = logging.getLogger(__name__)

    pi = (
        charge.get("payment_intent")
        if isinstance(charge, dict)
        else getattr(charge, "payment_intent", None)
    )
    if not pi:
        return
    try:
        session_id = stripe_gateway.find_session_id_for_payment_intent(str(pi))
    except stripe_gateway.StripeError:
        logger.exception("Refund: session lookup failed for %s", pi)
        return
    if not session_id:
        logger.warning("Refund: no checkout session for payment intent %s", pi)
        return

    order = Order.objects.filter(
        shopify_order_id=stripe_gateway.order_id_for_session(session_id)
    ).first()
    if order is None:
        logger.warning("Refund: no order for session %s", session_id)
        return
    refund_order(order)
