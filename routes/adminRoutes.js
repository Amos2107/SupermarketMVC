const express = require('express');
const router = express.Router();

const { checkAuthenticated, checkAdmin } = require('../middleware');
const AdminController = require('../controllers/AdminController');

router.get('/admin/users', checkAuthenticated, checkAdmin, AdminController.listUsers);
router.post('/admin/users/:id/make-admin', checkAuthenticated, checkAdmin, AdminController.makeAdmin);
router.post('/admin/users/:id/delete', checkAuthenticated, checkAdmin, AdminController.deleteUser);
router.get('/admin/inventory-health', checkAuthenticated, checkAdmin, AdminController.inventoryHealth);

module.exports = router;
