const express = require('express');
const router = express.Router();
const { checkAuthenticated, checkAdmin } = require('../middleware');
const OrderController = require('../controllers/OrderController');

// User
router.get('/orders', checkAuthenticated, OrderController.getUserOrders);
router.post('/orders/checkout', checkAuthenticated, OrderController.checkout);
router.get('/orders/:id', checkAuthenticated, OrderController.getOrderDetails);

// Admin
router.get('/admin/orders', checkAuthenticated, checkAdmin, OrderController.getAllOrders);

module.exports = router;
