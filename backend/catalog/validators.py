"""Validators for admin file uploads (size + extension)."""
from __future__ import annotations

from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator
from django.utils.deconstruct import deconstructible


@deconstructible
class MaxFileSizeValidator:
    """Reject uploads larger than ``max_mb`` megabytes."""

    def __init__(self, max_mb: int):
        self.max_mb = max_mb

    def __call__(self, value):
        if value and value.size > self.max_mb * 1024 * 1024:
            raise ValidationError(
                f"File is too large ({value.size // (1024 * 1024)} MB). "
                f"Maximum is {self.max_mb} MB."
            )

    def __eq__(self, other):  # needed so migrations don't churn
        return isinstance(other, MaxFileSizeValidator) and other.max_mb == self.max_mb


lut_file_validators = [
    FileExtensionValidator(["zip", "cube", "3dl"]),
    MaxFileSizeValidator(200),
]
image_validators = [
    FileExtensionValidator(["jpg", "jpeg", "png", "webp", "gif", "avif"]),
    MaxFileSizeValidator(15),
]
video_validators = [
    FileExtensionValidator(["mp4", "webm", "mov"]),
    MaxFileSizeValidator(100),
]
