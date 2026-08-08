import pytest
from app.models.product import Product, ProductCategory
from app.services.search_service import calculate_levenshtein_distance, search_engine


def test_levenshtein_distance():
    assert calculate_levenshtein_distance("notebook", "notebook") == 0
    assert calculate_levenshtein_distance("notbook", "notebook") == 1
    assert calculate_levenshtein_distance("prnting", "printing") == 1
    assert calculate_levenshtein_distance("apple", "banana") > 3


def test_fuzzy_search_intent():
    # Typo query 'xerox' vs 'xero'
    cat, synonyms = search_engine.analyze_intent("xero")
    assert cat == "printing"
    assert "photocopy" in synonyms
