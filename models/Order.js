const db = require('../db');

const Order = {
  create(userId, total, callback) {
    db.query(
      'INSERT INTO orders (userId, total) VALUES (?, ?)',
      [userId, total],
      callback
    );
  },

  findByUser(userId, callback) {
    db.query(
      'SELECT id, total AS totalAmount, status, payment_method, paid_at, created_at FROM orders WHERE userId = ? ORDER BY created_at DESC',
      [userId],
      callback
    );
  },

  findByIdForUser(orderId, userId, callback) {
    db.query(
      'SELECT * FROM orders WHERE id = ? AND userId = ?',
      [orderId, userId],
      callback
    );
  },

  findAllWithUsernames(callback) {
    db.query(
      `SELECT o.id, o.userId, o.total AS totalAmount, o.status, o.payment_method, o.paid_at, o.created_at, u.username
       FROM orders o
       JOIN users u ON o.userId = u.id
       ORDER BY o.created_at DESC`,
      callback
    );
  },

  findByIdWithUser(orderId, callback) {
    db.query(
      `SELECT o.id, o.userId, o.total AS totalAmount, o.status, o.payment_method, o.payment_out_trade_no, o.payment_provider_ref, o.paid_at, o.created_at, u.username
       FROM orders o
       JOIN users u ON o.userId = u.id
       WHERE o.id = ?`,
      [orderId],
      callback
    );
  },

  updateStatus(orderId, status, callback) {
    db.query('UPDATE orders SET status = ? WHERE id = ?', [status, orderId], callback);
  },

  startPayment(orderId, userId, paymentMethod, outTradeNo, providerRef, callback) {
    db.query(
      `UPDATE orders
       SET status = 'Unpaid',
           payment_method = ?,
           payment_out_trade_no = ?,
           payment_provider_ref = ?
       WHERE id = ? AND userId = ?`,
      [paymentMethod, outTradeNo, providerRef || null, orderId, userId],
      callback
    );
  },

  markPaid(orderId, userId, providerRef, callback) {
    db.query(
      `UPDATE orders
       SET status = 'Paid',
           paid_at = NOW(),
           payment_provider_ref = COALESCE(?, payment_provider_ref)
       WHERE id = ? AND userId = ?`,
      [providerRef || null, orderId, userId],
      callback
    );
  },

  cancel(orderId, callback) {
    db.query(
      `UPDATE orders
       SET status = 'Cancelled',
           payment_method = NULL,
           payment_out_trade_no = NULL,
           payment_provider_ref = NULL,
           paid_at = NULL
       WHERE id = ?`,
      [orderId],
      callback
    );
  },

  findByOutTradeNo(outTradeNo, callback) {
    db.query(
      `SELECT o.id, o.userId, o.total AS totalAmount, o.status, o.payment_method, o.payment_out_trade_no, o.payment_provider_ref, o.paid_at, o.created_at, u.username
       FROM orders o
       JOIN users u ON o.userId = u.id
       WHERE o.payment_out_trade_no = ?
       LIMIT 1`,
      [outTradeNo],
      (err, rows) => {
        if (err) return callback(err);
        callback(null, rows && rows[0] ? rows[0] : null);
      }
    );
  }
};

module.exports = Order;
