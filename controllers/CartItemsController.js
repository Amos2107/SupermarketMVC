const db = require('../db');

const CartItemsController = {
  // helper: get or create active cart for user
  getOrCreateCart(userId, callback) {
    db.query(
      "SELECT * FROM cart WHERE userId = ? AND status = 'active' LIMIT 1",
      [userId],
      (err, results) => {
        if (err) return callback(err);
        if (results.length > 0) return callback(null, results[0].id);

        db.query(
          'INSERT INTO cart (userId) VALUES (?)',
          [userId],
          (err2, insertRes) => {
            if (err2) return callback(err2);
            callback(null, insertRes.insertId);
          }
        );
      }
    );
  },

  addToCart(req, res) {
    const userId = req.session.user.id;
    const productId = parseInt(req.params.id);
    const quantity = parseInt(req.body.quantity) || 1;

    // Validate product existence and stock
    db.query(
      'SELECT id, productName, quantity AS stock FROM products WHERE id = ? LIMIT 1',
      [productId],
      (prodErr, prodRows) => {
        if (prodErr) {
          console.error(prodErr);
          req.flash('error', 'Unable to add item right now.');
          return res.redirect('/shopping');
        }
        if (prodRows.length === 0) {
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

          // Check if item exists already to compare against stock
          db.query(
            'SELECT quantity FROM cart_items WHERE cartId = ? AND productId = ?',
            [cartId, productId],
            (err2, rows) => {
              if (err2) {
                console.error(err2);
                req.flash('error', 'Error finding cart item.');
                return res.redirect('/shopping');
              }

              const existingQty = rows.length > 0 ? rows[0].quantity : 0;
              const totalDesired = existingQty + requestedQty;

              if (totalDesired > product.stock) {
                req.flash('error', `Only ${product.stock} left for ${product.productName}.`);
                return res.redirect('/shopping');
              }

              if (rows.length > 0) {
                db.query(
                  'UPDATE cart_items SET quantity = quantity + ? WHERE cartId = ? AND productId = ?',
                  [requestedQty, cartId, productId],
                  (err3) => {
                    if (err3) {
                      console.error(err3);
                      req.flash('error', 'Error updating cart.');
                      return res.redirect('/shopping');
                    }
                    req.flash('success', 'Item added to cart!');
                    res.redirect('/cart');
                  }
                );
              } else {
                db.query(
                  `INSERT INTO cart_items (cartId, productId, quantity, priceAtTime)
                   SELECT ?, id, ?, price FROM products WHERE id = ?`,
                  [cartId, requestedQty, productId],
                  (err4) => {
                    if (err4) {
                      console.error(err4);
                      req.flash('error', 'Error adding to cart.');
                      return res.redirect('/shopping');
                    }
                    req.flash('success', 'Item added to cart!');
                    res.redirect('/cart');
                  }
                );
              }
            }
          );
        });
      }
    );
  },

  showCart(req, res) {
    const userId = req.session.user.id;

    db.query(
      `SELECT ci.id AS cartItemId,
              ci.quantity,
              ci.priceAtTime,
              p.productName,
              p.image
       FROM cart_items ci
       JOIN cart c ON ci.cartId = c.id
       JOIN products p ON ci.productId = p.id
       WHERE c.userId = ? AND c.status = 'active'`,
      [userId],
      (err, items) => {
        if (err) {
          console.error(err);
          return res.status(500).send('Error loading cart');
        }
        res.render('cart', { cart: items, user: req.session.user });
      }
    );
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
    db.query(
      `SELECT ci.id AS cartItemId,
              ci.cartId,
              ci.productId,
              ci.quantity AS currentQty,
              p.quantity  AS stock,
              p.productName,
              c.userId
       FROM cart_items ci
       JOIN cart c ON ci.cartId = c.id
       JOIN products p ON p.id = ci.productId
       WHERE ci.id = ? AND c.status = 'active'`,
      [cartItemId],
      (err, rows) => {
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

        db.query(
          'UPDATE cart_items SET quantity = ? WHERE id = ?',
          [newQty, cartItemId],
          (updateErr) => {
            if (updateErr) {
              console.error(updateErr);
              req.flash('error', 'Error updating quantity.');
              return res.redirect('/cart');
            }
            req.flash('success', 'Quantity updated!');
            res.redirect('/cart');
          }
        );
      }
    );
  },

  deleteItem(req, res) {
    const cartItemId = parseInt(req.params.id);

    db.query('DELETE FROM cart_items WHERE id = ?', [cartItemId], (err) => {
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
    db.query(
      "SELECT id FROM cart WHERE userId = ? AND status = 'active' LIMIT 1",
      [userId],
      (err, rows) => {
        if (err) {
          console.error(err);
          return res.status(500).send('Error clearing cart');
        }
        if (rows.length === 0) return res.redirect('/cart');

        const cartId = rows[0].id;
        db.query('DELETE FROM cart_items WHERE cartId = ?', [cartId], (err2) => {
          if (err2) console.error(err2);
          req.flash('success', 'Cart cleared!');
          res.redirect('/cart');
        });
      }
    );
  }
};

module.exports = CartItemsController;
