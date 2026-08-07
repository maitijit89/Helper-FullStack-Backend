import re
from typing import List, Optional, Tuple
from app.models.product import Product, ProductCategory
from app.schemas.product import ProductResponse
from app.schemas.search import ProductSearchResultItem, ProductSearchResponse, SuggestionsResponse


class ProductSearchEngine:
    """Intelligent Search Engine with Intent Analysis, Synonym Expansion, and Weighted Relevance Algorithm."""

    # Knowledge Base: Intent & Synonym Dictionary
    SYNONYM_MAP = {
        "xerox": ("printing", ["xerox", "photocopy", "print", "document", "copy"]),
        "photocopy": ("printing", ["xerox", "photocopy", "print", "document", "copy"]),
        "print": ("printing", ["xerox", "photocopy", "print", "document", "copy"]),
        "pdf": ("printing", ["xerox", "photocopy", "print", "document"]),
        "binding": ("printing", ["spiral", "channel_file", "binding"]),
        "spiral": ("printing", ["spiral", "binding", "file"]),
        "coke": ("beverages", ["coca cola", "cold drink", "soda", "beverage"]),
        "colddrink": ("beverages", ["cold drink", "soda", "beverage", "soft drink"]),
        "pepsi": ("beverages", ["pepsi", "cold drink", "soda", "beverage"]),
        "sprite": ("beverages", ["sprite", "cold drink", "soda", "beverage"]),
        "drink": ("beverages", ["cold drink", "beverage", "soda"]),
        "chips": ("snacks", ["chips", "kurkure", "pran", "potato chips", "snack"]),
        "kurkure": ("snacks", ["kurkure", "chips", "namkeen", "snack"]),
        "pran": ("snacks", ["pran", "potato chips", "chips", "snack"]),
        "snack": ("snacks", ["snack", "chips", "kurkure", "namkeen"]),
        "cake": ("cakes", ["cake", "pastry", "bakery"]),
        "pastry": ("cakes", ["pastry", "cake", "bakery"]),
        "pen": ("stationery", ["pen", "ball pen", "stationery"]),
        "notebook": ("stationery", ["notebook", "copy", "register", "stationery"]),
        "file": ("stationery", ["channel file", "spiral file", "file", "folder"]),
        "channel": ("stationery", ["channel file", "file", "folder"]),
        "porter": ("porter_5kg", ["porter", "courier", "parcel", "delivery 5kg"]),
        "courier": ("porter_5kg", ["porter", "courier", "parcel"]),
        "parcel": ("porter_5kg", ["porter", "courier", "parcel"]),
    }

    def _normalize(self, text: str) -> str:
        """Clean and normalize text for search processing."""
        text = text.lower().strip()
        text = re.sub(r"[^\w\s]", "", text)
        return text

    def analyze_intent(self, query: str) -> Tuple[Optional[str], List[str]]:
        """Analyze query to extract primary category intent and expanded synonym terms."""
        normalized_q = self._normalize(query)
        tokens = normalized_q.split()

        suggested_category = None
        expanded_keywords = set(tokens)

        for token in tokens:
            if token in self.SYNONYM_MAP:
                cat, synonyms = self.SYNONYM_MAP[token]
                if not suggested_category:
                    suggested_category = cat
                expanded_keywords.update(synonyms)

        return suggested_category, list(expanded_keywords)

    def calculate_relevance(
        self,
        product: Product,
        query: str,
        tokens: List[str],
        expanded_keywords: List[str],
        suggested_category: Optional[str],
    ) -> Tuple[float, List[str]]:
        """Calculate weighted relevance score for a product given search tokens."""
        score = 0.0
        reasons = []

        norm_query = self._normalize(query)
        norm_name = self._normalize(product.name)
        norm_desc = self._normalize(product.description or "")
        norm_cat = product.category.value.lower()

        # 1. Exact Name Match (+100)
        if norm_query == norm_name:
            score += 100.0
            reasons.append("ExactNameMatch (+100)")

        # 2. Name Starts With Query (+50)
        elif norm_name.startswith(norm_query):
            score += 50.0
            reasons.append("PrefixNameMatch (+50)")

        # 3. Substring Name Match (+30)
        elif norm_query in norm_name:
            score += 30.0
            reasons.append("SubstringNameMatch (+30)")

        # 4. Token Matches in Name (+20 per token)
        name_words = norm_name.split()
        for token in tokens:
            if token in name_words:
                score += 20.0
                reasons.append(f"TokenNameMatch:{token} (+20)")

        # 5. Synonym / Expanded Keyword Matches in Name or Tags (+15)
        product_tags = [self._normalize(t) for t in (product.tags + product.search_keywords)]
        for kw in expanded_keywords:
            if kw in norm_name or any(kw in tag for tag in product_tags):
                score += 15.0
                reasons.append(f"SynonymMatch:{kw} (+15)")

        # 6. Category Intent Match (+15)
        if suggested_category and norm_cat == suggested_category:
            score += 15.0
            reasons.append(f"CategoryMatch:{norm_cat} (+15)")

        # 7. Description Substring Match (+10)
        if norm_query and norm_query in norm_desc:
            score += 10.0
            reasons.append("DescriptionMatch (+10)")

        # 8. In Stock Bonus (+5)
        if product.is_available and product.stock_quantity > 0:
            score += 5.0
            reasons.append("InStockBonus (+5)")

        return score, reasons

    def search_and_rank(
        self,
        products: List[Product],
        query: str,
        category_filter: Optional[ProductCategory] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        in_stock_only: bool = True,
        sort_by: str = "relevance",
    ) -> ProductSearchResponse:
        """Search, filter, rank, and format product results."""
        norm_query = self._normalize(query)
        tokens = norm_query.split() if norm_query else []

        suggested_category, expanded_keywords = self.analyze_intent(query) if query else (None, [])

        results: List[ProductSearchResultItem] = []

        for p in products:
            # Filters
            if in_stock_only and (not p.is_available or p.stock_quantity <= 0):
                continue
            if category_filter and p.category != category_filter:
                continue
            if min_price is not None and p.price < min_price:
                continue
            if max_price is not None and p.price > max_price:
                continue

            # Calculate Relevance
            if query:
                score, reasons = self.calculate_relevance(
                    product=p,
                    query=query,
                    tokens=tokens,
                    expanded_keywords=expanded_keywords,
                    suggested_category=suggested_category,
                )
                if score > 0:
                    results.append(
                        ProductSearchResultItem(
                            product=ProductResponse.model_validate(p),
                            relevance_score=score,
                            matched_reasons=reasons,
                        )
                    )
            else:
                # Default listing without search query
                results.append(
                    ProductSearchResultItem(
                        product=ProductResponse.model_validate(p),
                        relevance_score=1.0,
                        matched_reasons=["DefaultListing"],
                    )
                )

        # Sorting
        if sort_by == "relevance" and query:
            results.sort(key=lambda item: item.relevance_score, reverse=True)
        elif sort_by == "price_low_to_high":
            results.sort(key=lambda item: item.product.price)
        elif sort_by == "price_high_to_low":
            results.sort(key=lambda item: item.product.price, reverse=True)
        elif sort_by == "newest":
            results.sort(key=lambda item: item.product.created_at, reverse=True)

        return ProductSearchResponse(
            query=query,
            total_matches=len(results),
            suggested_category=suggested_category,
            expanded_keywords=expanded_keywords,
            results=results,
        )

    def get_auto_suggestions(self, products: List[Product], query: str, limit: int = 5) -> SuggestionsResponse:
        """Generate fast search auto-suggestions based on product names and categories."""
        if not query:
            return SuggestionsResponse(query="", suggestions=[])

        norm_q = self._normalize(query)
        suggestions_set = set()

        for p in products:
            norm_name = self._normalize(p.name)
            if norm_name.startswith(norm_q):
                suggestions_set.add(p.name)
            elif norm_q in norm_name:
                suggestions_set.add(p.name)

        # Also add matched synonym terms
        for token, (_, synonyms) in self.SYNONYM_MAP.items():
            if token.startswith(norm_q):
                suggestions_set.update(synonyms[:2])

        sorted_suggestions = list(suggestions_set)[:limit]
        return SuggestionsResponse(query=query, suggestions=sorted_suggestions)


search_engine = ProductSearchEngine()
