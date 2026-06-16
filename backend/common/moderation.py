"""
Lightweight content filtering for user-submitted text (reviews).

Two jobs:
  * ``sanitize`` — strip any HTML/markup so stored text can never carry an
    injection payload (defense in depth on top of the frontend rendering it as
    plain text), collapse whitespace, and trim.
  * ``filter_profanity`` — mask a small set of disallowed words with asterisks
    so off-tone words don't render on the storefront.

Deliberately simple and dependency-free. Swap in a managed moderation service
later if you need stronger coverage.
"""
from __future__ import annotations

import re

_TAG_RE = re.compile(r"<[^>]*>")
_WS_RE = re.compile(r"[ \t ]+")
_MULTINL_RE = re.compile(r"\n{3,}")

# Base list; word-boundary matched, case-insensitive. Extend as needed.
_BANNED = [
    "fuck",
    "shit",
    "bitch",
    "asshole",
    "bastard",
    "cunt",
    "dick",
    "nigger",
    "faggot",
]
# Match the banned root anywhere inside a word (catches inflections like
# "fucking", "bullshit"); the whole word is masked. Word-bounded to limit
# false positives — extend/trim _BANNED to taste.
_BANNED_RE = re.compile(
    r"\b\w*(?:" + "|".join(re.escape(w) for w in _BANNED) + r")\w*\b",
    re.IGNORECASE,
)


def sanitize(text: str | None) -> str:
    """Strip markup + normalise whitespace. Never returns None."""
    if not text:
        return ""
    text = _TAG_RE.sub("", text)
    # Normalise spaces and excessive blank lines, then trim.
    text = _WS_RE.sub(" ", text)
    text = _MULTINL_RE.sub("\n\n", text)
    return text.strip()


def filter_profanity(text: str) -> str:
    """Mask disallowed words (keep first letter, e.g. 'f***')."""

    def mask(match: re.Match) -> str:
        word = match.group(0)
        return word[0] + "*" * (len(word) - 1)

    return _BANNED_RE.sub(mask, text)


def clean_review_text(text: str | None) -> str:
    """Full pipeline for review free-text: sanitize then mask profanity."""
    return filter_profanity(sanitize(text))
