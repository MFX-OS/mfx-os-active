# Stock List Import

Re-runnable tooling for getting standardized stock lists (face stocks, laminations, label stocks) from the vendor-supplied .docx files into the `MATS` catalog inside `public/js/core.js`.

## Why this exists

The materials catalog (`MATS`) is currently a hard-coded JS array literal in `public/js/core.js`. When vendors send updated stock lists (typically twice a year), you don't want to retype hundreds of SKUs by hand. This folder lets you re-import in two commands.

## Folder contents

```
scripts/import-stock-lists/
├── README.md                       ← this file
├── parse_stock_lists.py            ← .docx → new_mats.json
├── build_mats_patch.py             ← new_mats.json → patched core.js
├── source-docs/                    ← drop the latest vendor docs here
│   ├── STD-Flexible-Film-List.docx
│   └── STD-Label-Stock-List.docx
├── backups/                        ← timestamped core.js backups, auto-created
└── new_mats.json                   ← parser output, gitignored
```

## How to re-run when the vendor sends an updated list

1. Replace the `.docx` files in `source-docs/` with the new ones (keep the filenames the same, or update the paths in `parse_stock_lists.py`).
2. Install the parser dependency once:
   ```
   pip install python-docx
   ```
3. Parse:
   ```
   cd scripts/import-stock-lists
   python3 parse_stock_lists.py
   ```
   This writes `new_mats.json` and prints a summary (counts + vendor breakdown).
4. Sanity-check `new_mats.json` if you want (it's just JSON).
5. Patch `core.js`:
   ```
   python3 build_mats_patch.py
   ```
   This:
   - Locates the `const MATS=[ ... ]` literal in `public/js/core.js`
   - Parses the existing entries
   - Dedupes new entries against existing (by spec code `s`)
   - Backs up `core.js` to `backups/core.js.before-mats-import-YYYYMMDD-HHMMSS.bak`
   - Writes the merged, multi-line MATS literal back

6. Verify nothing broke:
   ```
   node --check ../../public/js/core.js
   ```
7. Deploy hosting:
   ```
   firebase deploy --only hosting
   ```

## MATS schema

Each entry produced:
```js
{
  v: "Avery",                    // vendor (inferred from vref column)
  s: "100WPET",                  // spec code (Our Spec)
  d: "3.5mil White Cosmetic Web 350 HB",  // description
  m: null,                       // MSI cost — null until you enter it
  mk: null,                      // MSI marked-up (customer-facing)
  liner: "40#CK Liner",          // OPTIONAL — only on label-stock entries
  adhesive: "C2500",             // OPTIONAL — only on label-stock entries
}
```

`liner` and `adhesive` are currently extra fields not read by the existing UI. They're preserved so a future Firestore migration can extract them into separate `liner` + `adhesive` catalogs without re-parsing the source docs.

## Known limitations

- **Vendor inference** keys off keywords in the "Vendor Spec#" cell. Anything that doesn't match a known pattern falls back to `v: "STD"`. To improve this, extend `infer_vendor()` in `parse_stock_lists.py`.
- **No MSI prices.** The vendor stock-list docs don't include pricing. New entries land with `m: null` and `mk: null`. Enter prices via the Manage UI (one-time per material as it gets quoted) or extend the parser when the vendor sends a price list.
- **`EXISTING_SPECS` is a static set** inside `parse_stock_lists.py`, only used for the printed summary. The actual file dedup happens inside `build_mats_patch.py` against the live MATS array — so even if `EXISTING_SPECS` is stale, dedup is still correct.

## Rolling back

```
cd scripts/import-stock-lists
cp backups/core.js.before-mats-import-YYYYMMDD-HHMMSS.bak ../../public/js/core.js
```
