from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Cart, Product, User
from app.schemas import CartCreate, CartUpdate, CartResponse
from app.dependencies import get_current_user


router = APIRouter(
    prefix="/cart",
    tags=["Cart"]
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Add product to cart
@router.post("/", response_model=CartResponse)
def add_to_cart(
    cart: CartCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = db.query(Product).filter(
        Product.id == cart.product_id
    ).first()

    if product is None:
        raise HTTPException(
            status_code=404,
            detail="Product not found"
        )

    if cart.quantity <= 0:
        raise HTTPException(
            status_code=400,
            detail="Quantity must be greater than 0"
        )

    if cart.quantity > product.stock:
        raise HTTPException(
            status_code=400,
            detail="Not enough stock available"
        )

    existing_cart = db.query(Cart).filter(
        Cart.user_id == current_user.id,
        Cart.product_id == cart.product_id
    ).first()

    if existing_cart:
        new_quantity = existing_cart.quantity + cart.quantity

        if new_quantity > product.stock:
            raise HTTPException(
                status_code=400,
                detail="Not enough stock available"
            )

        existing_cart.quantity = new_quantity
        db.commit()
        db.refresh(existing_cart)

        return CartResponse(
            id=existing_cart.id,
            product_id=product.id,
            quantity=existing_cart.quantity,
            product_name=product.name,
            price=product.price,
            total=product.price * existing_cart.quantity
        )

    new_cart = Cart(
        user_id=current_user.id,
        product_id=cart.product_id,
        quantity=cart.quantity
    )

    db.add(new_cart)
    db.commit()
    db.refresh(new_cart)

    return CartResponse(
        id=new_cart.id,
        product_id=product.id,
        quantity=new_cart.quantity,
        product_name=product.name,
        price=product.price,
        total=product.price * new_cart.quantity
    )


# View my cart
@router.get("/", response_model=list[CartResponse])
def get_my_cart(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cart_items = db.query(Cart).filter(
        Cart.user_id == current_user.id
    ).all()

    response = []

    for item in cart_items:
        product = db.query(Product).filter(
            Product.id == item.product_id
        ).first()

        if product:
            response.append(
                CartResponse(
                    id=item.id,
                    product_id=product.id,
                    quantity=item.quantity,
                    product_name=product.name,
                    price=product.price,
                    total=product.price * item.quantity
                )
            )

    return response


# Update cart quantity
@router.put("/{cart_id}", response_model=CartResponse)
def update_cart(
    cart_id: int,
    cart: CartUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cart_item = db.query(Cart).filter(
        Cart.id == cart_id,
        Cart.user_id == current_user.id
    ).first()

    if cart_item is None:
        raise HTTPException(
            status_code=404,
            detail="Cart item not found"
        )

    if cart.quantity <= 0:
        raise HTTPException(
            status_code=400,
            detail="Quantity must be greater than 0"
        )

    product = db.query(Product).filter(
        Product.id == cart_item.product_id
    ).first()

    if product is None:
        raise HTTPException(
            status_code=404,
            detail="Product not found"
        )

    if cart.quantity > product.stock:
        raise HTTPException(
            status_code=400,
            detail="Not enough stock available"
        )

    cart_item.quantity = cart.quantity

    db.commit()
    db.refresh(cart_item)

    return CartResponse(
        id=cart_item.id,
        product_id=product.id,
        quantity=cart_item.quantity,
        product_name=product.name,
        price=product.price,
        total=product.price * cart_item.quantity
    )


# Remove product from cart
@router.delete("/{cart_id}")
def remove_from_cart(
    cart_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cart_item = db.query(Cart).filter(
        Cart.id == cart_id,
        Cart.user_id == current_user.id
    ).first()

    if cart_item is None:
        raise HTTPException(
            status_code=404,
            detail="Cart item not found"
        )

    db.delete(cart_item)
    db.commit()

    return {
        "message": "Product removed from cart successfully"
    }