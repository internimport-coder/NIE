// ================================================================
//  Import Tracking System — app.js (Rebuilt)
//  Semua fungsi bekerja: search, form PO, shipment, kalender
// ================================================================

// ── State ─────────────────────────────────────────────────────
let editingPoNumber     = null;
let editingShipmentIndex = null;
let calendarYear        = new Date().getFullYear();
let calendarMonth       = new Date().getMonth();
let currentDetailPoNumber = null; // PO currently open in the PO Inquiry Detail panel

// ── Current User (used to attribute "who edited") ──
const CURRENT_USER_KEY = 'importtrack_current_user';

function getCurrentUser() {
  return localStorage.getItem(CURRENT_USER_KEY) || '';
}

function setCurrentUser(name) {
  const clean = (name || '').trim();
  if (!clean) return false;
  localStorage.setItem(CURRENT_USER_KEY, clean);
  updateUserBadge();
  return true;
}

function updateUserBadge() {
  const name = getCurrentUser() || 'Admin';
  const nameEl = document.getElementById('sidebar-user-name');
  if (nameEl) nameEl.textContent = name;
  const avatarEl = document.getElementById('sidebar-user-avatar');
  if (avatarEl) {
    const initials = name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    avatarEl.textContent = initials || 'AD';
  }
}

// Called once on load: if no name is saved yet, prompt for one
// first so all subsequent edit/verify actions are recorded under the right name.
function ensureCurrentUser() {
  if (!getCurrentUser()) openUserIdentityModal(true);
  else updateUserBadge();
}

function openUserIdentityModal(isFirstTime = false) {
  const modal = document.getElementById('user-identity-modal');
  if (!modal) return;
  const input = document.getElementById('user-identity-input');
  const title = document.getElementById('user-identity-title');
  const sub   = document.getElementById('user-identity-sub');
  if (input) input.value = getCurrentUser() || '';
  if (title) title.textContent = isFirstTime ? 'Siapa Anda?' : 'Ganti Nama Pengguna';
  if (sub) sub.textContent = isFirstTime
    ? 'This name will be recorded in the log every time you edit or verify a PO.'
    : 'This name will be recorded in the next activity log entries.';
  modal.style.display = 'flex';
  setTimeout(() => input && input.focus(), 50);
}

function closeUserIdentityModal() {
  const modal = document.getElementById('user-identity-modal');
  if (modal) modal.style.display = 'none';
}

function saveUserIdentity() {
  const input = document.getElementById('user-identity-input');
  const val = input ? input.value.trim() : '';
  if (!val) { showToast('Nama wajib diisi.', 'error'); return; }
  setCurrentUser(val);
  closeUserIdentityModal();
  showToast(`You are logged in as ${val}.`, 'success');
}

// ── Helpers ───────────────────────────────────────────────────
function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function fmt(n, dec = 2) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function badge(status) {
  const map = {
    'belum-pib': ['badge-gray',   'No PIB Yet'],
    'kurang':    ['badge-red',    'Kurang'],
    'match':     ['badge-green',  'Match'],
    'lebih':     ['badge-orange', 'Lebih'],
  };
  const [cls, label] = map[status] || map['belum-pib'];
  return `<span class="badge ${cls}"><span class="badge-dot"></span>${label}</span>`;
}

function itemStatus(s) {
  if (s > 0) return badge('lebih');
  if (s < 0) return badge('kurang');
  return badge('match');
}

function selisih(val) {
  if (val > 0) return `<span class="sel-pos">+${val}</span>`;
  if (val < 0) return `<span class="sel-neg">${val}</span>`;
  return `<span class="sel-zero">0</span>`;
}

function computeStatus(qtyPIB, qtyWH, pibNum) {
  if (!pibNum) return 'belum-pib';
  if (qtyWH > qtyPIB) return 'lebih';
  if (qtyWH < qtyPIB) return 'kurang';
  return 'match';
}

function getDaysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
  return isNaN(diff) ? null : diff;
}

function getDaysBetween(a, b) {
  if (!a || !b) return null;
  const diff = Math.ceil((new Date(b) - new Date(a)) / 86400000);
  return isNaN(diff) ? null : diff;
}

let toastTimer;
function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (type ? ' toast-' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

function getAllPoData() { return MOCK_PO_DATA; }

// ── KPI ───────────────────────────────────────────────────────
function updateKPI(data) {
  const counts = { 'belum-pib': 0, kurang: 0, match: 0, lebih: 0 };
  (data || []).forEach(d => { if (d.status in counts) counts[d.status]++; });
  document.getElementById('kpi-belum').textContent  = counts['belum-pib'];
  document.getElementById('kpi-kurang').textContent = counts['kurang'];
  document.getElementById('kpi-match').textContent  = counts['match'];
  document.getElementById('kpi-lebih').textContent  = counts['lebih'];
}

// ── Dashboard overview (hero, alerts, PO status summary) ───────
function renderDashboardOverview() {
  const data = getAllPoData();

  // Greeting + date
  const greetEl = document.getElementById('dash-greeting');
  const dateEl  = document.getElementById('dash-date');
  if (greetEl) {
    const h = new Date().getHours();
    const salam = h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 19 ? 'Selamat sore' : 'Selamat malam';
    greetEl.innerHTML = `<i class="ti ti-hand-sparkles"></i> ${salam}, Admin`;
  }
  if (dateEl) {
    const span = dateEl.querySelector('span') || dateEl;
    span.textContent = new Date().toLocaleDateString('id-ID', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
  }

  // Counts per status
  const counts = { 'belum-pib': 0, kurang: 0, match: 0, lebih: 0 };
  data.forEach(d => { if (d.status in counts) counts[d.status]++; });
  const total = data.length || 0;

  // Alerts
  const alertsEl = document.getElementById('dash-alerts');
  if (alertsEl) {
    const alerts = [];
    if (counts['belum-pib'] > 0) {
      alerts.push({ cls:'alert-warn', icon:'ti-file-alert', tab:'history',
        html:`<b>${counts['belum-pib']} PO</b> do not have a PIB number yet — please complete the document soon` });
    }
    if (counts.kurang > 0) {
      alerts.push({ cls:'alert-danger', icon:'ti-trending-down', tab:'history',
        html:`<b>${counts.kurang} PO</b> is experiencing a shortage — warehouse qty is less than PIB` });
    }
    if (counts.lebih > 0) {
      alerts.push({ cls:'alert-info', icon:'ti-trending-up', tab:'history',
        html:`<b>${counts.lebih} PO</b> kelebihan qty (excess) dibanding PIB` });
    }
    const soon = MOCK_SHIPMENTS
      .map(s => ({ ...s, d: getDaysUntil(s.ataPort) }))
      .filter(s => s.d !== null && s.d >= 0 && s.d <= 3);
    if (soon.length > 0) {
      alerts.push({ cls:'alert-warn', icon:'ti-ship', tab:'shipment',
        html:`<b>${soon.length} shipment</b> will arrive at the port within the next 3 days` });
    }

    if (!alerts.length) {
      alertsEl.innerHTML = `<div class="dash-alert-empty"><i class="ti ti-circle-check"></i> All POs and shipments are in good shape. Nothing needs follow-up.</div>`;
    } else {
      alertsEl.innerHTML = alerts.map(a => `
        <div class="dash-alert-item ${a.cls}" onclick="switchTab('${a.tab}')">
          <i class="ti ${a.icon}"></i>
          <span>${a.html}</span>
          <i class="ti ti-chevron-right dash-alert-arrow"></i>
        </div>`).join('');
    }
  }

  // Shipment count badge
  const shipCountEl = document.getElementById('dash-ship-count');
  if (shipCountEl) shipCountEl.textContent = `${MOCK_SHIPMENTS.length} shipment`;

  // PO status summary cards — HIDDEN
  // const summaryEl = document.getElementById('dash-po-summary');
  // if (summaryEl) {
  //   const cards = [
  //     { key:'belum-pib', label:'No PIB Yet', color:'var(--c-gray)',   count: counts['belum-pib'] },
  //     { key:'kurang',    label:'Shortage',  color:'var(--c-red)',    count: counts.kurang },
  //     { key:'match',     label:'Match',     color:'var(--c-green)',  count: counts.match },
  //     { key:'lebih',     label:'Excess',    color:'var(--c-orange)', count: counts.lebih },
  //   ];
  //   summaryEl.innerHTML = `<div class="po-summary-grid">${cards.map(c => {
  //     const pct = total ? Math.round((c.count/total)*100) : 0;
  //     return `
  //       <div class="po-summary-card">
  //         <div class="po-summary-top">
  //           <span class="po-summary-label">${c.label}</span>
  //           <span class="po-summary-count" style="color:${c.color}">${c.count}</span>
  //         </div>
  //         <div class="po-summary-bar-track"><div class="po-summary-bar-fill" style="width:${pct}%;background:${c.color}"></div></div>
  //         <div class="po-summary-pct">${pct}% of total ${total} PO</div>
  //       </div>`;
  //   }).join('')}</div>`;
  // }
}

// ── Tab navigation ─────────────────────────────────────────────
const PAGE_CONFIG = {
  home:        { title: 'Dashboard',             sub: 'Overview of recent import and shipment activity',       navId: 'nav-home'        },
  shipment:    { title: 'Upcoming Shipment',     sub: 'List and schedule of upcoming shipments',           navId: 'nav-shipment'    },
  create:      { title: 'Create / Edit PO',      sub: 'Manually create a new PO or edit an existing one',  navId: 'nav-po-create',  groups: ['navgrp-po'] },
  history:     { title: 'History PO',            sub: 'History of all saved Purchase Orders',         navId: 'nav-po-history', groups: ['navgrp-po','navgrp-po-inquiry'] },
  search:      { title: 'PO Inquiry',            sub: 'Search and look up PO status in detail',             navId: 'nav-po-inquiry', groups: ['navgrp-po'] },
  'pib-compare': { title: 'Compare PIB',         sub: 'Detect a PIB PDF and compare its item quantities against a PO', navId: 'nav-pib-compare', groups: ['navgrp-po'] },
  ci:          { title: 'Verifikasi CI',         sub: 'Select a PO, upload the CI, and compare qty per SKU',       navId: 'nav-ci',         groups: ['navgrp-po'] },
  'ci-history':{ title: 'History Verifikasi CI', sub: 'History of all saved CI verifications',       navId: 'nav-ci-history', groups: ['navgrp-po','navgrp-ci'] },
  valrecon:    { title: 'Payment Proof Matching', sub: 'Search and match payment proof against CI/PO data already in the system.', navId: 'nav-valrecon', groups: ['navgrp-po'] },
  nie:         { title: 'NIE Center',               sub: 'Auto-matching NIE BPOM for SKI creation — upload a CI and the system finds the NIE automatically', navId: 'nav-nie', groups: ['navgrp-skibpom'] },
};

function toggleNavGroup(groupId, forceOpen) {
  const el = document.getElementById(groupId);
  if (!el) return;
  if (forceOpen) el.classList.add('open');
  else el.classList.toggle('open');
}

function switchTab(tab) {
  // Hide all pages
  ['home-panel','shipment-panel','create-panel','history-panel','search-panel','pib-compare-panel','ci-panel','ci-history-panel','valrecon-panel','nie-panel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  // Remove all active states
  Object.values(PAGE_CONFIG).forEach(cfg => {
    const el = document.getElementById(cfg.navId);
    if (el) el.classList.remove('active');
  });

  // Show target panel
  const cfg = PAGE_CONFIG[tab];
  if (cfg) {
    const panelId = tab === 'ci-history' ? 'ci-history-panel' : tab + '-panel';
    const panel = document.getElementById(panelId);
    if (panel) panel.style.display = 'block';
    document.getElementById('page-title').textContent = cfg.title;
    document.getElementById('page-sub').textContent   = cfg.sub;
    const navEl = document.getElementById(cfg.navId);
    if (navEl) navEl.classList.add('active');
    (cfg.groups || []).forEach(gid => toggleNavGroup(gid, true));
  }

  // Per-tab actions
  if (tab === 'home') {
    renderDashboardOverview();
    renderShipmentTop5('home-hero', { layout: 'stack', clickable: true });
    renderHomeCalendar();
  } else if (tab === 'shipment') {
    renderShipmentDashboard();
  } else if (tab === 'history') {
    renderPibHistory();
  } else if (tab === 'search') {
    const es = document.getElementById('empty-state');
    const rs = document.getElementById('results-section');
    if (es) es.style.display = 'flex';
    if (rs) rs.style.display = 'none';
  } else if (tab === 'pib-compare') {
    populatePibComparePoSelect();
  } else if (tab === 'ci-history') {
    renderCiHistory();
  } else if (tab === 'valrecon') {
    initValRecon();
  } else if (tab === 'nie') {
    initNieCenter();
  }

  // Hide KPI strip for shipment tab
  try {
    const kpiStrip = document.getElementById('kpi-strip');
    if (kpiStrip) {
      if (tab === 'shipment' || tab === 'valrecon' || tab === 'nie') kpiStrip.style.display = 'none';
      else kpiStrip.style.display = '';
    }
  } catch (e) {}
}

// ── PDF Auto-Fill ─────────────────────────────────────────────
const PO_SYSTEM_PROMPT = `You are a Purchase Order data extraction assistant for PT Social Bella Indonesia (Sociolla).
The PO PDF may contain ONE or MULTIPLE Purchase Orders. Extract them all and return ONLY a valid JSON object, no explanation, no markdown.

JSON structure to return:
{
  "is_multi_po": false,
  "po_number": "",
  "po_numbers": [],
  "rev_code": "",
  "currency": "",
  "order_date": "",
  "schedule_date": "",
  "supplier": "",
  "total_qty": 0,
  "total_amount": 0,
  "po_list": [
    {
      "po_number": "",
      "order_date": "",
      "schedule_date": "",
      "total_qty": 0,
      "total_amount": 0,
      "items": []
    }
  ],
  "items": []
}

EXTRACTION RULES — read carefully:

1. MULTI-PO DETECTION:
   - If the PDF contains more than one "Purchase Order Confirmation #..." header, set is_multi_po = true.
   - List ALL po_numbers found in po_numbers array.
   - Fill po_list with each PO's data separately.
   - Set po_number = first PO number found.
   - Set total_amount = SUM of all POs' "Total Without Taxes" values.
   - Set total_qty = SUM of all POs' "Total Qty" values.
   - Set items = combined items from ALL POs.

2. po_number: 
   - Found after "Purchase Order Confirmation #" OR in "Our Order Reference:" field.
   - Example: "PO/SBI/2025/00003001"
   - The PDF may split it across lines like "PO/SBI/2025/000" + newline + "03001" — JOIN them into one string.

3. rev_code:
   - Found on page 2 after the label "Rev:" — example: "Rev: PO/SBI/2025/00002213" → rev_code = "PO/SBI/2025/00002213"
   - If no "Rev:" label found, set to null.

4. currency:
   - Found in the "Currency" column header area — example: "JPY" or "USD".

5. order_date:
   - Found after "Order Date:" label — example: "25-Aug-2025"
   - Convert to YYYY-MM-DD format: "25-Aug-2025" → "2025-08-25"
   - Month abbreviations: Jan=01, Feb=02, Mar=03, Apr=04, May=05, Jun=06, Jul=07, Aug=08, Sep=09, Oct=10, Nov=11, Dec=12

6. schedule_date:
   - Found after "Schedule Date" label — same format conversion as order_date.

7. supplier:
   - Found under "Supplier:" section — use the COMPANY NAME only (last line of supplier block).
   - Example: "ISHIZAWA LABORATORIES INC."

8. total_qty: SUM of all "Total Qty" labels across all POs.
9. total_amount: SUM of all "Total Without Taxes" values across all POs (strip ¥ sign and commas).

10. items — for EACH line item row in ALL PO tables:
   a. sku: text INSIDE square brackets [ ] at start of description. 
   b. name: product name OUTSIDE the brackets, before any parenthesis.
   c. size: text inside the FIRST parenthesis group in the description.
   d. qty: the quantity number (strip "Units" text, strip commas).
   e. unit_price: the Unit Price column number.
   f. discount_pct: the Disc (%) column number.
   g. net_price: the Net Price column number (strip ¥ sign and commas). If "¥ 0" → 0.

   IMPORTANT: Extract ALL items including those with 100% discount (net_price = 0). Do NOT skip any row.`;



function parsePdfHeuristic(pdfText) {
  const raw = (pdfText || '').replace(/\r/g, '\n');
  const out = {
    is_multi_po: false,
    po_number: null, po_numbers: [], rev_code: null,
    order_date: null, schedule_date: null, currency: null,
    supplier: null, total_qty: 0, total_amount: null,
    po_list: [], items: []
  };

  const monthMap = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
  function parseDateValue(value) {
    if (!value) return null;
    const parts = value.replace(/\s+/g, ' ').trim().match(/(\d{1,2})[-\s]([A-Za-z]{3,})[-\s](\d{2,4})/i);
    if (!parts) return null;
    let [, day, mon, year] = parts;
    day = day.padStart(2, '0');
    mon = mon.toLowerCase().slice(0, 3);
    year = year.length === 2 ? '20' + year : year;
    const month = monthMap[mon];
    return month ? `${year}-${month}-${day}` : null;
  }

  // ── Deteksi semua nomor PO dalam satu PDF ──────────────────────
  // Find every "Purchase Order Confirmation #..." or PO/SBI pattern in the text
  const compactNoSpaces = raw.replace(/\s+/g, '');
  const allPoMatches = [...compactNoSpaces.matchAll(/(PO\/SBI\/[0-9]{4}\/[0-9]{5,})/gi)];
  const uniquePoNumbers = [...new Set(allPoMatches.map(m => m[1]))];

  if (uniquePoNumbers.length >= 2) {
    out.is_multi_po = true;
    out.po_numbers = uniquePoNumbers;
    out.po_number = uniquePoNumbers[0];
  } else if (uniquePoNumbers.length === 1) {
    out.po_number = uniquePoNumbers[0];
    out.po_numbers = uniquePoNumbers;
  } else {
    // Fallback: search from plain text
    const m = raw.match(/Purchase\s*Order\s*Confirmation\s*#\s*(PO\/SBI\/[A-Z0-9\-\/\s]+)/i)
           || raw.match(/Our\s*Order[\s\S]{0,80}?Reference[:\s]*([A-Z0-9\-\/\s]+)/i);
    if (m) out.po_number = (m[1] || '').replace(/\s+/g, '').trim();
    if (out.po_number) out.po_numbers = [out.po_number];
  }

  // ── If multi-PO: parse each PO separately ─────────────
  if (out.is_multi_po) {
    // Split teks berdasarkan kemunculan "Purchase Order Confirmation"
    const sections = raw.split(/(?=Purchase Order Confirmation\s*#)/i).filter(Boolean);
    let combinedAmount = 0;
    let combinedQty = 0;

    sections.forEach(section => {
      // Search for a PO number in this section
      const secCompact = section.replace(/\s+/g, '');
      const secPoMatch = secCompact.match(/(PO\/SBI\/[0-9]{4}\/[0-9]{5,})/i);
      if (!secPoMatch) return;

      const poNum = secPoMatch[1];
      const amtM = section.match(/Total\s*Without\s*Taxes[^¥\d]*[¥]?\s*([\d,]+)/i);
      const qtyM = section.match(/Total\s*Qty[:\s]*([\d,]+)/i);
      const amt = amtM ? parseInt((amtM[1]||'0').replace(/,/g,''), 10) : 0;
      const qty = qtyM ? parseInt((qtyM[1]||'0').replace(/,/g,''), 10) : 0;

      combinedAmount += amt;
      combinedQty += qty;

      const odM = section.match(/Order\s*Date[:\s]*([0-9]{1,2}[-\s][A-Za-z]{3,}[-\s][0-9]{2,4})/i);
      const sdM = section.match(/Schedule\s*Date[:\s]*([0-9]{1,2}[-\s][A-Za-z]{3,}[-\s][0-9]{2,4})/i);

      out.po_list.push({
        po_number: poNum,
        order_date: odM ? parseDateValue(odM[1]) : null,
        schedule_date: sdM ? parseDateValue(sdM[1]) : null,
        total_qty: qty,
        total_amount: amt,
        items: []
      });
    });

    out.total_amount = combinedAmount;
    out.total_qty = combinedQty;

    // Use the first PO's data for single fields
    if (out.po_list.length > 0) {
      out.order_date = out.po_list[0].order_date;
      out.schedule_date = out.po_list[0].schedule_date;
    }
  } else {
    // Single PO
    const tqty = raw.match(/Total\s*Qty[:\s]*([0-9,]+)/i);
    if (tqty) out.total_qty = parseInt((tqty[1]||'0').replace(/,/g,''), 10) || 0;
    const tAmt = raw.match(/Total\s*Without\s*Taxes[^¥\d]*[¥]?\s*([\d,]+)/i);
    if (tAmt) out.total_amount = parseInt((tAmt[1]||'0').replace(/,/g,''), 10) || 0;

    const od = raw.match(/Order\s*Date[:\s]*([0-9]{1,2}[-\s][A-Za-z]{3,}[-\s][0-9]{2,4})/i);
    if (od) out.order_date = parseDateValue(od[1]);
    const sd = raw.match(/Schedule\s*Date[:\s]*([0-9]{1,2}[-\s][A-Za-z]{3,}[-\s][0-9]{2,4})/i);
    if (sd) out.schedule_date = parseDateValue(sd[1]);
  }

  const cur = raw.match(/\bCurrency[:\s]*([A-Z]{3})\b/i);
  if (cur) out.currency = cur[1].toUpperCase();

  const rev = raw.match(/\bRev[:\s]*([A-Z0-9\-\/]+)/i);
  if (rev) out.rev_code = rev[1].trim();

  // ── Items ───────────────────────────────────────────────────────
  const itemBlocks = raw.split(/(?=\[[^\]]+\])/g).map(b => b.trim()).filter(Boolean);
  itemBlocks.forEach(block => {
    const skuMatch = block.match(/^\[([^\]]+)\]/);
    if (!skuMatch) return;
    const sku = skuMatch[1].trim();
    const text = block.slice(skuMatch[0].length).trim();
    const qtyMatches = [...text.matchAll(/\b([0-9]{1,3}(?:,[0-9]{3})*)\s*Units?\b/gi)];
    if (!qtyMatches.length) return;
    const qty = parseInt(qtyMatches[0][1].replace(/,/g, ''), 10) || 0;

    // ── Unit Price / Disc% / Net Price — biasanya muncul tepat setelah "N Units" ──
    // Pola: <unit_price> <disc%> [¥/$] <net_price>   e.g. "625.00 0.00 ¥ 3,600,000"
    let unit_price = null, discount_pct = null, net_price = null;
    const afterQty = text.slice(qtyMatches[0].index + qtyMatches[0][0].length);
    const priceMatch = afterQty.match(/([\d,]+(?:\.\d+)?)\s+([\d.]+)\s*[¥$]?\s*([\d,]+(?:\.\d+)?)/);
    if (priceMatch) {
      unit_price   = parseFloat(priceMatch[1].replace(/,/g, '')) || 0;
      discount_pct = parseFloat(priceMatch[2]) || 0;
      net_price    = parseFloat(priceMatch[3].replace(/,/g, '')) || 0;
    }

    const sizeMatch = text.match(/\(([^)]+)\)/);
    let size = sizeMatch ? sizeMatch[1].trim() : null;
    if (size) size = size.replace(/^(Size|Variant|Non Specify)\s*:\s*/i, '').trim();
    let name = text;
    if (sizeMatch) name = name.replace(sizeMatch[0], '');
    const qtyIndex = name.search(/\b[0-9]{1,3}(?:,[0-9]{3})*\s*Units?\b/gi);
    if (qtyIndex !== -1) name = name.slice(0, qtyIndex);
    name = name.replace(/[¥$]\s*[0-9,\.]+/g, '').replace(/\s+/g, ' ').trim();
    out.items.push({ sku, name, size, qty, unit_price, discount_pct, net_price });
  });

  return out;
}

async function parsePdfWithAI(pdfText) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: PO_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Extract all Purchase Order data from the following PDF text and return ONLY valid JSON.\n\nPDF TEXT:\n${pdfText}`
      }]
    })
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'API error');
  const raw = data.content.map(b => b.text || '').join('');
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  return JSON.parse(cleaned);
}

async function extractTextFromPdf(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const typedArray = new Uint8Array(e.target.result);
        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map(it => it.str).join(' ') + '\n';
        }
        resolve(text);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function handlePdfDrop(event) {
  event.preventDefault();
  document.getElementById('pdf-drop-zone').classList.remove('dragover');
  const file = event.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') handlePdfUpload(file);
  else showToast('Only PDF files are supported.', 'error');
}

async function handlePdfUpload(file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { showToast('File terlalu besar. Maks 10MB.', 'error'); return; }

  const dropContent = document.getElementById('pdf-drop-content');
  const loading     = document.getElementById('pdf-loading');
  dropContent.style.display = 'none';
  loading.style.display = 'block';

  try {
    const pdfText = await extractTextFromPdf(file);
    let parsed = null;
    try {
      parsed = await parsePdfWithAI(pdfText);
    } catch (aiErr) {
      console.warn('AI parse failed, falling back to heuristic parser', aiErr);
      parsed = parsePdfHeuristic(pdfText);
      showToast('Parser AI gagal — menggunakan parser lokal.', 'warning');
    }
    fillFormFromParsed(parsed, file.name);
  } catch (err) {
    console.error(err);
    showToast('Failed to read the PDF. Please try again or fill it in manually.', 'error');
    resetPdfUpload();
  }
}

// ════════════════════════════════════════════════════════
//  CI VERIFICATION — Rebuilt
//  Flow: Pilih PO → Upload CI → Tabel Perbandingan → Simpan
// ════════════════════════════════════════════════════════

// ── State ─────────────────────────────────────────────
let currentCiPoNumber   = null;
let currentCiParsed     = null;
let currentCiFileName   = null;
let currentCiCompareRows = null; // array of compare row objects

const CI_HISTORY_KEY = 'importtrack_ci_history';

// ── LocalStorage helpers ───────────────────────────────
function loadCiHistory() {
  try { return JSON.parse(localStorage.getItem(CI_HISTORY_KEY) || '[]'); }
  catch (e) { return []; }
}
function saveCiHistoryAll(list) {
  localStorage.setItem(CI_HISTORY_KEY, JSON.stringify(list));
}

// ── Edit Log (siapa mengedit apa, kapan) ──────────────────────
const EDIT_LOG_KEY = 'importtrack_edit_log';

function loadEditLog() {
  try { return JSON.parse(localStorage.getItem(EDIT_LOG_KEY) || '[]'); }
  catch (e) { return []; }
}
function saveEditLogAll(list) {
  localStorage.setItem(EDIT_LOG_KEY, JSON.stringify(list));
}

// Log one entry. Called from every save point: PO/PIB/Qty WH edits,
// CI verification (qty & value), and Value Reconciliation.
function logActivity(poNumber, action, detail = '') {
  if (!poNumber) return;
  const log = loadEditLog();
  log.unshift({
    id: Date.now() + '-' + Math.random().toString(16).slice(2),
    timestamp: new Date().toISOString(),
    user: getCurrentUser() || 'Admin',
    poNumber,
    action,
    detail,
  });
  saveEditLogAll(log.slice(0, 500)); // batasi 500 entri terbaru
}

function getEditLogForPo(poNumber) {
  return loadEditLog()
    .filter(e => e.poNumber === poNumber)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function fmtLogTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function editLogRowsHtml(entries) {
  if (!entries.length) {
    return `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--c-text-hint)">No edit history yet for this PO.</td></tr>`;
  }
  return entries.map(e => `
    <tr>
      <td style="white-space:nowrap">${fmtLogTime(e.timestamp)}</td>
      <td><strong>${e.user}</strong></td>
      <td>${e.action}</td>
      <td style="color:var(--c-text-hint)">${e.detail || '—'}</td>
    </tr>
  `).join('');
}

// Render log aktivitas inline di panel Detail PO Inquiry
function renderEditLog(poNumber) {
  const tbody = document.getElementById('edit-log-tbody');
  if (!tbody) return;
  const entries = getEditLogForPo(poNumber);
  const countEl = document.getElementById('edit-log-count');
  if (countEl) countEl.textContent = entries.length + ' aktivitas';
  tbody.innerHTML = editLogRowsHtml(entries);
}

// Compact activity log modal — can be opened from History PO / search results
// tanpa perlu membuka detail penuh dulu.
function openEditLogModal(poNumber) {
  if (!poNumber) return;
  const modal = document.getElementById('edit-log-modal');
  if (!modal) return;
  const poEl = document.getElementById('edit-log-modal-po');
  if (poEl) poEl.textContent = poNumber;
  const tbody = document.getElementById('edit-log-modal-tbody');
  if (tbody) tbody.innerHTML = editLogRowsHtml(getEditLogForPo(poNumber));
  modal.style.display = 'flex';
}
function closeEditLogModal() {
  const modal = document.getElementById('edit-log-modal');
  if (modal) modal.style.display = 'none';
}

// ── Step 1: Populate PO dropdown ──────────────────────
function populateCiPoSelect() {
  const select = document.getElementById('ci-po-select');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">— Pilih PO Number —</option>';
  getAllPoData().forEach(po => {
    const option = document.createElement('option');
    option.value = po.poNumber;
    option.textContent = `${po.poNumber} — ${po.supplierLabel || po.supplier}`;
    select.appendChild(option);
  });
  if (current) select.value = current;
}

function filterCiPoList() {
  const query = document.getElementById('ci-po-search')?.value.trim().toLowerCase() || '';
  const select = document.getElementById('ci-po-select');
  if (!select) return;
  select.innerHTML = '<option value="">— Pilih PO Number —</option>';
  getAllPoData().filter(po => {
    const target = `${po.poNumber} ${po.supplierLabel || po.supplier}`.toLowerCase();
    return !query || target.includes(query);
  }).forEach(po => {
    const option = document.createElement('option');
    option.value = po.poNumber;
    option.textContent = `${po.poNumber} — ${po.supplierLabel || po.supplier}`;
    select.appendChild(option);
  });
  if (currentCiPoNumber) select.value = currentCiPoNumber;
}

function selectCiPo(poNumber) {
  currentCiPoNumber = poNumber || null;
  renderCiPoDetail();
  // re-enable step 2 only if PO selected
  const step2 = document.getElementById('ci-step2-card');
  if (step2) {
    step2.style.opacity = poNumber ? '1' : '.5';
    step2.style.pointerEvents = poNumber ? '' : 'none';
  }
  // Reset comparison if PO changes
  if (currentCiParsed) {
    renderCiComparison();
  }
}

