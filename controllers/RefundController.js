const Order = require('../models/Order');
const Product = require('../models/Product');
const RefundRequest = require('../models/RefundRequest');
const paypalSandbox = require('../utils/paypalSandbox');
const netsSandbox = require('../utils/netsSandbox');

const RefundController = {
  showRequestForm(req, res) {
    const currentUser = req.session.user;
    const preselectOrderId = req.query.orderId ? parseInt(req.query.orderId, 10) : null;

    RefundRequest.findEligibleOrders(currentUser.id, currentUser.role === 'admin', (err, orders) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Unable to load refundable orders.');
        return res.redirect('/orders');
      }

      res.render('refundRequest', {
        orders,
        preselectOrderId
      });
    });
  },

  submitRequest(req, res) {
    const currentUser = req.session.user;
    const orderId = parseInt(req.body.orderId, 10);
    const requestedAmount = Number(req.body.requestedAmount);
    const reason = (req.body.reason || '').toString().trim();

    if (Number.isNaN(orderId)) {
      req.flash('error', 'Invalid order.');
      return res.redirect('/refunds/new');
    }

    if (!reason) {
      req.flash('error', 'Refund reason is required.');
      return res.redirect('/refunds/new');
    }

    Order.findByIdWithUser(orderId, (err, orderData) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Unable to load order.');
        return res.redirect('/refunds/new');
      }

      const order = orderData && orderData[0];
      if (!order) {
        req.flash('error', 'Order not found.');
        return res.redirect('/refunds/new');
      }

      if (currentUser.role !== 'admin' && order.userId !== currentUser.id) {
        req.flash('error', 'Access denied.');
        return res.redirect('/refunds/new');
      }

      const statusLower = String(order.status || '').toLowerCase();
      if (statusLower !== 'paid') {
        req.flash('error', 'Only paid orders can be refunded.');
        return res.redirect('/refunds/new');
      }

      if (!order.paid_at) {
        req.flash('error', 'Paid date missing for refund.');
        return res.redirect('/refunds/new');
      }

      const paidAt = new Date(order.paid_at);
      if (Number.isNaN(paidAt.getTime())) {
        req.flash('error', 'Invalid paid date for refund.');
        return res.redirect('/refunds/new');
      }

      const refundWindowMs = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - paidAt.getTime() > refundWindowMs) {
        req.flash('error', 'Refund window expired (7 days).');
        return res.redirect('/refunds/new');
      }

      RefundRequest.findByOrder(orderId, (reqErr, existing) => {
        if (reqErr) {
          console.error(reqErr);
          req.flash('error', 'Unable to check existing refunds.');
          return res.redirect('/refunds/new');
        }

        if (existing && existing.status && String(existing.status).toLowerCase() !== 'rejected') {
          req.flash('error', 'Refund request already exists for this order.');
          return res.redirect('/refunds/new');
        }

        const total = Number(order.totalAmount || 0);
        let amount = Number.isFinite(requestedAmount) && requestedAmount > 0 ? requestedAmount : total;
        if (amount > total) amount = total;

        RefundRequest.create(
          {
            orderId: order.id,
            userId: order.userId,
            requestedAmount: amount,
            reason
          },
          (createErr) => {
            if (createErr) {
              console.error(createErr);
              req.flash('error', 'Failed to submit refund request.');
              return res.redirect('/refunds/new');
            }

            req.flash('success', 'Refund request submitted. Pending admin approval.');
            return res.redirect(`/orders/${order.id}`);
          }
        );
      });
    });
  },

  userList(req, res) {
    const currentUser = req.session.user;
    RefundRequest.findByUser(currentUser.id, (err, requests) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Unable to load refund requests.');
        return res.redirect('/orders');
      }

      res.render('refunds', { requests });
    });
  },

  adminList(req, res) {
    RefundRequest.listAllWithDetails((err, requests) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Unable to load refund requests.');
        return res.redirect('/admin/orders');
      }

      res.render('adminRefunds', {
        requests
      });
    });
  },

  adminApprove(req, res) {
    const requestId = parseInt(req.params.id, 10);
    const adminId = req.session.user.id;
    const approvedAmount = Number(req.body.approvedAmount);
    const decisionNote = (req.body.decisionNote || '').toString().trim();

    if (Number.isNaN(requestId)) {
      req.flash('error', 'Invalid request.');
      return res.redirect('/admin/refunds');
    }

    RefundRequest.findByIdWithDetails(requestId, (err, request) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Unable to load refund request.');
        return res.redirect('/admin/refunds');
      }

      if (!request) {
        req.flash('error', 'Refund request not found.');
        return res.redirect('/admin/refunds');
      }

      if (String(request.status).toLowerCase() !== 'pending') {
        req.flash('error', 'Refund request is not pending.');
        return res.redirect('/admin/refunds');
      }

      if (String(request.orderStatus || '').toLowerCase() !== 'paid') {
        req.flash('error', 'Order is not in Paid status.');
        return res.redirect('/admin/refunds');
      }

      const paidAt = request.paid_at ? new Date(request.paid_at) : null;
      if (!paidAt || Number.isNaN(paidAt.getTime())) {
        req.flash('error', 'Invalid paid date for refund.');
        return res.redirect('/admin/refunds');
      }

      const refundWindowMs = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - paidAt.getTime() > refundWindowMs) {
        req.flash('error', 'Refund window expired (7 days).');
        return res.redirect('/admin/refunds');
      }

      const total = Number(request.orderTotal || 0);
      if (!Number.isFinite(approvedAmount) || approvedAmount <= 0 || approvedAmount > total) {
        req.flash('error', 'Invalid approved amount.');
        return res.redirect('/admin/refunds');
      }

      const method = String(request.payment_method || '').toLowerCase();
      const providerRef = request.payment_provider_ref;

      const finishApprove = () => {
        Product.incrementStockFromOrder(request.orderId, (stockErr) => {
          if (stockErr) {
            console.error(stockErr);
            return res.status(500).send('Error restoring stock');
          }

          const newStatus = approvedAmount < total ? 'Partially Refunded' : 'Refunded';
          Order.updateStatus(request.orderId, newStatus, (statusErr) => {
            if (statusErr) {
              console.error(statusErr);
              return res.status(500).send('Error updating order status');
            }

            RefundRequest.approve(requestId, adminId, approvedAmount, decisionNote, (approveErr) => {
              if (approveErr) {
                console.error(approveErr);
                return res.status(500).send('Error updating refund request');
              }

              req.flash('success', `Refunded $${approvedAmount.toFixed(2)} successfully.`);
              return res.redirect('/admin/refunds');
            });
          });
        });
      };

      (async () => {
        try {
          if (method === 'paypal') {
            if (!providerRef) throw new Error('Missing PayPal capture id for refund.');
            await paypalSandbox.refundCapture(req, providerRef, approvedAmount);
          } else if (method === 'nets') {
            const refundResult = await netsSandbox.refundPayment(req, providerRef, approvedAmount);
            if (!refundResult.ok) throw new Error(refundResult.error || 'NETS refund failed.');
          } else {
            throw new Error('Unsupported payment method for refund.');
          }
          finishApprove();
        } catch (e) {
          req.flash('error', e && e.message ? e.message : 'Refund failed.');
          return res.redirect('/admin/refunds');
        }
      })();
    });
  },

  adminReject(req, res) {
    const requestId = parseInt(req.params.id, 10);
    const adminId = req.session.user.id;
    const decisionNote = (req.body.decisionNote || '').toString().trim();

    if (Number.isNaN(requestId)) {
      req.flash('error', 'Invalid request.');
      return res.redirect('/admin/refunds');
    }

    RefundRequest.reject(requestId, adminId, decisionNote, (err, result) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Failed to reject refund request.');
        return res.redirect('/admin/refunds');
      }
      if (result.affectedRows === 0) {
        req.flash('error', 'Refund request is not pending.');
        return res.redirect('/admin/refunds');
      }
      req.flash('success', 'Refund request rejected.');
      return res.redirect('/admin/refunds');
    });
  }
};

module.exports = RefundController;
