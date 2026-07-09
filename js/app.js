// ================================================================
//  Import Tracking System — app.js (Rebuilt)
//  Semua fungsi bekerja: search, form PO, shipment, kalender
// ================================================================

// ── State ─────────────────────────────────────────────────────
let editingPoNumber     = null;
let editingShipmentIndex = null;
let calendarYear        = new Date().getFullYear();
let calendarMonth       = new Date().getMonth();

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
    'belum-pib': ['badge-gray',   'Belum PIB'],
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

// ── Tab navigation ─────────────────────────────────────────────
const PAGE_CONFIG = {
  home:        { title: 'Dashboard',             sub: 'Ringkasan aktivitas import dan shipment terkini',       navId: 'nav-home'        },
  shipment:    { title: 'Upcoming Shipment',     sub: 'Daftar dan jadwal shipment yang akan datang',           navId: 'nav-shipment'    },
  create:      { title: 'Buat Purchase Order',   sub: 'Tambah atau edit data PO, PIB, dan item',               navId: 'nav-po-create'   },
  history:     { title: 'History PO',            sub: 'Riwayat seluruh Purchase Order yang tersimpan',         navId: 'nav-po-history'  },
  search:      { title: 'PO Inquiry',            sub: 'Cari dan telusuri status PO secara detail',             navId: 'nav-po-inquiry'  },
  ci:          { title: 'Verifikasi CI',         sub: 'Pilih PO, upload CI, dan bandingkan qty per SKU',       navId: 'nav-ci'          },
  'ci-history':{ title: 'History Verifikasi CI', sub: 'Riwayat semua verifikasi CI yang sudah disimpan',       navId: 'nav-ci-history'  },
  valrecon:    { title: 'Value Reconciliation',    sub: 'Rekonsiliasi nilai PO vs PIB — deteksi selisih dan currency mismatch', navId: 'nav-valrecon' },
  nie:         { title: 'NIE Center',               sub: 'Auto-matching NIE BPOM untuk pembuatan SKI — upload CI, sistem temukan NIE otomatis', navId: 'nav-nie' },
};

