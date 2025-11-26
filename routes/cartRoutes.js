const express = require('express');
const router = express.Router();
const CartItemsController = require('../controllers/CartItemsController');
const { checkAuthenticated } = require('../middleware');

// Add to cart
router.post('/add/:id', checkAuthenticated, CartItemsController.addToCart);

// View cart
router.get('/', checkAuthenticated, CartItemsController.showCart);

// Update quantity
router.post('/update/:id', checkAuthenticated, CartItemsController.updateQuantity);

// Delete item
router.post('/delete/:id', checkAuthenticated, CartItemsController.deleteItem);

// Clear cart
router.get('/clear', checkAuthenticated, CartItemsController.clearCart);

module.exports = router;
