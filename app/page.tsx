const categories = ["Trending", "Home", "Beauty", "Electronics", "Kids", "Pets", "Fashion", "Auto"];

const products = [
  { name: "Portable mini label printer", price: "$14.99", badge: "Popular" },
  { name: "Rechargeable closet lights", price: "$11.49", badge: "Fast delivery" },
  { name: "Travel organization set", price: "$8.99", badge: "Best value" },
  { name: "Pet grooming brush", price: "$9.79", badge: "Top rated" },
  { name: "Magnetic phone stand", price: "$7.99", badge: "New" },
  { name: "Kitchen storage organizer", price: "$12.99", badge: "YOOOP pick" }
];

export default function Home() {
  return (
    <main>
      <header className="header">
        <a className="logo" href="#">YOOOP</a>
        <div className="searchWrap">
          <input aria-label="Search products" placeholder="Search everything..." />
          <button>Search</button>
        </div>
        <nav>
          <a href="#categories">Categories</a>
          <a href="#deals">Deals</a>
          <a href="#account">Account</a>
          <button className="cart">Cart · 0</button>
        </nav>
      </header>

      <section className="hero">
        <div>
          <span className="eyebrow">SMARTER SHOPPING STARTS HERE</span>
          <h1>Everything you want.<br />Without the markup.</h1>
          <p>Discover useful products, clear prices, and dependable delivery—all in one simple marketplace.</p>
          <div className="heroActions">
            <a className="primary" href="#deals">Shop today’s finds</a>
            <a className="secondary" href="#categories">Browse categories</a>
          </div>
          <div className="trustRow">
            <span>✓ Secure checkout</span>
            <span>✓ Order tracking</span>
            <span>✓ Easy support</span>
          </div>
        </div>
        <div className="heroCard">
          <span>YOOOP DEAL</span>
          <strong>Fresh finds<br />every day</strong>
          <p>Products selected for usefulness, value, and reliable fulfillment.</p>
          <div className="priceBubble">From $4.98</div>
        </div>
      </section>

      <section className="section" id="categories">
        <div className="sectionHeading">
          <div><span className="eyebrow">EXPLORE</span><h2>Shop by category</h2></div>
          <a href="#">View all →</a>
        </div>
        <div className="categoryGrid">
          {categories.map((category, index) => (
            <a className="category" href="#deals" key={category}>
              <span>{["✦", "⌂", "◇", "⌁", "★", "♢", "◌", "⚙"][index]}</span>
              <strong>{category}</strong>
            </a>
          ))}
        </div>
      </section>

      <section className="section" id="deals">
        <div className="sectionHeading">
          <div><span className="eyebrow">CURATED FOR YOU</span><h2>Today’s best finds</h2></div>
          <a href="#">See more →</a>
        </div>
        <div className="productGrid">
          {products.map((product, index) => (
            <article className="product" key={product.name}>
              <div className={`productImage productImage${index + 1}`}><span>{product.badge}</span></div>
              <div className="productInfo">
                <p>{product.name}</p>
                <div><strong>{product.price}</strong><button aria-label={`Add ${product.name} to cart`}>+</button></div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="promise">
        <div><span className="eyebrow">THE YOOOP PROMISE</span><h2>Shopping should feel easy.</h2></div>
        <div className="promiseGrid">
          <article><strong>01</strong><h3>Clear prices</h3><p>No confusing memberships or surprise markups.</p></article>
          <article><strong>02</strong><h3>Useful products</h3><p>A marketplace focused on items people actually want.</p></article>
          <article><strong>03</strong><h3>Real tracking</h3><p>Follow your order from checkout through delivery.</p></article>
        </div>
      </section>

      <footer>
        <a className="logo" href="#">YOOOP</a>
        <p>Better finds. Better prices. One simple marketplace.</p>
        <small>© 2026 YOOOP. All rights reserved.</small>
      </footer>
    </main>
  );
}
