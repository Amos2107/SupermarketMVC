const db = require('../db');

const User = {
  create(data, callback) {
    const { username, email, password, address, contact, role = 'user' } = data;
    const sql =
      'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';
    db.query(sql, [username, email, password, address, contact, role], callback);
  },

  findByEmailAndPassword(email, password, callback) {
    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    db.query(sql, [email, password], callback);
  },

  findAll(callback) {
    db.query('SELECT id, username, email, role FROM users ORDER BY username ASC', callback);
  },

  updateRole(userId, role, callback) {
    db.query('UPDATE users SET role = ? WHERE id = ?', [role, userId], callback);
  },

  deleteUserWithAssociations(userId, callback) {
    db.beginTransaction((err) => {
      if (err) return callback(err);

      const rollback = (innerErr) => {
        db.rollback(() => callback(innerErr || new Error('Rollback')));
      };

      db.query(
        `DELETE oi FROM order_items oi
         JOIN orders o ON oi.orderId = o.id
         WHERE o.userId = ?`,
        [userId],
        (err1) => {
          if (err1) return rollback(err1);

          db.query('DELETE FROM orders WHERE userId = ?', [userId], (err2) => {
            if (err2) return rollback(err2);

            db.query(
              `DELETE ci FROM cart_items ci
               JOIN cart c ON ci.cartId = c.id
               WHERE c.userId = ?`,
              [userId],
              (err3) => {
                if (err3) return rollback(err3);

                db.query('DELETE FROM cart WHERE userId = ?', [userId], (err4) => {
                  if (err4) return rollback(err4);

                  db.query('DELETE FROM users WHERE id = ?', [userId], (err5, result) => {
                    if (err5) return rollback(err5);

                    if (result.affectedRows === 0) {
                      return rollback(new Error('User not found'));
                    }

                    db.commit((err6) => {
                      if (err6) return rollback(err6);
                      callback(null, result);
                    });
                  });
                });
              }
            );
          });
        }
      );
    });
  }
};

module.exports = User;
