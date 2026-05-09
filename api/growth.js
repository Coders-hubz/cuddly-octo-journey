const fs = require('fs');
const path = require('path');

function loadJSON(filename) {
  const filePath = path.join(__dirname, '..', 'data', 'mock', filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function handleGrowthRoutes(req, res, pathname, query) {
  res.setHeader('Content-Type', 'application/json');

  if (pathname === '/api/growth/summary') {
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
      verified_followers: audience.verified_followers_percentage
    };

    res.end(JSON.stringify(summary));
    return true;
  }

  if (pathname === '/api/growth/followers') {
    const growth = loadJSON('growth.json');
    const period = query.period || '30d';
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
      growth_rate: growth.follower_growth_rate
    };

    res.end(JSON.stringify(data));
    return true;
  }

  if (pathname === '/api/growth/engagement') {
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
      daily_engagement: engagementData
    }));
    return true;
  }

  if (pathname === '/api/growth/top-tweets') {
    const tweets = loadJSON('tweets.json');
    const limit = parseInt(query.limit) || 10;

    const sorted = [...tweets.tweets].sort((a, b) => b.engagement_rate - a.engagement_rate).slice(0, limit);

    res.end(JSON.stringify({ top_tweets: sorted }));
    return true;
  }

  if (pathname === '/api/growth/audience') {
    const audience = loadJSON('audience.json');
    res.end(JSON.stringify(audience));
    return true;
  }

  return false;
}

module.exports = { handleGrowthRoutes };
