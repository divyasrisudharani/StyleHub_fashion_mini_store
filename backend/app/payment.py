import os
from pathlib import Path
import stripe

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")

STRIPE_WEBHOOK_SECRET =os.getenv("STRIPE_WEBHOOK_SECRET")
def create_checkout_session(
    order_id: int,
    total_amount: float,
    customer_email: str
):
    if not STRIPE_SECRET_KEY:
        raise RuntimeError("Stripe key is missing")

    stripe.api_key = STRIPE_SECRET_KEY

    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            customer_email=customer_email,
            line_items=[
                {
                    "price_data": {
                        "currency": "inr",
                        "product_data": {
                            "name": f"StyleHub Order #{order_id}"
                        },
                        "unit_amount": round(total_amount * 100),
                    },
                    "quantity": 1,
                }
            ],
            metadata={"order_id": str(order_id)},
            success_url=(
                "http://localhost:5173/payment-success"
                "?session_id={CHECKOUT_SESSION_ID}"
            ),
            cancel_url="http://localhost:5173/payment-cancelled",
        )

        return {
            "checkout_url": session.url,
            "session_id": session.id,
        }

    except stripe.InvalidRequestError as exc:
        print("Stripe message:", exc.user_message or str(exc))
        print("Stripe parameter:", exc.param)
        raise