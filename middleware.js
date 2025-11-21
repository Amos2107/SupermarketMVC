// middleware.js
module.exports.checkAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  req.flash('error', 'Please log in to continue');
  res.redirect('/login');
};

module.exports.checkAdmin = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  req.flash('error', 'Access denied');
  res.redirect('/shopping');
};

module.exports.validateRegistration = (req, res, next) => {
  const { username, email, password, address, contact, role } = req.body;

  if (!username || !email || !password || !address || !contact || !role) {
    req.flash('error', 'All fields are required.');
    req.flash('formData', req.body);
    return res.redirect('/register');
  }

  if (password.length < 6) {
    req.flash('error', 'Password must be at least 6 characters.');
    req.flash('formData', req.body);
    return res.redirect('/register');
  }

  next();
};
