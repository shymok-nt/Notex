"""Conservative, offline Turkish OCR suggestions.

This layer NEVER rewrites PaddleOCR text. It only attaches possible
diacritic alternatives to the response for later user confirmation.
No network access, downloads, or external language-model dependency.
"""
from __future__ import annotations

import re
from typing import Any

# Small, intentionally curated starter lexicon. Not a comprehensive Turkish
# dictionary; unknown words and names are left unchanged.
WORDS = frozenset({
    "adım", "akşam", "arkadaş", "bahçe", "başarı", "benim", "bir",
    "bugün", "büyük", "çalışma", "çalışıyorum", "çocuk", "çok",
    "değil", "ders", "dün", "dünya", "eğitim", "eğlenceli",
    "görüşürüz", "güzel", "gün", "günaydın", "günler", "hava",
    "hayat", "her", "için", "iki", "iyi", "kalem", "kitap",
    "küçük", "merhaba", "nasıl", "not", "okul", "olur",
    "ödev", "öğrenci", "öğretmen", "öğrenmek", "örnek",
    "saat", "sabah", "selam", "sen", "sınav", "şimdi",
    "teşekkür", "türkçe", "üç", "üniversite", "var",
    "yapıyorum", "yarın", "yazı", "yazmak", "yeni", "yıl",
    "yok", "zaman",
})
# OCR often loses marks; replacements are considered ONLY at the same
# letter positions. No insertion, deletion, stemming or case guessing.
DIACRITIC_GROUPS = ("oö", "uü", "ıi", "sş", "cç", "gğ")
ALTERNATES = {
    char: frozenset(group) for group in DIACRITIC_GROUPS for char in group
}
TOKEN = re.compile(r"^([^\wÇĞİÖŞÜçğıöşü]*)([A-Za-zÇĞİÖŞÜçğıöşü]+)([^\wÇĞİÖŞÜçğıöşü]*)$", re.UNICODE)


def suggestions(word: str, context: str = "") -> list[str]:
    """Return up to three plausible alternatives; never a replacement."""
    match = TOKEN.match(word.strip())
    if not match:
        return []
    prefix, core, suffix = match.groups()
    normalized = core.lower().replace("i̇", "i")
    if len(normalized) < 3 or len(normalized) > 24:
        return []
    candidates = []
    for candidate in WORDS:
        if candidate == normalized or len(candidate) != len(normalized):
            continue
        if all(a == b or b in ALTERNATES.get(a, ()) for a, b in zip(normalized, candidate)):
            # Prefer alternatives already appearing in the surrounding
            # recognized text; otherwise preserve lexicographic order.
            appears = bool(re.search(r"(?<!\w)" + re.escape(candidate) + r"(?!\w)", context.lower()))
            candidates.append((not appears, candidate))
    candidates.sort()
    def restore(candidate: str) -> str:
        if core.isupper():
            candidate = candidate.upper()
        elif core[0].isupper():
            candidate = candidate[0].upper() + candidate[1:]
        return prefix + candidate + suffix
    return [restore(candidate) for _, candidate in candidates[:3]]


def annotate_lines(lines: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Attach non-destructive candidates without modifying OCR output."""
    context = " ".join(str(line.get("text", "")) for line in lines)
    annotated = []
    for line in lines:
        entry = dict(line)
        entry["alternatives"] = suggestions(str(line.get("text", "")), context)
        annotated.append(entry)
    return annotated
