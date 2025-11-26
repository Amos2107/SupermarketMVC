const db = require('../db');

const OrderController = {

  // ✅ User places checkout
  checkout(req, res) {
    const userId = req.session.user.id;

    // 1️⃣ Find active cart
    db.query(
      `SELECT id FROM cart WHERE userId = ? AND status = 'active'`,
      [userId],
      (err, results) => {
        if (err) throw err;

        if (results.length === 0) {
          req.flash('error', 'No active cart to checkout.');
          return res.redirect('/cart');
        }

        const cartId = results[0].id;

        // 2️⃣ Calculate total
        db.query(
          `SELECT SUM(quantity * priceAtTime) AS total
           FROM cart_items
           WHERE cartId = ?`,
          [cartId],
          (err, totalResult) => {
            if (err) throw err;

            const totalAmount = totalResult[0].total || 0;

            // 3️⃣ Create order
            db.query(
              `INSERT INTO orders (userId, totalAmount)
               VALUES (?, ?)`,
              [userId, totalAmount],
              (err, orderResult) => {
                if (err) throw err;

                const orderId = orderResult.insertId;

                // 4️⃣ Copy items into order_items
                db.query(
                  `INSERT INTO order_items (orderId, productId, quantity, priceAtTime)
                   SELECT ?, productId, quantity, priceAtTime
                   FROM cart_items
                   WHERE cartId = ?`,
                  [orderId, cartId],
                  (err) => {
                    if (err) throw err;

                    // 5️⃣ Mark cart as checked out
                    db.query(
                      `UPDATE cart SET status='checkedout' WHERE id = ?`,
                      [cartId]
                    );

                    // 6️⃣ Create new empty cart
                    db.query(
                      `INSERT INTO cart (userId) VALUES (?)`,
                      [userId]
                    );

                    req.flash('success', 'Order placed successfully!');
                    res.redirect('/orders');
                  }
                );
              }
            );
          }
        );
      }
    );
  },

  // ✅ User sees their own orders
  getUserOrders(req, res) {
    const userId = req.session.user.id;

    db.query(
      `SELECT id, totalAmount, created_at
       FROM orders
       WHERE userId = ?
       ORDER BY created_at DESC`,
      [userId],
      (err, orders) => {
        if (err) throw err;

        res.render('orders', { orders });
      }
    );
  },

  // ✅ Admin sees all orders
  getAllOrders(req, res) {
    db.query(
      `SELECT o.id, o.totalAmount, o.created_at, u.username
       FROM orders o
       JOIN users u ON o.userId = u.id
       ORDER BY o.created_at DESC`,
      (err, orders) => {
        if (err) throw err;

        res.render('adminOrders', { orders });
      }
    );
  },

  // ✅ View single order details
  getOrderDetails(req, res) {
    const orderId = req.params.id;

    db.query(
      `SELECT * FROM orders WHERE id = ?`,
      [orderId],
      (err, orderResult) => {
        if (err) throw err;

        if (orderResult.length === 0) return res.redirect('/orders');

        const order = orderResult[0];

        db.query(
          `SELECT oi.quantity, oi.priceAtTime, p.productName, p.image
           FROM order_items oi
           JOIN products p ON oi.productId = p.id
           WHERE oi.orderId = ?`,
          [orderId],
          (err, items) => {
            if (err) throw err;

            res.render('orderDetails', {
              order,
              items
            });
          }
        );
      }
    );
  }
};

module.exports = OrderController;
