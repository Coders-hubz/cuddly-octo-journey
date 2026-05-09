/**
 * Twitter Marketing Suite - Configuration
 * Loads Twitter API credentials from environment variables.
 * Falls back to mock data mode when credentials are not set.
 */

const config = {
  twitter: {
    apiKey: process.env.TWITTER_API_KEY || '',
    apiSecret: process.env.TWITTER_API_SECRET || '',
    accessToken: process.env.TWITTER_ACCESS_TOKEN || '',
    accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET || '',
    bearerToken: process.env.TWITTER_BEARER_TOKEN || ''
  },

  /**
   * Returns true if all required Twitter API credentials are configured.
   * Bearer token alone enables read-only access (growth data).
   * Full credentials (API key + access token) enable write access (posting tweets).
   */
  isTwitterConfigured() {
    return !!(this.twitter.bearerToken);
  },

  /**
   * Returns true if write-capable credentials (OAuth 1.0a) are configured.
   * Required for posting tweets, sending DMs, etc.
   */
  hasWriteAccess() {
    return !!(
      this.twitter.apiKey &&
      this.twitter.apiSecret &&
      this.twitter.accessToken &&
      this.twitter.accessTokenSecret
    );
  },

  /**
   * Returns the current mode: 'live' if Twitter API is configured, 'demo' otherwise.
   */
  getMode() {
    return this.isTwitterConfigured() ? 'live' : 'demo';
  }
};

module.exports = config;
