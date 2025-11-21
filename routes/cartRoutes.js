const express = require('express');
const router = express.Router();

const { checkAuthenticated } = require('../middleware');
const CartItemsController = require('../controllers/CartItemsController');

// Add to cart
router.post('/add/:id', checkAuthenticated, CartItemsController.addToCart);

// View cart
router.get('/', checkAuthenticated, CartItemsController.showCart);

// Clear cart
router.get('/clear', checkAuthenticated, CartItemsController.clearCart);

// Update quantity
router.post('/update/:id', checkAuthenticated, CartItemsController.updateQuantity);

// Delete item
router.post('/delete/:id', checkAuthenticated, CartItemsController.deleteItem);

module.exports = router;
