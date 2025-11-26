const db = require('../db');

const OrderItem = {
  copyFromCart(cartId, orderId, callback) {
    db.query(
      `INSERT INTO order_items (orderId, productId, quantity, priceAtTime)
       SELECT ?, productId, quantity, priceAtTime
       FROM cart_items
       WHERE cartId = ?`,
      [orderId, cartId],
      callback
    );
  },

  findByOrder(orderId, callback) {
    db.query(
      `SELECT oi.quantity, oi.priceAtTime, p.productName, p.image
       FROM order_items oi
       JOIN products p ON oi.productId = p.id
       WHERE oi.orderId = ?`,
      [orderId],
      callback
    );
  }
};

module.exports = OrderItem;
