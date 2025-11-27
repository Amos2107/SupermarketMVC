const db = require('../db');

const OrderController = {

  // USER – View their own orders
  myOrders(req, res) {
    const userId = req.session.user.id;

    db.query(
      `SELECT id, total AS totalAmount, created_at
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

  // ADMIN – View ALL orders
  adminOrders(req, res) {
    db.query(
      `SELECT o.id, o.total AS totalAmount, o.created_at, u.username
       FROM orders o
       JOIN users u ON o.userId = u.id
       ORDER BY o.created_at DESC`,
      (err, orders) => {
        if (err) throw err;
        res.render('adminOrders', { orders });
      }
    );
  },

  // CHECKOUT – Convert cart into an order
  checkout(req, res) {
    const userId = req.session.user.id;

    // 1. Find active cart
    db.query(
      `SELECT id FROM cart
       WHERE userId = ? AND status = 'active'
       LIMIT 1`,
      [userId],
      (err, result) => {
        if (err) throw err;

        if (result.length === 0) {
          req.flash('error', 'No items to checkout.');
          return res.redirect('/cart');
        }

        const cartId = result[0].id;

        // 2a. Validate stock for each item before proceeding
        db.query(
          `SELECT ci.productId,
                  ci.quantity    AS cartQty,
                  p.quantity     AS stock,
                  p.productName
           FROM cart_items ci
           JOIN products p ON ci.productId = p.id
           WHERE ci.cartId = ?`,
          [cartId],
          (stockErr, cartItems) => {
            if (stockErr) throw stockErr;

            if (!cartItems || cartItems.length === 0) {
              req.flash('error', 'No items to checkout.');
              return res.redirect('/cart');
            }

            const insufficient = cartItems.find((item) => item.cartQty > item.stock);
            if (insufficient) {
              req.flash(
                'error',
                `Not enough stock for ${insufficient.productName}. Available: ${insufficient.stock}.`
              );
              return res.redirect('/cart');
            }

            // 2b. Calculate total
            db.query(
              `SELECT SUM(quantity * priceAtTime) AS total
               FROM cart_items
               WHERE cartId = ?`,
              [cartId],
              (err, totalResult) => {
                if (err) throw err;

                const totalAmount = totalResult[0].total || 0;

                // 3. Create order record
                db.query(
                  `INSERT INTO orders (userId, total)
                   VALUES (?, ?)`,
                  [userId, totalAmount],
                  (err, orderInsert) => {
                    if (err) throw err;

                    const orderId = orderInsert.insertId;

                    // 4. Copy items to order_items
                    db.query(
                      `INSERT INTO order_items (orderId, productId, quantity, priceAtTime)
                       SELECT ?, productId, quantity, priceAtTime
                       FROM cart_items
                       WHERE cartId = ?`,
                      [orderId, cartId],
                      (err) => {
                        if (err) throw err;

                        // 5. Reduce inventory stock (after validation; no clamping)
                        db.query(
                          `UPDATE products p
                           JOIN cart_items ci ON ci.productId = p.id
                           SET p.quantity = p.quantity - ci.quantity
                           WHERE ci.cartId = ?`,
                          [cartId],
                          (err) => {
                            if (err) throw err;

                            // 6. Mark cart as checked out
                            db.query(
                              `UPDATE cart SET status = 'checkedout'
                               WHERE id = ?`,
                              [cartId]
                            );

                            req.flash('success', 'Order placed successfully!');
                            res.redirect(`/orders/${orderId}`);
                          }
                        );
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    );
  },

  // ORDER DETAILS PAGE
  orderDetails(req, res) {
    const orderId = req.params.id;

    db.query(
      `SELECT o.id, o.total AS totalAmount, o.created_at, u.username
       FROM orders o
       JOIN users u ON o.userId = u.id
       WHERE o.id = ?`,
      [orderId],
      (err, orderData) => {
        if (err) throw err;

        db.query(
          `SELECT oi.quantity, oi.priceAtTime, p.productName, p.image
           FROM order_items oi
           JOIN products p ON oi.productId = p.id
           WHERE oi.orderId = ?`,
          [orderId],
          (err, items) => {
            if (err) throw err;

            res.render('orderDetails', {
              order: orderData[0],
              items
            });
          }
        );
      }
    );
  }
};

module.exports = OrderController;
