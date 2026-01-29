const express = require('express');
const router = express.Router();

const { checkAuthenticated, checkAdmin } = require('../middleware');
const RefundController = require('../controllers/RefundController');

router.get('/refunds/new', checkAuthenticated, RefundController.showRequestForm);
router.post('/refunds', checkAuthenticated, RefundController.submitRequest);
router.get('/refunds', checkAuthenticated, RefundController.userList);

router.get('/admin/refunds', checkAuthenticated, checkAdmin, RefundController.adminList);
router.post('/admin/refunds/:id/approve', checkAuthenticated, checkAdmin, RefundController.adminApprove);
router.post('/admin/refunds/:id/reject', checkAuthenticated, checkAdmin, RefundController.adminReject);

module.exports = router;
