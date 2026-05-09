const fs = require('fs');
const path = require('path');

function loadJSON(filename) {
  const filePath = path.join(__dirname, '..', 'data', 'mock', filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveJSON(filename, data) {
  const filePath = path.join(__dirname, '..', 'data', 'mock', filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function handleLeadRoutes(req, res, pathname, query, body) {
  res.setHeader('Content-Type', 'application/json');

  if (pathname === '/api/leads/keywords' && req.method === 'GET') {
    const leads = loadJSON('leads.json');
    res.end(JSON.stringify({ keywords: leads.keywords }));
    return true;
  }

  if (pathname === '/api/leads/keywords' && req.method === 'POST') {
    const leads = loadJSON('leads.json');

    const newKeyword = {
      id: 'k' + String(leads.keywords.length + 1).padStart(3, '0'),
      keyword: body.keyword || '',
      auto_reply: body.auto_reply || '',
      active: true,
      triggers_count: 0
    };

    leads.keywords.push(newKeyword);
    saveJSON('leads.json', leads);

    res.statusCode = 201;
    res.end(JSON.stringify(newKeyword));
    return true;
  }

  if (pathname === '/api/leads/collected') {
    const leads = loadJSON('leads.json');
    res.end(JSON.stringify({ leads: leads.collected_leads }));
    return true;
  }

  if (pathname === '/api/leads/conversions') {
    const leads = loadJSON('leads.json');
    res.end(JSON.stringify(leads.conversions));
    return true;
  }

  return false;
}

module.exports = { handleLeadRoutes };
