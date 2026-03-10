"""Heuristic location tagging for collected source items."""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.models import RawSourceItem

# Centralized confidence thresholds for geo tagging quality control.
GEO_CONFIDENCE_EXPLICIT = 0.95
GEO_CONFIDENCE_INFERRED_REGION = 0.65
GEO_CONFIDENCE_INFERRED_BROAD = 0.55
GEO_CONFIDENCE_MINIMUM = 0.4

COUNTRY_ALIASES: dict[str, tuple[str | None, str | None]] = {
    "united states": ("US", "US"),
    "u.s.": ("US", "US"),
    "usa": ("US", "US"),
    "us": ("US", "US"),
    "united kingdom": ("GB", "United Kingdom"),
    "uk": ("GB", "United Kingdom"),
    "britain": ("GB", "United Kingdom"),
    "england": ("GB", "England"),
    "london": ("GB", "London"),
    "ireland": ("IE", "Ireland"),
    "europe": (None, "Europe"),
    "germany": ("DE", "Germany"),
    "berlin": ("DE", "Berlin"),
    "france": ("FR", "France"),
    "paris": ("FR", "Paris"),
    "india": ("IN", "India"),
    "china": ("CN", "China"),
    "japan": ("JP", "Japan"),
    "canada": ("CA", "Canada"),
    "australia": ("AU", "Australia"),
}


@dataclass(frozen=True)
class GeoAssignment:
    """Derived location metadata attached to a post or signal."""

    flags: tuple[str, ...] = ()
    country_code: str | None = None
    region: str | None = None
    detection_mode: str = "unknown"
    confidence: float = 0.0


def assign_geo_flags(item: RawSourceItem) -> GeoAssignment:
    """Return conservative geo metadata for a collected source item."""

    if item.geo_flags or item.geo_country_code or item.geo_region:
        return GeoAssignment(
            flags=item.geo_flags,
            country_code=item.geo_country_code,
            region=item.geo_region,
            detection_mode=item.geo_detection_mode,
            confidence=item.geo_confidence,
        )

    explicit = _geo_from_metadata(item.metadata)
    if explicit is not None:
        return explicit

    inferred = _geo_from_text(f"{item.title} {' '.join(item.metadata.values())}".strip())
    if inferred is not None:
        return inferred

    return GeoAssignment()


def _geo_from_metadata(metadata: dict[str, str]) -> GeoAssignment | None:
    for key in ("region", "country", "geo", "location"):
        value = metadata.get(key, "").strip()
        if not value:
            continue
        assignment = _assignment_from_value(value, detection_mode="explicit", confidence=GEO_CONFIDENCE_EXPLICIT)
        if assignment is not None:
            return assignment
    return None


def _geo_from_text(value: str) -> GeoAssignment | None:
    normalized = re.sub(r"[^a-z0-9.\s]", " ", value.lower())
    for alias, (country_code, region) in COUNTRY_ALIASES.items():
        pattern = rf"(?<![a-z0-9]){re.escape(alias)}(?![a-z0-9])"
        if re.search(pattern, normalized):
            return _build_assignment(
                country_code=country_code,
                region=region,
                detection_mode="inferred",
                confidence=GEO_CONFIDENCE_INFERRED_BROAD if country_code is None else GEO_CONFIDENCE_INFERRED_REGION,
            )
    return None


def _assignment_from_value(
    value: str,
    detection_mode: str,
    confidence: float,
) -> GeoAssignment | None:
    normalized = value.strip()
    if not normalized:
        return None

    if len(normalized) == 2 and normalized.isalpha():
        return _build_assignment(
            country_code=normalized.upper(),
            region=normalized.upper(),
            detection_mode=detection_mode,
            confidence=confidence,
        )

    alias_match = COUNTRY_ALIASES.get(normalized.lower())
    if alias_match is not None:
        country_code, region = alias_match
        return _build_assignment(
            country_code=country_code,
            region=region,
            detection_mode=detection_mode,
            confidence=confidence,
        )

    return _build_assignment(
        country_code=None,
        region=normalized,
        detection_mode=detection_mode,
        confidence=confidence,
    )


def _build_assignment(
    country_code: str | None,
    region: str | None,
    detection_mode: str,
    confidence: float,
) -> GeoAssignment:
    flags: list[str] = [f"geo:{detection_mode}"]
    if country_code:
        flags.append(f"geo:country:{country_code}")
    if region:
        flags.append(f"geo:region:{region}")
    return GeoAssignment(
        flags=tuple(flags),
        country_code=country_code,
        region=region,
        detection_mode=detection_mode,
        confidence=confidence,
    )
