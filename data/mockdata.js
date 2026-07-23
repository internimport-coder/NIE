// ============================================================
// Import Tracking System — Mock Data
// ============================================================
// Ganti data di sini dengan API call ke backend Anda

const MOCK_PO_DATA = [
  {
    poNumber:      "PO/SBI/2026/00002947",
    poDate:        "2026-06-01",
    supplier:      "COCOON",
    supplierLabel: "COCOON",
    revCode:       "-",
    pibNumber:     "388832",
    pibDate:       "2026-06-19",
    currency:      "USD",
    status:        "kurang",
    qtyPIB:        10400,
    qtyWarehouse:  10395,
    poValue:       29887.92,
    paidAmount:    29887.92,
    items: [
      { sku: "COC.SC-KLMSCDC5ALL1", name: "Dak Lak Coffee Lip Scrub",  qtyPO: 7000, qtyPIB: 7000, qtyWarehouse: 7000 },
      { sku: "COC.HC-DUXBIM310ALL1", name: "Pomelo Hair Conditioner",   qtyPO: 2400, qtyPIB: 2400, qtyWarehouse: 2400 },
      { sku: "COC.HC-TCBICM200ALL1", name: "Pomelo Hair Mask",     qtyPO: 1000, qtyPIB: 1000, qtyWarehouse: 995 },
    ]
  },
  {
    poNumber:      "PO/SBI/2025/00003001",
    poDate:        "2025-08-25",
    supplier:      "ISHIZAWA LABORATORIES INC.",
    supplierLabel: "KEANA",
    revCode:       "PO/SBI/2025/00002213",
    pibNumber:     "",
    pibDate:       "",
    currency:      "JPY",
    status:        "belum-pib",
    qtyPIB:        0,
    qtyWarehouse:  0,
    poValue:       5884800.00,
    paidAmount:    0,
    items: [
      { sku: "KAN.SC-MTNCM01170ALL1", name: "KEANA Rice Pack (170gr)", qtyPO: 5760, qtyPIB: 0, qtyWarehouse: 0, unitPrice: 625.00, netPrice: 3600000 },
      { sku: "KAN.SC-KNRMLBS281", name: "KEANA Rice Mask (28pcs)", qtyPO: 2856, qtyPIB: 0, qtyWarehouse: 0, unitPrice: 800.00, netPrice: 2284800 },
      { sku: "KAN.SC-RTNGS", name: "Rice Toner N (300ml)", qtyPO: 30, qtyPIB: 0, qtyWarehouse: 0, unitPrice: 800.00, netPrice: 0 },
      { sku: "KAN.SC-RCS", name: "KEANA Rice Cream (30gr)", qtyPO: 30, qtyPIB: 0, qtyWarehouse: 0, unitPrice: 750.00, netPrice: 0 },
      { sku: "KAN.SC-RPS", name: "KEANA Rice Pack (Non Specify)", qtyPO: 80, qtyPIB: 0, qtyWarehouse: 0, unitPrice: 625.00, netPrice: 0 },
      { sku: "KAN.SC-TMGS", name: "Tightening Mask GWP (10 Sheet)", qtyPO: 80, qtyPIB: 0, qtyWarehouse: 0, unitPrice: 650.00, netPrice: 0 },
      { sku: "KAN.SC-GKRMALLS", name: "GWP Keana Rice Mask (1 sheets)", qtyPO: 500, qtyPIB: 0, qtyWarehouse: 0, unitPrice: 32.50, netPrice: 0 },
      { sku: "KAN.SC-TMGSSS", name: "Tightening Mask GWP Single Sheet (1 Sheet)", qtyPO: 500, qtyPIB: 0, qtyWarehouse: 0, unitPrice: 650.00, netPrice: 0 },
      { sku: "KAN.SC-GKRMS", name: "GWP Keana Rice Mask (Variant: 10 sheets)", qtyPO: 80, qtyPIB: 0, qtyWarehouse: 0, unitPrice: 0.00, netPrice: 0 }
    ]
  },
  // ── Demo #3: COSRX — full pipeline from a real PO → PIB → CI ──
  // Qty PIB below is taken 1:1 from the uploaded PIB (NOPEN 013929);
  // Value CI matches the Commercial Invoice (Sociolla_6203_95) exactly,
  // since this PO was already revised to match the CI (see revCode).
  // Payment term per the PO/CI: 50% before ETD + 50% within 30 days after
  // ETA — only the first 50% has been paid so far (Partially Paid demo).
  {
    poNumber:      "PO/SBI/2026/00002533",
    poDate:        "2026-05-06",
    supplier:      "COSRX.Inc",
    supplierLabel: "COSRX",
    revCode:       "PO/SBI/2026/00002033; PO/SBI/2026/00002162; PO/SBI/2026/00002225",
    pibNumber:     "013929",
    pibDate:       "2026-06-12",
    currency:      "KRW",
    status:        "match",
    qtyPIB:        153960,
    qtyWarehouse:  153960,
    poValue:       515862630.00,
    paidAmount:    257931315.00,
    items: [
      { sku: "CX.SC-HAHPE1001",       name: "Hyaluronic Acid Hydra Power Essence", size: "100 ml",   type: "Sellable", qtyPO: 300,    qtyPIB: 300,    qtyWarehouse: 300,    unitPrice: 8325.00,  discountPct: 0, netPrice: 2497500.00 },
      { sku: "CX.SC-HAIC1001",        name: "Hyaluronic Acid Intensive Cream",     size: "100 ml",   type: "Sellable", qtyPO: 420,    qtyPIB: 420,    qtyWarehouse: 420,    unitPrice: 8775.00,  discountPct: 0, netPrice: 3685500.00 },
      { sku: "CX.SC-LGMC1501",        name: "Low pH Good Morning Gel Cleanser",    size: "150 ml",   type: "Sellable", qtyPO: 35826,  qtyPIB: 35826,  qtyWarehouse: 35826,  unitPrice: 4455.00,  discountPct: 0, netPrice: 159604830.00 },
      { sku: "CX.SC-LGMC501",         name: "Low pH Good Morning Gel Cleanser",    size: "50 ml",    type: "Sellable", qtyPO: 46326,  qtyPIB: 46326,  qtyWarehouse: 46326,  unitPrice: 2250.00,  discountPct: 0, netPrice: 104233500.00 },
      { sku: "CX.SC-SADG1501",        name: "Salicylic Acid Daily Gentle Cleanser",size: "150 ml",   type: "Sellable", qtyPO: 17220,  qtyPIB: 17220,  qtyWarehouse: 17220,  unitPrice: 4455.00,  discountPct: 0, netPrice: 76715100.00 },
      { sku: "CX.SC-ASAOC921001",     name: "Advanced Snail 92 All in One Cream",  size: "100 ml",   type: "Sellable", qtyPO: 6420,   qtyPIB: 6420,   qtyWarehouse: 6420,   unitPrice: 8550.00,  discountPct: 0, netPrice: 54891000.00 },
      { sku: "CX.SC-ASMPE1001",       name: "Advanced Snail 96 Mucin Power Essence", size: "-",      type: "Sellable", qtyPO: 3480,   qtyPIB: 3480,   qtyWarehouse: 3480,   unitPrice: 7560.00,  discountPct: 0, netPrice: 26308800.00 },
      { sku: "CX.SC-ASMGCM150ALL1",   name: "Advanced Snail Mucin Gel Cleanser",   size: "150 ml",   type: "Sellable", qtyPO: 660,    qtyPIB: 660,    qtyWarehouse: 660,    unitPrice: 8100.00,  discountPct: 0, netPrice: 5346000.00 },
      { sku: "CX.SC-ASHEPALL1",       name: "Advanced Snail Hydrogel Eye Patch",   size: "60 patches", type: "Sellable", qtyPO: 600,  qtyPIB: 600,    qtyWarehouse: 600,    unitPrice: 10800.00, discountPct: 0, netPrice: 6480000.00 },
      { sku: "CX.SC-APMPALL1",        name: "Acne Pimple Master Patch",            size: "-",        type: "Sellable", qtyPO: 1500,   qtyPIB: 1500,   qtyWarehouse: 1500,   unitPrice: 1575.00,  discountPct: 0, netPrice: 2362500.00 },
      { sku: "CX.SC-CFMPALL1",        name: "Clear Fit Master Patch",              size: "-",        type: "Sellable", qtyPO: 1500,   qtyPIB: 1500,   qtyWarehouse: 1500,   unitPrice: 1575.00,  discountPct: 0, netPrice: 2362500.00 },
      { sku: "CX.SC-HWT1501",         name: "Hydrium Watery Toner",                size: "150 ml",   type: "Sellable", qtyPO: 180,    qtyPIB: 180,    qtyWarehouse: 180,    unitPrice: 6750.00,  discountPct: 0, netPrice: 1215000.00 },
      { sku: "CX.SC-HTHM40ALL1",      name: "Hydrium Triple Hyaluronic Moisture Ampoule", size: "40 ml", type: "Sellable", qtyPO: 1008, qtyPIB: 1008,  qtyWarehouse: 1008,   unitPrice: 10800.00, discountPct: 0, netPrice: 10886400.00 },
      { sku: "CX.SC--FFPST501",       name: "Full Fit Propolis Synergy Toner",     size: "50 ml",    type: "Sellable", qtyPO: 480,    qtyPIB: 480,    qtyWarehouse: 480,    unitPrice: 2700.00,  discountPct: 0, netPrice: 1296000.00 },
      { sku: "CX.SC-FFPST1501",       name: "Full Fit Propolis Synergy Toner",     size: "150 ml",   type: "Sellable", qtyPO: 240,    qtyPIB: 240,    qtyWarehouse: 240,    unitPrice: 6750.00,  discountPct: 0, netPrice: 1620000.00 },
      { sku: "CX.SC-TNSM15201",       name: "The Niacinamide 15 Serum",            size: "20 ml",    type: "Sellable", qtyPO: 400,    qtyPIB: 400,    qtyWarehouse: 400,    unitPrice: 10350.00, discountPct: 0, netPrice: 4140000.00 },
      { sku: "CX.SC-THASM3201",       name: "The Hyaluronic Acid 3 Serum",         size: "20 ml",    type: "Sellable", qtyPO: 480,    qtyPIB: 480,    qtyWarehouse: 480,    unitPrice: 10350.00, discountPct: 0, netPrice: 4968000.00 },
      { sku: "CX.SC-TRO51",           name: "The Retinol 0.5 Oil",                 size: "20 ml",    type: "Sellable", qtyPO: 120,    qtyPIB: 120,    qtyWarehouse: 120,    unitPrice: 11250.00, discountPct: 0, netPrice: 1350000.00 },
      { sku: "CX.SC-TPCLGHM1",        name: "The Peptide Collagen Lifting Glow Hydrogel Mask", size: "34 x 3", type: "Sellable", qtyPO: 6800, qtyPIB: 6800, qtyWarehouse: 6800, unitPrice: 6750.00, discountPct: 0, netPrice: 45900000.00 },
      { sku: "CX.SC-GTAADCSM215ALLS", name: "GWP The Alpha-Arbutin 2 Discoloration Care Serum", size: "1.5 ml", type: "GWP", qtyPO: 30000, qtyPIB: 30000, qtyWarehouse: 30000, unitPrice: 0.00, discountPct: 0, netPrice: 0.00 },
    ]
  },
  // ── Demo #4: RATED GREEN (RH&B Brands) — full pipeline PO → CI → PIB → Payment ──
  // Sourced from real uploaded docs: PO/SBI/2026/00002381 (29-Apr-2026),
  // CI RG_20260401_IDN_PO46 (16-Apr-2026, Total Payable KRW 48,113,750 — matches PO),
  // and PIB Nomor Pendaftaran 365850 (10-Jun-2026, Nomor Pengajuan/AJU 000216).
  // Note: PO's GWP line RG.HC-RBSPM50ALLS shows 496 pcs while the PIB registered
  // 500 pcs for the same Rosemary Balancing Scalp Pack 50ml GWP — a genuine
  // 4-pcs PO-vs-PIB variance carried over from the source documents.
  // ⚠️ Demo adjustment: RG.HC-RGAHLSSSM1201 warehouse-received qty was bumped
  // from 4,802 to 4,810 (+8) so this PO illustrates the "lebih" (qty WH > qty
  // PIB) status — qtyWarehouse total 12,210 vs qtyPIB total 12,202.
  // Payment term per CI: 50% in advance + 50% within 60 days after ETA — only
  // the advance 50% has been paid so far (final 50% not yet due).
  {
    poNumber:      "PO/SBI/2026/00002381",
    poDate:        "2026-04-29",
    supplier:      "RH&B BRANDS, INC",
    supplierLabel: "RATED GREEN",
    revCode:       "-",
    pibNumber:     "365850",
    pibDate:       "2026-06-10",
    ciNumber:      "RG_20260401_IDN_PO46",
    ciDate:        "2026-04-16",
    currency:      "KRW",
    status:        "lebih",
    qtyPIB:        12202,
    qtyWarehouse:  12210,
    poValue:       48113750.00,
    paidAmount:    24056875.00,
    items: [
      { sku: "RG.HC-RTCPTOSSSM1001",        name: "Real Tamanu Cold Pressed Tamanu Oil Soothing Scalp Shampoo", size: "100 ml", type: "Sellable", qtyPO: 196,  qtyPIB: 196,  qtyWarehouse: 196,  unitPrice: 2500.00, discountPct: 0,   netPrice: 490000.00 },
      { sku: "RG.HC-HMSP50ALL1",            name: "Hibiscus Moisturizing Scalp Pack",                            size: "50 ml",  type: "Sellable", qtyPO: 77,   qtyPIB: 77,   qtyWarehouse: 77,   unitPrice: 1250.00, discountPct: 0,   netPrice: 96250.00 },
      { sku: "RG.HC-RBSP50ALL1",            name: "Rosemary Balancing Scalp Pack",                               size: "50 ml",  type: "Sellable", qtyPO: 250,  qtyPIB: 250,  qtyWarehouse: 250,  unitPrice: 1250.00, discountPct: 0,   netPrice: 312500.00 },
      { sku: "RG.HC-TOSSP50ALL1",           name: "Tamanu Oil Soothing Scalp Pack",                              size: "50 ml",  type: "Sellable", qtyPO: 1000, qtyPIB: 1000, qtyWarehouse: 1000, unitPrice: 1250.00, discountPct: 0,   netPrice: 1250000.00 },
      { sku: "RG.HC-RGAHLSSSM1201",         name: "Real Grow Anti-Hair Loss Stimulating Scalp Spray",            size: "120 ml", type: "Sellable", qtyPO: 4802, qtyPIB: 4802, qtyWarehouse: 4810, unitPrice: 5000.00, discountPct: 0,   netPrice: 24010000.00 },
      { sku: "RG.HC-GRMES120ALL1",          name: "Real Mary Energizing Scalp Spray",                            size: "120 ml", type: "Sellable", qtyPO: 147,  qtyPIB: 147,  qtyWarehouse: 147,  unitPrice: 4750.00, discountPct: 0,   netPrice: 698250.00 },
      { sku: "RG.HC-GRME400ALL1",           name: "Real Mary Exfoliating Scalp Shampoo",                         size: "400 ml", type: "Sellable", qtyPO: 1575, qtyPIB: 1575, qtyWarehouse: 1575, unitPrice: 6250.00, discountPct: 0,   netPrice: 9843750.00 },
      { sku: "RG.HC-RGAHLTSM2001",          name: "Real Grow Anti-Hair Loss Treatment Shampoo",                  size: "200 ml", type: "Sellable", qtyPO: 360,  qtyPIB: 360,  qtyWarehouse: 360,  unitPrice: 6250.00, discountPct: 0,   netPrice: 2250000.00 },
      { sku: "RG.HC-RMPS200ALL1",           name: "Real Mary Purifying Scalp Scaler (Sea Salt)",                 size: "200 ml", type: "Sellable", qtyPO: 180,  qtyPIB: 180,  qtyWarehouse: 180,  unitPrice: 5000.00, discountPct: 0,   netPrice: 900000.00 },
      { sku: "RG.HC-RSNS400ALL1",           name: "Real Shea Nourishing Shampoo",                                size: "400 ml", type: "Sellable", qtyPO: 225,  qtyPIB: 225,  qtyWarehouse: 225,  unitPrice: 6250.00, discountPct: 0,   netPrice: 1406250.00 },
      { sku: "RG.BB-RSNSM1001",             name: "Real Shea Nourishing Shampoo",                                size: "100 ml", type: "Sellable", qtyPO: 100,  qtyPIB: 100,  qtyWarehouse: 100,  unitPrice: 2500.00, discountPct: 0,   netPrice: 250000.00 },
      { sku: "RG.HC-RSPR150ALL1",           name: "Real Shea Protein Recharging Leave-in Treatment",             size: "150 ml", type: "Sellable", qtyPO: 108,  qtyPIB: 108,  qtyWarehouse: 108,  unitPrice: 4500.00, discountPct: 0,   netPrice: 486000.00 },
      { sku: "RG.HC-RSRC240ALL1",           name: "Real Shea Real Change Treatment",                             size: "240 ml", type: "Sellable", qtyPO: 576,  qtyPIB: 576,  qtyWarehouse: 576,  unitPrice: 4250.00, discountPct: 0,   netPrice: 2448000.00 },
      { sku: "RG.HC-RPCPS1",                name: "Real Prune Color Protecting Shampoo",                         size: "400 ml", type: "Sellable", qtyPO: 175,  qtyPIB: 175,  qtyWarehouse: 175,  unitPrice: 6250.00, discountPct: 0,   netPrice: 1093750.00 },
      { sku: "RG.HC-TOSSPM2001",            name: "Tamanu Oil Soothing Scalp Pack",                              size: "200 ml", type: "Sellable", qtyPO: 72,   qtyPIB: 72,   qtyWarehouse: 72,   unitPrice: 5000.00, discountPct: 0,   netPrice: 360000.00 },
      { sku: "RG.HC-RASHOALL1",             name: "Real Argan Shine Hair Oil",                                   size: "100 ml", type: "Sellable", qtyPO: 98,   qtyPIB: 98,   qtyWarehouse: 98,   unitPrice: 5500.00, discountPct: 0,   netPrice: 539000.00 },
      { sku: "RG.HC-DPHMLFM1ALL1",          name: "Detangling Perfume Hair Mist (Lemon Freesia Musk)",           size: "80 ml",  type: "Sellable", qtyPO: 40,   qtyPIB: 40,   qtyWarehouse: 40,   unitPrice: 4200.00, discountPct: 0,   netPrice: 168000.00 },
      { sku: "RG.HC-DPHMLRC2ALL1",          name: "Detangling Perfume Hair Mist (Lychee Rose Cedar)",            size: "80 ml",  type: "Sellable", qtyPO: 240,  qtyPIB: 240,  qtyWarehouse: 240,  unitPrice: 4200.00, discountPct: 0,   netPrice: 1008000.00 },
      { sku: "RG.HC-DPHMPCS3ALL1",          name: "Detangling Perfume Hair Mist (Peony Coconut Sandal)",         size: "80 ml",  type: "Sellable", qtyPO: 120,  qtyPIB: 120,  qtyWarehouse: 120,  unitPrice: 4200.00, discountPct: 0,   netPrice: 504000.00 },
      { sku: "RG.HC-RSNSM100ALLS",          name: "GWP Real Shea Nourishing Shampoo",                            size: "100 ml", type: "GWP",      qtyPO: 147,  qtyPIB: 147,  qtyWarehouse: 147,  unitPrice: 0.00,    discountPct: 0,   netPrice: 0.00 },
      { sku: "RG.HC-GRTCPTOSSSM100ALLS",    name: "GWP Real Tamanu Cold Pressed Tamanu Oil Soothing Scalp Shampoo", size: "100 ml", type: "GWP",   qtyPO: 147,  qtyPIB: 147,  qtyWarehouse: 147,  unitPrice: 0.00,    discountPct: 0,   netPrice: 0.00 },
      { sku: "RG.HC-RARSALLS",              name: "GWP Real Argan Repairing Shampoo",                            size: "400 ml", type: "GWP",      qtyPO: 50,   qtyPIB: 50,   qtyWarehouse: 50,   unitPrice: 6250.00, discountPct: 100, netPrice: 0.00 },
      { sku: "RG.HC-GRARSM100ALLS",         name: "GWP Real Argan Repairing Shampoo",                            size: "100 ml", type: "GWP",      qtyPO: 98,   qtyPIB: 98,   qtyWarehouse: 98,   unitPrice: 0.00,    discountPct: 0,   netPrice: 0.00 },
      { sku: "RG.HC-GRPCPSM100S",           name: "GWP Real Prune Color Protecting Shampoo",                     size: "100 ml", type: "GWP",      qtyPO: 98,   qtyPIB: 98,   qtyWarehouse: 98,   unitPrice: 0.00,    discountPct: 0,   netPrice: 0.00 },
      { sku: "RG.HC-RBSPM50ALLS",           name: "GWP Rosemary Balancing Scalp Pack",                           size: "50 ml",  type: "GWP",      qtyPO: 496,  qtyPIB: 500,  qtyWarehouse: 500,  unitPrice: 0.00,    discountPct: 0,   netPrice: 0.00 },
      { sku: "RG.HC-HMSPM50ALLS",           name: "GWP Hibiscus Moisturizing Scalp Pack",                        size: "50 ml",  type: "GWP",      qtyPO: 173,  qtyPIB: 173,  qtyWarehouse: 173,  unitPrice: 0.00,    discountPct: 0,   netPrice: 0.00 },
      { sku: "RG.HC-TOSSPM50ALLS",          name: "GWP Tamanu Oil Soothing Scalp Pack",                          size: "50 ml",  type: "GWP",      qtyPO: 250,  qtyPIB: 250,  qtyWarehouse: 250,  unitPrice: 0.00,    discountPct: 0,   netPrice: 0.00 },
      { sku: "RG.HC-ANSPM50ALLS",           name: "GWP Avocado Nourishing Scalp Pack",                           size: "50 ml",  type: "GWP",      qtyPO: 250,  qtyPIB: 250,  qtyWarehouse: 250,  unitPrice: 1250.00, discountPct: 100, netPrice: 0.00 },
      { sku: "RG.HC-GRPCPUPCPTWCFPM200S",   name: "GWP Real Prune Cold Pressed & Upcycled Prune Color Protecting Treatment w/ Color Fixing Polymers", size: "200 ml", type: "GWP", qtyPO: 72, qtyPIB: 72, qtyWarehouse: 72, unitPrice: 0.00, discountPct: 0, netPrice: 0.00 },
      { sku: "RG.HC-GRACPAODCHMM200S",      name: "GWP Real Argan Cold Pressed Argan Oil Deep Conditioning Hair Mask", size: "200 ml", type: "GWP", qtyPO: 36,   qtyPIB: 36,   qtyWarehouse: 36,   unitPrice: 0.00,    discountPct: 0,   netPrice: 0.00 },
      { sku: "RG.HC-GRPCPUPCPSM80ALLS",     name: "GWP Real Prune Cold Pressed & Upcycled Prune Color Protecting Spray", size: "80 ml", type: "GWP", qtyPO: 40,   qtyPIB: 40,   qtyWarehouse: 40,   unitPrice: 0.00,    discountPct: 0,   netPrice: 0.00 },
    ]
  }
];

