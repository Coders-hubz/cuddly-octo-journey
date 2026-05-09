/**
 * Growth Suite - PWA Main Application Controller
 * Service worker registration, SPA routing, offline handling,
 * install prompt, pull-to-refresh, tab navigation
 */
const App = {
  currentPage: null,
  connectionStatus: null,
  deferredInstallPrompt: null,
  isOnline: navigator.onLine,
  pullStartY: 0,
  isPulling: false,
  pageOrder: ['growth', 'scheduler', 'threads', 'leads'],

  pages: {
    growth: { title: 'Growth Dashboard', component: GrowthDashboard },
    scheduler: { title: 'Tweet Scheduler', component: TweetScheduler },
    threads: { title: 'Thread Builder', component: ThreadBuilder },
    leads: { title: 'Lead Magnet', component: LeadMagnet }
  },

  init() {
    this.registerServiceWorker();
    this.bindNavigation();
    this.handleHashChange();
    this.fetchConnectionStatus();
    this.setupOfflineDetection();
    this.setupInstallPrompt();
    this.setupPullToRefresh();
    this.setupFAB();
    window.addEventListener('hashchange', () => this.handleHashChange());
  },

  // --- Service Worker ---
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'activated') {
                // New version available
              }
            });
          }
        });
      } catch (e) {
        // Service worker registration failed
      }
    }
  },

  // --- Navigation ---
  bindNavigation() {
    // Desktop sidebar navigation
    document.querySelectorAll('.sidebar .nav-link').forEach(function(link) {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        var page = link.dataset.page;
        window.location.hash = page;
      });
    });

    // Mobile bottom navigation
    document.querySelectorAll('.bottom-nav-item').forEach(function(link) {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        var page = link.dataset.page;
        window.location.hash = page;
      });
    });
  },

  handleHashChange() {
    var hash = window.location.hash.slice(1) || 'growth';
    this.navigate(hash);
  },

  navigate(page) {
    if (!this.pages[page]) page = 'growth';

    var oldPageIdx = this.pageOrder.indexOf(this.currentPage);
    var newPageIdx = this.pageOrder.indexOf(page);
    var direction = newPageIdx >= oldPageIdx ? 'left' : 'right';

    // Destroy current page
    if (this.currentPage && this.pages[this.currentPage].component.destroy) {
      this.pages[this.currentPage].component.destroy();
    }

    // Update sidebar nav state
    document.querySelectorAll('.sidebar .nav-link').forEach(function(link) {
      link.classList.toggle('active', link.dataset.page === page);
    });

    // Update bottom nav state
    document.querySelectorAll('.bottom-nav-item').forEach(function(link) {
      link.classList.toggle('active', link.dataset.page === page);
    });

    // Update title
    document.querySelector('.page-title').textContent = this.pages[page].title;

    // Show skeleton loading
    var contentArea = document.getElementById('content-area');
    if (page === 'growth') {
      contentArea.innerHTML = this.getGrowthSkeleton();
    } else {
      contentArea.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';
    }

    // Animate page transition
    contentArea.classList.remove('page-enter');
    void contentArea.offsetWidth; // trigger reflow
    contentArea.classList.add('page-enter');

    // Load page
    this.currentPage = page;
    this.pages[page].component.init();
  },

  // --- Growth Dashboard Skeleton ---
  getGrowthSkeleton() {
    return '<div class="stats-grid">' +
      '<div class="skeleton skeleton-stat"></div>' +
      '<div class="skeleton skeleton-stat"></div>' +
      '<div class="skeleton skeleton-stat"></div>' +
      '<div class="skeleton skeleton-stat"></div>' +
      '</div>' +
      '<div class="skeleton skeleton-chart" style="margin-bottom:20px"></div>' +
      '<div class="grid-2">' +
      '<div class="skeleton skeleton-chart" style="height:200px"></div>' +
      '<div class="skeleton skeleton-chart" style="height:200px"></div>' +
      '</div>';
  },

  // --- Connection Status ---
  async fetchConnectionStatus() {
    try {
      var response = await fetch('/api/status');
      var status = await response.json();
      this.connectionStatus = status;
      this.updateConnectionUI(status);
    } catch (e) {
      this.updateConnectionUI({ connected: false, mode: 'demo' });
    }
  },

  updateConnectionUI(status) {
    var statusEl = document.getElementById('connection-status');
    var avatarEl = document.getElementById('account-avatar');
    var nameEl = document.getElementById('account-name');
    var planEl = document.getElementById('account-plan');

    if (!statusEl) return;

    var dot = statusEl.querySelector('.status-dot');
    var text = statusEl.querySelector('.status-text');

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
  },

  // --- Offline Detection ---
  setupOfflineDetection() {
    var self = this;
    window.addEventListener('online', function() {
      self.isOnline = true;
      self.showToast('Back online', 'online');
      // Auto-dismiss after 2 seconds
      setTimeout(function() { self.hideToast(); }, 2000);
    });
    window.addEventListener('offline', function() {
      self.isOnline = false;
      self.showToast("You're offline - showing cached data", 'offline');
    });
  },

  showToast(message, type) {
    var toast = document.getElementById('offline-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'offline-toast visible ' + type;
  },

  hideToast() {
    var toast = document.getElementById('offline-toast');
    if (!toast) return;
    toast.classList.remove('visible');
  },

  // --- Install Prompt ---
  setupInstallPrompt() {
    var self = this;

    // Listen for the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', function(e) {
      e.preventDefault();
      self.deferredInstallPrompt = e;

      // Show install banner after 30 seconds if not dismissed
      if (!localStorage.getItem('install-dismissed')) {
        setTimeout(function() {
          self.showInstallBanner();
        }, 30000);
      }
    });

    // Handle install banner buttons
    var dismissBtn = document.getElementById('install-dismiss');
    var acceptBtn = document.getElementById('install-accept');

    if (dismissBtn) {
      dismissBtn.addEventListener('click', function() {
        self.hideInstallBanner();
        localStorage.setItem('install-dismissed', 'true');
      });
    }

    if (acceptBtn) {
      acceptBtn.addEventListener('click', function() {
        self.installApp();
      });
    }
  },

  showInstallBanner() {
    var banner = document.getElementById('install-banner');
    if (banner && this.deferredInstallPrompt) {
      banner.style.display = 'block';
    }
  },

  hideInstallBanner() {
    var banner = document.getElementById('install-banner');
    if (banner) {
      banner.style.display = 'none';
    }
  },

  async installApp() {
    if (!this.deferredInstallPrompt) return;
    this.deferredInstallPrompt.prompt();
    var result = await this.deferredInstallPrompt.userChoice;
    this.deferredInstallPrompt = null;
    this.hideInstallBanner();
  },

  // --- Pull to Refresh ---
  setupPullToRefresh() {
    var self = this;
    var contentArea = document.querySelector('.main-content');
    var ptr = document.getElementById('pull-to-refresh');

    if (!contentArea || !ptr) return;

    var startY = 0;
    var pulling = false;

    contentArea.addEventListener('touchstart', function(e) {
      if (contentArea.scrollTop === 0 && self.currentPage === 'growth') {
        startY = e.touches[0].pageY;
        pulling = true;
      }
    }, { passive: true });

    contentArea.addEventListener('touchmove', function(e) {
      if (!pulling) return;
      var currentY = e.touches[0].pageY;
      var diff = currentY - startY;
      if (diff > 0 && diff < 120) {
        ptr.style.height = Math.min(diff * 0.5, 60) + 'px';
      }
    }, { passive: true });

    contentArea.addEventListener('touchend', function() {
      if (!pulling) return;
      pulling = false;
      var h = parseInt(ptr.style.height) || 0;
      if (h >= 50) {
        ptr.classList.add('active', 'refreshing');
        self.refreshCurrentPage().then(function() {
          setTimeout(function() {
            ptr.classList.remove('active', 'refreshing');
            ptr.style.height = '0';
          }, 500);
        });
      } else {
        ptr.style.height = '0';
        ptr.classList.remove('active');
      }
    }, { passive: true });
  },

  async refreshCurrentPage() {
    if (this.currentPage && this.pages[this.currentPage].component.init) {
      await this.pages[this.currentPage].component.init();
    }
  },

  // --- FAB ---
  setupFAB() {
    var fab = document.getElementById('fab-compose');
    if (fab) {
      fab.addEventListener('click', function() {
        window.location.hash = 'scheduler';
      });
    }
  }
};

// Count-up animation utility
function animateCountUp(element, target, duration) {
  if (!element) return;
  var start = 0;
  var startTime = null;
  var numTarget = parseFloat(String(target).replace(/[^0-9.]/g, ''));
  var suffix = String(target).replace(/[0-9.,]/g, '');

  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    var progress = Math.min((timestamp - startTime) / duration, 1);
    var eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    var current = Math.round(numTarget * eased);
    element.textContent = current.toLocaleString() + suffix;
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      element.textContent = target;
    }
  }
  requestAnimationFrame(step);
}

// Debounce utility
function debounce(fn, delay) {
  var timer = null;
  return function() {
    var context = this;
    var args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function() { fn.apply(context, args); }, delay);
  };
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', function() {
  App.init();
});
