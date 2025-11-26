const db = require('../db');

const User = {
  create(data, callback) {
    const { username, email, password, address, contact, role } = data;
    const sql =
      'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';
    db.query(sql, [username, email, password, address, contact, role], callback);
  },

  findByEmailAndPassword(email, password, callback) {
    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    db.query(sql, [email, password], callback);
  }
};

module.exports = User;