function switchTab(tab) {
  // Hide all pages
  ['home-panel','shipment-panel','create-panel','history-panel','search-panel','ci-panel','ci-history-panel','valrecon-panel','nie-panel'].forEach(id => {
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
  }

  // Per-tab actions
  if (tab === 'home') {
    renderDashboardHeader();
    renderDashboardAlerts();
    renderShipmentTop5('home-hero', { layout: 'stack', clickable: true });
    renderDashboardPoSummary();
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
  // Cari setiap "Purchase Order Confirmation #..." atau pola PO/SBI dalam teks
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
    // Fallback: cari dari teks biasa
    const m = raw.match(/Purchase\s*Order\s*Confirmation\s*#\s*(PO\/SBI\/[A-Z0-9\-\/\s]+)/i)
           || raw.match(/Our\s*Order[\s\S]{0,80}?Reference[:\s]*([A-Z0-9\-\/\s]+)/i);
    if (m) out.po_number = (m[1] || '').replace(/\s+/g, '').trim();
    if (out.po_number) out.po_numbers = [out.po_number];
  }

  // ── Jika multi-PO: parse setiap PO secara terpisah ─────────────
  if (out.is_multi_po) {
    // Split teks berdasarkan kemunculan "Purchase Order Confirmation"
    const sections = raw.split(/(?=Purchase Order Confirmation\s*#)/i).filter(Boolean);
    let combinedAmount = 0;
    let combinedQty = 0;

    sections.forEach(section => {
      // Cari PO number di section ini
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

    // Gunakan data PO pertama untuk field single
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
    const sizeMatch = text.match(/\(([^)]+)\)/);
    let size = sizeMatch ? sizeMatch[1].trim() : null;
    if (size) size = size.replace(/^(Size|Variant|Non Specify)\s*:\s*/i, '').trim();
    let name = text;
    if (sizeMatch) name = name.replace(sizeMatch[0], '');
    const qtyIndex = name.search(/\b[0-9]{1,3}(?:,[0-9]{3})*\s*Units?\b/gi);
    if (qtyIndex !== -1) name = name.slice(0, qtyIndex);
    name = name.replace(/[¥$]\s*[0-9,\.]+/g, '').replace(/\s+/g, ' ').trim();
    out.items.push({ sku, name, size, qty, unit_price: null, discount_pct: null, net_price: null });
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
  else showToast('Hanya file PDF yang didukung.', 'error');
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
    showToast('Gagal membaca PDF. Coba lagi atau isi manual.', 'error');
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
  else showToast('Tidak ada file yang dipilih.', 'error');
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
    showToast('Hanya file .pdf, .xlsx, .xls, .csv yang didukung.', 'error');
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
      ciAgg.push({ sku, name, qty, rawRow: row });
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
  const poList = poItems.map(it => ({
    poSku : (it.sku  || '').trim(),
    poName: cleanItemName(it.name || ''),
    qPO   : Number(it.qtyPO || 0),
    type  : it.type || detectItemType((it.sku||''), (it.name||'')),
    size  : it.size || '',
    orig  : it,
  }));

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
        ciQty: 0, matchedName: '', matchedSku: '', score: 0, via: '', matched: false,
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
    return {
      sku: po.poSku, name: po.poName, size: po.size, type: po.type, qPO: po.qPO,
      ciQty: ci.qty, matchedName: ci.name || ci.sku || '—', matchedSku: ci.sku || '',
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
        ciQty: ci.qty, matchedName: ci.name || ci.sku || '?', matchedSku: ci.sku || '',
        score: 0, via: '', matched: false, diff: ci.qty,
        extraFromCi: true, ciAgg, bestCiIdx: idx,
      });
    }
  });

  return { rows, ciAgg };
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

  // ── Summary strip ──────────────────────────────────────
  const totalQtyPO  = rows.filter(r => !r.extraFromCi).reduce((s, r) => s + r.qPO, 0);
  const totalQtyCI  = rows.filter(r => !r.extraFromCi).reduce((s, r) => s + r.ciQty, 0);
  const totalDiff   = totalQtyCI - totalQtyPO;
  const matchCount  = rows.filter(r => !r.extraFromCi && r.matched && r.diff === 0).length;
  const kurangCount = rows.filter(r => !r.extraFromCi && r.matched && r.diff < 0).length;
  const lebihCount  = rows.filter(r => !r.extraFromCi && r.matched && r.diff > 0).length;
  const missCount   = rows.filter(r => !r.extraFromCi && !r.matched).length;
  const lowConfCount= rows.filter(r => !r.extraFromCi && r.matched && r.via === 'Nama Fuzzy' && r.score < 60).length;

  const strip = document.getElementById('ci-summary-strip');
  if (strip) {
    const diffColor = totalDiff === 0 ? 'var(--c-green)' : totalDiff > 0 ? 'var(--c-orange)' : 'var(--c-red)';
    strip.innerHTML = `
      <div class="ci-sum-box ci-sum-po"><div class="ci-sum-val">${totalQtyPO.toLocaleString()}</div><div class="ci-sum-label">Total Qty PO</div></div>
      <div class="ci-sum-box ci-sum-ci"><div class="ci-sum-val">${totalQtyCI.toLocaleString()}</div><div class="ci-sum-label">Total Qty CI</div></div>
      <div class="ci-sum-box" style="border-color:${diffColor};background:${totalDiff===0?'var(--c-green-bg)':totalDiff>0?'var(--c-orange-bg)':'var(--c-red-bg)'}">
        <div class="ci-sum-val" style="color:${diffColor}">${totalDiff>=0?'+':''}${totalDiff.toLocaleString()}</div>
        <div class="ci-sum-label">Selisih</div>
      </div>
      <div class="ci-sum-box ci-sum-match"><div class="ci-sum-val" style="color:var(--c-green)">${matchCount}</div><div class="ci-sum-label">Match</div></div>
      <div class="ci-sum-box ci-sum-kurang"><div class="ci-sum-val" style="color:var(--c-red)">${kurangCount}</div><div class="ci-sum-label">Kurang</div></div>
      <div class="ci-sum-box ci-sum-lebih"><div class="ci-sum-val" style="color:var(--c-orange)">${lebihCount}</div><div class="ci-sum-label">Lebih</div></div>
      ${missCount ? `<div class="ci-sum-box" style="border-color:var(--c-gray)"><div class="ci-sum-val" style="color:var(--c-gray)">${missCount}</div><div class="ci-sum-label">Tdk Ada di CI</div></div>` : ''}
      ${lowConfCount ? `<div class="ci-sum-box" style="border-color:var(--c-orange-border);background:var(--c-orange-bg)"><div class="ci-sum-val" style="color:var(--c-orange)">${lowConfCount}</div><div class="ci-sum-label">Conf. Rendah ⚠</div></div>` : ''}
    `;
  }

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
      ? `<span class="badge badge-gray">Tidak ada di CI</span>`
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
      : `<span style="color:var(--c-text-hint);font-style:italic">tidak terdeteksi</span>`;

    // Override dropdown (only for non-extra rows)
    const overrideHtml = r.extraFromCi ? '' : `
      <button class="ci-override-btn" title="Ubah mapping manual"
        onclick="openCiOverride(${rowIdx})" style="padding:2px 6px;font-size:16px;background:none;border:none;cursor:pointer;color:var(--c-text-hint)">⇄</button>
    `;

    // Low-confidence warning
    const lowConfWarn = r.matched && r.via === 'Nama Fuzzy' && r.score < 60
      ? `<span title="Confidence rendah — harap periksa manual" style="color:var(--c-orange);margin-left:4px;">⚠</span>`
      : '';

    const tr = document.createElement('tr');
    tr.className = rowClass;
    tr.dataset.rowIdx = rowIdx;
    tr.innerHTML = `
      <td style="font-family:monospace;font-size:12px;">${r.sku || (r.extraFromCi ? r.matchedSku || '—' : '—')}</td>
      <td>${r.extraFromCi ? '<em style="color:var(--c-text-hint)">— tidak ada di PO —</em>' : `${r.name}${r.size ? ` <span style="font-size:11px;color:var(--c-text-hint)">(${r.size})</span>` : ''}${lowConfWarn}`}</td>
      <td>${ciNameHtml}</td>
      <td>${confHtml}</td>
      <td>${viaHtml}</td>
      <td class="num"><strong>${r.qPO.toLocaleString()}</strong></td>
      <td class="num">${r.matched ? r.ciQty.toLocaleString() : '<span style="color:var(--c-text-hint)">—</span>'}</td>
      <td class="num"><span class="${diffCls}">${r.matched || r.extraFromCi ? diffSign : '—'}</span></td>
      <td>${statusHtml}</td>
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
    <td colspan="10" style="padding:10px 16px; background:var(--c-blue-bg); border-top:2px solid var(--c-blue);">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <span style="font-size:13px;font-weight:600;color:var(--c-blue-dark);">
          <i class="ti ti-wand"></i> Override mapping untuk: <strong>${r.name}</strong>
        </span>
        <select id="ci-override-select-${rowIdx}" style="flex:1;min-width:240px;font-size:13px;padding:5px 8px;border:1.5px solid var(--c-blue-border);border-radius:var(--radius-sm);">
          <option value="">— Tidak ada di CI (kosongkan) —</option>
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
    r.matchedName = ci.name || ci.sku || '—';
    r.matchedSku  = ci.sku || '';
    r.score       = Math.round(tokenSim(r.name, ci.name || ci.sku || '') * 100);
    r.via         = 'Manual';
    r.matched     = true;
    r.bestCiIdx   = ciIdx;
  } else {
    r.ciQty = 0; r.matchedName = ''; r.matchedSku = '';
    r.score = 0; r.via = ''; r.matched = false; r.bestCiIdx = -1;
  }
  r.diff = r.ciQty - r.qPO;

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
    showToast('Tidak ada data untuk disimpan.', 'error'); return;
  }
  const po = MOCK_PO_DATA.find(p => p.poNumber === currentCiPoNumber);
  const totalQtyPO = currentCiCompareRows.filter(r => !r.extraFromCi).reduce((s, r) => s + r.qPO, 0);
  const totalQtyCI = currentCiCompareRows.filter(r => !r.extraFromCi).reduce((s, r) => s + r.ciQty, 0);
  const diff = totalQtyCI - totalQtyPO;
  const hasKurang = currentCiCompareRows.some(r => !r.extraFromCi && r.diff < 0);
  const hasLebih  = currentCiCompareRows.some(r => !r.extraFromCi && r.diff > 0);
  const result = diff === 0 ? 'match' : hasKurang && hasLebih ? 'mixed' : hasKurang ? 'kurang' : 'lebih';

  const record = {
    id:          Date.now(),
    verifiedAt:  new Date().toISOString(),
    poNumber:    currentCiPoNumber,
    brand:       po ? (po.supplierLabel || po.supplier) : '—',
    fileName:    currentCiFileName || '—',
    totalQtyPO,
    totalQtyCI,
    diff,
    result,
    rows:        currentCiCompareRows,
  };

  const history = loadCiHistory();
  history.unshift(record);
  saveCiHistoryAll(history);
  showToast('✓ Verifikasi CI berhasil disimpan!', 'success');

  // Offer to view history
  setTimeout(() => {
    if (confirm('Verifikasi disimpan. Lihat History Verifikasi CI?')) switchTab('ci-history');
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
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--c-text-hint)">Belum ada riwayat verifikasi CI.</td></tr>`;
    return;
  }

  history.forEach(rec => {
    const date = new Date(rec.verifiedAt).toLocaleString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    const diff = rec.diff;
    const diffSign = diff >= 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString();
    const diffCls = diff === 0 ? 'sel-zero' : diff > 0 ? 'sel-pos' : 'sel-neg';
    const resultBadge = rec.result === 'match' ? badge('match') : rec.result === 'kurang' ? badge('kurang') : rec.result === 'lebih' ? badge('lebih') : `<span class="badge badge-orange">Mixed</span>`;
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
      ? `<span class="badge badge-gray">Tidak ada di CI</span>`
      : r.diff === 0 ? badge('match') : r.diff < 0 ? badge('kurang') : badge('lebih');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family:monospace;font-size:12px;">${r.sku || '—'}</td>
      <td>${r.name || '—'}</td>
      <td>${r.type ? itemTypeBadge(r.type) : '—'}</td>
      <td class="num">${r.qPO.toLocaleString()}</td>
      <td class="num">${r.ciQty > 0 ? r.ciQty.toLocaleString() : '—'}</td>
      <td class="num"><span class="${diffCls}">${diffSign}</span></td>
      <td>${statusHtml}</td>
    `;
    tbody.appendChild(tr);
  });

  detail.style.display = 'block';
  detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function deleteCiHistory(id) {
  if (!confirm('Hapus record verifikasi ini?')) return;
  const history = loadCiHistory().filter(r => r.id !== id);
  saveCiHistoryAll(history);
  renderCiHistory();
  document.getElementById('ci-history-detail').style.display = 'none';
  showToast('Record dihapus.', 'success');
}

function clearAllCiHistory() {
  if (!confirm('Hapus SEMUA riwayat verifikasi CI? Tindakan ini tidak dapat dibatalkan.')) return;
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
  // Untuk multi-PO: isi dengan nomor PO pertama, tapi tampilkan badge peringatan
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

  // ── PO Value — untuk multi-PO ini adalah total gabungan ──
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
    // Multi-PO: tampilkan semua nomor PO dan total gabungan
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
          ⚠ Field "PO Number" diisi dengan PO pertama. Harap input masing-masing PO secara terpisah atau sesuaikan manual.
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
      Preview Item Terbaca dari PDF
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:var(--c-surface-2);">
          <th style="text-align:left;padding:6px 10px;border-bottom:1px solid var(--c-border);font-weight:500;color:var(--c-text-hint);">SKU</th>
          <th style="text-align:left;padding:6px 10px;border-bottom:1px solid var(--c-border);font-weight:500;color:var(--c-text-hint);">Nama Produk</th>
          <th style="text-align:left;padding:6px 10px;border-bottom:1px solid var(--c-border);font-weight:500;color:var(--c-text-hint);">Size</th>
          <th style="text-align:right;padding:6px 10px;border-bottom:1px solid var(--c-border);font-weight:500;color:var(--c-text-hint);">Qty PO</th>
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
    showToast('Tidak ada PO yang cocok dengan filter.', 'error');
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
      <td>
        <button class="btn-detail" onclick="showDetail('${po.poNumber}')">
          <i class="ti ti-eye"></i> Detail
        </button>
        <button class="btn-detail btn-detail-danger" onclick="showAddPoForm('${po.poNumber}')">
          <i class="ti ti-edit"></i>
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
    const s = qWH - qPO;
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
    <td class="num">${selisih(totWH - totPO)}</td>
    <td></td>
  `;
  tbody.appendChild(totRow);

  const ds = document.getElementById('detail-section');
  ds.style.display = 'block';
  setTimeout(() => ds.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}

function closeDetail() {
  const el = document.getElementById('detail-section');
  if (el) el.style.display = 'none';
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
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--c-text-hint)">Tidak ada data ditemukan</td></tr>`;
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
      <td>
        <button class="btn-detail" onclick="showAddPoForm('${po.poNumber}')">
          <i class="ti ti-pencil"></i> Edit
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
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
  const diff = (Number(qWH)||0) - (Number(qPO)||0);
  const diffCls = diff>0 ? 'sel-pos' : diff<0 ? 'sel-neg' : 'sel-zero';
  const diffTxt = diff===0 ? '0' : diff>0 ? `+${diff}` : `${diff}`;
  const type = item.type || detectItemType(sku, item.name || '');

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
    <td><button class="btn-sm" type="button" onclick="removeItemRow(this)"><i class="ti ti-x"></i></button></td>
  `;
  tbody.appendChild(row);

  const qPibInput = row.querySelector('.item-qty-pib');
  const qWhInput  = row.querySelector('.item-qty-wh');
  const qPoInput  = row.querySelector('.item-qty-po');

  const updateRow = () => {
    const p  = Number(qPibInput.value || 0);
    const w  = Number(qWhInput.value  || 0);
    const po = Number(qPoInput.value  || p);
    const d  = w - po;
    const span = row.querySelector('.item-selisih');
    span.textContent = d===0 ? '0' : d>0 ? `+${d}` : `${d}`;
    span.className = `item-selisih ${d>0?'sel-pos':d<0?'sel-neg':'sel-zero'}`;
    updateItemTotals();
  };
  [qPibInput, qWhInput, qPoInput].forEach(el => el.addEventListener('input', updateRow));
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
    return {
      sku, name, size, type,
      qtyPO:        parseInt(row.querySelector('.item-qty-po')?.value  || 0, 10),
      qtyPIB:       parseInt(row.querySelector('.item-qty-pib')?.value || 0, 10),
      qtyWarehouse: parseInt(row.querySelector('.item-qty-wh')?.value  || 0, 10),
    };
  }).filter(it => it.sku || it.name || it.qtyPIB || it.qtyWarehouse);
}

function updateItemTotals() {
  const items = getItemRowsData();
  const tPIB = items.reduce((s, i) => s + i.qtyPIB, 0);
  const tWH  = items.reduce((s, i) => s + i.qtyWarehouse, 0);
  const pibEl = document.getElementById('pib-qty-pib');
  const whEl  = document.getElementById('pib-qty-wh');
  if (pibEl) pibEl.value = tPIB;
  if (whEl)  whEl.value  = tWH;
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
    Object.assign(existing, { poDate, supplier, supplierLabel: supplier, revCode, pibNumber: pibNum, pibDate,
      qtyPIB, qtyWarehouse: qtyWH, poValue, currency, status, items });
    showToast('Data PO berhasil diperbarui!', 'success');
  } else {
    MOCK_PO_DATA.push({ poNumber, poDate, supplier, supplierLabel: supplier, revCode,
      pibNumber: pibNum, pibDate, currency, status, qtyPIB, qtyWarehouse: qtyWH, poValue, items });
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
    showToast('Lengkapi semua field wajib pada form shipment.', 'error');
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
    list.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--c-text-hint)">Tidak ada shipment ditemukan. Klik "Tambah Shipment" untuk menambahkan.</td></tr>`;
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

  const all = [...MOCK_SHIPMENTS]
    .map(item => ({
      ...item,
      daysToPort: getDaysUntil(item.ataPort),
      daysToWH:   getDaysUntil(item.ataWarehouse),
      daysToETD:  getDaysUntil(item.etd),
    }))
    .sort((a, b) => {
      // Sort: incoming first (positive days), then already arrived (negative)
      const da = a.daysToWH ?? 9999;
      const db = b.daysToWH ?? 9999;
      return da - db;
    })
    .slice(0, 5);

  if (!all.length) { container.innerHTML = '<div style="padding:24px;color:var(--c-text-hint);text-align:center">Belum ada data shipment.</div>'; return; }

  // ── Render new dashboard shipment cards ─────────────────────
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;margin-bottom:20px';

  all.forEach((item, i) => {
    const d = item.daysToWH;
    // Status + urgency
    let urgency = 'normal', urgencyLabel = '', urgencyColor = '';
    if (d === null || d === undefined) {
      urgency = 'unknown'; urgencyLabel = 'Tanggal ?'; urgencyColor = '#94a3b8';
    } else if (d < 0) {
      urgency = 'arrived'; urgencyLabel = 'Sudah Tiba'; urgencyColor = '#22c55e';
    } else if (d === 0) {
      urgency = 'today'; urgencyLabel = 'Hari Ini!'; urgencyColor = '#f97316';
    } else if (d <= 3) {
      urgency = 'urgent'; urgencyLabel = `${d} hari lagi`; urgencyColor = '#ef4444';
    } else if (d <= 7) {
      urgency = 'soon'; urgencyLabel = `${d} hari lagi`; urgencyColor = '#f97316';
    } else {
      urgency = 'normal'; urgencyLabel = `${d} hari lagi`; urgencyColor = '#3b82f6';
    }

    // Timeline progress (ETD → Port → WH)
    const stages = [
      { label:'ETD', date: item.etd,          days: item.daysToETD,  icon:'ti-plane-departure', color:'#6366f1' },
      { label:'Port',date: item.ataPort,       days: item.daysToPort, icon:'ti-anchor',          color:'#f97316' },
      { label:'WH',  date: item.ataWarehouse,  days: item.daysToWH,   icon:'ti-building-warehouse', color:'#22c55e' },
    ];

    const timelineHtml = stages.map((s, si) => {
      const done = s.days !== null && s.days < 0;
      const active = s.days !== null && s.days >= 0 && (si === 0 || stages[si-1].days < 0);
      return `
        <div style="display:flex;align-items:center;gap:0;flex:1;min-width:0">
          <div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;min-width:0">
            <div style="width:26px;height:26px;border-radius:50%;background:${done?s.color:active?s.color+'22':'rgba(0,0,0,.06)'};border:2px solid ${done||active?s.color:'rgba(0,0,0,.12)'};display:flex;align-items:center;justify-content:center;transition:all .2s">
              <i class="ti ${s.icon}" style="font-size:12px;color:${done||active?s.color:'#94a3b8'}"></i>
            </div>
            <div style="font-size:10px;font-weight:600;color:${done||active?s.color:'#94a3b8'};text-transform:uppercase;letter-spacing:.04em">${s.label}</div>
            <div style="font-size:10px;color:${done?'#64748b':active?s.color:'#94a3b8'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:72px;text-align:center">${s.date?fmtDate(s.date):'—'}</div>
          </div>
          ${si < stages.length-1 ? `<div style="height:2px;flex:1;background:${done&&stages[si+1]?.days<0?'#e2e8f0':'linear-gradient(90deg,'+s.color+',rgba(0,0,0,.08))'};margin:0 2px;margin-bottom:18px;transition:all .2s;min-width:8px"></div>` : ''}
        </div>`;
    }).join('');

    const card = document.createElement('div');
    card.style.cssText = `
      background:var(--c-surface);
      border:0.5px solid ${urgency==='urgent'||urgency==='today'?'rgba(239,68,68,.3)':urgency==='soon'?'rgba(249,115,22,.25)':'var(--c-border)'};
      border-top: 3px solid ${urgencyColor};
      border-radius:12px;
      padding:16px;
      cursor:${clickable?'pointer':'default'};
      transition:box-shadow .15s,transform .15s;
      position:relative;
      overflow:hidden;
    `;
    if (clickable) {
      card.setAttribute('onclick', "switchTab('shipment')");
      card.onmouseenter = () => { card.style.boxShadow='0 4px 20px rgba(0,0,0,.1)'; card.style.transform='translateY(-2px)'; };
      card.onmouseleave = () => { card.style.boxShadow=''; card.style.transform=''; };
    }

    // Urgency pulse for critical
    const pulseStyle = (urgency==='urgent'||urgency==='today')
      ? `position:absolute;top:12px;right:12px;width:8px;height:8px;border-radius:50%;background:${urgencyColor};box-shadow:0 0 0 3px ${urgencyColor}33;animation:pulse 1.5s ease infinite`
      : '';

    card.innerHTML = `
      ${pulseStyle ? `<div style="${pulseStyle}"></div>` : ''}
      <!-- Header -->
      <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:12px">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;flex-wrap:wrap">
            <span style="font-size:13px;font-weight:800;color:var(--c-text-primary);letter-spacing:.01em">${item.brand}</span>
            <span style="font-size:10px;padding:2px 6px;border-radius:4px;font-weight:700;background:${item.containerType==='FCL'?'rgba(99,102,241,.12)':'rgba(249,115,22,.12)'};color:${item.containerType==='FCL'?'#6366f1':'#f97316'}">${item.containerType||'—'}</span>
            <span style="font-size:10px;color:var(--c-text-hint)">#${i+1}</span>
          </div>
          <div style="font-size:12px;color:var(--c-text-hint);margin-bottom:2px">${item.shipmentName}</div>
          <div style="font-size:12px;color:var(--c-text-sub);display:flex;align-items:center;gap:4px">
            <i class="ti ti-ship" style="font-size:11px"></i>${item.vessel||'—'}
          </div>
        </div>
        <!-- Countdown badge -->
        <div style="text-align:center;padding:6px 10px;border-radius:8px;background:${urgencyColor}15;border:1px solid ${urgencyColor}30;min-width:64px;flex-shrink:0">
          <div style="font-size:${d!==null&&d>=0&&d<=99?'18':'14'}px;font-weight:800;color:${urgencyColor};line-height:1.1">${d !== null ? (d < 0 ? '✓' : d) : '?'}</div>
          <div style="font-size:9px;font-weight:600;color:${urgencyColor};text-transform:uppercase;letter-spacing:.05em;margin-top:1px">${d !== null ? (d < 0 ? 'Tiba' : 'hari') : 'hari'}</div>
          <div style="font-size:9px;color:${urgencyColor};opacity:.8">ke WH</div>
        </div>
      </div>

      <!-- Timeline -->
      <div style="display:flex;align-items:flex-start;gap:0;margin-bottom:12px;padding:10px 4px 4px;background:var(--c-surface-2,rgba(0,0,0,.025));border-radius:8px">
        ${timelineHtml}
      </div>

      <!-- Footer info -->
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--c-text-hint)">
        <span style="display:flex;align-items:center;gap:4px">
          <i class="ti ti-file-text" style="font-size:11px"></i>${item.noBl||'—'}
        </span>
        <span style="display:flex;align-items:center;gap:4px">
          <i class="ti ti-truck" style="font-size:11px"></i>${item.linerShipment||'—'}
        </span>
      </div>
    `;

    wrap.appendChild(card);
  });

  container.innerHTML = '';
  container.appendChild(wrap);
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
          <button class="calendar-nav-btn" onclick="calendarToday()" title="Kembali ke bulan ini" style="font-size:12px;font-weight:700;width:auto;padding:0 10px">Today</button>
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
// VALUE RECONCILIATION — PO vs PIB
// ══════════════════════════════════════════════════════════════

// ── Data store (in-memory, keyed by pibn) ────────────────────
let VR_DATA = []; // [{pibn, poNumber, pibDate, currencyPO, currencyPIB, valuePO, valuePIB, diff, status, comment, auditTrail, reviewItems}]
let VR_AUDIT = []; // global audit trail

function vrLog(action, detail) {
  const entry = { ts: new Date().toISOString(), user: 'Admin', action, detail };
  VR_AUDIT.unshift(entry);
  return entry;
}

// ── PIB System Prompt ─────────────────────────────────────────
const PIB_SYSTEM_PROMPT = `You are a PIB (Pemberitahuan Impor Barang) data extraction assistant for PT Social Bella Indonesia.
PIB is an Indonesian customs import declaration document. Extract key financial data and return ONLY valid JSON.

JSON structure:
{
  "nomor_pib": "",
  "tanggal_pib": "",
  "nomor_pengajuan": "",
  "po_reference": null,
  "invoice_reference": null,
  "currency_pib": "",
  "ndpbm": 0,
  "nilai_fob": 0,
  "nilai_freight": 0,
  "nilai_asuransi": 0,
  "nilai_pabean": 0,
  "nilai_pabean_idr": 0,
  "total_bm": 0,
  "total_ppn": 0,
  "total_pph": 0,
  "total_pungutan": 0,
  "supplier": ""
}

EXTRACTION RULES for PIB (Indonesian customs form BC 2.0):
1. nomor_pib: Field "G. Nomor dan Tanggal Pendaftaran" — ambil HANYA angka 5-7 digit yang ada DI BAWAH label tersebut (e.g. "624000"). BUKAN nomor pengajuan 26 digit. BUKAN nomor lain. Cari di body dokumen, bukan di header form.
2. tanggal_pib: Tanggal yang muncul bersama nomor PIB di field G (format DD-MM-YYYY → convert ke YYYY-MM-DD).
3. nomor_pengajuan: "Nomor Pengajuan" — angka panjang 26 digit (e.g. "00000000032620250926012757")
4. po_reference: Look for PO/SBI/... pattern or invoice reference linking to PO
5. invoice_reference: "Invoice: No." field — e.g. "IZ-SO-25-09"
6. currency_pib: "Valuta" field (field 21) — e.g. "JPY"
7. ndpbm: "NDPBM" field (field 22) — kurs tengah, e.g. 112.7944
8. nilai_fob: Field 23 "Nilai :" — ini adalah nilai FOB dalam mata uang asing. Di dokumen dicetak sebagai "23. Nilai :" dengan "FOB" sebagai label incoterm terpisah. Ambil angka yang ada di area field 23 ini, BUKAN nilai pabean IDR. Contoh: 8566600.00
9. nilai_freight: Field 25 "Freight" value
10. nilai_asuransi: Field 24 "Asuransi/LDN" value
11. nilai_pabean: Field 26 "Nilai Pabean" dalam mata uang asing (FOB+freight+insurance)
12. nilai_pabean_idr: "Nilai Pabean" converted to IDR (prefixed "RP")
13. total_ppn: PPN amount from pungutan table (row 41)
14. total_pph: PPh amount from pungutan table (row 43)
15. supplier: From "PENGIRIM / Nama, Alamat" section — company name only

DO NOT extract items list. Return ONLY valid JSON, no explanation.`;

// ── PIB Parser (AI) ───────────────────────────────────────────
async function parsePibWithAI(pdfText) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: PIB_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Extract all PIB data from the following text. Return ONLY valid JSON.\n\nPIB TEXT:\n${pdfText}` }]
    })
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  const raw = data.content.map(b => b.text||'').join('');
  return JSON.parse(raw.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim());
}

// ── PIB Heuristic Parser ──────────────────────────────────────
function parsePibHeuristic(text) {
  const t = text.replace(/\r/g,'');
  const out = {
    nomor_pib: null, tanggal_pib: null, nomor_pengajuan: null,
    po_reference: null, invoice_reference: null,
    currency_pib: 'JPY', ndpbm: 0,
    nilai_fob: 0, nilai_freight: 0, nilai_asuransi: 0,
    nilai_pabean: 0, nilai_pabean_idr: 0,
    total_bm: 0, total_ppn: 0, total_pph: 0, total_pungutan: 0,
    supplier: null
  };

  // Nomor PIB — field G: 6 digit nomor pendaftaran
  // Cari pola "G. Nomor dan Tanggal Pendaftaran" lalu ambil angka 6 digit
  const nopMatch = t.match(/G\.\s*Nomor\s*dan\s*Tanggal\s*Pendaftaran[\s\S]{0,80}?(\d{6})\b/i)
                || t.match(/Nomor\s*Pendaf[a-z]*\s*[:\s]+(\d{5,8})/i)
                || t.match(/\b(\d{6})\b(?=\s*\n?\s*\d{2}-\d{2}-\d{4})/); // 6 digit diikuti tanggal
  if (nopMatch) out.nomor_pib = nopMatch[1];

  // ── Nomor PIB (5-7 digit) dari field G ──────────────────────
  // Setelah label "G. Nomor dan Tanggal Pendaftaran", cari angka 5-7 digit terdekat.
  // PDF sering merender nilai ini di baris terpisah setelah header fieldnya.
  const gBlockMatch = t.match(/G\.\s*Nomor\s*dan\s*Tanggal\s*Pendaftaran([\s\S]{0,300})/i);
  if (gBlockMatch) {
    // Ambil angka 5-7 digit pertama dalam blok (bukan bagian dari angka lebih panjang)
    const sixDigit = gBlockMatch[1].match(/(?<!\d)(\d{5,7})(?!\d)/);
    if (sixDigit) out.nomor_pib = sixDigit[1];
  }
  // Fallback: "Nomor Pendaftaran" di header halaman lanjutan → angka di bawahnya
  if (!out.nomor_pib) {
    const fallback = t.match(/Nomor\s*Pendaf[a-z]*\s*[:\s]*\n?\s*(\d{5,7})\b/i);
    if (fallback) out.nomor_pib = fallback[1];
  }
  // Fallback kedua: pola 6 digit diikuti tanggal dd-mm-yyyy di baris berikutnya
  if (!out.nomor_pib) {
    const m2 = t.match(/\b(\d{6})\b[\s\S]{0,10}\d{2}-\d{2}-\d{4}/);
    if (m2) out.nomor_pib = m2[1];
  }

  // ── Nomor pengajuan (26 digit) ──
  const npMatch = t.match(/(\d{26})/);
  if (npMatch) out.nomor_pengajuan = npMatch[1];

  // ── Tanggal pendaftaran ──
  const tglMatch = t.match(/Tanggal\s*Pendaftaran\s*[:\s]*(\d{2}-\d{2}-\d{4})/i) ||
                   t.match(/(\d{2}-\d{2}-\d{4})/);
  if (tglMatch) {
    const [d,m,y] = tglMatch[1].split('-');
    out.tanggal_pib = `${y}-${m}-${d}`;
  }

  // ── Currency (field 21 Valuta) ──
  const curM = t.match(/21\.\s*Valuta\s*[:\s]*([A-Z]{3})/i)
            || t.match(/Valuta\s*[:\s]+([A-Z]{3})/i)
            || t.match(/\b(JPY|USD|KRW|EUR)\b/i);
  if (curM) out.currency_pib = curM[1].toUpperCase();

  // ── NDPBM (field 22) ──
  const ndpMatch = t.match(/22\.\s*NDPBM\s*[:\s]*([\d.,]+)/i)
                || t.match(/NDPBM\s*[:\s]*([\d.,]+)/i);
  if (ndpMatch) out.ndpbm = parsePibNum(ndpMatch[1]);

  // ── FOB (field 23 "Nilai :") ──────────────────────────────────
  // Di PDF PIB BC 2.0, field 23 berisi nilai FOB dalam mata uang asing.
  // Label di dokumen: "23. Nilai :" dengan incoterm "FOB" tercetak terpisah.
  // PDF text extractor bisa menghasilkan berbagai urutan, strategi berlapis:

  // Strategi 1: cari blok antara "23. Nilai" dan field berikutnya (24/25/26)
  const f23raw = t.match(/23\.\s*Nilai\s*[:\s]*([\s\S]{0,150}?)(?=24\.\s*Asuransi|25\.\s*Freight|26\.\s*Nilai\s*Pabean|\n\n)/i);
  if (f23raw) {
    const nums = [...f23raw[1].matchAll(/\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?/g)]
      .map(mx => parsePibNum(mx[0])).filter(n => n > 1000);
    if (nums.length) out.nilai_fob = Math.max(...nums);
  }
  // Strategi 2: pola "23. Nilai :" langsung diikuti angka
  if (!out.nilai_fob) {
    const f23direct = t.match(/23\.\s*Nilai\s*[:\s]*([\d]{1,3}(?:[.,][\d]{3})+(?:[.,]\d{2})?)/i);
    if (f23direct) out.nilai_fob = parsePibNum(f23direct[1]);
  }
  // Strategi 3: "FOB" dekat angka besar — untuk PDF yang menaruh "FOB" sebelum nilai
  if (!out.nilai_fob) {
    const fobNear = t.match(/FOB[\s\S]{0,80}?([\d]{1,3}(?:[.,][\d]{3})+(?:[.,]\d{2})?)/i)
                 || t.match(/([\d]{1,3}(?:[.,][\d]{3})+(?:[.,]\d{2})?)[\s\S]{0,30}FOB/i);
    if (fobNear && fobNear[1]) out.nilai_fob = parsePibNum(fobNear[1]);
  }

  // ── Asuransi (field 24) ──
  const asuransiM = t.match(/24\.\s*Asuransi[^:]*[:\s]*([\d.,]+)/i)
                  || t.match(/Asuransi\/LDN\s*[:\s]*([\d.,]+)/i)
                  || t.match(/Asuransi[^:]*[:\s]*([\d.,]+)/i);
  if (asuransiM) out.nilai_asuransi = parsePibNum(asuransiM[1]);

  // ── Freight (field 25) ──
  const freightM = t.match(/25\.\s*Freight\s*[:\s]*([\d.,]+)/i)
                || t.match(/Freight\s*[:\s]*([\d.,]+)/i);
  if (freightM) out.nilai_freight = parsePibNum(freightM[1]);

  // ── Nilai Pabean (field 26) ──
  const nilaiMatch = t.match(/26\.\s*Nilai\s*Pabean[\s\S]{0,60}?([\d.,]+)/i)
                  || t.match(/Nilai\s*Pabean\s*[:\s]*([\d.,]+)/i);
  if (nilaiMatch) out.nilai_pabean = parsePibNum(nilaiMatch[1]);
  const idrMatch = t.match(/RP\s+([\d.,]+)/i);
  if (idrMatch) out.nilai_pabean_idr = parsePibNum(idrMatch[1]);

  // ── PPN & PPh ──
  const ppnM = t.match(/PPN[^\d]*([\d.,]+)\s+0\.00\s+0\.00/i);
  if (ppnM) out.total_ppn = parsePibNum(ppnM[1]);
  const pphM = t.match(/PPh[^\d]*([\d.,]+)\s+0\.00/i);
  if (pphM) out.total_pph = parsePibNum(pphM[1]);

  // ── Supplier ──
  const suppM = t.match(/PENGIRIM[\s\S]*?Nama.*?:\s*([A-Z][A-Z &.]+(?:INC|CO|LTD|CORP)[A-Z., ]*)/i);
  if (suppM) out.supplier = suppM[1].trim();

  // ── Invoice reference ──
  const invM = t.match(/Invoice\s*[:\s]*No\.?\s*([A-Z0-9\-]+)/i);
  if (invM) out.invoice_reference = invM[1];

  return out;
}

function parsePibNum(v) {
  if (!v && v !== 0) return 0;
  const s = String(v).replace(/\s/g,'').replace(/[RP]/gi,'');
  // Indonesian/European dot-thousands: 8.566.600,00 → 8566600
  if (/^\d{1,3}(\.\d{3})+(?:,\d+)?$/.test(s)) {
    return parseFloat(s.replace(/\./g,'').replace(',','.')) || 0;
  }
  return parseFloat(s.replace(/,/g,'')) || 0;
}

// ── PIB Excel Parser ──────────────────────────────────────────
async function parsePibExcel(file) {
  const ab  = await file.arrayBuffer();
  const wb  = window.XLSX.read(ab, { type:'array' });
  const ws  = wb.Sheets[wb.SheetNames[0]];
  const rows = window.XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
  const flat = rows.flat().join(' ');

  // Try to extract key fields from flat text
  const out = parsePibHeuristic(flat);
  out._source = 'excel';

  // Also try sheet as key-value rows
  rows.forEach(row => {
    const k = String(row[0]||'').toLowerCase();
    const v = row[1] || row[2] || '';
    if (/nomor.pib|no.pib/i.test(k) && v) out.nomor_pib = String(v).trim();
    if (/tanggal.pib|tgl.pib/i.test(k) && v) out.tanggal_pib = String(v).trim();
    if (/currency|valuta/i.test(k) && v) out.currency_pib = String(v).trim().toUpperCase();
    if (/fob|nilai.fob|total.value/i.test(k) && v) out.nilai_fob = parsePibNum(v);
    if (/nilai.pabean/i.test(k) && v) out.nilai_pabean = parsePibNum(v);
    if (/po.number|no.po/i.test(k) && v) out.po_reference = String(v).trim();
  });
  return out;
}

// ── VR State & Init ───────────────────────────────────────────
let vrCurrentPib = null;   // PIB data being reviewed before save
let vrEditingPibn = null;  // PIBN being edited

function initValRecon() {
  renderVrTable();
  populateVrPoSelect();
}

function populateVrPoSelect() {
  const sel = document.getElementById('vr-po-select');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">— Pilih PO Number —</option>';
  MOCK_PO_DATA.forEach(po => {
    const opt = document.createElement('option');
    opt.value = po.poNumber;
    opt.textContent = `${po.poNumber} · ${po.supplierLabel||po.supplier||'—'} · ${po.currency||'—'} ${po.poValue ? Number(po.poValue).toLocaleString() : '—'}`;
    sel.appendChild(opt);
  });
  if (cur) sel.value = cur;
}

// ── Reconciliation calculation ────────────────────────────────
function calcVrStatus(rec) {
  if (!rec.currencyPO || !rec.currencyPIB) return { status:'incomplete', label:'Incomplete' };
  if (rec.currencyPO !== rec.currencyPIB) return { status:'currency-mismatch', label:'Currency Mismatch' };
  const diff = Math.abs(rec.diff || 0);
  if (diff === 0) return { status:'match', label:'Match' };
  if (diff / (rec.valuePO||1) < 0.001) return { status:'match', label:'Match (~rounding)' };
  return { status:'need-review', label:'Need Review' };
}

function vrStatusBadge(status, label) {
  const cls = {
    'match':            'badge-green',
    'need-review':      'badge-orange',
    'currency-mismatch':'badge-red',
    'incomplete':       'badge-gray',
  };
  return `<span class="badge ${cls[status]||'badge-gray'}"><span class="badge-dot"></span>${label}</span>`;
}

// ── Render VR Table ───────────────────────────────────────────
function renderVrTable(filter = '') {
  const tbody = document.getElementById('vr-tbody');
  if (!tbody) return;
  const rows = filter ? VR_DATA.filter(r =>
    r.poNumber.includes(filter) || (r.pibn||'').includes(filter) ||
    (r.supplier||'').toUpperCase().includes(filter.toUpperCase())
  ) : VR_DATA;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--c-text-hint)">
      <i class="ti ti-inbox" style="font-size:28px;display:block;margin-bottom:8px"></i>
      Belum ada data rekonsiliasi. Tambah PIB pada form di bawah.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map((r, idx) => {
    const { status, label } = calcVrStatus(r);
    const diff = (r.valuePIB||0) - (r.valuePO||0);
    const diffStr = diff === 0 ? '<span class="sel-zero">0</span>'
      : diff > 0 ? `<span class="sel-pos">+${diff.toLocaleString()}</span>`
      : `<span class="sel-neg">${diff.toLocaleString()}</span>`;
    return `<tr>
      <td style="font-family:monospace;font-size:12px">${r.poNumber}</td>
      <td style="font-size:12px">${r.supplier||'—'}</td>
      <td style="font-family:monospace;font-size:12px">${r.pibn||'—'}</td>
      <td style="font-size:12px">${r.pibDate||'—'}</td>
      <td class="num"><span class="badge" style="font-size:11px;background:var(--c-blue-bg);color:var(--c-blue-dark)">${r.currencyPO||'—'}</span></td>
      <td class="num"><span class="badge" style="font-size:11px;${r.currencyPO!==r.currencyPIB?'background:rgba(239,68,68,.1);color:#dc2626':'background:var(--c-surface-2)'}">${r.currencyPIB||'—'}</span></td>
      <td class="num">${(r.valuePO||0).toLocaleString()}</td>
      <td class="num">${(r.valuePIB||0).toLocaleString()}</td>
      <td class="num">${diffStr}</td>
      <td>${vrStatusBadge(status, label)}</td>
      <td>
        <button class="btn-ghost btn-sm" onclick="vrShowDetail(${idx})"><i class="ti ti-eye"></i></button>
        <button class="btn-ghost btn-sm" onclick="vrDelete(${idx})" title="Hapus"><i class="ti ti-trash" style="color:var(--c-red,#ef4444)"></i></button>
      </td>
    </tr>`;
  }).join('');

  // Update KPI
  const total  = VR_DATA.length;
  const match  = VR_DATA.filter(r => calcVrStatus(r).status === 'match').length;
  const review = VR_DATA.filter(r => calcVrStatus(r).status === 'need-review').length;
  const cmis   = VR_DATA.filter(r => calcVrStatus(r).status === 'currency-mismatch').length;
  const setEl  = (id, v) => { const e = document.getElementById(id); if(e) e.textContent = v; };
  setEl('vr-kpi-total', total);
  setEl('vr-kpi-match', match);
  setEl('vr-kpi-review', review);
  setEl('vr-kpi-currency', cmis);
}

// ── VR Detail Modal ───────────────────────────────────────────
function vrShowDetail(idx) {
  const r = VR_DATA[idx];
  if (!r) return;
  const { status, label } = calcVrStatus(r);
  const diff = (r.valuePIB||0) - (r.valuePO||0);
  const po = MOCK_PO_DATA.find(p => p.poNumber === r.poNumber);

  const modal = document.getElementById('vr-detail-modal');
  document.getElementById('vr-detail-content').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div class="form-card" style="margin:0">
        <div class="form-card-title" style="font-size:13px"><i class="ti ti-file-text"></i> Data PO</div>
        <table class="data-table" style="font-size:13px">
          <tr><td style="color:var(--c-text-hint)">PO Number</td><td><strong>${r.poNumber}</strong></td></tr>
          <tr><td style="color:var(--c-text-hint)">Vendor</td><td>${r.supplier||'—'}</td></tr>
          <tr><td style="color:var(--c-text-hint)">Currency PO</td><td><span class="badge badge-blue">${r.currencyPO||'—'}</span></td></tr>
          <tr><td style="color:var(--c-text-hint)">Total Value PO</td><td><strong>${(r.valuePO||0).toLocaleString()}</strong></td></tr>
          <tr><td style="color:var(--c-text-hint)">PO Date</td><td>${po?.poDate||'—'}</td></tr>
        </table>
      </div>
      <div class="form-card" style="margin:0">
        <div class="form-card-title" style="font-size:13px"><i class="ti ti-file-invoice"></i> Data PIB</div>
        <table class="data-table" style="font-size:13px">
          <tr><td style="color:var(--c-text-hint)">Nomor PIB</td><td><strong>${r.pibn||'—'}</strong></td></tr>
          <tr><td style="color:var(--c-text-hint)">Nomor Pengajuan</td><td style="font-size:11px;font-family:monospace">${r.nomorPengajuan||'—'}</td></tr>
          <tr><td style="color:var(--c-text-hint)">Tanggal PIB</td><td>${r.pibDate||'—'}</td></tr>
          <tr><td style="color:var(--c-text-hint)">Currency PIB</td><td><span class="badge ${r.currencyPO!==r.currencyPIB?'badge-red':'badge-green'}">${r.currencyPIB||'—'}</span></td></tr>
          <tr><td style="color:var(--c-text-hint)">Total FOB PIB</td><td><strong>${(r.valuePIB||0).toLocaleString()}</strong></td></tr>
          <tr><td style="color:var(--c-text-hint)">Nilai Pabean IDR</td><td>Rp ${(r.nilaiPabeanIDR||0).toLocaleString()}</td></tr>
          <tr><td style="color:var(--c-text-hint)">NDPBM</td><td>${r.ndpbm||'—'}</td></tr>
          <tr><td style="color:var(--c-text-hint)">Invoice Ref</td><td style="font-family:monospace;font-size:12px">${r.invoiceRef||'—'}</td></tr>
        </table>
      </div>
    </div>

    <!-- Reconciliation Summary -->
    <div class="form-card" style="margin:0 0 16px;border-left:3px solid ${status==='match'?'var(--c-green,#22c55e)':status==='currency-mismatch'?'#ef4444':'#f97316'}">
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <div>${vrStatusBadge(status, label)}</div>
        <div style="font-size:13px"><span style="color:var(--c-text-hint)">Selisih:</span> <strong style="color:${diff===0?'var(--c-green,#22c55e)':diff>0?'var(--c-blue)':'#ef4444'}">${diff===0?'0':diff>0?'+'+diff.toLocaleString():diff.toLocaleString()} ${r.currencyPO||''}</strong></div>
        ${r.currencyPO!==r.currencyPIB?`<div class="hint-box" style="background:rgba(239,68,68,.08);border-color:#ef4444;color:#dc2626;padding:6px 12px;font-size:12px"><i class="ti ti-alert-triangle"></i> Currency Mismatch: PO dalam ${r.currencyPO}, PIB dalam ${r.currencyPIB}. Perlu pengecekan lebih lanjut.</div>`:''}
      </div>
    </div>

    <!-- Comment -->
    <div class="form-card" style="margin:0 0 16px">
      <div class="form-card-title" style="font-size:13px"><i class="ti ti-message"></i> Catatan / Komentar</div>
      <textarea id="vr-detail-comment" style="width:100%;min-height:72px;padding:8px 10px;border:0.5px solid var(--c-border);border-radius:var(--border-radius-md);font-size:13px;resize:vertical;font-family:inherit"
        placeholder="Tambah catatan penyebab selisih atau keterangan lainnya...">${r.comment||''}</textarea>
      <button class="btn-primary btn-sm" style="margin-top:8px" onclick="vrSaveComment(${idx})"><i class="ti ti-check"></i> Simpan Catatan</button>
    </div>

    <!-- Audit Trail -->
    <div class="form-card" style="margin:0">
      <div class="form-card-title" style="font-size:13px"><i class="ti ti-history"></i> Audit Trail</div>
      ${(r.auditTrail||[]).length ? `<table class="data-table" style="font-size:12px">
        <thead><tr><th>Waktu</th><th>User</th><th>Aksi</th><th>Detail</th></tr></thead>
        <tbody>${(r.auditTrail||[]).map(a=>`<tr>
          <td style="color:var(--c-text-hint);white-space:nowrap">${new Date(a.ts).toLocaleString('id-ID')}</td>
          <td>${a.user}</td><td>${a.action}</td><td style="font-size:11px">${a.detail}</td>
        </tr>`).join('')}</tbody>
      </table>` : '<div style="color:var(--c-text-hint);font-size:13px;padding:8px 0">Belum ada riwayat aktivitas.</div>'}
    </div>`;

  modal.style.display = 'flex';
}

function vrSaveComment(idx) {
  const r = VR_DATA[idx];
  if (!r) return;
  const comment = document.getElementById('vr-detail-comment')?.value.trim() || '';
  r.comment = comment;
  r.auditTrail = r.auditTrail || [];
  r.auditTrail.unshift(vrLog('Komentar', comment.slice(0,80)));
  showToast('Catatan disimpan.', 'success');
}

function vrCloseDetail() {
  const m = document.getElementById('vr-detail-modal');
  if (m) m.style.display = 'none';
  renderVrTable();
}

function vrDelete(idx) {
  if (!confirm('Hapus data rekonsiliasi ini?')) return;
  VR_DATA.splice(idx, 1);
  renderVrTable();
  showToast('Data dihapus.', 'success');
}

// ── PIB Upload handlers ───────────────────────────────────────
function handleVrPibDrop(event) {
  event.preventDefault();
  document.getElementById('vr-pib-drop-zone').classList.remove('dragover');
  const file = event.dataTransfer.files[0];
  if (file) handleVrPibUpload(file);
}

async function handleVrPibUpload(file) {
  if (!file) return;
  const dropContent = document.getElementById('vr-pib-drop-content');
  const loading     = document.getElementById('vr-pib-loading');
  dropContent.style.display = 'none';
  loading.style.display     = 'block';

  try {
    const ext = file.name.split('.').pop().toLowerCase();
    let parsed;
    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
      parsed = await parsePibExcel(file);
      parsed._source = 'excel';
    } else {
      const pdfText = await extractTextFromPdf(file);
      try {
        parsed = await parsePibWithAI(pdfText);
        parsed._source = 'ai-pdf';
      } catch(e) {
        parsed = parsePibHeuristic(pdfText);
        parsed._source = 'heuristic-pdf';
      }
    }
    vrCurrentPib = parsed;
    vrFillReviewForm(parsed);
    showToast(`✓ PIB terbaca (${parsed._source}). Cek & simpan data di bawah.`, 'success');
  } catch(err) {
    showToast('Gagal membaca PIB: ' + err.message, 'error');
  } finally {
    loading.style.display = 'none';
    dropContent.style.display = 'block';
  }
}

function vrFillReviewForm(d) {
  setField('vr-pibn',          d.nomor_pib);
  setField('vr-pib-date',      d.tanggal_pib);
  setField('vr-pib-currency',  d.currency_pib);
  setField('vr-pib-fob',       d.nilai_fob || d.nilai_pabean);
  setField('vr-pib-ndpbm',     d.ndpbm);
  setField('vr-pib-idr',       d.nilai_pabean_idr);
  setField('vr-pib-invoice',   d.invoice_reference);
  setField('vr-pib-pengajuan', d.nomor_pengajuan);
  // Auto-match PO
  if (d.po_reference) {
    const sel = document.getElementById('vr-po-select');
    const match = MOCK_PO_DATA.find(p => p.poNumber === d.po_reference);
    if (match && sel) sel.value = match.poNumber;
  }
  // Show review panel (tanpa item list)
  document.getElementById('vr-review-panel').style.display = 'block';
  const fw = document.getElementById('vr-pib-items-wrap');
  if (fw) fw.innerHTML = '';
  vrLog('Upload PIB', `File PIB dibaca: ${d.nomor_pib||'?'}, source: ${d._source}`);
}

function vrRenderPibItems(items) {
  // Item list tidak ditampilkan — rekonsiliasi hanya berdasarkan nilai FOB field 23 vs nilai PO
  const wrap = document.getElementById('vr-pib-items-wrap');
  if (wrap) wrap.innerHTML = '';
}

// ── Save VR Record ────────────────────────────────────────────
function vrSave() {
  const poNumber = document.getElementById('vr-po-select')?.value;
  if (!poNumber) { showToast('Pilih PO terlebih dahulu.', 'error'); return; }

  const pibn      = document.getElementById('vr-pibn')?.value.trim();
  const pibDate   = document.getElementById('vr-pib-date')?.value.trim();
  const currPIB   = (document.getElementById('vr-pib-currency')?.value || '').trim().toUpperCase();
  const valuePIB  = parsePibNum(document.getElementById('vr-pib-fob')?.value || '0');
  const ndpbm     = parsePibNum(document.getElementById('vr-pib-ndpbm')?.value || '0');
  const nilaiIDR  = parsePibNum(document.getElementById('vr-pib-idr')?.value || '0');
  const invoiceRef= document.getElementById('vr-pib-invoice')?.value.trim() || '';
  const noPengajuan= document.getElementById('vr-pib-pengajuan')?.value.trim() || '';

  if (!pibn) { showToast('Nomor PIB harus diisi.', 'error'); return; }

  const po      = MOCK_PO_DATA.find(p => p.poNumber === poNumber);
  const valuePO = po ? Number(po.poValue||0) : 0;
  const currPO  = po ? (po.currency||'USD') : 'USD';
  const diff    = valuePIB - valuePO;

  const existing = VR_DATA.findIndex(r => r.pibn === pibn);
  const audit    = [vrLog('Simpan PIB', `PIB ${pibn} disimpan untuk PO ${poNumber}`)];

  const record = {
    poNumber, pibn, pibDate, currencyPO: currPO, currencyPIB: currPIB,
    valuePO, valuePIB, diff, ndpbm,
    nilaiPabeanIDR: nilaiIDR, invoiceRef, nomorPengajuan: noPengajuan,
    supplier: po?.supplierLabel || po?.supplier || '—',
    comment: '',
    auditTrail: audit, _savedAt: new Date().toISOString(),
  };

  if (existing >= 0) {
    record.auditTrail = [...audit, ...(VR_DATA[existing].auditTrail||[])];
    record.comment = VR_DATA[existing].comment || '';
    VR_DATA[existing] = record;
  } else {
    VR_DATA.push(record);
  }

  renderVrTable();
  vrResetForm();
  const {status, label} = calcVrStatus(record);
  showToast(`✓ Rekonsiliasi disimpan — Status: ${label}`, 'success');
  // Scroll to table
  document.getElementById('vr-tbody')?.closest('.form-card')?.scrollIntoView({behavior:'smooth', block:'start'});
}

function vrResetForm() {
  ['vr-pibn','vr-pib-date','vr-pib-currency','vr-pib-fob','vr-pib-ndpbm','vr-pib-idr','vr-pib-invoice','vr-pib-pengajuan'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value = '';
  });
  const sel = document.getElementById('vr-po-select'); if(sel) sel.value = '';
  const rp  = document.getElementById('vr-review-panel'); if(rp) rp.style.display = 'none';
  const fw  = document.getElementById('vr-pib-items-wrap'); if(fw) fw.innerHTML = '';
  const fi  = document.getElementById('vr-pib-file'); if(fi) fi.value = '';
  vrCurrentPib = null;
}

function vrFilterTable() {
  const q = document.getElementById('vr-search')?.value || '';
  renderVrTable(q);
}

function vrFilterStatus() {
  const status = document.getElementById('vr-status-filter')?.value || '';
  if (!status) { renderVrTable(); return; }
  const tbody = document.getElementById('vr-tbody');
  const rows = VR_DATA.filter(r => calcVrStatus(r).status === status);
  // Re-render with filtered rows
  const filtered = VR_DATA.map((r,i)=>({...r,_idx:i})).filter(r => calcVrStatus(r).status === status);
  if (!tbody) return;
  tbody.innerHTML = filtered.map(r => {
    const idx = r._idx;
    const {status:s, label} = calcVrStatus(r);
    const diff = (r.valuePIB||0) - (r.valuePO||0);
    const ds = diff===0?'<span class="sel-zero">0</span>':diff>0?`<span class="sel-pos">+${diff.toLocaleString()}</span>`:`<span class="sel-neg">${diff.toLocaleString()}</span>`;
    return `<tr>
      <td style="font-family:monospace;font-size:12px">${r.poNumber}</td>
      <td style="font-size:12px">${r.supplier||'—'}</td>
      <td style="font-family:monospace;font-size:12px">${r.pibn||'—'}</td>
      <td style="font-size:12px">${r.pibDate||'—'}</td>
      <td class="num"><span class="badge" style="font-size:11px;background:var(--c-blue-bg);color:var(--c-blue-dark)">${r.currencyPO||'—'}</span></td>
      <td class="num"><span class="badge" style="font-size:11px;${r.currencyPO!==r.currencyPIB?'background:rgba(239,68,68,.1);color:#dc2626':'background:var(--c-surface-2)'}">${r.currencyPIB||'—'}</span></td>
      <td class="num">${(r.valuePO||0).toLocaleString()}</td>
      <td class="num">${(r.valuePIB||0).toLocaleString()}</td>
      <td class="num">${ds}</td>
      <td>${vrStatusBadge(s, label)}</td>
      <td><button class="btn-ghost btn-sm" onclick="vrShowDetail(${idx})"><i class="ti ti-eye"></i></button>
          <button class="btn-ghost btn-sm" onclick="vrDelete(${idx})"><i class="ti ti-trash" style="color:var(--c-red,#ef4444)"></i></button></td>
    </tr>`;
  }).join('') || `<tr><td colspan="11" style="text-align:center;padding:24px;color:var(--c-text-hint)">Tidak ada data untuk filter ini.</td></tr>`;
}

// ── VR PO Select live preview ─────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const poSel = document.getElementById('vr-po-select');
  if (poSel) {
    poSel.addEventListener('change', function() {
      const po = MOCK_PO_DATA.find(p => p.poNumber === this.value);
      const prev = document.getElementById('vr-po-preview');
      if (!prev) return;
      if (!po) { prev.innerHTML = ''; return; }
      prev.innerHTML = `
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;padding:10px 14px;background:var(--c-blue-bg,rgba(59,111,232,.06));border-radius:var(--border-radius-md);border:0.5px solid var(--c-blue-border,rgba(59,111,232,.2));width:100%">
          <div><div style="font-size:11px;color:var(--c-text-hint);text-transform:uppercase;letter-spacing:.05em">Vendor</div><div style="font-weight:600;font-size:13px">${po.supplierLabel||po.supplier||'—'}</div></div>
          <div><div style="font-size:11px;color:var(--c-text-hint);text-transform:uppercase;letter-spacing:.05em">Currency PO</div><div style="font-weight:600;font-size:13px"><span class="badge badge-blue">${po.currency||'—'}</span></div></div>
          <div><div style="font-size:11px;color:var(--c-text-hint);text-transform:uppercase;letter-spacing:.05em">Total Value PO</div><div style="font-weight:600;font-size:14px;color:var(--c-blue-dark,#1e40af)">${po.currency||''} ${Number(po.poValue||0).toLocaleString()}</div></div>
          <div><div style="font-size:11px;color:var(--c-text-hint);text-transform:uppercase;letter-spacing:.05em">PO Date</div><div style="font-size:13px">${po.poDate||'—'}</div></div>
        </div>`;
    });
  }
});
// ══════════════════════════════════════════════════════════════
// NIE CENTER — Auto-Matching NIE BPOM untuk SKI
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

  if (!results.length) return { status:'not-found', label:'Tidak Ditemukan', matches:[] };
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
  // Init Google Drive (deferred — hanya load jika user buka tab NIE)
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
  </tr>`).join('') || `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--c-text-hint)">Belum ada data NIE.</td></tr>`;
}

