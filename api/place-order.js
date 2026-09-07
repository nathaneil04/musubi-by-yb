import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { customerName, customerEmail, orderType, items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const totalAmount = items.reduce((sum, item) => sum + item.price * item.qty, 0);

    // Atomic transaction inserting the order and all cart line items
    const statements = [
      {
        sql: `INSERT INTO orders (id, customer_name, customer_email, order_type, total_amount) VALUES (?, ?, ?, ?, ?)`,
        args: [orderId, customerName || 'Guest Buyer', customerEmail || '', orderType || 'Takeout', totalAmount],
      },
      ...items.map((item) => ({
        sql: `INSERT INTO order_items (order_id, product_name, quantity, unit_price) VALUES (?, ?, ?, ?)`,
        args: [orderId, item.name, item.qty, item.price],
      })),
    ];

    await client.batch(statements, 'write');

    return res.status(200).json({ success: true, orderId, totalAmount });
  } catch (error) {
    console.error('Turso Order Error:', error);
    return res.status(500).json({ error: 'Failed to process order' });
  }
}
