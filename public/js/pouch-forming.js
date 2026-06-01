// ════════════════════════════════════════════════════════════════════
// pouch-forming.js — Shannon Pre-formed Pouch cost calculator
// ════════════════════════════════════════════════════════════════════
// Ports the "Shannon Forming" Excel calc (3.2-Estimating Calculator,
// rev 02/17/2022) into MFX-OS so staff can add pouch-converting cost
// onto a flexo print quote. The pricing matrix below is per-pouch in
// US dollars, broken down by:
//   - Style:    SUP (Stand-Up Pouch, with gusset) vs Flat Pouch
//   - Width:    4 brackets (<5", 5.1-8", 8.1-12", 12.1-15")
//   - Quantity: 7 brackets (5k → 500k)
//
// Add-ons (per pouch):
//   - Zipper:       ((2 × pouchWidth)/1000) per Excel formula T5
//   - CR Zipper:    +$0.015 flat (child-resistant; assumes Zipper:Yes)
//   - Multi-SKU:    (total_cost / qty) — amortizes a $25/SKU adder
//                   across qty, only when run quantity ≥ 2 SKUs
//
// Per-pouch forming = forming + zipper + crZipper + multiSku
// Job-level forming = perPouchForming × qty
//
// Integration: window.computePouchForming({style, widthIn, qty, copies,
//   zipper, crZipper, multiSku, gusset}) → {perPouch, total, breakdown}
// Used by computePricingMatrix in core.js to add a forming line to the
// existing material+setup math.
// ════════════════════════════════════════════════════════════════════

// SUP (Stand-Up Pouch — has gusset) pricing per pouch
// Rows: qty brackets — pouches priced at the LOWEST tier the qty qualifies for.
// Cols: width brackets — pick by max width across face.
var SHANNON_SUP_MATRIX = {
  qtyBreaks: [5000, 10000, 25000, 50000, 100000, 250000, 500000],
  widthBreaks: [5.00, 8.00, 12.00, 15.00], // upper edge inclusive
  // [qtyIdx][widthIdx] = $/pouch
  rates: [
    // <5"   5.1-8"  8.1-12" 12.1-15"
    [0.110, 0.114,  0.118,  0.122],  // 5k
    [0.068, 0.072,  0.076,  0.080],  // 10k
    [0.046, 0.049,  0.051,  0.059],  // 25k
    [0.045, 0.047,  0.049,  0.055],  // 50k
    [0.043, 0.045,  0.047,  0.054],  // 100k
    [0.041, 0.043,  0.045,  0.053],  // 250k
    [0.039, 0.042,  0.045,  0.049],  // 500k
  ]
};

// Flat Pouch pricing per pouch (no gusset)
var SHANNON_FLAT_MATRIX = {
  qtyBreaks: [5000, 10000, 25000, 50000, 100000, 250000, 500000],
  widthBreaks: [5.00, 8.00, 12.00, 15.00],
  rates: [
    // <5"   5.1-8"  8.1-12" 12.1-15"
    [0.080, 0.082,  0.084,  0.086],  // 5k
    [0.048, 0.050,  0.052,  0.054],  // 10k
    [0.041, 0.043,  0.045,  0.047],  // 25k
    [0.039, 0.041,  0.043,  0.045],  // 50k
    [0.037, 0.039,  0.041,  0.043],  // 100k
    [0.035, 0.037,  0.039,  0.041],  // 250k
    [0.034, 0.036,  0.038,  0.040],  // 500k
  ]
};

// CR Zipper flat adder per the Excel constant (cells T8/AM8)
var SHANNON_CR_ZIPPER_PER_POUCH = 0.015;
// Multi-SKU adder per Excel: B26 = copies × 25 ⇒ divided across qty
var SHANNON_MULTI_SKU_PER_COPY = 25;

// ─── Lookup helpers ─────────────────────────────────────────────────
function _shannonWidthIdx(widthIn) {
  // Match Excel logic: <5.01, <8.01, <12.1, else 12.1-15
  if (widthIn <= 5.00) return 0;
  if (widthIn <= 8.00) return 1;
  if (widthIn <= 12.00) return 2;
  return 3;
}

function _shannonQtyIdx(qty, qtyBreaks) {
  // Excel uses IF(qty>=Xk, rate, 1000). We need the HIGHEST tier qty meets.
  // Walk from top down; first match wins.
  for (var i = qtyBreaks.length - 1; i >= 0; i--) {
    if (qty >= qtyBreaks[i]) return i;
  }
  return 0; // below 5k — use 5k pricing (Excel's "1000" sentinel means N/A)
}

