const https = require('https');
const crypto = require('crypto');

const qrSessionStore = new Map();

function safeJson(res, statusCode, payload) {
  if (!res || res.headersSent || res.writableEnded) return;
  res.status(statusCode).json(payload);
}

function getConfig(req) {
  const apiBase = (process.env.NETS_API_BASE || 'https://sandbox.nets.openapipaas.com').trim();
  const apiKey = (process.env.NETS_API_KEY || process.env.API_KEY || '').trim();
  const projectId = (process.env.NETS_PROJECT_ID || process.env.PROJECT_ID || '').trim();
  const txnId = (process.env.NETS_TXN_ID || '').trim();
  const subject = (process.env.NETS_SUBJECT || 'Order Payment').trim();
  const rawBaseUrl = (process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`).trim();
  const appBaseUrl = rawBaseUrl.replace(/\/+$/, '');
  return { apiBase, apiKey, projectId, txnId, subject, appBaseUrl };
}

function assertConfig(config) {
  if (!config.appBaseUrl) return 'Invalid app base url';
  if (!config.apiBase) return 'Missing NETS_API_BASE in .env';
  if (!config.apiKey) return 'Missing NETS_API_KEY (or API_KEY) in .env';
  if (!config.projectId) return 'Missing NETS_PROJECT_ID (or PROJECT_ID) in .env';
  if (!config.txnId) return 'Missing NETS_TXN_ID in .env';
  return null;
}

function httpsRequestRaw(method, urlStr, headers, body) {
  const url = new URL(urlStr);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method,
        headers
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: raw }));
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function httpsRequestJson(method, urlStr, headers, payloadObj) {
  const body = payloadObj ? JSON.stringify(payloadObj) : '';
  const resp = await httpsRequestRaw(
    method,
    urlStr,
    {
      ...headers,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    },
    body
  );

  const ok = resp && resp.statusCode >= 200 && resp.statusCode < 300;
  if (!ok) {
    throw new Error(`NETS API HTTP ${resp ? resp.statusCode : 'N/A'}: ${(resp && resp.body ? resp.body : '').slice(0, 300)}`);
  }

  try {
    return resp.body ? JSON.parse(resp.body) : {};
  } catch (e) {
    throw new Error(`Invalid NETS API response: ${(resp && resp.body ? resp.body : '').slice(0, 300)}`);
  }
}

function newTxnId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return crypto.randomBytes(16).toString('hex');
}

function getSession(outTradeNo) {
  const s = qrSessionStore.get(outTradeNo);
  if (!s) return null;
  if (Date.now() - s.createdAt > 30 * 60 * 1000) {
    qrSessionStore.delete(outTradeNo);
    return null;
  }
  return s;
}

async function requestQrCode(config, outTradeNo, amountDollars) {
  const reqBody = {
    txn_id: config.txnId,
    amt_in_dollars: Number(amountDollars).toFixed(2),
    notify_mobile: 0
  };

  const response = await httpsRequestJson(
    'POST',
    `${config.apiBase}/api/v1/common/payments/nets-qr/request`,
    {
      'api-key': config.apiKey,
      'project-id': config.projectId
    },
    reqBody
  );

  const data = response && response.result && response.result.data ? response.result.data : null;
  if (!data) throw new Error('Invalid NETS QR response');

  if (String(data.response_code) !== '00' || Number(data.txn_status) !== 1 || !data.qr_code || !data.txn_retrieval_ref) {
    const msg = data.error_message || 'Failed to generate NETS QR code';
    throw new Error(msg);
  }

  const session = {
    outTradeNo,
    txnRetrievalRef: String(data.txn_retrieval_ref),
    qrCodeBase64: String(data.qr_code),
    createdAt: Date.now()
  };
  qrSessionStore.set(outTradeNo, session);
  return session;
}

async function queryQrTransaction(config, txnRetrievalRef, frontendTimeoutStatus) {
  return httpsRequestJson(
    'POST',
    `${config.apiBase}/api/v1/common/payments/nets-qr/query`,
    {
      'api-key': config.apiKey,
      'project-id': config.projectId
    },
    { txn_retrieval_ref: txnRetrievalRef, frontend_timeout_status: frontendTimeoutStatus }
  );
}

async function buildOrderPayUrl(req, outTradeNo, amount) {
  const config = getConfig(req);
  const configError = assertConfig(config);
  if (configError) throw new Error(configError);

  const session = await requestQrCode(config, outTradeNo, amount);
  const url = `${config.appBaseUrl}/nets/pay?out_trade_no=${encodeURIComponent(outTradeNo)}`;
  const sseUrl = `${config.appBaseUrl}/nets/sse/payment-status/${encodeURIComponent(session.txnRetrievalRef)}?out_trade_no=${encodeURIComponent(outTradeNo)}`;
  return { url, txnRetrievalRef: session.txnRetrievalRef, sseUrl };
}

async function getOrCreateSession(req, outTradeNo, amount) {
  const config = getConfig(req);
  const configError = assertConfig(config);
  if (configError) throw new Error(configError);

  let session = getSession(outTradeNo);
  if (!session) session = await requestQrCode(config, outTradeNo, amount);
  return { config, session };
}

async function queryPaid(req, txnRetrievalRef) {
  const config = getConfig(req);
  const configError = assertConfig(config);
  if (configError) return { ok: false, error: configError };

  try {
    const queryResp = await queryQrTransaction(config, txnRetrievalRef, 0);
    const data = queryResp && queryResp.result && queryResp.result.data ? queryResp.result.data : null;
    if (!data) return { ok: true, paid: false };

    const responseCode = String(data.response_code || '');
    const txnStatus = Number(data.txn_status);
    const paid = responseCode === '00' && txnStatus === 1;

    return { ok: true, paid, responseCode, txnStatus, actionCode: data.action_code ? String(data.action_code) : null };
  } catch (e) {
    return { ok: true, paid: false, error: e && e.message ? e.message : 'Failed to query NETS' };
  }
}

async function refundPayment(req, txnRetrievalRef, amount) {
  const config = getConfig(req);
  const configError = assertConfig(config);
  if (configError) return { ok: false, error: configError };
  if (!txnRetrievalRef) return { ok: false, error: 'Missing NETS transaction reference' };

  // NETS sandbox refund simulation (no API endpoint wired in this project).
  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0) return { ok: false, error: 'Invalid refund amount' };
  return { ok: true, message: 'NETS refund simulated in sandbox' };
}

module.exports = {
  safeJson,
  newTxnId,
  getConfig,
  assertConfig,
  buildOrderPayUrl,
  getOrCreateSession,
  queryPaid,
  refundPayment
};
