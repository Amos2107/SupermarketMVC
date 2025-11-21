require('dotenv').config();

const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');

const app = express();

// Import routes
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');

// Import middleware (applies inside route files)
const { checkAuthenticated, checkAdmin, validateRegistration } = require('./middleware');

// View engine & static
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));

// Session & flash
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallbacksecret',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 1 week
}));

app.use(flash());

// Make user available in all views
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user;
  next();
});

// Use routes
app.use('/', productRoutes);   // Home, shopping, product details, admin inventory, CRUD
app.use('/', authRoutes);      // Login, register, logout
app.use('/cart', cartRoutes);  // Add/update/delete cart items

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SupermarketMVC server running on port ${PORT}`);
});
