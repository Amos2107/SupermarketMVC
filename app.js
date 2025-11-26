require('dotenv').config();

const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');

const app = express();

// View engine & static
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));

// Session
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'fallbacksecret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 1 week
  })
);

// Flash
app.use(flash());

// Global locals for all views
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user;
  res.locals.messages = {
    success: req.flash('success'),
    error: req.flash('error')
  };
  next();
});

// Routes
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');

app.use('/', authRoutes);
app.use('/', productRoutes);
app.use('/cart', cartRoutes);
app.use('/', orderRoutes);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ SupermarketMVC running on port ${PORT}`);
});
