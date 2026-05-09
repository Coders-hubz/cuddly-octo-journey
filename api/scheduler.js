const fs = require('fs');
const path = require('path');
const config = require('../config');
const { TwitterAPI } = require('../lib/twitter-api');

function loadJSON(filename) {
  const filePath = path.join(__dirname, '..', 'data', 'mock', filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveJSON(filename, data) {
  const filePath = path.join(__dirname, '..', 'data', 'mock', filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// In-memory scheduled tweet timers (simple scheduler)
const scheduledTimers = new Map();

/**
 * Schedule a tweet to be posted at a specific time.
 * Uses setTimeout for simplicity (in-memory, resets on restart).
 * Only posts if write credentials are available.
 */
function schedulePost(tweet) {
  const scheduledTime = new Date(tweet.scheduled_for).getTime();
  const now = Date.now();
  const delay = scheduledTime - now;

  if (delay <= 0) {
    // Already past scheduled time - post immediately if in live mode
    if (config.hasWriteAccess()) {
      postTweetNow(tweet);
    }
    return;
  }

  // Cap at 24 hours to avoid extremely long timeouts
  if (delay > 24 * 60 * 60 * 1000) {
    return; // Too far in the future for in-memory scheduling
  }

  const timer = setTimeout(() => {
    postTweetNow(tweet);
    scheduledTimers.delete(tweet.id);
  }, delay);

  scheduledTimers.set(tweet.id, timer);
}

/**
 * Post a tweet immediately via the Twitter API.
 * Updates the tweet status in the mock data file.
 */
async function postTweetNow(tweet) {
  if (!config.hasWriteAccess()) {
    console.log(`[Scheduler] No write credentials - tweet "${tweet.id}" stays in queue`);
    return;
  }

  try {
    const client = new TwitterAPI(config.twitter);
    const result = await client.postTweet(tweet.text);

    // Update status in stored data
    const scheduler = loadJSON('scheduler.json');
    const found = scheduler.scheduled_tweets.find(t => t.id === tweet.id);
    if (found) {
      found.status = 'posted';
      found.posted_at = new Date().toISOString();
      found.twitter_id = result.id;
      saveJSON('scheduler.json', scheduler);
    }

    console.log(`[Scheduler] Tweet posted successfully: ${result.id}`);
  } catch (e) {
    console.error(`[Scheduler] Failed to post tweet "${tweet.id}":`, e.message);

    // Mark as failed
    const scheduler = loadJSON('scheduler.json');
    const found = scheduler.scheduled_tweets.find(t => t.id === tweet.id);
    if (found) {
      found.status = 'failed';
      found.error = e.message;
      saveJSON('scheduler.json', scheduler);
    }
  }
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

    res.end(JSON.stringify({
      scheduled_tweets: tweets,
      write_access: config.hasWriteAccess(),
      mode: config.getMode()
    }));
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

    // If we have write access and a scheduled time, set up the timer
    if (config.hasWriteAccess() && body.scheduled_for) {
      schedulePost(newTweet);
    }

    // If posting immediately (no scheduled_for or past time)
    if (config.hasWriteAccess() && body.post_now) {
      (async () => {
        await postTweetNow(newTweet);
      })();
    }

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
