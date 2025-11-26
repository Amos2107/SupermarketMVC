const db = require('../db');

const CartItem = {
  findActiveCartByUser(userId, callback) {
    db.query(
      "SELECT * FROM cart WHERE userId = ? AND status = 'active' LIMIT 1",
      [userId],
      callback
    );
  },

  createCart(userId, callback) {
    db.query('INSERT INTO cart (userId) VALUES (?)', [userId], callback);
  },

  findByCartAndProduct(cartId, productId, callback) {
    db.query(
      'SELECT * FROM cart_items WHERE cartId = ? AND productId = ?',
      [cartId, productId],
      callback
    );
  },

  insertItem(cartId, productId, quantity, callback) {
    db.query(
      `INSERT INTO cart_items (cartId, productId, quantity, priceAtTime)
       SELECT ?, id, ?, price FROM products WHERE id = ?`,
      [cartId, quantity, productId],
      callback
    );
  },

  updateQuantity(cartId, productId, quantity, callback) {
    db.query(
      'UPDATE cart_items SET quantity = quantity + ? WHERE cartId = ? AND productId = ?',
      [quantity, cartId, productId],
      callback
    );
  }
};

module.exports = CartItem;
