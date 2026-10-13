StyleHub Fashion Mini Store
Backend
cd backend
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

API documentation: http://127.0.0.1:8000/docs

Stripe Setup
1. Create a ".env" file inside "backend/".
2. Add your Stripe test secret key and webhook signing secret using the variable names expected by the application.
3. Configure Stripe CLI to forward "checkout.session.completed" events to "http://localhost:8000/webhook", matching the route in your backend.
4. Test payments using Stripe's test mode.

Security: Never commit ".env" files, secret keys, passwords, or real customer payment details. This project uses Stripe test mode; it is not a production payment system.

Screenshots

Project screenshots are included in the repository to demonstrate the shopping cart, checkout, orders, and payment flow.

