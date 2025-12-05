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
      'SELECT id, total AS totalAmount, created_at FROM orders WHERE userId = ? ORDER BY created_at DESC',
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
      `SELECT o.id, o.total AS totalAmount, o.created_at, u.username
       FROM orders o
       JOIN users u ON o.userId = u.id
       ORDER BY o.created_at DESC`,
      callback
    );
  },

  findByIdWithUser(orderId, callback) {
    db.query(
      `SELECT o.id, o.total AS totalAmount, o.created_at, u.username
       FROM orders o
       JOIN users u ON o.userId = u.id
       WHERE o.id = ?`,
      [orderId],
      callback
    );
  }
};

module.exports = Order;
