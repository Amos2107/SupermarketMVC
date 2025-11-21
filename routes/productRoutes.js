const express = require('express');
const router = express.Router();
const multer = require('multer');

const {
  checkAuthenticated,
  checkAdmin
} = require('../middleware');

const ProductController = require('../controllers/ProductController');

// Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/images'),
  filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

// Home + Shopping
router.get('/', ProductController.showHome);
router.get('/shopping', checkAuthenticated, ProductController.showShopping);

// Product details
router.get('/product/:id', checkAuthenticated, ProductController.showProductDetails);

// Admin-only inventory
router.get('/inventory', checkAuthenticated, checkAdmin, ProductController.showInventory);

// Add Product
router.get('/addProduct', checkAuthenticated, checkAdmin, ProductController.showAddProductForm);
router.post('/addProduct', checkAuthenticated, checkAdmin, upload.single('image'), ProductController.addProduct);

// Update Product
router.get('/updateProduct/:id', checkAuthenticated, checkAdmin, ProductController.showUpdateProductForm);
router.post('/updateProduct/:id', checkAuthenticated, checkAdmin, upload.single('image'), ProductController.updateProduct);

// Delete Product
router.get('/deleteProduct/:id', checkAuthenticated, checkAdmin, ProductController.deleteProduct);

module.exports = router;