function renderCiPoDetail() {
  const detail = document.getElementById('ci-po-detail');
  if (!detail) return;
  if (!currentCiPoNumber) { detail.style.display = 'none'; return; }

  const po = MOCK_PO_DATA.find(p => p.poNumber === currentCiPoNumber);
  if (!po) { detail.style.display = 'none'; return; }

  detail.style.display = 'block';

  // Info bar
  const bar = document.getElementById('ci-po-info-bar');
  if (bar) {
    bar.innerHTML = `
      <div class="ci-po-info-item"><span class="ci-po-info-label">PO Number</span><span class="ci-po-info-val" style="color:var(--c-blue-dark);font-weight:700">${po.poNumber}</span></div>
      <div class="ci-po-info-item"><span class="ci-po-info-label">Brand</span><span class="ci-po-info-val">${po.supplierLabel || po.supplier || '—'}</span></div>
      <div class="ci-po-info-item"><span class="ci-po-info-label">PO Date</span><span class="ci-po-info-val">${fmtDate(po.poDate)}</span></div>
      <div class="ci-po-info-item"><span class="ci-po-info-label">Currency</span><span class="ci-po-info-val">${po.currency || 'USD'}</span></div>
      <div class="ci-po-info-item"><span class="ci-po-info-label">Total Item</span><span class="ci-po-info-val">${(po.items || []).length} SKU</span></div>
      <div class="ci-po-info-item"><span class="ci-po-info-label">Total Qty PO</span><span class="ci-po-info-val">${(po.items || []).reduce((s,i)=>s+(Number(i.qtyPO)||0),0).toLocaleString()}</span></div>
      <div class="ci-po-info-item"><span class="ci-po-info-label">Status</span><span class="ci-po-info-val">${badge(po.status)}</span></div>
    `;
  }

  // Item count badge
  const cnt = document.getElementById('ci-po-item-count');
  if (cnt) cnt.textContent = (po.items || []).length + ' item';

  // Items table
  const tbody = document.getElementById('ci-po-items-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  (po.items || []).forEach(it => {
    const qPO = Number(it.qtyPO || 0);
    const type = it.type || detectItemType(it.sku || '', it.name || '');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family:monospace;font-size:12px;">${it.sku || '—'}</td>
      <td>${cleanItemName(it.name || '') || '—'}</td>
      <td style="font-size:12px;">${it.size || '—'}</td>
      <td>${itemTypeBadge(type)}</td>
      <td class="num"><strong>${qPO.toLocaleString()}</strong></td>
    `;
    tbody.appendChild(tr);
  });

  // Total row
  const totalQty = (po.items || []).reduce((s, i) => s + (Number(i.qtyPO) || 0), 0);
  const totRow = document.createElement('tr');
  totRow.className = 'total-row';
  totRow.innerHTML = `<td colspan="4">Total</td><td class="num"><strong>${totalQty.toLocaleString()}</strong></td>`;
  tbody.appendChild(totRow);
}

// ── Step 2: Handle CI file ─────────────────────────────
function handleCiDrop(event) {
  event.preventDefault();
  const dropZone = document.getElementById('ci-drop-zone');
  if (dropZone) dropZone.classList.remove('dragover');
  const file = event.dataTransfer.files[0];
  if (file) handleCiFile(file);
  else showToast('No file selected.', 'error');
}

function handleCiFileInput(files) {
  if (!files || !files.length) return;
  handleCiFile(files[0]);
}

function handleCiFile(file) {
  if (!file) return;
  if (!currentCiPoNumber) { showToast('Pilih PO terlebih dahulu.', 'error'); return; }
  if (file.size > 10 * 1024 * 1024) { showToast('File terlalu besar. Maks 10MB.', 'error'); return; }
  const allowed = ['application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel','text/csv'];
  if (!allowed.includes(file.type) && !/\.xlsx$|\.xls$|\.csv$|\.pdf$/i.test(file.name)) {
    showToast('Only .pdf, .xlsx, .xls, .csv files are supported.', 'error');
    return;
  }

  document.getElementById('ci-drop-content').style.display = 'none';
  document.getElementById('ci-loading').style.display = 'flex';
  document.getElementById('ci-result-info').style.display = 'none';

  const ext = file.name.split('.').pop().toLowerCase();
  const onParsed = (parsed) => {
    currentCiParsed = parsed;
    currentCiFileName = file.name;
    document.getElementById('ci-loading').style.display = 'none';
    document.getElementById('ci-result-info').style.display = 'flex';
    document.getElementById('ci-result-text').textContent = `${file.name} — ${parsed.items.length} baris terdeteksi`;
    renderCiComparison();
    showToast(`✓ File CI dibaca: ${parsed.items.length} baris`, 'success');
  };
  const onError = (err) => {
    console.error(err);
    showToast('Gagal membaca file CI.', 'error');
    resetCiUpload();
  };

  if (ext === 'pdf') extractTextFromPdf(file).then(text => onParsed(parseCiPdfTable(text))).catch(onError);
  else parseSpreadsheetFile(file).then(onParsed).catch(onError);
}

function resetCiUpload() {
  const fi = document.getElementById('ci-file-input');
  if (fi) fi.value = '';
  const dc = document.getElementById('ci-drop-content');
  if (dc) dc.style.display = 'block';
  const ld = document.getElementById('ci-loading');
  if (ld) ld.style.display = 'none';
  const ri = document.getElementById('ci-result-info');
  if (ri) ri.style.display = 'none';
  currentCiParsed = null;
  currentCiFileName = null;
  currentCiCompareRows = null;
  const cc = document.getElementById('ci-compare-card');
  if (cc) cc.style.display = 'none';
}

// ════════════════════════════════════════════════════════
//  FUZZY LOOKUP ENGINE  (vlookup-style: CI → PO)
// ════════════════════════════════════════════════════════

/**
 * Normalise a string for comparison:
 * lowercase, strip punctuation, collapse whitespace.
 */
function normStr(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Levenshtein distance (character-level).
 * Returns 0 for identical strings.
 */
function levenshtein(a, b) {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[a.length][b.length];
}

/**
 * Token-set similarity (Jaccard on word tokens).
 * Returns 0–1.
 */
function tokenSim(a, b) {
  const ta = new Set(normStr(a).split(' ').filter(Boolean));
  const tb = new Set(normStr(b).split(' ').filter(Boolean));
  if (!ta.size && !tb.size) return 1;
  let inter = 0;
  ta.forEach(t => { if (tb.has(t)) inter++; });
  return inter / (ta.size + tb.size - inter);
}

/**
 * Combined similarity score 0–100.
 * Weights: token-set 60% + edit-distance (normalised) 40%.
 */
function similarityScore(a, b) {
  const na = normStr(a), nb = normStr(b);
  if (!na && !nb) return 100;
  if (!na || !nb) return 0;
  const tok = tokenSim(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  const lev = maxLen > 0 ? 1 - levenshtein(na, nb) / maxLen : 1;
  return Math.round((tok * 0.60 + lev * 0.40) * 100);
}

/**
 * Confidence label from score.
 */
function confLabel(score, via) {
  if (via === 'SKU Exact')   return { text: 'SKU Exact',   cls: 'conf-exact' };
  if (via === 'SKU Partial') return { text: 'SKU ~Match',  cls: 'conf-high'  };
  if (via === 'Nama + Qty')  return { text: 'Nama+Qty ✓',  cls: 'conf-high'  };
  if (score >= 75)           return { text: score + '%',   cls: 'conf-high'  };
  if (score >= 50)           return { text: score + '%',   cls: 'conf-mid'   };
  return                            { text: score + '%',   cls: 'conf-low'   };
}

/**
 * Build CI aggregated list — one bucket per distinct item.
 * DO NOT merge rows with same name but different qty (they are different items).
 * Only merge if truly identical (same sku AND same name AND same qty).
 */
function buildCiAgg(ciItems) {
  const ciAgg = [];
  ciItems.forEach(row => {
    const sku  = String(row.sku  || row.reference || row.product_code || row.item_code || '').trim();
    const name = String(row.name || row.product_name || row.description || row.nama_bpom || '').trim();
    const qty  = Number(row.qty  || row.quantity || 0);
    const amount = Number(row.total || row.amount || row.value || row.net_price || 0);
    if (!name && !sku) return; // skip blank rows
    // Only deduplicate truly identical entries (same sku+name+qty)
    const dupe = ciAgg.find(b =>
      b.qty === qty &&
      normStr(b.name) === normStr(name) &&
      ((!sku && !b.sku) || (sku && b.sku && sku.toUpperCase() === b.sku.toUpperCase()))
    );
    if (dupe) {
      // genuine duplicate row — skip (don't double-count)
    } else {
      ciAgg.push({ sku, name, qty, amount, rawRow: row });
    }
  });
  return ciAgg;
}

/**
 * 2-Phase matching engine — proven 9/9 on real KEANA data.
 *
 * Key insight: when names are similar, use QTY as the tiebreaker.
 * A "Keana Rice Pack qty=5760" maps to PO "KEANA Rice Pack qty=5760", not qty=80.
 *
 * Scoring (higher = better):
 *   Priority 1 (score 3xx): SKU exact match
 *   Priority 2 (score 2xx): SKU partial match
 *   Priority 3 (score 1xx): Name fuzzy + qty EXACT  → 100 + nameSim*100
 *   Priority 4 (score 0xx): Name fuzzy only          → nameSim*100  (min 35%)
 *
 * Two-pass to avoid greedy errors:
 *   Pass A — allocate all Priority-1/2/3 matches (unambiguous or qty-confirmed)
 *   Pass B — fill remaining with best name-only match
 */
function buildFuzzyMatches(poItems, ciItems) {
  const ciAgg    = buildCiAgg(ciItems);
  const usedCiIdx = new Set();

  // ── Score function for one (po, ci) pair ──────────────
  function pairScore(poSku, poName, qPO, ci, idx) {
    if (usedCiIdx.has(idx)) return -1;
    // SKU exact
    if (poSku && ci.sku && ci.sku.toUpperCase() === poSku.toUpperCase()) return 300;
    // SKU partial
    if (poSku && ci.sku) {
      const pn = poSku.toUpperCase(), cn = ci.sku.toUpperCase();
      if (pn.includes(cn) || cn.includes(pn)) return 200;
    }
    // Name similarity
    const sim = tokenSim(poName, ci.name);
    if (sim < 0.35) return -1; // too different, reject
    if (ci.qty === qPO) return 100 + Math.round(sim * 100); // name+qty match
    return Math.round(sim * 100);                            // name only
  }

  // Build score matrix [poIdx][ciIdx]
  const poList = poItems.map(it => {
    const qPO = Number(it.qtyPO || 0);
    const unitPrice = Number(it.unitPrice || 0);
    const valuePO = it.valuePO != null && it.valuePO !== '' ? Number(it.valuePO) : qPO * unitPrice;
    return {
      poSku : (it.sku  || '').trim(),
      poName: cleanItemName(it.name || ''),
      qPO   : qPO,
      unitPrice, valuePO,
      type  : it.type || detectItemType((it.sku||''), (it.name||'')),
      size  : it.size || '',
      orig  : it,
    };
  });

  // ── Pass A: greedily assign best unambiguous matches ──
  // Iterate score priority descending: 3xx → 2xx → 1xx
  // For each CI slot, give it to the PO item with highest score.
  // Repeat until no more high-confidence matches remain.
  const assigned = new Array(poList.length).fill(null); // assigned[poIdx] = ciIdx

  for (let round = 0; round < poList.length; round++) {
    let bestPo = -1, bestCi = -1, bestSc = -1;
    poList.forEach((po, pi) => {
      if (assigned[pi] !== null) return;
      ciAgg.forEach((ci, ci_i) => {
        if (usedCiIdx.has(ci_i)) return;
        const sc = pairScore(po.poSku, po.poName, po.qPO, ci, ci_i);
        if (sc > bestSc) { bestSc = sc; bestPo = pi; bestCi = ci_i; }
      });
    });
    if (bestPo === -1 || bestSc < 35) break; // nothing left worth matching
    assigned[bestPo] = bestCi;
    usedCiIdx.add(bestCi);
  }

  // ── Build result rows ──────────────────────────────────
  const rows = poList.map((po, pi) => {
    const ciIdx = assigned[pi];
    if (ciIdx === null || ciIdx === undefined || ciIdx < 0) {
      return {
        sku: po.poSku, name: po.poName, size: po.size, type: po.type, qPO: po.qPO,
        unitPrice: po.unitPrice, valuePO: po.valuePO,
        ciQty: 0, ciAmount: 0, valueCI: null, fromCiFile: false, valueDiff: null,
        matchedName: '', matchedSku: '', score: 0, via: '', matched: false,
        diff: -po.qPO, ciAgg, bestCiIdx: -1,
      };
    }
    const ci  = ciAgg[ciIdx];
    // Determine via label
    let via = 'Nama';
    if (po.poSku && ci.sku && ci.sku.toUpperCase() === po.poSku.toUpperCase()) via = 'SKU Exact';
    else if (po.poSku && ci.sku) {
      const pn = po.poSku.toUpperCase(), cn = ci.sku.toUpperCase();
      if (pn.includes(cn) || cn.includes(pn)) via = 'SKU Partial';
      else if (ci.qty === po.qPO) via = 'Nama + Qty';
      else via = 'Nama';
    } else if (ci.qty === po.qPO) via = 'Nama + Qty';

    const nameSim = Math.round(tokenSim(po.poName, ci.name) * 100);
    const hasCiAmount = !!ci.amount;
    const valueCI = hasCiAmount ? ci.amount : null;
    return {
      sku: po.poSku, name: po.poName, size: po.size, type: po.type, qPO: po.qPO,
      unitPrice: po.unitPrice, valuePO: po.valuePO,
      ciQty: ci.qty, ciAmount: ci.amount || 0, valueCI, fromCiFile: hasCiAmount,
      valueDiff: valueCI != null ? (valueCI - po.valuePO) : null,
      matchedName: ci.name || ci.sku || '—', matchedSku: ci.sku || '',
      score: Math.min(100, nameSim), via, matched: true,
      diff: ci.qty - po.qPO,
      ciAgg, bestCiIdx: ciIdx,
    };
  });

  // ── Extra CI rows not matched to any PO item ──────────
  ciAgg.forEach((ci, idx) => {
    if (!usedCiIdx.has(idx)) {
      rows.push({
        sku: '', name: '—', size: '', type: '', qPO: 0,
        unitPrice: 0, valuePO: 0,
        ciQty: ci.qty, ciAmount: ci.amount || 0, valueCI: ci.amount || 0, fromCiFile: !!ci.amount,
        valueDiff: ci.amount || 0,
        matchedName: ci.name || ci.sku || '?', matchedSku: ci.sku || '',
        score: 0, via: '', matched: false, diff: ci.qty,
        extraFromCi: true, ciAgg, bestCiIdx: idx,
      });
    }
  });

  return { rows, ciAgg };
}

// ── Value status helpers (merged Value Reconciliation) ─
function ciValueRowStatus(r) {
  if (r.valueCI == null) return { status: 'pending', label: 'Not filled in' };
  const d = r.valueDiff;
  if (Math.abs(d) < 0.005) return { status: 'match', label: 'Match' };
  if (d < 0) return { status: 'kurang', label: 'Kurang' };
  return { status: 'lebih', label: 'Lebih' };
}
function ciValueStatusBadge(status, label) {
  const cls = status === 'match' ? 'badge-green' : status === 'kurang' ? 'badge-red' : status === 'lebih' ? 'badge-orange' : 'badge-gray';
  return `<span class="badge ${cls}">${label}</span>`;
}
function ciValueDiffHtml(r) {
  return r.valueCI == null ? '<span style="color:var(--c-text-hint)">—</span>' :
    Math.abs(r.valueDiff) < 0.005 ? `<span class="sel-zero">0.00</span>` :
    r.valueDiff > 0 ? `<span class="sel-pos">+${r.valueDiff.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>` :
    `<span class="sel-neg">${r.valueDiff.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>`;
}

// Called on every keystroke in the inline "Value CI" input — updates state
// and just the diff/status cells for that row (keeps cursor/focus intact).
function ciRecalcRowValue(rowIdx) {
  const input = document.getElementById(`ci-value-ci-${rowIdx}`);
  const r = currentCiCompareRows && currentCiCompareRows[rowIdx];
  if (!input || !r) return;
  const raw = input.value.trim();
  r.valueCI = raw === '' ? null : parseMoneyNum(raw);
  r.fromCiFile = false; // manual edit supersedes the auto-read value
  r.valueDiff = r.valueCI != null ? (r.valueCI - r.valuePO) : null;

  const diffCell = document.getElementById(`ci-value-diff-${rowIdx}`);
  const statusCell = document.getElementById(`ci-value-status-${rowIdx}`);
  if (diffCell) diffCell.innerHTML = ciValueDiffHtml(r);
  if (statusCell) { const { status, label } = ciValueRowStatus(r); statusCell.innerHTML = ciValueStatusBadge(status, label); }
  ciUpdateValueSummaryOnly();
}

function ciFormatValueInput(rowIdx) {
  const input = document.getElementById(`ci-value-ci-${rowIdx}`);
  const r = currentCiCompareRows && currentCiCompareRows[rowIdx];
  if (!input || !r) return;
  input.value = r.valueCI != null ? r.valueCI.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) : '';
}

// Lightweight summary-strip refresh (value boxes only) while typing, without
// rebuilding the whole comparison table.
function ciUpdateValueSummaryOnly() {
  if (!currentCiCompareRows) return;
  const po = MOCK_PO_DATA.find(p => p.poNumber === currentCiPoNumber);
  _renderSummaryStripOnly(currentCiCompareRows, po);
}

// ── Step 3: Build comparison ───────────────────────────
function renderCiComparison() {
  const card = document.getElementById('ci-compare-card');
  if (!card) return;
  if (!currentCiParsed || !currentCiPoNumber) { card.style.display = 'none'; return; }

  const po = MOCK_PO_DATA.find(p => p.poNumber === currentCiPoNumber);
  if (!po) { card.style.display = 'none'; return; }

  const { rows, ciAgg } = buildFuzzyMatches(po.items || [], currentCiParsed.items || []);
  currentCiCompareRows = rows;
  // Store ciAgg for re-render after manual override
  currentCiCompareRows._ciAgg = ciAgg;

  card.style.display = 'block';
  _renderCompareRows(rows, po, ciAgg);
}

/** Render summary strip + tbody. Called on first build and on any override. */
function _renderCompareRows(rows, po, ciAgg) {
  if (!po) po = MOCK_PO_DATA.find(p => p.poNumber === currentCiPoNumber);
  _renderSummaryStripOnly(rows, po);
  _renderCompareTbody(rows, po, ciAgg);
}

/** Summary strip only (qty + value) — reusable for live recalculation while typing. */
function _renderSummaryStripOnly(rows, po) {
  if (!po) po = MOCK_PO_DATA.find(p => p.poNumber === currentCiPoNumber);

  // ── Summary strip ──────────────────────────────────────
  const totalQtyPO  = rows.filter(r => !r.extraFromCi).reduce((s, r) => s + r.qPO, 0);
  const totalQtyCI  = rows.filter(r => !r.extraFromCi).reduce((s, r) => s + r.ciQty, 0);
  const totalDiff   = totalQtyCI - totalQtyPO;
  const matchCount  = rows.filter(r => !r.extraFromCi && r.matched && r.diff === 0).length;
  const kurangCount = rows.filter(r => !r.extraFromCi && r.matched && r.diff < 0).length;
  const lebihCount  = rows.filter(r => !r.extraFromCi && r.matched && r.diff > 0).length;
  const missCount   = rows.filter(r => !r.extraFromCi && !r.matched).length;
  const lowConfCount= rows.filter(r => !r.extraFromCi && r.matched && r.via === 'Nama Fuzzy' && r.score < 60).length;

  // ── Value totals (Value Reconciliation, merged in) ────
  const totalValuePO = rows.filter(r => !r.extraFromCi).reduce((s, r) => s + (r.valuePO || 0), 0);
  const filledValueRows = rows.filter(r => !r.extraFromCi && r.valueCI != null);
  const totalValueCI = rows.reduce((s, r) => s + (r.valueCI || 0), 0);
  const totalValueDiff = totalValueCI - totalValuePO;
  const valueFilledCount = filledValueRows.length;
  const valueMatchCount  = filledValueRows.filter(r => ciValueRowStatus(r).status === 'match').length;
  const valueKurangCount = filledValueRows.filter(r => ciValueRowStatus(r).status === 'kurang').length;
  const valueLebihCount  = filledValueRows.filter(r => ciValueRowStatus(r).status === 'lebih').length;
  const curCode = (po && po.currency) || 'USD';

  const strip = document.getElementById('ci-summary-strip');
  if (strip) {
    const diffColor = totalDiff === 0 ? 'var(--c-green)' : totalDiff > 0 ? 'var(--c-orange)' : 'var(--c-red)';
    const vDiffColor = valueFilledCount === 0 ? 'var(--c-gray)' : Math.abs(totalValueDiff) < 0.005 ? 'var(--c-green)' : totalValueDiff > 0 ? 'var(--c-orange)' : 'var(--c-red)';
    strip.innerHTML = `
      <div class="ci-sum-box ci-sum-po"><div class="ci-sum-val">${totalQtyPO.toLocaleString()}</div><div class="ci-sum-label">Total Qty PO</div></div>
      <div class="ci-sum-box ci-sum-ci"><div class="ci-sum-val">${totalQtyCI.toLocaleString()}</div><div class="ci-sum-label">Total Qty CI</div></div>
      <div class="ci-sum-box" style="border-color:${diffColor};background:${totalDiff===0?'var(--c-green-bg)':totalDiff>0?'var(--c-orange-bg)':'var(--c-red-bg)'}">
        <div class="ci-sum-val" style="color:${diffColor}">${totalDiff>=0?'+':''}${totalDiff.toLocaleString()}</div>
        <div class="ci-sum-label">Selisih Qty</div>
      </div>
      <div class="ci-sum-box ci-sum-match"><div class="ci-sum-val" style="color:var(--c-green)">${matchCount}</div><div class="ci-sum-label">Match</div></div>
      <div class="ci-sum-box ci-sum-kurang"><div class="ci-sum-val" style="color:var(--c-red)">${kurangCount}</div><div class="ci-sum-label">Kurang</div></div>
      <div class="ci-sum-box ci-sum-lebih"><div class="ci-sum-val" style="color:var(--c-orange)">${lebihCount}</div><div class="ci-sum-label">Lebih</div></div>
      ${missCount ? `<div class="ci-sum-box" style="border-color:var(--c-gray)"><div class="ci-sum-val" style="color:var(--c-gray)">${missCount}</div><div class="ci-sum-label">Not in CI</div></div>` : ''}
      ${lowConfCount ? `<div class="ci-sum-box" style="border-color:var(--c-orange-border);background:var(--c-orange-bg)"><div class="ci-sum-val" style="color:var(--c-orange)">${lowConfCount}</div><div class="ci-sum-label">Conf. Rendah ⚠</div></div>` : ''}
      <div class="ci-sum-box" style="border-color:var(--c-blue-border);background:var(--c-blue-bg)"><div class="ci-sum-val" style="color:var(--c-blue-dark)">${curCode} ${totalValuePO.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</div><div class="ci-sum-label">Total Value PO</div></div>
      <div class="ci-sum-box" style="border-color:var(--c-blue-border);background:var(--c-blue-bg)"><div class="ci-sum-val" style="color:var(--c-blue-dark)">${curCode} ${totalValueCI.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</div><div class="ci-sum-label">Total Value CI${valueFilledCount ? '' : ' (not filled in)'}</div></div>
      <div class="ci-sum-box" style="border-color:${vDiffColor};background:${valueFilledCount===0?'var(--c-surface-2,#f3f4f6)':Math.abs(totalValueDiff)<0.005?'var(--c-green-bg)':totalValueDiff>0?'var(--c-orange-bg)':'var(--c-red-bg)'}">
        <div class="ci-sum-val" style="color:${vDiffColor}">${valueFilledCount ? (totalValueDiff>=0?'+':'') + totalValueDiff.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) : '—'}</div>
        <div class="ci-sum-label">Selisih Value</div>
      </div>
      <div class="ci-sum-box ci-sum-match"><div class="ci-sum-val" style="color:var(--c-green)">${valueMatchCount}</div><div class="ci-sum-label">Value Match</div></div>
      <div class="ci-sum-box ci-sum-kurang"><div class="ci-sum-val" style="color:var(--c-red)">${valueKurangCount}</div><div class="ci-sum-label">Value Kurang</div></div>
      <div class="ci-sum-box ci-sum-lebih"><div class="ci-sum-val" style="color:var(--c-orange)">${valueLebihCount}</div><div class="ci-sum-label">Value Lebih</div></div>
    `;
  }
}

/** Compare table body (per-SKU rows). Split out from the summary strip so
 * the strip can be refreshed on its own while the user is typing Value CI. */
function _renderCompareTbody(rows, po, ciAgg) {
  // ── Compare table body ──────────────────────────────────
  const tbody = document.getElementById('ci-compare-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  rows.forEach((r, rowIdx) => {
    const diffSign  = r.diff >= 0 ? `+${r.diff.toLocaleString()}` : r.diff.toLocaleString();
    const diffCls   = r.diff === 0 ? 'sel-zero' : r.diff > 0 ? 'sel-pos' : 'sel-neg';
    const rowClass  = r.extraFromCi
      ? 'ci-row-extra'
      : !r.matched ? 'ci-row-missing'
      : r.diff === 0 ? ''
      : r.diff < 0 ? 'ci-row-kurang' : 'ci-row-lebih';

    const statusHtml = r.extraFromCi
      ? `<span class="badge badge-orange">Extra di CI</span>`
      : !r.matched
      ? `<span class="badge badge-gray">Not in CI</span>`
      : r.diff === 0 ? badge('match') : r.diff < 0 ? badge('kurang') : badge('lebih');

    // Confidence pill
    const conf = r.via ? confLabel(r.score, r.via) : null;
    const confHtml = conf
      ? `<span class="ci-conf-pill ${conf.cls}">${conf.text}</span>`
      : '<span style="color:var(--c-text-hint);font-size:11px">—</span>';

    // Via badge
    const viaIcons = {
      'SKU Exact':   '<i class="ti ti-fingerprint"></i>',
      'SKU Partial': '<i class="ti ti-adjustments-alt"></i>',
      'Nama + Qty':  '<i class="ti ti-arrows-join"></i>',
      'Nama':        '<i class="ti ti-wand"></i>',
      'Manual':      '<i class="ti ti-hand-finger"></i>',
    };
    const viaHtml = r.via
      ? `<span class="ci-via-badge">${viaIcons[r.via] || ''} ${r.via}</span>`
      : '—';

    // Detected name in CI
    const ciNameHtml = r.extraFromCi
      ? `<span style="color:var(--c-orange);font-weight:600">${r.matchedName}</span>`
      : r.matched
      ? `<span class="ci-detected-name">${r.matchedName || '—'}</span>${r.matchedSku && r.matchedSku !== r.sku ? `<br><span style="font-family:monospace;font-size:11px;color:var(--c-text-hint)">${r.matchedSku}</span>` : ''}`
      : `<span style="color:var(--c-text-hint);font-style:italic">not detected</span>`;

    // Override dropdown (only for non-extra rows)
    const overrideHtml = r.extraFromCi ? '' : `
      <button class="ci-override-btn" title="Ubah mapping manual"
        onclick="openCiOverride(${rowIdx})" style="padding:2px 6px;font-size:16px;background:none;border:none;cursor:pointer;color:var(--c-text-hint)">⇄</button>
    `;

    // Low-confidence warning
    const lowConfWarn = r.matched && r.via === 'Nama Fuzzy' && r.score < 60
      ? `<span title="Confidence rendah — harap periksa manual" style="color:var(--c-orange);margin-left:4px;">⚠</span>`
      : '';

    // Value cells (merged Value Reconciliation) ─────────
    const fromCiTag = r.fromCiFile
      ? `<span title="Auto-filled from the Amount/Value column in the CI file — editable" style="color:var(--c-blue-dark);font-size:11px;margin-left:3px;white-space:nowrap"><i class="ti ti-wand"></i></span>`
      : '';
    const valuePOHtml = r.extraFromCi
      ? '<span style="color:var(--c-text-hint)">—</span>'
      : `${r.valuePO.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    const valueCIInputHtml = r.extraFromCi
      ? `${(r.valueCI || 0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`
      : `<input type="text" inputmode="decimal" id="ci-value-ci-${rowIdx}"
            value="${r.valueCI != null ? r.valueCI.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) : ''}"
            placeholder="0.00" class="vr-ci-input" style="width:110px;text-align:right"
            oninput="ciRecalcRowValue(${rowIdx})" onblur="ciFormatValueInput(${rowIdx})" />${fromCiTag}`;
    const { status: vStatus, label: vLabel } = ciValueRowStatus(r);

    const tr = document.createElement('tr');
    tr.className = rowClass;
    tr.dataset.rowIdx = rowIdx;
    tr.innerHTML = `
      <td style="font-family:monospace;font-size:12px;">${r.sku || (r.extraFromCi ? r.matchedSku || '—' : '—')}</td>
      <td>${r.extraFromCi ? '<em style="color:var(--c-text-hint)">— not in PO —</em>' : `${r.name}${r.size ? ` <span style="font-size:11px;color:var(--c-text-hint)">(${r.size})</span>` : ''}${lowConfWarn}`}</td>
      <td>${ciNameHtml}</td>
      <td>${confHtml}</td>
      <td>${viaHtml}</td>
      <td class="num"><strong>${r.qPO.toLocaleString()}</strong></td>
      <td class="num">${r.matched ? r.ciQty.toLocaleString() : '<span style="color:var(--c-text-hint)">—</span>'}</td>
      <td class="num"><span class="${diffCls}">${r.matched || r.extraFromCi ? diffSign : '—'}</span></td>
      <td>${statusHtml}</td>
      <td class="num">${valuePOHtml}</td>
      <td class="num">${valueCIInputHtml}</td>
      <td class="num" id="ci-value-diff-${rowIdx}">${ciValueDiffHtml(r)}</td>
      <td id="ci-value-status-${rowIdx}">${ciValueStatusBadge(vStatus, vLabel)}</td>
      <td>${overrideHtml}</td>
    `;
    tbody.appendChild(tr);
  });

  renderCiRawTable(currentCiParsed);
  document.getElementById('ci-compare-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Manual override (inline dropdown) ─────────────────
function openCiOverride(rowIdx) {
  const r    = currentCiCompareRows[rowIdx];
  const ciAgg = currentCiCompareRows._ciAgg || [];
  if (!r || r.extraFromCi) return;

  // Close any existing override panel
  document.querySelectorAll('.ci-override-panel').forEach(el => el.remove());

  const tr = document.querySelector(`tr[data-row-idx="${rowIdx}"]`);
  if (!tr) return;

  // Insert a new row right after tr
  const overrideTr = document.createElement('tr');
  overrideTr.className = 'ci-override-panel';
  overrideTr.innerHTML = `
    <td colspan="14" style="padding:10px 16px; background:var(--c-blue-bg); border-top:2px solid var(--c-blue);">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <span style="font-size:13px;font-weight:600;color:var(--c-blue-dark);">
          <i class="ti ti-wand"></i> Override mapping for: <strong>${r.name}</strong>
        </span>
        <select id="ci-override-select-${rowIdx}" style="flex:1;min-width:240px;font-size:13px;padding:5px 8px;border:1.5px solid var(--c-blue-border);border-radius:var(--radius-sm);">
          <option value="">— Not in CI (kosongkan) —</option>
          ${ciAgg.map((ci, i) => `<option value="${i}" ${r.bestCiIdx === i ? 'selected' : ''}>${ci.name || ci.sku || '?'} ${ci.sku ? '['+ci.sku+']' : ''} (Qty: ${ci.qty.toLocaleString()})</option>`).join('')}
        </select>
        <button class="btn-primary btn-sm" onclick="applyCiOverride(${rowIdx})">
          <i class="ti ti-check"></i> Terapkan
        </button>
        <button class="btn-ghost btn-sm" onclick="this.closest('tr').remove()">
          <i class="ti ti-x"></i>
        </button>
      </div>
    </td>
  `;
  tr.insertAdjacentElement('afterend', overrideTr);
}

function applyCiOverride(rowIdx) {
  const r      = currentCiCompareRows[rowIdx];
  const ciAgg  = currentCiCompareRows._ciAgg || [];
  const sel    = document.getElementById(`ci-override-select-${rowIdx}`);
  if (!sel) return;

  const ciIdx = sel.value === '' ? -1 : parseInt(sel.value, 10);
  if (ciIdx >= 0 && ciAgg[ciIdx]) {
    const ci = ciAgg[ciIdx];
    r.ciQty       = ci.qty;
    r.ciAmount    = ci.amount || 0;
    r.matchedName = ci.name || ci.sku || '—';
    r.matchedSku  = ci.sku || '';
    r.score       = Math.round(tokenSim(r.name, ci.name || ci.sku || '') * 100);
    r.via         = 'Manual';
    r.matched     = true;
    r.bestCiIdx   = ciIdx;
    r.fromCiFile  = !!ci.amount;
    r.valueCI     = ci.amount || null;
  } else {
    r.ciQty = 0; r.ciAmount = 0; r.matchedName = ''; r.matchedSku = '';
    r.score = 0; r.via = ''; r.matched = false; r.bestCiIdx = -1;
    r.fromCiFile = false; r.valueCI = null;
  }
  r.diff = r.ciQty - r.qPO;
  r.valueDiff = r.valueCI != null ? (r.valueCI - r.valuePO) : null;

  // Close override panel & re-render
  document.querySelectorAll('.ci-override-panel').forEach(el => el.remove());
  _renderCompareRows(currentCiCompareRows, null, ciAgg);
  showToast('Mapping diperbarui.', 'success');
}

function renderCiRawTable(parsed) {
  if (!parsed || !parsed.items.length) return;
  const headers = parsed.headers.filter(h => h && parsed.items.some(item => item[h] != null && item[h] !== ''));
  const columns = headers.length ? headers : Object.keys(parsed.items[0] || {});

  const thead = document.getElementById('ci-raw-thead');
  const tbody = document.getElementById('ci-raw-tbody');
  if (!thead || !tbody) return;

  thead.innerHTML = `<tr>${columns.map(c => `<th>${c.replace(/_/g,' ')}</th>`).join('')}</tr>`;
  tbody.innerHTML = parsed.items.map(item =>
    `<tr>${columns.map(col => `<td>${String(item[col] != null ? item[col] : '').replace(/</g,'&lt;')}</td>`).join('')}</tr>`
  ).join('');
}

// ── Save verification to localStorage ─────────────────
function saveCiVerification() {
  if (!currentCiCompareRows || !currentCiPoNumber) {
    showToast('No data to save.', 'error'); return;
  }
  const po = MOCK_PO_DATA.find(p => p.poNumber === currentCiPoNumber);

  // ── Quantity reconciliation ──────────────────────────
  const totalQtyPO = currentCiCompareRows.filter(r => !r.extraFromCi).reduce((s, r) => s + r.qPO, 0);
  const totalQtyCI = currentCiCompareRows.filter(r => !r.extraFromCi).reduce((s, r) => s + r.ciQty, 0);
  const diff = totalQtyCI - totalQtyPO;
  const hasKurang = currentCiCompareRows.some(r => !r.extraFromCi && r.diff < 0);
  const hasLebih  = currentCiCompareRows.some(r => !r.extraFromCi && r.diff > 0);
  const result = diff === 0 ? 'match' : hasKurang && hasLebih ? 'mixed' : hasKurang ? 'kurang' : 'lebih';

  // ── Value reconciliation (merged in — no separate step needed) ──
  const totalValuePO = currentCiCompareRows.filter(r => !r.extraFromCi).reduce((s, r) => s + (r.valuePO || 0), 0);
  const totalValueCI = currentCiCompareRows.reduce((s, r) => s + (r.valueCI || 0), 0);
  const valueDiff = totalValueCI - totalValuePO;
  const valueStatuses = currentCiCompareRows.filter(r => !r.extraFromCi).map(r => ciValueRowStatus(r).status).filter(s => s !== 'pending');
  const hasValueUnfilled = currentCiCompareRows.some(r => !r.extraFromCi && r.valueCI == null);
  const hasValueKurang = valueStatuses.includes('kurang');
  const hasValueLebih  = valueStatuses.includes('lebih');
  const valueResult = hasValueUnfilled && !valueStatuses.length ? 'pending'
    : hasValueKurang && hasValueLebih ? 'mixed' : hasValueKurang ? 'kurang' : hasValueLebih ? 'lebih' : 'match';

  const record = {
    id:          Date.now(),
    verifiedAt:  new Date().toISOString(),
    poNumber:    currentCiPoNumber,
    brand:       po ? (po.supplierLabel || po.supplier) : '—',
    currency:    po ? (po.currency || 'USD') : 'USD',
    fileName:    currentCiFileName || '—',
    totalQtyPO,
    totalQtyCI,
    diff,
    result,
    totalValuePO,
    totalValueCI,
    valueDiff,
    valueResult,
    rows:        currentCiCompareRows,
  };

  const history = loadCiHistory();
  history.unshift(record);
  saveCiHistoryAll(history);
  logActivity(currentCiPoNumber, 'Verifikasi CI (Qty & Value)',
    `Qty PO ${totalQtyPO.toLocaleString()} vs CI ${totalQtyCI.toLocaleString()} (${result}); ` +
    `Value PO ${fmt(totalValuePO)} vs CI ${fmt(totalValueCI)} (${valueResult})`);
  showToast('✓ Verifikasi CI (Qty & Value) berhasil disimpan!', 'success');

  if (hasValueUnfilled) {
    showToast('Note: some items still have no Value CI filled in.', 'warning');
  }

  // Offer to continue straight to Payment Proof Matching for the same PO —
  // Value Reconciliation is now part of this step, so there's no separate hop.
  setTimeout(() => {
    if (confirm('Continue to Payment Proof Detection (match against payment proof) for this PO?')) {
      switchTab('valrecon');
      goToPaymentMatchFromVr(currentCiPoNumber, record.currency, record.brand);
    }
  }, 400);
}

// ── Old compat stubs (used by renderCiPreview in old code) ─
function updateCiPoSummary() { /* replaced */ }
function renderCiItemComparison() { return ''; }
function getCiTotals(parsed) {
  const totals = { qty: 0, foc_qty: 0, rows: 0 };
  if (!parsed || !Array.isArray(parsed.items)) return totals;
  parsed.items.forEach(item => {
    totals.rows += 1;
    ['qty','foc_qty'].forEach(key => {
      if (item[key] != null && !Number.isNaN(Number(item[key]))) totals[key] += Number(item[key]);
    });
  });
  return totals;
}
function renderCiComparison_old() { /* legacy stub, replaced */ }
function renderCiPreview(parsed, fileName) {
  // Legacy wrapper — redirect to new flow
  currentCiParsed = parsed;
  currentCiFileName = fileName;
  renderCiComparison();
}

// ── CI History page ────────────────────────────────────
function renderCiHistory() {
  const tbody = document.getElementById('ci-history-tbody');
  const countEl = document.getElementById('ci-history-count');
  if (!tbody) return;

  const q = (document.getElementById('ci-history-search')?.value || '').toLowerCase();
  let history = loadCiHistory().filter(r =>
    !q || r.poNumber?.toLowerCase().includes(q) || r.brand?.toLowerCase().includes(q) || r.fileName?.toLowerCase().includes(q)
  );

  if (countEl) countEl.textContent = history.length + ' record';
  tbody.innerHTML = '';

  if (!history.length) {
    tbody.innerHTML = `<tr><td colspan="13" style="text-align:center;padding:40px;color:var(--c-text-hint)">No CI verification history yet.</td></tr>`;
    return;
  }

  const resultBadgeHtml = (result) => result === 'match' ? badge('match') : result === 'kurang' ? badge('kurang') : result === 'lebih' ? badge('lebih') : result === 'pending' ? '<span class="badge badge-gray">Not filled in</span>' : `<span class="badge badge-orange">Mixed</span>`;

  history.forEach(rec => {
    const date = new Date(rec.verifiedAt).toLocaleString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    const diff = rec.diff;
    const diffSign = diff >= 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString();
    const diffCls = diff === 0 ? 'sel-zero' : diff > 0 ? 'sel-pos' : 'sel-neg';
    const resultBadge = resultBadgeHtml(rec.result);

    const hasValue = rec.totalValuePO != null;
    const vDiff = rec.valueDiff || 0;
    const vDiffCls = Math.abs(vDiff) < 0.005 ? 'sel-zero' : vDiff > 0 ? 'sel-pos' : 'sel-neg';
    const vDiffSign = vDiff >= 0 ? `+${vDiff.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}` : vDiff.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
    const valuePOCell = hasValue ? rec.totalValuePO.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) : '<span style="color:var(--c-text-hint)">—</span>';
    const valueCICell = hasValue ? rec.totalValueCI.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) : '<span style="color:var(--c-text-hint)">—</span>';
    const valueDiffCell = hasValue ? `<span class="${vDiffCls}">${vDiffSign}</span>` : '<span style="color:var(--c-text-hint)">—</span>';
    const valueResultBadge = hasValue ? resultBadgeHtml(rec.valueResult) : '<span style="color:var(--c-text-hint)">—</span>';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-size:12px;color:var(--c-text-sub)">${date}</td>
      <td><strong style="color:var(--c-blue-dark)">${rec.poNumber}</strong></td>
      <td>${rec.brand}</td>
      <td style="font-size:12px;color:var(--c-text-hint);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${rec.fileName}">${rec.fileName}</td>
      <td class="num">${rec.totalQtyPO.toLocaleString()}</td>
      <td class="num">${rec.totalQtyCI.toLocaleString()}</td>
      <td class="num"><span class="${diffCls}">${diffSign}</span></td>
      <td>${resultBadge}</td>
      <td class="num">${valuePOCell}</td>
      <td class="num">${valueCICell}</td>
      <td class="num">${valueDiffCell}</td>
      <td>${valueResultBadge}</td>
      <td style="display:flex;gap:6px;">
        <button class="btn-detail" onclick="showCiHistoryDetail(${rec.id})"><i class="ti ti-eye"></i> Detail</button>
        <button class="btn-detail btn-detail-danger" onclick="deleteCiHistory(${rec.id})"><i class="ti ti-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function showCiHistoryDetail(id) {
  const rec = loadCiHistory().find(r => r.id === id);
  if (!rec) return;
  const detail = document.getElementById('ci-history-detail');
  const titleEl = document.getElementById('ci-history-detail-title');
  const tbody = document.getElementById('ci-history-detail-tbody');
  if (!detail || !tbody) return;

  if (titleEl) titleEl.textContent = `${rec.poNumber} — ${new Date(rec.verifiedAt).toLocaleDateString('id-ID')}`;
  tbody.innerHTML = '';
  (rec.rows || []).forEach(r => {
    const diffSign = r.diff >= 0 ? `+${r.diff.toLocaleString()}` : r.diff.toLocaleString();
    const diffCls  = r.diff === 0 ? 'sel-zero' : r.diff > 0 ? 'sel-pos' : 'sel-neg';
    const statusHtml = r.extraFromCi
      ? `<span class="badge badge-orange">Extra di CI</span>`
      : !r.matched
      ? `<span class="badge badge-gray">Not in CI</span>`
      : r.diff === 0 ? badge('match') : r.diff < 0 ? badge('kurang') : badge('lebih');

    const { status: vStatus, label: vLabel } = ciValueRowStatus(r);
    const valuePOCell = !r.extraFromCi && r.valuePO != null ? r.valuePO.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) : '<span style="color:var(--c-text-hint)">—</span>';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family:monospace;font-size:12px;">${r.sku || '—'}</td>
      <td>${r.name || '—'}</td>
      <td>${r.type ? itemTypeBadge(r.type) : '—'}</td>
      <td class="num">${r.qPO.toLocaleString()}</td>
      <td class="num">${r.ciQty > 0 ? r.ciQty.toLocaleString() : '—'}</td>
      <td class="num"><span class="${diffCls}">${diffSign}</span></td>
      <td>${statusHtml}</td>
      <td class="num">${valuePOCell}</td>
      <td class="num">${r.valueCI != null ? r.valueCI.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) : '<span style="color:var(--c-text-hint)">—</span>'}</td>
      <td class="num">${ciValueDiffHtml(r)}</td>
      <td>${ciValueStatusBadge(vStatus, vLabel)}</td>
    `;
    tbody.appendChild(tr);
  });

  detail.style.display = 'block';
  detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function deleteCiHistory(id) {
  if (!confirm('Delete this verification record?')) return;
  const history = loadCiHistory().filter(r => r.id !== id);
  saveCiHistoryAll(history);
  renderCiHistory();
  document.getElementById('ci-history-detail').style.display = 'none';
  showToast('Record dihapus.', 'success');
}

function clearAllCiHistory() {
  if (!confirm('Delete ALL CI verification history? This action cannot be undone.')) return;
  saveCiHistoryAll([]);
  renderCiHistory();
  showToast('Semua riwayat dihapus.', 'success');
}

function parseSpreadsheetFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        resolve(parseCiRows(rows));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    if (/\.csv$/i.test(file.name)) reader.readAsText(file, 'UTF-8');
    else reader.readAsArrayBuffer(file);
  });
}

function parseCiRows(rows) {
  if (!Array.isArray(rows) || !rows.length) return { headers: [], items: [] };

  const headerRowIndex = rows.findIndex(row => Array.isArray(row) && row.some(cell => typeof cell === 'string' && /\b(Name|Product Name|Description|Nama BPOM|UPC|Barcode|EAN|JAN Code|SKU|Product Code|Reffcode|Item Code|HS Code|Tariff|HTS|Packaging|Package|Pack|Unit|Quantity|Qty|Q'ty|PCS|EA|FOC Quantity|FOC Q'ty|Unit Price|Price\/Unit|Amount|Total|Value)\b/i.test(cell)));
  const headerRow = headerRowIndex >= 0 ? rows[headerRowIndex] : rows[0];
  const columns = (headerRow || []).map(cell => normalizeHeader(String(cell || '')));

  const items = [];
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row) || row.every(cell => cell === '' || cell === null || cell === undefined)) continue;
    const item = {};
    row.forEach((cell, colIndex) => {
      const key = columns[colIndex] || '';
      const value = cell == null ? '' : String(cell).trim();
      if (!key) return;
      if (!item[key] && value !== '') item[key] = parseCiValue(key, value);
    });
    if (Object.keys(item).length) items.push(item);
  }

  return { headers: columns, items };
}

function normalizeHeader(text) {
  // Strip whitespace first — handles trailing spaces, multi-spaces, typos
  const s = String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!s || s === 'nan') return '';

  // FOC must come BEFORE generic qty check
  if (/foc/.test(s))                                                             return 'foc_qty';
  // Name / description — tolerates: Descriptions, Descripstions, Product, production descriptions
  if (/\bname\b|product.?name|\bproduct\b|production.?desc|descri?p[st]ti?ons?|description|nama/.test(s)) return 'name';
  // SKU / barcode
  if (/product.?code|item.?code|\bsku\b|reffcode|\bbarcode\b|\bupc\b|\bean\b|\bjan\b/.test(s))     return 'sku';
  // HS code
  if (/hs.?code|tariff|hts/.test(s))                                             return 'hs_code';
  // Unit price BEFORE packaging (both contain "unit")
  if (/unit.?price|price.?unit|\bprice\b/.test(s))                             return 'unit_price';
  // Qty — typo-tolerant + order q'ty + q'ty + content
  if (/q[uo]?a?n[tq]i?ti?[yt]|order.?q'?t[yi]|\bq'?ty\b|\bpcs\b|\bea\b|jumlah|kuantitas|\bcontent\b/.test(s)) return 'qty';
  // Packaging / size
  if (/pack|packag|\bunit\b/.test(s))                                           return 'packaging';
  // Amount / total
  if (/amount|total|value/.test(s))                                               return 'total';
  // Currency
  if (/currency|\bcur\b/.test(s))                                               return 'currency';
  // PO reference
  if (/po.?num|po.?no|\bref\b/.test(s))                                        return 'reference';
  return s.replace(/\s+/g, '_');
}

function parseCiValue(key, value) {
  if (['qty','foc_qty','unit_price','total'].includes(key)) {
    const parsed = parseNumberString(value);
    return parsed == null ? value : parsed;
  }
  return value;
}

function parseNumberString(value) {
  if (value == null || value === '') return null;
  const cleaned = String(value)
    .replace(/\s/g, '')
    .replace(/¥|\$|€|£|Rp|IDR|JPY|USD|AUD|KRW/gi, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9\.\-]/g, '');

  if (cleaned === '') return null;
  const countDots = (cleaned.match(/\./g) || []).length;
  if (countDots > 1) {
    const noDots = cleaned.replace(/\./g, '');
    return Number(noDots);
  }
  const number = Number(cleaned);
  if (!Number.isNaN(number)) return number;
  return null;
}

// ═══════════════════════════════════════════════════════
// PIB PDF PARSER (BC 2.0 form) — extracts item name + qty
// ═══════════════════════════════════════════════════════
// The PIB PDF text layer lists all "Uraian : <name>" item
// descriptions in item order first, then — later in the same
// stream — all the qty/value blocks in the same item order
// (a quirk of how this customs form's PDF is generated). We
// pull both lists by order of appearance and zip them together
// rather than trying to parse a visual row, which is unreliable
// for this multi-column layout.
function parsePibPdfText(text) {
  const flat = String(text || '').replace(/\s+/g, ' ');

  // Item names, in order
  const names = [...flat.matchAll(/Uraian\s*:\s*(.+?)\s*Merk\s*:/g)].map(m => m[1].trim());

  // Qty per item — the number immediately before a unit token like "PIECE (PCE)"
  const qtys = [...flat.matchAll(/([\d.,]+)\s*PIECE\s*\(PCE\)/g)].map(m => parseFloat(m[1].replace(/,/g, '')));

  // Customs value (Nilai Pabean) per item — appears right after the qty/unit pair
  const values = [...flat.matchAll(/PIECE\s*\(PCE\)\s*-\s*([\d.,]+)/g)].map(m => parseFloat(m[1].replace(/,/g, '')));

  // HS code per item (best-effort — may not align 1:1 on every PDF)
  const hsCodes = [...flat.matchAll(/Pos Tarif\s*:\s*(\d+)\s*Kode Brg/g)].map(m => m[1]);

  const count = Math.max(names.length, qtys.length);
  const items = [];
  for (let i = 0; i < count; i++) {
    items.push({
      name: names[i] || `(item ${i + 1})`,
      qty: qtys[i] != null ? qtys[i] : 0,
      valuePabean: values[i] != null ? values[i] : null,
      hsCode: hsCodes[i] || '',
    });
  }

  // Header info (best-effort — these fields sit close to their labels in the
  // text stream and tested reliably; Invoice No/Date are scattered across
  // unrelated columns in this form and are deliberately left for manual entry)
  const regNo   = flat.match(/Nomor dan Tanggal Pendaftaran\s*(\d+)\s*([\d]{2}-[\d]{2}-[\d]{4})/);
  const officeCode = flat.match(/\bBC\s*2\.0\s*(\d{6})\b/);
  const submission  = flat.match(/Nomor Pengajuan\s*:?\s*(\d{10,})/);
  const office = flat.match(/Kantor Pabean\s*:?\s*([A-Z0-9 .]+?)\s*Nomor Pengajuan/);

  return {
    items,
    pibNumber:   regNo ? `${officeCode ? officeCode[1] + '/' : ''}${regNo[1]}` : '',
    pibDate:     regNo ? regNo[2] : '',
    submissionNo: submission ? submission[1] : '',
    customsOffice: office ? office[1].trim() : '',
  };
}

// ── Compare PIB — state ─────────────────────────────────
let currentPibPoNumber = null;
let currentPibParsed   = null;   // { items, pibNumber, pibDate, ... } from parsePibPdfText
let currentPibCompareRows = null;
let currentPibFileName = '';

function populatePibComparePoSelect() {
  const select = document.getElementById('pib-cmp-po-select');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">— Select PO Number —</option>';
  getAllPoData().forEach(po => {
    const option = document.createElement('option');
    option.value = po.poNumber;
    option.textContent = `${po.poNumber} — ${po.supplierLabel || po.supplier}`;
    select.appendChild(option);
  });
  if (current) select.value = current;
}

function filterPibComparePoList() {
  const query = document.getElementById('pib-cmp-po-search')?.value.trim().toLowerCase() || '';
  const select = document.getElementById('pib-cmp-po-select');
  if (!select) return;
  select.innerHTML = '<option value="">— Select PO Number —</option>';
  getAllPoData().filter(po => {
    const target = `${po.poNumber} ${po.supplierLabel || po.supplier}`.toLowerCase();
    return !query || target.includes(query);
  }).forEach(po => {
    const option = document.createElement('option');
    option.value = po.poNumber;
    option.textContent = `${po.poNumber} — ${po.supplierLabel || po.supplier}`;
    select.appendChild(option);
  });
  if (currentPibPoNumber) select.value = currentPibPoNumber;
}

function selectPibComparePo(poNumber) {
  currentPibPoNumber = poNumber || null;
  renderPibComparePoDetail();
  const step2 = document.getElementById('pib-cmp-step2-card');
  if (step2) {
    step2.style.opacity = poNumber ? '1' : '.5';
    step2.style.pointerEvents = poNumber ? '' : 'none';
  }
  if (currentPibParsed) renderPibComparison();
}

// Entry point used by the "Compare PIB" button on History PO / PO Inquiry
function goToComparePib(poNumber) {
  switchTab('pib-compare');
  populatePibComparePoSelect();
  const select = document.getElementById('pib-cmp-po-select');
  if (select) select.value = poNumber;
  selectPibComparePo(poNumber);
}

function renderPibComparePoDetail() {
  const detail = document.getElementById('pib-cmp-po-detail');
  if (!detail) return;
  if (!currentPibPoNumber) { detail.style.display = 'none'; return; }
  const po = MOCK_PO_DATA.find(p => p.poNumber === currentPibPoNumber);
  if (!po) { detail.style.display = 'none'; return; }

  detail.style.display = 'block';
  const bar = document.getElementById('pib-cmp-po-info-bar');
  if (bar) {
    bar.innerHTML = `
      <div><span class="ci-info-label">Brand</span><span class="ci-info-val">${po.supplierLabel || po.supplier || '—'}</span></div>
      <div><span class="ci-info-label">PO Date</span><span class="ci-info-val">${fmtDate(po.poDate)}</span></div>
      <div><span class="ci-info-label">Currency</span><span class="ci-info-val">${po.currency || 'USD'}</span></div>
      <div><span class="ci-info-label">Existing PIB No.</span><span class="ci-info-val">${po.pibNumber || '—'}</span></div>
      <div><span class="ci-info-label">Status</span><span class="ci-info-val">${badge(po.status)}</span></div>
    `;
  }
  const tbody = document.getElementById('pib-cmp-po-items-tbody');
  if (tbody) {
    tbody.innerHTML = (po.items || []).map(it => `
      <tr>
        <td style="font-family:monospace;font-size:12px;">${it.sku || '—'}</td>
        <td>${cleanItemName(it.name || '') || '—'}${it.size ? ` <span style="font-size:11px;color:var(--c-text-hint)">(${it.size})</span>` : ''}</td>
        <td>${itemTypeBadge(it.type || detectItemType(it.sku||'', it.name||''))}</td>
        <td class="num">${(it.qtyPO || it.qtyPIB || 0).toLocaleString()}</td>
      </tr>`).join('');
    const cnt = document.getElementById('pib-cmp-po-item-count');
    if (cnt) cnt.textContent = `${(po.items || []).length} items`;
  }
}

function handlePibCompareDrop(event) {
  event.preventDefault();
  document.getElementById('pib-cmp-drop-zone').classList.remove('dragover');
  const file = event.dataTransfer.files[0];
  if (file) handlePibCompareFile(file);
}

async function handlePibCompareFile(file) {
  if (!file) return;
  if (!/\.pdf$/i.test(file.name)) { showToast('Please upload a PDF file (the PIB / BC 2.0 document).', 'error'); return; }
  currentPibFileName = file.name;

  const content   = document.getElementById('pib-cmp-drop-content');
  const loading   = document.getElementById('pib-cmp-loading');
  const resultBox = document.getElementById('pib-cmp-result-info');
  if (content) content.style.display = 'none';
  if (loading) loading.style.display = 'flex';
  if (resultBox) resultBox.style.display = 'none';

  try {
    const text = await extractTextFromPdf(file);
    const parsed = parsePibPdfText(text);
    if (!parsed.items.length) {
      showToast('No items could be detected in this PDF. Is it a PIB (BC 2.0) document?', 'error');
      resetPibCompareUpload();
      return;
    }
    currentPibParsed = parsed;
    if (loading) loading.style.display = 'none';
    if (resultBox) {
      resultBox.style.display = 'flex';
      document.getElementById('pib-cmp-result-text').textContent =
        `${file.name} — ${parsed.items.length} items detected${parsed.pibNumber ? ` · PIB No. ${parsed.pibNumber}` : ''}`;
    }
    renderPibComparison();
    showToast(`✓ Detected ${parsed.items.length} items from the PIB PDF.`, 'success');
  } catch (err) {
    console.error(err);
    showToast('Failed to read this PDF. Please check the file and try again.', 'error');
    resetPibCompareUpload();
  }
}

function resetPibCompareUpload() {
  currentPibParsed = null;
  currentPibCompareRows = null;
  currentPibFileName = '';
  const content   = document.getElementById('pib-cmp-drop-content');
  const loading   = document.getElementById('pib-cmp-loading');
  const resultBox = document.getElementById('pib-cmp-result-info');
  const input     = document.getElementById('pib-cmp-file-input');
  if (content) content.style.display = 'block';
  if (loading) loading.style.display = 'none';
  if (resultBox) resultBox.style.display = 'none';
  if (input) input.value = '';
  const card = document.getElementById('pib-cmp-compare-card');
  if (card) card.style.display = 'none';
}

// Simple name-only fuzzy matcher (the PIB PDF has no SKU codes, only
// free-text product descriptions) — same greedy assignment strategy as
// the CI verification matcher, minus the SKU-scoring tier.
function buildPibFuzzyMatches(poItems, pibItems) {
  const usedIdx = new Set();
  const poList = poItems.map(it => ({
    sku: (it.sku || '').trim(),
    name: cleanItemName(it.name || ''),
    qPO: Number(it.qtyPO || it.qtyPIB || 0),
    type: it.type || detectItemType(it.sku || '', it.name || ''),
    size: it.size || '',
    qWH: Number(it.qtyWarehouse || 0), // Qty WH — sourced from Warehouse data on this PO item
  }));

  function pairScore(poName, qPO, pibItem) {
    const sim = tokenSim(poName, pibItem.name);
    if (sim < 0.3) return -1;
    if (pibItem.qty === qPO) return 100 + Math.round(sim * 100);
    return Math.round(sim * 100);
  }

  const assigned = new Array(poList.length).fill(null);
  for (let round = 0; round < poList.length; round++) {
    let bestPo = -1, bestPib = -1, bestSc = -1;
    poList.forEach((po, pi) => {
      if (assigned[pi] !== null) return;
      pibItems.forEach((pibIt, ii) => {
        if (usedIdx.has(ii)) return;
        const sc = pairScore(po.name, po.qPO, pibIt);
        if (sc > bestSc) { bestSc = sc; bestPo = pi; bestPib = ii; }
      });
    });
    if (bestPo === -1 || bestSc < 30) break;
    assigned[bestPo] = bestPib;
    usedIdx.add(bestPib);
  }

  const rows = poList.map((po, pi) => {
    const idx = assigned[pi];
    if (idx === null || idx === undefined) {
      return { sku: po.sku, name: po.name, size: po.size, type: po.type, qPO: po.qPO, qWH: po.qWH,
        pibQty: 0, matchedName: '', score: 0, matched: false, diff: -po.qPO, valuePabean: null };
    }
    const pibIt = pibItems[idx];
    const sim = Math.round(tokenSim(po.name, pibIt.name) * 100);
    return {
      sku: po.sku, name: po.name, size: po.size, type: po.type, qPO: po.qPO, qWH: po.qWH,
      pibQty: pibIt.qty, matchedName: pibIt.name, score: Math.min(100, sim), matched: true,
      diff: pibIt.qty - po.qPO, valuePabean: pibIt.valuePabean, hsCode: pibIt.hsCode,
    };
  });

  // Extra PIB rows that weren't matched to any PO item
  pibItems.forEach((pibIt, idx) => {
    if (!usedIdx.has(idx)) {
      rows.push({ sku: '', name: '— not in PO —', size: '', type: '', qPO: 0, qWH: 0,
        pibQty: pibIt.qty, matchedName: pibIt.name, score: 0, matched: false,
        diff: pibIt.qty, valuePabean: pibIt.valuePabean, hsCode: pibIt.hsCode, extraFromPib: true });
    }
  });

  return rows;
}

function renderPibComparison() {
  const po = MOCK_PO_DATA.find(p => p.poNumber === currentPibPoNumber);
  if (!po || !currentPibParsed) return;

  const rows = buildPibFuzzyMatches(po.items || [], currentPibParsed.items);
  currentPibCompareRows = rows;

  const card = document.getElementById('pib-cmp-compare-card');
  if (card) card.style.display = 'block';

  // Header info detected from the PDF
  const headerBox = document.getElementById('pib-cmp-detected-header');
  if (headerBox) {
    headerBox.innerHTML = `
      <div><span class="ci-info-label">PIB Number (detected)</span><span class="ci-info-val">${currentPibParsed.pibNumber || '—'}</span></div>
      <div><span class="ci-info-label">PIB Date (detected)</span><span class="ci-info-val">${currentPibParsed.pibDate || '—'}</span></div>
      <div><span class="ci-info-label">Customs Office</span><span class="ci-info-val">${currentPibParsed.customsOffice || '—'}</span></div>
    `;
  }

  const totQtyPO  = rows.filter(r => !r.extraFromPib).reduce((s, r) => s + r.qPO, 0);
  const totQtyPIB = rows.reduce((s, r) => s + (r.pibQty || 0), 0);
  const totQtyWH  = rows.filter(r => !r.extraFromPib).reduce((s, r) => s + (r.qWH || 0), 0);
  const diff = totQtyPIB - totQtyPO;
  const matchCount  = rows.filter(r => !r.extraFromPib && r.matched && r.diff === 0).length;
  const kurangCount = rows.filter(r => !r.extraFromPib && r.matched && r.diff < 0).length;
  const lebihCount  = rows.filter(r => !r.extraFromPib && r.matched && r.diff > 0).length;
  const missCount   = rows.filter(r => !r.extraFromPib && !r.matched).length;

  const strip = document.getElementById('pib-cmp-summary-strip');
  if (strip) {
    const diffColor = diff === 0 ? 'var(--c-green)' : diff > 0 ? 'var(--c-orange)' : 'var(--c-red)';
    strip.innerHTML = `
      <div class="ci-sum-box ci-sum-po"><div class="ci-sum-val">${totQtyPO.toLocaleString()}</div><div class="ci-sum-label">Total Qty PO</div></div>
      <div class="ci-sum-box ci-sum-ci"><div class="ci-sum-val">${totQtyPIB.toLocaleString()}</div><div class="ci-sum-label">Total Qty PIB (detected)</div></div>
      <div class="ci-sum-box"><div class="ci-sum-val">${totQtyWH.toLocaleString()}</div><div class="ci-sum-label">Total Qty WH (Warehouse)</div></div>
      <div class="ci-sum-box" style="border-color:${diffColor};background:${diff===0?'var(--c-green-bg)':diff>0?'var(--c-orange-bg)':'var(--c-red-bg)'}">
        <div class="ci-sum-val" style="color:${diffColor}">${diff>=0?'+':''}${diff.toLocaleString()}</div>
        <div class="ci-sum-label">Difference</div>
      </div>
      <div class="ci-sum-box ci-sum-match"><div class="ci-sum-val" style="color:var(--c-green)">${matchCount}</div><div class="ci-sum-label">Match</div></div>
      <div class="ci-sum-box ci-sum-kurang"><div class="ci-sum-val" style="color:var(--c-red)">${kurangCount}</div><div class="ci-sum-label">Short</div></div>
      <div class="ci-sum-box ci-sum-lebih"><div class="ci-sum-val" style="color:var(--c-orange)">${lebihCount}</div><div class="ci-sum-label">Over</div></div>
      ${missCount ? `<div class="ci-sum-box" style="border-color:var(--c-gray)"><div class="ci-sum-val" style="color:var(--c-gray)">${missCount}</div><div class="ci-sum-label">Not Found in PIB</div></div>` : ''}
    `;
  }

  const tbody = document.getElementById('pib-cmp-compare-tbody');
  if (tbody) {
    tbody.innerHTML = rows.map(r => {
      const diffCls = r.diff === 0 ? 'sel-zero' : r.diff > 0 ? 'sel-pos' : 'sel-neg';
      const diffTxt = r.diff === 0 ? '0' : r.diff > 0 ? `+${r.diff.toLocaleString()}` : r.diff.toLocaleString();
      const statusHtml = r.extraFromPib ? '<span class="badge badge-orange">Extra in PIB</span>'
        : !r.matched ? '<span class="badge badge-gray">Not Found in PIB</span>'
        : r.diff === 0 ? badge('match') : r.diff < 0 ? badge('kurang') : badge('lebih');
      return `
        <tr>
          <td style="font-family:monospace;font-size:12px;">${r.sku || '—'}</td>
          <td>${r.extraFromPib ? '<em style="color:var(--c-text-hint)">— not in PO —</em>' : `${r.name}${r.size ? ` <span style="font-size:11px;color:var(--c-text-hint)">(${r.size})</span>` : ''}`}</td>
          <td>${r.matchedName ? r.matchedName : '<span style="color:var(--c-text-hint)">—</span>'} ${r.score ? `<span style="font-size:11px;color:var(--c-text-hint)">(${r.score}%)</span>` : ''}</td>
          <td class="num">${r.extraFromPib ? '—' : r.qPO.toLocaleString()}</td>
          <td class="num">${r.matched || r.extraFromPib ? r.pibQty.toLocaleString() : '<span style="color:var(--c-text-hint)">—</span>'}</td>
          <td class="num">${r.extraFromPib ? '—' : (r.qWH || 0).toLocaleString()}</td>
          <td class="num"><span class="${diffCls}">${r.matched || r.extraFromPib ? diffTxt : '—'}</span></td>
          <td>${statusHtml}</td>
        </tr>`;
    }).join('');
  }
}

// Push the detected PIB qty into the PO record itself (updates qtyPIB per
// item + header pibNumber/pibDate) and logs the change to the PO edit log.
function applyPibToPo() {
  const po = MOCK_PO_DATA.find(p => p.poNumber === currentPibPoNumber);
  if (!po || !currentPibCompareRows) return;

  (po.items || []).forEach(it => {
    const row = currentPibCompareRows.find(r => !r.extraFromPib && r.sku === (it.sku || '').trim() && r.name === cleanItemName(it.name || ''));
    if (row && row.matched) it.qtyPIB = row.pibQty;
  });
  po.qtyPIB = (po.items || []).reduce((s, it) => s + Number(it.qtyPIB || 0), 0);
  if (currentPibParsed.pibNumber) po.pibNumber = currentPibParsed.pibNumber;
  if (currentPibParsed.pibDate)   po.pibDate   = currentPibParsed.pibDate;
  po.status = computeStatus(po.qtyPIB, po.qtyWarehouse, po.pibNumber);

  logActivity(po.poNumber, 'Compare PIB', `Applied detected PIB quantities from "${currentPibFileName}"`);
  updateKPI(getAllPoData());
  showToast('✓ PIB quantities applied to this PO.', 'success');
}

function parseCiPdfTable(text) {
  const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const keywords = /(Name|Product Name|Description|Nama BPOM|UPC|Barcode|EAN|JAN Code|SKU|Product Code|Reffcode|Item Code|HS Code|Tariff|HTS|Packaging|Package|Pack|Unit|Quantity|Qty|Q'ty|PCS|EA|FOC Quantity|FOC Q'ty|Unit Price|Price\/Unit|Amount|Total|Value)/i;
  const headerLineIndex = lines.findIndex(line => keywords.test(line));
  if (headerLineIndex < 0) return { headers: [], items: [] };
  const headerCols = lines[headerLineIndex].split(/\s{2,}|\t|;/).map(c => normalizeHeader(c));
  const items = [];
  for (let i = headerLineIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cols = line.split(/\s{2,}|\t|;/).map(c => c.trim()).filter(Boolean);
    if (cols.length < 2) continue;
    const item = {};
    cols.forEach((cell, index) => {
      const key = headerCols[index] || `col_${index}`;
      if (!item[key]) item[key] = parseCiValue(key, cell);
    });
    if (Object.keys(item).length) items.push(item);
  }
  return { headers: headerCols, items };
}

// (renderCiPreview, getCiTotals, renderCiComparison replaced in new CI block above)

// (populateCiPoSelect, filterCiPoList, selectCiPo, updateCiPoSummary replaced above)

function fillFormFromParsed(data, fileName) {
  // ── PO Number ──
  // For multi-PO: fill in the first PO number, but show a warning badge
  setField('pib-po-number', data.po_number);

  // ── Order Date ──
  setField('pib-po-date', data.order_date);

  // ── Rev Code ──
  setField('pib-rev-code', data.rev_code);

  // ── Currency ──
  if (data.currency) {
    const el = document.getElementById('pib-currency');
    if (el) {
      const exists = Array.from(el.options).some(o => o.value === data.currency);
      if (!exists) {
        const opt = document.createElement('option');
        opt.value = data.currency;
        opt.textContent = data.currency + ' — ' + data.currency;
        el.appendChild(opt);
      }
      el.value = data.currency;
      if (typeof updateCurrencyPrefix === 'function') updateCurrencyPrefix();
    }
  }

  // ── PO Value — for multi-PO this is the combined total ──
  if (data.total_amount != null) setField('pib-po-value', data.total_amount);

  // ── Supplier match ──
  if (data.supplier) {
    const supEl = document.getElementById('pib-supplier');
    if (supEl) {
      const sup = data.supplier.toUpperCase();
      for (let o of supEl.options) {
        if (o.value && sup.includes(o.value.toUpperCase())) {
          supEl.value = o.value; break;
        }
      }
    }
  }

  // ── Items → renderItemRows ──
  if (data.items && data.items.length > 0) {
    const mappedItems = data.items.map(it => ({
      sku:          it.sku  || '',
      name:         it.name || '',
      size:         it.size || '',
      qtyPO:        Number(it.qty) || 0,
      qtyPIB:       0,
      qtyWarehouse: 0,
      unitPrice:    Number(it.unit_price) || 0,
      discountPct:  Number(it.discount_pct) || 0,
    }));
    renderItemRows(mappedItems);
    renderPdfPreviewTable(data.items);
  }

  // ── UI feedback ──
  document.getElementById('pdf-loading').style.display = 'none';
  const resultInfo = document.getElementById('pdf-result-info');
  const resultText = document.getElementById('pdf-result-text');
  resultInfo.style.display = 'flex';
  const itemCount = data.items ? data.items.length : 0;

  if (data.is_multi_po && data.po_numbers && data.po_numbers.length > 1) {
    // Multi-PO: show all PO numbers and the combined total
    const poListStr = data.po_numbers.join(' + ');
    const totalFmt = data.total_amount ? Number(data.total_amount).toLocaleString() : '?';
    resultText.textContent = `"${fileName}" — MULTI PO: ${poListStr} · ${itemCount} item · ${data.currency || ''} ${totalFmt} (total gabungan)`;

    // Tampilkan banner info multi-PO
    const old = document.getElementById('multi-po-banner');
    if (old) old.remove();
    const container = document.getElementById('pdf-upload-card');
    if (container) {
      const banner = document.createElement('div');
      banner.id = 'multi-po-banner';
      banner.style.cssText = 'margin-top:12px;padding:12px 16px;background:rgba(59,111,232,.08);border:1px solid rgba(59,111,232,.25);border-radius:8px;font-size:13px;';
      banner.innerHTML = `
        <div style="font-weight:700;color:var(--c-blue-dark);margin-bottom:6px"><i class="ti ti-files"></i> Terdeteksi ${data.po_numbers.length} PO dalam 1 PDF</div>
        ${(data.po_list||data.po_numbers.map(n=>({po_number:n}))).map(p => `
          <div style="display:flex;gap:12px;align-items:center;padding:4px 0;border-bottom:0.5px solid rgba(59,111,232,.15)">
            <span style="font-family:monospace;font-weight:600;color:var(--c-blue-dark)">${p.po_number}</span>
            ${p.total_amount ? `<span style="color:var(--c-text-sub)">${data.currency||''} ${Number(p.total_amount).toLocaleString()}</span>` : ''}
            ${p.total_qty ? `<span style="color:var(--c-text-hint);font-size:12px">${Number(p.total_qty).toLocaleString()} pcs</span>` : ''}
          </div>`).join('')}
        <div style="margin-top:8px;padding-top:8px;font-weight:700;color:var(--c-blue-dark)">
          Total Gabungan: ${data.currency||''} ${Number(data.total_amount||0).toLocaleString()}
        </div>
        <div style="margin-top:6px;font-size:12px;color:var(--c-text-hint)">
          ⚠ The "PO Number" field was filled with the first PO. Please enter each PO separately or adjust manually.
        </div>`;
      container.appendChild(banner);
    }

    showToast(`✓ Multi-PO terdeteksi! ${data.po_numbers.length} PO · Total ${data.currency||''} ${Number(data.total_amount||0).toLocaleString()}`, 'success');
  } else {
    resultText.textContent = `"${fileName}" — PO ${data.po_number || '?'} · ${itemCount} item · ${data.currency || ''} ${data.total_amount ? Number(data.total_amount).toLocaleString() : ''}`;
    showToast(`✓ PDF berhasil dibaca! ${itemCount} item diisi otomatis.`, 'success');
  }
}

function setField(id, val) {
  if (val == null || val === '') return;
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function renderPdfPreviewTable(items) {
  // Remove old preview if any
  const old = document.getElementById('pdf-items-preview');
  if (old) old.remove();

  const container = document.getElementById('pdf-upload-card');
  if (!container || !items || !items.length) return;

  const div = document.createElement('div');
  div.id = 'pdf-items-preview';
  div.style.cssText = 'margin-top:14px;overflow-x:auto;';
  div.innerHTML = `
    <div style="font-size:12px;font-weight:600;color:var(--c-text-hint);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">
      Preview of Items Detected from PDF
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:var(--c-surface-2);">
          <th style="text-align:left;padding:6px 10px;border-bottom:1px solid var(--c-border);font-weight:500;color:var(--c-text-hint);">SKU</th>
          <th style="text-align:left;padding:6px 10px;border-bottom:1px solid var(--c-border);font-weight:500;color:var(--c-text-hint);">Nama Produk</th>
          <th style="text-align:left;padding:6px 10px;border-bottom:1px solid var(--c-border);font-weight:500;color:var(--c-text-hint);">Size</th>
          <th style="text-align:right;padding:6px 10px;border-bottom:1px solid var(--c-border);font-weight:500;color:var(--c-text-hint);">Qty PO</th>
          <th style="text-align:right;padding:6px 10px;border-bottom:1px solid var(--c-border);font-weight:500;color:var(--c-text-hint);">Unit Price</th>
          <th style="text-align:right;padding:6px 10px;border-bottom:1px solid var(--c-border);font-weight:500;color:var(--c-text-hint);">Disc%</th>
          <th style="text-align:right;padding:6px 10px;border-bottom:1px solid var(--c-border);font-weight:500;color:var(--c-text-hint);">Net Price</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((it, i) => `
          <tr style="background:${i%2===0?'var(--c-surface)':'var(--c-surface-2)'}">
            <td style="padding:6px 10px;font-family:monospace;font-size:12px;color:var(--c-blue-dark)">${it.sku||'—'}</td>
            <td style="padding:6px 10px;">${it.name||'—'}</td>
            <td style="padding:6px 10px;color:var(--c-text-hint)">${it.size||'—'}</td>
            <td style="padding:6px 10px;text-align:right;font-weight:500">${Number(it.qty||0).toLocaleString()}</td>
            <td style="padding:6px 10px;text-align:right">${it.unit_price!=null ? Number(it.unit_price).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) : '—'}</td>
            <td style="padding:6px 10px;text-align:right;color:${it.discount_pct===100?'var(--c-orange)':'var(--c-text-hint)'}">${it.discount_pct||0}%</td>
            <td style="padding:6px 10px;text-align:right">${it.net_price ? Number(it.net_price).toLocaleString() : '0'}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
  container.appendChild(div);
}

function resetPdfUpload() {
  document.getElementById('pdf-file-input').value = '';
  document.getElementById('pdf-drop-content').style.display = 'block';
  document.getElementById('pdf-loading').style.display = 'none';
  document.getElementById('pdf-result-info').style.display = 'none';
}

// ════════════════════════════════════════════════════════
//  CREATE PO (DUMMY) — hidden drawer on History PO.
//  Reuses the same PDF-detection logic as the PO form, but the
//  output is a downloadable JSON file (app's PO record shape)
//  instead of a saved PO — it never touches MOCK_PO_DATA.
// ════════════════════════════════════════════════════════
let dummyPoDraft = null; // the generated PO-shaped object, ready to download

function openCreatePoDummyDrawer() {
  resetDummyPdfUpload();
  const overlay = document.getElementById('dummy-po-drawer-overlay');
  if (overlay) overlay.style.display = 'block';
}

function closeCreatePoDummyDrawer() {
  const overlay = document.getElementById('dummy-po-drawer-overlay');
  if (overlay) overlay.style.display = 'none';
}

function handleDummyPdfDrop(event) {
  event.preventDefault();
  document.getElementById('dummy-pdf-drop-zone').classList.remove('dragover');
  const file = event.dataTransfer.files[0];
  if (file && /\.pdf$/i.test(file.name)) handleDummyPdfUpload(file);
  else showToast('Only PDF files are supported.', 'error');
}

async function handleDummyPdfUpload(file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { showToast('File too large. Max 10MB.', 'error'); return; }

  const dropContent = document.getElementById('dummy-pdf-drop-content');
  const loading      = document.getElementById('dummy-pdf-loading');
  if (dropContent) dropContent.style.display = 'none';
  if (loading) loading.style.display = 'block';

  try {
    const pdfText = await extractTextFromPdf(file);
    let parsed = null;
    try {
      parsed = await parsePdfWithAI(pdfText);
    } catch (aiErr) {
      console.warn('AI parse failed, falling back to heuristic parser', aiErr);
      parsed = parsePdfHeuristic(pdfText);
      showToast('AI parser failed — using local parser instead.', 'warning');
    }
    dummyPoDraft = buildDummyPoJson(parsed, file.name);
    renderDummyPoPreview(dummyPoDraft, file.name);
  } catch (err) {
    console.error(err);
    showToast('Failed to read the PDF. Please try again.', 'error');
    resetDummyPdfUpload();
  }
}

// Maps the raw parsed PO PDF data into the exact record shape used by
// History PO / MOCK_PO_DATA, so the resulting JSON can be imported as-is.
function buildDummyPoJson(data, fileName) {
  const items = (data.items || []).map(it => ({
    sku:          it.sku  || '',
    name:         it.name || '',
    size:         it.size || '',
    type:         detectItemType(it.sku || '', it.name || ''),
    qtyPO:        Number(it.qty) || 0,
    qtyPIB:       0,
    qtyWarehouse: 0,
    unitPrice:    Number(it.unit_price) || 0,
    discountPct:  Number(it.discount_pct) || 0,
    netPrice:     it.net_price != null ? Number(it.net_price) : undefined,
  }));

  return {
    poNumber:      data.po_number || '',
    poDate:        data.order_date || '',
    supplier:      data.supplier || '',
    supplierLabel: data.supplier || '',
    revCode:       data.rev_code || '-',
    pibNumber:     '',
    pibDate:       '',
    currency:      data.currency || 'USD',
    status:        'belum-pib',
    qtyPIB:        0,
    qtyWarehouse:  0,
    poValue:       Number(data.total_amount) || 0,
    paidAmount:    0,
    items,
    _sourcePdf:    fileName,
  };
}

function renderDummyPoPreview(po, fileName) {
  const loading   = document.getElementById('dummy-pdf-loading');
  const resultBox = document.getElementById('dummy-pdf-result-info');
  const resultText = document.getElementById('dummy-pdf-result-text');
  if (loading) loading.style.display = 'none';
  if (resultBox) resultBox.style.display = 'flex';
  if (resultText) resultText.textContent = `${fileName} — PO ${po.poNumber || '?'} · ${po.items.length} item terdeteksi`;

  const wrap = document.getElementById('dummy-po-preview-wrap');
  const tbody = document.getElementById('dummy-po-preview-tbody');
  const count = document.getElementById('dummy-po-preview-count');
  const poNumberInput = document.getElementById('dummy-po-number-input');
  if (wrap) wrap.style.display = 'block';
  if (count) count.textContent = `${po.items.length} items`;
  // PO Number is editable — pre-fill with whatever was detected (may be
  // empty if the PDF layout didn't match), so the buttons never stay
  // frozen: the user can just type/fix the PO Number here to unlock them.
  if (poNumberInput) poNumberInput.value = po.poNumber || '';
  if (tbody) {
    tbody.innerHTML = po.items.map(it => `
      <tr>
        <td style="font-family:monospace;font-size:12px;">${it.sku || '—'}</td>
        <td class="num">${(it.qtyPO || 0).toLocaleString()}</td>
        <td class="num">${(it.qtyPIB || 0).toLocaleString()}</td>
        <td class="num">${(it.qtyWarehouse || 0).toLocaleString()}</td>
      </tr>`).join('');
  }

  updateDummyPoButtonsState();
}

// Keeps dummyPoDraft.poNumber synced with the editable field, and toggles
// the Download / Import buttons on/off live as the user types.
function onDummyPoNumberInput(value) {
  if (dummyPoDraft) dummyPoDraft.poNumber = value.trim();
  updateDummyPoButtonsState();
}

function updateDummyPoButtonsState() {
  const hasData = !!(dummyPoDraft && dummyPoDraft.items && dummyPoDraft.items.length && dummyPoDraft.poNumber);
  const dlBtn  = document.getElementById('dummy-po-download-btn');
  const impBtn = document.getElementById('dummy-po-import-btn');
  if (dlBtn)  dlBtn.disabled  = !hasData;
  if (impBtn) impBtn.disabled = !hasData;
}

function downloadDummyPoJson() {
  if (!dummyPoDraft || !dummyPoDraft.poNumber) {
    showToast('PO Number is required — fill it in above first.', 'error');
    return;
  }
  const blob = new Blob([JSON.stringify(dummyPoDraft, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `${dummyPoDraft.poNumber.replace(/[\/\\]/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('✓ JSON file downloaded.', 'success');
}

// One-click path: import the currently-previewed dummy PO straight into
// History PO (same de-duplication logic as Import JSON), no download step.
function importDummyPoToHistory() {
  if (!dummyPoDraft || !dummyPoDraft.poNumber) {
    showToast('PO Number is required — fill it in above first.', 'error');
    return;
  }
  importPoRecords([dummyPoDraft]);
  closeCreatePoDummyDrawer();
}

function resetDummyPdfUpload() {
  dummyPoDraft = null;
  const input       = document.getElementById('dummy-pdf-file-input');
  const dropContent = document.getElementById('dummy-pdf-drop-content');
  const loading     = document.getElementById('dummy-pdf-loading');
  const resultBox   = document.getElementById('dummy-pdf-result-info');
  const wrap        = document.getElementById('dummy-po-preview-wrap');
  const poNumberInput = document.getElementById('dummy-po-number-input');
  if (input) input.value = '';
  if (dropContent) dropContent.style.display = 'block';
  if (loading) loading.style.display = 'none';
  if (resultBox) resultBox.style.display = 'none';
  if (wrap) wrap.style.display = 'none';
  if (poNumberInput) poNumberInput.value = '';
  updateDummyPoButtonsState();
}

// ════════════════════════════════════════════════════════
//  EXPORT JSON — History PO
//  Downloads the PO(s) currently visible in History PO (respecting
//  the search filter) as a JSON array, in the exact shape MOCK_PO_DATA
//  / Import JSON expects — so the file can be edited and re-imported
//  to keep updating the same PO records over time.
// ════════════════════════════════════════════════════════
function exportHistoryPoJson() {
  const q = document.getElementById('history-search')?.value.trim().toLowerCase() || '';
  const data = getAllPoData().filter(po =>
    !q || po.poNumber.toLowerCase().includes(q) ||
    (po.supplierLabel || po.supplier || '').toLowerCase().includes(q)
  );
  if (!data.length) {
    showToast('No PO to export.', 'error');
    return;
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  const stamp = new Date().toISOString().slice(0, 10);
  a.download = q ? `history-po-export-${stamp}.json` : `history-po-export-all-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast(`✓ ${data.length} PO exported. Edit the file and use "Import JSON" to bring updates back in.`, 'success');
}

// ════════════════════════════════════════════════════════
//  IMPORT JSON — History PO
//  Appends one or more Create PO (Dummy) JSON files into
//  MOCK_PO_DATA. Never replaces the existing dataset; PO
//  numbers that already exist are flagged as duplicates and
//  only overwritten if the user explicitly confirms.
// ════════════════════════════════════════════════════════
function handleImportJsonFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;

  Promise.all(files.map(file => file.text().then(
    text => ({ file: file.name, ok: true, data: JSON.parse(text) }),
    () => ({ file: file.name, ok: true, data: null })
  ).catch(() => ({ file: file.name, ok: false, data: null }))))
  .then(results => {
    const records = [];
    const failedFiles = [];
    results.forEach(r => {
      if (!r.ok || r.data == null) { failedFiles.push(r.file); return; }
      const arr = Array.isArray(r.data) ? r.data : [r.data];
      arr.forEach(rec => { if (rec && rec.poNumber) records.push(rec); });
    });
    if (failedFiles.length) {
      showToast(`Failed to read: ${failedFiles.join(', ')} (invalid JSON).`, 'error');
    }
    if (!records.length) {
      if (!failedFiles.length) showToast('No valid PO data found in the selected file(s).', 'error');
      return;
    }
    importPoRecords(records);
    const input = document.getElementById('history-import-json-input');
    if (input) input.value = '';
  });
}

// Normalizes an imported record into the exact shape used by MOCK_PO_DATA,
// so partially-filled dummy JSON (Qty PIB/WH = 0, etc.) still behaves.
function normalizePoRecord(rec) {
  return {
    poNumber:      rec.poNumber,
    poDate:        rec.poDate || '',
    supplier:      rec.supplier || rec.supplierLabel || '',
    supplierLabel: rec.supplierLabel || rec.supplier || '',
    revCode:       rec.revCode || '-',
    pibNumber:     rec.pibNumber || '',
    pibDate:       rec.pibDate || '',
    currency:      rec.currency || 'USD',
    qtyPIB:        Number(rec.qtyPIB || 0),
    qtyWarehouse:  Number(rec.qtyWarehouse || 0),
    poValue:       Number(rec.poValue || 0),
    paidAmount:    Number(rec.paidAmount || 0),
    items:         Array.isArray(rec.items) ? rec.items : [],
    status:        rec.status || computeStatus(Number(rec.qtyPIB || 0), Number(rec.qtyWarehouse || 0), rec.pibNumber || ''),
  };
}

function importPoRecords(records) {
  const added = [];
  const duplicates = [];

  records.forEach(rec => {
    const existing = MOCK_PO_DATA.find(p => p.poNumber === rec.poNumber);
    if (existing) duplicates.push(rec);
    else { MOCK_PO_DATA.push(normalizePoRecord(rec)); added.push(rec.poNumber); }
  });

  if (duplicates.length) {
    const list = duplicates.map(d => d.poNumber).join(', ');
    const overwrite = confirm(
      `${duplicates.length} PO already exist in History PO (${list}).\n\n` +
      `Click OK to overwrite them with the imported data, or Cancel to keep the existing data as-is (skip these).`
    );
    if (overwrite) {
      duplicates.forEach(rec => {
        const existing = MOCK_PO_DATA.find(p => p.poNumber === rec.poNumber);
        Object.assign(existing, normalizePoRecord(rec));
        logActivity(rec.poNumber, 'Import JSON (Overwrite)', 'PO data overwritten from an imported JSON file.');
      });
    }
  }

  added.forEach(pn => logActivity(pn, 'Import JSON', 'PO added from an imported JSON file.'));

  updateKPI(getAllPoData());
  renderPibHistory();

  const parts = [];
  if (added.length) parts.push(`${added.length} PO baru ditambahkan`);
  if (duplicates.length) parts.push(`${duplicates.length} PO duplikat terdeteksi`);
  showToast(parts.length ? parts.join(' · ') : 'No new PO to import.', added.length ? 'success' : 'warning');
}

// ── PO Search ─────────────────────────────────────────────────
function doSearch() {
  const poNum = document.getElementById('po-number').value.trim().toLowerCase();
  const poDate = document.getElementById('po-date').value;
  const sup    = document.getElementById('supplier').value;
  const st     = document.getElementById('status-filter').value;

  const results = getAllPoData().filter(po => {
    if (poNum) {
      const inPO  = po.poNumber.toLowerCase().includes(poNum);
      const inBrand = (po.supplierLabel || po.supplier || '').toLowerCase().includes(poNum);
      const inItem  = (po.items || []).some(it =>
        `${it.sku||''} ${it.name||''}`.toLowerCase().includes(poNum)
      );
      if (!inPO && !inBrand && !inItem) return false;
    }
    if (poDate && po.poDate !== poDate) return false;
    if (sup && (po.supplierLabel || po.supplier) !== sup) return false;
    if (st  && po.status !== st) return false;
    return true;
  });

  closeDetail();
  updateKPI(results.length ? results : getAllPoData());

  const es = document.getElementById('empty-state');
  const rs = document.getElementById('results-section');

  if (results.length === 0) {
    es.style.display = 'flex';
    rs.style.display = 'none';
    showToast('No PO matches the filter.', 'error');
  } else {
    es.style.display = 'none';
    rs.style.display = 'block';
    renderSummaryTable(results);
    document.getElementById('result-count').textContent = results.length + ' PO ditemukan';
    showToast(`Ditemukan ${results.length} Purchase Order.`, 'success');
  }
}

function resetSearch() {
  ['po-number','po-date','supplier','status-filter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('empty-state').style.display    = 'flex';
  document.getElementById('results-section').style.display = 'none';
  updateKPI(getAllPoData());
  closeDetail();
}

// ── Summary Table ──────────────────────────────────────────────
function renderSummaryTable(data) {
  const tbody = document.getElementById('summary-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  data.forEach(po => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong style="color:var(--c-blue-dark)">${po.poNumber}</strong></td>
      <td>${po.supplierLabel || po.supplier || '—'}</td>
      <td>${fmtDate(po.poDate)}</td>
      <td>${badge(po.status)}</td>
      <td class="num">${(po.qtyPIB||0).toLocaleString()}</td>
      <td class="num">${(po.qtyWarehouse||0).toLocaleString()}</td>
      <td style="white-space:nowrap">
        <button class="btn-detail" onclick="showDetail('${po.poNumber}')" title="Lihat detail PO">
          <i class="ti ti-eye"></i> Detail
        </button>
        <button class="btn-detail" onclick="goToCiValidation('${po.poNumber}')" title="Verifikasi PO — Qty &amp; Value CI">
          <i class="ti ti-file-search"></i>
        </button>
        <button class="btn-detail" onclick="showAddPoForm('${po.poNumber}')" title="Update Qty PIB &amp; Qty WH (Inbound)">
          <i class="ti ti-truck-delivery"></i>
        </button>
        <button class="btn-detail" onclick="openEditLogModal('${po.poNumber}')" title="Log of who edited this PO">
          <i class="ti ti-history"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Detail ────────────────────────────────────────────────────
function showDetail(poNumber) {
  const po = MOCK_PO_DATA.find(p => p.poNumber === poNumber);
  if (!po) return;
  currentDetailPoNumber = poNumber;

  document.getElementById('header-info-table').innerHTML = `
    <tr><td>PO Number</td>  <td style="color:var(--c-blue-dark)">${po.poNumber}</td></tr>
    <tr><td>PO Date</td>    <td>${fmtDate(po.poDate)}</td></tr>
    <tr><td>Brand</td>      <td>${po.supplierLabel || po.supplier || '—'}</td></tr>
    <tr><td>Rev Code</td>   <td>${po.revCode || '—'}</td></tr>
    <tr><td>PIB Number</td> <td>${po.pibNumber || '—'}</td></tr>
    <tr><td>PIB Date</td>   <td>${fmtDate(po.pibDate)}</td></tr>
    <tr><td>Currency</td>   <td>${po.currency || 'USD'}</td></tr>
    <tr><td>PO Value</td>   <td>${po.currency || 'USD'} ${fmt(po.poValue)}</td></tr>
    <tr><td>Status</td>     <td>${badge(po.status)}</td></tr>
  `;

  const tbody = document.getElementById('item-tbody');
  tbody.innerHTML = '';
  let totPO=0, totPIB=0, totWH=0;

  (po.items||[]).forEach(it => {
    const qPO  = Number(it.qtyPO  || it.qtyPIB || 0);
    const qPIB = Number(it.qtyPIB || 0);
    const qWH  = Number(it.qtyWarehouse || 0);
    const s = (qWH > 0 ? qWH : qPIB) - qPO;
    totPO += qPO; totPIB += qPIB; totWH += qWH;
    const itType = it.type || detectItemType(it.sku || '', it.name || '');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family:monospace;font-size:13px">${it.sku || '—'}</td>
      <td>${cleanItemName(it.name || '') || '—'}</td>
      <td>${itemTypeBadge(itType)}</td>
      <td class="num">${qPO.toLocaleString()}</td>
      <td class="num">${qPIB.toLocaleString()}</td>
      <td class="num">${qWH.toLocaleString()}</td>
      <td class="num">${selisih(s)}</td>
      <td>${itemStatus(s)}</td>
    `;
    tbody.appendChild(tr);
  });

  const totRow = document.createElement('tr');
  totRow.className = 'total-row';
  totRow.innerHTML = `
    <td colspan="2">Total</td>
    <td class="num">${totPO.toLocaleString()}</td>
    <td class="num">${totPIB.toLocaleString()}</td>
    <td class="num">${totWH.toLocaleString()}</td>
    <td class="num">${selisih((totWH > 0 ? totWH : totPIB) - totPO)}</td>
    <td></td>
  `;
  tbody.appendChild(totRow);

  renderEditLog(poNumber);

  const ds = document.getElementById('detail-section');
  ds.style.display = 'block';
  setTimeout(() => ds.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}

function closeDetail() {
  const el = document.getElementById('detail-section');
  if (el) el.style.display = 'none';
  currentDetailPoNumber = null;
}

// ── History PO ────────────────────────────────────────────────
function renderPibHistory(filter = '') {
  const tbody = document.getElementById('pib-history-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const q = filter.toLowerCase();
  const data = getAllPoData().filter(po =>
    !q || po.poNumber.toLowerCase().includes(q) ||
    (po.supplierLabel || po.supplier || '').toLowerCase().includes(q)
  );

  const countEl = document.getElementById('history-count');
  if (countEl) countEl.textContent = data.length + ' PO';

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--c-text-hint)">No data found</td></tr>`;
    return;
  }

  data.forEach(po => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong style="color:var(--c-blue-dark)">${po.poNumber}</strong></td>
      <td>${po.pibNumber || '<span style="color:var(--c-text-hint)">—</span>'}</td>
      <td>${po.supplierLabel || po.supplier || '—'}</td>
      <td>${fmtDate(po.poDate)}</td>
      <td>${badge(po.status)}</td>
      <td class="num">${(po.qtyPIB||0).toLocaleString()}</td>
      <td class="num">${(po.qtyWarehouse||0).toLocaleString()}</td>
      <td style="white-space:nowrap">
        <button class="btn-detail" onclick="showAddPoForm('${po.poNumber}')">
          <i class="ti ti-pencil"></i> Edit
        </button>
        <button class="btn-detail" style="margin-left:4px" onclick="goToCiValidation('${po.poNumber}')" title="Validasi qty PO vs CI">
          <i class="ti ti-file-search"></i> Validasi CI
        </button>
        <button class="btn-detail" style="margin-left:4px" onclick="goToPaymentProof('${po.poNumber}')" title="Check this PO's payment status (matches payment proofs by the same PO Number)">
          <i class="ti ti-receipt"></i> Payment Proof
        </button>
        <button class="btn-detail" style="margin-left:4px" onclick="goToComparePib('${po.poNumber}')" title="Detect a PIB PDF and compare its quantities against this PO">
          <i class="ti ti-file-diff"></i> Compare PIB
        </button>
        <button class="btn-detail" style="margin-left:4px" onclick="openEditLogModal('${po.poNumber}')" title="Log of who edited this PO">
          <i class="ti ti-history"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Cross-module navigation: History → CI Verification / Value Recon ──
function goToCiValidation(poNumber) {
  switchTab('ci');
  populateCiPoSelect();
  const select = document.getElementById('ci-po-select');
  if (select) { select.value = poNumber; selectCiPo(poNumber); }
}

// History PO → Payment Proof: jump straight to the Payment Proof Matching
// page and auto-search by this exact PO Number, then show its aggregated
// payment status (paid / partial / not yet paid) with attachments.
function goToPaymentProof(poNumber) {
  switchTab('valrecon');
  const search = document.getElementById('pm-search');
  if (search) search.value = poNumber;
  pmRefreshFilters();
  pmShowPoPaymentStatus(poNumber);
}

function filterHistory() {
  const q = document.getElementById('history-search')?.value || '';
  renderPibHistory(q);
}

// ── Buat / Edit PO Form ───────────────────────────────────────
function showCreateView() {
  switchTab('create');
  clearPibForm();
  renderItemRows([]);
  editingPoNumber = null;
}

function showHistoryView() { switchTab('history'); }

function showAddPoForm(poNumber = null) {
  switchTab('create');
  editingPoNumber = poNumber;
  if (poNumber) {
    const po = getAllPoData().find(p => p.poNumber === poNumber);
    if (!po) return;
    document.getElementById('pib-po-number').value  = po.poNumber;
    document.getElementById('pib-po-date').value    = po.poDate || '';
    document.getElementById('pib-supplier').value   = po.supplierLabel || po.supplier || '';
    document.getElementById('pib-currency').value   = po.currency || 'USD';
    document.getElementById('pib-po-value').value   = po.poValue || '';
    document.getElementById('pib-pib-number').value = po.pibNumber || '';
    document.getElementById('pib-pib-date').value   = po.pibDate || '';
    const revEl = document.getElementById('pib-rev-code');
    if (revEl) revEl.value = po.revCode || '';
    updateCurrencyPrefix();
    renderItemRows(po.items || []);
  } else {
    clearPibForm();
    renderItemRows([]);
  }
}

function clearPibForm() {
  editingPoNumber = null;
  resetPdfUpload();
  ['pib-po-number','pib-po-date','pib-rev-code','pib-pib-number','pib-pib-date','pib-qty-pib','pib-qty-wh','pib-po-value'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const sup = document.getElementById('pib-supplier');
  if (sup) sup.value = '';
  const cur = document.getElementById('pib-currency');
  if (cur) cur.value = 'USD';
  updateCurrencyPrefix();
  renderItemRows([]);
}

function updateCurrencyPrefix() {
  const cur = document.getElementById('pib-currency')?.value || 'USD';
  const prefix = document.getElementById('currency-prefix');
  if (prefix) prefix.textContent = cur;
}

// ── Item rows ─────────────────────────────────────────────────
// ── Item type detection ──────────────────────────────────────
// SKU ending "S" or ALLS → GWP; ending "1" or ALL1 → Sellable
function detectItemType(sku, name) {
  const s = (sku || '').trim();
  if (/S$/i.test(s))  return 'GWP';
  if (/1$/i.test(s))  return 'Sellable';
  if (/\bGWP\b/i.test(name || '')) return 'GWP';
  return 'Sellable';
}

function itemTypeBadge(type) {
  return type === 'GWP'
    ? `<span class="badge badge-gwp" title="Gift With Purchase">GWP</span>`
    : `<span class="badge badge-sellable" title="Sellable Product">Sellable</span>`;
}

function cleanItemName(name) {
  return (name || '').replace(/\bGWP\b/gi, '').replace(/\s{2,}/g, ' ').trim();
}

function refreshItemType(input) {
  const row = input.closest('tr');
  if (!row) return;
  const type = detectItemType(input.value.trim(), row.querySelector('.item-name')?.value || '');
  const cell = row.querySelector('.item-type-cell');
  if (cell) cell.innerHTML = itemTypeBadge(type);
}

function addItemRow(item = {}) {
  const tbody = document.getElementById('item-input-body');
  if (!tbody) return;
  const row  = document.createElement('tr');
  const sku  = item.sku  || '';
  const name = cleanItemName(item.name || '');
  const size = item.size || '';
  const qPO  = item.qtyPO  != null ? item.qtyPO  : '';
  const qPIB = item.qtyPIB != null ? item.qtyPIB : '';
  const qWH  = item.qtyWarehouse != null ? item.qtyWarehouse : '';
  const diff = (Number(qWH) > 0 ? Number(qWH) : (Number(qPIB) || 0)) - (Number(qPO) || 0);
  const diffCls = diff>0 ? 'sel-pos' : diff<0 ? 'sel-neg' : 'sel-zero';
  const diffTxt = diff===0 ? '0' : diff>0 ? `+${diff}` : `${diff}`;
  const type = item.type || detectItemType(sku, item.name || '');
  const unitPrice = item.unitPrice != null ? item.unitPrice : '';
  const discountPct = item.discountPct != null ? item.discountPct : 0;
  const valuePO = (Number(qPO)||0) * (Number(unitPrice)||0) * (1 - (Number(discountPct)||0)/100);

  row.innerHTML = `
    <td><input type="text" class="item-sku" value="${sku}" placeholder="SKU001"
      style="width:100%" oninput="refreshItemType(this)" /></td>
    <td><input type="text" class="item-name" value="${name}" placeholder="Nama produk" /></td>
    <td><input type="text" class="item-size" value="${size}" placeholder="170gr" style="width:80px" /></td>
    <td class="item-type-cell">${itemTypeBadge(type)}</td>
    <td class="num"><input type="number" class="item-qty-po"  value="${qPO}"  min="0" step="1" /></td>
    <td class="num"><input type="number" class="item-qty-pib" value="${qPIB}" min="0" step="1" /></td>
    <td class="num"><input type="number" class="item-qty-wh"  value="${qWH}"  min="0" step="1" /></td>
    <td class="num"><span class="item-selisih ${diffCls}">${diffTxt}</span></td>
    <td class="num"><input type="number" class="item-unit-price" value="${unitPrice}" min="0" step="0.01" placeholder="0.00" /></td>
    <td class="num"><input type="number" class="item-discount" value="${discountPct}" min="0" max="100" step="0.01" placeholder="0"
          title="100% discount = this item's Net Price is 0 (usually GWP/FOC)" /></td>
    <td class="num"><span class="item-value-po">${valuePO ? valuePO.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) : '0.00'}</span></td>
    <td><button class="btn-sm" type="button" onclick="removeItemRow(this)"><i class="ti ti-x"></i></button></td>
  `;
  tbody.appendChild(row);

  const qPibInput = row.querySelector('.item-qty-pib');
  const qWhInput  = row.querySelector('.item-qty-wh');
  const qPoInput  = row.querySelector('.item-qty-po');
  const priceInput = row.querySelector('.item-unit-price');
  const discInput  = row.querySelector('.item-discount');

  const updateRow = () => {
    const p  = Number(qPibInput.value || 0);
    const w  = Number(qWhInput.value  || 0);
    const po = Number(qPoInput.value  || 0);
    // Received qty so far: Qty WH once Warehouse Admin fills it in, otherwise
    // fall back to Qty PIB (e.g. right after applying Compare PIB) so the
    // Difference reacts immediately instead of staying stuck at 0.
    const received = w > 0 ? w : p;
    const d  = received - po;
    const span = row.querySelector('.item-selisih');
    span.textContent = d===0 ? '0' : d>0 ? `+${d}` : `${d}`;
    span.className = `item-selisih ${d>0?'sel-pos':d<0?'sel-neg':'sel-zero'}`;

    const price = Number(priceInput.value || 0);
    const disc  = Math.min(100, Math.max(0, Number(discInput.value || 0)));
    const val = po * price * (1 - disc/100);
    const valSpan = row.querySelector('.item-value-po');
    if (valSpan) valSpan.textContent = val.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});

    updateItemTotals();
  };
  [qPibInput, qWhInput, qPoInput, priceInput, discInput].forEach(el => el.addEventListener('input', updateRow));
  updateItemTotals();
}

function removeItemRow(button) {
  button.closest('tr')?.remove();
  updateItemTotals();
}

function renderItemRows(items = []) {
  const tbody = document.getElementById('item-input-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (items.length === 0) { addItemRow(); return; }
  items.forEach(item => addItemRow(item));
  updateItemTotals();
}

function getItemRowsData() {
  return Array.from(document.querySelectorAll('#item-input-body tr')).map(row => {
    const sku  = row.querySelector('.item-sku')?.value.trim()  || '';
    const name = row.querySelector('.item-name')?.value.trim() || '';
    const size = row.querySelector('.item-size')?.value.trim() || '';
    // Read type from badge text, or re-detect from SKU
    const typeCell = row.querySelector('.item-type-cell');
    const type = typeCell?.querySelector('.badge')?.textContent.trim() || detectItemType(sku, name);
    const qtyPO = parseInt(row.querySelector('.item-qty-po')?.value || 0, 10);
    const unitPrice = parseFloat(row.querySelector('.item-unit-price')?.value || 0);
    const discountPct = Math.min(100, Math.max(0, parseFloat(row.querySelector('.item-discount')?.value || 0)));
    return {
      sku, name, size, type,
      qtyPO,
      qtyPIB:       parseInt(row.querySelector('.item-qty-pib')?.value || 0, 10),
      qtyWarehouse: parseInt(row.querySelector('.item-qty-wh')?.value  || 0, 10),
      unitPrice,
      discountPct,
      valuePO: qtyPO * unitPrice * (1 - discountPct/100),
    };
  }).filter(it => it.sku || it.name || it.qtyPIB || it.qtyWarehouse);
}

function updateItemTotals() {
  const items = getItemRowsData();
  const tPIB = items.reduce((s, i) => s + i.qtyPIB, 0);
  const tWH  = items.reduce((s, i) => s + i.qtyWarehouse, 0);
  const tValuePO = items.reduce((s, i) => s + (i.valuePO || 0), 0);
  const pibEl = document.getElementById('pib-qty-pib');
  const whEl  = document.getElementById('pib-qty-wh');
  const valEl = document.getElementById('pib-total-value-po');
  if (pibEl) pibEl.value = tPIB;
  if (whEl)  whEl.value  = tWH;
  if (valEl) valEl.value = tValuePO.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
}

function submitPibForm() {
  const poNumber = document.getElementById('pib-po-number').value.trim();
  const poDate   = document.getElementById('pib-po-date').value;
  const supplier = document.getElementById('pib-supplier').value;
  const currency = document.getElementById('pib-currency').value || 'USD';
  const revCode  = document.getElementById('pib-rev-code')?.value.trim() || '';
  const pibNum   = document.getElementById('pib-pib-number').value.trim();
  const pibDate  = document.getElementById('pib-pib-date').value;
  const qtyPIB   = parseInt(document.getElementById('pib-qty-pib').value || 0, 10);
  const qtyWH    = parseInt(document.getElementById('pib-qty-wh').value  || 0, 10);
  const poValue  = parseFloat(document.getElementById('pib-po-value').value || 0);
  const status   = computeStatus(qtyPIB, qtyWH, pibNum);
  const items    = getItemRowsData();

  if (!poNumber) { showToast('PO Number wajib diisi.', 'error'); return; }
  if (!supplier) { showToast('Brand / Supplier wajib dipilih.', 'error'); return; }

  const existing = MOCK_PO_DATA.find(p => p.poNumber === poNumber);
  if (existing) {
    const before = {
      qtyPIB:       existing.qtyPIB || 0,
      qtyWarehouse: existing.qtyWarehouse || 0,
      poValue:      existing.poValue || 0,
      pibNumber:    existing.pibNumber || '',
    };
    Object.assign(existing, { poDate, supplier, supplierLabel: supplier, revCode, pibNumber: pibNum, pibDate,
      qtyPIB, qtyWarehouse: qtyWH, poValue, currency, status, items });

    const changes = [];
    if (before.qtyPIB !== qtyPIB) changes.push(`Qty PIB: ${before.qtyPIB.toLocaleString()} → ${qtyPIB.toLocaleString()}`);
    if (before.qtyWarehouse !== qtyWH) changes.push(`Qty WH (Inbound): ${before.qtyWarehouse.toLocaleString()} → ${qtyWH.toLocaleString()}`);
    if (Math.abs(before.poValue - poValue) > 0.005) changes.push(`PO Value: ${currency} ${fmt(before.poValue)} → ${currency} ${fmt(poValue)}`);
    if (before.pibNumber !== pibNum) changes.push(`No. PIB: ${before.pibNumber || '—'} → ${pibNum || '—'}`);
    logActivity(poNumber, 'Update PIB / Qty WH', changes.length ? changes.join('; ') : 'Data PO diperbarui.');

    showToast('Data PO berhasil diperbarui!', 'success');
  } else {
    MOCK_PO_DATA.push({ poNumber, poDate, supplier, supplierLabel: supplier, revCode,
      pibNumber: pibNum, pibDate, currency, status, qtyPIB, qtyWarehouse: qtyWH, poValue, items });
    logActivity(poNumber, 'Tambah PO Baru', `Qty PIB ${qtyPIB.toLocaleString()}, Qty WH ${qtyWH.toLocaleString()}, Value ${currency} ${fmt(poValue)}`);
    showToast('PO baru berhasil ditambahkan!', 'success');
  }

  updateKPI(getAllPoData());
  switchTab('history');
  renderPibHistory();
}

// ── Shipment ──────────────────────────────────────────────────
function toggleShipmentForm(show) {
  const form = document.getElementById('shipment-form');
  if (!form) return;
  form.style.display = show ? 'block' : 'none';
  if (!show) {
    editingShipmentIndex = null;
    clearShipmentForm();
    const btn = document.getElementById('shipment-save-btn');
    if (btn) btn.innerHTML = '<i class="ti ti-device-floppy"></i> Simpan Shipment';
    const title = document.getElementById('shipment-form-title');
    if (title) title.textContent = 'Tambah Shipment Baru';
  }
}

function clearShipmentForm() {
  ['shipment-name','shipment-brand','shipment-vessel','shipment-no-bl','shipment-container-type',
   'shipment-liner','shipment-etd','shipment-ata-port','shipment-ata-wh'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const brandCustom = document.getElementById('shipment-brand-custom');
  if (brandCustom) { brandCustom.value = ''; brandCustom.style.display = 'none'; }
}

function addShipment() {
  const name          = document.getElementById('shipment-name').value.trim();
  let brand           = document.getElementById('shipment-brand').value;
  const brandCustomEl = document.getElementById('shipment-brand-custom');
  if (brand === '__other__' && brandCustomEl) brand = brandCustomEl.value.trim();
  const vessel        = document.getElementById('shipment-vessel').value.trim();
  const noBl          = document.getElementById('shipment-no-bl').value.trim();
  const containerType = document.getElementById('shipment-container-type').value;
  const linerShipment = document.getElementById('shipment-liner').value.trim();
  const etd           = document.getElementById('shipment-etd').value;
  const ataPort       = document.getElementById('shipment-ata-port').value;
  const ataWarehouse  = document.getElementById('shipment-ata-wh').value;

  if (!name || !brand || !containerType || !etd || !ataPort || !ataWarehouse) {
    showToast('Please fill in all required fields in the shipment form.', 'error');
    return;
  }

  // if user provided a custom brand, add it to the brand select for future reuse
  try {
    const brandSel = document.getElementById('shipment-brand');
    if (brandSel) {
      let exists = false;
      for (let i=0;i<brandSel.options.length;i++) { if (brandSel.options[i].value === brand) { exists = true; break; } }
      if (!exists) {
        const opt = document.createElement('option'); opt.value = brand; opt.textContent = brand;
        // insert before the last option (which is the '__other__' option)
        if (brandSel.options.length) brandSel.insertBefore(opt, brandSel.options[brandSel.options.length-1]);
        else brandSel.appendChild(opt);
      }
    }
  } catch (e) { /* ignore DOM errors */ }

  const data = { shipmentName: name, brand, vessel, noBl, containerType, linerShipment, etd, ataPort, ataWarehouse };
  if (editingShipmentIndex !== null) {
    MOCK_SHIPMENTS[editingShipmentIndex] = data;
    showToast('Shipment berhasil diperbarui!', 'success');
  } else {
    MOCK_SHIPMENTS.unshift(data);
    showToast('Shipment baru berhasil ditambahkan!', 'success');
  }

  renderShipmentDashboard();
  toggleShipmentForm(false);
}

function editShipment(index) {
  const item = MOCK_SHIPMENTS[index];
  if (!item) return;
  editingShipmentIndex = index;
  document.getElementById('shipment-name').value           = item.shipmentName || '';
  const brandSel = document.getElementById('shipment-brand');
  const brandCustomEl = document.getElementById('shipment-brand-custom');
  if (brandSel) {
    let found = false;
    for (let i=0;i<brandSel.options.length;i++) {
      if (brandSel.options[i].value === item.brand) { found = true; break; }
    }
    if (found) {
      brandSel.value = item.brand || '';
      if (brandCustomEl) brandCustomEl.style.display = 'none';
    } else {
      brandSel.value = '__other__';
      if (brandCustomEl) { brandCustomEl.style.display = 'block'; brandCustomEl.value = item.brand || ''; }
    }
  }
  document.getElementById('shipment-vessel').value         = item.vessel || '';
  document.getElementById('shipment-no-bl').value          = item.noBl || '';
  document.getElementById('shipment-container-type').value = item.containerType || '';
  document.getElementById('shipment-liner').value          = item.linerShipment || '';
  document.getElementById('shipment-etd').value            = item.etd || '';
  document.getElementById('shipment-ata-port').value       = item.ataPort || '';
  document.getElementById('shipment-ata-wh').value         = item.ataWarehouse || '';
  const btn = document.getElementById('shipment-save-btn');
  if (btn) btn.innerHTML = '<i class="ti ti-device-floppy"></i> Update Shipment';
  const title = document.getElementById('shipment-form-title');
  if (title) title.textContent = 'Edit Shipment';
  toggleShipmentForm(true);
  document.getElementById('shipment-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function deleteShipment(index) {
  if (!confirm(`Hapus shipment "${MOCK_SHIPMENTS[index]?.shipmentName}"?`)) return;
  MOCK_SHIPMENTS.splice(index, 1);
  renderShipmentDashboard();
  showToast('Shipment berhasil dihapus.', 'success');
}

function getShipmentFilters() {
  return {
    name:          document.getElementById('shipment-filter-name')?.value.trim().toLowerCase() || '',
    brand:         document.getElementById('shipment-filter-brand')?.value || '',
    containerType: document.getElementById('shipment-filter-container')?.value || '',
  };
}

function applyShipmentFilters(items) {
  const { name, brand, containerType } = getShipmentFilters();
  return items.filter(item => {
    if (name && !item.shipmentName.toLowerCase().includes(name)) return false;
    if (brand && item.brand !== brand) return false;
    if (containerType && item.containerType !== containerType) return false;
    return true;
  });
}

function renderShipmentDashboard() {
  renderShipmentTop5('shipment-top5', { showHeading: true, clickable: false, layout: 'grid' });
  const list = document.getElementById('shipment-list');
  if (!list) return;
  list.innerHTML = '';
  const filtered = applyShipmentFilters(MOCK_SHIPMENTS);
  if (!filtered.length) {
    list.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--c-text-hint)">No shipments found. Click "Add Shipment" to add one.</td></tr>`;
    return;
  }
  filtered.forEach((item, i) => {
    const realIdx = MOCK_SHIPMENTS.indexOf(item);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${i+1}</td>
      <td><strong>${item.shipmentName}</strong></td>
      <td><span class="badge badge-gray">${item.brand}</span></td>
      <td>${item.vessel || '—'}</td>
      <td>${item.noBl || '—'}</td>
      <td>${item.linerShipment || '—'}</td>
      <td><span class="badge ${item.containerType==='FCL'?'badge-green':'badge-orange'}">${item.containerType||'—'}</span></td>
      <td>${fmtDate(item.etd)}</td>
      <td>${fmtDate(item.ataPort)}</td>
      <td>${fmtDate(item.ataWarehouse)}</td>
      <td style="display:flex;gap:6px">
        <button class="btn-detail" onclick="editShipment(${realIdx})"><i class="ti ti-edit"></i> Edit</button>
        <button class="btn-detail" onclick="openSkExportModal(${realIdx})" title="Export Surat Kuasa ke Word"><i class="ti ti-file-export"></i> Surat Kuasa</button>
        <button class="btn-detail btn-detail-danger" onclick="deleteShipment(${realIdx})"><i class="ti ti-trash"></i></button>
      </td>
    `;
    list.appendChild(row);
  });
}

// ── Shipment Top 5 ─────────────────────────────────────────────
function renderShipmentTop5(containerId, options = {}) {
  const { layout = 'grid', clickable = false } = options;
  const container = document.getElementById(containerId);
  if (!container) return;

  const top5 = [...MOCK_SHIPMENTS]
    .map(item => ({ ...item, etaDistance: getDaysUntil(item.ataPort), transit: getDaysBetween(item.etd, item.ataPort) }))
    .filter(item => item.etaDistance !== null)
    .sort((a, b) => a.etaDistance - b.etaDistance)
    .slice(0, 5);

  if (!top5.length) { container.innerHTML = ''; return; }

  if (layout === 'stack') {
    const grid = document.createElement('div');
    grid.className = 'shipment-stack';
    top5.forEach((item, i) => {
      const card = document.createElement('div');
      card.className = 'shipment-stack-row' + (clickable ? ' clickable' : '');
      if (clickable) card.setAttribute('onclick', "switchTab('shipment')");
      card.innerHTML = `
        <div class="shipment-stack-brand">
          <span class="shipment-top5-brand">${item.brand}</span>
          <span class="shipment-stack-container">${item.containerType||'—'}</span>
          <span class="shipment-stack-rank">#${i+1}</span>
        </div>
        <div class="shipment-name" style="margin-bottom:8px;font-size:14px;font-weight:800">${item.shipmentName}</div>
        <div class="shipment-stack-vessel"><i class="ti ti-ship" style="vertical-align:-2px;margin-right:4px"></i>${item.vessel||'—'}</div>
        <div class="shipment-stack-dates">
          <span><i class="ti ti-plane-departure" style="font-size:11px;margin-right:3px;color:var(--c-blue)"></i>ETD: ${fmtDate(item.etd)}</span>
          <span><i class="ti ti-anchor" style="font-size:11px;margin-right:3px;color:var(--c-orange)"></i>ATA Port: ${fmtDate(item.ataPort)}</span>
          <span><i class="ti ti-building-warehouse" style="font-size:11px;margin-right:3px;color:var(--c-green)"></i>ATA WH: ${fmtDate(item.ataWarehouse)}</span>
        </div>
        <div class="shipment-stack-info" style="font-size:12px;color:var(--c-text-hint);padding:4px 0">
          <span><i class="ti ti-file-text" style="font-size:11px;margin-right:3px"></i>BL: ${item.noBl||'—'}</span>
          <span style="margin-left:12px"><i class="ti ti-truck" style="font-size:11px;margin-right:3px"></i>Liner: ${item.linerShipment||'—'}</span>
        </div>
        <div class="shipment-stack-countdown">
          ${item.etaDistance >= 0 ? `<i class="ti ti-clock" style="margin-right:6px"></i>${item.etaDistance} days left` : `<i class="ti ti-check" style="margin-right:6px"></i>Arrived`}
        </div>
      `;
      grid.appendChild(card);
    });
    container.innerHTML = '';
    container.appendChild(grid);
  } else {
    const grid = document.createElement('div');
    grid.className = 'shipment-stack';
    top5.forEach((item, i) => {
      const card = document.createElement('div');
      card.className = 'shipment-stack-row' + (clickable ? ' clickable' : '');
      card.innerHTML = `
        <div class="shipment-stack-brand">
          <span class="shipment-top5-brand">${item.brand}</span>
          <span class="shipment-stack-container">${item.containerType||'—'}</span>
          <span class="shipment-stack-rank">#${i+1}</span>
        </div>
        <div class="shipment-name" style="margin-bottom:8px;font-size:14px;font-weight:800">${item.shipmentName}</div>
        <div class="shipment-stack-vessel">${item.vessel||'—'}</div>
        <div class="shipment-stack-dates">
          <span>ETD: ${fmtDate(item.etd)}</span>
          <span>ATA Port: ${fmtDate(item.ataPort)}</span>
          <span>ATA WH: ${fmtDate(item.ataWarehouse)}</span>
        </div>
        <div class="shipment-stack-info" style="font-size:12px;color:var(--c-text-hint);padding:4px 0">
          <span>BL: ${item.noBl||'—'}</span>
          <span style="margin-left:12px">Liner: ${item.linerShipment||'—'}</span>
        </div>
        <div class="shipment-stack-countdown">
          ${item.etaDistance >= 0 ? `${item.etaDistance} days left` : 'Arrived'}
        </div>
      `;
      grid.appendChild(card);
    });
    container.innerHTML = '';
    if (top5.length) {
      const heading = document.createElement('div');
      heading.className = 'section-heading';
      heading.innerHTML = '<i class="ti ti-star"></i><span>Top Upcoming Shipments</span>';
      container.appendChild(heading);
    }
    container.appendChild(grid);
  }
}

// ── Calendar with navigation ───────────────────────────────────
function renderHomeCalendar() {
  const container = document.getElementById('home-calendar');
  if (!container) return;

  const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const DAY_NAMES   = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];

  // Build events map for this month
  const eventsByDate = {};
  MOCK_SHIPMENTS.forEach(item => {
    [
      { date: item.etd,          label: 'ETD',      type: 'etd'      },
      { date: item.ataPort,      label: 'ATA Port', type: 'ata-port' },
      { date: item.ataWarehouse, label: 'ATA WH',   type: 'ata-wh'  },
    ].forEach(ev => {
      if (!ev.date) return;
      if (!eventsByDate[ev.date]) eventsByDate[ev.date] = [];
      eventsByDate[ev.date].push({ ...ev, brand: item.brand, name: item.shipmentName });
    });
  });

  const today       = new Date();
  const todayStr    = today.toISOString().slice(0,10);
  const firstDay    = new Date(calendarYear, calendarMonth, 1);
  const startWD     = firstDay.getDay();
  const daysInMonth = new Date(calendarYear, calendarMonth+1, 0).getDate();

  let html = `
    <div class="calendar-card">
      <div class="calendar-header">
        <div style="display:flex;align-items:center;gap:10px">
          <button class="calendar-nav-btn" onclick="calendarPrev()"><i class="ti ti-chevron-left"></i></button>
          <span class="calendar-month-label">${MONTH_NAMES[calendarMonth]} ${calendarYear}</span>
          <button class="calendar-nav-btn" onclick="calendarNext()"><i class="ti ti-chevron-right"></i></button>
          <button class="calendar-nav-btn" onclick="calendarToday()" title="Back to this month" style="font-size:12px;font-weight:700;width:auto;padding:0 10px">Today</button>
        </div>
        <div class="calendar-legend">
          <span class="calendar-legend-item"><span class="calendar-dot dot-etd"></span> ETD (Keberangkatan)</span>
          <span class="calendar-legend-item"><span class="calendar-dot dot-ata-port"></span> ATA Port</span>
          <span class="calendar-legend-item"><span class="calendar-dot dot-ata-wh"></span> ATA Warehouse</span>
        </div>
      </div>
      <div class="calendar-body">
        <div class="calendar-grid">
  `;

  DAY_NAMES.forEach(d => { html += `<div class="calendar-day-name">${d}</div>`; });
  for (let i=0; i<startWD; i++) html += `<div class="calendar-cell calendar-cell-empty"></div>`;

  for (let d=1; d<=daysInMonth; d++) {
    const dateStr = `${calendarYear}-${String(calendarMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const events  = eventsByDate[dateStr] || [];
    const isToday = dateStr === todayStr;
    const hasEv   = events.length > 0;

    // Group pills by type
    const pills = events.slice(0,3).map(ev =>
      `<span class="calendar-event-pill pill-${ev.type}" title="${ev.name}: ${ev.label}">${ev.brand}</span>`
    ).join('');

    html += `
      <div class="calendar-cell ${isToday?'calendar-cell-today':''} ${hasEv?'calendar-cell-has-event clickable':''}"
           ${hasEv ? `onclick="switchTab('shipment')"` : ''}>
        <span class="calendar-cell-date">${d}</span>
        <div class="calendar-cell-events">${pills}</div>
      </div>
    `;
  }

  html += `</div></div></div>`;
  container.innerHTML = html;
}

function calendarPrev() {
  calendarMonth--;
  if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
  renderHomeCalendar();
}
function calendarNext() {
  calendarMonth++;
  if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
  renderHomeCalendar();
}
function calendarToday() {
  calendarYear  = new Date().getFullYear();
  calendarMonth = new Date().getMonth();
  renderHomeCalendar();
}

// ── Brand dropdown for shipment form ──────────────────────────
function renderBrandOptions() {
  const brands = ['KLAVUU','COSRX','ESPOIR','IMFROM','MAKE PREM','MEDIHEAL',
    'PPP (PUREPAWPAW)','RATEDGREEN','SUKIN','SUNGBOON EDITOR','TREECELL','LAKA'];
  const sel = document.getElementById('shipment-brand');
  if (!sel) return;
  brands.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b; opt.textContent = b;
    sel.appendChild(opt);
  });
  // add option to allow custom brand entry
  const other = document.createElement('option');
  other.value = '__other__'; other.textContent = 'Lainnya...';
  sel.appendChild(other);
}

// ── Mobile sidebar ────────────────────────────────────────────
function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('open');
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('today-date').textContent =
    new Date().toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' });

  ensureCurrentUser();
  updateKPI(getAllPoData());
  renderBrandOptions();
  renderPibHistory();

  // Currency prefix update
  const curSel = document.getElementById('pib-currency');
  if (curSel) curSel.addEventListener('change', updateCurrencyPrefix);

  // Enter key on search
  const poInput = document.getElementById('po-number');
  if (poInput) poInput.addEventListener('keydown', e => { if (e.key==='Enter') doSearch(); });

  switchTab('home');
  populateCiPoSelect();
  // show/hide custom brand input when user selects Other
  const brandSel = document.getElementById('shipment-brand');
  const brandCustom = document.getElementById('shipment-brand-custom');
  if (brandSel && brandCustom) {
    brandSel.addEventListener('change', () => {
      if (brandSel.value === '__other__') {
        brandCustom.style.display = 'block';
        brandCustom.focus();
      } else {
        brandCustom.style.display = 'none';
      }
    });
  }
});
// ══════════════════════════════════════════════════════════════
// VALUE RECONCILIATION — Purchase Order (Value PO) vs CI (Value CI)
// ══════════════════════════════════════════════════════════════
//
// Konsep:
//  1. User selects a saved PO (Value PO per item = Qty PO × Unit Price,
//     already calculated automatically when the PO was created).
//  2. User enters Value CI per item (from the Commercial Invoice / supplier document).
//  3. The system compares Value PO vs Value CI per item (and the total) →
//     producing a Match / Short / Excess status per SKU and overall per PO.
//  4. The reconciliation result can be saved as history.

// ── Data stores (in-memory) ──────────────────────────────────
let VR_RECORDS   = []; // [{id, poNumber, brand, currency, reconciledAt, rows:[{sku,name,qtyPO,unitPrice,valuePO,valueCI,diff,status}], totalValuePO, totalValueCI, totalDiff, status}]
let vrCurrentPoNumber = null;
let vrWorkingRows     = null; // rows currently being edited for the selected PO, before saving

function parseMoneyNum(v) {
  if (!v && v !== 0) return 0;
  const s = String(v).replace(/\s/g, '').replace(/[A-Za-z]/g, '');
  if (/^\d{1,3}(\.\d{3})+(?:,\d+)?$/.test(s)) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  }
  return parseFloat(s.replace(/,/g, '')) || 0;
}

// ── Bridge: pull Value CI (amount) from latest saved CI verification ──
// CI Verification reads Amount/Value/Total column from the uploaded CI file
// (see buildCiAgg) and stores it per row as `ciAmount`. This looks up the most
// recent saved CI verification for a PO and returns a sku/name -> amount map
// so Value Reconciliation can auto-fill "Value CI (input)" instead of the
// user re-typing everything by hand.
function getCiAmountMapForPo(poNumber) {
  const history = loadCiHistory()
    .filter(r => r.poNumber === poNumber)
    .sort((a, b) => new Date(b.verifiedAt) - new Date(a.verifiedAt));
  if (!history.length) return { map: {}, verifiedAt: null, fileName: null };

  const rec = history[0];
  const map = {};
  (rec.rows || []).forEach(r => {
    const val = r.valueCI != null ? r.valueCI : r.ciAmount;
    if (r.extraFromCi || !val) return;
    if (r.sku) map['sku:' + r.sku.toUpperCase()] = val;
    if (r.name) map['name:' + normStr(r.name)] = val;
  });
  return { map, verifiedAt: rec.verifiedAt, fileName: rec.fileName };
}

function lookupCiAmount(map, sku, name) {
  if (sku && map['sku:' + String(sku).toUpperCase()] != null) return map['sku:' + String(sku).toUpperCase()];
  if (name && map['name:' + normStr(name)] != null) return map['name:' + normStr(name)];
  return null;
}

// ── Init ──────────────────────────────────────────────────────
function initValRecon() {
  populateVrPoSelect();
  renderVrHistory();
  updateVrKpis();
  pmRefreshFilters();
}

// ══════════════════════════════════════════════════════════════
// PAYMENT PROOF MATCHING
// Match the value on the payment proof (can be full, a partial down payment, or
// combining several POs at once) with the Value PO / Value CI combination
// already in the system, via subset-sum search.
// ══════════════════════════════════════════════════════════════

// The "best" known Value CI for a PO:
// 1) saved Value Reconciliation result (most accurate — already checked manually)
// 2) if none yet, fall back to the total Amount/Value from the latest CI Verification
function getKnownValueCiForPo(poNumber) {
  // 1) Verifikasi CI (merged qty+value) — most current, edited inline
  const ciHist = loadCiHistory()
    .filter(r => r.poNumber === poNumber)
    .sort((a, b) => new Date(b.verifiedAt) - new Date(a.verifiedAt))[0];
  if (ciHist) {
    if (ciHist.totalValueCI > 0) return ciHist.totalValueCI;
    const sum = (ciHist.rows || []).reduce((s, r) => s + (r.valueCI != null ? r.valueCI : (r.ciAmount || 0)), 0);
    if (sum > 0) return sum;
  }

  // 2) Legacy standalone Value Reconciliation records (older data)
  const vr = VR_RECORDS
    .filter(r => r.poNumber === poNumber)
    .sort((a, b) => new Date(b.reconciledAt) - new Date(a.reconciledAt))[0];
  if (vr) return vr.totalValueCI;

  return null;
}

let pmSelectedProofId = null;

function getPoByNumber(poNumber) {
  return MOCK_PO_DATA.find(p => p.poNumber === poNumber) || null;
}

function getPaymentProofById(paymentId) {
  return (MOCK_PAYMENT_PROOFS || []).find(p => p.paymentId === paymentId) || null;
}

function pmFormatMoney(value, currency) {
  const num = Number(value) || 0;
  return `${currency || ''} ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

function pmRefreshFilters() {
  const search = (document.getElementById('pm-search')?.value || '').trim().toLowerCase();
  const currencySel = document.getElementById('pm-currency');
  const brandSel = document.getElementById('pm-brand');
  const statusSel = document.getElementById('pm-status');
  const dateSel = document.getElementById('pm-date');
  const countEl = document.getElementById('pm-result-count');
  const totalEl = document.getElementById('pm-kpi-total');
  const matchedEl = document.getElementById('pm-kpi-matched');
  const partialEl = document.getElementById('pm-kpi-partial');
  const unmatchedEl = document.getElementById('pm-kpi-unmatched');

  const currency = currencySel?.value || '';
  const brand = brandSel?.value || '';
  const status = statusSel?.value || '';
  const date = dateSel?.value || '';

  const proofs = (MOCK_PAYMENT_PROOFS || []).map(p => ({
    ...p,
    searchKey: `${p.paymentId} ${p.poNumber} ${p.ciNumber} ${p.brand}`.toLowerCase()
  }));

  const currencies = [...new Set(proofs.map(p => p.currency).filter(Boolean))].sort();
  const currentCurrency = currencySel?.value;
  if (currencySel) {
    currencySel.innerHTML = '<option value="">All Currencies</option>' + currencies.map(c => `<option value="${c}">${c}</option>`).join('');
    if (currencies.includes(currentCurrency)) currencySel.value = currentCurrency;
    else if (currencies.length === 1) currencySel.value = currencies[0];
  }

  const brands = [...new Set(proofs.map(p => p.brand).filter(Boolean))].sort();
  const currentBrand = brandSel?.value;
  if (brandSel) {
    brandSel.innerHTML = '<option value="">All Brands</option>' + brands.map(b => `<option value="${b}">${b}</option>`).join('');
    if (brands.includes(currentBrand)) brandSel.value = currentBrand;
  }

  const filtered = proofs.filter(p => {
    if (search && !p.searchKey.includes(search)) return false;
    if (currency && p.currency !== currency) return false;
    if (brand && p.brand !== brand) return false;
    if (status && p.status !== status) return false;
    if (date && p.paymentDate !== date) return false;
    return true;
  });

  const matchedCount = proofs.filter(p => p.status === 'matched').length;
  const partialCount = proofs.filter(p => p.status === 'partial').length;
  const unmatchedCount = proofs.filter(p => p.status === 'unmatched').length;
  if (totalEl) totalEl.textContent = proofs.length;
  if (matchedEl) matchedEl.textContent = matchedCount;
  if (partialEl) partialEl.textContent = partialCount;
  if (unmatchedEl) unmatchedEl.textContent = unmatchedCount;

  if (countEl) {
    countEl.textContent = filtered.length
      ? `Showing ${filtered.length} of ${proofs.length} payment proofs. Matched ${matchedCount}, Partial ${partialCount}, Unmatched ${unmatchedCount}.`
      : `No payment proof matches the filter. ${proofs.length} total available.`;
  }

  pmRenderPaymentProofList(filtered);

  if (pmSelectedProofId && !filtered.some(p => p.paymentId === pmSelectedProofId)) {
    pmSelectedProofId = null;
    const detailCard = document.getElementById('pm-detail-card');
    if (detailCard) detailCard.style.display = 'none';
  }
}

function pmRenderPaymentProofList(proofs) {
  const el = document.getElementById('pm-results');
  if (!el) return;
  if (!proofs.length) {
    el.innerHTML = `<div class="dash-alert-empty"><i class="ti ti-alert-circle"></i> No payment proof matches the current filter.</div>`;
    return;
  }

  const rows = proofs.map(p => `
      <tr>
        <td>${p.paymentId}</td>
        <td>${p.poNumber || '—'}</td>
        <td>${p.ciNumber || '—'}</td>
        <td>${p.brand || '—'}</td>
        <td>${p.currency || '—'}</td>
        <td class="num">${pmFormatMoney(p.amount, p.currency)}</td>
        <td>${p.status}</td>
        <td>${p.paymentDate || '—'}</td>
        <td style="white-space:nowrap"><button class="btn-ghost btn-sm" onclick="pmShowProofDetail('${p.paymentId}')">Detail</button></td>
      </tr>
    `).join('');

  el.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Payment ID</th>
            <th>PO Number</th>
            <th>CI Number</th>
            <th>Brand</th>
            <th>Currency</th>
            <th class="num">Amount</th>
            <th>Status</th>
            <th>Date</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// Shared renderer: full payment history for a PO as a 4-column table
// (No / Payment For / Amount / Attachment), so it's obvious which
// installment number a payment is out of the total. Used both by the
// search-result "Detail" button (highlights the clicked row) and by
// jumping in straight from History PO → Payment Proof.
function buildPaymentHistoryHtml(poNumber, highlightPaymentId) {
  const proofs = (MOCK_PAYMENT_PROOFS || []).filter(p => p.poNumber === poNumber);
  const po = getPoByNumber(poNumber);

  if (!proofs.length) {
    return `
      <div class="dash-alert-empty"><i class="ti ti-alert-circle"></i>
        No payment proof found yet for PO <strong>${poNumber}</strong>. Status: <strong>Not Yet Paid</strong>.
      </div>`;
  }

  const currency = proofs[0].currency || po?.currency || '';
  const totalPaid = proofs.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const poValue = po ? Number(po.poValue || 0) : null;
  const noPib = po?.pibNumber || ''; // detected from Compare PIB (applied to the PO)
  const valueCI = getKnownValueCiForPo(poNumber); // detected from Compare CI / CI Verification

  // Matching basis: Value CI is the source of truth once it's been verified;
  // fall back to PO Value only if Value CI isn't available yet.
  const hasValueCI = valueCI != null && valueCI > 0;
  const basisValue = hasValueCI ? valueCI : poValue;
  const basisLabel = hasValueCI ? 'Value CI' : 'PO Value (Value CI not verified yet)';

  let statusLabel, statusColor;
  if (basisValue != null && basisValue > 0) {
    if (totalPaid >= basisValue - 0.5) { statusLabel = 'Fully Paid'; statusColor = '#16a34a'; }
    else if (totalPaid > 0) { statusLabel = 'Partially Paid'; statusColor = '#f97316'; }
    else { statusLabel = 'Not Yet Paid'; statusColor = '#ef4444'; }
  } else {
    statusLabel = totalPaid > 0 ? 'Payment Recorded' : 'Not Yet Paid';
    statusColor = totalPaid > 0 ? '#16a34a' : '#ef4444';
  }

  const remaining = basisValue != null ? Math.max(basisValue - totalPaid, 0) : null;
  const sortedProofs = proofs.slice().sort((a, b) => (a.paymentDate || '').localeCompare(b.paymentDate || ''));
  const total = sortedProofs.length;

  const rows = sortedProofs.map((p, idx) => {
    const isHighlighted = p.paymentId === highlightPaymentId;
    return `
      <tr style="${isHighlighted ? 'background:rgba(37,99,235,.08)' : ''}">
        <td>${idx + 1} of ${total}</td>
        <td>
          <strong>${p.termLabel || 'Payment'}</strong>
          <div style="font-size:12px;color:var(--c-text-hint)">${fmtDate(p.paymentDate) || '—'} · ${p.bank || '—'} · Payment ID ${p.paymentId}</div>
          ${p.note ? `<div style="font-size:12px;color:var(--c-text-hint);margin-top:2px">${p.note}</div>` : ''}
        </td>
        <td class="num" style="color:#16a34a;font-weight:600">${pmFormatMoney(p.amount, p.currency)}</td>
        <td>
          ${p.attachment ? `
            <div style="cursor:pointer" onclick="openPaymentAttachment('${p.attachment}', '${(p.attachmentLabel || p.paymentId).replace(/'/g, "\\'")}')">
              <img src="${p.attachment}" alt="Payment proof" style="width:70px;border-radius:6px;border:1px solid var(--c-border);display:block" />
              <div style="font-size:11px;color:var(--c-blue);margin-top:3px;white-space:nowrap"><i class="ti ti-zoom-in"></i> View</div>
            </div>` : `
            <div style="width:70px;height:50px;border:1px dashed var(--c-border);border-radius:6px;display:flex;align-items:center;justify-content:center;color:var(--c-text-hint)">
              <i class="ti ti-photo-off"></i>
            </div>`}
        </td>
      </tr>`;
  }).join('');

  return `
    <div style="display:flex;flex-wrap:wrap;gap:20px;align-items:center;margin-bottom:6px">
      <div>
        <div style="font-size:12px;color:var(--c-text-hint)">PO Number</div>
        <div style="font-weight:600">${poNumber}</div>
      </div>
      <div>
        <div style="font-size:12px;color:var(--c-text-hint)">Brand</div>
        <div style="font-weight:600">${proofs[0].brand || po?.supplierLabel || '—'}</div>
      </div>
      <div>
        <div style="font-size:12px;color:var(--c-text-hint)">No. PIB <span style="font-weight:400">(Compare PIB)</span></div>
        <div style="font-weight:600">${noPib || '<span style="color:var(--c-text-hint);font-weight:400">Not detected yet</span>'}</div>
      </div>
      <div>
        <div style="font-size:12px;color:var(--c-text-hint)">Value CI <span style="font-weight:400">(Compare CI)</span></div>
        <div style="font-weight:600">${hasValueCI ? pmFormatMoney(valueCI, currency) : '<span style="color:var(--c-text-hint);font-weight:400">Not verified yet</span>'}</div>
      </div>
      ${poValue != null ? `
      <div>
        <div style="font-size:12px;color:var(--c-text-hint)">PO Value</div>
        <div style="font-weight:600">${pmFormatMoney(poValue, currency)}</div>
      </div>` : ''}
      <div>
        <div style="font-size:12px;color:var(--c-text-hint)">Total Paid</div>
        <div style="font-weight:600">${pmFormatMoney(totalPaid, currency)}</div>
      </div>
      ${remaining != null ? `
      <div>
        <div style="font-size:12px;color:var(--c-text-hint)">Remaining</div>
        <div style="font-weight:600">${pmFormatMoney(remaining, currency)}</div>
      </div>` : ''}
      <div style="margin-left:auto">
        <span style="display:inline-block;padding:5px 14px;border-radius:999px;font-size:12.5px;font-weight:600;color:#fff;background:${statusColor}">
          ${statusLabel}
        </span>
      </div>
    </div>
    <div style="font-size:12px;color:var(--c-text-hint);margin-bottom:14px">
      <i class="ti ti-info-circle"></i> Payment status is matched against <strong>${basisLabel}</strong>.
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>No</th>
            <th>Payment For</th>
            <th class="num">Amount</th>
            <th>Attachment</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function pmShowProofDetail(paymentId) {
  const proof = getPaymentProofById(paymentId);
  if (!proof) return;
  pmSelectedProofId = paymentId;
  const detailCard = document.getElementById('pm-detail-card');
  const detailContent = document.getElementById('pm-detail-content');
  if (!detailCard || !detailContent) return;
  detailCard.style.display = 'block';
  detailContent.innerHTML = buildPaymentHistoryHtml(proof.poNumber, paymentId);
}

// Straight PO → Payment status check: matches payment proofs strictly by
// PO Number (no fuzzy/amount matching) and reports whether that PO has
// been paid in full, partially, or not at all.
function pmShowPoPaymentStatus(poNumber) {
  const card = document.getElementById('pm-po-status-card');
  const content = document.getElementById('pm-po-status-content');
  if (!card || !content) return;
  card.style.display = 'block';
  content.innerHTML = buildPaymentHistoryHtml(poNumber, null);
}

function openPaymentAttachment(src, label) {
  const modal = document.getElementById('payment-attachment-modal');
  const img = document.getElementById('payment-attachment-img');
  const title = document.getElementById('payment-attachment-title');
  if (!modal || !img) return;
  img.src = src;
  if (title) title.textContent = label || 'Payment Proof';
  modal.style.display = 'block';
}

function closePaymentAttachment() {
  const modal = document.getElementById('payment-attachment-modal');
  if (modal) modal.style.display = 'none';
}

function populateVrPoSelect() {
  const sel = document.getElementById('vr-po-select');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">— Pilih PO Number —</option>';
  getAllPoData().forEach(po => {
    const opt = document.createElement('option');
    opt.value = po.poNumber;
    opt.textContent = `${po.poNumber} — ${po.supplierLabel || po.supplier || '—'}`;
    sel.appendChild(opt);
  });
  if (cur) sel.value = cur;
}

function vrFilterPoList() {
  const query = document.getElementById('vr-po-search')?.value.trim().toLowerCase() || '';
  const select = document.getElementById('vr-po-select');
  if (!select) return;
  select.innerHTML = '<option value="">— Pilih PO Number —</option>';
  getAllPoData().filter(po => {
    const target = `${po.poNumber} ${po.supplierLabel || po.supplier}`.toLowerCase();
    return !query || target.includes(query);
  }).forEach(po => {
    const option = document.createElement('option');
    option.value = po.poNumber;
    option.textContent = `${po.poNumber} — ${po.supplierLabel || po.supplier}`;
    select.appendChild(option);
  });
  if (vrCurrentPoNumber) select.value = vrCurrentPoNumber;
}

// ── Step 1: select PO ───────────────────────────────────────────
function vrSelectPo(poNumber) {
  vrCurrentPoNumber = poNumber || null;
  const detail = document.getElementById('vr-po-detail');
  const step2  = document.getElementById('vr-step2-card');

  if (!vrCurrentPoNumber) {
    if (detail) detail.style.display = 'none';
    if (step2)  step2.style.display  = 'none';
    return;
  }

  const po = (MOCK_PO_DATA || []).find(p => p.poNumber === vrCurrentPoNumber);
  if (!po) { if (detail) detail.style.display = 'none'; if (step2) step2.style.display = 'none'; return; }

  if (detail) {
    detail.style.display = 'block';
    const bar = document.getElementById('vr-po-info-bar');
    if (bar) {
      const totalValuePO = (po.items || []).reduce((s, i) => s + (Number(i.valuePO) || (Number(i.qtyPO)||0)*(Number(i.unitPrice)||0)), 0);
      bar.innerHTML = `
        <div class="ci-po-info-item"><span class="ci-po-info-label">PO Number</span><span class="ci-po-info-val" style="color:var(--c-blue-dark);font-weight:700">${po.poNumber}</span></div>
        <div class="ci-po-info-item"><span class="ci-po-info-label">Brand</span><span class="ci-po-info-val">${po.supplierLabel || po.supplier || '—'}</span></div>
        <div class="ci-po-info-item"><span class="ci-po-info-label">Currency</span><span class="ci-po-info-val">${po.currency || 'USD'}</span></div>
        <div class="ci-po-info-item"><span class="ci-po-info-label">Total Item</span><span class="ci-po-info-val">${(po.items || []).length} SKU</span></div>
        <div class="ci-po-info-item"><span class="ci-po-info-label">Total Value PO</span><span class="ci-po-info-val">${po.currency || ''} ${totalValuePO.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>
      `;
    }
  }

  // build working rows from PO items — try to reuse a previous reconciliation's Value CI input if it exists,
  // otherwise auto-fill from the Amount/Value column already read during CI Verification.
  const prevRecord  = VR_RECORDS.filter(r => r.poNumber === vrCurrentPoNumber).sort((a,b)=> new Date(b.reconciledAt)-new Date(a.reconciledAt))[0];
  const ciAmountInfo = getCiAmountMapForPo(vrCurrentPoNumber);
  let autoFilledCount = 0;

  vrWorkingRows = (po.items || []).map(it => {
    const qtyPO = Number(it.qtyPO || 0);
    const unitPrice = Number(it.unitPrice || 0);
    const valuePO = it.valuePO != null ? Number(it.valuePO) : qtyPO * unitPrice;
    const name = cleanItemName(it.name || '');
    const prevRow = prevRecord?.rows.find(r => r.sku === it.sku);

    let valueCI = prevRow ? prevRow.valueCI : null;
    let fromCi = false;
    if (valueCI == null) {
      const ciVal = lookupCiAmount(ciAmountInfo.map, it.sku, name);
      if (ciVal != null) { valueCI = ciVal; fromCi = true; autoFilledCount++; }
    }

    return {
      sku: it.sku || '', name, qtyPO, unitPrice, valuePO,
      valueCI, fromCi, diff: valueCI != null ? (valueCI - valuePO) : null,
    };
  });

  if (step2) step2.style.display = 'block';
  vrRenderReconTable();

  if (autoFilledCount > 0) {
    showToast(`✓ ${autoFilledCount} Value CI auto-filled from CI Verification${ciAmountInfo.fileName ? ' ('+ciAmountInfo.fileName+')' : ''}. Please review/edit as needed.`, 'success');
  }
}

function vrPasteCiValues() {
  if (!vrWorkingRows) return;
  vrWorkingRows.forEach(r => { if (r.valueCI == null) r.valueCI = r.valuePO; });
  vrRenderReconTable();
  showToast('Value CI filled with a placeholder (= Value PO). Please adjust to match the real CI data.', 'success');
}

// Manual re-pull button — useful if a CI Verification was saved *after* this
// PO was already opened in Value Reconciliation.
function vrPullFromCi() {
  if (!vrCurrentPoNumber || !vrWorkingRows) { showToast('Pilih PO terlebih dahulu.', 'error'); return; }
  const info = getCiAmountMapForPo(vrCurrentPoNumber);
  if (!Object.keys(info.map).length) {
    showToast('No Value CI data yet from CI Verification for this PO. Please run CI Verification first (Amount/Value column in the CI file).', 'warning');
    return;
  }
  let count = 0;
  vrWorkingRows.forEach(r => {
    const ciVal = lookupCiAmount(info.map, r.sku, r.name);
    if (ciVal != null) {
      r.valueCI = ciVal;
      r.diff = ciVal - r.valuePO;
      r.fromCi = true;
      count++;
    }
  });
  vrRenderReconTable();
  if (count > 0) showToast(`✓ ${count} Value CI item(s) pulled from CI Verification${info.fileName ? ' ('+info.fileName+')' : ''}.`, 'success');
  else showToast('No SKU/name matches the CI Verification data.', 'warning');
}

function vrRowStatus(row) {
  if (row.valueCI == null) return { status: 'pending', label: 'Not filled in' };
  const diff = row.diff;
  if (Math.abs(diff) < 0.005) return { status: 'match', label: 'Match' };
  if (diff < 0) return { status: 'kurang', label: 'Kurang' };
  return { status: 'lebih', label: 'Lebih' };
}

function vrStatusBadgeSmall(status, label) {
  const cls = status === 'match' ? 'badge-green' : status === 'kurang' ? 'badge-red' : status === 'lebih' ? 'badge-orange' : 'badge-gray';
  return `<span class="badge ${cls}">${label}</span>`;
}

function vrDiffCellHtml(r) {
  return r.valueCI == null ? '—' :
    Math.abs(r.diff) < 0.005 ? `<span class="sel-zero">0.00</span>` :
    r.diff > 0 ? `<span class="sel-pos">+${r.diff.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>` :
    `<span class="sel-neg">${r.diff.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>`;
}

// Refresh only the diff/status cells for one row (used while typing) — this
// deliberately avoids re-rendering the whole table on every keystroke, which
// was resetting the input's cursor/focus after every character typed.
function vrUpdateRowDisplay(idx) {
  const r = vrWorkingRows && vrWorkingRows[idx];
  if (!r) return;
  const diffCell   = document.getElementById(`vr-diff-${idx}`);
  const statusCell = document.getElementById(`vr-status-${idx}`);
  if (diffCell)   diffCell.innerHTML = vrDiffCellHtml(r);
  if (statusCell) { const { status, label } = vrRowStatus(r); statusCell.innerHTML = vrStatusBadgeSmall(status, label); }
}

function vrUpdateSummaryStrip() {
  const strip = document.getElementById('vr-summary-strip');
  if (!strip || !vrWorkingRows) return;
  const filled  = vrWorkingRows.filter(r => r.valueCI != null);
  const totalPO = vrWorkingRows.reduce((s, r) => s + r.valuePO, 0);
  const totalCI = filled.reduce((s, r) => s + r.valueCI, 0);
  const nMatch  = filled.filter(r => vrRowStatus(r).status === 'match').length;
  const nKurang = filled.filter(r => vrRowStatus(r).status === 'kurang').length;
  const nLebih  = filled.filter(r => vrRowStatus(r).status === 'lebih').length;
  strip.innerHTML = `
    <span class="ci-legend match">● Match: ${nMatch}</span>
    <span class="ci-legend kurang">● Kurang: ${nKurang}</span>
    <span class="ci-legend lebih">● Lebih: ${nLebih}</span>
    <span style="margin-left:auto;font-size:12px;color:var(--c-text-sub)">
      Total Value PO: <strong>${totalPO.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</strong>
      &nbsp;·&nbsp; Total Value CI (terisi): <strong>${totalCI.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</strong>
    </span>`;
}

// Called on every keystroke — parses the raw text, updates state + the
// diff/status cells only. The input box itself is left untouched so the
// user's cursor position and focus are never lost while typing.
function vrRecalcRow(idx) {
  const input = document.getElementById(`vr-ci-value-${idx}`);
  if (!input || !vrWorkingRows || !vrWorkingRows[idx]) return;
  const raw = input.value.trim();
  vrWorkingRows[idx].valueCI = raw === '' ? null : parseMoneyNum(raw);
  vrWorkingRows[idx].fromCi  = false; // manual edit supersedes any auto-fill
  vrWorkingRows[idx].diff    = vrWorkingRows[idx].valueCI != null ? (vrWorkingRows[idx].valueCI - vrWorkingRows[idx].valuePO) : null;
  vrUpdateRowDisplay(idx);
  vrUpdateSummaryStrip();
}

// On blur, normalise the textbox to a clean formatted number (e.g. 1200 -> 1,200.00)
function vrFormatValueInput(idx) {
  const input = document.getElementById(`vr-ci-value-${idx}`);
  if (!input || !vrWorkingRows || !vrWorkingRows[idx]) return;
  const r = vrWorkingRows[idx];
  input.value = r.valueCI != null ? r.valueCI.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) : '';
}

function vrRenderReconTable() {
  const tbody = document.getElementById('vr-recon-tbody');
  if (!tbody || !vrWorkingRows) return;

  tbody.innerHTML = vrWorkingRows.map((r, idx) => {
    const { status, label } = vrRowStatus(r);
    const fromCiTag = r.fromCi
      ? `<span title="Auto-filled from CI Verification — editable" style="color:var(--c-blue-dark);font-size:12px;margin-left:4px;white-space:nowrap"><i class="ti ti-wand"></i></span>`
      : '';
    return `
      <tr>
        <td style="font-family:monospace;font-size:12px">${r.sku || '—'}</td>
        <td>${r.name || '—'}</td>
        <td class="num">${r.qtyPO.toLocaleString()}</td>
        <td class="num">${r.unitPrice.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
        <td class="num"><strong>${r.valuePO.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></td>
        <td class="num">
          <input type="text" inputmode="decimal" id="vr-ci-value-${idx}"
              value="${r.valueCI != null ? r.valueCI.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) : ''}"
              placeholder="0.00" class="vr-ci-input" style="width:130px;text-align:right"
              oninput="vrRecalcRow(${idx})" onblur="vrFormatValueInput(${idx})" />${fromCiTag}
        </td>
        <td class="num" id="vr-diff-${idx}">${vrDiffCellHtml(r)}</td>
        <td id="vr-status-${idx}">${vrStatusBadgeSmall(status, label)}</td>
      </tr>`;
  }).join('');

  vrUpdateSummaryStrip();
}

// ── Save reconciliation ─────────────────────────────────────────
function vrSaveReconciliation() {
  if (!vrCurrentPoNumber || !vrWorkingRows) { showToast('Pilih PO terlebih dahulu.', 'error'); return; }
  if (vrWorkingRows.some(r => r.valueCI == null)) {
    if (!confirm('Some items still have no Value CI filled in. Save this reconciliation anyway?')) return;
  }

  const po = (MOCK_PO_DATA || []).find(p => p.poNumber === vrCurrentPoNumber);
  const rows = vrWorkingRows.map(r => ({ ...r }));
  const totalValuePO = rows.reduce((s, r) => s + r.valuePO, 0);
  const totalValueCI = rows.reduce((s, r) => s + (r.valueCI || 0), 0);
  const totalDiff = totalValueCI - totalValuePO;
  const statuses = rows.map(r => vrRowStatus(r).status).filter(s => s !== 'pending');
  const hasKurang = statuses.includes('kurang');
  const hasLebih  = statuses.includes('lebih');
  const overallStatus = Math.abs(totalDiff) < 0.005 && !hasKurang && !hasLebih ? 'match'
    : hasKurang && hasLebih ? 'mixed' : hasKurang ? 'kurang' : 'lebih';

  const record = {
    id: Date.now(),
    poNumber: vrCurrentPoNumber,
    brand: po ? (po.supplierLabel || po.supplier) : '—',
    currency: po?.currency || 'USD',
    reconciledAt: new Date().toISOString(),
    rows, totalValuePO, totalValueCI, totalDiff, status: overallStatus,
  };
  VR_RECORDS.unshift(record);

  renderVrHistory();
  updateVrKpis();
  logActivity(vrCurrentPoNumber, 'Value Reconciliation',
    `Value PO ${fmt(totalValuePO)} vs CI ${fmt(totalValueCI)}, selisih ${fmt(totalDiff)} (${overallStatus})`);
  showToast('✓ Value Reconciliation berhasil disimpan!', 'success');

  // Continue to Payment Proof Matching for the same PO
  setTimeout(() => {
    if (confirm('Reconciliation saved successfully. Continue to Payment Proof Detection (match against payment proof) for this PO?')) {
      goToPaymentMatchFromVr(record.poNumber, record.currency, record.brand);
    }
  }, 400);
}

// Dipanggil setelah Value Reconciliation disimpan — menyiapkan Payment Proof
// Matching for the PO that was just reconciled (basis: Value CI, currency
// & brand ikut PO tsb) lalu scroll ke sana supaya user tinggal isi nominal
// from the payment proof.
function goToPaymentMatchFromVr(poNumber, currency, brand) {
  const basisEl = document.getElementById('pm-basis');
  if (basisEl) basisEl.value = 'ci';
  pmRefreshFilters();

  const currencySel = document.getElementById('pm-currency');
  if (currencySel && currency && Array.from(currencySel.options).some(o => o.value === currency)) {
    currencySel.value = currency;
  }
  const brandSel = document.getElementById('pm-brand');
  if (brandSel && brand && Array.from(brandSel.options).some(o => o.value === brand)) {
    brandSel.value = brand;
  }

  const card = document.getElementById('vr-payment-match-card');
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => document.getElementById('pm-paid-value')?.focus(), 450);

  showToast(`Basis "Value CI" & Payment Matching filter prepared for ${poNumber}. Enter the value from the payment proof.`, 'success');
}

// ── History table ────────────────────────────────────────────
function vrStatusBadgeBig(status) {
  const map = { match: ['badge-green','Match'], kurang: ['badge-red','Kurang'], lebih: ['badge-orange','Lebih'], mixed: ['badge-blue','Mixed'] };
  const [cls, label] = map[status] || ['badge-gray', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

function renderVrHistory(filter = '', statusFilter = '') {
  const tbody = document.getElementById('vr-history-tbody');
  if (!tbody) return;
  const q = filter.toLowerCase();
  const data = VR_RECORDS.filter(r =>
    (!q || r.poNumber.toLowerCase().includes(q) || (r.brand||'').toLowerCase().includes(q)) &&
    (!statusFilter || r.status === statusFilter)
  );

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--c-text-hint)">No reconciliation saved yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(r => {
    const idx = VR_RECORDS.indexOf(r);
    const diffStr = Math.abs(r.totalDiff) < 0.005 ? `<span class="sel-zero">0.00</span>` :
      r.totalDiff > 0 ? `<span class="sel-pos">+${r.totalDiff.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>` :
      `<span class="sel-neg">${r.totalDiff.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>`;
    return `<tr>
      <td style="font-family:monospace;font-size:12px">${r.poNumber}</td>
      <td>${r.brand}</td>
      <td style="font-size:12px">${fmtDate(r.reconciledAt.slice(0,10))}</td>
      <td class="num">${r.totalValuePO.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
      <td class="num">${r.totalValueCI.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
      <td class="num">${diffStr}</td>
      <td>${vrStatusBadgeBig(r.status)}</td>
      <td><button class="btn-ghost btn-sm" onclick="vrShowDetail(${idx})"><i class="ti ti-eye"></i></button>
          <button class="btn-ghost btn-sm" onclick="vrDeleteRecord(${idx})"><i class="ti ti-trash" style="color:var(--c-red,#ef4444)"></i></button></td>
    </tr>`;
  }).join('');
}

function vrFilterHistory() {
  const q = document.getElementById('vr-history-search')?.value || '';
  const status = document.getElementById('vr-history-status-filter')?.value || '';
  renderVrHistory(q, status);
}

function vrDeleteRecord(idx) {
  const r = VR_RECORDS[idx];
  if (!r) return;
  if (!confirm(`Delete the reconciliation for PO ${r.poNumber}?`)) return;
  VR_RECORDS.splice(idx, 1);
  renderVrHistory();
  updateVrKpis();
  showToast('Rekonsiliasi dihapus.', 'success');
}

function vrShowDetail(idx) {
  const r = VR_RECORDS[idx];
  const content = document.getElementById('vr-detail-content');
  const modal = document.getElementById('vr-detail-modal');
  if (!r || !content || !modal) return;

  content.innerHTML = `
    <div class="ci-po-info-bar" style="margin-bottom:14px">
      <div class="ci-po-info-item"><span class="ci-po-info-label">PO Number</span><span class="ci-po-info-val" style="color:var(--c-blue-dark);font-weight:700">${r.poNumber}</span></div>
      <div class="ci-po-info-item"><span class="ci-po-info-label">Brand</span><span class="ci-po-info-val">${r.brand}</span></div>
      <div class="ci-po-info-item"><span class="ci-po-info-label">Direkonsiliasi</span><span class="ci-po-info-val">${fmtDate(r.reconciledAt.slice(0,10))}</span></div>
      <div class="ci-po-info-item"><span class="ci-po-info-label">Status</span><span class="ci-po-info-val">${vrStatusBadgeBig(r.status)}</span></div>
    </div>
    <div class="table-wrap" style="max-height:360px;overflow:auto">
      <table class="data-table">
        <thead><tr><th>SKU</th><th>Nama</th><th class="num">Qty PO</th><th class="num">Value PO</th><th class="num">Value CI</th><th class="num">Selisih</th><th>Status</th></tr></thead>
        <tbody>
          ${r.rows.map(row => {
            const { status, label } = vrRowStatus(row);
            const diffTxt = row.valueCI == null ? '—' :
              Math.abs(row.diff) < 0.005 ? `<span class="sel-zero">0.00</span>` :
              row.diff > 0 ? `<span class="sel-pos">+${row.diff.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>` :
              `<span class="sel-neg">${row.diff.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>`;
            return `<tr>
              <td style="font-family:monospace;font-size:12px">${row.sku || '—'}</td>
              <td>${row.name || '—'}</td>
              <td class="num">${row.qtyPO.toLocaleString()}</td>
              <td class="num">${row.valuePO.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
              <td class="num">${row.valueCI != null ? row.valueCI.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) : '—'}</td>
              <td class="num">${diffTxt}</td>
              <td>${vrStatusBadgeSmall(status, label)}</td>
            </tr>`;
          }).join('')}
          <tr class="total-row">
            <td colspan="3">Total</td>
            <td class="num"><strong>${r.totalValuePO.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></td>
            <td class="num"><strong>${r.totalValueCI.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></td>
            <td class="num"><strong>${r.totalDiff.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>`;
  modal.style.display = 'flex';
}

function vrCloseDetail() {
  const modal = document.getElementById('vr-detail-modal');
  if (modal) modal.style.display = 'none';
}

// ── KPIs ──────────────────────────────────────────────────────
function updateVrKpis() {
  const totalEl  = document.getElementById('vr-kpi-total');
  const matchEl  = document.getElementById('vr-kpi-match');
  const kurangEl = document.getElementById('vr-kpi-kurang');
  const lebihEl  = document.getElementById('vr-kpi-lebih');
  if (!totalEl) return;

  const allRows = VR_RECORDS.flatMap(r => r.rows).filter(r => r.valueCI != null);
  const nMatch  = allRows.filter(r => vrRowStatus(r).status === 'match').length;
  const nKurang = allRows.filter(r => vrRowStatus(r).status === 'kurang').length;
  const nLebih  = allRows.filter(r => vrRowStatus(r).status === 'lebih').length;

  totalEl.textContent  = VR_RECORDS.length;
  matchEl.textContent  = nMatch;
  kurangEl.textContent = nKurang;
  lebihEl.textContent  = nLebih;
}
// ══════════════════════════════════════════════════════════════
// NIE CENTER — Auto-Matching NIE BPOM for SKI
// ══════════════════════════════════════════════════════════════

// ── NIE Database (in-memory; production: SQLite/API) ──────────
let NIE_DB = []; // [{id, nie_number, product_name, brand, variant, sku, rev_code, file_name, date_added}]
let NIE_MATCH_RESULTS = []; // hasil matching CI vs NIE
let NIE_SETTINGS = { similarity_threshold: 80 };

// ── Seed demo NIE data ────────────────────────────────────────
function seedNieDemo() {
  if (NIE_DB.length) return;
  NIE_DB = [
    { id:1,  nie_number:'NA26251200644', product_name:"I'm from Rice Toner 30ml",      brand:"I'M FROM",  variant:'30ml',    sku:'IFSG936380_R100',    rev_code:'', file_name:'NIE_IFSG936380.pdf', date_added:'2025-01-10' },
    { id:2,  nie_number:'NA26210100307', product_name:"I'm from Rice Cream 50ml",      brand:"I'M FROM",  variant:'50ml',    sku:'IFSG936205_R100',    rev_code:'', file_name:'NIE_IFSG936205.pdf', date_added:'2025-01-10' },
    { id:3,  nie_number:'NA261234KEANA1', product_name:'KEANA Rice Pack 170gr',         brand:'KEANA',     variant:'170gr',   sku:'KAN.SC-MTNCM01170ALL1', rev_code:'KAN.SC-MTNCM01170ALL1', file_name:'NIE_KEANA_RICE_PACK.pdf', date_added:'2025-02-01' },
    { id:4,  nie_number:'NA261234KEANA2', product_name:'KEANA Rice Mask Box 28 Sheets', brand:'KEANA',     variant:'28pcs',   sku:'KAN.SC-KNRMLBS281',  rev_code:'KAN.SC-KNRMLBS281', file_name:'NIE_KEANA_RICE_MASK.pdf',  date_added:'2025-02-01' },
    { id:5,  nie_number:'NA261234KEANA3', product_name:'KEANA Rice Toner N 300ml',      brand:'KEANA',     variant:'300ml',   sku:'KAN.SC-RTNGS',       rev_code:'KAN.SC-RTNGS', file_name:'NIE_KEANA_TONER.pdf',       date_added:'2025-02-05' },
    { id:6,  nie_number:'NA261234KEANA4', product_name:'KEANA Rice Cream 30gr',         brand:'KEANA',     variant:'30gr',    sku:'KAN.SC-RCS',         rev_code:'KAN.SC-RCS', file_name:'NIE_KEANA_CREAM.pdf',         date_added:'2025-02-05' },
    { id:7,  nie_number:'NA261234KEANA5', product_name:'KEANA Tightening Mask',         brand:'KEANA',     variant:'10 Sheet',sku:'KAN.SC-TM1',         rev_code:'KAN.SC-TM1', file_name:'NIE_KEANA_TMASK.pdf',         date_added:'2025-02-10' },
    { id:8,  nie_number:'NA261234KEANA6', product_name:'KEANA Baking Soda Nose Cream Pack 15gr', brand:'KEANA', variant:'15gr', sku:'KAN.SC-KLMGM01P15ALL1', rev_code:'KAN.SC-KLMGM01P15ALL1', file_name:'NIE_KEANA_BSODA.pdf', date_added:'2025-02-10' },
    { id:9,  nie_number:'NA26210100308', product_name:'COSRX Advanced Snail Serum',    brand:'COSRX',     variant:'',        sku:'SKU010',             rev_code:'', file_name:'NIE_COSRX_SNAIL.pdf', date_added:'2025-03-01' },
    { id:10, nie_number:'NA26210100309', product_name:'ESPOIR Pro Tailor Foundation',  brand:'ESPOIR',    variant:'',        sku:'SKU020',             rev_code:'', file_name:'NIE_ESPOIR_FOUND.pdf', date_added:'2025-03-01' },
  ];
}

// ── Fuzzy similarity (simple token overlap) ───────────────────
function strSimilarity(a, b) {
  if (!a || !b) return 0;
  const norm = s => s.toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
  const tokensA = new Set(norm(a).split(' ').filter(t=>t.length>1));
  const tokensB = new Set(norm(b).split(' ').filter(t=>t.length>1));
  if (!tokensA.size || !tokensB.size) return 0;
  let common = 0;
  tokensA.forEach(t => { if (tokensB.has(t)) common++; });
  return Math.round((2 * common / (tokensA.size + tokensB.size)) * 100);
}

// ── Match single CI item against NIE_DB ───────────────────────
function matchNie(ciItem) {
  const results = [];
  const sku  = (ciItem.sku || ciItem.product_code || '').trim().toUpperCase();
  const reff = (ciItem.rev_code || ciItem.product_code || '').trim().toUpperCase();
  const name = (ciItem.name || ciItem.name_bpom || '').trim();

  NIE_DB.forEach(nie => {
    const nieSku  = (nie.sku || '').toUpperCase();
    const nieReff = (nie.rev_code || '').toUpperCase();
    const nieName = nie.product_name || '';
    let score = 0, method = '';

    // Priority 1: SKU exact
    if (sku && nieSku && sku === nieSku) { score = 100; method = 'SKU Exact'; }
    // Priority 2: Rev Code exact
    else if (reff && nieReff && reff === nieReff) { score = 100; method = 'Rev Code Exact'; }
    // Priority 3: Name exact
    else if (name && nieName.toLowerCase() === name.toLowerCase()) { score = 95; method = 'Name Exact'; }
    // Priority 4: Fuzzy name
    else if (name && nieName) {
      const sim = strSimilarity(name, nieName);
      if (sim >= NIE_SETTINGS.similarity_threshold) { score = sim; method = `Fuzzy (${sim}%)`; }
    }
    // Priority 5: Partial SKU (strip suffix S/1)
    if (!score && sku) {
      const baseSku = sku.replace(/[S1]$/,'');
      const baseNie = nieSku.replace(/[S1]$/,'');
      if (baseSku && baseSku === baseNie) { score = 90; method = 'SKU (base match)'; }
    }

    if (score > 0) results.push({ ...nie, _score: score, _method: method });
  });

  results.sort((a,b) => b._score - a._score);

  if (!results.length) return { status:'not-found', label:'Not Found', matches:[] };
  if (results.length === 1 || results[0]._score === 100) return { status:'match', label:'Match', matches:results };
  return { status:'multiple', label:'Multiple Match', matches:results };
}

// ── NIE matching badge ────────────────────────────────────────
function nieBadge(status) {
  const m = { match:'badge-green', multiple:'badge-yellow', 'not-found':'badge-red' };
  const l = { match:'✓ Match', multiple:'⚠ Multiple', 'not-found':'✗ Not Found' };
  return `<span class="badge ${m[status]||'badge-gray'}">${l[status]||status}</span>`;
}

// ── Init NIE Center ───────────────────────────────────────────
function initNieCenter() {
  seedNieDemo();
  renderNieDb();
  renderNieResults();
  // Init Google Drive (deferred — only loads when the user opens the NIE tab)
  setTimeout(() => initGdrive(), 500);
}

// ── Render NIE Database table ─────────────────────────────────
function renderNieDb(query = '') {
  const tbody = document.getElementById('nie-db-tbody');
  if (!tbody) return;
  const rows = query
    ? NIE_DB.filter(n => [n.nie_number,n.product_name,n.brand,n.sku,n.rev_code].some(f=>(f||'').toLowerCase().includes(query.toLowerCase())))
    : NIE_DB;
  document.getElementById('nie-db-count').textContent = `${NIE_DB.length} NIE`;
  tbody.innerHTML = rows.map((n,i) => `<tr>
    <td style="font-family:monospace;font-size:12px;color:var(--c-blue-dark)">${n.nie_number}</td>
    <td style="font-size:13px">${n.product_name}</td>
    <td style="font-size:12px">${n.brand||'—'}</td>
    <td style="font-size:12px;color:var(--c-text-hint)">${n.variant||'—'}</td>
    <td style="font-family:monospace;font-size:11px">${n.sku||'—'}</td>
    <td style="font-size:12px;color:var(--c-text-hint)">${n.file_name||'—'}</td>
    <td><button class="btn-ghost btn-sm" onclick="nieDeleteRow(${i})" title="Hapus"><i class="ti ti-trash" style="color:#ef4444"></i></button></td>
  </tr>`).join('') || `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--c-text-hint)">No NIE data yet.</td></tr>`;
}

function nieDeleteRow(idx) {
  if (!confirm('Delete this NIE from the database?')) return;
  NIE_DB.splice(idx,1);
  renderNieDb();
  showToast('NIE dihapus.','success');
}

// ── Add NIE manually ──────────────────────────────────────────
function nieAddManual() {
  const nie  = document.getElementById('nie-add-nie')?.value.trim();
  const name = document.getElementById('nie-add-name')?.value.trim();
  const brand= document.getElementById('nie-add-brand')?.value.trim();
  const vari = document.getElementById('nie-add-variant')?.value.trim();
  const sku  = document.getElementById('nie-add-sku')?.value.trim();
  const reff = document.getElementById('nie-add-reff')?.value.trim();
  const file = document.getElementById('nie-add-file')?.value.trim();
  if (!nie || !name) { showToast('NIE Number and Product Name are required.','error'); return; }
  NIE_DB.push({ id: Date.now(), nie_number:nie, product_name:name, brand, variant:vari, sku, rev_code:reff, file_name:file, date_added: new Date().toISOString().slice(0,10) });
  ['nie-add-nie','nie-add-name','nie-add-brand','nie-add-variant','nie-add-sku','nie-add-reff','nie-add-file'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  renderNieDb();
  showToast('NIE berhasil ditambahkan.','success');
}

// ── Upload CI for NIE matching ────────────────────────────────
async function handleNieCiUpload(file) {
  if (!file) return;
  const loadEl = document.getElementById('nie-ci-loading');
  const dropEl = document.getElementById('nie-ci-drop-content');
  dropEl.style.display = 'none';
  if (loadEl) loadEl.style.display = 'block';

  try {
    const ext = file.name.split('.').pop().toLowerCase();
    let ciItems = [];

    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
      // Excel: use parseCiExcel if available, else XLSX directly
      const ab = await file.arrayBuffer();
      const wb = window.XLSX.read(ab, { type:'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = window.XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
      // Find header row
      let hdrIdx = -1, hdrs = [];
      const KW = ['name','sku','code','qty','quantity','nie','product','rev'];
      for (let i=0; i<Math.min(rows.length,15); i++) {
        const r = rows[i].map(c=>String(c).toLowerCase());
        if (r.filter(c=>KW.some(k=>c.includes(k))).length >= 2) { hdrIdx=i; hdrs=rows[i].map(c=>String(c).trim()); break; }
      }
      const mapH = h => {
        const l=h.toLowerCase();
        if (/sku|code|reff|item/i.test(l)) return 'sku';
        if (/name|produk|deskripsi/i.test(l)) return 'name';
        if (/qty|quan/i.test(l)) return 'qty';
        return null;
      };
      const colMap = hdrs.map(mapH);
      if (hdrIdx>=0) {
        for (let i=hdrIdx+1; i<rows.length; i++) {
          const r=rows[i];
          const name=String(r[colMap.indexOf('name')]||'').trim();
          if (!name || /total|grand/i.test(name)) continue;
          ciItems.push({ sku:String(r[colMap.indexOf('sku')]||'').trim(), name, qty:Number(r[colMap.indexOf('qty')]||0) });
        }
      }
    } else {
      // PDF: first check whether this is an NIE Cover Letter (not a regular CI)
      const pdfText = await extractTextFromPdf(file);
      const suratResult = parseSuratPengantarNie(pdfText);

      if (suratResult && suratResult.items && suratResult.items.length > 0) {
        // ── Format Surat Pengantar — ekstrak NIE langsung, tambah ke NIE_DB ──
        const newNies = [];
        suratResult.items.forEach(item => {
          const exists = NIE_DB.find(n => n.nie_number === item.nie_number);
          if (!exists && item.nie_number) {
            const newEntry = {
              id: Date.now() + Math.random(),
              nie_number: item.nie_number,
              product_name: item.product_name || '',
              brand: '',
              variant: '',
              sku: '',
              rev_code: '',
              file_name: file.name,
              date_added: new Date().toISOString().slice(0,10),
              _source: 'surat_pengantar',
              _no_surat: suratResult.no_surat || '',
              _invoice: suratResult.invoice_ref || '',
            };
            NIE_DB.push(newEntry);
            newNies.push(newEntry);
          }
        });

        renderNieDb();
        if (loadEl) loadEl.style.display = 'none';
        dropEl.style.display = 'block';
        document.getElementById('nie-ci-result-info').style.display = 'flex';
        document.getElementById('nie-ci-result-text').textContent =
          `${file.name} — Surat Pengantar · ${suratResult.items.length} NIE ditemukan · ${newNies.length} ditambahkan ke database`;

        // Tampilkan panel ringkasan Surat Pengantar
        const oldPanel = document.getElementById('surat-pengantar-panel');
        if (oldPanel) oldPanel.remove();
        const panel = document.createElement('div');
        panel.id = 'surat-pengantar-panel';
        panel.style.cssText = 'margin-top:14px;padding:14px 16px;background:var(--c-green-bg,rgba(22,163,74,.06));border:1px solid var(--c-green-border,rgba(22,163,74,.2));border-radius:8px;font-size:13px;';
        panel.innerHTML = `
          <div style="font-weight:700;color:var(--c-green-dark,#15803d);margin-bottom:8px">
            <i class="ti ti-file-check"></i> Surat Pengantar NIE Terdeteksi
          </div>
          ${suratResult.no_surat ? `<div style="font-size:12px;color:var(--c-text-hint)">No Surat: <strong>${suratResult.no_surat}</strong></div>` : ''}
          ${suratResult.invoice_ref ? `<div style="font-size:12px;color:var(--c-text-hint)">Invoice: <strong>${suratResult.invoice_ref}</strong></div>` : ''}
          <div style="margin-top:10px">
            ${suratResult.items.map(item => `
              <div style="display:flex;gap:10px;align-items:flex-start;padding:6px 0;border-bottom:0.5px solid rgba(22,163,74,.15)">
                <span style="font-family:monospace;font-weight:700;color:var(--c-green-dark,#15803d);font-size:13px;min-width:140px">${item.nie_number}</span>
                <span style="font-size:13px;color:var(--c-text-sub)">${item.product_name || '—'}</span>
                ${item.qty ? `<span style="font-size:12px;color:var(--c-text-hint);margin-left:auto">${item.qty.toLocaleString()} pcs</span>` : ''}
              </div>`).join('')}
          </div>
          ${newNies.length > 0 ? `
          <div style="margin-top:10px;padding-top:8px;font-size:12px;color:var(--c-green-dark,#15803d);font-weight:600">
            ✓ ${newNies.length} NIE baru berhasil ditambahkan ke database
          </div>` : `<div style="margin-top:8px;font-size:12px;color:var(--c-text-hint)">All NIEs are already in the database.</div>`}
          ${newNies.length > 0 ? `
          <button class="btn-primary btn-sm" style="margin-top:10px" onclick="gdriveSearchByNieNumbers(${JSON.stringify(suratResult.items.map(i=>i.nie_number))})">
            <i class="ti ti-brand-google-drive"></i> Search for This NIE File in Google Drive
          </button>` : ''}`;
        document.getElementById('nie-ci-drop').appendChild(panel);

        showToast(`✓ Surat Pengantar: ${suratResult.items.length} NIE — ${newNies.length} ditambah ke DB`, 'success');

        // ── Auto-search Google Drive if already logged in ──────────
        if (gdriveAccessToken) {
          const nieNumbers = suratResult.items.map(i => i.nie_number).filter(Boolean);
          if (nieNumbers.length) {
            showToast(`🔍 Mencari ${nieNumbers.length} file NIE di Google Drive…`, '');
            // Scroll ke gdrive panel dulu
            const driveCard = document.getElementById('gdrive-panel');
            if (driveCard) {
              driveCard.style.display = 'block';
              driveCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            // Delay sedikit biar scroll selesai dulu
            setTimeout(() => gdriveSearchByNieNumbers(nieNumbers), 600);
          }
        } else {
          // Not logged in yet: save to pending, scroll to the gdrive panel, prompt user to log in
          const nieNumbers = suratResult.items.map(i => i.nie_number).filter(Boolean);
          gdrivePendingNieSearch = nieNumbers;
          showToast('Log in to Google Drive to search for NIE files automatically. Results will appear after logging in.', 'warning');
          const driveCard = document.getElementById('gdrive-panel');
          if (driveCard) {
            driveCard.style.display = 'block';
            driveCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
        return;
      }

      // Format CI biasa (bukan Surat Pengantar)
      try {
        const parsed = await parseCiWithAI(pdfText);
        ciItems = (parsed.items||[]).map(it=>({ sku:it.product_code||'', name:it.name||it.name_bpom||'', qty:it.qty||0 }));
      } catch(e) {
        // Heuristic: find [...SKU...] patterns
        const matches = [...pdfText.matchAll(/\[([^\]]+)\]\s+([^\[\n]+?)(?:\s+\d+\s+Units)/gi)];
        ciItems = matches.map(m=>({ sku:m[1].trim(), name:m[2].trim(), qty:0 }));
      }
    }

    if (!ciItems.length) { showToast('No items could be read from the CI.','error'); return; }

    // Run matching
    NIE_MATCH_RESULTS = ciItems.map(item => {
      const result = matchNie(item);
      return { ...item, ...result, topMatch: result.matches[0]||null };
    });

    renderNieResults();
    document.getElementById('nie-results-section').style.display = 'block';
    document.getElementById('nie-ci-result-info').style.display = 'flex';
    document.getElementById('nie-ci-result-text').textContent = `${file.name} — ${ciItems.length} item diproses`;
    const matched = NIE_MATCH_RESULTS.filter(r=>r.status==='match').length;
    const multi   = NIE_MATCH_RESULTS.filter(r=>r.status==='multiple').length;
    const notfound= NIE_MATCH_RESULTS.filter(r=>r.status==='not-found').length;
    showToast(`Matching selesai: ${matched} Match · ${multi} Multiple · ${notfound} Not Found`, 'success');
    // Update KPIs
    document.getElementById('nie-kpi-total').textContent  = ciItems.length;
    document.getElementById('nie-kpi-match').textContent  = matched;
    document.getElementById('nie-kpi-multi').textContent  = multi;
    document.getElementById('nie-kpi-miss').textContent   = notfound;

  } catch(err) {
    showToast('Gagal memproses CI: '+err.message,'error');
  } finally {
    if (loadEl) loadEl.style.display = 'none';
    dropEl.style.display = 'block';
  }
}

// ── Render matching results ───────────────────────────────────
function renderNieResults(filterStatus = '') {
  const tbody = document.getElementById('nie-result-tbody');
  if (!tbody) return;
  const rows = filterStatus ? NIE_MATCH_RESULTS.filter(r=>r.status===filterStatus) : NIE_MATCH_RESULTS;
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--c-text-hint)">Upload a CI to see the NIE matching results.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((r,i) => {
    const top = r.topMatch;
    return `<tr>
      <td style="font-family:monospace;font-size:12px;color:var(--c-blue-dark)">${r.sku||'—'}</td>
      <td style="font-size:13px">${r.name||'—'}</td>
      <td class="num" style="font-size:12px">${r.qty||0}</td>
      <td style="font-family:monospace;font-size:12px;color:${top?'var(--c-green-dark,#15803d)':'#ef4444'};font-weight:500">${top?.nie_number||'—'}</td>
      <td style="font-size:12px">${top?.product_name||'—'}</td>
      <td>${nieBadge(r.status)}${r.status==='multiple'?`<div style="font-size:10px;color:var(--c-text-hint);margin-top:2px">${r.matches.length} kandidat</div>`:''}</td>
      <td>
        ${r.status==='multiple'?`<button class="btn-ghost btn-sm" onclick="nieShowCandidates(${i})"><i class="ti ti-list-search"></i> Pilih</button>`:''}
        ${top?.file_name?`<span style="font-size:11px;color:var(--c-text-hint)">${top.file_name}</span>`:''}
      </td>
    </tr>`;
  }).join('');
}

function nieShowCandidates(idx) {
  const r = NIE_MATCH_RESULTS[idx];
  if (!r) return;
  const list = r.matches.map(m=>`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:0.5px solid var(--c-border)">
    <div style="flex:1">
      <div style="font-weight:500;font-size:13px">${m.nie_number}</div>
      <div style="font-size:12px;color:var(--c-text-hint)">${m.product_name} ${m.variant?'· '+m.variant:''}</div>
      <div style="font-size:11px;color:var(--c-text-hint)">${m._method} · ${m._score}%</div>
    </div>
    <button class="btn-primary btn-sm" onclick="nieSelectCandidate(${idx},${m.id})">Pilih</button>
  </div>`).join('');
  const modal = document.getElementById('nie-candidate-modal');
  document.getElementById('nie-candidate-content').innerHTML = `
    <div style="font-size:13px;color:var(--c-text-hint);margin-bottom:12px">Item: <strong>${r.name}</strong> (${r.sku})</div>
    ${list}`;
  modal.style.display = 'flex';
}

function nieSelectCandidate(itemIdx, nieId) {
  const r = NIE_MATCH_RESULTS[itemIdx];
  const nie = NIE_DB.find(n=>n.id===nieId);
  if (!r || !nie) return;
  r.status = 'match'; r.label = 'Match (Manual)';
  r.topMatch = { ...nie, _score:100, _method:'Manual Select' };
  r.matches = [r.topMatch];
  document.getElementById('nie-candidate-modal').style.display = 'none';
  renderNieResults();
  showToast('NIE berhasil dipilih.','success');
}

function nieCopyAllNie() {
  // Try paste textarea first, then SKI items, then match results
  const pasteVal  = document.getElementById('nie-paste-input')?.value?.trim() || '';
  const pasteNies = parsePastedNie(pasteVal);
  if (pasteNies.length) {
    navigator.clipboard.writeText(pasteNies.join('\n'))
      .then(() => showToast(`${pasteNies.length} Nomor NIE disalin.`, 'success'));
    return;
  }
  const skiNies = [...new Set((window.NIE_SKI_ITEMS||[]).map(i=>i.nie_number).filter(Boolean))];
  if (skiNies.length) {
    navigator.clipboard.writeText(skiNies.join('\n'))
      .then(() => showToast(`${skiNies.length} Nomor NIE disalin.`, 'success'));
    return;
  }
  const matched = NIE_MATCH_RESULTS.filter(r=>r.topMatch).map(r=>r.topMatch.nie_number);
  if (!matched.length) { showToast('No NIEs yet. Upload an SKI or paste NIEs first.','error'); return; }
  navigator.clipboard.writeText(matched.join('\n')).then(()=>showToast(`${matched.length} Nomor NIE disalin.`,'success'));
}

function nieExportExcel() {
  if (!NIE_MATCH_RESULTS.length) { showToast('No data to export.','error'); return; }
  const data = [['SKU/Rev Code','Nama Produk CI','Qty','Nomor NIE','Nama Produk NIE','Status','File NIE','Metode Match']];
  NIE_MATCH_RESULTS.forEach(r => {
    data.push([r.sku||'', r.name||'', r.qty||0, r.topMatch?.nie_number||'NOT FOUND', r.topMatch?.product_name||'', r.label||r.status, r.topMatch?.file_name||'', r.topMatch?._method||'']);
  });
  const ws = window.XLSX.utils.aoa_to_sheet(data);
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, 'NIE Matching');
  window.XLSX.writeFile(wb, `NIE_Matching_${new Date().toISOString().slice(0,10)}.xlsx`);
  showToast('Export Excel selesai.','success');
}

function nieFilterResults() {
  const f = document.getElementById('nie-result-filter')?.value || '';
  renderNieResults(f);
}

function nieSearchDb() {
  const q = document.getElementById('nie-db-search')?.value || '';
  renderNieDb(q);
}

// ── Parser Surat Pengantar NIE (format surat resmi SBI) ──────
// Document: application letter to BPOM with a table containing a "No. Notifikasi" column
// Contoh kolom: No | Nama Produk | Kemasan | No Bets | Jumlah | No Invoice | Negara | No HS | Nilai | No. Notifikasi
function parseSuratPengantarNie(pdfText) {
  const lines = pdfText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const results = [];

  // Detect whether this is a Cover Letter format: look for a distinctive keyword
  const isSuratPengantar =
    /Surat\s*Keterangan\s*Impor/i.test(pdfText) ||
    /Permohonan\s*Surat\s*Keterangan\s*Impor/i.test(pdfText) ||
    /No\.\s*Notifikasi/i.test(pdfText) ||
    /Badan\s*Pengawas(an)?\s*Obat\s*dan\s*Makanan/i.test(pdfText);

  if (!isSuratPengantar) return null; // not this format

  // Find the table block: identify rows containing an NIE number (pattern NAxxxxxxxx)
  // NIE BPOM pola: NA + 11 digit angka, e.g. NA22210200046
  const niePattern = /\b(NA\d{11,14})\b/g;
  const allNieMatches = [...pdfText.matchAll(niePattern)];
  const uniqueNie = [...new Set(allNieMatches.map(m => m[1]))];

  // For each NIE, find the nearest product name in the preceding rows
  // Strategy: scan the rows to find the table
  let tableStartIdx = -1;
  let headerCols = [];
  const COL_KEYWORDS = ['nama produk', 'no notifikasi', 'notifikasi', 'nilai', 'jumlah', 'kemasan', 'no hs', 'invoice'];

  // Cari header baris tabel
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].toLowerCase();
    const hits = COL_KEYWORDS.filter(k => l.includes(k));
    if (hits.length >= 2) {
      tableStartIdx = i;
      headerCols = lines[i].toLowerCase().split(/\s{2,}|\t/).map(c => c.trim());
      break;
    }
  }

  if (tableStartIdx >= 0 && uniqueNie.length > 0) {
    // Parse baris data tabel setelah header
    // In the Cover Letter, each product row has: no, product name, packaging, batch no, quantity, invoice no, country, HS no, value, NIE
    // PDF extractor sering memisah kolom per baris, jadi kita scan area tabel
    const tableLines = lines.slice(tableStartIdx + 1);
    let currentProduct = null;
    let productBuffer = [];

    tableLines.forEach(line => {
      // Check whether this row is a table row number (starts with digit)
      const rowNumMatch = line.match(/^(\d+)$/);
      const nieMatch = line.match(/(NA\d{11,14})/);
      const qtyMatch = line.match(/^\d{1,5}$/);
      const valueMatch = line.match(/^[¥¢][\d.,]+$/);
      const hsMatch = line.match(/^\d{4}\.\d{2}\.\d{2}/);

      // Product name: a row that isn't a pure number, isn't a code, and is long enough
      const isProductName = line.length > 3 && !/^\d+$/.test(line) && !nieMatch && !hsMatch && !valueMatch;

      productBuffer.push(line);

      // When we find an NIE on this row, collect the data
      if (nieMatch) {
        const nie_number = nieMatch[1];
        // Find the product name from the buffer: find the row most likely to be a product name
        const productLine = productBuffer
          .slice(-8) // 8 baris terakhir sebelum NIE
          .filter(l => l.length > 3 && !/^\d+$/.test(l) && !/(NA\d{11})/.test(l) && !/^[¥¢]/.test(l) && !/^\d{4}\.\d{2}/.test(l) && !/^Japan|China|Korea/i.test(l) && !/^IZ-SO/i.test(l))
          .filter(l => /(Pack|Mask|Toner|Cream|Serum|Lotion|Wash|Foam|Gel|Oil|Essence)/i.test(l) || /Keana|COSRX|ESPOIR|KLAVUU/i.test(l));

        const product_name = productLine.length > 0 ? productLine[productLine.length - 1].trim() : '';

        // Cari qty (angka kecil standalone)
        const qtyLines = productBuffer.slice(-8).filter(l => /^\d{1,5}$/.test(l) && parseInt(l) > 0 && parseInt(l) < 100000);
        const qty = qtyLines.length > 0 ? parseInt(qtyLines[qtyLines.length - 1]) : 0;

        // Cari nilai JPY
        const valLine = productBuffer.slice(-8).find(l => /[¥¢][\d.,]+/.test(l) || /[\d]{1,3}\.[\d]{3}\.[\d]{3}/.test(l));
        const valMatch = valLine ? (valLine.match(/[\d.,]+/) || [])[0] : null;

        results.push({
          nie_number,
          product_name,
          qty,
          hs_code: productBuffer.slice(-8).find(l => /^\d{4}\.\d{2}\.\d{2}/.test(l)) || '',
          nilai_jpy: valMatch ? valMatch.replace(/\./g,'') : '',
        });
        productBuffer = [];
      }
    });

    // Fallback: if the table can't be parsed properly, just use the NIEs that were found
    if (!results.length && uniqueNie.length > 0) {
      uniqueNie.forEach(nie => results.push({ nie_number: nie, product_name: '', qty: 0 }));
    }
  } else if (uniqueNie.length > 0) {
    // Minimal: hanya daftar NIE tanpa nama produk
    uniqueNie.forEach(nie => results.push({ nie_number: nie, product_name: '', qty: 0 }));
  }

  // Extract metadata surat
  const noSuratMatch = pdfText.match(/No\s*Surat\s*[:\s]*([A-Z0-9\/]+\/[A-Z0-9\/]+)/i);
  const tglMatch = pdfText.match(/Tanggal\s*[:\s]*(\d{1,2}\s+\w+\s+\d{4})/i);
  const invoiceMatch = pdfText.match(/(IZ-SO-\d{2}-\d{2,3})/i);

  return {
    _type: 'surat_pengantar',
    no_surat: noSuratMatch ? noSuratMatch[1] : null,
    tanggal: tglMatch ? tglMatch[1] : null,
    invoice_ref: invoiceMatch ? invoiceMatch[1] : null,
    items: results,
  };
}

// ══════════════════════════════════════════════════════════════
// GOOGLE DRIVE INTEGRATION — NIE File Finder
// Menggunakan Google Drive API + Picker API (OAuth browser, no backend needed)
// User cukup login Google sekali, lalu sistem bisa search file NIE di Drive
// ══════════════════════════════════════════════════════════════

// Config — fill in with your Google Cloud Project credentials
// For setup: https://console.cloud.google.com → Enable Drive API + Picker API
const GDRIVE_CONFIG = {
  // Replace with the Client ID from your Google Cloud Console
  CLIENT_ID: '48077672390-etdopmmsuhucb3j1o6gu5erdi9iaehan.apps.googleusercontent.com',  // e.g. '123456789-xxxxx.apps.googleusercontent.com'
  // API Key for the Drive API (public, not secret)
  API_KEY: 'AIzaSyAYDAGPmseu6YfNbXlOZhgG6SlvlbiHHgY',    // e.g. 'AIzaSyXXXXXXXXXXXXXXXXXXX'
  SCOPES: 'https://www.googleapis.com/auth/drive.readonly',
  DISCOVERY_DOCS: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
};

let gdriveTokenClient = null;
let gdriveAccessToken = null;
let gdriveInitialized = false;
let gdriveSearchResults = []; // [{id, name, mimeType, webViewLink, modifiedTime}]
let gdriveSelectedFiles = new Set(); // file IDs selected for download
let gdrivePendingNieSearch = null; // NIE numbers from the cover-letter upload not yet searched (waiting for login)

// ── Init Google Drive ─────────────────────────────────────────
async function initGdrive() {
  if (!GDRIVE_CONFIG.CLIENT_ID || !GDRIVE_CONFIG.API_KEY) {
    showToast('Google Drive is not configured yet. Fill in CLIENT_ID and API_KEY in app.js.', 'warning');
    document.getElementById('gdrive-status-badge').textContent = '⚠ Not Configured';
    document.getElementById('gdrive-status-badge').className = 'badge badge-orange';
    return;
  }

  try {
    // Load Google Identity Services
    await loadGoogleScript('https://accounts.google.com/gsi/client');
    await loadGoogleScript('https://apis.google.com/js/api.js');

    await new Promise((res, rej) => {
      gapi.load('client', { callback: res, onerror: rej });
    });

    await gapi.client.init({
      apiKey: GDRIVE_CONFIG.API_KEY,
      discoveryDocs: GDRIVE_CONFIG.DISCOVERY_DOCS,
    });

    gdriveTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GDRIVE_CONFIG.CLIENT_ID,
      scope: GDRIVE_CONFIG.SCOPES,
      callback: (resp) => {
        if (resp.error) { showToast('Auth Google gagal: ' + resp.error, 'error'); return; }
        gdriveAccessToken = resp.access_token;
        gapi.client.setToken({ access_token: gdriveAccessToken });
        updateGdriveStatus(true);
        showToast('✓ Terhubung ke Google Drive!', 'success');
      },
    });

    gdriveInitialized = true;
    document.getElementById('gdrive-status-badge').textContent = '○ Not Logged In';
    document.getElementById('gdrive-status-badge').className = 'badge badge-gray';
    document.getElementById('gdrive-connect-btn').style.display = 'inline-flex';
  } catch (err) {
    console.error('GDrive init error:', err);
    document.getElementById('gdrive-status-badge').textContent = '✗ Error Init';
    document.getElementById('gdrive-status-badge').className = 'badge badge-red';
  }
}

function loadGoogleScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

function gdriveLogin() {
  if (!gdriveInitialized) { initGdrive(); return; }
  gdriveTokenClient.requestAccessToken({ prompt: '' });
}

function gdriveLogout() {
  if (gdriveAccessToken) {
    google.accounts.oauth2.revoke(gdriveAccessToken, () => {});
    gdriveAccessToken = null;
    gapi.client.setToken(null);
  }
  updateGdriveStatus(false);
  gdriveSearchResults = [];
  renderGdriveResults([]);
  showToast('Logged out of Google Drive.', 'success');
}

function updateGdriveStatus(connected) {
  const badge = document.getElementById('gdrive-status-badge');
  const connectBtn = document.getElementById('gdrive-connect-btn');
  const logoutBtn  = document.getElementById('gdrive-logout-btn');
  const searchCard = document.getElementById('gdrive-search-card');
  if (!badge) return;
  if (connected) {
    badge.textContent = '● Terhubung';
    badge.className = 'badge badge-green';
    if (connectBtn) connectBtn.style.display = 'none';
    if (logoutBtn)  logoutBtn.style.display  = 'inline-flex';
    if (searchCard) searchCard.style.display = 'block';
    // If there's a pending NIE search from a previous cover-letter upload, run it now
    if (gdrivePendingNieSearch && gdrivePendingNieSearch.length) {
      const pending = gdrivePendingNieSearch;
      gdrivePendingNieSearch = null;
      showToast(`🔍 Mencari ${pending.length} file NIE di Google Drive…`, '');
      setTimeout(() => gdriveSearchByNieNumbers(pending), 400);
    }
  } else {
    badge.textContent = '○ Not Logged In';
    badge.className = 'badge badge-gray';
    if (connectBtn) connectBtn.style.display = 'inline-flex';
    if (logoutBtn)  logoutBtn.style.display  = 'none';
    if (searchCard) searchCard.style.display = 'none';
  }
}

// ── Manual search: cari file selain NIE ───────────────────────
// Same flow as the paste-NIE box above (multi-line textarea + status
// per baris), bedanya di sini kata kunci bebas (nama produk, invoice, dll)
// and isn't restricted to the NIE-number pattern. One keyword may yield more
// from 1 file, so the results are collected into the gdrive-results table that's
// exists so the user can choose which ones to ZIP.
// Extracts a Drive folder ID from a pasted folder link, e.g.:
//   https://drive.google.com/drive/folders/1AbCdEfGhIjKlmnOPQRstuvWXyz?usp=sharing
//   https://drive.google.com/drive/u/0/folders/1AbCdEfGhIjKlmnOPQRstuvWXyz
//   https://drive.google.com/open?id=1AbCdEfGhIjKlmnOPQRstuvWXyz
//   or just the bare folder ID itself (1AbCdEfGhIjKlmnOPQRstuvWXyz)
// Returns null if the input doesn't look like a link/ID (i.e. it's a plain folder name).
function extractDriveFolderId(input) {
  if (!input) return null;
  const s = input.trim();
  let m = s.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
  if (m) return m[1];
  m = s.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{15,}$/.test(s)) return s; // bare ID, no slashes/spaces
  return null;
}

function gdriveManualParseTerms() {
  const raw = document.getElementById('gdrive-manual-input')?.value || '';
  return [...new Set(raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean))];
}

function gdriveManualCount() {
  const el = document.getElementById('gdrive-manual-count');
  if (!el) return;
  const n = gdriveManualParseTerms().length;
  el.textContent = n ? `${n} kata kunci` : '';
}

function renderGdriveManualChips(terms, statusByTerm) {
  const area = document.getElementById('gdrive-manual-chip-area');
  if (!area) return;
  area.innerHTML = terms.map(term => {
    let statusHtml = '<span style="color:var(--c-text-hint)">…</span>';
    if (statusByTerm) {
      const n = statusByTerm[term];
      if (n > 0)      statusHtml = `<span style="color:#16a34a;font-weight:600">✓ ${n} file</span>`;
      else if (n === 0) statusHtml = `<span style="color:#dc2626">✗ none</span>`;
      else            statusHtml = `<span style="color:#dc2626">✗ error</span>`;
    }
    return `<div style="display:inline-flex;align-items:center;gap:6px;background:var(--c-surface-2);border:0.5px solid var(--c-border);border-radius:6px;padding:5px 10px;font-size:12px">
      <span>${term}</span><span>${statusHtml}</span>
    </div>`;
  }).join('');
}

// Drive's `'X' in parents` only matches DIRECT children of folder X — it does
// NOT descend into subfolders. So if the target files actually live inside a
// subfolder of the folder you typed, the filtered search would find nothing
// even though an unfiltered search finds them fine. This walks the folder
// tree (BFS) to collect the target folder's ID plus every nested subfolder
// ID, so the filter also covers files that are 1+ levels deep.
async function getFolderIdsRecursive(rootIds, maxDepth = 5, maxFolders = 300) {
  const all = new Set(rootIds);
  let frontier = [...rootIds];
  let depth = 0;
  while (frontier.length && depth < maxDepth && all.size < maxFolders) {
    const nextFrontier = [];
    for (const parentId of frontier) {
      if (all.size >= maxFolders) break;
      try {
        const resp = await gapi.client.drive.files.list({
          q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: 'files(id,name)',
          pageSize: 100,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          corpora: 'allDrives',
        });
        (resp.result.files || []).forEach(f => {
          if (!all.has(f.id) && all.size < maxFolders) { all.add(f.id); nextFrontier.push(f.id); }
        });
      } catch (e) { /* ignore unreadable subfolder, keep going */ }
    }
    frontier = nextFrontier;
    depth++;
  }
  return [...all];
}

async function gdriveManualSearchAndZip() {
  if (!gdriveAccessToken) { showToast('Login ke Google Drive dulu.', 'warning'); return; }

  const terms = gdriveManualParseTerms();
  if (!terms.length) { showToast('Paste minimal 1 kata kunci / nama file, satu per baris.', 'warning'); return; }

  const fileType = document.getElementById('gdrive-filetype')?.value || 'pdf';
  const folderQ  = (document.getElementById('gdrive-folder-input')?.value || '').trim();

  const loadEl = document.getElementById('gdrive-search-loading');
  if (loadEl) loadEl.style.display = 'block';
  gdriveSearchResults = [];
  renderGdriveResults([]);
  renderGdriveManualChips(terms, null);

  // Resolve folder filter -> folder ID(s) once, if given.
  // Accepts: a full Drive folder link, a bare folder ID, or just a folder name.
  let folderClause = '';
  if (folderQ) {
    let rootIds = [];
    const directId = extractDriveFolderId(folderQ);
    if (directId) {
      // Link / ID pasted directly — no need to search by name, just verify it exists
      try {
        await gapi.client.drive.files.get({ fileId: directId, fields: 'id,name,mimeType', supportsAllDrives: true });
        rootIds = [directId];
      } catch (e) {
        showToast('Folder link/ID is invalid or inaccessible — searching across all folders instead.', 'warning');
      }
    } else {
      try {
        const fr = await gapi.client.drive.files.list({
          q: `name contains '${folderQ.replace(/'/g,"\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: 'files(id,name)', pageSize: 10,
          supportsAllDrives: true, includeItemsFromAllDrives: true, corpora: 'allDrives',
        });
        rootIds = (fr.result.files || []).map(f => f.id);
        if (!rootIds.length) showToast(`Folder "${folderQ}" not found — searching across all folders instead.`, 'warning');
      } catch (e) { /* ignore, search without folder restriction */ }
    }

    if (rootIds.length) {
      const allIds = await getFolderIdsRecursive(rootIds);
      folderClause = ' and (' + allIds.map(id => `'${id}' in parents`).join(' or ') + ')';
    }
  }

  const allFound = [];
  const statusByTerm = {};

  for (const term of terms) {
    try {
      let q = `name contains '${term.replace(/'/g,"\\'")}' and trashed = false`;
      if (fileType === 'pdf') q += ` and mimeType = 'application/pdf'`;
      else if (fileType === 'xlsx') q += ` and mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'`;
      q += folderClause;

      const resp = await gapi.client.drive.files.list({
        q, fields: 'files(id,name,mimeType,webViewLink,modifiedTime)', orderBy: 'modifiedTime desc', pageSize: 20,
        supportsAllDrives: true, includeItemsFromAllDrives: true, corpora: 'allDrives',
      });
      const files = (resp.result.files || []).filter(f => !/qr/i.test(f.name));
      files.forEach(f => allFound.push({ ...f, _term: term }));
      statusByTerm[term] = files.length;
    } catch (e) {
      statusByTerm[term] = -1;
    }
  }

  if (loadEl) loadEl.style.display = 'none';
  renderGdriveManualChips(terms, statusByTerm);

  // De-dupe by file id in case multiple terms matched the same file
  const seen = new Map();
  allFound.forEach(f => { if (!seen.has(f.id)) seen.set(f.id, f); });
  const files = [...seen.values()];

  gdriveSearchResults = files;
  renderGdriveResults(files);

  const termsWithHits = terms.filter(t => (statusByTerm[t] || 0) > 0).length;
  if (!files.length) showToast('No files found for that keyword.', 'warning');
  else showToast(`✓ ${files.length} file(s) found from ${termsWithHits}/${terms.length} keywords. Select files below to download as a ZIP.`, 'success');

  document.getElementById('gdrive-results')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Search NIE by NIE number from matching results ───────────────
async function gdriveSearchByNieNumbers(nieNumbers) {
  if (!gdriveAccessToken) { showToast('Please log in to Google Drive first to search for NIE files.', 'warning'); return; }
  if (!nieNumbers || !nieNumbers.length) { showToast('No NIE numbers to search for.', 'warning'); return; }

  showToast(`Mencari ${nieNumbers.length} file NIE di Google Drive...`, '');
  const loadEl = document.getElementById('gdrive-search-loading');
  if (loadEl) loadEl.style.display = 'block';

  const found = [];
  // Search each NIE number — ambil terbaru, skip file yg namanya mengandung "qr"
  for (const nie of nieNumbers) {
    try {
      const resp = await gapi.client.drive.files.list({
        q: `name contains '${nie}' and trashed = false and mimeType = 'application/pdf'`,
        fields: 'files(id,name,mimeType,webViewLink,modifiedTime)',
        orderBy: 'modifiedTime desc',
        pageSize: 10,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        corpora: 'allDrives',
      });
      const files = (resp.result.files || [])
        .filter(f => !/qr/i.test(f.name)); // skip file QR
      if (files.length) found.push({ ...files[0], _nie_number: nie }); // take only the most recent one
    } catch (e) { /* skip failed NIE */ }
  }

  gdriveSearchResults = found;
  renderGdriveResults(found);

  if (loadEl) loadEl.style.display = 'none';
  if (!found.length) showToast('No NIE files found in Drive.', 'warning');
  else showToast(`✓ Ditemukan ${found.length} file NIE.`, 'success');

  // Make sure gdrive-search-card is visible (needed during auto-search from upload)
  const searchCard = document.getElementById('gdrive-search-card');
  if (searchCard) searchCard.style.display = 'block';

  // Scroll ke results
  const driveCard = document.getElementById('gdrive-panel');
  if (driveCard) {
    driveCard.style.display = 'block';
    driveCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  setTimeout(() => {
    const results = document.getElementById('gdrive-results');
    if (results && found.length) results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 400);
}

// ── Render hasil search Drive ─────────────────────────────────
function renderGdriveResults(files) {
  const container = document.getElementById('gdrive-results');
  const countEl   = document.getElementById('gdrive-result-count');
  if (!container) return;
  if (countEl) countEl.textContent = files.length ? `${files.length} file ditemukan` : '';

  if (!files.length) {
    container.innerHTML = `<div style="text-align:center;padding:32px;color:var(--c-text-hint)">No search results yet.</div>`;
    return;
  }

  container.innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
      <button class="btn-ghost btn-sm" onclick="gdriveSelectAll(true)"><i class="ti ti-checkbox"></i> Pilih Semua</button>
      <button class="btn-ghost btn-sm" onclick="gdriveSelectAll(false)"><i class="ti ti-square"></i> Batal Semua</button>
      <button class="btn-primary btn-sm" onclick="gdriveDownloadSelected()" id="gdrive-dl-btn" style="margin-left:auto">
        <i class="ti ti-download"></i> Download ZIP (<span id="gdrive-sel-count">0</span>)
      </button>
    </div>
    <div class="table-wrap">
      <table class="data-table" style="font-size:13px">
        <thead><tr>
          <th style="width:36px"><input type="checkbox" id="gdrive-chk-all" onchange="gdriveSelectAll(this.checked)"></th>
          <th>Nama File</th>
          <th>Terkait NIE</th>
          <th>Terakhir Diubah</th>
          <th>Aksi</th>
        </tr></thead>
        <tbody>
          ${files.map((f, i) => `<tr>
            <td><input type="checkbox" class="gdrive-file-chk" data-id="${f.id}" data-name="${f.name}" onchange="gdriveToggleFile('${f.id}', this.checked)"></td>
            <td>
              <div style="display:flex;align-items:center;gap:8px">
                <i class="ti ti-file-type-pdf" style="color:#ef4444;font-size:18px"></i>
                <div>
                  <div style="font-weight:500">${f.name}</div>
                  ${f._nie_number ? `<div style="font-size:11px;font-family:monospace;color:var(--c-blue-dark)">${f._nie_number}</div>` : ''}
                </div>
              </div>
            </td>
            <td style="font-family:monospace;font-size:12px;color:var(--c-text-hint)">${f._nie_number || '—'}</td>
            <td style="font-size:12px;color:var(--c-text-hint)">${f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString('id-ID') : '—'}</td>
            <td style="display:flex;gap:6px">
              <a href="${f.webViewLink}" target="_blank" class="btn-ghost btn-sm"><i class="ti ti-external-link"></i> Buka</a>
              <button class="btn-ghost btn-sm" onclick="gdriveDownloadSingle('${f.id}','${f.name.replace(/'/g,"\\'")}')"><i class="ti ti-download"></i></button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function gdriveToggleFile(fileId, checked) {
  if (checked) gdriveSelectedFiles.add(fileId);
  else gdriveSelectedFiles.delete(fileId);
  const countEl = document.getElementById('gdrive-sel-count');
  if (countEl) countEl.textContent = gdriveSelectedFiles.size;
}

function gdriveSelectAll(checked) {
  const chks = document.querySelectorAll('.gdrive-file-chk');
  chks.forEach(chk => {
    chk.checked = checked;
    gdriveToggleFile(chk.dataset.id, checked);
  });
  const allChk = document.getElementById('gdrive-chk-all');
  if (allChk) allChk.checked = checked;
  const countEl = document.getElementById('gdrive-sel-count');
  if (countEl) countEl.textContent = gdriveSelectedFiles.size;
}

// ── Download a single file from Drive ──────────────────────────
async function gdriveDownloadSingle(fileId, fileName) {
  if (!gdriveAccessToken) { showToast('Login ke Google Drive dulu.', 'warning'); return; }
  try {
    showToast(`Mengunduh ${fileName}...`, '');
    const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${gdriveAccessToken}` }
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`✓ ${fileName} diunduh.`, 'success');
  } catch (err) {
    showToast('Gagal unduh: ' + err.message, 'error');
  }
}

// ── Download selected files as a ZIP ──────────────────────
async function gdriveDownloadSelected() {
  if (!gdriveAccessToken) { showToast('Login ke Google Drive dulu.', 'warning'); return; }
  if (!gdriveSelectedFiles.size) { showToast('Select at least 1 file to download.', 'warning'); return; }

  // Check if JSZip is available
  if (typeof JSZip === 'undefined') {
    showToast('Memuat library ZIP...', '');
    await loadGoogleScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
  }

  const dlBtn = document.getElementById('gdrive-dl-btn');
  if (dlBtn) { dlBtn.disabled = true; dlBtn.innerHTML = '<i class="ti ti-loader"></i> Mengunduh...'; }

  try {
    const zip = new JSZip();
    const fileMap = new Map(gdriveSearchResults.map(f => [f.id, f.name]));
    let downloaded = 0;

    showToast(`Mengunduh ${gdriveSelectedFiles.size} file, harap tunggu...`, '');

    for (const fileId of gdriveSelectedFiles) {
      const fileName = fileMap.get(fileId) || `file_${fileId}.pdf`;
      try {
        const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: { Authorization: `Bearer ${gdriveAccessToken}` }
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        const arrayBuffer = await blob.arrayBuffer();
        zip.file(fileName, arrayBuffer);
        downloaded++;
        if (dlBtn) dlBtn.innerHTML = `<i class="ti ti-loader"></i> ${downloaded}/${gdriveSelectedFiles.size}...`;
      } catch (e) {
        console.warn(`Skip ${fileName}:`, e);
      }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const zipName = `NIE_Files_${new Date().toISOString().slice(0,10)}.zip`;
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url; a.download = zipName;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`✓ ${downloaded} file dikemas dalam ${zipName}`, 'success');
  } catch (err) {
    showToast('Gagal buat ZIP: ' + err.message, 'error');
  } finally {
    if (dlBtn) { dlBtn.disabled = false; dlBtn.innerHTML = `<i class="ti ti-download"></i> Download ZIP (<span id="gdrive-sel-count">${gdriveSelectedFiles.size}</span>)`; }
  }
}

function handleNieCiDrop(event) {
  event.preventDefault();
  document.getElementById('nie-ci-drop').classList.remove('dragover');
  const file = event.dataTransfer.files[0];
  if (file) handleNieCiUpload(file);
}
// ══════════════════════════════════════════════════════════════
// NIE PASTE INPUT — Parse & Search/Download
// ══════════════════════════════════════════════════════════════

window.NIE_SKI_ITEMS = window.NIE_SKI_ITEMS || [];

// Parse NIE numbers from raw pasted text
// Accepts: one-per-line, comma-separated, space-separated, mixed
function parsePastedNie(raw) {
  if (!raw) return [];
  const matches = raw.match(/NA\d{11,15}/gi) || [];
  return [...new Set(matches.map(n => n.toUpperCase()))];
}

// Update paste counter badge
function niePasteCount() {
  const raw  = document.getElementById('nie-paste-input')?.value || '';
  const nies = parsePastedNie(raw);
  const el   = document.getElementById('nie-paste-count');
  if (el) el.textContent = nies.length ? `${nies.length} NIE` : '';
}

// Main: process pasted NIE list
async function niePasteProcess() {
  const raw  = document.getElementById('nie-paste-input')?.value || '';
  const nies = parsePastedNie(raw);

  if (!nies.length) {
    showToast('No NIE numbers detected. Format: NA followed by numbers, one per line.', 'error');
    return;
  }

  const statusEl = document.getElementById('nie-paste-status');
  if (statusEl) statusEl.textContent = `${nies.length} NIE terdeteksi`;

  // Store as SKI items so copy/export also works
  window.NIE_SKI_ITEMS = nies.map(n => ({
    nie_number: n, product_name: '', size: '', qty: 0, batch: '', hs_code: ''
  }));

  // Show count badge
  document.getElementById('nie-kpi-total').textContent = nies.length;

  // Show result info bar
  const info = document.getElementById('nie-ci-result-info');
  const txt  = document.getElementById('nie-ci-result-text');
  if (info) info.style.display = 'flex';
  if (txt)  txt.textContent = `${nies.length} nomor NIE diinput manual`;

  // Render chip panel
  renderPastedNiePanel(nies);

  showToast(`${nies.length} NIE(s) detected. Click "Search & Download ZIP" to download.`, 'success');
}

// Render the chip panel with all NIEs
function renderPastedNiePanel(nies) {
  // Remove old panel
  document.getElementById('nie-paste-result-panel')?.remove();

  const panel = document.createElement('div');
  panel.id = 'nie-paste-result-panel';
  panel.className = 'form-card';
  panel.style.marginBottom = '16px';

  panel.innerHTML = `
    <div class="form-card-title">
      <i class="ti ti-list-numbers"></i>
      <span>NIE from Manual Input</span>
      <span class="badge badge-blue" style="margin-left:8px;font-size:12px">${nies.length} NIE</span>
      <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn-ghost btn-sm" onclick="nieCopyAllNie()">
          <i class="ti ti-copy"></i> Copy Semua
        </button>
        <button class="btn-primary btn-sm" onclick="nieDownloadZipFromPaste()" id="nie-paste-dl-btn">
          <i class="ti ti-download"></i> Cari &amp; Download ZIP
        </button>
      </div>
    </div>
    <div id="nie-chip-area" style="display:flex;flex-wrap:wrap;gap:6px;padding:4px 0 8px">
      ${nies.map((n, i) => `
        <div style="display:inline-flex;align-items:center;gap:4px;background:var(--c-surface-2);border:0.5px solid var(--c-border);border-radius:6px;padding:5px 10px;font-family:monospace;font-size:12px" id="nie-chip-wrap-${n}">
          <span style="color:var(--c-text-hint);font-size:10px;min-width:16px">${i+1}.</span>
          <span style="color:var(--c-blue-dark);font-weight:500">${n}</span>
          <span id="nie-chip-status-${n}" style="font-size:11px;margin-left:3px"></span>
        </div>`).join('')}
    </div>
    <div id="nie-paste-drive-summary" style="display:none;margin-top:8px;padding:10px 12px;border-radius:8px;background:var(--c-surface-2);font-size:13px"></div>`;

  // Insert before gdrive-panel or results-section
  const gdrive = document.getElementById('gdrive-panel');
  const niePanel = document.getElementById('nie-panel');
  if (gdrive && gdrive.parentNode) {
    gdrive.parentNode.insertBefore(panel, gdrive);
  } else if (niePanel) {
    niePanel.appendChild(panel);
  }
}

// Update each chip with found/not found status
function updateNieChips(foundSet) {
  window.NIE_SKI_ITEMS.forEach(item => {
    const n    = item.nie_number;
    const wrap = document.getElementById(`nie-chip-wrap-${n}`);
    const st   = document.getElementById(`nie-chip-status-${n}`);
    if (foundSet.has(n)) {
      if (wrap) wrap.style.cssText += ';border-color:rgba(34,197,94,.5);background:rgba(34,197,94,.07)';
      if (st)   { st.textContent = '✓'; st.style.color = '#16a34a'; }
    } else {
      if (wrap) wrap.style.cssText += ';border-color:rgba(239,68,68,.4);background:rgba(239,68,68,.04)';
      if (st)   { st.textContent = '✗'; st.style.color = '#dc2626'; }
    }
  });
}

// Main download entry point — tries Google Drive first, then local server
async function nieDownloadZipFromPaste() {
  const nies = window.NIE_SKI_ITEMS.map(i => i.nie_number).filter(Boolean);
  if (!nies.length) { showToast('No NIEs. Please paste NIE numbers first.', 'error'); return; }

  const btn = document.getElementById('nie-paste-dl-btn');
  const setBtn = (label, disabled=true) => {
    if (!btn) return;
    btn.disabled = disabled;
    btn.innerHTML = label;
  };

  // ── Option 1: Google Drive API (if logged in) ─────────────
  if (gdriveAccessToken) {
    setBtn('<i class="ti ti-loader-2" style="animation:spin .7s linear infinite"></i> Mencari di Drive…');
    await gdriveSearchAndZipNies(nies);
    setBtn('<i class="ti ti-download"></i> Cari &amp; Download ZIP', false);
    return;
  }

  // ── Option 2: Local nie_server.py ─────────────────────────
  setBtn('<i class="ti ti-loader-2" style="animation:spin .7s linear infinite"></i> Menghubungi server…');
  try {
    const ping = await fetch('http://localhost:8765/api/status', { signal: AbortSignal.timeout(2000) });
    if (ping.ok) {
      const st = await ping.json();
      if (!st.indexed_files) {
        showToast('Server is running but no files are indexed yet. Click "Scan Folder" on the server first.', 'warning');
        setBtn('<i class="ti ti-download"></i> Cari &amp; Download ZIP', false);
        return;
      }
      await nieServerSearchAndZip(nies);
      setBtn('<i class="ti ti-download"></i> Cari &amp; Download ZIP', false);
      return;
    }
  } catch(e) { /* server not running */ }

  // ── Option 3: Neither available ───────────────────────────
  setBtn('<i class="ti ti-download"></i> Cari &amp; Download ZIP', false);
  showToast('Log in to Google Drive (click the Login Google Drive button) or run nie_server_setup.bat on your computer.', 'error');

  // Highlight the login button to guide user
  const loginBtn = document.getElementById('gdrive-connect-btn');
  if (loginBtn) {
    loginBtn.style.animation = 'pulse 1s ease 3';
    loginBtn.style.background = 'rgba(59,111,232,.15)';
    loginBtn.style.borderColor = 'var(--c-blue)';
    setTimeout(() => { loginBtn.style.animation=''; loginBtn.style.background=''; loginBtn.style.borderColor=''; }, 3500);
  }
}

// ── Google Drive: search each NIE then zip all found files ────
async function gdriveSearchAndZipNies(nies) {
  const foundFiles = [];
  const foundSet   = new Set();
  const notFound   = [];

  // Update chips to searching state
  nies.forEach(n => {
    const st = document.getElementById(`nie-chip-status-${n}`);
    if (st) { st.textContent = '…'; st.style.color = 'var(--c-text-hint)'; }
  });

  showToast(`Mencari ${nies.length} file NIE di Google Drive…`, '');

  for (const nie of nies) {
    try {
      const resp = await gapi.client.drive.files.list({
        q: `name contains '${nie}' and trashed = false and mimeType = 'application/pdf'`,
        fields: 'files(id,name,mimeType,webViewLink,modifiedTime)',
        orderBy: 'modifiedTime desc',
        pageSize: 5,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        corpora: 'allDrives',
      });
      const files = (resp.result.files || []).filter(f => !/qr/i.test(f.name));
      if (files.length) {
        foundFiles.push({ ...files[0], _nie: nie });
        foundSet.add(nie);
      } else {
        notFound.push(nie);
      }
    } catch(e) {
      notFound.push(nie);
    }
  }

  updateNieChips(foundSet);

  // Update KPI
  document.getElementById('nie-kpi-match').textContent = foundSet.size;
  document.getElementById('nie-kpi-miss').textContent  = notFound.length;

  // Show summary
  const summEl = document.getElementById('nie-paste-drive-summary');
  if (summEl) {
    summEl.style.display = 'block';
    summEl.innerHTML = `
      <span class="badge badge-green" style="margin-right:8px">✓ ${foundSet.size} ditemukan</span>
      ${notFound.length ? `<span class="badge badge-red" style="margin-right:8px">✗ ${notFound.length} not found</span>` : ''}
      ${notFound.length ? `<div style="margin-top:6px;font-size:12px;color:var(--c-text-hint)">Not found: ${notFound.join(', ')}</div>` : ''}`;
  }

  if (!foundFiles.length) {
    showToast('No NIE files found in Google Drive.', 'error');
    return;
  }

  showToast(`${foundSet.size} file ditemukan. Mengunduh ZIP…`, 'success');

  // Download each file and zip them in memory using JSZip-like approach
  // Since we can't use JSZip without a CDN, download individually then tell user
  // Actually use the existing gdriveDownloadAsZip if available
  if (typeof gdriveDownloadAsZip === 'function') {
    await gdriveDownloadAsZip(foundFiles);
  } else {
    // Fallback: update results panel and let user use existing download button
    gdriveSearchResults = foundFiles;
    renderGdriveResults(foundFiles);
    const driveCard = document.getElementById('gdrive-panel');
    if (driveCard) {
      driveCard.style.display = 'block';
      driveCard.scrollIntoView({ behavior:'smooth', block:'start' });
    }
    showToast(`${foundFiles.length} file(s) found. Scroll down to download the ZIP.`, 'success');
  }
}

// ── Local server: search NIEs then download ZIP ───────────────
async function nieServerSearchAndZip(nies) {
  // Search
  const sr = await fetch('http://localhost:8765/api/search-nie', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ nie_numbers: nies })
  });
  const searchResult = await sr.json();

  const foundSet  = new Set(nies.filter(n => searchResult[n]?.found));
  const notFound  = nies.filter(n => !searchResult[n]?.found);
  updateNieChips(foundSet);

  document.getElementById('nie-kpi-match').textContent = foundSet.size;
  document.getElementById('nie-kpi-miss').textContent  = notFound.length;

  const summEl = document.getElementById('nie-paste-drive-summary');
  if (summEl) {
    summEl.style.display = 'block';
    summEl.innerHTML = `
      <span class="badge badge-green" style="margin-right:8px">✓ ${foundSet.size} ditemukan</span>
      ${notFound.length ? `<span class="badge badge-red" style="margin-right:8px">✗ ${notFound.length} not found</span>` : ''}
      ${notFound.length ? `<div style="margin-top:6px;font-size:12px;color:var(--c-text-hint)">Not in folder: ${notFound.join(', ')}</div>` : ''}`;
  }

  if (!foundSet.size) {
    showToast('No NIE files found in the folder. Make sure the folder has been scanned.', 'error');
    return;
  }

  // Download ZIP
  showToast(`${foundSet.size} file ditemukan. Membuat ZIP…`, 'success');
  const brand   = 'NIE';
  const zipName = `NIE_${brand}_${new Date().toISOString().slice(0,10)}.zip`;
  const zr = await fetch('http://localhost:8765/api/download-zip', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ nie_numbers: [...foundSet], zip_name: zipName })
  });

  if (!zr.ok) {
    const err = await zr.json().catch(()=>({detail:'Download gagal'}));
    showToast('ZIP error: ' + (err.detail||'Unknown'), 'error');
    return;
  }

  const blob = await zr.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = zipName;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  const cnt = zr.headers.get('X-File-Count') || foundSet.size;
  showToast(`✓ ZIP downloaded: ${cnt} file NIE (${zipName})`, 'success');
}

