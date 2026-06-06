# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Django BFF image. Runs gunicorn (config.wsgi) on :8000 as a non-root user.
# Works in MOCK_MODE out of the box (no Shopify env). Point DATABASE_URL at
# Postgres for a prod-like run; SQLite is the zero-config default otherwise.
# ---------------------------------------------------------------------------
FROM python:3.11-slim

# - PYTHONDONTWRITEBYTECODE: no .pyc files in the image.
# - PYTHONUNBUFFERED: stream logs straight to stdout (good for containers).
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install dependencies first so this layer is cached across code-only changes.
# psycopg[binary] ships its own libpq, so no system build deps are required.
COPY requirements.txt ./
RUN python -m pip install --upgrade pip \
    && pip install -r requirements.txt

# Copy the application source.
COPY . .

# Collect static files (Django admin/DRF assets) into STATIC_ROOT. Runs with a
# placeholder SECRET_KEY because collectstatic does not need a real one.
RUN SECRET_KEY=build-time-only python manage.py collectstatic --noinput

# Run as an unprivileged user.
RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# 3 workers is a sane default for small instances; tune via WEB_CONCURRENCY.
# Migrations are run by docker-compose's command before the server starts, so
# the bare image just serves; override the command to run migrate standalone.
CMD ["gunicorn", "config.wsgi:application", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "3", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
