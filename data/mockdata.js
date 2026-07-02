// ============================================================
// Import Tracking System — Mock Data
// ============================================================
// Ganti data di sini dengan API call ke backend Anda

const MOCK_PO_DATA = [
  {
    poNumber:      "PO-123",
    poDate:        "2026-06-06",
    supplier:      "KLAVUU",
    supplierLabel: "KLAVUU",
    revCode:       "789",
    pibNumber:     "PIB-2026-001",
    pibDate:       "2026-06-10",
    currency:      "USD",
    status:        "kurang",
    qtyPIB:        500,
    qtyWarehouse:  498,
    poValue:       1000.00,
    paidAmount:    950.00,
    items: [
      { sku: "SKU001", name: "Mideer Puzzle — Classic Series",  qtyPO: 10, qtyPIB: 10, qtyWarehouse: 10 },
      { sku: "SKU002", name: "Activity Set — Deluxe Edition",   qtyPO: 20, qtyPIB: 20, qtyWarehouse: 18 },
      { sku: "SKU003", name: "Drawing Board — Magnetic A3",     qtyPO: 15, qtyPIB: 15, qtyWarehouse: 17 },
    ]
  },
  {
    poNumber:      "PO-124",
    poDate:        "2026-05-20",
    supplier:      "COSRX",
    supplierLabel: "COSRX",
    revCode:       "112",
    pibNumber:     "PIB-2026-002",
    pibDate:       "2026-05-28",
    currency:      "USD",
    status:        "match",
    qtyPIB:        300,
    qtyWarehouse:  300,
    poValue:       2500.00,
    paidAmount:    2500.00,
    items: [
      { sku: "SKU010", name: "Monopoly Classic Board Game",     qtyPO: 150, qtyPIB: 150, qtyWarehouse: 150 },
      { sku: "SKU011", name: "Scrabble — Deluxe Edition",       qtyPO: 80,  qtyPIB: 80,  qtyWarehouse: 80  },
      { sku: "SKU012", name: "Jenga Giant — Outdoor Set",       qtyPO: 70,  qtyPIB: 70,  qtyWarehouse: 70  },
    ]
  },
  {
    poNumber:      "PO-125",
    poDate:        "2026-06-01",
    supplier:      "ESPOIR",
    supplierLabel: "ESPOIR",
    revCode:       "334",
    pibNumber:     "",
    pibDate:       "",
    currency:      "USD",
    status:        "belum-pib",
    qtyPIB:        0,
    qtyWarehouse:  0,
    poValue:       1800.00,
    paidAmount:    0,
    items: [
      { sku: "SKU020", name: "Hot Wheels — City Series 10pk",   qtyPO: 200, qtyPIB: 0, qtyWarehouse: 0 },
      { sku: "SKU021", name: "Barbie Dreamhouse Playset",        qtyPO: 50,  qtyPIB: 0, qtyWarehouse: 0 },
    ]
  },
  {
    poNumber:      "PO-126",
    poDate:        "2026-05-15",
    supplier:      "IMFROM",
    supplierLabel: "IMFROM",
    revCode:       "556",
    pibNumber:     "PIB-2026-003",
    pibDate:       "2026-05-22",
    currency:      "USD",
    status:        "lebih",
    qtyPIB:        400,
    qtyWarehouse:  415,
    poValue:       5200.00,
    paidAmount:    5200.00,
    items: [
      { sku: "SKU030", name: "LEGO Technic — Formula E",        qtyPO: 100, qtyPIB: 100, qtyWarehouse: 110 },
      { sku: "SKU031", name: "LEGO City — Police Station",      qtyPO: 150, qtyPIB: 150, qtyWarehouse: 150 },
      { sku: "SKU032", name: "LEGO Creator — Deep Sea",         qtyPO: 150, qtyPIB: 150, qtyWarehouse: 155 },
    ]
  },
  {
    poNumber:      "PO-127",
    poDate:        "2026-04-10",
    supplier:      "MAKE PREM",
    supplierLabel: "MAKE PREM",
    revCode:       "901",
    pibNumber:     "PIB-2026-004",
    pibDate:       "2026-04-18",
    currency:      "USD",
    status:        "match",
    qtyPIB:        600,
    qtyWarehouse:  600,
    poValue:       3100.00,
    paidAmount:    3100.00,
    items: [
      { sku: "SKU040", name: "Mideer Water Paint — 24 Colors",  qtyPO: 200, qtyPIB: 200, qtyWarehouse: 200 },
      { sku: "SKU041", name: "Finger Puppet Theater Set",        qtyPO: 400, qtyPIB: 400, qtyWarehouse: 400 },
    ]
  }
];

const MOCK_SHIPMENTS = [
  {
    shipmentName: "Shipment A",
    brand: "KLAVUU",
    vessel: "MV Blue Pearl",
    noBl: "BL-2026-001",
    containerType: "FCL",
    linerShipment: "CMA CGM",
    etd: "2026-06-20",
    ataPort: "2026-06-27",
    ataWarehouse: "2026-07-01"
  },
  {
    shipmentName: "Shipment B",
    brand: "MEDIHEAL",
    vessel: "MV Ocean Star",
    noBl: "BL-2026-002",
    containerType: "LCL",
    linerShipment: "Maersk",
    etd: "2026-06-22",
    ataPort: "2026-06-29",
    ataWarehouse: "2026-07-03"
  },
  {
    shipmentName: "Shipment C",
    brand: "SUKIN",
    vessel: "MV Pearl Horizon",
    noBl: "BL-2026-003",
    containerType: "FCL",
    linerShipment: "MSC",
    etd: "2026-06-24",
    ataPort: "2026-07-01",
    ataWarehouse: "2026-07-05"
  }
];