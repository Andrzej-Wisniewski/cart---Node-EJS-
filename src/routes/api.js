import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

// GET /api/products
router.get('/products', async (req, res) => {
  try {
    const products = await db.all('SELECT * FROM products');
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch products' });
  }
});

// POST /api/products
router.post('/products', async (req, res) => {
  try {
    const { name, price } = req.body || {};
    if (!name || Number.isNaN(Number(price)) || Number(price) < 0) {
      return res.status(400).json({ message: 'Invalid name or price' });
    }
    const result = await db.run(
      'INSERT INTO products(name,price) VALUES (?,?)',
      [name, Number(price)]
    );
    res.status(201).json({ id: result.lastID, name, price: Number(price) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not create product' });
  }
});

// GET /api/cart
router.get('/cart', (req, res) => {
  try {
    if (!req.cart) req.cart = {};
    res.json(req.cart);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Could not fetch cart' });
  }
});

// POST /api/cart/add
router.post('/cart/add', async (req, res) => {
  try {
    const productId = String(req.body.product_id || req.body.productId);
    let qty = parseInt(req.body.qty || 1);
    if (!Number.isFinite(qty) || qty < 1)
      return res.status(400).json({ message: 'qty must be > 0' });

    const product = await db.get('SELECT id FROM products WHERE id = ?', [
      productId,
    ]);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    req.cart[productId] = (req.cart[productId] || 0) + qty;
    req.saveCart();

    res.json(req.cart);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not add item to cart' });
  }
});

// PATCH /api/cart/item
router.patch('/cart/item', async (req, res) => {
  try {
    const productId = String(req.body.product_id || req.body.productId);
    const qty = parseInt(req.body.qty);
    if (!Number.isFinite(qty) || qty < 1)
      return res.status(400).json({ message: 'qty must be > 0' });

    if (!req.cart[productId])
      return res.status(404).json({ message: 'Item not in cart' });

    req.cart[productId] = qty;
    req.saveCart();
    res.json(req.cart);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not update cart item' });
  }
});

// DELETE /api/cart/item/:product_id
router.delete('/cart/item/:product_id', (req, res) => {
  try {
    const id = String(req.params.product_id);
    if (!req.cart[id])
      return res.status(404).json({ message: 'Item not in cart' });
    delete req.cart[id];
    req.saveCart();
    res.json(req.cart);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not delete cart item' });
  }
});

// POST /api/cart/apply-coupon
router.post('/cart/apply-coupon', async (req, res) => {
  try {
    const code = (req.body.code || '').toString().trim();
    if (!code) return res.status(400).json({ message: 'No code provided' });

    const row = await db.get('SELECT percent FROM coupons WHERE code = ?', [
      code,
    ]);
    if (!row) return res.status(404).json({ message: 'Coupon not found' });

    req.cart.coupon = row.percent;
    req.saveCart();
    res.json({ message: `Coupon applied: ${row.percent}%` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not apply coupon' });
  }
});

// POST /api/checkout
router.post('/checkout', async (req, res) => {
  if (!req.cart || Object.keys(req.cart).length === 0) {
    return res.status(400).json({ message: 'Cart empty' });
  }

  const entries = Object.entries(req.cart).filter(([k]) => k !== 'coupon');

  try {
    await db.exec('BEGIN TRANSACTION');

    const now = new Date().toISOString();
    const orderRes = await db.run('INSERT INTO orders(created_at) VALUES (?)', [
      now,
    ]);
    const orderId = orderRes.lastID;

    let total = 0;
    for (const [productId, qty] of entries) {
      const product = await db.get(
        'SELECT id, price, name FROM products WHERE id = ?',
        [productId]
      );
      if (!product) throw new Error('Product not found during checkout');

      const priceSnapshot = product.price;
      const q = Number(qty);
      total += priceSnapshot * q;

      await db.run(
        'INSERT INTO order_items(order_id, product_id, qty, price) VALUES (?,?,?,?)',
        [orderId, Number(productId), q, priceSnapshot]
      );
    }

    if (req.cart.coupon) {
      const discount = (req.cart.coupon / 100) * total;
      total -= discount;
    }

    await db.exec('COMMIT');

    req.cart = {};
    req.saveCart();

    res
      .status(201)
      .json({ order_id: orderId, total: Number(total.toFixed(2)) });
  } catch (err) {
    await db.exec('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Checkout failed' });
  }
});

// GET /api/orders
router.get('/orders', async (req, res) => {
  try {
    const orders = await db.all(`
      SELECT o.id, o.created_at,
        SUM(oi.qty * oi.price) AS subtotal
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      GROUP BY o.id
      ORDER BY o.id DESC
    `);
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not fetch orders' });
  }
});

// GET /api/orders/:id
router.get('/orders/:id', async (req, res) => {
  try {
    const orderId = req.params.id;

    const order = await db.get('SELECT * FROM orders WHERE id = ?', [orderId]);

    if (!order) return res.status(404).json({ error: 'Order not found' });

    const items = await db.all(
      `SELECT oi.qty, oi.price, p.name
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
      [orderId]
    );

    const total = items.reduce((sum, i) => sum + i.qty * i.price, 0);

    res.json({ order, items, total: Number(total.toFixed(2)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not fetch order details' });
  }
});

export default router;
