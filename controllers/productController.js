const Product = require('../models/Product');

const ProductController = {
  showHome: (req, res) => {
    res.render('index', { user: req.session.user });
  },

  showShopping: (req, res) => {
    Product.findAll((err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error loading products');
      }
      res.render('shopping', { products: results, user: req.session.user });
    });
  },

  showInventory: (req, res) => {
    const threshold = 10;

    Product.findAll((err, products) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error loading products');
      }

      Product.findLowStock(threshold, 10, (errLow, lowStock) => {
        if (errLow) {
          console.error(errLow);
          return res.status(500).send('Error loading low stock data');
        }

        Product.findTopSelling(10, (errTop, topSelling) => {
          if (errTop) {
            console.error(errTop);
            return res.status(500).send('Error loading top selling data');
          }

          res.render('inventory', {
            products,
            lowStock,
            topSelling,
            user: req.session.user
          });
        });
      });
    });
  },

  showProductDetails: (req, res) => {
    const id = req.params.id;
    Product.findById(id, (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error loading product');
      }
      if (!results || results.length === 0) return res.status(404).send('Product not found');
      res.render('product', { product: results[0], user: req.session.user });
    });
  },

  showAddProductForm: (req, res) => {
    res.render('addProduct', { user: req.session.user });
  },

  addProduct: (req, res) => {
    const { name, quantity, price } = req.body;
    const image = req.file ? req.file.filename : null;

    Product.create({ name, quantity, price, image }, (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error adding product');
      }
      req.flash('success', 'Product added successfully');
      res.redirect('/inventory');
    });
  },

  showUpdateProductForm: (req, res) => {
    const id = req.params.id;
    Product.findById(id, (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error loading product');
      }
      if (!results || results.length === 0) return res.status(404).send('Product not found');
      res.render('updateProduct', { product: results[0], user: req.session.user });
    });
  },

  updateProduct: (req, res) => {
    const id = req.params.id;
    const { name, quantity, price } = req.body;
    let image = req.body.currentImage;
    if (req.file) image = req.file.filename;

    Product.update(id, { name, quantity, price, image }, (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error updating product');
      }
      req.flash('success', 'Product updated successfully');
      res.redirect('/inventory');
    });
  },

  deleteProduct: (req, res) => {
    const id = req.params.id;
    Product.delete(id, (err) => {
      if (err) {
        console.error(err);

        // Foreign key protection: product is referenced by existing order/invoice items
        if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
          req.flash(
            'error',
            'Cannot delete this product because an old invoice/order still references it. Remove those records first.'
          );
          return res.redirect('/inventory');
        }

        req.flash('error', 'Error deleting product');
        return res.redirect('/inventory');
      }
      req.flash('success', 'Product deleted');
      res.redirect('/inventory');
    });
  }
};

module.exports = ProductController;
