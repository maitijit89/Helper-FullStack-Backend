from typing import List, Optional
from beanie import PydanticObjectId
from app.models.product import Product, ProductCategory
from app.schemas.product import ProductCreate, ProductUpdate
from app.schemas.search import ProductSearchResponse, SuggestionsResponse
from app.services.search_service import search_engine


class CRUDProduct:
    async def get_by_id(self, product_id: str) -> Optional[Product]:
        try:
            return await Product.get(PydanticObjectId(product_id))
        except Exception:
            return None

    async def get_multi(
        self,
        category: Optional[ProductCategory] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Product]:
        query = Product.find_all()
        if category:
            query = query.find(Product.category == category)
        if search:
            query = query.find({"name": {"$regex": search, "$options": "i"}})
        return await query.skip(skip).limit(limit).to_list()

    async def search_products(
        self,
        query: str = "",
        category: Optional[ProductCategory] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        in_stock_only: bool = True,
        sort_by: str = "relevance",
    ) -> ProductSearchResponse:
        """Run intelligent product search and weighted relevance algorithm."""
        all_products = await Product.find_all().to_list()
        return search_engine.search_and_rank(
            products=all_products,
            query=query,
            category_filter=category,
            min_price=min_price,
            max_price=max_price,
            in_stock_only=in_stock_only,
            sort_by=sort_by,
        )

    async def get_suggestions(self, query: str, limit: int = 5) -> SuggestionsResponse:
        """Generate fast search auto-suggestions."""
        all_products = await Product.find_all().to_list()
        return search_engine.get_auto_suggestions(
            products=all_products, query=query, limit=limit
        )

    async def create(self, obj_in: ProductCreate) -> Product:
        product = Product(**obj_in.model_dump())
        await product.insert()
        return product

    async def update(self, db_obj: Product, obj_in: ProductUpdate) -> Product:
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        db_obj.touch()
        await db_obj.save()
        return db_obj

    async def delete(self, db_obj: Product) -> bool:
        await db_obj.delete()
        return True


product_crud = CRUDProduct()
