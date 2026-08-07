import os
from pathlib import Path
import secrets
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from app.api.deps import get_current_admin
from app.core.exceptions import BadRequestException, NotFoundException
from app.crud.crud_product import product_crud
from app.models.product import ProductCategory
from app.schemas.product import ProductCreate, ProductResponse, ProductUpdate
from app.schemas.response import APIResponse
from app.schemas.search import ProductSearchResponse, SuggestionsResponse

router = APIRouter()

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def save_upload_image(file: UploadFile, product_id: str) -> str:
    """Validate and save uploaded image file to static uploads folder."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise BadRequestException(
            f"Invalid image format '{ext}'. Allowed extensions: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}"
        )

    upload_dir = Path("uploads/products")
    upload_dir.mkdir(parents=True, exist_ok=True)

    filename = f"prod_{product_id}_{secrets.token_hex(4)}{ext}"
    filepath = upload_dir / filename

    with open(filepath, "wb") as buffer:
        buffer.write(file.file.read())

    return f"/static/products/{filename}"


@router.get("/search", response_model=APIResponse[ProductSearchResponse])
async def search_products(
    q: str = Query("", description="Search term query"),
    category: Optional[ProductCategory] = Query(None, description="Filter by category"),
    min_price: Optional[float] = Query(None, ge=0.0, description="Minimum price filter"),
    max_price: Optional[float] = Query(None, ge=0.0, description="Maximum price filter"),
    in_stock_only: bool = Query(True, description="Filter only in-stock available products"),
    sort_by: str = Query("relevance", description="Sort by: relevance, price_low_to_high, price_high_to_low, newest"),
) -> Any:
    """Intelligent product search engine with weighted relevance ranking and synonym expansion."""
    search_result = await product_crud.search_products(
        query=q,
        category=category,
        min_price=min_price,
        max_price=max_price,
        in_stock_only=in_stock_only,
        sort_by=sort_by,
    )
    return APIResponse(
        success=True,
        message="Search completed successfully",
        data=search_result,
    )


@router.get("/suggestions", response_model=APIResponse[SuggestionsResponse])
async def get_search_suggestions(
    q: str = Query(..., min_length=1, description="Partial search query"),
    limit: int = Query(5, ge=1, le=20, description="Max suggestions to return"),
) -> Any:
    """Fast auto-complete search query suggestions."""
    suggestions = await product_crud.get_suggestions(query=q, limit=limit)
    return APIResponse(
        success=True,
        message="Search suggestions generated",
        data=suggestions,
    )


@router.get("/", response_model=APIResponse[List[ProductResponse]])
async def list_products(
    category: Optional[ProductCategory] = None,
    search: Optional[str] = Query(None, description="Search product by name"),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """List and filter products by category or name search (Public/User access)."""
    products = await product_crud.get_multi(
        category=category, search=search, skip=skip, limit=limit
    )
    return APIResponse(
        success=True,
        message="Products retrieved successfully",
        data=[ProductResponse.model_validate(p) for p in products],
    )


@router.get("/{product_id}", response_model=APIResponse[ProductResponse])
async def get_product_by_id(product_id: str) -> Any:
    """Get single product detail by ID."""
    product = await product_crud.get_by_id(product_id)
    if not product:
        raise NotFoundException("Product not found")
    return APIResponse(
        success=True,
        message="Product details fetched",
        data=ProductResponse.model_validate(product),
    )


@router.post("/", response_model=APIResponse[ProductResponse], status_code=status.HTTP_201_CREATED)
async def create_product(
    product_in: ProductCreate,
    current_admin: Any = Depends(get_current_admin),
) -> Any:
    """Create a new product or service item (Admin required)."""
    product = await product_crud.create(product_in)
    return APIResponse(
        success=True,
        message="Product created successfully",
        data=ProductResponse.model_validate(product),
    )


@router.post("/{product_id}/upload-image", response_model=APIResponse[ProductResponse])
async def upload_product_image(
    product_id: str,
    image: UploadFile = File(..., description="Product image file (.jpg, .jpeg, .png, .webp)"),
    current_admin: Any = Depends(get_current_admin),
) -> Any:
    """Upload product image file for an existing product (Admin required)."""
    product = await product_crud.get_by_id(product_id)
    if not product:
        raise NotFoundException("Product not found")

    image_url = save_upload_image(file=image, product_id=str(product.id))
    updated_product = await product_crud.update(
        db_obj=product, obj_in=ProductUpdate(image_url=image_url)
    )
    return APIResponse(
        success=True,
        message="Product image uploaded successfully",
        data=ProductResponse.model_validate(updated_product),
    )


@router.post("/with-image", response_model=APIResponse[ProductResponse], status_code=status.HTTP_201_CREATED)
async def create_product_with_image(
    name: str = Form(...),
    category: ProductCategory = Form(...),
    price: float = Form(..., ge=0.0),
    description: Optional[str] = Form(None),
    unit: str = Form("item"),
    stock_quantity: int = Form(100, ge=0),
    is_available: bool = Form(True),
    image: Optional[UploadFile] = File(None),
    current_admin: Any = Depends(get_current_admin),
) -> Any:
    """Create a new product with image upload in a single multipart request (Admin required)."""
    product_in = ProductCreate(
        name=name,
        category=category,
        price=price,
        description=description,
        unit=unit,
        stock_quantity=stock_quantity,
        is_available=is_available,
    )
    product = await product_crud.create(product_in)

    if image:
        image_url = save_upload_image(file=image, product_id=str(product.id))
        product = await product_crud.update(
            db_obj=product, obj_in=ProductUpdate(image_url=image_url)
        )

    return APIResponse(
        success=True,
        message="Product created with image successfully",
        data=ProductResponse.model_validate(product),
    )


@router.put("/{product_id}", response_model=APIResponse[ProductResponse])
async def update_product(
    product_id: str,
    product_in: ProductUpdate,
    current_admin: Any = Depends(get_current_admin),
) -> Any:
    """Update existing product details (Admin required)."""
    product = await product_crud.get_by_id(product_id)
    if not product:
        raise NotFoundException("Product not found")
    updated_product = await product_crud.update(product, product_in)
    return APIResponse(
        success=True,
        message="Product updated successfully",
        data=ProductResponse.model_validate(updated_product),
    )


@router.delete("/{product_id}", response_model=APIResponse[dict])
async def delete_product(
    product_id: str,
    current_admin: Any = Depends(get_current_admin),
) -> Any:
    """Delete a product item from catalog (Admin required)."""
    product = await product_crud.get_by_id(product_id)
    if not product:
        raise NotFoundException("Product not found")
    await product_crud.delete(product)
    return APIResponse(
        success=True,
        message="Product deleted successfully",
        data={"product_id": product_id, "status": "deleted"},
    )

