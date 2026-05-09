const http = require('http');
const fs = require('fs');
const path = require('path');

const { handleGrowthRoutes } = require('./api/growth');
const { handleSchedulerRoutes } = require('./api/scheduler');
const { handleThreadRoutes } = require('./api/threads');
const { handleLeadRoutes } = require('./api/leads');

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const MAX_BODY_SIZE = 1024 * 1024; // 1MB

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    let aborted = false;
    req.on('data', chunk => {
      if (aborted) return;
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        aborted = true;
        reject(new Error('Payload too large'));
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (aborted) return;
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', () => {
      if (!aborted) resolve({});
    });
  });
}

function serveStaticFile(res, filePath) {
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Not Found');
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.end(data);
  });
}

function parseQuery(search) {
  const query = {};
  if (!search) return query;
  const params = new URLSearchParams(search);
  for (const [key, value] of params) {
    query[key] = value;
  }
  return query;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = parsedUrl.pathname;
  const query = parseQuery(parsedUrl.search);

  // CORS headers for development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // API routes
  if (pathname.startsWith('/api/')) {
    let body;
    try {
      body = await parseBody(req);
    } catch (e) {
      res.statusCode = 413;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Payload too large' }));
      return;
    }

    if (pathname.startsWith('/api/growth/')) {
      if (handleGrowthRoutes(req, res, pathname, query)) return;
    } else if (pathname.startsWith('/api/scheduler/')) {
      if (handleSchedulerRoutes(req, res, pathname, query, body)) return;
    } else if (pathname === '/api/threads' || pathname.startsWith('/api/threads/')) {
      if (handleThreadRoutes(req, res, pathname, query, body)) return;
    } else if (pathname.startsWith('/api/leads/')) {
      if (handleLeadRoutes(req, res, pathname, query, body)) return;
    }

    // 404 for unmatched API routes
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
    return;
  }

  // Static files
  let filePath = path.join(__dirname, 'public', pathname === '/' ? 'index.html' : pathname);

  // Security: prevent directory traversal
  const resolved = path.resolve(filePath);
  const publicDir = path.resolve(path.join(__dirname, 'public'));
  if (!resolved.startsWith(publicDir)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  serveStaticFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`Twitter Marketing Suite server running on http://localhost:${PORT}`);
});

module.exports = server;