const MOCK_PAYMENT_PROOFS = [
  // ── Demo #3: COSRX — real PO/PIB/CI pipeline, partially paid ──
  // Payment term (per PO & CI): 50% before ETD + 50% within 30 days after
  // ETA. Only the advance 50% has been paid so far — the final 50% is
  // still outstanding, so this PO shows up as "Partially Paid".
  {
    paymentId: "PP-2026-201",
    poNumber: "PO/SBI/2026/00002533",
    ciNumber: "Sociolla_6203_95",
    brand: "COSRX",
    currency: "KRW",
    amount: 257931315.00,
    paymentDate: "2026-05-20",
    bank: "BCA",
    status: "matched",
    termLabel: "DP 50% (Advance before ETD)",
    note: "50% advance payment before ETD, per the PO/CI payment term — sent in by the Finance team.",
    attachment: "assets/payment-proofs/cosrx-dp1.png",
    attachmentLabel: "BCA Transfer Receipt — DP 50% (COSRX)"
  },
  // ── Demo #4: RATED GREEN (RH&B Brands) — DP paid, final 50% not yet due ──
  // Payment term per CI RG_20260401_IDN_PO46: 50% in advance, 50% within
  // 60 days after ETA. Final installment isn't due yet, so only the DP
  // shows here — matches the "partial" pattern used for the COSRX demo.
  {
    paymentId: "PP-2026-301",
    poNumber: "PO/SBI/2026/00002381",
    ciNumber: "RG_20260401_IDN_PO46",
    brand: "RATED GREEN",
    currency: "KRW",
    amount: 24056875.00,
    paymentDate: "2026-04-20",
    bank: "BCA",
    status: "matched",
    termLabel: "DP 50% (Advance)",
    note: "50% advance payment, per the CI payment term (50% in advance, 50% within 60 days after ETA) — sent in by the Finance team.",
    attachment: "assets/payment-proofs/ratedgreen-dp1.png",
    attachmentLabel: "BCA Transfer Receipt — DP 50% (Rated Green)"
  }
];

const MOCK_SHIPMENTS = [
  // ── RATED GREEN PO 46 — from the PIB doc: vessel "KMTC SHIMIZU", B/L
  // MTMFS26050008 (22-May-2026), port Tanjung Priok, perkiraan tiba 10-Jun-2026.
  {
    shipmentName: "RATED GREEN PO 46",
    brand: "RATED GREEN",
    vessel: "KMTC SHIMIZU",
    noBl: "MTMFS26050008",
    containerType: "LCL",
    linerShipment: "KMTC",
    etd: "2026-05-22",
    ataPort: "2026-06-10",
    ataWarehouse: "2026-06-15"
  }
];