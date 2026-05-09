/**
 * Lead Magnet Component
 */
const LeadMagnet = {
  data: {},

  async init() {
    await this.loadData();
    this.render();
  },

  async loadData() {
    try {
      const [keywords, leads, conversions] = await Promise.all([
        fetch('/api/leads/keywords').then(r => r.json()),
        fetch('/api/leads/collected').then(r => r.json()),
        fetch('/api/leads/conversions').then(r => r.json())
      ]);
      this.data = { keywords: keywords.keywords, leads: leads.leads, conversions };
    } catch (err) {
      console.error('Failed to load leads data:', err);
    }
  },

  render() {
    const { keywords, leads, conversions } = this.data;
    if (!keywords) return;

    const content = document.getElementById('content-area');
    content.innerHTML = `
      <!-- Stats -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Leads</div>
          <div class="stat-value">${conversions.total_leads}</div>
          <div class="stat-change positive">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14l5-5 5 5H7z"/></svg>
            +${conversions.monthly_leads[conversions.monthly_leads.length - 1].leads} this month
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Conversion Rate</div>
          <div class="stat-value">${conversions.conversion_rate}%</div>
          <div class="stat-change positive">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14l5-5 5 5H7z"/></svg>
            Above average
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Avg. Days to Convert</div>
          <div class="stat-value">${conversions.avg_time_to_convert_days}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Top Keyword</div>
          <div class="stat-value" style="font-size: 18px;">${conversions.top_converting_keyword}</div>
        </div>
      </div>

      <div class="grid-2">
        <!-- Keyword Triggers -->
        <div class="card">
          <div class="card-header">
            <h3 class="chart-title">Keyword Triggers</h3>
            <span class="badge badge-info">${keywords.length} active</span>
          </div>
          <div style="margin-bottom: 16px;">
            <div class="form-group">
              <input type="text" class="form-input" id="new-keyword" placeholder="Add keyword...">
            </div>
            <div class="form-group">
              <textarea class="form-textarea" id="new-reply" placeholder="Auto-reply message..." style="min-height: 60px;"></textarea>
            </div>
            <button class="btn btn-primary btn-sm" id="add-keyword-btn">Add Keyword</button>
          </div>
          <div>
            ${keywords.map(kw => `
              <div style="padding: 12px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <div style="font-size: 14px; font-weight: 600; color: var(--text-primary);">${this.escapeHtml(kw.keyword)}</div>
                  <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${this.escapeHtml(kw.auto_reply).slice(0, 60)}...</div>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                  <span style="font-size: 12px; color: var(--text-muted);">${kw.triggers_count} triggers</span>
                  <span class="badge ${kw.active ? 'badge-success' : 'badge-warning'}">${kw.active ? 'Active' : 'Paused'}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Conversion Funnel -->
        <div class="card">
          <h3 class="chart-title" style="margin-bottom: 16px;">Conversion Funnel</h3>
          <div class="funnel-chart">
            <div class="funnel-stage">
              <span class="funnel-label">Total</span>
              <div class="funnel-bar" style="width: 100%;">${conversions.total_leads}</div>
            </div>
            <div class="funnel-stage" style="margin-top: 8px;">
              <span class="funnel-label">Nurturing</span>
              <div class="funnel-bar" style="width: ${(conversions.nurturing / conversions.total_leads) * 100}%; background: var(--warning);">${conversions.nurturing}</div>
            </div>
            <div class="funnel-stage" style="margin-top: 8px;">
              <span class="funnel-label">Converted</span>
              <div class="funnel-bar" style="width: ${(conversions.converted / conversions.total_leads) * 100}%; background: var(--success);">${conversions.converted}</div>
            </div>
          </div>
          <div style="margin-top: 24px;">
            <h4 style="font-size: 14px; color: var(--text-secondary); margin-bottom: 12px;">Monthly Trend</h4>
            <div class="chart-canvas-wrapper" id="leads-chart-wrapper" style="height: 150px;">
              <canvas id="leads-chart"></canvas>
            </div>
          </div>
        </div>
      </div>

      <!-- Collected Leads Table -->
      <div class="card" style="margin-top: 28px;">
        <div class="card-header">
          <h3 class="chart-title">Collected Leads</h3>
          <span class="badge badge-info">${leads.length} recent</span>
        </div>
        <div style="overflow-x: auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Name</th>
                <th>Keyword</th>
                <th>Status</th>
                <th>Email</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${leads.map(lead => `
                <tr>
                  <td style="color: var(--accent);">${this.escapeHtml(lead.username)}</td>
                  <td>${this.escapeHtml(lead.name)}</td>
                  <td>${this.escapeHtml(lead.keyword_triggered)}</td>
                  <td><span class="badge ${lead.status === 'converted' ? 'badge-success' : lead.status === 'nurturing' ? 'badge-warning' : 'badge-info'}">${lead.status}</span></td>
                  <td>${lead.email || '-'}</td>
                  <td style="color: var(--text-muted);">${this.formatDate(lead.captured_at)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.bindEvents();
    requestAnimationFrame(() => this.renderCharts());
  },

  renderCharts() {
    const { conversions } = this.data;
    const canvas = document.getElementById('leads-chart');
    if (canvas && conversions.monthly_leads) {
      ChartUtil.barChart(canvas, {
        labels: conversions.monthly_leads.map(m => m.month.split(' ')[0].slice(0, 3)),
        values: conversions.monthly_leads.map(m => m.leads)
      }, { color: '#17bf63' });
    }
  },

  bindEvents() {
    const addBtn = document.getElementById('add-keyword-btn');
    if (addBtn) {
      addBtn.addEventListener('click', async () => {
        const keyword = document.getElementById('new-keyword').value.trim();
        const autoReply = document.getElementById('new-reply').value.trim();
        if (!keyword) return;

        try {
          await fetch('/api/leads/keywords', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword, auto_reply: autoReply })
          });
          await this.loadData();
          this.render();
        } catch (err) {
          console.error('Failed to add keyword:', err);
        }
      });
    }
  },

  formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  destroy() {}
};
