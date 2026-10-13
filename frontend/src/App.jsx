import { useEffect, useState } from "react";

const API = "http://127.0.0.1:8000";

const productImages = {

  "Slim Fit Denim Jeans":
    "https://images.unsplash.com/photo-1542272604-787c3835535d?w=700",
  "Casual Baseball Cap":
    "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=700",
  "Classic women's Handbag":
    "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=700",
  "Floral Summer Dress":
    "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600",
  "Classic White T-Shirt":
    "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=700",
  "Casual Denim Jacket":
    "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=600",
  "Everyday Sneakers":
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=700",
  "Minimal Wrist Watch":
    "https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=700",
  "Premium Pullover Hoodie":
    "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=700",
};

const fallbackImage =
  "https://placehold.co/600x400?text=StyleHub";

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("stylehub_token");

  const headers = {
    ...(options.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { detail: text };
  }

  if (!response.ok) {
    throw new Error(
      data.detail || data.message || `Request failed (${response.status})`
    );
  }

  return data;
}

function getImage(product) {
  return (
    product.image ||
    productImages[product.name] ||
    fallbackImage
  );
}

function getCartItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.cart_items)) return data.cart_items;
  return [];
}

function getOrders(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.orders)) return data.orders;
  return [];
}

export default function App() {
  const [page, setPage] = useState("shop");
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [token, setToken] = useState(
    () => localStorage.getItem("stylehub_token") || ""
  );

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState("login");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (token) {
      loadCart();
      loadOrders();
    } else {
      setCart([]);
      setOrders([]);
    }
  }, [token]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.has("session_id") || params.has("payment")) {
      setMessage(
        "Returned from checkout. Your order status will update after Stripe confirms payment."
      );
      setPage("orders");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function loadProducts() {
    try {
      setLoading(true);
      const data = await apiRequest("/products/");
      setProducts(Array.isArray(data) ? data : data.products || []);
    } catch (err) {
      setError(`Could not load products: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadCart() {
    if (!localStorage.getItem("stylehub_token")) return;

    try {
      const data = await apiRequest("/cart/");
      setCart(getCartItems(data));
    } catch (err) {
      setError(`Could not load cart: ${err.message}`);
    }
  }

  async function loadOrders() {
    if (!localStorage.getItem("stylehub_token")) return;

    try {
      const data = await apiRequest("/orders/");
      setOrders(getOrders(data));
    } catch (err) {
      setError(`Could not load orders: ${err.message}`);
    }
  }

  async function handleAuth(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (authMode === "register") {
        await apiRequest("/auth/register", {
          method: "POST",
          body: JSON.stringify({ name, email, password }),
        });

        setMessage("Registration successful. Please log in.");
        setAuthMode("login");
      } else {
        const form = new URLSearchParams();
        form.append("username", email);
        form.append("password", password);

        let data;

        try {
          const response = await fetch(`${API}/auth/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: form,
          });

          data = await response.json();

          if (!response.ok) {
            throw new Error(data.detail || "Login failed");
          }
        } catch {
          data = await apiRequest("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
          });
        }

        const newToken =
          data.access_token || data.token || data.access;

        if (!newToken) {
          throw new Error("The login response did not contain a token.");
        }

        localStorage.setItem("stylehub_token", newToken);
        setToken(newToken);
        setMessage("Login successful!");
        setPage("shop");
        setPassword("");
      }
    } catch (err) {
      setError(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  async function addToCart(product) {
    if (!token) {
      setError("Please log in before adding products to your cart.");
      setPage("auth");
      return;
    }

    setError("");
    setMessage("");

    try {
      await apiRequest("/cart/", {
        method: "POST",
        body: JSON.stringify({
          product_id: product.id,
          quantity: 1,
        }),
      });

      await loadCart();
      setMessage(`${product.name} added to cart.`);
    } catch (err) {
      setError(`Could not add product: ${err.message}`);
    }
  }

  async function updateQuantity(item, quantity) {
    if (quantity < 1) {
      return removeFromCart(item);
    }

    try {
      await apiRequest(`/cart/${item.id ?? item.cart_id}`, {
        method: "PUT",
        body: JSON.stringify({ quantity }),
      });

      await loadCart();
    } catch (err) {
      setError(`Could not update quantity: ${err.message}`);
    }
  }

  async function removeFromCart(item) {
    try {
      await apiRequest(`/cart/${item.id ?? item.cart_id}`, {
        method: "DELETE",
      });

      await loadCart();
      setMessage("Item removed from cart.");
    } catch (err) {
      setError(`Could not remove item: ${err.message}`);
    }
  }

  const cartTotal = cart.reduce((total, item) => {
    const price = Number(item.product?.price ?? item.price ?? 0);
    const quantity = Number(item.quantity ?? 1);
    return total + price * quantity;
  }, 0);

  async function handleCheckout() {
    if (!token) {
      setError("Please log in before making a payment.");
      setPage("auth");
      return;
    }

    if (cart.length === 0) {
      setError("Your cart is empty. Add a product first.");
      setPage("shop");
      return;
    }

    setError("");
    setMessage("");
    setLoading(true);

    try {
      const order = await apiRequest("/orders/", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const orderId = order.id ?? order.order_id;

      if (!orderId) {
        throw new Error(
          "Order ID missing. Check the response from POST /orders/ in Swagger."
        );
      }

      const payment = await apiRequest(
        `/orders/${orderId}/checkout`,
        { method: "POST" }
      );

      const checkoutUrl =
        payment.checkout_url ||
        payment.session_url ||
        payment.url;

      if (!checkoutUrl) {
        throw new Error(
          "Stripe checkout URL missing in the backend response."
        );
      }

      window.location.assign(checkoutUrl);
    } catch (err) {
      setError(`Payment could not start: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("stylehub_token");
    setToken("");
    setCart([]);
    setOrders([]);
    setPage("shop");
    setMessage("You have logged out.");
    setError("");
  }

  const styles = `
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, sans-serif; background: #f8f7f5; color: #222; }
    button, input { font: inherit; }
    button { cursor: pointer; }
    .header { background: #fff; padding: 18px 5%; display: flex; justify-content: space-between; align-items: center; gap: 14px; flex-wrap: wrap; border-bottom: 1px solid #eee; }
    .brand { font-size: 27px; font-weight: 800; letter-spacing: 1px; color: #171717; }
    .nav { display: flex; gap: 8px; flex-wrap: wrap; }
    .nav button, .btn { border: 0; border-radius: 7px; padding: 11px 15px; background: #222; color: #fff; }
    .nav button.active { background: #b85d48; }
    .container { max-width: 1200px; margin: auto; padding: 28px 5%; }
    .hero { padding: 35px 25px; background: #efe4dc; border-radius: 14px; margin-bottom: 28px; }
    .hero h1 { margin: 0 0 10px; font-size: clamp(28px, 4vw, 42px); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 22px; }
    .card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 3px 14px #0000000b; }
    .product-image { width: 100%; height: 250px; object-fit: cover; background: #eee; display: block; }
    .card-body { padding: 16px; }
    .card h3 { margin: 0 0 8px; }
    .price { font-size: 19px; font-weight: bold; margin: 12px 0; }
    .btn { display: inline-block; }
    .btn:disabled { opacity: .6; cursor: not-allowed; }
    .panel { background: #fff; padding: 22px; border-radius: 12px; margin-bottom: 20px; }
    .form { max-width: 460px; margin: 20px auto; }
    .form input { width: 100%; padding: 12px; border: 1px solid #ccc; border-radius: 7px; margin: 7px 0 15px; }
    .alert { padding: 12px 15px; border-radius: 8px; margin-bottom: 15px; overflow-wrap: anywhere; }
    .success { background: #e6f5e9; color: #205c2c; }
    .danger { background: #ffeded; color: #8b2222; }
    .cart-row { display: flex; align-items: center; gap: 15px; border-bottom: 1px solid #eee; padding: 15px 0; }
    .cart-row img { width: 85px; height: 85px; object-fit: cover; border-radius: 8px; }
    .cart-info { flex: 1; }
    .quantity { display: flex; align-items: center; gap: 9px; margin-top: 8px; }
    .quantity button { border: 1px solid #ddd; background: white; padding: 5px 10px; border-radius: 5px; }
    .total { font-size: 23px; font-weight: bold; text-align: right; margin: 22px 0; }
    .order { border: 1px solid #eee; border-radius: 9px; padding: 16px; margin: 12px 0; }
    .status { display: inline-block; padding: 5px 10px; border-radius: 20px; background: #f3ead9; font-size: 13px; }
    .muted { color: #666; }
    footer { text-align: center; padding: 28px; color: #777; }
    @media (max-width: 600px) {
      .header { align-items: flex-start; }
      .nav { width: 100%; }
      .nav button { flex: 1; padding: 10px 8px; }
      .cart-row { align-items: flex-start; flex-wrap: wrap; }
      .total { text-align: left; }
    }
  `;

  return (
    <>
      <style>{styles}</style>

      <header className="header">
        <div className="brand">STYLEHUB</div>

        <nav className="nav">
          <button
            className={page === "shop" ? "active" : ""}
            onClick={() => setPage("shop")}
          >
            Shop
          </button>

          <button
            className={page === "cart" ? "active" : ""}
            onClick={() => {
              setPage("cart");
              if (token) loadCart();
            }}
          >
            Cart ({cart.length})
          </button>

          <button
            className={page === "orders" ? "active" : ""}
            onClick={() => {
              setPage("orders");
              if (token) loadOrders();
            }}
          >
            My Orders
          </button>

          {!token ? (
            <button
              className={page === "auth" ? "active" : ""}
              onClick={() => setPage("auth")}
            >
              Login / Register
            </button>
          ) : (
            <button onClick={logout}>Logout</button>
          )}
        </nav>
      </header>

      <main className="container">
        {message && (
          <div className="alert success">
            {message}
            <button
              onClick={() => setMessage("")}
              style={{ float: "right", border: 0, background: "transparent" }}
            >
              ×
            </button>
          </div>
        )}

        {error && (
          <div className="alert danger">
            {error}
            <button
              onClick={() => setError("")}
              style={{ float: "right", border: 0, background: "transparent" }}
            >
              ×
            </button>
          </div>
        )}

        {page === "shop" && (
          <>
            <section className="hero">
              <h1>Discover Your Style</h1>
              <p>
                Explore everyday fashion, footwear, and accessories at StyleHub.
              </p>
              <button className="btn" onClick={() =>
                document.getElementById("products")?.scrollIntoView({ behavior: "smooth" })
              }>
                Shop Now
              </button>
            </section>

            <h2 id="products">Our Products</h2>

            {loading && <p>Loading products...</p>}

            {!loading && products.length === 0 && (
              <div className="panel">
                No products found. Check that your FastAPI backend is running
                and that GET /products/ returns products.
              </div>
            )}

            <div className="grid">
              {products.map((product) => (
                <article className="card" key={product.id}>
                  <img
                    className="product-image"
                    src={getImage(product)}
                    alt={product.name}
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = fallbackImage;
                    }}
                  />

                  <div className="card-body">
                    <h3>{product.name}</h3>
                    <p className="muted">
                      {product.description || "A great addition to your wardrobe."}
                    </p>
                    <div className="price">
                      ₹{Number(product.price || 0).toLocaleString("en-IN")}
                    </div>
                    <p className="muted">
                      {Number(product.stock ?? 0) > 0
                        ? `In stock: ${product.stock}`
                        : "Stock availability: check with store"}
                    </p>
                    <button
                      className="btn"
                      onClick={() => addToCart(product)}
                    >
                      Add to Cart
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {page === "auth" && (
          <section className="panel form">
            <h2>{authMode === "login" ? "Welcome Back" : "Create an Account"}</h2>
            <p className="muted">
              {authMode === "login"
                ? "Log in to manage your cart and orders."
                : "Register to start shopping with StyleHub."}
            </p>

            <form onSubmit={handleAuth}>
              {authMode === "register" && (
                <>
                  <label htmlFor="name">Full Name</label>
                  <input
                    id="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Enter your name"
                    required
                  />
                </>
              )}

              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />

              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
                required
              />

              <button className="btn" type="submit" disabled={loading}>
                {loading
                  ? "Please wait..."
                  : authMode === "login"
                    ? "Login"
                    : "Register"}
              </button>
            </form>

            <p>
              {authMode === "login"
                ? "Don't have an account?"
                : "Already have an account?"}{" "}
              <button
                onClick={() =>
                  setAuthMode(authMode === "login" ? "register" : "login")
                }
                style={{
                  border: 0,
                  background: "transparent",
                  color: "#a14b38",
                  textDecoration: "underline",
                }}
              >
                {authMode === "login" ? "Register here" : "Login here"}
              </button>
            </p>
          </section>
        )}

        {page === "cart" && (
          <>
            <h2>Your Shopping Cart</h2>

            {!token && (
              <div className="panel">
                Please <button className="btn" onClick={() => setPage("auth")}>log in</button> to view your cart.
              </div>
            )}

            {token && cart.length === 0 && (
              <div className="panel">
                Your cart is empty.
                <p><button className="btn" onClick={() => setPage("shop")}>Continue Shopping</button></p>
              </div>
            )}

            {token && cart.length > 0 && (
              <section className="panel">
                {cart.map((item) => {
                  const product = item.product || item;
                  const quantity = Number(item.quantity || 1);
                  const price = Number(product.price || item.price || 0);

                  return (
                    <div className="cart-row" key={item.id ?? item.cart_id}>
                      <img
                        src={getImage(product)}
                        alt={product.name || "StyleHub product"}
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = fallbackImage;
                        }}
                      />

                      <div className="cart-info">
                        <strong>{product.name || `Product ${item.product_id}`}</strong>
                        <p>₹{price.toLocaleString("en-IN")} each</p>

                        <div className="quantity">
                          <button onClick={() => updateQuantity(item, quantity - 1)}>−</button>
                          <span>{quantity}</span>
                          <button onClick={() => updateQuantity(item, quantity + 1)}>+</button>
                          <button onClick={() => removeFromCart(item)}>Remove</button>
                        </div>
                      </div>

                      <strong>
                        ₹{(price * quantity).toLocaleString("en-IN")}
                      </strong>
                    </div>
                  );
                })}

                <div className="total">
                  Total: ₹{cartTotal.toLocaleString("en-IN")}
                </div>

                <div style={{ textAlign: "right" }}>
                  <button
                    className="btn"
                    onClick={handleCheckout}
                    disabled={loading}
                  >
                    {loading ? "Connecting to Stripe..." : "Proceed to Payment"}
                  </button>
                </div>

                <p className="muted">
                  Payments are handled by Stripe Checkout in test mode when configured.
                </p>
              </section>
            )}
          </>
        )}

        {page === "orders" && (
          <>
            <h2>My Orders</h2>

            {!token && (
              <div className="panel">
                Please log in to see your orders.
                <p><button className="btn" onClick={() => setPage("auth")}>Login</button></p>
              </div>
            )}

            {token && (
              <>
                <button className="btn" onClick={loadOrders}>Refresh Orders</button>

                {orders.length === 0 && (
                  <div className="panel" style={{ marginTop: 18 }}>
                    No orders found yet.
                  </div>
                )}

                {orders.map((order) => (
                  <article className="order" key={order.id ?? order.order_id}>
                    <h3>Order #{order.id ?? order.order_id}</h3>
                    <p>
                      Status:{" "}
                      <span className="status">
                        {String(order.status || "PENDING").toUpperCase()}
                      </span>
                    </p>
                    {order.total_amount != null && (
                      <p>
                        Total: ₹{Number(order.total_amount).toLocaleString("en-IN")}
                      </p>
                    )}
                    {order.created_at && (
                      <p className="muted">
                        Date: {new Date(order.created_at).toLocaleString()}
                      </p>
                    )}
                    {Array.isArray(order.items) && order.items.map((item, index) => (
                      <p key={item.id ?? index}>
                        {item.product?.name || item.product_name || `Product ${item.product_id}`}
                        {" "}× {item.quantity}
                      </p>
                    ))}
                  </article>
                ))}
              </>
            )}
          </>
        )}
      </main>

      <footer>
        © {new Date().getFullYear()} StyleHub Fashion Mini Store
      </footer>
    </>
  );
}