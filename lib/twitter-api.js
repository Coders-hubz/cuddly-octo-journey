/**
 * Twitter API v2 Client
 * Uses Node.js built-in https and crypto modules (no external packages).
 * Supports OAuth 2.0 Bearer Token (read) and OAuth 1.0a (write) authentication.
 *
 * IMPORTANT: This client respects Twitter rate limits and uses conservative
 * request patterns to keep the account safe. No automated bulk actions,
 * no aggressive following/unfollowing, no spam behaviors.
 */

const https = require('https');
const crypto = require('crypto');
const querystring = require('querystring');

const API_BASE = 'api.twitter.com';

/**
 * Generate OAuth 1.0a signature for user-context requests.
 * Used for write operations (posting tweets, DMs, etc.)
 */
function generateOAuthSignature(method, url, params, consumerSecret, tokenSecret) {
  const sortedParams = Object.keys(params).sort().map(key =>
    `${encodeRFC3986(key)}=${encodeRFC3986(params[key])}`
  ).join('&');

  const signatureBase = [
    method.toUpperCase(),
    encodeRFC3986(url),
    encodeRFC3986(sortedParams)
  ].join('&');

  const signingKey = `${encodeRFC3986(consumerSecret)}&${encodeRFC3986(tokenSecret)}`;

  return crypto
    .createHmac('sha1', signingKey)
    .update(signatureBase)
    .digest('base64');
}

/**
 * RFC 3986 percent-encoding (stricter than encodeURIComponent)
 */
