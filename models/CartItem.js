const db = require('../db');

const CartItem = {
  findActiveCartId(userId, callback) {
    db.query(
      "SELECT id FROM cart WHERE userId = ? AND status = 'active' LIMIT 1",
      [userId],
      (err, rows) => {
        if (err) return callback(err);
        callback(null, rows && rows[0] ? rows[0].id : null);
      }
    );
  },

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
  },

  getItemsForCartDisplay(userId, callback) {
    db.query(
      `SELECT ci.id AS cartItemId,
              ci.quantity,
              ci.priceAtTime,
              p.productName,
              p.image
       FROM cart_items ci
       JOIN cart c ON ci.cartId = c.id
       JOIN products p ON ci.productId = p.id
       WHERE c.userId = ? AND c.status = 'active'`,
      [userId],
      callback
    );
  },

  getCartItemWithOwnership(cartItemId, callback) {
    db.query(
      `SELECT ci.id AS cartItemId,
              ci.cartId,
              ci.productId,
              ci.quantity AS currentQty,
              p.quantity  AS stock,
              p.productName,
              c.userId
       FROM cart_items ci
       JOIN cart c ON ci.cartId = c.id
       JOIN products p ON p.id = ci.productId
       WHERE ci.id = ? AND c.status = 'active'`,
      [cartItemId],
      callback
    );
  },

  deleteCartItem(cartItemId, callback) {
    db.query('DELETE FROM cart_items WHERE id = ?', [cartItemId], callback);
  },

  clearCartItems(cartId, callback) {
    db.query('DELETE FROM cart_items WHERE cartId = ?', [cartId], callback);
  },

  getCartItemsWithStock(cartId, callback) {
    db.query(
      `SELECT ci.productId,
              ci.quantity    AS cartQty,
              p.quantity     AS stock,
              p.productName
       FROM cart_items ci
       JOIN products p ON ci.productId = p.id
       WHERE ci.cartId = ?`,
      [cartId],
      callback
    );
  },

  getCartItemsTotal(cartId, callback) {
    db.query(
      `SELECT SUM(quantity * priceAtTime) AS total
       FROM cart_items
       WHERE cartId = ?`,
      [cartId],
      callback
    );
  },

  copyCartItemsToOrder(cartId, orderId, callback) {
    db.query(
      `INSERT INTO order_items (orderId, productId, quantity, priceAtTime)
       SELECT ?, productId, quantity, priceAtTime
       FROM cart_items
       WHERE cartId = ?`,
      [orderId, cartId],
      callback
    );
  },

  markCartStatus(cartId, status, callback) {
    db.query('UPDATE cart SET status = ? WHERE id = ?', [status, cartId], callback);
  }
};

module.exports = CartItem;