/**
 * Compute Shannon-style pouch forming cost.
 *
 * @param {object} opts
 *   style:    'sup' (default) | 'flat'  — gusset:true forces 'sup'
 *   widthIn:  pouch face width in inches (required, >0)
 *   qty:      run quantity in finished pouches (required, >0)
 *   copies:   number of SKUs / unique designs (default 1)
 *   zipper:   boolean — add zipper converting cost
 *   crZipper: boolean — add CR zipper flat adder (assumes zipper:true)
 *   gusset:   boolean — true → forces SUP style
 *
 * @returns {object}
 *   perPouch:        total $/pouch
 *   total:           perPouch × qty
 *   matrixRate:      base forming rate from the matrix
 *   zipperRate:      per-pouch zipper add
 *   crZipperRate:    per-pouch CR zipper add
 *   multiSkuRate:    per-pouch multi-SKU adjustment
 *   widthBracket:    label of width bracket used
 *   qtyBracket:      label of qty bracket used
 *   fitErr:          string if inputs don't fit the calculator
 */
function computePouchForming(opts) {
  opts = opts || {};
  var widthIn = parseFloat(opts.widthIn) || 0;
  var qty = parseFloat(opts.qty) || 0;
  var copies = Math.max(1, parseFloat(opts.copies) || 1);
  var zipper = !!opts.zipper;
  var crZipper = !!opts.crZipper;
  var gusset = !!opts.gusset;
  // gusset forces SUP; otherwise use style param
  var style = (gusset || opts.style === 'sup') ? 'sup' : 'flat';

  if (!widthIn || !qty) {
    return { perPouch:0, total:0, fitErr:'Need pouch width and qty' };
  }
  if (widthIn > 15.0) {
    return { perPouch:0, total:0, fitErr:'Pouch width '+widthIn.toFixed(2)+'" exceeds Shannon max 15.0"' };
  }

  var mat = style === 'sup' ? SHANNON_SUP_MATRIX : SHANNON_FLAT_MATRIX;
  var wIdx = _shannonWidthIdx(widthIn);
  var qIdx = _shannonQtyIdx(qty, mat.qtyBreaks);
  var matrixRate = mat.rates[qIdx][wIdx];

  // Zipper: 2 × pouchWidth / 1000 per Excel T5 = (P5 × R5)/1000
  // (P5 = 2 lanes constant, R5 = pouch width)
  var zipperRate = zipper ? (2 * widthIn) / 1000 : 0;
  // CR Zipper: flat $0.015 per pouch (only meaningful when zipper:true)
  var crZipperRate = (zipper && crZipper) ? SHANNON_CR_ZIPPER_PER_POUCH : 0;
  // Multi-SKU: $25 × copies amortized across this qty (only if copies > 1)
  var multiSkuRate = copies > 1 ? (copies * SHANNON_MULTI_SKU_PER_COPY) / qty : 0;

  var perPouch = matrixRate + zipperRate + crZipperRate + multiSkuRate;
  var total = perPouch * qty;

  var widthLabels = ['<5"','5.1-8"','8.1-12"','12.1-15"'];
  var qtyLabels = ['5k','10k','25k','50k','100k','250k','500k'];

  return {
    perPouch: Math.round(perPouch*100000)/100000,
    total: Math.round(total*100)/100,
    matrixRate: matrixRate,
    zipperRate: Math.round(zipperRate*100000)/100000,
    crZipperRate: crZipperRate,
    multiSkuRate: Math.round(multiSkuRate*100000)/100000,
    widthBracket: widthLabels[wIdx],
    qtyBracket: qtyLabels[qIdx],
    style: style
  };
}

