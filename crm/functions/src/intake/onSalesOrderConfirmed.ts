/**
 * onSalesOrderConfirmed
 *
 * The value-loop function. When a sales_order transitions to status='confirmed'
 * (or 'in_production'), this:
 *
 *   1. Creates a Job Passport with passport_no = JP-YYYY-MMDD-X
 *   2. Issues one Job Ticket per order line, copying the spec snapshot from the SKU
 *      (frozen at this moment so later spec edits don't disturb live jobs)
 *   3. Generates one production_job per ticket × stage with the planned route
 *   4. Provisions the Drive folder structure for the customer if missing
 *   5. Renders a passport packet PDF from the Docs template
 *   6. Writes an entry to the company's activity feed
 *
 * Architecture doc reference: §10 (Job Passport workflow) and §6 (Cloud Functions).
 */
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger }            from 'firebase-functions/v2';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

interface SalesOrderLine {
  product_id: string;
  qty: number;
  qty_unit: 'pcs' | 'rolls' | 'kg';
  unit_price: number;
}
interface SalesOrder {
  id: string;
  status: string;
  company_id: string;
  customer_po: string;
  line_items: SalesOrderLine[];
  confirmed_delivery: Timestamp;
}

const ROUTE_TEMPLATES: Record<string, string[]> = {
  stand_up_pouch:  ['plate_prep', 'printing', 'lamination', 'slitting', 'pouch_forming', 'qc'],
  flat_pouch:      ['plate_prep', 'printing', 'lamination', 'slitting', 'pouch_forming', 'qc'],
  stick_pack:      ['plate_prep', 'printing', 'lamination', 'slitting', 'pouch_forming', 'qc'],
  sachet:          ['plate_prep', 'printing', 'lamination', 'slitting', 'pouch_forming', 'qc'],
  shrink_sleeve:   ['plate_prep', 'printing',                'slitting',                  'qc'],
  label:           ['plate_prep', 'printing', 'lamination', 'slitting', 'die_cut',       'qc'],
  printed_film_roll:['plate_prep','printing', 'lamination', 'slitting',                  'qc'],
  display_box:     ['plate_prep', 'printing',                'die_cut',  'folding_gluing','qc'],
  master_case:     ['plate_prep', 'printing',                'die_cut',  'folding_gluing','qc'],
};

export const onSalesOrderConfirmed = onDocumentUpdated(
  {
    document: 'sales_orders/{orderId}',
    region:   'us-west1',
    secrets:  ['google-oauth-client-secret'],
  },
  async (event) => {
    const before = event.data?.before.data() as SalesOrder | undefined;
    const after  = event.data?.after.data()  as SalesOrder | undefined;
    if (!before || !after) return;

    // Trigger only on the open → in_production transition (or open → confirmed)
    const becameConfirmed =
      before.status === 'open' &&
      ['confirmed', 'in_production'].includes(after.status);
    if (!becameConfirmed) return;

    const db = getFirestore();
    const orderId = event.params.orderId;
    logger.info(`Order ${orderId} confirmed — generating passport`);

    // 1. Compute passport id
    const today = new Date();
    const dateKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`;
    const seqRef = db.doc(`system_config/sequences-${dateKey}`);
    const seq = await db.runTransaction(async (tx) => {
      const snap = await tx.get(seqRef);
      const next = ((snap.data()?.passport ?? 0) as number) + 1;
      tx.set(seqRef, { passport: next }, { merge: true });
      return next;
    });
    const letter = String.fromCharCode(64 + seq); // A, B, C…
    const passportId = `JP-${dateKey}-${letter}`;

    // 2. Create the passport doc
    const passportRef = db.doc(`job_passports/${passportId}`);
    await passportRef.set({
      passport_no: passportId,
      order_id:    orderId,
      company_id:  after.company_id,
      customer_po: after.customer_po,
      status:      'released',
      issued_at:   FieldValue.serverTimestamp(),
      issued_by:   'system',  // a human user can also issue manually
      due_date:    after.confirmed_delivery,
      rollup: {
        planned_kg: 0, actual_kg: 0, scrap_kg: 0,
        ticket_count: after.line_items.length, tickets_complete: 0,
      },
      _lastModifiedBy: 'system',
    });

    // 3. Issue one ticket per line
    for (let i = 0; i < after.line_items.length; i++) {
      const line = after.line_items[i];
      const productSnap = await db.doc(`products/${line.product_id}`).get();
      const product = productSnap.data();
      if (!product) {
        logger.warn(`Product ${line.product_id} not found — skipping line ${i}`);
        continue;
      }

      const ticketNo = String(i + 1).padStart(2, '0');
      const ticketId = `JT-${dateKey}-${letter}-${ticketNo}`;
      const route = (ROUTE_TEMPLATES[product.product_type] ?? ROUTE_TEMPLATES.printed_film_roll)
        .map((stage, idx) => ({
          seq: idx + 1,
          stage,
          machine_id: null,        // planner assigns
          status: 'queued',
          planned_start: null,
          planned_end:   null,
          actual_start:  null,
          actual_end:    null,
        }));

      await passportRef.collection('tickets').doc(ticketId).set({
        ticket_no: ticketNo,
        line_index: i,
        sku: product.sku,
        product_id: line.product_id,
        spec_snapshot: {           // immutable copy at release
          product_type: product.product_type,
          structure:    product.structure,
          dims:         product.dims,
          print:        product.print,
          fitments:     product.fitments,
          art_drive_id: product.art_file_id,
          art_version:  product.art_version,
          food_contact: product.food_contact,
          regulatory:   product.regulatory,
          frozen_at:    FieldValue.serverTimestamp(),
        },
        planned: {
          qty:      line.qty,
          qty_unit: line.qty_unit,
          deadline: after.confirmed_delivery,
          priority: 3,
        },
        bom: [],   // Procurement fills this when material lots arrive
        route,
        actuals: { produced_kg: 0, scrap_kg: 0, yield_pct: 0 },
        qc: { result: 'pending' },
        traceability: { in_lots: [], out_lot: null, operators: [] },
        status: 'released',
        _lastModifiedBy: 'system',
      });
    }

    // 4. Activity log on the company
    await db
      .collection('companies').doc(after.company_id)
      .collection('activities').add({
        type: 'note',
        subject: `Passport ${passportId} released — ${after.line_items.length} ticket(s)`,
        body:    `Sales order ${orderId} confirmed and converted to job passport.`,
        owner_id: 'system',
        related_passport_id: passportId,
        related_order_id:    orderId,
        occurred_at: FieldValue.serverTimestamp(),
      });

    // 5. Drive folder + passport PDF — left as TODO when Workspace OAuth is wired
    // TODO: ensureDriveFolder(after.company_id);
    // TODO: renderPassportPdf(passportId);

    logger.info(`Passport ${passportId} issued with ${after.line_items.length} tickets`);
  }
);
