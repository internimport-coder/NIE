// ================================================================
//  wordExport.js — Export otomatis Surat Kuasa (.docx) dari data
//  shipment, memakai template asli (templates/surat_kuasa_template.docx)
//  Library: PizZip + docxtemplater (client-side, tanpa server)
// ================================================================

const SK_TEMPLATE_PATH = 'templates/surat_kuasa_template.docx';

// Default data perusahaan pemberi & penerima kuasa (bisa diubah manual
// di form sebelum generate — nilai ini hanya starting point).
const SK_DEFAULTS = {
  nama_pemberi:          'Woro Kusumaningsih',
  jabatan_pemberi:       'Direktur',
  nama_perusahaan:       'PT. SOCIAL BELLA INDONESIA',
  npwp_pemberi:          '0711514844086000',
  alamat_1:              'Puri Indah Raya St. Moritz Office Tower Unit 1502, Puri Indah CBD U1,',
  alamat_2:              'Kel. Kembangan Selatan, Kec. Kembangan, Kota Adm. Jakarta Barat, DKI',
  alamat_3:              'Jakarta 11610',
  telepon:               '021 50821956',
  nama_penerima:         'PT. Logwin Air & Ocean Indonesia',
  npwp_penerima:         '0013547187402000',
  pimpinan_ppjk:         'AGUS SALIM',
  alamat_penerima:       'Soewarna Business Park Blok J Lot 10, Bandara Soekarno Hatta – Tangerang',
  nama_penerima_signer:  'Agus Salim',
};

let skExportShipmentIndex = null;

function fmtTanggalIndo(dateStr) {
  if (!dateStr) return '';
  const bulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return dateStr;
  return `${Number(d)} ${bulan[Number(m) - 1] || m} ${y}`;
}

function skSetVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val || '';
}
function skGetVal(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

// ── Buka modal, prefill dari data shipment + default perusahaan ──
function openSkExportModal(index) {
  const item = MOCK_SHIPMENTS[index];
  if (!item) return;
  skExportShipmentIndex = index;

  // Info surat
  skSetVal('sk-tanggal', fmtTanggalIndo(item.etd) || fmtTanggalIndo(new Date().toISOString().slice(0,10)));
  skSetVal('sk-no-surat-custom', '');
  skSetVal('sk-no-surat-do', '');

  // Pemberi kuasa — default perusahaan (editable)
  skSetVal('sk-nama-pemberi', SK_DEFAULTS.nama_pemberi);
  skSetVal('sk-jabatan-pemberi', SK_DEFAULTS.jabatan_pemberi);
  skSetVal('sk-nama-perusahaan', SK_DEFAULTS.nama_perusahaan);
  skSetVal('sk-npwp-pemberi', SK_DEFAULTS.npwp_pemberi);
  skSetVal('sk-telepon', SK_DEFAULTS.telepon);
  skSetVal('sk-alamat-1', SK_DEFAULTS.alamat_1);
  skSetVal('sk-alamat-2', SK_DEFAULTS.alamat_2);
  skSetVal('sk-alamat-3', SK_DEFAULTS.alamat_3);

  // Penerima kuasa / PPJK — default (editable)
  skSetVal('sk-nama-penerima', SK_DEFAULTS.nama_penerima);
  skSetVal('sk-npwp-penerima', SK_DEFAULTS.npwp_penerima);
  skSetVal('sk-pimpinan-ppjk', SK_DEFAULTS.pimpinan_ppjk);
  skSetVal('sk-alamat-penerima', SK_DEFAULTS.alamat_penerima);
  skSetVal('sk-nama-penerima-signer', SK_DEFAULTS.nama_penerima_signer);

  // Data barang / shipment — otomatis dari data shipment yang ada
  const blNoTgl = item.noBl ? `${item.noBl}${item.etd ? ' & ' + fmtDate(item.etd) : ''}` : '';
  skSetVal('sk-bl-no-tgl', blNoTgl);
  skSetVal('sk-vessel', item.vessel || '');
  skSetVal('sk-shipper', '');
  skSetVal('sk-invoice-no', '');
  skSetVal('sk-total-invoice', '');
  skSetVal('sk-quantity', '');
  skSetVal('sk-jenis-barang', '');

  const modal = document.getElementById('sk-export-modal');
  if (modal) modal.style.display = 'flex';
}

function closeSkExportModal() {
  const modal = document.getElementById('sk-export-modal');
  if (modal) modal.style.display = 'none';
  skExportShipmentIndex = null;
}

// ── Kumpulkan & validasi data form ──
function skCollectFormData() {
  const data = {
    tanggal:              skGetVal('sk-tanggal'),
    no_surat_custom:      skGetVal('sk-no-surat-custom'),
    no_surat_do:          skGetVal('sk-no-surat-do'),
    nama_pemberi:         skGetVal('sk-nama-pemberi'),
    jabatan_pemberi:      skGetVal('sk-jabatan-pemberi'),
    nama_perusahaan:      skGetVal('sk-nama-perusahaan'),
    npwp_pemberi:         skGetVal('sk-npwp-pemberi'),
    telepon:              skGetVal('sk-telepon'),
    alamat_1:             skGetVal('sk-alamat-1'),
    alamat_2:             skGetVal('sk-alamat-2'),
    alamat_3:             skGetVal('sk-alamat-3'),
    nama_penerima:        skGetVal('sk-nama-penerima'),
    npwp_penerima:        skGetVal('sk-npwp-penerima'),
    pimpinan_ppjk:        skGetVal('sk-pimpinan-ppjk'),
    alamat_penerima:      skGetVal('sk-alamat-penerima'),
    nama_penerima_signer: skGetVal('sk-nama-penerima-signer'),
    bl_no_tgl:            skGetVal('sk-bl-no-tgl'),
    vessel:               skGetVal('sk-vessel'),
    shipper:              skGetVal('sk-shipper'),
    invoice_no:           skGetVal('sk-invoice-no'),
    total_invoice:        skGetVal('sk-total-invoice'),
    quantity:             skGetVal('sk-quantity'),
    jenis_barang:         skGetVal('sk-jenis-barang'),
  };

  const requiredLabels = {
    tanggal: 'Tanggal Surat', no_surat_custom: 'No Surat Kuasa Custom', no_surat_do: 'No Surat Kuasa DO',
    nama_pemberi: 'Nama Pemberi Kuasa', jabatan_pemberi: 'Jabatan', nama_perusahaan: 'Nama Perusahaan',
    npwp_pemberi: 'NPWP Pemberi', telepon: 'Telepon', nama_penerima: 'Nama Perusahaan PPJK',
    npwp_penerima: 'NPWP PPJK', pimpinan_ppjk: 'Pimpinan PPJK', nama_penerima_signer: 'Nama Penanda Tangan PPJK',
    bl_no_tgl: 'BL No & Tanggal', vessel: 'Vessel', shipper: 'Shipper', invoice_no: 'Invoice No',
    total_invoice: 'Total Invoice', quantity: 'Quantity', jenis_barang: 'Jenis Barang',
  };
  const missing = Object.keys(requiredLabels).filter(k => !data[k]);
  if (missing.length) {
    showToast(`Lengkapi dulu: ${missing.map(k => requiredLabels[k]).slice(0,3).join(', ')}${missing.length>3 ? ', ...' : ''}`, 'error');
    return null;
  }
  return data;
}

// ── Generate & download file .docx ──
async function generateSuratKuasaDocx() {
  const data = skCollectFormData();
  if (!data) return;

  const btn = document.getElementById('sk-generate-btn');
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader" style="animation:spin 1s linear infinite"></i> Membuat dokumen…'; }

  try {
    const res = await fetch(SK_TEMPLATE_PATH);
    if (!res.ok) throw new Error('Template tidak ditemukan di ' + SK_TEMPLATE_PATH);
    const arrayBuffer = await res.arrayBuffer();

    const zip = new PizZip(arrayBuffer);
    const doc = new window.docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    doc.render(data);

    const out = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    const shipmentName = (MOCK_SHIPMENTS[skExportShipmentIndex] || {}).shipmentName || 'Shipment';
    const safeName = shipmentName.replace(/[^a-z0-9]+/gi, '_');
    const fileName = `Surat_Kuasa_${safeName}_${(data.no_surat_custom || 'export').replace(/[\/\\]/g,'-')}.docx`;

    const url = URL.createObjectURL(out);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Surat Kuasa berhasil dibuat & diunduh!', 'success');
    closeSkExportModal();
  } catch (err) {
    console.error(err);
    let msg = 'Gagal membuat dokumen Word.';
    if (err && err.properties && err.properties.errors) {
      // docxtemplater render error — biasanya placeholder tidak cocok
      msg = 'Gagal render template: ' + (err.properties.errors[0]?.properties?.explanation || err.message);
    } else if (err && err.message) {
      msg += ' ' + err.message;
    }
    showToast(msg, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = originalHtml; }
  }
}
