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
      'SELECT id, total, created_at FROM orders WHERE userId = ? ORDER BY created_at DESC',
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
  }
};

module.exports = Order;
