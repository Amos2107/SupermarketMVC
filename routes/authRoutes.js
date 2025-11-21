const express = require('express');
const router = express.Router();

const {
  validateRegistration,
  checkAuthenticated
} = require('../middleware');

const UserController = require('../controllers/UserController');

// Login
router.get('/login', UserController.showLogin);
router.post('/login', UserController.login);

// Register
router.get('/register', UserController.showRegister);
router.post('/register', validateRegistration, UserController.register);

// Logout
router.get('/logout', UserController.logout);

module.exports = router;
