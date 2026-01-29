const db = require('../db');

const RefundRequest = {
  create(data, callback) {
    const { orderId, userId, requestedAmount, reason } = data;
    db.query(
      `INSERT INTO refund_requests (orderId, userId, requested_amount, reason, status)
       VALUES (?, ?, ?, ?, 'Pending')`,
      [orderId, userId, requestedAmount, reason],
      callback
    );
  },

  findByOrder(orderId, callback) {
    db.query(
      `SELECT * FROM refund_requests WHERE orderId = ? ORDER BY created_at DESC LIMIT 1`,
      [orderId],
      (err, rows) => {
        if (err) return callback(err);
        callback(null, rows && rows[0] ? rows[0] : null);
      }
    );
  },

  findByUser(userId, callback) {
    db.query(
      `SELECT rr.*,
              o.total AS orderTotal,
              o.payment_method,
              o.paid_at
       FROM refund_requests rr
       JOIN orders o ON rr.orderId = o.id
       WHERE rr.userId = ?
       ORDER BY rr.created_at DESC`,
      [userId],
      callback
    );
  },

  findEligibleOrders(userId, isAdmin, callback) {
    const userFilter = isAdmin ? '' : 'AND o.userId = ?';
    const params = isAdmin ? [] : [userId];
    db.query(
      `SELECT o.id, o.total AS totalAmount, o.paid_at, o.payment_method, o.status
       FROM orders o
       LEFT JOIN refund_requests rr ON rr.orderId = o.id AND rr.status IN ('Pending', 'Approved')
       WHERE o.status = 'Paid'
         AND o.paid_at >= NOW() - INTERVAL 7 DAY
         AND rr.id IS NULL
         ${userFilter}
       ORDER BY o.paid_at DESC`,
      params,
      callback
    );
  },

  listAllWithDetails(callback) {
    db.query(
      `SELECT rr.id, rr.orderId, rr.userId, rr.requested_amount, rr.reason, rr.status,
              rr.adminId, rr.approved_amount, rr.decision_note, rr.created_at, rr.updated_at, rr.decided_at,
              o.total AS orderTotal, o.status AS orderStatus, o.payment_method, o.payment_provider_ref, o.paid_at,
              u.username, u.email
       FROM refund_requests rr
       JOIN orders o ON rr.orderId = o.id
       JOIN users u ON rr.userId = u.id
       ORDER BY rr.created_at DESC`,
      callback
    );
  },

  findByIdWithDetails(id, callback) {
    db.query(
      `SELECT rr.id, rr.orderId, rr.userId, rr.requested_amount, rr.reason, rr.status,
              rr.adminId, rr.approved_amount, rr.decision_note, rr.created_at, rr.updated_at, rr.decided_at,
              o.total AS orderTotal, o.status AS orderStatus, o.payment_method, o.payment_provider_ref, o.paid_at,
              u.username, u.email
       FROM refund_requests rr
       JOIN orders o ON rr.orderId = o.id
       JOIN users u ON rr.userId = u.id
       WHERE rr.id = ?
       LIMIT 1`,
      [id],
      (err, rows) => {
        if (err) return callback(err);
        callback(null, rows && rows[0] ? rows[0] : null);
      }
    );
  },

  approve(id, adminId, approvedAmount, decisionNote, callback) {
    db.query(
      `UPDATE refund_requests
       SET status = 'Approved',
           adminId = ?,
           approved_amount = ?,
           decision_note = ?,
           decided_at = NOW()
       WHERE id = ? AND status = 'Pending'`,
      [adminId, approvedAmount, decisionNote || null, id],
      callback
    );
  },

  reject(id, adminId, decisionNote, callback) {
    db.query(
      `UPDATE refund_requests
       SET status = 'Rejected',
           adminId = ?,
           decision_note = ?,
           decided_at = NOW()
       WHERE id = ? AND status = 'Pending'`,
      [adminId, decisionNote || null, id],
      callback
    );
  }
};

module.exports = RefundRequest;
