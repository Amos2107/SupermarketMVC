const db = require('../db');

const AdminController = {
  listUsers(req, res) {
    db.query('SELECT id, username, email, role FROM users ORDER BY username ASC', (err, users) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Unable to load users.');
        return res.redirect('/');
      }
      res.render('adminUsers', {
        users,
        messages: res.locals.messages
      });
    });
  },

  makeAdmin(req, res) {
    const targetId = parseInt(req.params.id, 10);

    if (Number.isNaN(targetId)) {
      req.flash('error', 'Invalid user.');
      return res.redirect('/admin/users');
    }

    db.query('UPDATE users SET role = ? WHERE id = ?', ['admin', targetId], (err, result) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Could not update role.');
        return res.redirect('/admin/users');
      }

      if (result.affectedRows === 0) {
        req.flash('error', 'User not found.');
      } else {
        req.flash('success', 'User upgraded to admin.');
      }
      res.redirect('/admin/users');
    });
  },

  deleteUser(req, res) {
    const targetId = parseInt(req.params.id, 10);

    if (Number.isNaN(targetId)) {
      req.flash('error', 'Invalid user.');
      return res.redirect('/admin/users');
    }

    if (req.session.user && req.session.user.id === targetId) {
      req.flash('error', 'You cannot delete your own account.');
      return res.redirect('/admin/users');
    }

    db.beginTransaction((err) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Could not start delete operation.');
        return res.redirect('/admin/users');
      }

      const rollback = () => {
        db.rollback(() => {
          req.flash('error', 'Delete failed. Changes were reverted.');
          res.redirect('/admin/users');
        });
      };

      db.query(
        `DELETE oi FROM order_items oi
         JOIN orders o ON oi.orderId = o.id
         WHERE o.userId = ?`,
        [targetId],
        (err1) => {
          if (err1) {
            console.error(err1);
            return rollback();
          }

          db.query('DELETE FROM orders WHERE userId = ?', [targetId], (err2) => {
            if (err2) {
              console.error(err2);
              return rollback();
            }

            db.query(
              `DELETE ci FROM cart_items ci
               JOIN cart c ON ci.cartId = c.id
               WHERE c.userId = ?`,
              [targetId],
              (err3) => {
                if (err3) {
                  console.error(err3);
                  return rollback();
                }

                db.query('DELETE FROM cart WHERE userId = ?', [targetId], (err4) => {
                  if (err4) {
                    console.error(err4);
                    return rollback();
                  }

                  db.query('DELETE FROM users WHERE id = ?', [targetId], (err5, result) => {
                    if (err5) {
                      console.error(err5);
                      return rollback();
                    }

                    if (result.affectedRows === 0) {
                      req.flash('error', 'User not found.');
                      db.rollback(() => res.redirect('/admin/users'));
                      return;
                    }

                    db.commit((err6) => {
                      if (err6) {
                        console.error(err6);
                        return rollback();
                      }
                      req.flash('success', 'User and their transactions deleted.');
                      res.redirect('/admin/users');
                    });
                  });
                });
              }
            );
          });
        }
      );
    });
  },

  inventoryHealth(req, res) {
    const threshold = 10; // static threshold for low stock; can be made configurable

    // Fetch KPIs, then low stock, out of stock, and top selling lists
    db.query(
      `SELECT COUNT(*) AS totalSkus,
              SUM(quantity <= ?) AS lowCount,
              SUM(quantity = 0) AS oosCount,
              SUM(quantity) AS totalUnits
       FROM products`,
      [threshold],
      (metaErr, kpiRows) => {
        if (metaErr) {
          console.error(metaErr);
          req.flash('error', 'Unable to load inventory KPIs.');
          return res.redirect('/');
        }

        db.query(
          'SELECT id, productName, quantity FROM products WHERE quantity <= ? ORDER BY quantity ASC LIMIT 20',
          [threshold],
          (lowErr, lowStock) => {
            if (lowErr) {
              console.error(lowErr);
              req.flash('error', 'Unable to load low stock data.');
              return res.redirect('/');
            }

            db.query(
              'SELECT id, productName, quantity FROM products WHERE quantity = 0 ORDER BY productName ASC LIMIT 20',
              (oosErr, outOfStock) => {
                if (oosErr) {
                  console.error(oosErr);
                  req.flash('error', 'Unable to load out-of-stock data.');
                  return res.redirect('/');
                }

                db.query(
                  `SELECT p.id, p.productName, COALESCE(SUM(oi.quantity), 0) AS sold
                   FROM products p
                   LEFT JOIN order_items oi ON oi.productId = p.id
                   GROUP BY p.id, p.productName
                   ORDER BY sold DESC
                   LIMIT 20`,
                  (err2, topSelling) => {
                    if (err2) {
                      console.error(err2);
                      req.flash('error', 'Unable to load sales data.');
                      return res.redirect('/');
                    }

                    res.render('adminInventoryHealth', {
                      kpis: kpiRows && kpiRows[0],
                      lowStock,
                      outOfStock,
                      topSelling,
                      messages: res.locals.messages
                    });
                  }
                );
              }
            );
          }
        );
      }
    );
  }
};

module.exports = AdminController;
