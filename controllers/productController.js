const Product = require('../models/Product');

const ProductController = {
  showHome: (req, res) => {
    res.render('index', { user: req.session.user });
  },

  showInventory: (req, res) => {
    Product.findAll((err, products) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error loading products');
      }
      res.render('inventory', { products, user: req.session.user });
    });
  },

  showShopping: (req, res) => {
    Product.findAll((err, products) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error loading products');
      }
      res.render('shopping', { products, user: req.session.user });
    });
  },

  showProductDetails: (req, res) => {
    const id = req.params.id;
    Product.findById(id, (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error loading product');
      }
      if (results.length === 0) {
        return res.status(404).send('Product not found');
      }
      res.render('product', { product: results[0], user: req.session.user });
    });
  },

  showAddProductForm: (req, res) => {
    res.render('addProduct', { user: req.session.user });
  },

  addProduct: (req, res) => {
    const { name, quantity, price } = req.body;
    const image = req.file ? req.file.filename : null;

    Product.create(
      { productName: name, quantity, price, image },
      (err) => {
        if (err) {
          console.error(err);
          return res.status(500).send('Error adding product');
        }
        res.redirect('/inventory');
      }
    );
  },

  showUpdateProductForm: (req, res) => {
    const id = req.params.id;
    Product.findById(id, (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error loading product');
      }
      if (results.length === 0) {
        return res.status(404).send('Product not found');
      }
      res.render('updateProduct', { product: results[0], user: req.session.user });
    });
  },

  updateProduct: (req, res) => {
    const id = req.params.id;
    const { name, quantity, price, currentImage } = req.body;

    let image = currentImage;
    if (req.file) {
      image = req.file.filename;
    }

    Product.update(
      id,
      { productName: name, quantity, price, image },
      (err) => {
        if (err) {
          console.error(err);
          return res.status(500).send('Error updating product');
        }
        res.redirect('/inventory');
      }
    );
  },

  deleteProduct: (req, res) => {
    const id = req.params.id;
    Product.delete(id, (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error deleting product');
      }
      res.redirect('/inventory');
    });
  }
};

module.exports = ProductController;
