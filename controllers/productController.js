const db = require('../db');

const ProductController = {
  showHome: (req, res) => {
    res.render('index', { user: req.session.user });
  },

  showShopping: (req, res) => {
    db.query('SELECT * FROM products', (err, results) => {
      if (err) throw err;
      res.render('shopping', { products: results, user: req.session.user });
    });
  },

  showInventory: (req, res) => {
    db.query('SELECT * FROM products', (err, results) => {
      if (err) throw err;
      res.render('inventory', { products: results, user: req.session.user });
    });
  },

  showProductDetails: (req, res) => {
    const id = req.params.id;
    db.query('SELECT * FROM products WHERE id = ?', [id], (err, results) => {
      if (err) throw err;
      if (results.length === 0) return res.status(404).send('Product not found');
      res.render('product', { product: results[0], user: req.session.user });
    });
  },

  showAddProductForm: (req, res) => {
    res.render('addProduct', { user: req.session.user });
  },

  addProduct: (req, res) => {
    const { name, quantity, price } = req.body;
    const image = req.file ? req.file.filename : null;

    db.query(
      'INSERT INTO products (productName, quantity, price, image) VALUES (?, ?, ?, ?)',
      [name, quantity, price, image],
      (err) => {
        if (err) {
          console.error(err);
          return res.status(500).send('Error adding product');
        }
        req.flash('success', 'Product added successfully');
        res.redirect('/inventory');
      }
    );
  },

  showUpdateProductForm: (req, res) => {
    const id = req.params.id;
    db.query('SELECT * FROM products WHERE id = ?', [id], (err, results) => {
      if (err) throw err;
      if (results.length === 0) return res.status(404).send('Product not found');
      res.render('updateProduct', { product: results[0], user: req.session.user });
    });
  },

  updateProduct: (req, res) => {
    const id = req.params.id;
    const { name, quantity, price } = req.body;
    let image = req.body.currentImage;
    if (req.file) image = req.file.filename;

    db.query(
      'UPDATE products SET productName = ?, quantity = ?, price = ?, image = ? WHERE id = ?',
      [name, quantity, price, image, id],
      (err) => {
        if (err) {
          console.error(err);
          return res.status(500).send('Error updating product');
        }
        req.flash('success', 'Product updated successfully');
        res.redirect('/inventory');
      }
    );
  },

  deleteProduct: (req, res) => {
    const id = req.params.id;
    db.query('DELETE FROM products WHERE id = ?', [id], (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error deleting product');
      }
      req.flash('success', 'Product deleted');
      res.redirect('/inventory');
    });
  }
};

module.exports = ProductController;
