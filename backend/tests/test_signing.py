"""Tests for signed, time-limited download tokens (delivery/signing.py)."""
import time

import pytest

from delivery.signing import (
    ExpiredToken,
    InvalidToken,
    make_download_token,
    read_download_token,
)


def test_valid_token_roundtrip():
    token = make_download_token(grant_id=42, product_handle="midnight-noir")
    payload = read_download_token(token)
    assert payload["grantId"] == 42
    assert payload["productHandle"] == "midnight-noir"


def test_expired_token():
    token = make_download_token(grant_id=1, product_handle="x")
    time.sleep(1)
    with pytest.raises(ExpiredToken):
        read_download_token(token, max_age=0)


def test_tampered_token():
    token = make_download_token(grant_id=1, product_handle="x")
    # Flip a character in the middle of the signed token.
    tampered = token[:-3] + ("aaa" if token[-3:] != "aaa" else "bbb")
    with pytest.raises(InvalidToken):
        read_download_token(tampered)
