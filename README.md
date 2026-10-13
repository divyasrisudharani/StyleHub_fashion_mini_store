StyleHub Fashion Mini Store

A fashion e-commerce web application built with React, FastAPI, SQLite, and Stripe Checkout (test mode).

Features

- User registration and login with JWT authentication
- Browse fashion products and view prices and stock
- Add, update, and remove cart items
- Place orders and view order history
- Stripe Checkout for test payments
- Payment confirmation using Stripe webhooks
- Automatic stock reduction after successful payment
- Cart clearing after successful payment

Technology Stack

Frontend

- React
- JavaScript
- HTML
- CSS
- Vite

Backend

- Python
- FastAPI
- SQLAlchemy
- SQLite
- JWT authentication
- Stripe Checkout

Project Structure

StyleHub/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── auth.py
│   │   ├── payment.py
│   │   └── routers/
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── package.json
│   └── src/
│       ├── App.jsx
│       ├── App.css
│       └── main.jsx
└── README.md

Run the Project

Backend

cd backend
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

API documentation: http://127.0.0.1:8000/docs

Frontend

Open a second terminal:

cd frontend
npm install
npm run dev

Open the local URL printed by Vite, usually http://localhost:5173.

Stripe Setup

1. Create a ".env" file inside "backend/".
2. Add your Stripe test secret key and webhook signing secret using the variable names expected by the application.
3. Configure Stripe CLI to forward "checkout.session.completed" events to "http://localhost:8000/webhook", matching the route in your backend.
4. Test payments using Stripe's test mode.

Security: Never commit ".env" files, secret keys, passwords, or real customer payment details. This project uses Stripe test mode; it is not a production payment system.

Screenshots

Project screenshots are included in the repository to demonstrate the shopping cart, checkout, orders, and payment flow.

