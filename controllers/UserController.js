const User = require('../models/User');

const UserController = {
  showLogin: (req, res) => {
    res.render('login', {
      errors: req.flash('error')
    });
  },

  showRegister: (req, res) => {
    res.render('register', {
      messages: req.flash('error'),
      formData: req.flash('formData')[0]
    });
  },

  register: (req, res) => {
    const { username, email, password, address, contact, role } = req.body;

    User.create({ username, email, password, address, contact, role }, (err) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Registration failed.');
        return res.redirect('/register');
      }

      req.flash('success', 'Registration successful! Please log in.');
      res.redirect('/login');
    });
  },

  login: (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      req.flash('error', 'All fields are required.');
      return res.redirect('/login');
    }

    User.findByEmailAndPassword(email, password, (err, results) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Login failed.');
        return res.redirect('/login');
      }

      if (results.length === 0) {
        req.flash('error', 'Invalid email or password.');
        return res.redirect('/login');
      }

      req.session.user = results[0];
      req.flash('success', 'Login successful!');

      if (req.session.user.role === 'admin') {
        res.redirect('/inventory');
      } else {
        res.redirect('/shopping');
      }
    });
  },

  logout: (req, res) => {
    req.session.destroy(() => {
      res.redirect('/');
    });
  }
};

module.exports = UserController;
