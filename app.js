require('dotenv').config();

const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const path = require('path');

const {
  checkAuthenticated,
  checkAdmin,
  validateRegistration
} = require('./middleware');

const UserController = require('./controllers/UserController');
const ProductController = require('./controllers/ProductController');
const CartItemsController = require('./controllers/CartItemsController');

const app = express();

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

// Make user available in all views (optional)
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user;
  next();
});

// Multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/images'),
  filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

// Routes

// Home
app.get('/', ProductController.showHome);

// Auth
app.get('/login', UserController.showLogin);
app.post('/login', UserController.login);

app.get('/register', UserController.showRegister);
app.post('/register', validateRegistration, UserController.register);

app.get('/logout', UserController.logout);

// Shopping & inventory
app.get('/shopping', checkAuthenticated, ProductController.showShopping);

app.get('/inventory', checkAuthenticated, checkAdmin, ProductController.showInventory);

app.get('/product/:id', checkAuthenticated, ProductController.showProductDetails);

app.get('/addProduct', checkAuthenticated, checkAdmin, ProductController.showAddProductForm);
app.post('/addProduct', checkAuthenticated, checkAdmin, upload.single('image'), ProductController.addProduct);

app.get('/updateProduct/:id', checkAuthenticated, checkAdmin, ProductController.showUpdateProductForm);
app.post('/updateProduct/:id', checkAuthenticated, checkAdmin, upload.single('image'), ProductController.updateProduct);

app.get('/deleteProduct/:id', checkAuthenticated, checkAdmin, ProductController.deleteProduct);

// Cart
app.post('/add-to-cart/:id', checkAuthenticated, CartItemsController.addToCart);
app.get('/cart', checkAuthenticated, CartItemsController.showCart);
app.get('/cart/clear', checkAuthenticated, CartItemsController.clearCart);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SupermarketMVC server running on port ${PORT}`);
});
