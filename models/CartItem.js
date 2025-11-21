const db = require('../db');

const CartItem = {
  // userId-based cart stored in DB (optional)
  addOrUpdate: (userId, productId, quantity, callback) => {
    const sql = `
      INSERT INTO cartitems (userId, productId, quantity)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)
    `;
    db.query(sql, [userId, productId, quantity], callback);
  },

  getByUser: (userId, callback) => {
    const sql = `
      SELECT c.*, p.productName, p.price, p.image
      FROM cartitems c
      JOIN products p ON c.productId = p.id
      WHERE c.userId = ?
    `;
    db.query(sql, [userId], callback);
  },

  remove: (id, callback) => {
    db.query('DELETE FROM cartitems WHERE id = ?', [id], callback);
  },

  clear: (userId, callback) => {
    db.query('DELETE FROM cartitems WHERE userId = ?', [userId], callback);
  }
};

module.exports = CartItem;
