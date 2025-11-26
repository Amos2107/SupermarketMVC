// middleware.js
const validateRegistration = (req, res, next) => {
  const { username, email, password, address, contact, role } = req.body;

  if (!username || !email || !password || !address || !contact || !role) {
    req.flash('error', 'All fields are required.');
    req.flash('formData', req.body);
    return res.redirect('/register');
  }

  if (password.length < 6) {
    req.flash('error', 'Password should be at least 6 characters long.');
    req.flash('formData', req.body);
    return res.redirect('/register');
  }

  next();
};

const checkAuthenticated = (req, res, next) => {
  if (req.session.user) return next();
  req.flash('error', 'Please log in to view this page.');
  res.redirect('/login');
};

const checkAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') return next();
  req.flash('error', 'Access denied.');
  res.redirect('/shopping');
};

module.exports = {
  validateRegistration,
  checkAuthenticated,
  checkAdmin
};
