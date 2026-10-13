from pathlib import Path
from dotenv import load_dotenv
import os
import stripe

from fastapi import FastAPI, Request,HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import   CORSMiddleware
from app.database import Base, engine, SessionLocal
from app import models
from app.models import Order,Cart,OrderItem,Product
from app.routers import auth,products,cart,orders
# Load environment variables from backend/.env

from app.payment import STRIPE_WEBHOOK_SECRET
# Existing app setup continues below

load_dotenv()
app = FastAPI(
    title="StyleHub Fashion Mini Store",
    description="Backend API for StyleHub",
    version="1.0.0"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173" ,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.get("/")
def root():
    return {"message": "Welcome to StyleHub API"}
app.include_router(auth.router)
app.include_router(products.router)
app.include_router(cart.router)
app.include_router(orders.router)

# 
@app.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    signature = request.headers.get("stripe-signature")
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    if not webhook_secret or not signature:
        return JSONResponse(
            status_code=400,
            content={"detail": "Missing webhook configuration or signature"}
        )

    try:
        event = stripe.Webhook.construct_event(
            payload,
            signature,
            webhook_secret
        )
    except (ValueError, stripe.SignatureVerificationError):
        return JSONResponse(
            status_code=400,
            content={"detail": "Invalid webhook signature or payload"}
        )

    if event["type"] != "checkout.session.completed":
        return {"received": True}

    session = event["data"]["object"]

    # Process only successfully paid checkout sessions
    if session.payment_status != "paid":
        return {"received": True}

    metadata = session.metadata or {}
    order_id = metadata.order_id if metadata else None

    if not order_id:
        return JSONResponse(
            status_code=400,
            content={"detail": "Order ID missing from Stripe session"}
        )

    db = SessionLocal()

    try:
        order = (
            db.query(Order)
            .filter(Order.id == int(order_id))
            .with_for_update()
            .first()
        )

        if order is None:
            return JSONResponse(
                status_code=404,
                content={"detail": "Order not found"}
            )

        # Avoid deducting stock twice for an already-paid order
        if order.status == "PAID":
            return {"received": True, "status": "already_paid"}

        if order.status != "PENDING":
            return JSONResponse(
                status_code=400,
                content={"detail": "Order is not pending"}
            )

        items = (
            db.query(OrderItem)
            .filter(OrderItem.order_id == order.id)
            .all()
        )

        if not items:
            return JSONResponse(
                status_code=400,
                content={"detail": "Order has no items"}
            )

        # Validate all products before changing any stock
        products = []

        for item in items:
            product = (
                db.query(Product)
                .filter(Product.id == item.product_id)
                .with_for_update()
                .first()
            )

            if product is None or product.stock < item.quantity:
                return JSONResponse(
                    status_code=409,
                    content={
                        "detail": (
                            "Product unavailable or insufficient stock. "
                            "Payment needs reconciliation."
                        )
                    }
                )

            products.append((product, item.quantity))

        # Deduct stock after validation
        for product, quantity in products:
            product.stock -= quantity

        order.status = "PAID"

        # Clear only this user's cart
        db.query(Cart).filter(
            Cart.user_id == order.user_id
        ).delete(synchronize_session=False)

        db.commit()

        return {"received": True, "status": "PAID"}

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()