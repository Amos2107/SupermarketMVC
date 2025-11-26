const express = require('express');
const router = express.Router();

const { checkAuthenticated, checkAdmin } = require('../middleware');
const OrderController = require('../controllers/OrderController');

// ✅ USER — view their orders
router.get('/orders', checkAuthenticated, OrderController.myOrders);

// ✅ USER — view single order details
router.get('/orders/:id', checkAuthenticated, OrderController.orderDetails);

// ✅ USER — Checkout
router.post('/checkout', checkAuthenticated, OrderController.checkout);

// ✅ ADMIN — view ALL orders
router.get('/admin/orders', checkAuthenticated, checkAdmin, OrderController.adminOrders);

module.exports = router;
