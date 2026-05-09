/**
 * Shared HTML escaping utility to prevent XSS
 * Use this for ALL interpolated values in innerHTML templates
 */
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const str = String(text);
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
