const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const certPath = path.resolve(__dirname, 'certs/staging.kanvtech.com.crt');
const keyPath = path.resolve(__dirname, 'certs/staging.kanvtech.com.key');

if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  console.error('[Reverse Proxy] FATAL: Missing TLS certificates at deploy/staging/certs/');
  process.exit(1);
}

const tlsOptions = {
  cert: fs.readFileSync(certPath),
  key: fs.readFileSync(keyPath),
};

const BACKEND_TARGET = { host: '127.0.0.1', port: parseInt(process.env.BACKEND_PORT || '5000', 10) };
const FRONTEND_TARGET = { host: '127.0.0.1', port: parseInt(process.env.FRONTEND_PORT || '3000', 10) };

function proxyRequest(req, res, target) {
  const options = {
    hostname: target.host,
    port: target.port,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      'x-forwarded-for': req.socket.remoteAddress,
      'x-forwarded-proto': 'https',
      'x-forwarded-host': req.headers.host || 'staging.kanvtech.com',
      host: req.headers.host || `${target.host}:${target.port}`,
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    // Inject HSTS and Security Headers on the outer edge
    const headers = { ...proxyRes.headers };
    headers['strict-transport-security'] = 'max-age=31536000; includeSubDomains';
    headers['x-content-type-options'] = 'nosniff';
    headers['x-frame-options'] = 'SAMEORIGIN';

    res.writeHead(proxyRes.statusCode, headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    console.error(`[Reverse Proxy] Error proxying ${req.method} ${req.url} to ${target.host}:${target.port} - ${err.message}`);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bad Gateway', message: `Target ${target.port} unreachable` }));
    }
  });

  req.pipe(proxyReq, { end: true });
}

// HTTPS Staging Server (Port 443)
const httpsServer = https.createServer(tlsOptions, (req, res) => {
  if (req.url.startsWith('/api')) {
    proxyRequest(req, res, BACKEND_TARGET);
  } else {
    proxyRequest(req, res, FRONTEND_TARGET);
  }
});

// Upgrade handling for WebSockets
httpsServer.on('upgrade', (req, socket, head) => {
  const target = req.url.startsWith('/api') ? BACKEND_TARGET : FRONTEND_TARGET;
  const proxyReq = http.request({
    hostname: target.host,
    port: target.port,
    path: req.url,
    method: req.method,
    headers: req.headers,
  });

  proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
    socket.write('HTTP/1.1 101 Switching Protocols\r\n' +
      Object.keys(proxyRes.headers).map(k => `${k}: ${proxyRes.headers[k]}`).join('\r\n') + '\r\n\r\n');
    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
  });

  proxyReq.on('error', () => {
    socket.destroy();
  });

  proxyReq.end();
});

const HTTPS_PORT = process.env.HTTPS_PORT || 443;
httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`KANVTECH STAGING HTTPS REVERSE PROXY ACTIVE`);
  console.log(`Listening on: https://0.0.0.0:${HTTPS_PORT}`);
  console.log(`Domain: staging.kanvtech.com`);
  console.log(`Routes:`);
  console.log(`  - /api/* -> 127.0.0.1:5000 (NestJS)`);
  console.log(`  - /*     -> 127.0.0.1:3000 (Next.js)`);
  console.log(`=======================================================`);
});

// HTTP Port 80 redirect to HTTPS
const HTTP_PORT = process.env.HTTP_PORT || 80;
const httpServer = http.createServer((req, res) => {
  const host = req.headers.host || 'staging.kanvtech.com';
  const redirectUrl = `https://${host}${req.url}`;
  res.writeHead(301, { Location: redirectUrl });
  res.end(`Redirecting to ${redirectUrl}`);
});

httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`HTTP port ${HTTP_PORT} redirect to HTTPS active.`);
}).on('error', (err) => {
  console.warn(`[Reverse Proxy] Port ${HTTP_PORT} redirect listener notice: ${err.message}`);
});
