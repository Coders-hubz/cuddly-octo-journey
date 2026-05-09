# Twitter API Setup Guide

This guide walks you through connecting your Twitter account to the Growth Suite for real-time analytics.

## Prerequisites

- A Twitter/X account
- A Twitter Developer account (free tier works)

## Step 1: Create a Twitter Developer Account

1. Go to [developer.twitter.com](https://developer.twitter.com)
2. Sign in with your Twitter account
3. Apply for developer access (the Free tier is sufficient for basic growth tracking)
4. Complete the application form describing your use case

## Step 2: Create a Project and App

1. In the Developer Portal, go to **Projects & Apps**
2. Click **+ Add Project**
3. Name your project (e.g., "Growth Dashboard")
4. Select "Exploring the API" as your use case
5. Create an App within the project
6. Note down your keys (shown only once)

## Step 3: Generate Your Credentials

You need these credentials:

| Credential | Where to Find | Used For |
|-----------|---------------|----------|
| API Key | App Settings > Keys and Tokens | OAuth 1.0a signing |
| API Secret | App Settings > Keys and Tokens | OAuth 1.0a signing |
| Bearer Token | App Settings > Keys and Tokens | Read-only API access |
| Access Token | App Settings > Keys and Tokens > Generate | User-context actions |
| Access Token Secret | App Settings > Keys and Tokens > Generate | User-context actions |

### Generate Access Token and Secret

1. In your App settings, go to **Keys and Tokens**
2. Under "Authentication Tokens", click **Generate** for Access Token
3. Make sure permissions are set to **Read and Write** if you want to post tweets

## Step 4: Set App Permissions

1. Go to your App Settings > **User authentication settings**
2. Click **Set up**
3. Set App permissions to:
   - **Read** (minimum for growth tracking)
   - **Read and Write** (if you want to use the tweet scheduler)
4. Set Type of App to **Web App, Automated App or Bot**
5. Add a Callback URL (can be `http://localhost:3000/callback` for development)
6. Save settings

## Step 5: Configure Environment Variables

Set the following environment variables before starting the server:

```bash
export TWITTER_API_KEY="your_api_key_here"
export TWITTER_API_SECRET="your_api_secret_here"
export TWITTER_BEARER_TOKEN="your_bearer_token_here"
export TWITTER_ACCESS_TOKEN="your_access_token_here"
export TWITTER_ACCESS_TOKEN_SECRET="your_access_token_secret_here"
```

### Example .env format (for reference)

```
TWITTER_API_KEY=abc123def456
TWITTER_API_SECRET=xyz789ghi012
TWITTER_BEARER_TOKEN=AAAAAAAAAA...
TWITTER_ACCESS_TOKEN=12345-AbCdEf...
TWITTER_ACCESS_TOKEN_SECRET=GhIjKlMnOp...
```

> Note: Do not commit a .env file with real credentials to version control.

## Step 6: Start the Server

```bash
node server.js
```

You should see:
```
Twitter Marketing Suite server running on http://localhost:3000
Mode: LIVE
[Snapshot] Daily snapshot saved: <your_follower_count> followers
```

The sidebar will show a green "Connected" indicator and your username.

## Free Tier Limitations

The Twitter API Free tier includes:

- **Tweet cap**: 1,500 tweets per month (posting)
- **Read limit**: 10,000 tweet reads per month
- **Rate limits**:
  - App-level: 300 requests per 15 minutes
  - User-level: 900 requests per 15 minutes
  - Tweet creation: 200 per 15 minutes (but monthly cap applies)
- **No access to**: Followers list endpoint, full-archive search, audience demographics
- **Available**: User lookup, recent tweets, tweet metrics, posting tweets

### What Works on Free Tier

- Follower count tracking (via user lookup)
- Your tweet metrics (likes, retweets, replies, impressions)
- Posting scheduled tweets
- Growth rate calculation from daily snapshots

### What Requires Basic ($100/mo) or Higher

- Follower/following list enumeration
- Full-archive tweet search
- Higher rate limits

## Troubleshooting

### "Demo Mode" showing even with credentials set

- Verify environment variables are exported (not just set in a file)
- Check the server console for error messages
- Try `curl http://localhost:3000/api/status` to see the detailed error

### Rate limit errors

The app automatically handles rate limits with exponential backoff. If you see rate limit warnings in the console, the app will retry after the reset window. Normal usage should not trigger rate limits.

### "Write access requires OAuth 1.0a credentials"

This means you have the Bearer Token set (read-only) but not the Access Token/Secret. Generate these in the Developer Portal under your App's Keys and Tokens section.

## Running Without Credentials (Demo Mode)

The app works perfectly without any API credentials. It will use mock data to demonstrate all features. This is useful for development, testing, or previewing the dashboard before connecting a real account.

## Safety Notes

- This app uses only official Twitter API v2 endpoints
- All requests respect rate limits with automatic backoff
- No bulk following/unfollowing, no automated engagement
- The scheduler posts one tweet at a time at your scheduled times
- Snapshot data is stored locally in `/data/snapshots/`
- No data is sent to any third-party services