function encodeRFC3986(str) {
  return encodeURIComponent(String(str))
    .replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

/**
 * Generate a random nonce for OAuth requests
 */
function generateNonce() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Build the OAuth 1.0a Authorization header value
 */
function buildOAuthHeader(config, method, url, extraParams) {
  const oauthParams = {
    oauth_consumer_key: config.apiKey,
    oauth_nonce: generateNonce(),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: config.accessToken,
    oauth_version: '1.0'
  };

  // Merge all params for signature generation
  const allParams = { ...oauthParams, ...extraParams };

  const signature = generateOAuthSignature(
    method,
    url,
    allParams,
    config.apiSecret,
    config.accessTokenSecret
  );

  oauthParams.oauth_signature = signature;

  // Build header string
  const headerParts = Object.keys(oauthParams).sort().map(key =>
    `${encodeRFC3986(key)}="${encodeRFC3986(oauthParams[key])}"`
  );

  return 'OAuth ' + headerParts.join(', ');
}

/**
 * Make an HTTPS request and return parsed JSON response.
 * Handles rate limiting with exponential backoff.
 */
function makeRequest(options, body, retries) {
  if (retries === undefined) retries = 2;

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        // Handle rate limiting
        if (res.statusCode === 429) {
          const resetTime = res.headers['x-rate-limit-reset'];
          const waitMs = resetTime
            ? Math.max((parseInt(resetTime) * 1000) - Date.now(), 1000)
            : 60000; // Default 60s wait

          if (retries > 0) {
            const backoff = Math.min(waitMs, 120000); // Cap at 2 minutes
            setTimeout(() => {
              makeRequest(options, body, retries - 1)
                .then(resolve)
                .catch(reject);
            }, backoff);
            return;
          }

          reject(new Error(`Rate limited. Resets at ${new Date(parseInt(resetTime) * 1000).toISOString()}`));
          return;
        }

        // Parse response
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          reject(new Error(`Failed to parse Twitter API response: ${data.slice(0, 200)}`));
          return;
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({
            data: parsed,
            headers: res.headers,
            statusCode: res.statusCode
          });
        } else {
          const errorMsg = parsed.errors
            ? parsed.errors.map(e => e.message || e.detail).join('; ')
            : parsed.detail || parsed.title || `HTTP ${res.statusCode}`;
          reject(new Error(`Twitter API Error (${res.statusCode}): ${errorMsg}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error(`Network error calling Twitter API: ${e.message}`));
    });

    // Timeout after 30 seconds
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Twitter API request timed out after 30 seconds'));
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

/**
 * Twitter API Client class
 */
class TwitterAPI {
  constructor(credentials) {
    this.credentials = credentials;
    this._cachedUser = null;
    this._cacheExpiry = 0;
  }

  /**
   * Make a GET request with Bearer Token (app-only auth, read endpoints)
   */
  async bearerGet(endpoint, params) {
    const queryStr = params ? '?' + querystring.stringify(params) : '';
    const options = {
      hostname: API_BASE,
      path: endpoint + queryStr,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.credentials.bearerToken}`,
        'Content-Type': 'application/json'
      }
    };

    return makeRequest(options, null);
  }

  /**
   * Make a GET request with OAuth 1.0a (user-context auth)
   */
  async oauth1Get(endpoint, params) {
    const queryStr = params ? '?' + querystring.stringify(params) : '';
    const fullUrl = `https://${API_BASE}${endpoint}`;
    const authHeader = buildOAuthHeader(
      this.credentials, 'GET', fullUrl, params || {}
    );

    const options = {
      hostname: API_BASE,
      path: endpoint + queryStr,
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      }
    };

    return makeRequest(options, null);
  }

  /**
   * Make a POST request with OAuth 1.0a (user-context auth, write operations)
   */
  async oauth1Post(endpoint, data) {
    const fullUrl = `https://${API_BASE}${endpoint}`;
    const body = JSON.stringify(data);

    // For POST with JSON body, only OAuth params go into signature
    const authHeader = buildOAuthHeader(
      this.credentials, 'POST', fullUrl, {}
    );

    const options = {
      hostname: API_BASE,
      path: endpoint,
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    return makeRequest(options, body);
  }

  /**
   * Get the authenticated user's profile info.
   * Caches for 5 minutes to avoid unnecessary API calls.
   */
  async getMe() {
    if (this._cachedUser && Date.now() < this._cacheExpiry) {
      return this._cachedUser;
    }

    let result;
    if (this.credentials.accessToken) {
      // Use OAuth 1.0a for user-context endpoint
      result = await this.oauth1Get('/2/users/me', {
        'user.fields': 'id,name,username,public_metrics,profile_image_url,description'
      });
    } else {
      // Bearer-only: /users/me requires user context, so this may fail on free tier
      result = await this.bearerGet('/2/users/me', {
        'user.fields': 'id,name,username,public_metrics,profile_image_url,description'
      });
    }

    this._cachedUser = result.data.data;
    this._cacheExpiry = Date.now() + 5 * 60 * 1000; // 5 minute cache
    return this._cachedUser;
  }

  /**
   * Get user info by username
   */
  async getUserByUsername(username) {
    const response = await this.bearerGet(`/2/users/by/username/${username}`, {
      'user.fields': 'id,name,username,public_metrics,profile_image_url,description,created_at'
    });
    return response.data.data;
  }

  /**
   * Get follower count for the authenticated user.
   * Returns the public_metrics object containing followers_count.
   */
  async getFollowerCount() {
    const user = await this.getMe();
    return user.public_metrics;
  }

  /**
   * Get the authenticated user's recent tweets with public metrics.
   * Respects rate limits - max 100 tweets per request.
   * @param {number} maxResults - Number of tweets to fetch (5-100)
   */
  async getMyTweets(maxResults) {
    if (!maxResults) maxResults = 20;
    maxResults = Math.min(Math.max(maxResults, 5), 100);

    const user = await this.getMe();

    const response = await this.bearerGet(`/2/users/${user.id}/tweets`, {
      max_results: maxResults.toString(),
      'tweet.fields': 'id,text,created_at,public_metrics,organic_metrics',
      exclude: 'replies,retweets'
    });

    return response.data.data || [];
  }

  /**
   * Get a specific tweet by ID with full metrics
   */
  async getTweet(tweetId) {
    const response = await this.bearerGet(`/2/tweets/${tweetId}`, {
      'tweet.fields': 'id,text,created_at,public_metrics'
    });
    return response.data.data;
  }

  /**
   * Post a new tweet (requires OAuth 1.0a / write access).
   * This is for the scheduler feature - posts individual tweets only.
   * No bulk posting, no automated engagement farming.
   */
  async postTweet(text) {
    if (!this.credentials.accessToken || !this.credentials.accessTokenSecret) {
      throw new Error('Write access requires OAuth 1.0a credentials (access token + secret)');
    }

    if (!text || text.length === 0) {
      throw new Error('Tweet text cannot be empty');
    }

    if (text.length > 280) {
      throw new Error('Tweet text exceeds 280 character limit');
    }

    const response = await this.oauth1Post('/2/tweets', { text });
    return response.data.data;
  }

  /**
   * Search recent tweets (last 7 days) by query.
   * Uses Bearer token (app-only) auth.
   */
  async searchRecentTweets(query, maxResults) {
    if (!maxResults) maxResults = 10;
    maxResults = Math.min(Math.max(maxResults, 10), 100);

    const response = await this.bearerGet('/2/tweets/search/recent', {
      query: query,
      max_results: maxResults.toString(),
      'tweet.fields': 'id,text,created_at,public_metrics,author_id'
    });

    return response.data.data || [];
  }

  /**
   * Get a user's timeline (public tweets).
   * @param {string} userId - The user's Twitter ID
   * @param {number} maxResults - Number of tweets (5-100)
   */
  async getUserTimeline(userId, maxResults) {
    if (!maxResults) maxResults = 20;
    maxResults = Math.min(Math.max(maxResults, 5), 100);

    const response = await this.bearerGet(`/2/users/${userId}/tweets`, {
      max_results: maxResults.toString(),
      'tweet.fields': 'id,text,created_at,public_metrics',
      exclude: 'replies,retweets'
    });

    return response.data.data || [];
  }

  /**
   * Verify that the credentials are valid by attempting to get user info.
   * Returns { valid: true, user: {...} } or { valid: false, error: '...' }
   */
  async verifyCredentials() {
    try {
      const user = await this.getMe();
      return { valid: true, user };
    } catch (e) {
      return { valid: false, error: e.message };
    }
  }
}

module.exports = { TwitterAPI };
