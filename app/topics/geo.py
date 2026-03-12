"""Heuristic location tagging for collected source items."""

from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import urlparse

from app.models import RawSourceItem

# Centralized confidence thresholds for geo tagging quality control.
GEO_CONFIDENCE_EXPLICIT = 0.95
GEO_CONFIDENCE_INFERRED_REGION = 0.65
GEO_CONFIDENCE_INFERRED_BROAD = 0.55
GEO_CONFIDENCE_REINFORCED = 0.78
GEO_CONFIDENCE_MINIMUM = 0.4

COUNTRY_ALIASES: dict[str, tuple[str | None, str | None]] = {
    "united states": ("US", "US"),
    "u.s.": ("US", "US"),
    "usa": ("US", "US"),
    "us": ("US", "US"),
    "united kingdom": ("GB", "United Kingdom"),
    "uk": ("GB", "United Kingdom"),
    "britain": ("GB", "United Kingdom"),
    "great britain": ("GB", "United Kingdom"),
    "british": ("GB", "United Kingdom"),
    "england": ("GB", "England"),
    "scotland": ("GB", "Scotland"),
    "wales": ("GB", "Wales"),
    "london": ("GB", "London"),
    "ireland": ("IE", "Ireland"),
    "dublin": ("IE", "Dublin"),
    "europe": (None, "Europe"),
    "eu": (None, "Europe"),
    "germany": ("DE", "Germany"),
    "berlin": ("DE", "Berlin"),
    "munich": ("DE", "Munich"),
    "france": ("FR", "France"),
    "paris": ("FR", "Paris"),
    "spain": ("ES", "Spain"),
    "madrid": ("ES", "Madrid"),
    "italy": ("IT", "Italy"),
    "rome": ("IT", "Rome"),
    "netherlands": ("NL", "Netherlands"),
    "amsterdam": ("NL", "Amsterdam"),
    "sweden": ("SE", "Sweden"),
    "stockholm": ("SE", "Stockholm"),
    "norway": ("NO", "Norway"),
    "denmark": ("DK", "Denmark"),
    "poland": ("PL", "Poland"),
    "ukraine": ("UA", "Ukraine"),
    "russia": ("RU", "Russia"),
    "moscow": ("RU", "Moscow"),
    "middle east": (None, "Middle East"),
    "africa": (None, "Africa"),
    "libya": ("LY", "Libya"),
    "asia": (None, "Asia"),
    "india": ("IN", "India"),
    "delhi": ("IN", "Delhi"),
    "mumbai": ("IN", "Mumbai"),
    "china": ("CN", "China"),
    "beijing": ("CN", "Beijing"),
    "shanghai": ("CN", "Shanghai"),
    "japan": ("JP", "Japan"),
    "tokyo": ("JP", "Tokyo"),
    "south korea": ("KR", "South Korea"),
    "seoul": ("KR", "Seoul"),
    "singapore": ("SG", "Singapore"),
    "uae": ("AE", "United Arab Emirates"),
    "united arab emirates": ("AE", "United Arab Emirates"),
    "emirates": ("AE", "United Arab Emirates"),
    "dubai": ("AE", "Dubai"),
    "canada": ("CA", "Canada"),
    "toronto": ("CA", "Toronto"),
    "vancouver": ("CA", "Vancouver"),
    "australia": ("AU", "Australia"),
    "sydney": ("AU", "Sydney"),
    "melbourne": ("AU", "Melbourne"),
    "new zealand": ("NZ", "New Zealand"),
    "latin america": (None, "Latin America"),
    "brazil": ("BR", "Brazil"),
    "sao paulo": ("BR", "Sao Paulo"),
    "mexico": ("MX", "Mexico"),
}

COUNTRY_CODE_REGIONS: dict[str, str] = {
    "US": "US",
    "GB": "United Kingdom",
    "IE": "Ireland",
    "DE": "Germany",
    "FR": "France",
    "ES": "Spain",
    "IT": "Italy",
    "NL": "Netherlands",
    "SE": "Sweden",
    "NO": "Norway",
    "DK": "Denmark",
    "PL": "Poland",
    "UA": "Ukraine",
    "RU": "Russia",
    "LY": "Libya",
    "IN": "India",
    "CN": "China",
    "JP": "Japan",
    "KR": "South Korea",
    "SG": "Singapore",
    "AE": "United Arab Emirates",
    "CA": "Canada",
    "AU": "Australia",
    "NZ": "New Zealand",
    "BR": "Brazil",
    "MX": "Mexico",
}

