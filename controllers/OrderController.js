const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const CartItem = require('../models/CartItem');
const Product = require('../models/Product');
const RefundRequest = require('../models/RefundRequest');
const paypalSandbox = require('../utils/paypalSandbox');
const netsSandbox = require('../utils/netsSandbox');
const User = require('../models/User');

const OrderController = {

  // USER - View their own orders
  myOrders(req, res) {
    const userId = req.session.user.id;

    Order.findByUser(userId, (err, orders) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error loading orders');
      }
      RefundRequest.findByUser(userId, (refundErr, refunds) => {
        if (refundErr) {
          console.error(refundErr);
          return res.status(500).send('Error loading refunds');
        }

        const refundMap = {};
        (refunds || []).forEach((r) => {
          if (!refundMap[r.orderId]) refundMap[r.orderId] = r;
        });

        res.render('orders', { orders, refundMap });
      });
    });
  },

  // ADMIN - View ALL orders
  adminOrders(req, res) {
    Order.findAllWithUsernames((err, orders) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error loading orders');
      }
      res.render('adminOrders', { orders });
    });
  },

  // CHECKOUT - Convert cart into an order
  checkout(req, res) {
    const userId = req.session.user.id;

    // 1. Find active cart
    CartItem.findActiveCartId(userId, (err, cartId) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error finding cart');
      }

      if (!cartId) {
        req.flash('error', 'No items to checkout.');
        return res.redirect('/cart');
      }

      // 2a. Validate stock for each item before proceeding
      CartItem.getCartItemsWithStock(cartId, (stockErr, cartItems) => {
        if (stockErr) {
          console.error(stockErr);
          return res.status(500).send('Error validating stock');
        }

        if (!cartItems || cartItems.length === 0) {
          req.flash('error', 'No items to checkout.');
          return res.redirect('/cart');
        }

        const insufficient = cartItems.find((item) => item.cartQty > item.stock);
        if (insufficient) {
          req.flash(
            'error',
            `Not enough stock for ${insufficient.productName}. Available: ${insufficient.stock}.`
          );
          return res.redirect('/cart');
        }

        // 2b. Calculate total
        CartItem.getCartItemsTotal(cartId, (totalErr, totalResult) => {
          if (totalErr) {
            console.error(totalErr);
            return res.status(500).send('Error calculating total');
          }

          const totalAmount = (totalResult && totalResult[0] && totalResult[0].total) || 0;

          // 3. Create order record
          Order.create(userId, totalAmount, (orderErr, orderInsert) => {
            if (orderErr) {
              console.error(orderErr);
              return res.status(500).send('Error creating order');
            }

            const orderId = orderInsert.insertId;

            // 4. Copy items to order_items
            CartItem.copyCartItemsToOrder(cartId, orderId, (copyErr) => {
              if (copyErr) {
                console.error(copyErr);
                return res.status(500).send('Error finalizing order');
              }

              // 5. Reduce inventory stock (after validation; no clamping)
              Product.decrementStockFromCart(cartId, (decrementErr) => {
                if (decrementErr) {
                  console.error(decrementErr);
                  return res.status(500).send('Error updating stock');
                }

                // 6. Mark cart as checked out
                CartItem.markCartStatus(cartId, 'checkedout', () => {
                  Order.updateStatus(orderId, 'Unpaid', () => {
                    req.flash('success', 'Order created. Please complete payment.');
                    res.redirect(`/orders/${orderId}/pay`);
                  });
                });
              });
            });
          });
        });
      });
    });
  },

  // ORDER DETAILS PAGE
  orderDetails(req, res) {
    const orderId = req.params.id;
    const currentUser = req.session.user;

    Order.findByIdWithUser(orderId, (err, orderData) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error loading order');
      }

      const order = orderData && orderData[0];
      if (!order) return res.status(404).send('Order not found');
      if (currentUser.role !== 'admin' && order.userId !== currentUser.id) return res.status(403).send('Access denied');

      OrderItem.findDetailsByOrder(orderId, (itemErr, items) => {
        if (itemErr) {
          console.error(itemErr);
          return res.status(500).send('Error loading order items');
        }
        RefundRequest.findByOrder(orderId, (refundErr, refundRequest) => {
          if (refundErr) {
            console.error(refundErr);
            return res.status(500).send('Error loading refund');
          }

          const paidAt = order.paid_at ? new Date(order.paid_at) : null;
          const refundWindowMs = 7 * 24 * 60 * 60 * 1000;
          const canRequestRefund =
            String(order.status || '').toLowerCase() === 'paid' &&
            paidAt &&
            !Number.isNaN(paidAt.getTime()) &&
            Date.now() - paidAt.getTime() <= refundWindowMs &&
            (!refundRequest || String(refundRequest.status || '').toLowerCase() === 'rejected');

          res.render('orderDetails', {
            order,
            items,
            refundRequest,
            canRequestRefund
          });
        });
      });
    });
  },

  invoicePage(req, res) {
    const orderId = parseInt(req.params.id, 10);
    const currentUser = req.session.user;
    if (Number.isNaN(orderId)) return res.status(400).send('Invalid order ID');

    Order.findByIdWithUser(orderId, (err, orderData) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error loading order');
      }

      const order = orderData && orderData[0];
      if (!order) return res.status(404).send('Order not found');
      if (currentUser.role !== 'admin' && order.userId !== currentUser.id) return res.status(403).send('Access denied');

      OrderItem.findDetailsByOrder(orderId, (itemErr, items) => {
        if (itemErr) {
          console.error(itemErr);
          return res.status(500).send('Error loading order items');
        }
        RefundRequest.findByOrder(orderId, (refundErr, refundRequest) => {
          if (refundErr) {
            console.error(refundErr);
            return res.status(500).send('Error loading refund');
          }
          User.findById(order.userId, (userErr, users) => {
            if (userErr) {
              console.error(userErr);
              return res.status(500).send('Error loading user');
            }
            const user = users && users[0] ? users[0] : { username: order.username, email: '', address: '', contact: '' };
            res.render('invoice', { order, items, refundRequest, user });
          });
        });
      });
    });
  },

  showOrderPayPage(req, res) {
    const orderId = parseInt(req.params.id, 10);
    const currentUser = req.session.user;
    if (Number.isNaN(orderId)) return res.status(400).send('Invalid order ID');

    Order.findByIdWithUser(orderId, (err, orderData) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error loading order');
      }

      const order = orderData && orderData[0];
      if (!order) return res.status(404).send('Order not found');
      if (currentUser.role !== 'admin' && order.userId !== currentUser.id) return res.status(403).send('Access denied');

      if ((order.status || '').toString().toLowerCase() === 'paid') {
        req.flash('success', 'Order already paid');
        return res.redirect(`/orders/${orderId}`);
      }
      if ((order.status || '').toString().toLowerCase().includes('refund')) {
        req.flash('error', 'Order has been refunded.');
        return res.redirect(`/orders/${orderId}`);
      }
      if ((order.status || '').toString().toLowerCase() === 'cancelled') {
        req.flash('error', 'Order is cancelled.');
        return res.redirect(`/orders/${orderId}`);
      }

      res.render('orderPay', { order });
    });
  },

  startOrderPayment(req, res) {
    const orderId = parseInt(req.params.id, 10);
    const currentUser = req.session.user;
    const paymentMethod = (req.body.paymentMethod || '').toString().trim().toLowerCase();

    if (Number.isNaN(orderId)) return paypalSandbox.safeJson(res, 400, { ok: false, error: 'Invalid order ID' });
    if (paymentMethod !== 'paypal' && paymentMethod !== 'nets') {
      return paypalSandbox.safeJson(res, 400, { ok: false, error: 'Invalid payment method' });
    }

    Order.findByIdWithUser(orderId, async (err, orderData) => {
      if (err) return paypalSandbox.safeJson(res, 500, { ok: false, error: 'Error loading order' });
      const order = orderData && orderData[0];
      if (!order) return paypalSandbox.safeJson(res, 404, { ok: false, error: 'Order not found' });
      if (currentUser.role !== 'admin' && order.userId !== currentUser.id) return paypalSandbox.safeJson(res, 403, { ok: false, error: 'Access denied' });

      const statusLower = (order.status || '').toString().toLowerCase();
      if (statusLower === 'paid') return paypalSandbox.safeJson(res, 200, { ok: true, alreadyPaid: true });
      if (statusLower.includes('refund')) return paypalSandbox.safeJson(res, 400, { ok: false, error: 'Order has been refunded' });
      if (statusLower === 'cancelled') return paypalSandbox.safeJson(res, 400, { ok: false, error: 'Order is cancelled' });

      const outTradeNo = `ORDER_${order.id}_${Date.now()}`;
      const subtotal = Number(order.totalAmount);
      const amount = Number.isFinite(subtotal) ? subtotal : 0;

      try {
        if (paymentMethod === 'paypal') {
          const created = await paypalSandbox.buildOrderPayUrl(req, { id: order.id, total: amount }, outTradeNo);
          return Order.startPayment(order.id, order.userId, 'paypal', created.outTradeNo, created.providerOrderId, (e) => {
            if (e) return paypalSandbox.safeJson(res, 500, { ok: false, error: e.message || 'Failed to start payment' });
            return paypalSandbox.safeJson(res, 200, { ok: true, outTradeNo: created.outTradeNo, url: created.url });
          });
        }

        const netsCreated = await netsSandbox.buildOrderPayUrl(req, outTradeNo, amount);
        return Order.startPayment(order.id, order.userId, 'nets', outTradeNo, netsCreated.txnRetrievalRef, (e) => {
          if (e) return paypalSandbox.safeJson(res, 500, { ok: false, error: e.message || 'Failed to start payment' });
          return paypalSandbox.safeJson(res, 200, { ok: true, outTradeNo, url: netsCreated.url, sseUrl: netsCreated.sseUrl });
        });
      } catch (e) {
        return paypalSandbox.safeJson(res, 500, { ok: false, error: e && e.message ? e.message : 'Failed to start payment' });
      }
    });
  },

  checkOrderPaymentStatus(req, res) {
    const orderId = parseInt(req.params.id, 10);
    const currentUser = req.session.user;
    const outTradeNo = (req.query.out_trade_no || '').toString().trim();

    if (Number.isNaN(orderId)) return paypalSandbox.safeJson(res, 400, { ok: false, error: 'Invalid order ID' });
    if (!outTradeNo) return paypalSandbox.safeJson(res, 400, { ok: false, error: 'Missing out_trade_no' });

    Order.findByIdWithUser(orderId, async (err, orderData) => {
      if (err) return paypalSandbox.safeJson(res, 500, { ok: false, error: 'Error loading order' });
      const order = orderData && orderData[0];
      if (!order) return paypalSandbox.safeJson(res, 404, { ok: false, error: 'Order not found' });
      if (currentUser.role !== 'admin' && order.userId !== currentUser.id) return paypalSandbox.safeJson(res, 403, { ok: false, error: 'Access denied' });

      const statusLower = (order.status || '').toString().toLowerCase();
      if (statusLower === 'paid') return paypalSandbox.safeJson(res, 200, { ok: true, paid: true });
      if (statusLower.includes('refund')) return paypalSandbox.safeJson(res, 400, { ok: false, error: 'Order has been refunded' });
      if (statusLower === 'cancelled') return paypalSandbox.safeJson(res, 400, { ok: false, error: 'Order is cancelled' });

      if (order.payment_out_trade_no && String(order.payment_out_trade_no) !== outTradeNo) {
        return paypalSandbox.safeJson(res, 400, { ok: false, error: 'out_trade_no not match this order' });
      }

      const method = (order.payment_method || '').toString().trim().toLowerCase();

      if (method === 'paypal') {
        const result = await paypalSandbox.queryOrderPaid(req, order.id, order.payment_provider_ref);
        if (!result.ok) return paypalSandbox.safeJson(res, 500, { ok: false, error: result.error || 'Failed to query PayPal' });
        if (!result.paid) return paypalSandbox.safeJson(res, 200, { ok: true, paid: false, orderStatus: result.orderStatus || null, error: result.error || null });

        return Order.markPaid(order.id, order.userId, result.captureId || order.payment_provider_ref || null, (e) => {
          if (e) return paypalSandbox.safeJson(res, 500, { ok: false, error: e.message || 'Failed to mark paid' });
          return paypalSandbox.safeJson(res, 200, { ok: true, paid: true, orderStatus: 'COMPLETED' });
        });
      }

      if (method === 'nets') {
        const txnRetrievalRef = order.payment_provider_ref ? String(order.payment_provider_ref) : null;
        if (!txnRetrievalRef) return paypalSandbox.safeJson(res, 200, { ok: true, paid: false, error: 'NETS session expired. Please start payment again.' });

        const result = await netsSandbox.queryPaid(req, txnRetrievalRef);
        if (!result.ok) return paypalSandbox.safeJson(res, 500, { ok: false, error: result.error || 'Failed to query NETS' });
        if (!result.paid) {
          return paypalSandbox.safeJson(res, 200, {
            ok: true,
            paid: false,
            responseCode: result.responseCode || null,
            txnStatus: result.txnStatus || null,
            actionCode: result.actionCode || null,
            error: result.error || null
          });
        }

        return Order.markPaid(order.id, order.userId, txnRetrievalRef, (e) => {
          if (e) return paypalSandbox.safeJson(res, 500, { ok: false, error: e.message || 'Failed to mark paid' });
          return paypalSandbox.safeJson(res, 200, { ok: true, paid: true, responseCode: result.responseCode || null, txnStatus: result.txnStatus || null });
        });
      }

      return paypalSandbox.safeJson(res, 400, { ok: false, error: 'Order payment method not started' });
    });
  },

  async finishOrderPayment(req, res) {
    const orderId = parseInt(req.params.id, 10);
    const currentUser = req.session.user;
    const outTradeNo = (req.query.out_trade_no || '').toString().trim();
    if (Number.isNaN(orderId)) return res.status(400).send('Invalid order ID');

    const order = await new Promise((resolve, reject) => {
      Order.findByIdWithUser(orderId, (err, orderData) => {
        if (err) return reject(err);
        resolve(orderData && orderData[0] ? orderData[0] : null);
      });
    }).catch((err) => {
      console.error(err);
      return null;
    });

    if (!order) return res.status(404).send('Order not found');
    if (currentUser.role !== 'admin' && order.userId !== currentUser.id) return res.status(403).send('Access denied');

    if (outTradeNo && order.payment_out_trade_no && String(order.payment_out_trade_no) !== outTradeNo) {
      req.flash('error', 'out_trade_no not match this order');
      return res.redirect(`/orders/${orderId}/pay`);
    }

    const statusLower = (order.status || '').toString().toLowerCase();
    if (statusLower === 'paid') {
      req.flash('success', 'Payment successful');
      return res.redirect(`/orders/${orderId}`);
    }
    if (statusLower.includes('refund')) {
      req.flash('error', 'Order has been refunded');
      return res.redirect(`/orders/${orderId}`);
    }
    if (statusLower === 'cancelled') {
      req.flash('error', 'Order is cancelled');
      return res.redirect(`/orders/${orderId}`);
    }

    const method = (order.payment_method || '').toString().trim().toLowerCase();

    if (method === 'paypal') {
      const result = await paypalSandbox.queryOrderPaid(req, order.id, order.payment_provider_ref);
      if (result && result.ok && result.paid) {
        await new Promise((resolve) => {
          Order.markPaid(order.id, order.userId, result.captureId || order.payment_provider_ref || null, () => resolve());
        });
        req.flash('success', 'Payment successful');
        return res.redirect(`/orders/${orderId}`);
      }
      req.flash('error', result && result.error ? result.error : 'Payment not completed');
      return res.redirect(`/orders/${orderId}/pay`);
    }

    if (method === 'nets') {
      const txnRetrievalRef = order.payment_provider_ref ? String(order.payment_provider_ref) : null;
      if (txnRetrievalRef) {
        const result = await netsSandbox.queryPaid(req, txnRetrievalRef);
        if (result && result.ok && result.paid) {
          await new Promise((resolve) => {
            Order.markPaid(order.id, order.userId, txnRetrievalRef, () => resolve());
          });
          req.flash('success', 'Payment successful');
          return res.redirect(`/orders/${orderId}`);
        }
      }
      req.flash('error', 'Payment not completed');
      return res.redirect(`/orders/${orderId}/pay`);
    }

    req.flash('error', 'Payment not completed');
    return res.redirect(`/orders/${orderId}/pay`);
  },

  netsPayPage(req, res) {
    const currentUser = req.session.user;
    const outTradeNo = (req.query.out_trade_no || '').toString().trim();
    if (!outTradeNo) return res.status(400).send('Missing out_trade_no');

    Order.findByOutTradeNo(outTradeNo, async (err, order) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error loading order');
      }

      if (!order) return res.status(404).send('Order not found');
      if (currentUser.role !== 'admin' && order.userId !== currentUser.id) return res.status(403).send('Access denied');

      const method = (order.payment_method || '').toString().trim().toLowerCase();
      if (method !== 'nets') return res.status(400).send('Invalid payment method');

      try {
        const subtotal = Number(order.totalAmount);
        const amount = Number.isFinite(subtotal) ? subtotal : 0;
        const { session } = await netsSandbox.getOrCreateSession(req, outTradeNo, amount);

        res.render('netsPay', {
          order,
          outTradeNo,
          amount: amount.toFixed(2),
          txnRetrievalRef: session.txnRetrievalRef,
          sseUrl: `/nets/sse/payment-status/${encodeURIComponent(session.txnRetrievalRef)}?out_trade_no=${encodeURIComponent(outTradeNo)}`,
          qrCodeUrl: `data:image/png;base64,${session.qrCodeBase64}`
        });
      } catch (e) {
        req.flash('error', e && e.message ? e.message : 'Failed to load NETS payment');
        res.redirect(`/orders/${order.id}/pay`);
      }
    });
  },

  netsPaymentSse(req, res) {
    const currentUser = req.session.user;
    const txnRetrievalRef = (req.params.txnRetrievalRef || '').toString().trim();
    const outTradeNo = (req.query.out_trade_no || '').toString().trim();
    if (!txnRetrievalRef || !outTradeNo) return res.status(400).end();

    Order.findByOutTradeNo(outTradeNo, async (err, order) => {
      if (err || !order) return res.status(404).end();
      if (currentUser.role !== 'admin' && order.userId !== currentUser.id) return res.status(403).end();

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      if (typeof res.flushHeaders === 'function') res.flushHeaders();

      let closed = false;
      const close = () => {
        closed = true;
        try {
          res.end();
        } catch (e) {}
      };

      req.on('close', close);

      const send = (obj) => {
        if (closed) return;
        res.write(`data: ${JSON.stringify(obj)}\n\n`);
      };

      const startedAt = Date.now();

      while (!closed) {
        if (Date.now() - startedAt > 10 * 60 * 1000) {
          send({ fail: true, message: 'timeout' });
          close();
          return;
        }

        const result = await netsSandbox.queryPaid(req, txnRetrievalRef);
        if (!result.ok) {
          send({ fail: true, message: result.error || 'nets_error' });
          close();
          return;
        }

        if (result.paid) {
          await new Promise((resolve) => {
            Order.markPaid(order.id, order.userId, txnRetrievalRef, () => resolve());
          });
          send({ success: true });
          close();
          return;
        }

        send({ pending: true, result });
        await new Promise((r) => setTimeout(r, 2000));
      }
    });
  },
  cancelOrder(req, res) {
    const orderId = parseInt(req.params.id, 10);
    const currentUser = req.session.user;
    if (Number.isNaN(orderId)) return res.status(400).send('Invalid order ID');

    Order.findByIdWithUser(orderId, (err, orderData) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error loading order');
      }

      const order = orderData && orderData[0];
      if (!order) return res.status(404).send('Order not found');
      if (currentUser.role !== 'admin' && order.userId !== currentUser.id) return res.status(403).send('Access denied');

      const statusLower = String(order.status || '').toLowerCase();
      if (statusLower === 'paid') {
        req.flash('error', 'Paid orders cannot be cancelled.');
        return res.redirect(`/orders/${orderId}`);
      }
      if (statusLower.includes('refund')) {
        req.flash('error', 'Refunded orders cannot be cancelled.');
        return res.redirect(`/orders/${orderId}`);
      }
      if (statusLower === 'cancelled') {
        req.flash('success', 'Order already cancelled.');
        return res.redirect(`/orders/${orderId}`);
      }

      Product.incrementStockFromOrder(orderId, (stockErr) => {
        if (stockErr) {
          console.error(stockErr);
          return res.status(500).send('Error restoring stock');
        }

        Order.cancel(orderId, (cancelErr) => {
          if (cancelErr) {
            console.error(cancelErr);
            return res.status(500).send('Error cancelling order');
          }

          req.flash('success', 'Order cancelled successfully.');
          return res.redirect(`/orders/${orderId}`);
        });
      });
    });
  }
};

module.exports = OrderController;
