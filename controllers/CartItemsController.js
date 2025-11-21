const db = require('../db'); // only needed if you want to validate product

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

      // item.id matches product.id
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
  },

  // ⭐ FIXED: UPDATE QUANTITY
  updateQuantity: (req, res) => {
    const productId = parseInt(req.params.id);
    const newQuantity = parseInt(req.body.quantity);

    if (!req.session.cart) return res.redirect("/cart");

    // FIND ITEM USING id (not productId)
    const item = req.session.cart.find(i => i.id === productId);

    if (item) {
      item.quantity = newQuantity;
    }

    res.redirect("/cart");
  },

  // ⭐ FIXED: DELETE ITEM
  deleteItem: (req, res) => {
    const productId = parseInt(req.params.id);

    if (!req.session.cart) return res.redirect("/cart");

    // REMOVE items where item.id !== productId
    req.session.cart = req.session.cart.filter(item => item.id !== productId);

    res.redirect("/cart");
  }
};

module.exports = CartItemsController;