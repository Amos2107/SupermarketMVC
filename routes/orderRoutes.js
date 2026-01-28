const express = require('express');
const router = express.Router();

const { checkAuthenticated, checkAdmin } = require('../middleware');
const OrderController = require('../controllers/OrderController');

// ✅ USER — view their orders
router.get('/orders', checkAuthenticated, OrderController.myOrders);

// ✅ USER — view single order details
router.get('/orders/:id', checkAuthenticated, OrderController.orderDetails);

// ✅ USER — payment page
router.get('/orders/:id/pay', checkAuthenticated, OrderController.showOrderPayPage);
router.post('/orders/:id/pay/start', checkAuthenticated, OrderController.startOrderPayment);
router.get('/orders/:id/pay/status', checkAuthenticated, OrderController.checkOrderPaymentStatus);
router.get('/orders/:id/pay/finish', checkAuthenticated, OrderController.finishOrderPayment);

// ✅ USER — NETS QR payment
router.get('/nets/pay', checkAuthenticated, OrderController.netsPayPage);
router.get('/nets/sse/payment-status/:txnRetrievalRef', checkAuthenticated, OrderController.netsPaymentSse);

// ✅ USER — Checkout
router.post('/checkout', checkAuthenticated, OrderController.checkout);

// ✅ ADMIN — view ALL orders
router.get('/admin/orders', checkAuthenticated, checkAdmin, OrderController.adminOrders);

module.exports = router;
