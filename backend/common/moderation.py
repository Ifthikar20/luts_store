"""
Content filtering for user-submitted text (review title/body/author name).

Two jobs:
  * ``sanitize`` — strip any HTML/markup so stored text can never carry an
    injection payload (defense in depth on top of the frontend rendering it as
    plain text + the JSON-LD escaping), collapse whitespace, and trim.
  * ``filter_profanity`` — mask disallowed words even when obfuscated. It is
    tolerant of the usual evasions: inflections (fucking), repeated letters
    (shiiit), separators (f u c k / f.u.c.k), and leetspeak (sh1t, @sshole).

Deliberately simple and dependency-free. Swap in a managed moderation service
later if you need stronger coverage.
"""
from __future__ import annotations

import re

_TAG_RE = re.compile(r"<[^>]*>")
_WS_RE = re.compile(r"[ \t ]+")
_MULTINL_RE = re.compile(r"\n{3,}")

# Base list; matched obfuscation-tolerantly (see _build_profanity_re).
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
    "whore",
    "slut",
]

# Per-letter look-alike (leetspeak) classes used when building the matcher.
_LEET = {
    "a": "a4@",
    "b": "b8",
    "c": "c(",
    "e": "e3",
    "g": "g9",
    "i": "i1!|",
    "l": "l1|",
    "o": "o0",
    "s": "s5$",
    "t": "t7",
    "u": "uµv",
    "z": "z2",
}


def _char_class(ch: str) -> str:
    chars = _LEET.get(ch, ch)
    escaped = re.sub(r"([\\\]\^\-])", r"\\\1", chars)
    # Bounded repeat ({1,4}) tolerates real repeats (shiiit) WITHOUT the
    # unbounded backtracking of '+' (which is a ReDoS risk on adversarial input).
    return f"[{escaped}]{{1,4}}"


def _build_profanity_re() -> re.Pattern:
    # Up to 2 non-alphanumeric separators between letters (f u c k / f.u.c.k).
    sep = r"[^a-z0-9]{0,2}"
    words = [sep.join(_char_class(c) for c in w) for w in _BANNED]
    # No surrounding word-char wildcards (would risk ReDoS via overlap with the
    # leading letter class). re.sub still masks the profane core inside larger
    # words (e.g. "bullshit" -> "bulls***", "fucking" -> "f***ing").
    return re.compile("|".join(words), re.IGNORECASE)


_BANNED_RE = _build_profanity_re()


def sanitize(text: str | None) -> str:
    """Strip markup + normalise whitespace. Never returns None."""
    if not text:
        return ""
    text = _TAG_RE.sub("", text)
    text = _WS_RE.sub(" ", text)
    text = _MULTINL_RE.sub("\n\n", text)
    return text.strip()


def _mask(match: re.Match) -> str:
    s = match.group(0)
    # Keep the first character; star every following alphanumeric (leave any
    # separators in place so the masked length still reads naturally).
    return s[0] + "".join("*" if c.isalnum() else c for c in s[1:])


def filter_profanity(text: str) -> str:
    """Mask disallowed words (and their obfuscated variants)."""
    return _BANNED_RE.sub(_mask, text)


def clean_review_text(text: str | None) -> str:
    """Full pipeline for review free-text: sanitize then mask profanity."""
    return filter_profanity(sanitize(text))


def clean_display_name(name: str | None) -> str:
    """A safe, single-line, profanity-masked display name (max 120 chars)."""
    cleaned = filter_profanity(sanitize(name).replace("\n", " ")).strip()
    return cleaned[:120]
