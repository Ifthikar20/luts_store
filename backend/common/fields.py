"""
Transparent encrypted model fields.

An ``EncryptedTextField`` stores its value ENCRYPTED in the database and returns
plaintext to the application — encryption/decryption happen automatically on
save/load, so models and serializers use the field like a normal TextField. The
DB column is plain TEXT (it holds ciphertext), so no schema migration is needed
beyond the field swap.

Trade-off: encrypted columns are not meaningfully searchable/sortable at the DB
level (the stored bytes are ciphertext). That's acceptable for review free-text.
"""
from __future__ import annotations

from django.db import models

from .encryption import decrypt, encrypt


class EncryptedTextField(models.TextField):
    """TextField whose content is encrypted at rest (Fernet)."""

    def from_db_value(self, value, expression, connection):
        return decrypt(value)

    def to_python(self, value):
        # Values already in Python form (forms/deserialization) are plaintext.
        return value

    def get_prep_value(self, value):
        value = super().get_prep_value(value)
        return encrypt(value)


class EncryptedCharField(models.TextField):
    """Like EncryptedTextField but for short fields (stored as TEXT ciphertext).

    Kept as TEXT because ciphertext is longer than the plaintext max_length.
    """

    def from_db_value(self, value, expression, connection):
        return decrypt(value)

    def to_python(self, value):
        return value

    def get_prep_value(self, value):
        value = super().get_prep_value(value)
        return encrypt(value)
