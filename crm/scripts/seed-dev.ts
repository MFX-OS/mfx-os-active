/**
 * Seed Firestore with sample data for the Microflex CRM.
 *
 *   npm run seed
 *
 * Uses mfx-2026 (the MFX-OS project). Idempotent — running twice doesn't duplicate.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';

const projectId = 'mfx-2026';
process.env.GCLOUD_PROJECT = projectId;
initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();
const now = () => FieldValue.serverTimestamp();

async function seed() {
  console.log(`Seeding ${projectId}…`);

  // ---- Users (8) ----
  const users = [
    { id:'u-randy', email:'randy@microflexfilm.com',  name:'Randy A.',     role:'admin',     department:'Exec',         is_active:true },
    { id:'u-mara',  email:'mara@microflexfilm.com',   name:'Mara Chen',    role:'sales_mgr', department:'Sales',        is_active:true },
    { id:'u-jorge', email:'jorge@microflexfilm.com',  name:'Jorge Reyes',  role:'sales',     department:'Sales',        is_active:true },
    { id:'u-priya', email:'priya@microflexfilm.com',  name:'Priya Patel',  role:'cs',        department:'Customer',     is_active:true },
    { id:'u-dom',   email:'dom@microflexfilm.com',    name:'Dom Walker',   role:'art',       department:'Prepress',     is_active:true },
    { id:'u-ken',   email:'ken@microflexfilm.com',    name:'Ken Tanaka',   role:'planner',   department:'Production',   is_active:true },
    { id:'u-lia',   email:'lia@microflexfilm.com',    name:'Lia Brooks',   role:'qc',        department:'QC',           is_active:true },
    { id:'u-sam',   email:'sam@microflexfilm.com',    name:'Sam Ortiz',    role:'buyer',     department:'Procurement',  is_active:true },
  ];
  for (const u of users) {
    await db.doc(`users/${u.id}`).set({ ...u, created_at: now(), updated_at: now() }, { merge: true });
  }

  // ---- Companies (11) ----
  const companies = [
    { id:'c-greenleaf',   name:'Greenleaf Naturals',  type:'client', industry:'supplements', website_domain:'greenleaf.co',   tags:['top-10','recurring'],     owners:['u-jorge'], health_score:88 },
    { id:'c-pressedjuice',name:'Pressed Juice Co.',   type:'client', industry:'food',        website_domain:'pressedjuice.co',tags:['print-heavy'],            owners:['u-mara'],  health_score:74 },
    { id:'c-zenpets',     name:'ZenPets',             type:'client', industry:'pet',         website_domain:'zenpets.com',    tags:['top-10','growing'],       owners:['u-jorge'], health_score:91 },
    { id:'c-luminae',     name:'Luminae Skincare',    type:'client', industry:'cosmetics',   website_domain:'luminae.co',     tags:['at-risk'],                owners:['u-mara'],  health_score:62 },
    { id:'c-roastline',   name:'Roastline Coffee',    type:'client', industry:'food',        website_domain:'roastline.co',   tags:['recurring'],              owners:['u-jorge'], health_score:80 },
    { id:'c-cleanpaws',   name:'CleanPaws',           type:'client', industry:'pet',         website_domain:'cleanpaws.com',  tags:['stuck-art'],              owners:['u-mara'],  health_score:55 },
    { id:'c-flexfilm',    name:'Flex Films USA',      type:'vendor', industry:'substrate',   website_domain:'flexfilm.com',   tags:['BOPP','PET','primary'],   owners:['u-sam'],   health_score:84 },
    { id:'c-sunchem',     name:'SunChem Inks',        type:'vendor', industry:'ink',         website_domain:'sunchem.com',    tags:['flexo'],                  owners:['u-sam'],   health_score:78 },
    { id:'c-bondtech',    name:'BondTech Adhesives',  type:'vendor', industry:'adhesive',    website_domain:'bondtech.com',   tags:['solventless'],            owners:['u-sam'],   health_score:70 },
    { id:'c-zipline',     name:'Zipline Fitments',    type:'vendor', industry:'fitments',    website_domain:'ziplinefit.com', tags:['zippers','spouts'],       owners:['u-sam'],   health_score:90 },
    { id:'c-westboard',   name:'Westboard Paperco',   type:'vendor', industry:'board',       website_domain:'westboard.com',  tags:['SBS','corrugate','local'],owners:['u-sam'],   health_score:82 },
  ];
  for (const c of companies) {
    await db.doc(`companies/${c.id}`).set({ ...c, status:'active', created_at: now(), updated_at: now() }, { merge: true });
  }

  // ---- Products (6) ----
  const products = [
    { id:'sku-pouch-zip-8oz', sku:'MF-PCH-Z08', name:'8 oz Stand-up Pouch · Zipper', product_type:'stand_up_pouch',
      structure:'PET12/MET-PET/LLDPE-100', dims:{width_mm:130,height_mm:200,gusset_mm:60},
      print:{method:'flexo',colors:6,finish:'matte'}, fitments:['zipper','tear_notch'], food_contact:true,
      moq:10000, moq_unit:'pcs', lead_time_days:14, list_price:0.118 },
    { id:'sku-stick-3ml',     sku:'MF-STK-03', name:'3 ml Stick Pack', product_type:'stick_pack',
      structure:'PET12/AL7/LLDPE-50', dims:{width_mm:70,height_mm:80},
      print:{method:'gravure',colors:4,finish:'matte'}, fitments:['tear_notch'], food_contact:true,
      moq:50000, moq_unit:'pcs', lead_time_days:18, list_price:0.024 },
    { id:'sku-sachet-10ml',   sku:'MF-SCH-10', name:'10 ml Sachet', product_type:'sachet',
      structure:'PET12/AL9/LLDPE-60', dims:{width_mm:80,height_mm:100},
      print:{method:'gravure',colors:5,finish:'gloss'}, fitments:['tear_notch'], food_contact:true,
      moq:25000, moq_unit:'pcs', lead_time_days:18, list_price:0.041 },
    { id:'sku-shrink-bottle', sku:'MF-SHR-12', name:'Shrink Sleeve · 12 oz', product_type:'shrink_sleeve',
      structure:'PETG-50', dims:{width_mm:120,height_mm:100},
      print:{method:'gravure',colors:8,finish:'gloss'}, food_contact:false,
      moq:25000, moq_unit:'pcs', lead_time_days:14, list_price:0.062 },
    { id:'sku-label-roll',    sku:'MF-LBL-04', name:'Pressure-Sensitive Label', product_type:'label',
      structure:'BOPP-50/Adhesive', dims:{width_mm:60,height_mm:80},
      print:{method:'flexo',colors:6,finish:'matte'}, food_contact:false,
      moq:10000, moq_unit:'pcs', lead_time_days:10, list_price:0.018 },
    { id:'sku-display-box',   sku:'MF-DSP-01', name:'Counter Display Box', product_type:'display_box',
      structure:'SBS-24pt', dims:{width_mm:200,height_mm:150,depth_mm:80},
      print:{method:'flexo',colors:4,finish:'soft_touch'}, food_contact:false,
      board_spec:{caliper:'24pt',type:'SBS'}, moq:500, moq_unit:'pcs', lead_time_days:21, list_price:2.40 },
  ];
  for (const p of products) {
    await db.doc(`products/${p.id}`).set({ ...p, created_at: now(), updated_at: now() }, { merge: true });
  }

  // ---- Raw materials (7) ----
  const materials = [
    { id:'rm-pet12',  name:'PET Substrate 12 µ',     category:'substrate_film', vendor_ids:['c-flexfilm'],  current_price:3.42, price_unit:'kg', on_hand_qty:8400,  reorder_point:3000 },
    { id:'rm-pe100',  name:'LLDPE 100 µ Sealant',    category:'substrate_film', vendor_ids:['c-flexfilm'],  current_price:2.18, price_unit:'kg', on_hand_qty:12200, reorder_point:4000 },
    { id:'rm-foilal9',name:'Aluminum Foil 9 µ',      category:'substrate_film', vendor_ids:['c-flexfilm'],  current_price:8.10, price_unit:'kg', on_hand_qty:1800,  reorder_point:500 },
    { id:'rm-ink-cy', name:'Flexo Cyan Ink',         category:'ink',            vendor_ids:['c-sunchem'],   current_price:24.0, price_unit:'kg', on_hand_qty:180,   reorder_point:80 },
    { id:'rm-adh-sl', name:'Solventless Adhesive',   category:'adhesive',       vendor_ids:['c-bondtech'],  current_price:6.80, price_unit:'kg', on_hand_qty:620,   reorder_point:200 },
    { id:'rm-zip-pe', name:'PE Zipper · 130 mm',     category:'zipper',         vendor_ids:['c-zipline'],   current_price:0.09, price_unit:'m',  on_hand_qty:42000, reorder_point:10000 },
    { id:'rm-sbs24',  name:'SBS Board · 24 pt',      category:'board_stock',    vendor_ids:['c-westboard'], current_price:1.18, price_unit:'sheet', on_hand_qty:1400, reorder_point:500 },
  ];
  for (const m of materials) {
    await db.doc(`raw_materials/${m.id}`).set({ ...m, created_at: now(), updated_at: now() }, { merge: true });
  }

  // ---- A few opportunities so the pipeline isn't empty ----
  const opps = [
    { id:'opp-1', company_id:'c-greenleaf',   title:'Q3 reprint — 8oz pouch + label + display', stage:'won',         value_estimate:48200, owner_id:'u-jorge', expected_close: Timestamp.fromDate(new Date('2026-04-28')) },
    { id:'opp-2', company_id:'c-zenpets',     title:'Probiotic chews — new SKU launch',          stage:'negotiating', value_estimate:62400, owner_id:'u-jorge', expected_close: Timestamp.fromDate(new Date('2026-05-08')) },
    { id:'opp-3', company_id:'c-pressedjuice',title:'Cold-press shrink sleeves — 6 SKUs',        stage:'quoted',      value_estimate:38900, owner_id:'u-mara',  expected_close: Timestamp.fromDate(new Date('2026-05-12')) },
    { id:'opp-4', company_id:'c-luminae',     title:'Serum sachets — sample run',                stage:'qualified',   value_estimate:11800, owner_id:'u-mara',  expected_close: Timestamp.fromDate(new Date('2026-05-20')) },
    { id:'opp-5', company_id:'c-roastline',   title:'Single-serve drip coffee sachets',          stage:'inquiry',     value_estimate:24000, owner_id:'u-jorge', expected_close: Timestamp.fromDate(new Date('2026-05-30')) },
  ];
  for (const o of opps) {
    await db.doc(`opportunities/${o.id}`).set({ ...o, created_at: now(), updated_at: now() }, { merge: true });
  }

  console.log(`✓ Seeded ${users.length} users, ${companies.length} companies, ${products.length} products, ${materials.length} materials, ${opps.length} opps`);
}

seed().catch((err) => { console.error(err); process.exit(1); });
