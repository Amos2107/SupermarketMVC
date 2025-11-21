const db = require('../db');

const Product = {
  findAll: callback => {
    db.query('SELECT * FROM products', callback);
  },

  findById: (id, callback) => {
    db.query('SELECT * FROM products WHERE id = ?', [id], callback);
  },

  create: (productData, callback) => {
    const { productName, quantity, price, image } = productData;
    const sql = `
      INSERT INTO products (productName, quantity, price, image)
      VALUES (?, ?, ?, ?)
    `;
    db.query(sql, [productName, quantity, price, image], callback);
  },

  update: (id, productData, callback) => {
    const { productName, quantity, price, image } = productData;
    const sql = `
      UPDATE products
      SET productName = ?, quantity = ?, price = ?, image = ?
      WHERE id = ?
    `;
    db.query(sql, [productName, quantity, price, image, id], callback);
  },

  delete: (id, callback) => {
    db.query('DELETE FROM products WHERE id = ?', [id], callback);
  }
};

module.exports = Product;
