const CartItem = require('../models/CartItem');
const Product = require('../models/Product');

const CartItemsController = {
  // helper: get or create active cart for user
  getOrCreateCart(userId, callback) {
    CartItem.findActiveCartId(userId, (err, cartId) => {
      if (err) return callback(err);
      if (cartId) return callback(null, cartId);

      CartItem.createCart(userId, (createErr, insertRes) => {
        if (createErr) return callback(createErr);
        callback(null, insertRes.insertId);
      });
    });
  },

  addToCart(req, res) {
    const userId = req.session.user.id;
    const productId = parseInt(req.params.id);
    const quantity = parseInt(req.body.quantity) || 1;

    // Validate product existence and stock
    Product.findById(productId, (prodErr, prodRows) => {
      if (prodErr) {
        console.error(prodErr);
        req.flash('error', 'Unable to add item right now.');
        return res.redirect('/shopping');
      }
      if (!prodRows || prodRows.length === 0) {
        req.flash('error', 'Product not found.');
        return res.redirect('/shopping');
      }

      const product = prodRows[0];
      const requestedQty = Math.max(1, quantity);

      CartItemsController.getOrCreateCart(userId, (err, cartId) => {
        if (err) {
          console.error(err);
          req.flash('error', 'Error preparing cart.');
          return res.redirect('/shopping');
        }

        CartItem.findByCartAndProduct(cartId, productId, (err2, rows) => {
          if (err2) {
            console.error(err2);
            req.flash('error', 'Error finding cart item.');
            return res.redirect('/shopping');
          }

          const existingQty = rows.length > 0 ? rows[0].quantity : 0;
          const totalDesired = existingQty + requestedQty;

          if (totalDesired > product.quantity) {
            req.flash('error', `Only ${product.quantity} left for ${product.productName}.`);
            return res.redirect('/shopping');
          }

          if (rows.length > 0) {
            CartItem.updateQuantity(cartId, productId, requestedQty, (err3) => {
              if (err3) {
                console.error(err3);
                req.flash('error', 'Error updating cart.');
                return res.redirect('/shopping');
              }
              req.flash('success', 'Item added to cart!');
              res.redirect('/cart');
            });
          } else {
            CartItem.insertItem(cartId, productId, requestedQty, (err4) => {
              if (err4) {
                console.error(err4);
                req.flash('error', 'Error adding to cart.');
                return res.redirect('/shopping');
              }
              req.flash('success', 'Item added to cart!');
              res.redirect('/cart');
            });
          }
        });
      });
    });
  },

  showCart(req, res) {
    const userId = req.session.user.id;

    CartItem.getItemsForCartDisplay(userId, (err, items) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error loading cart');
      }
      res.render('cart', { cart: items, user: req.session.user });
    });
  },

  updateQuantity(req, res) {
    const cartItemId = parseInt(req.params.id);
    const newQty = parseInt(req.body.quantity);
    const userId = req.session.user.id;

    if (!Number.isFinite(newQty) || newQty < 1) {
      req.flash('error', 'Quantity must be at least 1.');
      return res.redirect('/cart');
    }

    // Validate cart item belongs to the current user's active cart and stock is sufficient
    CartItem.getCartItemWithOwnership(cartItemId, (err, rows) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Error updating quantity.');
        return res.redirect('/cart');
      }
      if (!rows || rows.length === 0) {
        req.flash('error', 'Cart item not found.');
        return res.redirect('/cart');
      }

      const item = rows[0];
      if (item.userId !== userId) {
        req.flash('error', 'Not authorized to modify this cart item.');
        return res.redirect('/cart');
      }

      if (newQty > item.stock) {
        req.flash('error', `Only ${item.stock} left for ${item.productName}.`);
        return res.redirect('/cart');
      }

      CartItem.updateQuantity(item.cartId, item.productId, newQty - item.currentQty, (updateErr) => {
        if (updateErr) {
          console.error(updateErr);
          req.flash('error', 'Error updating quantity.');
          return res.redirect('/cart');
        }
        req.flash('success', 'Quantity updated!');
        res.redirect('/cart');
      });
    });
  },

  deleteItem(req, res) {
    const cartItemId = parseInt(req.params.id);

    CartItem.deleteCartItem(cartItemId, (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error deleting item');
      }
      req.flash('success', 'Item removed from cart!');
      res.redirect('/cart');
    });
  },

  clearCart(req, res) {
    const userId = req.session.user.id;

    // find active cart
    CartItem.findActiveCartId(userId, (err, cartId) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error clearing cart');
      }
      if (!cartId) return res.redirect('/cart');

      CartItem.clearCartItems(cartId, (err2) => {
        if (err2) console.error(err2);
        req.flash('success', 'Cart cleared!');
        res.redirect('/cart');
      });
    });
  }
};

module.exports = CartItemsController;
