"""Service search and matching logic."""

import logging
import re
from typing import Dict, List, Tuple
from difflib import SequenceMatcher

logger = logging.getLogger(__name__)


def normalize_text(text: str) -> str:
    """
    Normalize text for matching.

    Args:
        text: Input text

    Returns:
        Normalized text
    """
    if not text:
        return ""
    # lowercase, remove punctuation, normalize spaces
    text = re.sub(r"[^\w\s]", " ", text.lower())
    text = re.sub(r"\s+", " ", text).strip()
    return text


def calculate_match_score(query: str, service: Dict) -> float:
    """
    Calculate how well a service matches the search query.

    Args:
        query: Search query
        service: Service dictionary

    Returns:
        Match score (0-100)
    """
    query_norm = normalize_text(query)

    # Build list of searchable fields
    search_fields = []

    if service.get("nameEnglish"):
        search_fields.append(normalize_text(service["nameEnglish"]))
    if service.get("nameHindi"):
        search_fields.append(normalize_text(service["nameHindi"]))
    if service.get("slug"):
        search_fields.append(normalize_text(service["slug"]))
    if service.get("id"):
        search_fields.append(normalize_text(str(service["id"])))

    # Add department names too
    if isinstance(service.get("department"), dict):
        dept = service["department"]
        if dept.get("nameEnglish"):
            search_fields.append(normalize_text(dept["nameEnglish"]))
        if dept.get("nameHindi"):
            search_fields.append(normalize_text(dept["nameHindi"]))

    if not search_fields:
        return 0.0

    # Find best match
    max_score = 0.0

    for field in search_fields:
        # Exact substring = high score
        if query_norm in field:
            score = 90.0 + (len(query_norm) / len(field)) * 10
            max_score = max(max_score, score)
            continue

        if field in query_norm:
            score = 85.0
            max_score = max(max_score, score)
            continue

        # Fuzzy match
        ratio = SequenceMatcher(None, query_norm, field).ratio()
        score = ratio * 100
        max_score = max(max_score, score)

    # Bonus if all words match
    query_words = set(query_norm.split())
    if query_words:
        for field in search_fields:
            field_words = set(field.split())
            if query_words.issubset(field_words):
                max_score = min(100, max_score + 15)
                break

    return max_score


def fuzzy_search_services(
    query: str, services: List[Dict], max_results: int = 5, min_score: float = 30.0
) -> List[Tuple[Dict, float]]:
    """
    Search through services with fuzzy matching.

    Args:
        query: Search query
        services: List of service dictionaries
        max_results: Maximum number of results to return
        min_score: Minimum score threshold

    Returns:
        List of tuples (service, score) sorted by score descending
    """
    logger.info(f"Searching '{query}' across {len(services)} services")

    scored = []
    for service in services:
        score = calculate_match_score(query, service)
        if score > min_score:
            scored.append((service, score))

    # Sort by score
    scored.sort(key=lambda x: x[1], reverse=True)

    # Log top matches for debugging
    for service, score in scored[:5]:
        logger.debug(f"  {score:.1f}% - {service.get('nameEnglish', 'N/A')}")

    return scored[:max_results]

