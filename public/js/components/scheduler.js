/**
 * Tweet Scheduler Component
 */
const TweetScheduler = {
  data: {},

  async init() {
    await this.loadData();
    this.render();
  },

  async loadData() {
    try {
      const [tweets, bestTimes, analytics] = await Promise.all([
        fetch('/api/scheduler/tweets').then(r => r.json()),
        fetch('/api/scheduler/best-times').then(r => r.json()),
        fetch('/api/scheduler/analytics').then(r => r.json())
      ]);
      this.data = { tweets: tweets.scheduled_tweets, bestTimes: bestTimes.best_times, analytics };
    } catch (err) {
      console.error('Failed to load scheduler data:', err);
    }
  },

  render() {
    const { tweets, bestTimes, analytics } = this.data;
    if (!tweets) return;

    const scheduled = tweets.filter(t => t.status === 'scheduled');
    const posted = tweets.filter(t => t.status === 'posted');

    const content = document.getElementById('content-area');
    content.innerHTML = `
      <!-- Compose Section -->
      <div class="grid-2">
        <div class="card">
          <h3 class="chart-title" style="margin-bottom: 16px;">Compose Tweet</h3>
          <div class="form-group">
            <textarea class="form-textarea" id="tweet-compose" placeholder="What's happening?" maxlength="280"></textarea>
            <div class="char-counter" id="char-counter">0 / 280</div>
          </div>
          <div class="form-group">
            <label class="form-label">Schedule For</label>
            <input type="datetime-local" class="form-input" id="schedule-time">
          </div>
          <div class="form-group">
            <label class="form-label">Category</label>
            <select class="form-select" id="tweet-category">
              <option value="educational">Educational</option>
              <option value="tip">Quick Tip</option>
              <option value="data">Data/Insights</option>
              <option value="teaser">Teaser</option>
              <option value="promotional">Promotional</option>
              <option value="motivational">Motivational</option>
            </select>
          </div>
          <button class="btn btn-primary" id="schedule-btn">Schedule Tweet</button>
        </div>

        <!-- Analytics Mini Dashboard -->
        <div class="card">
          <h3 class="chart-title" style="margin-bottom: 16px;">Scheduler Analytics</h3>
          <div class="stats-grid" style="grid-template-columns: 1fr 1fr; margin-bottom: 16px;">
            <div class="stat-card" style="padding: 14px;">
              <div class="stat-label">Total Scheduled</div>
              <div class="stat-value" style="font-size: 22px;">${escapeHtml(analytics.total_scheduled)}</div>
            </div>
            <div class="stat-card" style="padding: 14px;">
              <div class="stat-label">Posted</div>
              <div class="stat-value" style="font-size: 22px;">${escapeHtml(analytics.posted_successfully)}</div>
            </div>
            <div class="stat-card" style="padding: 14px;">
              <div class="stat-label">Scheduled Eng.</div>
              <div class="stat-value" style="font-size: 22px;">${escapeHtml(analytics.avg_engagement_scheduled)}%</div>
            </div>
            <div class="stat-card" style="padding: 14px;">
              <div class="stat-label">Manual Eng.</div>
              <div class="stat-value" style="font-size: 22px;">${escapeHtml(analytics.avg_engagement_manual)}%</div>
            </div>
          </div>
          <div style="padding: 12px; background: var(--bg-primary); border-radius: var(--radius-sm); border: 1px solid var(--border);">
            <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 4px;">Best Performing</div>
            <div style="font-size: 14px; color: var(--text-primary);">${escapeHtml(analytics.best_performing_day)}s at ${escapeHtml(analytics.best_performing_time)}</div>
          </div>
        </div>
      </div>

      <!-- Best Times -->
      <div class="card" style="margin-bottom: 28px;">
        <h3 class="chart-title" style="margin-bottom: 16px;">Best Times to Tweet</h3>
        <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px;">
          ${bestTimes.map(day => `
            <div style="text-align: center; padding: 12px 8px; background: var(--bg-primary); border-radius: var(--radius-sm); border: 1px solid var(--border);">
              <div style="font-size: 12px; font-weight: 600; color: var(--accent); margin-bottom: 8px;">${escapeHtml(day.day.slice(0, 3))}</div>
              ${day.times.map(t => `<div style="font-size: 11px; color: var(--text-secondary); padding: 2px 0;">${escapeHtml(t)}</div>`).join('')}
              <div style="font-size: 11px; color: var(--success); margin-top: 6px;">${escapeHtml(day.avg_engagement)}%</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Scheduled Tweets List -->
      <div class="card">
        <div class="card-header">
          <h3 class="chart-title">Scheduled Tweets</h3>
          <span class="badge badge-info">${scheduled.length} pending</span>
        </div>
        <div class="scheduled-list">
          ${scheduled.map(tweet => `
            <div class="scheduled-item">
              <div class="scheduled-item-content">
                <div class="scheduled-item-text">${escapeHtml(tweet.text)}</div>
                <div class="scheduled-item-time">${escapeHtml(this.formatDate(tweet.scheduled_for))} &middot; ${escapeHtml(tweet.category)}</div>
              </div>
              <span class="badge badge-info">Scheduled</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Posted History -->
      <div class="card" style="margin-top: 24px;">
        <div class="card-header">
          <h3 class="chart-title">Recently Posted</h3>
        </div>
        <div class="scheduled-list">
          ${posted.map(tweet => `
            <div class="scheduled-item">
              <div class="scheduled-item-content">
                <div class="scheduled-item-text">${escapeHtml(tweet.text)}</div>
                <div class="scheduled-item-time">${escapeHtml(this.formatDate(tweet.scheduled_for))} &middot; ${tweet.performance ? escapeHtml(tweet.performance.likes) + ' likes, ' + escapeHtml(tweet.performance.impressions) + ' impressions' : ''}</div>
              </div>
              <span class="badge badge-success">Posted</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    this.bindEvents();
  },

  bindEvents() {
    const textarea = document.getElementById('tweet-compose');
    const counter = document.getElementById('char-counter');
    const scheduleBtn = document.getElementById('schedule-btn');

    if (textarea) {
      textarea.addEventListener('input', () => {
        const len = textarea.value.length;
        counter.textContent = `${len} / 280`;
        counter.className = 'char-counter' + (len > 260 ? ' danger' : len > 240 ? ' warning' : '');
      });
    }

    if (scheduleBtn) {
      scheduleBtn.addEventListener('click', async () => {
        const text = textarea.value.trim();
        const time = document.getElementById('schedule-time').value;
        const category = document.getElementById('tweet-category').value;

        if (!text) return;

        try {
          await fetch('/api/scheduler/tweets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text,
              scheduled_for: time ? new Date(time).toISOString() : new Date().toISOString(),
              category
            })
          });
          await this.loadData();
          this.render();
        } catch (err) {
          console.error('Failed to schedule tweet:', err);
        }
      });
    }
  },

  formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  },

  escapeHtml(text) {
    return escapeHtml(text);
  },

  destroy() {}
};
