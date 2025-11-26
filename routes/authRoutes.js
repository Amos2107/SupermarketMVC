const express = require('express');
const router = express.Router();

const {
  checkAuthenticated,
  validateRegistration
} = require('../middleware');

const UserController = require('../controllers/UserController');

router.get('/login', UserController.showLogin);
router.post('/login', UserController.login);

router.get('/register', UserController.showRegister);
router.post('/register', validateRegistration, UserController.register);

router.get('/logout', checkAuthenticated, UserController.logout);

module.exports = router;
