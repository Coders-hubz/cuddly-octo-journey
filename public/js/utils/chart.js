/**
 * Lightweight Canvas Chart Utility
 * Supports line, bar, and donut charts with dark theme
 */
const ChartUtil = {
  colors: {
    primary: '#1DA1F2',
    secondary: '#794BC4',
    success: '#17bf63',
    warning: '#ffad1f',
    danger: '#e0245e',
    grid: '#2a2a45',
    text: '#a0a0b8',
    textMuted: '#6b6b80',
    background: '#1e1e35',
    gradientStart: 'rgba(29, 161, 242, 0.3)',
    gradientEnd: 'rgba(29, 161, 242, 0.0)'
  },

  palette: ['#1DA1F2', '#794BC4', '#17bf63', '#ffad1f', '#e0245e', '#71c9f8', '#ff6b6b'],

  _chartRegistry: [],
  _resizeTimer: null,

  /**
   * Register a chart for resize re-rendering
   */
  _registerChart(canvas, type, data, options) {
    this._chartRegistry = this._chartRegistry.filter(entry => entry.canvas !== canvas);
    this._chartRegistry.push({ canvas, type, data, options });
    this._initResizeListener();
  },

  /**
   * Initialize debounced resize listener (once)
   */
  _initResizeListener() {
    if (this._resizeListenerAttached) return;
    this._resizeListenerAttached = true;
    window.addEventListener('resize', () => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => this._redrawAll(), 250);
    });
  },

  /**
   * Redraw all registered charts
   */
  _redrawAll() {
    this._chartRegistry = this._chartRegistry.filter(entry => document.body.contains(entry.canvas));
    this._chartRegistry.forEach(entry => {
      if (entry.type === 'line') {
        this.lineChart(entry.canvas, entry.data, entry.options, true);
      } else if (entry.type === 'bar') {
        this.barChart(entry.canvas, entry.data, entry.options, true);
      } else if (entry.type === 'donut') {
        this.donutChart(entry.canvas, entry.data, entry.options, true);
      }
    });
  },

  /**
   * Draw a line chart
   */
  lineChart(canvas, data, options = {}, _isRedraw = false) {
    if (!_isRedraw) this._registerChart(canvas, 'line', data, options);
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const { labels, values } = data;
    const color = options.color || this.colors.primary;
    const showArea = options.showArea !== false;

    const maxVal = Math.max(...values) * 1.05;
    const minVal = Math.min(...values) * 0.95;
    const range = maxVal - minVal;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = this.colors.grid;
    ctx.lineWidth = 0.5;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (chartHeight / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Y-axis labels
      const val = maxVal - (range / gridLines) * i;
      ctx.fillStyle = this.colors.textMuted;
      ctx.font = '11px -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(this.formatNumber(val), padding.left - 10, y + 4);
    }

    // X-axis labels
    const labelInterval = Math.max(1, Math.floor(labels.length / 8));
    ctx.fillStyle = this.colors.textMuted;
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < labels.length; i += labelInterval) {
      const x = padding.left + (chartWidth / (labels.length - 1)) * i;
      ctx.fillText(labels[i], x, height - 10);
    }

    // Data points
    const points = values.map((val, i) => ({
      x: padding.left + (chartWidth / (values.length - 1)) * i,
      y: padding.top + chartHeight - ((val - minVal) / range) * chartHeight
    }));

    // Area fill
    if (showArea) {
      const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
      gradient.addColorStop(0, this.colors.gradientStart);
      gradient.addColorStop(1, this.colors.gradientEnd);

      ctx.beginPath();
      ctx.moveTo(points[0].x, height - padding.bottom);
      points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.lineTo(points[points.length - 1].x, height - padding.bottom);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    // Line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    // Dots on last few points
    const dotCount = Math.min(7, points.length);
    const dotInterval = Math.max(1, Math.floor(points.length / dotCount));
    for (let i = 0; i < points.length; i += dotInterval) {
      const p = points[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = this.colors.background;
      ctx.fill();
    }

    // Last point highlight
    const last = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(last.x, last.y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = this.colors.background;
    ctx.fill();
  },

  /**
   * Draw a bar chart
   */
  barChart(canvas, data, options = {}, _isRedraw = false) {
    if (!_isRedraw) this._registerChart(canvas, 'bar', data, options);
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const { labels, values } = data;
    const color = options.color || this.colors.primary;
    const maxVal = Math.max(...values) * 1.1;

    ctx.clearRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = this.colors.grid;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      const val = maxVal - (maxVal / 4) * i;
      ctx.fillStyle = this.colors.textMuted;
      ctx.font = '11px -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(this.formatNumber(val), padding.left - 10, y + 4);
    }

    // Bars
    const barWidth = (chartWidth / labels.length) * 0.6;
    const gap = (chartWidth / labels.length) * 0.4;

    values.forEach((val, i) => {
      const barHeight = (val / maxVal) * chartHeight;
      const x = padding.left + (chartWidth / labels.length) * i + gap / 2;
      const y = padding.top + chartHeight - barHeight;

      // Bar with rounded top
      ctx.beginPath();
      const radius = Math.min(4, barWidth / 2);
      ctx.moveTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.lineTo(x + barWidth - radius, y);
      ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
      ctx.lineTo(x + barWidth, padding.top + chartHeight);
      ctx.lineTo(x, padding.top + chartHeight);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.8;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Label
      ctx.fillStyle = this.colors.textMuted;
      ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], x + barWidth / 2, height - 10);
    });
  },

  /**
   * Draw a donut chart
   */
  donutChart(canvas, data, options = {}, _isRedraw = false) {
    if (!_isRedraw) this._registerChart(canvas, 'donut', data, options);
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const size = options.size || 160;

    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.scale(dpr, dpr);

    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 - 10;
    const innerRadius = radius * 0.65;

    const total = data.values.reduce((sum, v) => sum + v, 0);
    let startAngle = -Math.PI / 2;

    data.values.forEach((val, i) => {
      const sliceAngle = (val / total) * Math.PI * 2;
      const color = this.palette[i % this.palette.length];

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.arc(centerX, centerY, innerRadius, startAngle + sliceAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      startAngle += sliceAngle;
    });

    // Center text
    if (options.centerText) {
      ctx.fillStyle = this.colors.text;
      ctx.font = 'bold 20px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(options.centerText, centerX, centerY);
    }
  },

  formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return Math.round(num).toString();
  }
};
