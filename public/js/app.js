/**
 * Twitter Marketing Suite - Main Application Controller
 * SPA routing, navigation state, page loading
 */
const App = {
  currentPage: null,
  pages: {
    growth: { title: 'Growth Dashboard', component: GrowthDashboard },
    scheduler: { title: 'Tweet Scheduler', component: TweetScheduler },
    threads: { title: 'Thread Builder', component: ThreadBuilder },
    leads: { title: 'Lead Magnet', component: LeadMagnet }
  },

  init() {
    this.bindNavigation();
    this.handleHashChange();
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
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
