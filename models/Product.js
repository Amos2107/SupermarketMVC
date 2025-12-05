const db = require('../db');

const Product = {
  findAll(callback) {
    db.query('SELECT * FROM products', callback);
  },

  findById(id, callback) {
    db.query('SELECT * FROM products WHERE id = ?', [id], callback);
  },

  create(data, callback) {
    const { name, quantity, price, image } = data;
    db.query(
      'INSERT INTO products (productName, quantity, price, image) VALUES (?, ?, ?, ?)',
      [name, quantity, price, image],
      callback
    );
  },

  update(id, data, callback) {
    const { name, quantity, price, image } = data;
    db.query(
      'UPDATE products SET productName = ?, quantity = ?, price = ?, image = ? WHERE id = ?',
      [name, quantity, price, image, id],
      callback
    );
  },

  delete(id, callback) {
    db.query('DELETE FROM products WHERE id = ?', [id], callback);
  },

  findLowStock(threshold, limit = 10, callback) {
    db.query(
      'SELECT id, productName, quantity FROM products WHERE quantity <= ? ORDER BY quantity ASC LIMIT ?',
      [threshold, limit],
      callback
    );
  },

  findTopSelling(limit = 10, callback) {
    db.query(
      `SELECT p.id, p.productName, p.quantity AS stock, COALESCE(SUM(oi.quantity), 0) AS sold
       FROM products p
       LEFT JOIN order_items oi ON oi.productId = p.id
       GROUP BY p.id, p.productName, p.quantity
       ORDER BY sold DESC
       LIMIT ?`,
      [limit],
      callback
    );
  },

  decrementStockFromCart(cartId, callback) {
    db.query(
      `UPDATE products p
       JOIN cart_items ci ON ci.productId = p.id
       SET p.quantity = p.quantity - ci.quantity
       WHERE ci.cartId = ?`,
      [cartId],
      callback
    );
  },

  getInventoryHealth(threshold = 10, callback) {
    db.query(
      `SELECT COUNT(*) AS totalSkus,
              SUM(quantity <= ?) AS lowCount,
              SUM(quantity = 0) AS oosCount,
              SUM(quantity) AS totalUnits
       FROM products`,
      [threshold],
      (metaErr, kpiRows) => {
        if (metaErr) return callback(metaErr);

        const kpis = kpiRows && kpiRows[0];

        this.findLowStock(threshold, 20, (lowErr, lowStock) => {
          if (lowErr) return callback(lowErr);

          db.query(
            'SELECT id, productName, quantity FROM products WHERE quantity = 0 ORDER BY productName ASC LIMIT 20',
            (oosErr, outOfStock) => {
              if (oosErr) return callback(oosErr);

              this.findTopSelling(20, (topErr, topSelling) => {
                if (topErr) return callback(topErr);

                callback(null, { kpis, lowStock, outOfStock, topSelling });
              });
            }
          );
        });
      }
    );
  }
};

module.exports = Product;
