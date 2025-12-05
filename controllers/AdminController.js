const User = require('../models/User');
const Product = require('../models/Product');

const AdminController = {
  listUsers(req, res) {
    User.findAll((err, users) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Unable to load users.');
        return res.redirect('/');
      }
      res.render('adminUsers', {
        users,
        messages: res.locals.messages
      });
    });
  },

  makeAdmin(req, res) {
    const targetId = parseInt(req.params.id, 10);

    if (Number.isNaN(targetId)) {
      req.flash('error', 'Invalid user.');
      return res.redirect('/admin/users');
    }

    User.updateRole(targetId, 'admin', (err, result) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Could not update role.');
        return res.redirect('/admin/users');
      }

      if (result.affectedRows === 0) {
        req.flash('error', 'User not found.');
      } else {
        req.flash('success', 'User upgraded to admin.');
      }
      res.redirect('/admin/users');
    });
  },

  deleteUser(req, res) {
    const targetId = parseInt(req.params.id, 10);

    if (Number.isNaN(targetId)) {
      req.flash('error', 'Invalid user.');
      return res.redirect('/admin/users');
    }

    if (req.session.user && req.session.user.id === targetId) {
      req.flash('error', 'You cannot delete your own account.');
      return res.redirect('/admin/users');
    }

    User.deleteUserWithAssociations(targetId, (err) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Delete failed. Changes were reverted.');
        return res.redirect('/admin/users');
      }

      req.flash('success', 'User and their transactions deleted.');
      res.redirect('/admin/users');
    });
  },

  inventoryHealth(req, res) {
    const threshold = 10; // static threshold for low stock; can be made configurable

    Product.getInventoryHealth(threshold, (err, data) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Unable to load inventory data.');
        return res.redirect('/');
      }

      res.render('adminInventoryHealth', {
        kpis: data.kpis,
        lowStock: data.lowStock,
        outOfStock: data.outOfStock,
        topSelling: data.topSelling,
        messages: res.locals.messages
      });
    });
  }
};

module.exports = AdminController;
