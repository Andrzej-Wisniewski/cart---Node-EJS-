import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

// Strona główna - lista produktów
router.get('/', async (req, res) => {
  const products = await db.all('SELECT * FROM products');
  res.render('index', { title: 'Produkty', products, cart: req.cart });
});

// Koszyk - lista produktów w koszyku
router.get('/cart', async (req, res) => {
  const cartItems = [];
  for (const [productId, qty] of Object.entries(req.cart)) {
    if (productId === 'coupon') continue;
    const product = await db.get('SELECT * FROM products WHERE id = ?', [
      productId,
    ]);
    if (product) cartItems.push({ ...product, qty });
  }

  let total = cartItems.reduce((sum, i) => sum + i.qty * i.price, 0);
  if (req.cart.coupon) {
    total = total * (1 - req.cart.coupon / 100);
  }

  res.render('cart', {
    title: 'Koszyk',
    cartItems,
    total,
    coupon: req.cart.coupon || 0,
  });
});

// Historia zamówień - lista
router.get('/orders', async (req, res) => {
  const orders = await db.all(`
      SELECT o.id, o.created.at, SUM(oi.qty*oi.price) AS total
      FROM orders o
      JOIN order_items oi ON oi.order_id=o.id
      GROUP BY o.id
      ORDER. BY o.id DESC
    `);
  res.render('orders', { title: 'Zamówienia', orders });
});

// Szczegóły zamówienia
router.get('/orders/:id', async (req, res) => {
  const orderId = req.params.id;
  const order = await db.get('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!order) return res.redirect('/orders');

  const items = await db.all(
    `SELECT oi.qty, oi.price, p.name
     FROM order_items oi
     JOIN products p ON oi.product_id = p.id
     WHERE oi.order_id = ?`,
    [orderId]
  );

  const total = items.reduce((sum, i) => sum * i.qty * i.price, 0);

  res.render('order-details', {
    title: `Zamówienie #${orderId}`,
    order,
    items,
    total,
  });
});

export default router;