// ═══════════════════════════════════════════════════════
// GENERATE DOCUMENT — export helper (HTML → Word .doc)
// No external template needed: wraps formatted HTML in a
// minimal Word-compatible shell and downloads it as .doc,
// which Word/LibreOffice opens natively.
// ═══════════════════════════════════════════════════════
function downloadHtmlAsWord(filename, bodyHtml) {
  const shell = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
  <head><meta charset="utf-8">
  <style>
    @page { size: 21cm 29.7cm; margin: 2.5cm 2.5cm 2.5cm 3cm; }
    body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; color:#000; }
    table { border-collapse: collapse; width: 100%; margin: 10px 0; }
    td, th { border: 1px solid #000; padding: 5px 8px; font-size: 10.5pt; vertical-align: top; }
    th { background: #eee; font-weight: bold; text-align:center; }
    .center { text-align: center; }
    .right  { text-align: right; }
    .bold   { font-weight: bold; }
    .underline { text-decoration: underline; }
    .letterhead { text-align:center; margin-bottom: 6px; }
    .letterhead .co-name { font-size: 14pt; font-weight: bold; letter-spacing: .5px; }
    .letterhead .co-addr { font-size: 10pt; }
    hr { border: none; border-top: 2px solid #000; margin: 4px 0 16px; }
    .sig-block { margin-top: 40px; }
    .sig-name  { margin-top: 60px; font-weight: bold; text-decoration: underline; }
  </style></head>
  <body>${bodyHtml}</body></html>`;
  const blob = new Blob(['\ufeff', shell], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename.endsWith('.doc') ? filename : filename + '.doc';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const IMPORTER_LETTERHEAD = {
  name: 'PT SOCIAL BELLA INDONESIA',
  addr1: 'Jl. Radio Dalam Raya No. 5, Gandaria Utara,',
  addr2: 'Kebayoran Baru, Jakarta Selatan 12140',
};

// Surat Kuasa is generated from a specific shipment record — reuse the
// existing feature on Upcoming Shipment instead of a separate blank form.
function goToSuratKuasaFromShipment() {
  switchTab('shipment');
  showToast('Select a shipment, then click the "Surat Kuasa" button on the matching row.', 'success');
  setTimeout(() => {
    const list = document.getElementById('shipment-list');
    if (list) list.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 200);
}

// ── Surat Kuasa (Power of Attorney) — Custom & Pengambilan DO ──
function openSkExportModal(shipmentIdx) {
  const modal = document.getElementById('sk-export-modal');
  if (!modal) return;
  const s = (typeof shipmentIdx === 'number' && typeof MOCK_SHIPMENTS !== 'undefined') ? MOCK_SHIPMENTS[shipmentIdx] : null;

  const set = (id, val) => { const el = document.getElementById(id); if (el && val != null && val !== '') el.value = val; };

  // Pemberi Kuasa — default to the importer's own letterhead
  set('sk-tanggal', new Date().toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' }));
  set('sk-nama-perusahaan', IMPORTER_LETTERHEAD.name);
  set('sk-alamat-1', IMPORTER_LETTERHEAD.addr1);
  set('sk-alamat-2', IMPORTER_LETTERHEAD.addr2);

  // Penerima Kuasa — default PPJK partner: Logwin
  set('sk-nama-penerima', 'PT LOGWIN INDONESIA');
  set('sk-nama-penerima-signer', document.getElementById('sk-nama-penerima-signer')?.value || '');

  // Shipment-derived fields, if a row was picked
  if (s) {
    set('sk-vessel', s.vessel);
    set('sk-bl-no-tgl', s.noBl ? `${s.noBl}${s.etd ? ' & ' + fmtDate(s.etd) : ''}` : '');
    set('sk-shipper', s.brand);
    set('sk-quantity', s.containerType);
  }

  modal.style.display = 'flex';
}

function closeSkExportModal() {
  const modal = document.getElementById('sk-export-modal');
  if (modal) modal.style.display = 'none';
}

function generateSuratKuasaDocx() {
  const v = id => (document.getElementById(id)?.value || '').trim();

  const required = ['sk-tanggal','sk-no-surat-custom','sk-no-surat-do','sk-nama-pemberi','sk-jabatan-pemberi',
    'sk-nama-perusahaan','sk-npwp-pemberi','sk-telepon','sk-nama-penerima','sk-npwp-penerima','sk-pimpinan-ppjk',
    'sk-nama-penerima-signer','sk-bl-no-tgl','sk-vessel','sk-shipper','sk-invoice-no','sk-total-invoice',
    'sk-quantity','sk-jenis-barang'];
  const missing = required.filter(id => !v(id));
  if (missing.length) {
    showToast(`Lengkapi dulu ${missing.length} field wajib (*) sebelum generate.`, 'error');
    return;
  }

  const data = {
    tanggal: v('sk-tanggal'), noSuratCustom: v('sk-no-surat-custom'), noSuratDo: v('sk-no-surat-do'),
    namaPemberi: v('sk-nama-pemberi'), jabatanPemberi: v('sk-jabatan-pemberi'), namaPerusahaan: v('sk-nama-perusahaan'),
    npwpPemberi: v('sk-npwp-pemberi'), telepon: v('sk-telepon'),
    alamat: [v('sk-alamat-1'), v('sk-alamat-2'), v('sk-alamat-3')].filter(Boolean).join(', '),
    namaPenerima: v('sk-nama-penerima'), npwpPenerima: v('sk-npwp-penerima'), pimpinanPpjk: v('sk-pimpinan-ppjk'),
    alamatPenerima: v('sk-alamat-penerima'), namaPenerimaSigner: v('sk-nama-penerima-signer'),
    blNoTgl: v('sk-bl-no-tgl'), vessel: v('sk-vessel'), shipper: v('sk-shipper'), invoiceNo: v('sk-invoice-no'),
    totalInvoice: v('sk-total-invoice'), quantity: v('sk-quantity'), jenisBarang: v('sk-jenis-barang'),
  };

  const letterBody = (noSurat, perihal, uraian) => `
    <div class="letterhead">
      <div class="co-name">${data.namaPerusahaan}</div>
      <div class="co-addr">${data.alamat}${data.telepon ? ' &nbsp;|&nbsp; Telp: ' + data.telepon : ''}</div>
    </div>
    <hr/>
    <p>Nomor&nbsp;&nbsp;&nbsp;: ${noSurat}<br/>Perihal&nbsp;: <span class="bold">${perihal}</span></p>
    <p class="center bold underline" style="margin:24px 0 16px;font-size:13pt;">SURAT KUASA</p>
    <p>Yang bertanda tangan di bawah ini:</p>
    <table style="border:none;margin-bottom:14px;">
      <tr><td style="border:none;width:150px;padding:2px 0;">Nama</td><td style="border:none;padding:2px 0;">: ${data.namaPemberi}</td></tr>
      <tr><td style="border:none;padding:2px 0;">Jabatan</td><td style="border:none;padding:2px 0;">: ${data.jabatanPemberi}</td></tr>
      <tr><td style="border:none;padding:2px 0;">Perusahaan</td><td style="border:none;padding:2px 0;">: ${data.namaPerusahaan}</td></tr>
      <tr><td style="border:none;padding:2px 0;">NPWP</td><td style="border:none;padding:2px 0;">: ${data.npwpPemberi}</td></tr>
    </table>
    <p>Dalam hal ini bertindak untuk dan atas nama <span class="bold">${data.namaPerusahaan}</span>, selanjutnya disebut <span class="bold">PEMBERI KUASA</span>.</p>
    <p>Dengan ini memberikan kuasa kepada:</p>
    <table style="border:none;margin-bottom:14px;">
      <tr><td style="border:none;width:150px;padding:2px 0;">Nama Perusahaan</td><td style="border:none;padding:2px 0;">: ${data.namaPenerima}</td></tr>
      <tr><td style="border:none;padding:2px 0;">NPWP</td><td style="border:none;padding:2px 0;">: ${data.npwpPenerima}</td></tr>
      <tr><td style="border:none;padding:2px 0;">Pimpinan</td><td style="border:none;padding:2px 0;">: ${data.pimpinanPpjk}</td></tr>
      ${data.alamatPenerima ? `<tr><td style="border:none;padding:2px 0;">Alamat</td><td style="border:none;padding:2px 0;">: ${data.alamatPenerima}</td></tr>` : ''}
      <tr><td style="border:none;padding:2px 0;">Diwakili oleh</td><td style="border:none;padding:2px 0;">: ${data.namaPenerimaSigner}</td></tr>
    </table>
    <p>Selanjutnya disebut <span class="bold">PENERIMA KUASA</span>, untuk ${uraian}</p>
    <table style="border:none;margin-bottom:14px;">
      <tr><td style="border:none;width:150px;padding:2px 0;">BL No. &amp; Tanggal</td><td style="border:none;padding:2px 0;">: ${data.blNoTgl}</td></tr>
      <tr><td style="border:none;padding:2px 0;">Vessel</td><td style="border:none;padding:2px 0;">: ${data.vessel}</td></tr>
      <tr><td style="border:none;padding:2px 0;">Shipper</td><td style="border:none;padding:2px 0;">: ${data.shipper}</td></tr>
      <tr><td style="border:none;padding:2px 0;">Invoice No.</td><td style="border:none;padding:2px 0;">: ${data.invoiceNo}</td></tr>
      <tr><td style="border:none;padding:2px 0;">Total Invoice</td><td style="border:none;padding:2px 0;">: ${data.totalInvoice}</td></tr>
      <tr><td style="border:none;padding:2px 0;">Quantity</td><td style="border:none;padding:2px 0;">: ${data.quantity}</td></tr>
      <tr><td style="border:none;padding:2px 0;">Jenis Barang</td><td style="border:none;padding:2px 0;">: ${data.jenisBarang}</td></tr>
    </table>
    <p>Demikian surat kuasa ini dibuat untuk dapat dipergunakan sebagaimana mestinya.</p>
    <table style="border:none;margin-top:24px;">
      <tr>
        <td style="border:none;width:50%;">
          <p>PENERIMA KUASA,</p>
          <p class="sig-name">${data.namaPenerimaSigner}</p>
        </td>
        <td style="border:none;width:50%;">
          <p>Jakarta, ${data.tanggal}<br/>PEMBERI KUASA,</p>
          <p class="sig-name">${data.namaPemberi}</p>
        </td>
      </tr>
    </table>
    <p style="page-break-after: always;"></p>
  `;

  const body = letterBody(data.noSuratCustom, 'Kuasa Pengurusan Dokumen Kepabeanan (Custom Clearance)',
      'mengurus segala dokumen dan proses kepabeanan (custom clearance) atas nama Pemberi Kuasa, dengan data barang sebagai berikut:')
    + letterBody(data.noSuratDo, 'Kuasa Pengambilan Delivery Order (DO)',
      'mengambil Delivery Order (DO) di pelayaran/shipping line atas nama Pemberi Kuasa, dengan data barang sebagai berikut:');

  downloadHtmlAsWord(`Surat_Kuasa_${data.noSuratCustom.replace(/[^\w]+/g,'_')}`, body);
  showToast('✓ Surat Kuasa berhasil digenerate & diunduh (.doc)', 'success');
  closeSkExportModal();
}

// ── Surat Pernyataan & Pengantar (BPOM / SKI submission letter) ──
let sppItemRows = [];

function openSppExportModal() {
  const modal = document.getElementById('spp-export-modal');
  if (!modal) return;
  if (!sppItemRows.length) sppItemRows = [{ nama:'', kemasan:'', noBets:'', jumlah:'', noInvoice:'', negara:'', noHs:'', nilai:'', nie:'' }];
  const set = (id, val) => { const el = document.getElementById(id); if (el && !el.value) el.value = val; };
  set('spp-tanggal', new Date().toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' }));
  set('spp-nama-perusahaan', IMPORTER_LETTERHEAD.name);
  set('spp-alamat', `${IMPORTER_LETTERHEAD.addr1} ${IMPORTER_LETTERHEAD.addr2}`);
  renderSppItemRows();
  modal.style.display = 'flex';
}

function closeSppExportModal() {
  const modal = document.getElementById('spp-export-modal');
  if (modal) modal.style.display = 'none';
}

function renderSppItemRows() {
  const tbody = document.getElementById('spp-items-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  sppItemRows.forEach((r, i) => {
    const tr = document.createElement('tr');
    const cell = (field, ph, w) => `<input type="text" value="${r[field] || ''}" placeholder="${ph||''}" style="width:${w||'100%'};border:none;background:transparent;font-size:12.5px;padding:4px" oninput="sppItemRows[${i}].${field}=this.value;updateSppMergePreview();" />`;
    tr.innerHTML = `
      <td style="text-align:center;font-size:12px;color:var(--c-text-hint)">${i+1}</td>
      <td>${cell('nama','Nama produk')}</td>
      <td>${cell('kemasan','Kemasan')}</td>
      <td>${cell('noBets','No Bets')}</td>
      <td>${cell('jumlah','Jumlah','60px')}</td>
      <td>${cell('noInvoice','No Invoice & tgl')}</td>
      <td>${cell('negara','Negara asal')}</td>
      <td>${cell('noHs','No HS')}</td>
      <td>${cell('nilai','Nilai')}</td>
      <td>${cell('nie','No NIE (NAxxxxxxxxxx)')}</td>
      <td><button class="btn-detail btn-detail-danger" onclick="removeSppRow(${i})" title="Hapus baris"><i class="ti ti-trash"></i></button></td>
    `;
    tbody.appendChild(tr);
  });
  updateSppMergePreview();
}

function addSppRow() {
  sppItemRows.push({ nama:'', kemasan:'', noBets:'', jumlah:'', noInvoice:'', negara:'', noHs:'', nilai:'', nie:'' });
  renderSppItemRows();
}

function removeSppRow(i) {
  sppItemRows.splice(i, 1);
  if (!sppItemRows.length) sppItemRows.push({ nama:'', kemasan:'', noBets:'', jumlah:'', noInvoice:'', negara:'', noHs:'', nilai:'', nie:'' });
  renderSppItemRows();
}

// ── Merge logic: rows with the same Product Name + Packaging + Value ──
// (detected from the CI) are treated as the same SKU and combined into
// a single line item (quantities summed; distinct batch/invoice/NIE
// references are kept, joined together).
const SKI_MAX_SKU = 20;

function sppNormKey(s) {
  return (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
}

function sppParseNum(v) {
  const n = Number(String(v || '0').replace(/[^\d.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function mergeSkiRows(rows) {
  const map = new Map();
  const order = [];
  rows.forEach(r => {
    const key = [sppNormKey(r.nama), sppNormKey(r.kemasan), sppNormKey(r.nilai)].join('|');
    if (!map.has(key)) {
      map.set(key, {
        ...r,
        _jumlahRaw: r.jumlah || '',
        _jumlah: sppParseNum(r.jumlah),
        _noBets: new Set([r.noBets].filter(Boolean)),
        _noInvoice: new Set([r.noInvoice].filter(Boolean)),
        _nie: new Set([r.nie].filter(Boolean)),
        _merged: 0,
      });
      order.push(key);
    } else {
      const m = map.get(key);
      m._jumlah += sppParseNum(r.jumlah);
      m._merged += 1;
      if (r.noBets) m._noBets.add(r.noBets);
      if (r.noInvoice) m._noInvoice.add(r.noInvoice);
      if (r.nie) m._nie.add(r.nie);
    }
  });
  return order.map(k => {
    const m = map.get(k);
    return {
      nama: m.nama, kemasan: m.kemasan, negara: m.negara, noHs: m.noHs, nilai: m.nilai,
      jumlah: m._merged > 0 ? (m._jumlah ? m._jumlah.toLocaleString('id-ID') : '') : m._jumlahRaw,
      noBets: [...m._noBets].join(', '),
      noInvoice: [...m._noInvoice].join(', '),
      nie: [...m._nie].join(', '),
      _mergedCount: m._merged,
    };
  });
}

function getMergedSppRows() {
  const validRows = sppItemRows.filter(r => r.nama && r.nie);
  return mergeSkiRows(validRows);
}

function updateSppMergePreview() {
  const el = document.getElementById('spp-merge-preview');
  if (!el) return;
  const merged = getMergedSppRows();
  const mergedCount = merged.reduce((s, r) => s + (r._mergedCount || 0), 0);
  const over = merged.length > SKI_MAX_SKU;
  el.innerHTML = `${merged.length} SKU setelah digabung${mergedCount ? ` (${mergedCount} baris digabung otomatis karena nama, kemasan &amp; nilai sama)` : ''}.`
    + (over ? ` <span style="color:#ef4444;font-weight:600">Melebihi maksimal ${SKI_MAX_SKU} SKU — pecah menjadi surat terpisah.</span>` : '');
}

// Real .docx template paths — upload the two template files (with {tag} placeholders,
// generated to match the official BPOM Pengantar/Pernyataan format exactly, kop & fonts
// included) to these paths in the project so the app can fetch & fill them.
const SKI_TEMPLATE_PATHS = {
  pengantar: 'templates/Template_Surat_Pengantar_SKI.docx',
  pernyataan: 'templates/Template_Surat_Pernyataan_SKI.docx',
};

// Fetches a .docx template, fills it with docxtemplater ({tag} placeholders +
// {#items}…{/items} row-loop for the product table), and downloads the result
// as a real .docx (not the old HTML→.doc trick).
async function fillDocxTemplateAndDownload(templateUrl, data, filename) {
  let arrayBuffer;
  try {
    const res = await fetch(templateUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    arrayBuffer = await res.arrayBuffer();
  } catch (err) {
    showToast(`Template tidak ditemukan di "${templateUrl}". Pastikan file .docx template sudah diupload ke folder tersebut.`, 'error');
    throw err;
  }

  let zip, doc;
  try {
    zip = new PizZip(arrayBuffer);
    doc = new window.docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    doc.render(data);
  } catch (err) {
    console.error(err);
    const details = err?.properties?.errors?.map(e => e.properties?.explanation).filter(Boolean).join('; ');
    showToast(`Gagal mengisi template: ${details || err.message}`, 'error');
    throw err;
  }

  const blob = doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename.endsWith('.docx') ? filename : filename + '.docx';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Validates & returns the merged (max-20-SKU) rows, or null + toast on error.
function validateSppRows() {
  const merged = getMergedSppRows();
  if (!merged.length) {
    showToast('Isi minimal 1 baris item (Nama produk & No NIE wajib).', 'error');
    return null;
  }
  if (merged.length > SKI_MAX_SKU) {
    showToast(`Maksimal ${SKI_MAX_SKU} SKU per surat (saat ini ${merged.length} SKU setelah digabung). Pecah menjadi beberapa surat.`, 'error');
    return null;
  }
  return merged;
}

// Shared: turns the merged rows into the {items} array the templates expect.
function skiItemsForTemplate(merged) {
  return merged.map((r, i) => ({
    no: i + 1,
    nama: r.nama,
    kemasan: r.kemasan || '-',
    noBets: r.noBets || '-',
    jumlah: r.jumlah || '-',
    noInvoice: r.noInvoice || '-',
    negara: r.negara || '-',
    noHs: r.noHs || '-',
    nilai: r.nilai || '-',
    nie: r.nie,
  }));
}

// ── Surat Pengantar (permohonan SKI ke BPOM) ───────────────────────
async function generateSuratPengantarSkiDocx() {
  const v = id => (document.getElementById(id)?.value || '').trim();
  const required = ['spp-no-surat-pengantar','spp-tanggal','spp-nama-perusahaan','spp-alamat','spp-nama-penandatangan','spp-jabatan-penandatangan'];
  const missing = required.filter(id => !v(id));
  if (missing.length) { showToast(`Lengkapi dulu ${missing.length} field wajib (*).`, 'error'); return; }
  const merged = validateSppRows();
  if (!merged) return;

  const data = {
    tanggal: v('spp-tanggal'), noSuratPengantar: v('spp-no-surat-pengantar'),
    namaPerusahaan: v('spp-nama-perusahaan'), alamat: v('spp-alamat'),
    namaPenandatangan: v('spp-nama-penandatangan'), jabatanPenandatangan: v('spp-jabatan-penandatangan'),
    items: skiItemsForTemplate(merged),
  };

  try {
    await fillDocxTemplateAndDownload(SKI_TEMPLATE_PATHS.pengantar, data, `Surat_Pengantar_SKI_${data.noSuratPengantar.replace(/[^\w]+/g,'_')}`);
    showToast('✓ Surat Pengantar SKI berhasil digenerate & diunduh (.docx)', 'success');
  } catch (err) { /* toast already shown */ }
}

// ── Surat Pernyataan (untuk produk jadi) ───────────────────────────
async function generateSuratPernyataanSkiDocx() {
  const v = id => (document.getElementById(id)?.value || '').trim();
  const required = ['spp-no-surat-pernyataan','spp-tanggal','spp-nama-perusahaan','spp-alamat','spp-nama-penandatangan','spp-jabatan-penandatangan'];
  const missing = required.filter(id => !v(id));
  if (missing.length) { showToast(`Lengkapi dulu ${missing.length} field wajib (*).`, 'error'); return; }
  const merged = validateSppRows();
  if (!merged) return;

  const data = {
    tanggal: v('spp-tanggal'), noSuratPernyataan: v('spp-no-surat-pernyataan'),
    namaPerusahaan: v('spp-nama-perusahaan'), alamat: v('spp-alamat'),
    alamatPenandatangan: v('spp-alamat'),
    namaPenandatangan: v('spp-nama-penandatangan'), jabatanPenandatangan: v('spp-jabatan-penandatangan'),
    noApi: v('spp-no-api') || '-', npwp: v('spp-npwp') || '-',
    namaProdusen: v('spp-nama-produsen') || '-',
    alamatProdusen: (v('spp-alamat-produsen') || '-').replace(/\n+/g, ', '),
    namaEksportir: v('spp-nama-eksportir') || '-',
    alamatEksportir: v('spp-alamat-eksportir') || '-',
    items: skiItemsForTemplate(merged),
  };

  try {
    await fillDocxTemplateAndDownload(SKI_TEMPLATE_PATHS.pernyataan, data, `Surat_Pernyataan_SKI_${data.noSuratPernyataan.replace(/[^\w]+/g,'_')}`);
    showToast('✓ Surat Pernyataan SKI berhasil digenerate & diunduh (.docx)', 'success');
  } catch (err) { /* toast already shown */ }
}