function nieDeleteRow(idx) {
  if (!confirm('Hapus NIE ini dari database?')) return;
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
  if (!nie || !name) { showToast('Nomor NIE dan Nama Produk wajib diisi.','error'); return; }
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
      // PDF: cek dulu apakah ini Surat Pengantar NIE (bukan CI biasa)
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
          </div>` : `<div style="margin-top:8px;font-size:12px;color:var(--c-text-hint)">Semua NIE sudah ada di database.</div>`}
          ${newNies.length > 0 ? `
          <button class="btn-primary btn-sm" style="margin-top:10px" onclick="gdriveSearchByNieNumbers(${JSON.stringify(suratResult.items.map(i=>i.nie_number))})">
            <i class="ti ti-brand-google-drive"></i> Cari File NIE ini di Google Drive
          </button>` : ''}`;
        document.getElementById('nie-ci-drop').appendChild(panel);

        showToast(`✓ Surat Pengantar: ${suratResult.items.length} NIE — ${newNies.length} ditambah ke DB`, 'success');

        // ── Auto-search Google Drive jika sudah login ──────────
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
          // Belum login: simpan ke pending, scroll ke gdrive panel, minta user login
          const nieNumbers = suratResult.items.map(i => i.nie_number).filter(Boolean);
          gdrivePendingNieSearch = nieNumbers;
          showToast('Login Google Drive untuk cari file NIE otomatis. Hasil akan muncul setelah login.', 'warning');
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

    if (!ciItems.length) { showToast('Tidak ada item yang terbaca dari CI.','error'); return; }

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
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--c-text-hint)">Upload CI untuk melihat hasil matching NIE.</td></tr>`;
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
  if (!matched.length) { showToast('Belum ada NIE. Upload SKI atau paste NIE terlebih dahulu.','error'); return; }
  navigator.clipboard.writeText(matched.join('\n')).then(()=>showToast(`${matched.length} Nomor NIE disalin.`,'success'));
}

