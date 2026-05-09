/**
 * Snapshot System - Daily follower count tracking
 * Saves daily snapshots to /data/snapshots/YYYY-MM-DD.json
 * Used to calculate growth over time from real Twitter API data.
 */

const fs = require('fs');
const path = require('path');

const SNAPSHOTS_DIR = path.join(__dirname, '..', 'data', 'snapshots');

/**
 * Ensure the snapshots directory exists
 */
function ensureSnapshotsDir() {
  if (!fs.existsSync(SNAPSHOTS_DIR)) {
    fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  }
}

/**
 * Get today's date as YYYY-MM-DD string
 */
function getTodayKey() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Save a snapshot for today (or a specific date)
 * @param {object} data - Snapshot data (follower count, metrics, etc.)
 * @param {string} [dateKey] - Optional date override (YYYY-MM-DD format)
 */
function saveSnapshot(data, dateKey) {
  ensureSnapshotsDir();
  const key = dateKey || getTodayKey();
  const filePath = path.join(SNAPSHOTS_DIR, `${key}.json`);

  const snapshot = {
    date: key,
    timestamp: new Date().toISOString(),
    ...data
  };

  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf8');
  return snapshot;
}

/**
 * Check if a snapshot exists for today
 */
function hasTodaySnapshot() {
  const filePath = path.join(SNAPSHOTS_DIR, `${getTodayKey()}.json`);
  return fs.existsSync(filePath);
}

/**
 * Load a snapshot for a specific date
 * @param {string} dateKey - Date in YYYY-MM-DD format
 * @returns {object|null} The snapshot data or null if not found
 */
function loadSnapshot(dateKey) {
  const filePath = path.join(SNAPSHOTS_DIR, `${dateKey}.json`);
  if (!fs.existsSync(filePath)) return null;

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

/**
 * Load all available snapshots, sorted by date (oldest first).
 * @param {number} [limit] - Max number of snapshots to return (most recent)
 * @returns {Array} Array of snapshot objects
 */
function loadAllSnapshots(limit) {
  ensureSnapshotsDir();

  const files = fs.readdirSync(SNAPSHOTS_DIR)
    .filter(f => f.endsWith('.json') && f !== '.gitkeep')
    .sort();

  const snapshots = [];
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(SNAPSHOTS_DIR, file), 'utf8'));
      snapshots.push(data);
    } catch (e) {
      // Skip corrupted files
    }
  }

  if (limit && snapshots.length > limit) {
    return snapshots.slice(-limit);
  }

  return snapshots;
}

/**
 * Calculate growth metrics from historical snapshots.
 * @param {number} days - Number of days to look back
 * @returns {object} Growth metrics
 */
function calculateGrowth(days) {
  const snapshots = loadAllSnapshots(days + 1);

  if (snapshots.length < 2) {
    return {
      period_days: days,
      snapshots_available: snapshots.length,
      net_growth: 0,
      growth_rate: 0,
      avg_daily_growth: 0,
      daily_data: snapshots.map(s => ({
        date: s.date,
        followers: s.followers_count || 0,
        net_growth: 0
      }))
    };
  }

  const oldest = snapshots[0];
  const newest = snapshots[snapshots.length - 1];
  const startCount = oldest.followers_count || 0;
  const endCount = newest.followers_count || 0;
  const netGrowth = endCount - startCount;
  const growthRate = startCount > 0 ? ((netGrowth / startCount) * 100) : 0;
  const actualDays = snapshots.length - 1;

  // Build daily data with growth calculations
  const dailyData = snapshots.map((s, i) => {
    const prevCount = i > 0 ? (snapshots[i - 1].followers_count || 0) : (s.followers_count || 0);
    return {
      date: s.date,
      followers: s.followers_count || 0,
      net_growth: (s.followers_count || 0) - prevCount
    };
  });

  return {
    period_days: days,
    snapshots_available: snapshots.length,
    net_growth: netGrowth,
    growth_rate: Math.round(growthRate * 100) / 100,
    avg_daily_growth: actualDays > 0 ? Math.round(netGrowth / actualDays) : 0,
    current_followers: endCount,
    daily_data: dailyData
  };
}

/**
 * Take a follower count snapshot using the Twitter API client.
 * Called on server startup and can be called periodically.
 * @param {object} twitterAPI - An instance of TwitterAPI
 */
async function takeSnapshot(twitterAPI) {
  if (hasTodaySnapshot()) {
    return loadSnapshot(getTodayKey());
  }

  try {
    const metrics = await twitterAPI.getFollowerCount();
    const user = await twitterAPI.getMe();

    const snapshot = saveSnapshot({
      followers_count: metrics.followers_count,
      following_count: metrics.following_count,
      tweet_count: metrics.tweet_count,
      listed_count: metrics.listed_count,
      username: user.username
    });

    return snapshot;
  } catch (e) {
    console.error('[Snapshot] Failed to take snapshot:', e.message);
    return null;
  }
}

module.exports = {
  saveSnapshot,
  hasTodaySnapshot,
  loadSnapshot,
  loadAllSnapshots,
  calculateGrowth,
  takeSnapshot,
  getTodayKey,
  ensureSnapshotsDir
};
