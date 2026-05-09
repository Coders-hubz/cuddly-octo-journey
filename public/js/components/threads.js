/**
 * Thread Builder Component
 */
const ThreadBuilder = {
  data: {},
  threadTweets: [''],

  async init() {
    this.threadTweets = [''];
    await this.loadData();
    this.render();
  },

  async loadData() {
    try {
      const threads = await fetch('/api/threads').then(r => r.json());
      this.data = threads;
    } catch (err) {
      console.error('Failed to load threads:', err);
    }
  },

  render() {
    const { threads } = this.data;
    if (!threads) return;

    const content = document.getElementById('content-area');
    content.innerHTML = `
      <div class="grid-2">
        <!-- Thread Composer -->
        <div class="card">
          <h3 class="chart-title" style="margin-bottom: 16px;">Compose Thread</h3>
          <div class="thread-composer" id="thread-composer">
            ${this.threadTweets.map((text, i) => `
              <div>
                ${i > 0 ? '<div class="thread-connector"></div>' : ''}
                <div class="thread-tweet-input">
                  <div class="thread-number">${i + 1}</div>
                  <div style="flex: 1;">
                    <textarea class="form-textarea" data-index="${i}" placeholder="Tweet ${i + 1}...">${this.escapeHtml(text)}</textarea>
                    <div class="char-counter">${text.length} / 280</div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
          <div style="margin-top: 16px; display: flex; gap: 8px;">
            <button class="btn btn-secondary" id="add-tweet-btn">+ Add Tweet</button>
            <button class="btn btn-primary" id="publish-thread-btn">Save Thread</button>
          </div>
        </div>

        <!-- Live Preview -->
        <div class="card">
          <h3 class="chart-title" style="margin-bottom: 16px;">Preview</h3>
          <div id="thread-preview">
            ${this.threadTweets.filter(t => t.trim()).map((text, i) => `
              <div class="tweet-preview-card">
                <div class="tweet-preview-header">
                  <div class="tweet-preview-avatar">TM</div>
                  <div>
                    <div class="tweet-preview-name">Twitter Marketer</div>
                    <div class="tweet-preview-handle">@twittermarketer</div>
                  </div>
                </div>
                <div class="tweet-preview-text">${this.escapeHtml(text)}</div>
                <div class="tweet-preview-actions">
                  <span>Reply</span>
                  <span>Retweet</span>
                  <span>Like</span>
                  <span>Share</span>
                </div>
              </div>
            `).join('')}
            ${this.threadTweets.every(t => !t.trim()) ? '<div class="empty-state"><div class="empty-state-icon">&#128221;</div><p>Start typing to see preview</p></div>' : ''}
          </div>
        </div>
      </div>

      <!-- Existing Threads -->
      <div class="card" style="margin-top: 28px;">
        <div class="card-header">
          <h3 class="chart-title">Your Threads</h3>
          <span class="badge badge-info">${threads.length} threads</span>
        </div>
        ${threads.map(thread => `
          <div style="padding: 16px; border-bottom: 1px solid var(--border);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <div>
                <strong style="font-size: 15px;">${this.escapeHtml(thread.title)}</strong>
                <span class="badge badge-success" style="margin-left: 8px;">${thread.status}</span>
              </div>
              <span style="color: var(--text-muted); font-size: 12px;">${thread.tweets.length} tweets</span>
            </div>
            <div style="display: flex; gap: 20px; font-size: 13px; color: var(--text-secondary);">
              <span>${this.formatNum(thread.stats.impressions)} impressions</span>
              <span>${this.formatNum(thread.stats.likes)} likes</span>
              <span>${this.formatNum(thread.stats.retweets)} retweets</span>
              ${thread.landing_page ? `<span style="color: var(--accent);">${thread.landing_page.email_captures} emails captured</span>` : ''}
            </div>
            ${thread.landing_page ? `
              <div style="margin-top: 12px; padding: 12px; background: var(--bg-primary); border-radius: var(--radius-sm); border: 1px solid var(--border);">
                <div style="font-size: 12px; color: var(--accent); margin-bottom: 4px;">Landing Page</div>
                <div style="font-size: 14px; font-weight: 600;">${this.escapeHtml(thread.landing_page.title)}</div>
                <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">${this.escapeHtml(thread.landing_page.description)}</div>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;

    this.bindEvents();
  },

  bindEvents() {
    // Textarea input
    document.querySelectorAll('#thread-composer textarea').forEach(ta => {
      ta.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index);
        this.threadTweets[idx] = e.target.value;
        this.updatePreview();
        const counter = e.target.parentElement.querySelector('.char-counter');
        if (counter) {
          counter.textContent = `${e.target.value.length} / 280`;
          counter.className = 'char-counter' + (e.target.value.length > 260 ? ' danger' : e.target.value.length > 240 ? ' warning' : '');
        }
      });
    });

    // Add tweet
    const addBtn = document.getElementById('add-tweet-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.threadTweets.push('');
        this.render();
      });
    }

    // Publish thread
    const publishBtn = document.getElementById('publish-thread-btn');
    if (publishBtn) {
      publishBtn.addEventListener('click', async () => {
        const validTweets = this.threadTweets.filter(t => t.trim());
        if (validTweets.length === 0) return;

        try {
          await fetch('/api/threads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: validTweets[0].slice(0, 50),
              tweets: validTweets.map((text, i) => ({ position: i + 1, text }))
            })
          });
          this.threadTweets = [''];
          await this.loadData();
          this.render();
        } catch (err) {
          console.error('Failed to save thread:', err);
        }
      });
    }
  },

  updatePreview() {
    const preview = document.getElementById('thread-preview');
    if (!preview) return;

    const validTweets = this.threadTweets.filter(t => t.trim());
    if (validTweets.length === 0) {
      preview.innerHTML = '<div class="empty-state"><div class="empty-state-icon">&#128221;</div><p>Start typing to see preview</p></div>';
      return;
    }

    preview.innerHTML = validTweets.map(text => `
      <div class="tweet-preview-card">
        <div class="tweet-preview-header">
          <div class="tweet-preview-avatar">TM</div>
          <div>
            <div class="tweet-preview-name">Twitter Marketer</div>
            <div class="tweet-preview-handle">@twittermarketer</div>
          </div>
        </div>
        <div class="tweet-preview-text">${this.escapeHtml(text)}</div>
        <div class="tweet-preview-actions">
          <span>Reply</span>
          <span>Retweet</span>
          <span>Like</span>
          <span>Share</span>
        </div>
      </div>
    `).join('');
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

  destroy() {}
};
