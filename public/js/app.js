/**
 * Twitter Marketing Suite - Main Application Controller
 * SPA routing, navigation state, page loading
 */
const App = {
  currentPage: null,
  connectionStatus: null,
  pages: {
    growth: { title: 'Growth Dashboard', component: GrowthDashboard },
    scheduler: { title: 'Tweet Scheduler', component: TweetScheduler },
    threads: { title: 'Thread Builder', component: ThreadBuilder },
    leads: { title: 'Lead Magnet', component: LeadMagnet }
  },

  init() {
    this.bindNavigation();
    this.handleHashChange();
    this.fetchConnectionStatus();
    window.addEventListener('hashchange', () => this.handleHashChange());
  },

  bindNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.dataset.page;
        window.location.hash = page;
      });
    });
  },

  handleHashChange() {
    const hash = window.location.hash.slice(1) || 'growth';
    this.navigate(hash);
  },

  navigate(page) {
    if (!this.pages[page]) page = 'growth';

    // Destroy current page
    if (this.currentPage && this.pages[this.currentPage].component.destroy) {
      this.pages[this.currentPage].component.destroy();
    }

    // Update nav state
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.page === page);
    });

    // Update title
    document.querySelector('.page-title').textContent = this.pages[page].title;

    // Show loading
    document.getElementById('content-area').innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';

    // Load page
    this.currentPage = page;
    this.pages[page].component.init();
  },

  /**
   * Fetch the connection status from the API and update the sidebar indicator
   */
  async fetchConnectionStatus() {
    try {
      const response = await fetch('/api/status');
      const status = await response.json();
      this.connectionStatus = status;
      this.updateConnectionUI(status);
    } catch (e) {
      this.updateConnectionUI({ connected: false, mode: 'demo' });
    }
  },

  /**
   * Update the connection status UI in the sidebar
   */
  updateConnectionUI(status) {
    const statusEl = document.getElementById('connection-status');
    const avatarEl = document.getElementById('account-avatar');
    const nameEl = document.getElementById('account-name');
    const planEl = document.getElementById('account-plan');

    if (!statusEl) return;

    const dot = statusEl.querySelector('.status-dot');
    const text = statusEl.querySelector('.status-text');

    if (status.connected) {
      dot.className = 'status-dot connected';
      text.textContent = 'Connected';
      if (status.username) {
        nameEl.textContent = '@' + escapeHtml(status.username);
        avatarEl.textContent = status.username.slice(0, 2).toUpperCase();
      }
      if (status.name) {
        planEl.textContent = escapeHtml(status.name);
      } else {
        planEl.textContent = 'Live Mode';
      }
    } else {
      dot.className = 'status-dot demo';
      text.textContent = 'Demo Mode';
      nameEl.textContent = '@twittermarketer';
      avatarEl.textContent = 'TM';
      planEl.textContent = 'Mock Data';
    }
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
