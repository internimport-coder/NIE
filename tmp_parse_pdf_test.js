const fs = require('fs');
const path = require('path');
const script = fs.readFileSync(path.join(__dirname, 'js', 'app.js'), 'utf8');
const match = script.match(/function parsePdfHeuristic\([\s\S]*?\n\}\n/);
if (!match) {
  console.error('parsePdfHeuristic not found');
  process.exit(1);
}
const codeFn = match[0] + '\nmodule.exports = parsePdfHeuristic;';
fs.writeFileSync(path.join(__dirname, 'tmp_parse_pdf_fn.js'), codeFn, 'utf8');
const parsePdfHeuristic = require(path.join(__dirname, 'tmp_parse_pdf_fn.js'));
const sample = `Purchase Order Confirmation #PO/SBI/2025/00003001
Supplier:
Tokyo
Tokyo
4-4-9, JINGU-MAE, SHIBUYA-KU
Japan
ISHIZAWA LABORATORIES INC.
Shipping address:
SBI Warehouse Cikupa
Brand Ownership Cikupa (BOCK)
griya idola industrial park
Jl. Raya Serang KM. 12, Bitung Jaya, Kec.Cikupa
Tangerang BT 15710
Indonesia
Our Order
Reference:
PO/SBI/2025/000
03001
Currency
JPY
Payment Term
End of Following
Month
Order Date:
25-Aug-2025
Schedule Date
24-Jul-2025
Incoterm
ON BOARD
Total Qty 9,916
Approved: Total Without Taxes ¥ 5,884,800
PT Social Bella Indonesia
... [KAN.SC-MTNCM01170ALL1] KEANA Rice Pack (Size: 170gr) 5,760 Units 625.00 0.00 ¥ 3,600,000
[KAN.SC-KNRMLBS281] KEANA Rice Mask (Size: 28pcs) 2,856 Units 800.00 0.00 ¥ 2,284,800
[KAN.SC-RTNGS] Rice Toner N (Size: 300ml) 30 Units 800.00 100.00 ¥ 0
[KAN.SC-RCS] KEANA Rice Cream (Size: 30gr) 30 Units 750.00 100.00 ¥ 0
[KAN.SC-RPS] KEANA Rice Pack (Non Specify: Non Specify) 80 Units 625.00 100.00 ¥ 0
[KAN.SC-TMGS] Tightening Mask GWP (Size: 10 Sheet) 80 Units 650.00 100.00 ¥ 0
[KAN.SC-GKRMALLS] GWP Keana Rice Mask (Size: 1 sheets) 500 Units 32.50 100.00 ¥ 0
[KAN.SC-TMGSSS] Tightening Mask GWP Single Sheet (Size: 1 Sheet) 500 Units 650.00 100.00 ¥ 0
[KAN.SC-GKRMS] GWP Keana Rice Mask (Variant: 10 sheets) 80 Units 0.00 0.00 ¥ 0
`;
const result = parsePdfHeuristic(sample);
console.log(JSON.stringify(result, null, 2));
fs.unlinkSync(path.join(__dirname, 'tmp_parse_pdf_fn.js'));