COUNTRY_TLDS: dict[str, str] = {
    "uk": "GB",
    "de": "DE",
    "fr": "FR",
    "es": "ES",
    "it": "IT",
    "nl": "NL",
    "se": "SE",
    "no": "NO",
    "dk": "DK",
    "pl": "PL",
    "ua": "UA",
    "ru": "RU",
    "ly": "LY",
    "in": "IN",
    "cn": "CN",
    "jp": "JP",
    "kr": "KR",
    "sg": "SG",
    "ae": "AE",
    "ca": "CA",
    "au": "AU",
    "nz": "NZ",
    "br": "BR",
    "mx": "MX",
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

    inferred = _geo_from_inference_hints(item)
    if inferred is not None:
        return inferred

    return GeoAssignment()


def _geo_from_metadata(metadata: dict[str, str]) -> GeoAssignment | None:
    for key in ("region", "country", "geo", "location", "locale", "lang", "language"):
        value = metadata.get(key, "").strip()
        if not value:
            continue
        assignment = _assignment_from_value(value, detection_mode="explicit", confidence=GEO_CONFIDENCE_EXPLICIT)
        if assignment is not None:
            return assignment
    return None


def _geo_from_inference_hints(item: RawSourceItem) -> GeoAssignment | None:
    text_assignment = _geo_from_text(f"{item.title} {' '.join(item.metadata.values())}".strip())
    url_assignment = _geo_from_url(item.url)
    locale_assignment = _geo_from_metadata_locale(item.metadata)

    reinforced = _combine_inferred_assignments(text_assignment, url_assignment, locale_assignment)
    if reinforced is not None:
        return reinforced
    return text_assignment or locale_assignment or url_assignment


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


def _geo_from_url(url: str) -> GeoAssignment | None:
    hostname = urlparse(url).hostname or ""
    if not hostname:
        return None
    suffix = hostname.lower().rsplit(".", maxsplit=1)
    if len(suffix) != 2:
        return None
    country_code = COUNTRY_TLDS.get(suffix[1])
    if country_code is None:
        return None
    return _build_assignment(
        country_code=country_code,
        region=COUNTRY_CODE_REGIONS[country_code],
        detection_mode="inferred",
        confidence=GEO_CONFIDENCE_INFERRED_BROAD,
    )


def _geo_from_metadata_locale(metadata: dict[str, str]) -> GeoAssignment | None:
    locale_values = [
        metadata.get("locale", "").strip(),
        metadata.get("lang", "").strip(),
        metadata.get("language", "").strip(),
    ]
    for value in locale_values:
        if not value:
            continue
        match = re.search(r"([a-z]{2})[-_ ]([A-Za-z]{2})", value)
        if match is None:
            continue
        country_code = match.group(2).upper()
        if country_code not in COUNTRY_CODE_REGIONS:
            continue
        return _build_assignment(
            country_code=country_code,
            region=COUNTRY_CODE_REGIONS[country_code],
            detection_mode="inferred",
            confidence=GEO_CONFIDENCE_INFERRED_BROAD,
        )
    return None


def _combine_inferred_assignments(*assignments: GeoAssignment | None) -> GeoAssignment | None:
    valid_assignments = [assignment for assignment in assignments if assignment is not None]
    if len(valid_assignments) < 2:
        return None

    country_counts: dict[str, int] = {}
    for assignment in valid_assignments:
        if assignment.country_code:
            country_counts[assignment.country_code] = country_counts.get(assignment.country_code, 0) + 1

    if not country_counts:
        return None

    country_code, count = max(country_counts.items(), key=lambda item: (item[1], item[0]))
    if count < 2:
        return None

    region = next(
        (
            assignment.region
            for assignment in valid_assignments
            if assignment.country_code == country_code and assignment.region
        ),
        COUNTRY_CODE_REGIONS.get(country_code),
    )
    return _build_assignment(
        country_code=country_code,
        region=region,
        detection_mode="inferred",
        confidence=GEO_CONFIDENCE_REINFORCED,
    )


def _assignment_from_value(
    value: str,
    detection_mode: str,
    confidence: float,
) -> GeoAssignment | None:
    normalized = value.strip()
    if not normalized:
        return None

    locale_match = re.search(r"([a-z]{2})[-_ ]([A-Za-z]{2})", normalized)
    if locale_match is not None:
        country_code = locale_match.group(2).upper()
        if country_code in COUNTRY_CODE_REGIONS:
            return _build_assignment(
                country_code=country_code,
                region=COUNTRY_CODE_REGIONS[country_code],
                detection_mode=detection_mode,
                confidence=confidence,
            )

    if len(normalized) == 2 and normalized.isalpha():
        country_code = normalized.upper()
        return _build_assignment(
            country_code=country_code,
            region=COUNTRY_CODE_REGIONS.get(country_code, country_code),
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
