from typing import List, Optional
from pydantic import BaseModel, Field
from app.models.product import ProductCategory
from app.schemas.product import ProductResponse


class ProductSearchResultItem(BaseModel):
    product: ProductResponse
    relevance_score: float = Field(..., description="Calculated relevance score")
    matched_reasons: List[str] = Field(default_factory=list, description="Reasons for match e.g. ExactName, TokenMatch, SynonymMatch")


class ProductSearchResponse(BaseModel):
    query: str
    total_matches: int
    suggested_category: Optional[str] = None
    expanded_keywords: List[str] = Field(default_factory=list)
    results: List[ProductSearchResultItem]


class SuggestionsResponse(BaseModel):
    query: str
    suggestions: List[str]
