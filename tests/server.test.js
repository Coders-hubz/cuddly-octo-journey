const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const path = require('path');
const fs = require('fs');

let server;
const PORT = 3001;

// Fixture backup/restore to prevent POST tests from polluting mock data
const MOCK_DIR = path.join(__dirname, '..', 'data', 'mock');
const MUTABLE_FIXTURES = ['scheduler.json', 'threads.json', 'leads.json'];
const fixtureBackups = {};

function backupFixtures() {
  for (const file of MUTABLE_FIXTURES) {
    fixtureBackups[file] = fs.readFileSync(path.join(MOCK_DIR, file));
  }
}

function restoreFixtures() {
  for (const file of MUTABLE_FIXTURES) {
    if (fixtureBackups[file]) {
      fs.writeFileSync(path.join(MOCK_DIR, file), fixtureBackups[file]);
    }
  }
}

function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, body: data });
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

describe('Twitter Marketing Suite Server', () => {
  before(async () => {
    backupFixtures();
    process.env.PORT = PORT;
    // Clear require cache to pick up new PORT
    delete require.cache[require.resolve('../server.js')];
    server = require('../server.js');

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 200));
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    restoreFixtures();
  });

  describe('Static Files', () => {
    test('serves index.html at root', async () => {
      const res = await makeRequest('/');
      assert.strictEqual(res.statusCode, 200);
      assert.ok(res.headers['content-type'].includes('text/html'));
      assert.ok(res.body.includes('Twitter Marketing Suite'));
      assert.ok(res.body.includes('Growth Dashboard'));
    });

    test('serves CSS file', async () => {
      const res = await makeRequest('/css/style.css');
      assert.strictEqual(res.statusCode, 200);
      assert.ok(res.headers['content-type'].includes('text/css'));
      assert.ok(res.body.includes('--accent: #1DA1F2'));
    });

    test('serves JavaScript files', async () => {
      const res = await makeRequest('/js/app.js');
      assert.strictEqual(res.statusCode, 200);
      assert.ok(res.headers['content-type'].includes('application/javascript'));
    });

    test('returns 404 for missing files', async () => {
      const res = await makeRequest('/nonexistent.html');
      assert.strictEqual(res.statusCode, 404);
    });
  });

  describe('Growth API', () => {
    test('GET /api/growth/summary returns summary data', async () => {
      const res = await makeRequest('/api/growth/summary');
      assert.strictEqual(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.ok(data.current_followers > 0);
      assert.ok(data.avg_engagement_rate > 0);
      assert.ok(data.follower_growth_rate > 0);
      assert.ok(data.net_growth_today > 0);
    });

    test('GET /api/growth/followers returns time series', async () => {
      const res = await makeRequest('/api/growth/followers?period=30d');
      assert.strictEqual(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.ok(data.daily_data.length > 0);
      assert.ok(data.daily_data[0].followers > 0);
      assert.ok(data.weekly_summary.length > 0);
    });

    test('GET /api/growth/engagement returns engagement data', async () => {
      const res = await makeRequest('/api/growth/engagement');
      assert.strictEqual(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.ok(data.avg_engagement_rate > 0);
      assert.ok(data.daily_engagement.length > 0);
    });

    test('GET /api/growth/top-tweets returns sorted tweets', async () => {
      const res = await makeRequest('/api/growth/top-tweets?limit=5');
      assert.strictEqual(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.strictEqual(data.top_tweets.length, 5);
      // Verify sorted by engagement rate
      for (let i = 0; i < data.top_tweets.length - 1; i++) {
        assert.ok(data.top_tweets[i].engagement_rate >= data.top_tweets[i + 1].engagement_rate);
      }
    });

    test('GET /api/growth/audience returns audience insights', async () => {
      const res = await makeRequest('/api/growth/audience');
      assert.strictEqual(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.ok(data.top_locations.length > 0);
      assert.ok(data.active_hours.length > 0);
      assert.ok(data.interests.length > 0);
    });
  });

  describe('Scheduler API', () => {
    test('GET /api/scheduler/tweets returns scheduled tweets', async () => {
      const res = await makeRequest('/api/scheduler/tweets');
      assert.strictEqual(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.ok(data.scheduled_tweets.length > 0);
    });

    test('GET /api/scheduler/best-times returns recommendations', async () => {
      const res = await makeRequest('/api/scheduler/best-times');
      assert.strictEqual(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.ok(data.best_times.length === 7);
    });

    test('GET /api/scheduler/analytics returns stats', async () => {
      const res = await makeRequest('/api/scheduler/analytics');
      assert.strictEqual(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.ok(data.total_scheduled > 0);
    });

    test('POST /api/scheduler/tweets creates a tweet', async () => {
      const res = await makeRequest('/api/scheduler/tweets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { text: 'Test scheduled tweet', category: 'tip' }
      });
      assert.strictEqual(res.statusCode, 201);
      const data = JSON.parse(res.body);
      assert.strictEqual(data.text, 'Test scheduled tweet');
      assert.strictEqual(data.status, 'scheduled');
    });
  });

  describe('Threads API', () => {
    test('GET /api/threads returns threads', async () => {
      const res = await makeRequest('/api/threads');
      assert.strictEqual(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.ok(data.threads.length > 0);
      assert.ok(data.threads[0].tweets.length > 0);
    });

    test('POST /api/threads creates a thread', async () => {
      const res = await makeRequest('/api/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { title: 'Test Thread', tweets: [{ position: 1, text: 'First tweet' }] }
      });
      assert.strictEqual(res.statusCode, 201);
      const data = JSON.parse(res.body);
      assert.strictEqual(data.title, 'Test Thread');
      assert.strictEqual(data.status, 'draft');
    });
  });

  describe('Leads API', () => {
    test('GET /api/leads/collected returns leads', async () => {
      const res = await makeRequest('/api/leads/collected');
      assert.strictEqual(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.ok(data.leads.length > 0);
    });

    test('GET /api/leads/keywords returns keywords', async () => {
      const res = await makeRequest('/api/leads/keywords');
      assert.strictEqual(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.ok(data.keywords.length > 0);
    });

    test('GET /api/leads/conversions returns conversion stats', async () => {
      const res = await makeRequest('/api/leads/conversions');
      assert.strictEqual(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.ok(data.total_leads > 0);
      assert.ok(data.conversion_rate > 0);
    });

    test('POST /api/leads/keywords adds a keyword', async () => {
      const res = await makeRequest('/api/leads/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { keyword: 'test keyword', auto_reply: 'Test reply message' }
      });
      assert.strictEqual(res.statusCode, 201);
      const data = JSON.parse(res.body);
      assert.strictEqual(data.keyword, 'test keyword');
      assert.strictEqual(data.active, true);
    });
  });

  describe('Error Handling', () => {
    test('returns 404 for unknown API routes', async () => {
      const res = await makeRequest('/api/unknown/endpoint');
      assert.strictEqual(res.statusCode, 404);
      const data = JSON.parse(res.body);
      assert.ok(data.error);
    });

    test('returns 413 for oversized request body', async () => {
      const largeBody = 'x'.repeat(1024 * 1024 + 1); // Just over 1MB
      const res = await new Promise((resolve, reject) => {
        const opts = {
          hostname: 'localhost',
          port: PORT,
          path: '/api/scheduler/tweets',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        };
        const req = http.request(opts, (r) => {
          let data = '';
          r.on('data', chunk => { data += chunk; });
          r.on('end', () => resolve({ statusCode: r.statusCode, body: data }));
        });
        req.on('error', reject);
        req.write(largeBody);
        req.end();
      });
      assert.strictEqual(res.statusCode, 413);
    });
  });
});
