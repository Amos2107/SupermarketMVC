const db = require('../db');          // only needed if you want to validate product

const CartItemsController = {
  addToCart: (req, res) => {
    const productId = parseInt(req.params.id);
    const quantity = parseInt(req.body.quantity) || 1;

    db.query('SELECT * FROM products WHERE id = ?', [productId], (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error adding to cart');
      }
      if (results.length === 0) {
        return res.status(404).send('Product not found');
      }

      const product = results[0];

      if (!req.session.cart) req.session.cart = [];

      const existing = req.session.cart.find(item => item.id === productId);

      if (existing) {
        existing.quantity += quantity;
      } else {
        req.session.cart.push({
          id: product.id,
          productName: product.productName,
          price: product.price,
          quantity,
          image: product.image
        });
      }

      res.redirect('/cart');
    });
  },

  showCart: (req, res) => {
    const cart = req.session.cart || [];
    res.render('cart', { cart, user: req.session.user });
  },

  clearCart: (req, res) => {
    req.session.cart = [];
    res.redirect('/cart');
  }
};

module.exports = CartItemsController;