// ════════════════════════════════════════════════════════════════════
// Display Box + Master Shipper Configurator (round 67)
// ════════════════════════════════════════════════════════════════════
// Ports the "Display & Master Confi. (2)" sheet from the same Excel
// workbook. It's a DIMENSIONAL configurator — the Excel computes how
// many display boxes + master shippers each quantity tier needs from
// pouches-per-display + the master stacking pattern (cols × rows ×
// stacks). $/display + $/master are entered manually since the
// supplier sets those.
//
// Excel formulas (ported verbatim):
//   Display dimensions:
//     L = pouch_width + 0.25"
//     W = 0.375 × pouches_per_display + 0.25"
//     D = W + 0.25"  (per F8=D7+0.25)
//   Display qty needed = run_qty / pouches_per_display
//
//   Master shipper dimensions:
//     L = display_L × cols + 0.25"
//     W = display_W × rows + 0.25"
//     D = display_D × stacks + 0.25"
//   Master qty needed = displays_needed / displays_per_master
//                     = run_qty / (pouches_per_display × cols × rows × stacks)
//
//   Pallet: 48"×40", 4.8 cols × 10 rows = 48 masters per pallet
//
// computeCartoning({qty, pouchWidthIn, pouchesPerDisplay,
//   cols, rows, stacks, displayCost, masterCost}) →
//   {displays, masters, pallets, displayL/W/D, masterL/W/D,
//    displayCostTotal, masterCostTotal, total}
// ════════════════════════════════════════════════════════════════════

var PALLET_COLS = 4.8;       // 4.8 master columns fit on a 48" pallet
var PALLET_ROWS = 10;        // 10 rows = 48 masters per pallet
var PALLET_CAPACITY = PALLET_COLS * PALLET_ROWS; // = 48

function computeCartoning(opts) {
  opts = opts || {};
  var qty = parseFloat(opts.qty) || 0;
  var w = parseFloat(opts.pouchWidthIn) || 0;
  var ppd = Math.max(0, parseFloat(opts.pouchesPerDisplay) || 0);
  var cols = Math.max(1, parseFloat(opts.cols) || 1);
  var rows = Math.max(1, parseFloat(opts.rows) || 1);
  var stacks = Math.max(1, parseFloat(opts.stacks) || 1);
  var displayCost = parseFloat(opts.displayCost) || 0;
  var masterCost = parseFloat(opts.masterCost) || 0;

  if (!qty || !ppd) {
    return { active:false, displays:0, masters:0, total:0 };
  }

  // Excel formulas G6, G7, G8 (display dimensions):
  //   G6 = C7 + 0.25                  → L = pouch_width + 0.25
  //   G7 = 0.375 × E6 + 0.25          → W = 0.375 × ppd + 0.25
  //   G8 = G7 + 0.25                  → D = W + 0.25
  var displayL = w + 0.25;
  var displayW = 0.375 * ppd + 0.25;
  var displayD = displayW + 0.25;

  // Excel formulas F28, F29, F30 (master dimensions):
  //   F28 = G6 × B28 + 0.25 → L = displayL × cols + 0.25
  //   F29 = G7 × C28 + 0.25 → W = displayW × rows + 0.25
  //   F30 = G8 × D28 + 0.25 → D = displayD × stacks + 0.25
  var masterL = displayL * cols + 0.25;
  var masterW = displayW * rows + 0.25;
  var masterD = displayD * stacks + 0.25;

  // Excel H6/H28: qty / units-per-container, rounded UP (you can't ship
  // a fractional display). Excel doesn't ceiling explicitly, but real
  // ops do; we do here.
  var displays = Math.ceil(qty / ppd);
  var displaysPerMaster = cols * rows * stacks;
  var masters = displaysPerMaster > 0 ? Math.ceil(displays / displaysPerMaster) : 0;
  var pallets = PALLET_CAPACITY > 0 ? Math.ceil(masters / PALLET_CAPACITY) : 0;

  var displayCostTotal = Math.round(displays * displayCost * 100) / 100;
  var masterCostTotal = Math.round(masters * masterCost * 100) / 100;
  var total = Math.round((displayCostTotal + masterCostTotal) * 100) / 100;

  return {
    active: true,
    displays: displays,
    masters: masters,
    pallets: pallets,
    displaysPerMaster: displaysPerMaster,
    displayL: Math.round(displayL * 100) / 100,
    displayW: Math.round(displayW * 100) / 100,
    displayD: Math.round(displayD * 100) / 100,
    masterL: Math.round(masterL * 100) / 100,
    masterW: Math.round(masterW * 100) / 100,
    masterD: Math.round(masterD * 100) / 100,
    displayCostTotal: displayCostTotal,
    masterCostTotal: masterCostTotal,
    total: total
  };
}

// Expose for computePricingMatrix + UI
if (typeof window !== 'undefined') {
  window.computePouchForming = computePouchForming;
  window.computeCartoning = computeCartoning;
  window.SHANNON_SUP_MATRIX = SHANNON_SUP_MATRIX;
  window.SHANNON_FLAT_MATRIX = SHANNON_FLAT_MATRIX;
}
