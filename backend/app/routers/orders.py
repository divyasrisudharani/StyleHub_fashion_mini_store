from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Cart, Product, Order, OrderItem, User
from app.schemas import OrderResponse, OrderItemResponse
from app.dependencies import get_current_user
from app.payment import create_checkout_session


router = APIRouter(
    prefix="/orders",
    tags=["Orders"]
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Create an order from the logged-in user's cart
@router.post("/", response_model=OrderResponse)
def create_order(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cart_items = db.query(Cart).filter(
        Cart.user_id == current_user.id
    ).all()

    if not cart_items:
        raise HTTPException(
            status_code=400,
            detail="Your cart is empty"
        )

    total_amount = 0
    order_items_data = []

    for cart_item in cart_items:
        product = db.query(Product).filter(
            Product.id == cart_item.product_id
        ).first()

        if product is None:
            raise HTTPException(
                status_code=404,
                detail="Product not found"
            )

        if cart_item.quantity <= 0 or cart_item.quantity > product.stock:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {product.name}"
            )

        item_total = product.price * cart_item.quantity
        total_amount += item_total

        order_items_data.append({
            "product_id": product.id,
            "quantity": cart_item.quantity,
            "price": product.price
        })

    try:
        new_order = Order(
            user_id=current_user.id,
            total_amount=total_amount,
            status="PENDING",
            created_at=datetime.now(timezone.utc)
        )

        db.add(new_order)
        db.flush()

        for item in order_items_data:
            order_item = OrderItem(
                order_id=new_order.id,
                product_id=item["product_id"],
                quantity=item["quantity"],
                price=item["price"]
            )
            db.add(order_item)

        db.commit()
        db.refresh(new_order)

        return OrderResponse(
            id=new_order.id,
            total_amount=new_order.total_amount,
            status=new_order.status,
            created_at=new_order.created_at,
            items=[
                OrderItemResponse(
                    id=item.id,
                    product_id=item.product_id,
                    quantity=item.quantity,
                    price=item.price
                )
                for item in db.query(OrderItem).filter(
                    OrderItem.order_id == new_order.id
                ).all()
            ]
        )

    except Exception:
        db.rollback()
        raise
@router.get("/", response_model=list[OrderResponse])
def get_my_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    orders = db.query(Order).filter(
        Order.user_id == current_user.id
    ).order_by(Order.id.desc()).all()

    response = []

    for order in orders:
        items = db.query(OrderItem).filter(
            OrderItem.order_id == order.id
        ).all()

        response.append(
            OrderResponse(
                id=order.id,
                total_amount=order.total_amount,
                status=order.status,
                created_at=order.created_at,
                items=[
                    OrderItemResponse(
                        id=item.id,
                        product_id=item.product_id,
                        quantity=item.quantity,
                        price=item.price
                    )
                    for item in items
                ]
            )
        )

    return response
@router.post("/{order_id}/checkout")
def checkout_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == current_user.id
    ).first()

    if order is None:
        raise HTTPException(
            status_code=404,
            detail="Order not found"
        )

    if order.status != "PENDING":
        raise HTTPException(
            status_code=400,
            detail="Only pending orders can be paid"
        )

    try:
        session = create_checkout_session(
            order_id=order.id,
            total_amount=order.total_amount,
            customer_email=current_user.email
        )
    except Exception as exc:
        print("Stripe checkout error:", repr(exc))

        raise HTTPException(
        status_code=502,
        detail=f"Stripe error: {type(exc).__name__}"
    ) from exc
    return {
        "message": "Checkout session created",
        "order_id": order.id,
        "checkout_url": session["checkout_url"],
        "session_id": session["session_id"]
    }