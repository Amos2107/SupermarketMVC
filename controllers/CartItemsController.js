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

    CartItemsController.getOrCreateCart(userId, (err, cartId) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error preparing cart');
      }

      // Check if item exists already
      db.query(
        'SELECT * FROM cart_items WHERE cartId = ? AND productId = ?',
        [cartId, productId],
        (err2, rows) => {
          if (err2) {
            console.error(err2);
            return res.status(500).send('Error finding cart item');
          }

          if (rows.length > 0) {
            // update quantity
            db.query(
              'UPDATE cart_items SET quantity = quantity + ? WHERE cartId = ? AND productId = ?',
              [quantity, cartId, productId],
              (err3) => {
                if (err3) console.error(err3);
                req.flash('success', 'Item added to cart!');
                res.redirect('/cart');
              }
            );
          } else {
            // insert new item using current product price
            db.query(
              `INSERT INTO cart_items (cartId, productId, quantity, priceAtTime)
               SELECT ?, id, ?, price FROM products WHERE id = ?`,
              [cartId, quantity, productId],
              (err4) => {
                if (err4) {
                  console.error(err4);
                  return res.status(500).send('Error adding to cart');
                }
                req.flash('success', 'Item added to cart!');
                res.redirect('/cart');
              }
            );
          }
        }
      );
    });
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

    db.query(
      'UPDATE cart_items SET quantity = ? WHERE id = ?',
      [newQty, cartItemId],
      (err) => {
        if (err) {
          console.error(err);
          return res.status(500).send('Error updating quantity');
        }
        req.flash('success', 'Quantity updated!');
        res.redirect('/cart');
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
