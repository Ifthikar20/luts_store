"""
Real digital delivery backed by a PRIVATE S3 (or S3-compatible) bucket.

The bucket is private (Block Public Access ON). The ONLY way a client can fetch
an object is via a short-lived, AWS-SigV4-signed *presigned URL* minted here.
Because the URL is signed with the IAM secret and carries a short expiry
(``DOWNLOAD_URL_TTL``, default 60s), it cannot be forged or edited and a leaked
URL expires quickly.

This module is only imported/used on the real-delivery path (when AWS keys + a
bucket are configured, i.e. ``settings.S3_DELIVERY_ENABLED``). boto3 is a hard
dependency in requirements.txt; the import lives at module top-level.
"""
from __future__ import annotations

import boto3
from botocore.config import Config
from django.conf import settings


def get_s3_client():
    """Build a boto3 S3 client.

    Credentials: explicit env keys when set; otherwise boto3's default chain
    (EC2/ECS instance role, ~/.aws, env) — so on EC2 you can attach an IAM role
    and leave the key vars blank. Uses SigV4 explicitly (required for presigned
    GET URLs to be valid against all regions / S3-compatible endpoints). Honors
    an optional custom endpoint for S3-compatible stores (MinIO, R2, Wasabi...).
    """
    kwargs: dict = {
        "region_name": settings.AWS_S3_REGION,
        "config": Config(signature_version="s3v4"),
    }
    if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
        kwargs["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
        kwargs["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY
    if settings.AWS_S3_ENDPOINT_URL:
        kwargs["endpoint_url"] = settings.AWS_S3_ENDPOINT_URL
    return boto3.client("s3", **kwargs)


def presigned_download_url(
    key: str, filename: str, ttl: int | None = None
) -> str:
    """Return a short-lived presigned GET URL for a private object.

    Args:
        key: The server-derived S3 object key (never client-supplied).
        filename: Download filename forced via Content-Disposition so the
            browser saves a sensible name regardless of the key.
        ttl: Expiry in seconds. Defaults to ``settings.DOWNLOAD_URL_TTL``.

    The URL is AWS-SigV4-signed and expires after ``ttl`` seconds.
    """
    if ttl is None:
        ttl = settings.DOWNLOAD_URL_TTL
    client = get_s3_client()
    return client.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.AWS_S3_BUCKET,
            "Key": key,
            "ResponseContentDisposition": f'attachment; filename="{filename}"',
        },
        ExpiresIn=ttl,
    )
