const db = require('../db');

const User = {
  create: (userData, callback) => {
    const { username, email, password, address, contact, role } = userData;
    const sql = `
      INSERT INTO users (username, email, password, address, contact, role)
      VALUES (?, ?, SHA1(?), ?, ?, ?)
    `;
    db.query(sql, [username, email, password, address, contact, role], callback);
  },

  findByEmailAndPassword: (email, password, callback) => {
    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    db.query(sql, [email, password], callback);
  },

  findById: (id, callback) => {
    const sql = 'SELECT * FROM users WHERE id = ?';
    db.query(sql, [id], callback);
  },

  findAll: callback => {
    const sql = 'SELECT * FROM users';
    db.query(sql, callback);
  }
};

module.exports = User;
