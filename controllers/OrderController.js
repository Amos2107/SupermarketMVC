const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const CartItem = require('../models/CartItem');
const Product = require('../models/Product');

const OrderController = {

  // USER - View their own orders
  myOrders(req, res) {
    const userId = req.session.user.id;

    Order.findByUser(userId, (err, orders) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error loading orders');
      }
      res.render('orders', { orders });
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
                  req.flash('success', 'Order placed successfully!');
                  res.redirect(`/orders/${orderId}`);
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

    Order.findByIdWithUser(orderId, (err, orderData) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error loading order');
      }

      OrderItem.findDetailsByOrder(orderId, (itemErr, items) => {
        if (itemErr) {
          console.error(itemErr);
          return res.status(500).send('Error loading order items');
        }

        res.render('orderDetails', {
          order: orderData && orderData[0],
          items
        });
      });
    });
  }
};

module.exports = OrderController;
