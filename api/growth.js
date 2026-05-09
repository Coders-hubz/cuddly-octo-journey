const fs = require('fs');
const path = require('path');
const config = require('../config');
const { TwitterAPI } = require('../lib/twitter-api');
const snapshot = require('../lib/snapshot');

function loadJSON(filename) {
  const filePath = path.join(__dirname, '..', 'data', 'mock', filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Get a Twitter API client instance (only when credentials are configured)
 */
function getClient() {
  if (!config.isTwitterConfigured()) return null;
  return new TwitterAPI(config.twitter);
}

function handleGrowthRoutes(req, res, pathname, query) {
  res.setHeader('Content-Type', 'application/json');

  if (pathname === '/api/growth/summary') {
    return handleSummary(req, res, query);
  }

  if (pathname === '/api/growth/followers') {
    return handleFollowers(req, res, query);
  }

  if (pathname === '/api/growth/engagement') {
    return handleEngagement(req, res, query);
  }

  if (pathname === '/api/growth/top-tweets') {
    return handleTopTweets(req, res, query);
  }

  if (pathname === '/api/growth/audience') {
    const audience = loadJSON('audience.json');
    res.end(JSON.stringify(audience));
    return true;
  }

  return false;
}

/**
 * GET /api/growth/summary
 * Returns follower count, growth rate, engagement metrics.
 * Uses Twitter API when available, falls back to mock data.
 */
function handleSummary(req, res, query) {
  const client = getClient();

  if (!client) {
    // Mock data fallback
    const growth = loadJSON('growth.json');
    const audience = loadJSON('audience.json');
    const tweets = loadJSON('tweets.json');

    const topTweet = tweets.tweets.reduce((best, t) => t.engagement_rate > best.engagement_rate ? t : best);
    const avgEngagement = tweets.tweets.reduce((sum, t) => sum + t.engagement_rate, 0) / tweets.tweets.length;

    const summary = {
      current_followers: growth.current_followers,
      following: growth.following,
      follower_growth_rate: growth.follower_growth_rate,
      net_growth_today: growth.daily_data[growth.daily_data.length - 1].net_growth,
      net_growth_week: growth.weekly_summary[growth.weekly_summary.length - 1].net_growth,
      avg_engagement_rate: Math.round(avgEngagement * 100) / 100,
      top_tweet_engagement: topTweet.engagement_rate,
      total_impressions_week: tweets.tweets.slice(0, 7).reduce((sum, t) => sum + t.impressions, 0),
      audience_top_location: audience.top_locations[0].location,
      verified_followers: audience.verified_followers_percentage,
      mode: 'demo'
    };

    res.end(JSON.stringify(summary));
    return true;
  }

  // Live Twitter API mode
  (async () => {
    try {
      const metrics = await client.getFollowerCount();
      const user = await client.getMe();

      // Calculate growth from snapshots
      const growth7d = snapshot.calculateGrowth(7);
      const growth1d = snapshot.calculateGrowth(1);

      // Get recent tweets for engagement calculation
      let avgEngagement = 0;
      let topTweetEngagement = 0;
      let totalImpressions = 0;
      try {
        const tweets = await client.getMyTweets(20);
        if (tweets && tweets.length > 0) {
          const engagementRates = tweets.map(t => {
            const m = t.public_metrics || {};
            const total = (m.like_count || 0) + (m.retweet_count || 0) + (m.reply_count || 0);
            const impressions = m.impression_count || 1;
            return (total / impressions) * 100;
          });
          avgEngagement = engagementRates.reduce((a, b) => a + b, 0) / engagementRates.length;
          topTweetEngagement = Math.max(...engagementRates);
          totalImpressions = tweets.slice(0, 7).reduce((sum, t) => {
            return sum + ((t.public_metrics || {}).impression_count || 0);
          }, 0);
        }
      } catch (e) {
        // Engagement data may not be available on free tier
      }

      const summary = {
        current_followers: metrics.followers_count,
        following: metrics.following_count,
        follower_growth_rate: growth7d.growth_rate,
        net_growth_today: growth1d.net_growth,
        net_growth_week: growth7d.net_growth,
        avg_engagement_rate: Math.round(avgEngagement * 100) / 100,
        top_tweet_engagement: Math.round(topTweetEngagement * 100) / 100,
        total_impressions_week: totalImpressions,
        username: user.username,
        mode: 'live'
      };

      res.end(JSON.stringify(summary));
    } catch (e) {
      // On API error, fall back to mock data
      console.error('[Growth API] Error fetching live data:', e.message);
      const growth = loadJSON('growth.json');
      const tweets = loadJSON('tweets.json');
      const avgEngagement = tweets.tweets.reduce((sum, t) => sum + t.engagement_rate, 0) / tweets.tweets.length;

      res.end(JSON.stringify({
        current_followers: growth.current_followers,
        following: growth.following,
        follower_growth_rate: growth.follower_growth_rate,
        net_growth_today: growth.daily_data[growth.daily_data.length - 1].net_growth,
        net_growth_week: growth.weekly_summary[growth.weekly_summary.length - 1].net_growth,
        avg_engagement_rate: Math.round(avgEngagement * 100) / 100,
        mode: 'demo',
        error: 'Failed to fetch live data, showing demo data'
      }));
    }
  })();

  return true;
}

/**
 * GET /api/growth/followers
 * Returns follower history time series.
 * Uses snapshot data when available, falls back to mock.
 */
function handleFollowers(req, res, query) {
  const client = getClient();
  const period = query.period || '30d';

  if (!client) {
    // Mock data fallback
    const growth = loadJSON('growth.json');
    let days;
    switch (period) {
      case '7d': days = 7; break;
      case '90d': days = growth.daily_data.length; break;
      default: days = 30;
    }

    const data = {
      period: period,
      daily_data: growth.daily_data.slice(-days),
      weekly_summary: growth.weekly_summary,
      monthly_summary: growth.monthly_summary,
      current_followers: growth.current_followers,
      growth_rate: growth.follower_growth_rate,
      mode: 'demo'
    };

    res.end(JSON.stringify(data));
    return true;
  }

  // Live mode - use snapshots
  (async () => {
    try {
      let days;
      switch (period) {
        case '7d': days = 7; break;
        case '90d': days = 90; break;
        default: days = 30;
      }

      const growthData = snapshot.calculateGrowth(days);
      const metrics = await client.getFollowerCount();

      const data = {
        period: period,
        daily_data: growthData.daily_data,
        current_followers: metrics.followers_count,
        growth_rate: growthData.growth_rate,
        net_growth: growthData.net_growth,
        avg_daily_growth: growthData.avg_daily_growth,
        snapshots_available: growthData.snapshots_available,
        mode: 'live'
      };

      res.end(JSON.stringify(data));
    } catch (e) {
      console.error('[Growth API] Error fetching followers:', e.message);
      // Fallback to mock
      const growth = loadJSON('growth.json');
      res.end(JSON.stringify({
        period: period,
        daily_data: growth.daily_data.slice(-30),
        current_followers: growth.current_followers,
        growth_rate: growth.follower_growth_rate,
        mode: 'demo',
        error: 'Failed to fetch live data'
      }));
    }
  })();

  return true;
}

/**
 * GET /api/growth/engagement
 * Returns engagement metrics from recent tweets.
 */
function handleEngagement(req, res, query) {
  const client = getClient();

  if (!client) {
    // Mock data fallback
    const tweets = loadJSON('tweets.json');

    const engagementData = tweets.tweets.map(t => ({
      date: t.posted_at,
      engagement_rate: t.engagement_rate,
      likes: t.likes,
      retweets: t.retweets,
      replies: t.replies,
      impressions: t.impressions
    }));

    const avgRate = tweets.tweets.reduce((sum, t) => sum + t.engagement_rate, 0) / tweets.tweets.length;
    const bestDay = tweets.tweets.reduce((best, t) => t.engagement_rate > best.engagement_rate ? t : best);

    res.end(JSON.stringify({
      avg_engagement_rate: Math.round(avgRate * 100) / 100,
      best_performing_date: bestDay.posted_at,
      best_rate: bestDay.engagement_rate,
      daily_engagement: engagementData,
      mode: 'demo'
    }));
    return true;
  }

  // Live mode
  (async () => {
    try {
      const tweets = await client.getMyTweets(50);

      if (!tweets || tweets.length === 0) {
        res.end(JSON.stringify({
          avg_engagement_rate: 0,
          daily_engagement: [],
          mode: 'live',
          note: 'No recent tweets found'
        }));
        return;
      }

      const engagementData = tweets.map(t => {
        const m = t.public_metrics || {};
        const likes = m.like_count || 0;
        const retweets = m.retweet_count || 0;
        const replies = m.reply_count || 0;
        const impressions = m.impression_count || 1;
        const rate = ((likes + retweets + replies) / impressions) * 100;

        return {
          id: t.id,
          date: t.created_at,
          engagement_rate: Math.round(rate * 100) / 100,
          likes,
          retweets,
          replies,
          impressions
        };
      });

      const avgRate = engagementData.reduce((sum, t) => sum + t.engagement_rate, 0) / engagementData.length;
      const best = engagementData.reduce((b, t) => t.engagement_rate > b.engagement_rate ? t : b);

      res.end(JSON.stringify({
        avg_engagement_rate: Math.round(avgRate * 100) / 100,
        best_performing_date: best.date,
        best_rate: best.engagement_rate,
        daily_engagement: engagementData,
        mode: 'live'
      }));
    } catch (e) {
      console.error('[Growth API] Error fetching engagement:', e.message);
      // Fallback
      const tweets = loadJSON('tweets.json');
      const avgRate = tweets.tweets.reduce((sum, t) => sum + t.engagement_rate, 0) / tweets.tweets.length;
      res.end(JSON.stringify({
        avg_engagement_rate: Math.round(avgRate * 100) / 100,
        daily_engagement: tweets.tweets.map(t => ({
          date: t.posted_at,
          engagement_rate: t.engagement_rate,
          likes: t.likes,
          retweets: t.retweets,
          replies: t.replies,
          impressions: t.impressions
        })),
        mode: 'demo',
        error: 'Failed to fetch live engagement data'
      }));
    }
  })();

  return true;
}

/**
 * GET /api/growth/top-tweets
 * Returns user's tweets sorted by engagement rate.
 */
function handleTopTweets(req, res, query) {
  const client = getClient();
  const limit = parseInt(query.limit) || 10;

  if (!client) {
    // Mock data fallback
    const tweets = loadJSON('tweets.json');
    const sorted = [...tweets.tweets].sort((a, b) => b.engagement_rate - a.engagement_rate).slice(0, limit);
    res.end(JSON.stringify({ top_tweets: sorted, mode: 'demo' }));
    return true;
  }

  // Live mode
  (async () => {
    try {
      const tweets = await client.getMyTweets(100);

      if (!tweets || tweets.length === 0) {
        res.end(JSON.stringify({ top_tweets: [], mode: 'live' }));
        return;
      }

      const processed = tweets.map(t => {
        const m = t.public_metrics || {};
        const likes = m.like_count || 0;
        const retweets = m.retweet_count || 0;
        const replies = m.reply_count || 0;
        const impressions = m.impression_count || 1;
        const rate = ((likes + retweets + replies) / impressions) * 100;

        return {
          id: t.id,
          text: t.text,
          posted_at: t.created_at,
          likes,
          retweets,
          replies,
          impressions,
          engagement_rate: Math.round(rate * 100) / 100,
          type: 'original'
        };
      });

      const sorted = processed.sort((a, b) => b.engagement_rate - a.engagement_rate).slice(0, limit);
      res.end(JSON.stringify({ top_tweets: sorted, mode: 'live' }));
    } catch (e) {
      console.error('[Growth API] Error fetching top tweets:', e.message);
      // Fallback
      const tweets = loadJSON('tweets.json');
      const sorted = [...tweets.tweets].sort((a, b) => b.engagement_rate - a.engagement_rate).slice(0, limit);
      res.end(JSON.stringify({ top_tweets: sorted, mode: 'demo', error: 'Failed to fetch live data' }));
    }
  })();

  return true;
}

module.exports = { handleGrowthRoutes };
