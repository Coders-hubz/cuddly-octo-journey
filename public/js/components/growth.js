/**
 * Twitter Growth Dashboard Component (PRIMARY)
 * Rich follower tracking, engagement analytics, top tweets, audience insights
 */
const GrowthDashboard = {
  currentPeriod: '30d',
  data: {},

  async init() {
    document.getElementById('period-selector').style.display = 'flex';
    this.bindPeriodSelector();
    await this.loadData();
    this.render();
  },

  bindPeriodSelector() {
    const selector = document.getElementById('period-selector');
    selector.querySelectorAll('.period-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        selector.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentPeriod = e.target.dataset.period;
        this.loadData().then(() => this.render());
      });
    });
  },

  async loadData() {
    try {
      const [summary, followers, engagement, topTweets, audience] = await Promise.all([
        fetch('/api/growth/summary').then(r => r.json()),
        fetch(`/api/growth/followers?period=${this.currentPeriod}`).then(r => r.json()),
        fetch('/api/growth/engagement').then(r => r.json()),
        fetch('/api/growth/top-tweets?limit=10').then(r => r.json()),
        fetch('/api/growth/audience').then(r => r.json())
      ]);
      this.data = { summary, followers, engagement, topTweets, audience };
    } catch (err) {
      console.error('Failed to load growth data:', err);
    }
  },

  render() {
    const { summary, followers, engagement, topTweets, audience } = this.data;
    if (!summary) return;

    const content = document.getElementById('content-area');
    content.innerHTML = `
      <!-- Stats Overview -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Followers</div>
          <div class="stat-value">${this.formatNum(summary.current_followers)}</div>
          <div class="stat-change positive">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14l5-5 5 5H7z"/></svg>
            +${summary.net_growth_today} today
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Weekly Growth</div>
          <div class="stat-value">+${this.formatNum(summary.net_growth_week)}</div>
          <div class="stat-change positive">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14l5-5 5 5H7z"/></svg>
            ${summary.follower_growth_rate}% rate
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Engagement Rate</div>
          <div class="stat-value">${summary.avg_engagement_rate}%</div>
          <div class="stat-change positive">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14l5-5 5 5H7z"/></svg>
            Above average
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Weekly Impressions</div>
          <div class="stat-value">${this.formatNum(summary.total_impressions_week)}</div>
          <div class="stat-change positive">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14l5-5 5 5H7z"/></svg>
            ${summary.verified_followers}% verified
          </div>
        </div>
      </div>

      <!-- Growth Chart -->
      <div class="chart-container">
        <div class="card-header">
          <h3 class="chart-title">Follower Growth</h3>
          <span style="color: var(--text-muted); font-size: 13px;">${this.currentPeriod === '7d' ? 'Last 7 days' : this.currentPeriod === '30d' ? 'Last 30 days' : 'Last 90 days'}</span>
        </div>
        <div class="chart-canvas-wrapper" id="growth-chart-wrapper">
          <canvas id="growth-chart"></canvas>
        </div>
      </div>

      <!-- Engagement + Top Tweets -->
      <div class="grid-2">
        <div class="chart-container" style="margin-bottom: 0;">
          <h3 class="chart-title">Engagement Over Time</h3>
          <div class="chart-canvas-wrapper" id="engagement-chart-wrapper" style="height: 220px;">
            <canvas id="engagement-chart"></canvas>
          </div>
        </div>
        <div class="chart-container" style="margin-bottom: 0;">
          <h3 class="chart-title">Growth by Week</h3>
          <div class="chart-canvas-wrapper" id="weekly-chart-wrapper" style="height: 220px;">
            <canvas id="weekly-chart"></canvas>
          </div>
        </div>
      </div>

      <!-- Top Performing Tweets -->
      <div class="card" style="margin-top: 28px; margin-bottom: 28px;">
        <div class="card-header">
          <h3 class="chart-title">Top Performing Tweets</h3>
          <span style="color: var(--text-muted); font-size: 13px;">Sorted by engagement rate</span>
        </div>
        <div style="overflow-x: auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Tweet</th>
                <th>Likes</th>
                <th>Retweets</th>
                <th>Replies</th>
                <th>Impressions</th>
                <th>Engagement</th>
              </tr>
            </thead>
            <tbody>
              ${topTweets.top_tweets.map(tweet => `
                <tr>
                  <td class="tweet-text">${this.escapeHtml(tweet.text)}</td>
                  <td>${this.formatNum(tweet.likes)}</td>
                  <td>${this.formatNum(tweet.retweets)}</td>
                  <td>${this.formatNum(tweet.replies)}</td>
                  <td>${this.formatNum(tweet.impressions)}</td>
                  <td><span class="badge badge-success">${tweet.engagement_rate}%</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Audience Insights -->
      <div class="grid-3">
        <!-- Top Locations -->
        <div class="card">
          <h3 class="chart-title" style="margin-bottom: 16px;">Top Locations</h3>
          <ul class="insight-list">
            ${audience.top_locations.slice(0, 6).map(loc => `
              <li class="insight-item">
                <span class="insight-label">${loc.location}</span>
                <div class="progress-bar-wrapper">
                  <div class="progress-bar" style="width: ${loc.percentage}%"></div>
                </div>
                <span class="insight-value">${loc.percentage}%</span>
              </li>
            `).join('')}
          </ul>
        </div>

        <!-- Active Hours -->
        <div class="card">
          <h3 class="chart-title" style="margin-bottom: 16px;">Active Hours</h3>
          <div class="hour-bars">
            ${audience.active_hours.map(h => `
              <div class="hour-bar" style="height: ${h.activity_level}%" title="${h.hour}: ${h.activity_level}%"></div>
            `).join('')}
          </div>
          <div class="hour-labels">
            ${audience.active_hours.filter((_, i) => i % 3 === 0).map(h => `
              <span class="hour-label">${h.hour}</span>
            `).join('')}
          </div>
        </div>

        <!-- Interests -->
        <div class="card">
          <h3 class="chart-title" style="margin-bottom: 16px;">Audience Interests</h3>
          <div class="donut-container" style="flex-direction: column; align-items: center;">
            <canvas id="interests-donut"></canvas>
            <ul class="donut-legend" style="margin-top: 12px;">
              ${audience.interests.map((item, i) => `
                <li>
                  <span class="legend-dot" style="background: ${ChartUtil.palette[i % ChartUtil.palette.length]}"></span>
                  ${item.category} (${item.percentage}%)
                </li>
              `).join('')}
            </ul>
          </div>
        </div>
      </div>
    `;

    // Render charts after DOM update
    requestAnimationFrame(() => this.renderCharts());
  },

  renderCharts() {
    const { followers, engagement } = this.data;

    // Growth line chart
    const growthCanvas = document.getElementById('growth-chart');
    if (growthCanvas && followers.daily_data) {
      const labels = followers.daily_data.map(d => {
        const date = new Date(d.date);
        return `${date.getMonth() + 1}/${date.getDate()}`;
      });
      const values = followers.daily_data.map(d => d.followers);
      ChartUtil.lineChart(growthCanvas, { labels, values }, { color: '#1DA1F2', showArea: true });
    }

    // Engagement chart
    const engCanvas = document.getElementById('engagement-chart');
    if (engCanvas && engagement.daily_engagement) {
      const recentEngagement = engagement.daily_engagement.slice(0, 14).reverse();
      const labels = recentEngagement.map(d => {
        const date = new Date(d.date);
        return `${date.getMonth() + 1}/${date.getDate()}`;
      });
      const values = recentEngagement.map(d => d.engagement_rate);
      ChartUtil.lineChart(engCanvas, { labels, values }, { color: '#17bf63', showArea: false });
    }

    // Weekly bar chart
    const weeklyCanvas = document.getElementById('weekly-chart');
    if (weeklyCanvas && followers.weekly_summary) {
      const labels = followers.weekly_summary.map(w => w.week.split(' ')[0] + '..');
      const values = followers.weekly_summary.map(w => w.net_growth);
      ChartUtil.barChart(weeklyCanvas, { labels, values }, { color: '#794BC4' });
    }

    // Interests donut
    const donutCanvas = document.getElementById('interests-donut');
    if (donutCanvas && this.data.audience.interests) {
      const interests = this.data.audience.interests;
      ChartUtil.donutChart(donutCanvas, {
        labels: interests.map(i => i.category),
        values: interests.map(i => i.percentage)
      }, { size: 140, centerText: '24.8K' });
    }
  },

  formatNum(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  destroy() {
    document.getElementById('period-selector').style.display = 'none';
  }
};
