from django.conf import settings
from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(["GET"])
def health(request):
    """Liveness/health probe. Reports whether the app is in mock mode."""
    return Response({"status": "ok", "mockMode": settings.MOCK_MODE})
