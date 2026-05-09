const fs = require('fs');
const path = require('path');

function loadJSON(filename) {
  const filePath = path.join(__dirname, '..', 'data', 'mock', filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveJSON(filename, data) {
  const filePath = path.join(__dirname, '..', 'data', 'mock', filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function handleThreadRoutes(req, res, pathname, query, body) {
  res.setHeader('Content-Type', 'application/json');

  if (pathname === '/api/threads' && req.method === 'GET') {
    const threads = loadJSON('threads.json');
    res.end(JSON.stringify(threads));
    return true;
  }

  if (pathname === '/api/threads' && req.method === 'POST') {
    const threads = loadJSON('threads.json');

    const newThread = {
      id: 'th' + String(threads.threads.length + 1).padStart(3, '0'),
      title: body.title || 'Untitled Thread',
      created_at: new Date().toISOString(),
      status: 'draft',
      tweets: body.tweets || [],
      landing_page: body.landing_page || null,
      stats: { impressions: 0, likes: 0, retweets: 0, replies: 0 }
    };

    threads.threads.push(newThread);
    saveJSON('threads.json', threads);

    res.statusCode = 201;
    res.end(JSON.stringify(newThread));
    return true;
  }

  // Match /api/threads/:id/landing-page
  const landingMatch = pathname.match(/^\/api\/threads\/([^/]+)\/landing-page$/);
  if (landingMatch && req.method === 'GET') {
    const threads = loadJSON('threads.json');
    const thread = threads.threads.find(t => t.id === landingMatch[1]);

    if (!thread) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Thread not found' }));
      return true;
    }

    res.end(JSON.stringify({ thread_id: thread.id, landing_page: thread.landing_page }));
    return true;
  }

  // Match /api/threads/:id/email-capture
  const emailMatch = pathname.match(/^\/api\/threads\/([^/]+)\/email-capture$/);
  if (emailMatch && req.method === 'POST') {
    const threads = loadJSON('threads.json');
    const thread = threads.threads.find(t => t.id === emailMatch[1]);

    if (!thread) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Thread not found' }));
      return true;
    }

    if (thread.landing_page) {
      thread.landing_page.email_captures = (thread.landing_page.email_captures || 0) + 1;
      saveJSON('threads.json', threads);
    }

    res.statusCode = 201;
    res.end(JSON.stringify({ success: true, email: body.email }));
    return true;
  }

  return false;
}

module.exports = { handleThreadRoutes };
