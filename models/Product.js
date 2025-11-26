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
  }
};

module.exports = Product;
