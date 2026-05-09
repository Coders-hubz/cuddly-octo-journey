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

function handleSchedulerRoutes(req, res, pathname, query, body) {
  res.setHeader('Content-Type', 'application/json');

  if (pathname === '/api/scheduler/tweets' && req.method === 'GET') {
    const scheduler = loadJSON('scheduler.json');
    const status = query.status;

    let tweets = scheduler.scheduled_tweets;
    if (status) {
      tweets = tweets.filter(t => t.status === status);
    }

    res.end(JSON.stringify({ scheduled_tweets: tweets }));
    return true;
  }

  if (pathname === '/api/scheduler/tweets' && req.method === 'POST') {
    const scheduler = loadJSON('scheduler.json');

    const newTweet = {
      id: 's' + String(scheduler.scheduled_tweets.length + 1).padStart(3, '0'),
      text: body.text || '',
      scheduled_for: body.scheduled_for || new Date().toISOString(),
      status: 'scheduled',
      category: body.category || 'general'
    };

    scheduler.scheduled_tweets.push(newTweet);
    saveJSON('scheduler.json', scheduler);

    res.statusCode = 201;
    res.end(JSON.stringify(newTweet));
    return true;
  }

  if (pathname === '/api/scheduler/best-times') {
    const scheduler = loadJSON('scheduler.json');
    res.end(JSON.stringify({ best_times: scheduler.best_times }));
    return true;
  }

  if (pathname === '/api/scheduler/analytics') {
    const scheduler = loadJSON('scheduler.json');
    res.end(JSON.stringify(scheduler.analytics));
    return true;
  }

  return false;
}

module.exports = { handleSchedulerRoutes };