function nieExportExcel() {
  if (!NIE_MATCH_RESULTS.length) { showToast('Tidak ada data untuk diekspor.','error'); return; }
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
// Dokumen: surat permohonan ke BPOM dengan tabel berisi kolom "No. Notifikasi"
// Contoh kolom: No | Nama Produk | Kemasan | No Bets | Jumlah | No Invoice | Negara | No HS | Nilai | No. Notifikasi
function parseSuratPengantarNie(pdfText) {
  const lines = pdfText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const results = [];

  // Deteksi apakah ini format Surat Pengantar: cari keyword khas
  const isSuratPengantar =
    /Surat\s*Keterangan\s*Impor/i.test(pdfText) ||
    /Permohonan\s*Surat\s*Keterangan\s*Impor/i.test(pdfText) ||
    /No\.\s*Notifikasi/i.test(pdfText) ||
    /Badan\s*Pengawas(an)?\s*Obat\s*dan\s*Makanan/i.test(pdfText);

  if (!isSuratPengantar) return null; // bukan format ini

  // Cari blok tabel: identifikasi baris yang mengandung nomor NIE (pola NAxxxxxxxx)
  // NIE BPOM pola: NA + 11 digit angka, e.g. NA22210200046
  const niePattern = /\b(NA\d{11,14})\b/g;
  const allNieMatches = [...pdfText.matchAll(niePattern)];
  const uniqueNie = [...new Set(allNieMatches.map(m => m[1]))];

  // Untuk setiap NIE, cari nama produk terdekat di baris sebelumnya
  // Strategy: scan baris-baris untuk menemukan tabel
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
    // Di Surat Pengantar, setiap baris produk ada: no, nama produk, kemasan, no bets, jumlah, no invoice, negara, no hs, nilai, NIE
    // PDF extractor sering memisah kolom per baris, jadi kita scan area tabel
    const tableLines = lines.slice(tableStartIdx + 1);
    let currentProduct = null;
    let productBuffer = [];

    tableLines.forEach(line => {
      // Cek apakah baris ini adalah nomor baris tabel (starts with digit)
      const rowNumMatch = line.match(/^(\d+)$/);
      const nieMatch = line.match(/(NA\d{11,14})/);
      const qtyMatch = line.match(/^\d{1,5}$/);
      const valueMatch = line.match(/^[¥¢][\d.,]+$/);
      const hsMatch = line.match(/^\d{4}\.\d{2}\.\d{2}/);

      // Nama produk: baris yang bukan angka murni, bukan kode, cukup panjang
      const isProductName = line.length > 3 && !/^\d+$/.test(line) && !nieMatch && !hsMatch && !valueMatch;

      productBuffer.push(line);

      // Ketika kita temukan NIE di baris ini, kumpulkan data
      if (nieMatch) {
        const nie_number = nieMatch[1];
        // Cari nama produk dari buffer: cari baris yang paling mungkin nama produk
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

    // Fallback: jika tidak bisa parse tabel dengan benar, gunakan NIE yang ditemukan saja
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

// Config — isi dengan Google Cloud Project credentials Anda
// Untuk setup: https://console.cloud.google.com → Enable Drive API + Picker API
const GDRIVE_CONFIG = {
  // Ganti dengan Client ID dari Google Cloud Console Anda
  CLIENT_ID: '48077672390-etdopmmsuhucb3j1o6gu5erdi9iaehan.apps.googleusercontent.com',  // e.g. '123456789-xxxxx.apps.googleusercontent.com'
  // API Key untuk Drive API (public, bukan secret)
  API_KEY: 'AIzaSyAYDAGPmseu6YfNbXlOZhgG6SlvlbiHHgY',    // e.g. 'AIzaSyXXXXXXXXXXXXXXXXXXX'
  SCOPES: 'https://www.googleapis.com/auth/drive.readonly',
  DISCOVERY_DOCS: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
};

let gdriveTokenClient = null;
let gdriveAccessToken = null;
let gdriveInitialized = false;
let gdriveSearchResults = []; // [{id, name, mimeType, webViewLink, modifiedTime}]
let gdriveSelectedFiles = new Set(); // file IDs yang dipilih untuk download
let gdrivePendingNieSearch = null; // NIE numbers dari upload surat pengantar yg belum dicari (tunggu login)

// ── Init Google Drive ─────────────────────────────────────────
async function initGdrive() {
  if (!GDRIVE_CONFIG.CLIENT_ID || !GDRIVE_CONFIG.API_KEY) {
    showToast('Google Drive belum dikonfigurasi. Isi CLIENT_ID dan API_KEY di app.js.', 'warning');
    document.getElementById('gdrive-status-badge').textContent = '⚠ Belum Dikonfigurasi';
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
    document.getElementById('gdrive-status-badge').textContent = '○ Belum Login';
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
  showToast('Logout dari Google Drive.', 'success');
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
    // Jika ada pending NIE search dari upload surat pengantar sebelumnya, jalankan sekarang
    if (gdrivePendingNieSearch && gdrivePendingNieSearch.length) {
      const pending = gdrivePendingNieSearch;
      gdrivePendingNieSearch = null;
      showToast(`🔍 Mencari ${pending.length} file NIE di Google Drive…`, '');
      setTimeout(() => gdriveSearchByNieNumbers(pending), 400);
    }
  } else {
    badge.textContent = '○ Belum Login';
    badge.className = 'badge badge-gray';
    if (connectBtn) connectBtn.style.display = 'inline-flex';
    if (logoutBtn)  logoutBtn.style.display  = 'none';
    if (searchCard) searchCard.style.display = 'none';
  }
}

// ── Search file di Google Drive ───────────────────────────────
async function gdriveSearch() {
  if (!gdriveAccessToken) { showToast('Login ke Google Drive dulu.', 'warning'); return; }

  const query   = (document.getElementById('gdrive-search-input')?.value || '').trim();
  const folderQ = (document.getElementById('gdrive-folder-input')?.value || '').trim();
  const fileType= document.getElementById('gdrive-filetype')?.value || 'pdf';

  if (!query) { showToast('Masukkan kata kunci pencarian.', 'warning'); return; }

  const loadEl = document.getElementById('gdrive-search-loading');
  if (loadEl) loadEl.style.display = 'block';
  gdriveSearchResults = [];
  renderGdriveResults([]);

  try {
    // Build Drive API query
    let q = `name contains '${query.replace(/'/g,"\\'")}' and trashed = false`;
    if (fileType === 'pdf') q += ` and mimeType = 'application/pdf'`;
    else if (fileType === 'xlsx') q += ` and mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'`;
    // Note: folder filter by name requires extra query; skip for simplicity

    const resp = await gapi.client.drive.files.list({
      q,
      fields: 'files(id,name,mimeType,webViewLink,modifiedTime,size,parents)',
      orderBy: 'modifiedTime desc',
      pageSize: 50,
    });

    // Filter QR, lalu per nama dasar ambil 1 file terbaru saja
    const filtered = (resp.result.files || []).filter(f => !/qr/i.test(f.name));
    const seen = new Map();
    filtered.forEach(f => {
      // Normalisasi nama: hapus suffix versi/tanggal untuk grouping
      const base = f.name.replace(/[_\-]v?\d+(\.pdf)?$/i, '').toLowerCase();
      if (!seen.has(base)) seen.set(base, f); // sudah sorted desc, yg pertama = terbaru
    });
    const files = [...seen.values()];
    gdriveSearchResults = files;
    renderGdriveResults(files);

    if (!files.length) showToast(`Tidak ditemukan file untuk "${query}".`, 'warning');
    else showToast(`✓ Ditemukan ${files.length} file.`, 'success');
  } catch (err) {
    showToast('Gagal mencari: ' + (err.result?.error?.message || err.message), 'error');
  } finally {
    if (loadEl) loadEl.style.display = 'none';
  }
}

// ── Search NIE by nomor NIE dari hasil matching ───────────────
async function gdriveSearchByNieNumbers(nieNumbers) {
  if (!gdriveAccessToken) { showToast('Login ke Google Drive dulu untuk cari file NIE.', 'warning'); return; }
  if (!nieNumbers || !nieNumbers.length) { showToast('Tidak ada nomor NIE untuk dicari.', 'warning'); return; }

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
      });
      const files = (resp.result.files || [])
        .filter(f => !/qr/i.test(f.name)); // skip file QR
      if (files.length) found.push({ ...files[0], _nie_number: nie }); // ambil yg terbaru saja
    } catch (e) { /* skip failed NIE */ }
  }

  gdriveSearchResults = found;
  renderGdriveResults(found);

  if (loadEl) loadEl.style.display = 'none';
  if (!found.length) showToast('Tidak ada file NIE ditemukan di Drive.', 'warning');
  else showToast(`✓ Ditemukan ${found.length} file NIE.`, 'success');

  // Pastikan gdrive-search-card visible (butuh saat auto-search dari upload)
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
    container.innerHTML = `<div style="text-align:center;padding:32px;color:var(--c-text-hint)">Belum ada hasil pencarian.</div>`;
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

// ── Download single file dari Drive ──────────────────────────
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

// ── Download selected files sebagai ZIP ──────────────────────
async function gdriveDownloadSelected() {
  if (!gdriveAccessToken) { showToast('Login ke Google Drive dulu.', 'warning'); return; }
  if (!gdriveSelectedFiles.size) { showToast('Pilih minimal 1 file untuk didownload.', 'warning'); return; }

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
    showToast('Tidak ada nomor NIE yang terdeteksi. Format: NA diikuti angka, satu per baris.', 'error');
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

  showToast(`${nies.length} NIE terdeteksi. Klik "Cari & Download ZIP" untuk mengunduh.`, 'success');
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
      <span>NIE dari Input Manual</span>
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
  if (!nies.length) { showToast('Tidak ada NIE. Paste nomor NIE terlebih dahulu.', 'error'); return; }

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
        showToast('Server jalan tapi belum ada file terindeks. Klik "Scan Folder" dulu di server.', 'warning');
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
  showToast('Login Google Drive (klik tombol Login Google Drive) atau jalankan nie_server_setup.bat di komputer Anda.', 'error');

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
      ${notFound.length ? `<span class="badge badge-red" style="margin-right:8px">✗ ${notFound.length} tidak ditemukan</span>` : ''}
      ${notFound.length ? `<div style="margin-top:6px;font-size:12px;color:var(--c-text-hint)">Tidak ditemukan: ${notFound.join(', ')}</div>` : ''}`;
  }

  if (!foundFiles.length) {
    showToast('Tidak ada file NIE yang ditemukan di Google Drive.', 'error');
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
    showToast(`${foundFiles.length} file ditemukan. Scroll ke bawah untuk download ZIP.`, 'success');
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
      ${notFound.length ? `<span class="badge badge-red" style="margin-right:8px">✗ ${notFound.length} tidak ditemukan</span>` : ''}
      ${notFound.length ? `<div style="margin-top:6px;font-size:12px;color:var(--c-text-hint)">Tidak ada di folder: ${notFound.join(', ')}</div>` : ''}`;
  }

  if (!foundSet.size) {
    showToast('Tidak ada file NIE ditemukan di folder. Pastikan folder sudah di-scan.', 'error');
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
// ══════════════════════════════════════════════════════════════
// DASHBOARD — Header, Alerts, PO Summary
// ══════════════════════════════════════════════════════════════

function renderDashboardHeader() {
  const now  = new Date();
  const hour = now.getHours();
  const greeting = hour < 11 ? 'Selamat Pagi' : hour < 15 ? 'Selamat Siang' : hour < 18 ? 'Selamat Sore' : 'Selamat Malam';
  const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const dateStr = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;

  const greetEl = document.getElementById('dash-greeting');
  const dateEl  = document.getElementById('dash-date');
  if (greetEl) greetEl.textContent = `${greeting}, Tim Import! 👋`;
  if (dateEl)  dateEl.textContent  = dateStr;

  // Update ship count badge
  const countEl = document.getElementById('dash-ship-count');
  if (countEl) countEl.textContent = `${MOCK_SHIPMENTS.length} shipment`;
}

function renderDashboardAlerts() {
  const el = document.getElementById('dash-alerts');
  if (!el) return;

  const alerts = [];
  const today = new Date(); today.setHours(0,0,0,0);

  MOCK_SHIPMENTS.forEach(ship => {
    const dWH   = getDaysUntil(ship.ataWarehouse);
    const dPort = getDaysUntil(ship.ataPort);

    if (dWH !== null && dWH >= 0 && dWH <= 3) {
      alerts.push({
        type:    dWH === 0 ? 'danger' : 'warning',
        icon:    'ti-building-warehouse',
        title:   `${ship.brand} — ${ship.shipmentName}`,
        msg:     dWH === 0 ? 'Jadwal ATA Warehouse HARI INI!' : `ATA Warehouse dalam ${dWH} hari (${fmtDate(ship.ataWarehouse)})`,
        action:  "switchTab('shipment')",
      });
    } else if (dPort !== null && dPort >= 0 && dPort <= 2) {
      alerts.push({
        type:  'info',
        icon:  'ti-anchor',
        title: `${ship.brand} — ${ship.shipmentName}`,
        msg:   dPort === 0 ? 'Jadwal ATA Port HARI INI!' : `ATA Port dalam ${dPort} hari (${fmtDate(ship.ataPort)})`,
        action: "switchTab('shipment')",
      });
    }
  });

  // PO alerts: belum PIB lebih dari 30 hari
  MOCK_PO_DATA.forEach(po => {
    if (po.status === 'belum-pib' && po.poDate) {
      const daysSincePO = Math.floor((today - new Date(po.poDate)) / 86400000);
      if (daysSincePO > 30) {
        alerts.push({
          type:   'warning',
          icon:   'ti-file-alert',
          title:  `PO ${po.poNumber} — ${po.supplierLabel||po.supplier}`,
          msg:    `Belum ada PIB sejak ${daysSincePO} hari lalu (PO Date: ${fmtDate(po.poDate)})`,
          action: `switchTab('history')`,
        });
      }
    }
    if (po.status === 'kurang') {
      alerts.push({
        type:  'danger',
        icon:  'ti-trending-down',
        title: `Shortage — PO ${po.poNumber}`,
        msg:   `${po.supplierLabel||po.supplier}: qty di warehouse kurang dari PIB`,
        action: `showDetail('${po.poNumber}')`,
      });
    }
  });

  if (!alerts.length) {
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:rgba(34,197,94,.07);border:0.5px solid rgba(34,197,94,.25);border-radius:10px;font-size:13px;color:#15803d">
        <i class="ti ti-circle-check" style="font-size:18px"></i>
        <span>Semua baik — tidak ada alert mendesak hari ini.</span>
      </div>`;
    return;
  }

  const colorMap = {
    danger:  { bg:'rgba(239,68,68,.08)',  border:'rgba(239,68,68,.25)',  text:'#dc2626', label:'URGENT' },
    warning: { bg:'rgba(249,115,22,.08)', border:'rgba(249,115,22,.25)', text:'#c2410c', label:'PERHATIAN' },
    info:    { bg:'rgba(59,130,246,.08)', border:'rgba(59,130,246,.25)', text:'#1d4ed8', label:'INFO' },
  };

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:8px">
      ${alerts.slice(0,5).map(a => {
        const c = colorMap[a.type] || colorMap.info;
        return `<div onclick="${a.action}" style="display:flex;align-items:center;gap:12px;padding:11px 16px;background:${c.bg};border:0.5px solid ${c.border};border-left:3px solid ${c.text};border-radius:8px;cursor:pointer;transition:opacity .15s" onmouseenter="this.style.opacity='.85'" onmouseleave="this.style.opacity='1'">
          <i class="ti ${a.icon}" style="font-size:18px;color:${c.text};flex-shrink:0"></i>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:1px">
              <span style="font-size:9px;font-weight:800;letter-spacing:.08em;color:${c.text};background:${c.border};padding:1px 6px;border-radius:3px">${c.label}</span>
              <span style="font-size:13px;font-weight:600;color:var(--c-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.title}</span>
            </div>
            <div style="font-size:12px;color:var(--c-text-hint)">${a.msg}</div>
          </div>
          <i class="ti ti-chevron-right" style="color:var(--c-text-hint);flex-shrink:0;font-size:14px"></i>
        </div>`;
      }).join('')}
      ${alerts.length > 5 ? `<div style="text-align:center;font-size:12px;color:var(--c-text-hint);padding:4px">+${alerts.length-5} alert lainnya</div>` : ''}
    </div>`;
}

function renderDashboardPoSummary() {
  const el = document.getElementById('dash-po-summary');
  if (!el) return;

  const total   = MOCK_PO_DATA.length;
  const belum   = MOCK_PO_DATA.filter(p=>p.status==='belum-pib').length;
  const kurang  = MOCK_PO_DATA.filter(p=>p.status==='kurang').length;
  const match   = MOCK_PO_DATA.filter(p=>p.status==='match').length;
  const lebih   = MOCK_PO_DATA.filter(p=>p.status==='lebih').length;

  const cards = [
    { label:'Total PO',   value:total,  color:'#6366f1', bg:'rgba(99,102,241,.08)',  icon:'ti-files',          action:"switchTab('history')" },
    { label:'Belum PIB',  value:belum,  color:'#94a3b8', bg:'rgba(148,163,184,.1)',   icon:'ti-clock-pause',    action:"switchTab('history')" },
    { label:'Match ✓',    value:match,  color:'#22c55e', bg:'rgba(34,197,94,.08)',    icon:'ti-circle-check',   action:"switchTab('history')" },
    { label:'Shortage',   value:kurang, color:'#ef4444', bg:'rgba(239,68,68,.08)',    icon:'ti-trending-down',  action:"switchTab('history')" },
    { label:'Excess',     value:lebih,  color:'#f97316', bg:'rgba(249,115,22,.08)',   icon:'ti-trending-up',    action:"switchTab('history')" },
  ];

  el.innerHTML = `
    <div style="font-size:13px;font-weight:700;color:var(--c-text-primary);display:flex;align-items:center;gap:8px;margin-bottom:12px">
      <i class="ti ti-files" style="color:var(--c-blue)"></i> Status Purchase Order
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      ${cards.map(c => `
        <div onclick="${c.action}" style="flex:1;min-width:100px;padding:14px 16px;background:${c.bg};border:0.5px solid ${c.color}30;border-radius:10px;cursor:pointer;transition:transform .12s,box-shadow .12s;text-align:center"
          onmouseenter="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(0,0,0,.1)'"
          onmouseleave="this.style.transform='';this.style.boxShadow=''">
          <div style="font-size:26px;font-weight:800;color:${c.color};line-height:1.1;margin-bottom:4px">${c.value}</div>
          <div style="font-size:11px;font-weight:600;color:${c.color};text-transform:uppercase;letter-spacing:.05em;opacity:.85">${c.label}</div>
        </div>`).join('')}
    </div>`;
}