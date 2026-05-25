/**
 * TypeScript types matching the Firestore data model.
 * See `microflex-crm-architecture.md` §3 for the full schema.
 */
import type { Timestamp } from 'firebase/firestore';

export type Role =
  | 'admin' | 'sales_mgr' | 'sales' | 'cs' | 'art' | 'buyer'
  | 'planner' | 'operator' | 'qc' | 'shipping' | 'finance' | 'exec';

export type CompanyType = 'client' | 'vendor' | 'both';
export type CompanyStatus = 'active' | 'prospect' | 'inactive' | 'do_not_contact';

export interface Company {
  id?: string;
  type: CompanyType;
  name: string;
  dba?: string;
  status: CompanyStatus;
  industry: string;
  website?: string;
  website_domain?: string;
  phone?: string;
  addresses?: Address[];
  billing_terms?: string;
  credit_limit?: number;
  currency?: string;
  tags?: string[];
  owners?: string[];
  primary_contact_id?: string;
  custom_fields?: Record<string, unknown>;
  health_score?: number;
  health_updated_at?: Timestamp;
  last_activity_at?: Timestamp;
  created_at?: Timestamp;
  updated_at?: Timestamp;
}
export interface Address { line1: string; line2?: string; city: string; region: string; postal: string; country: string; }

export type ProductType =
  | 'stand_up_pouch' | 'flat_pouch' | 'stick_pack' | 'sachet' | 'gusset_bag'
  | 'shrink_sleeve' | 'label' | 'printed_film_roll'
  | 'display_box' | 'master_case';

export interface Product {
  id?: string;
  sku: string;
  name: string;
  product_type: ProductType;
  structure: string;
  layers?: { substrate: string; gauge_microns: number; source: string }[];
  dims: { width_mm?: number; height_mm?: number; gusset_mm?: number; depth_mm?: number; length_m_per_roll?: number };
  print: { method: 'flexo' | 'digital' | 'gravure'; colors: number; finish: string };
  fitments?: string[];
  board_spec?: { caliper: string; type: string };
  die_id?: string;
  dieline_drive_id?: string;
  food_contact?: boolean;
  prop65?: boolean;
  regulatory?: string[];
  moq?: number;
  moq_unit?: 'pcs' | 'rolls' | 'kg';
  lead_time_days?: number;
  list_price?: number;
  std_cost?: number;
  art_file_id?: string;
  art_version?: string;
}

export interface RawMaterial {
  id?: string;
  name: string;
  category: string;
  spec?: string;
  vendor_ids: string[];
  current_price?: number;
  price_unit?: string;
  current_lead_time_days?: number;
  on_hand_qty?: number;
  reorder_point?: number;
}

export interface ArtFile {
  id?: string;
  product_id: string;
  company_id: string;
  version: string;
  status: 'received' | 'in_proof' | 'revision' | 'approved' | 'obsolete';
  drive_file_id: string;
  approved_by_customer_at?: Timestamp;
  approved_by_uid?: string;
  notes?: string;
}

export type OppStage = 'inquiry' | 'qualified' | 'quoted' | 'negotiating' | 'won' | 'lost';
export interface Opportunity {
  id?: string;
  company_id: string;
  title: string;
  stage: OppStage;
  rfq?: { polymer?: string; structure?: string; gauge?: string; width?: string; qty_kg?: number; target_price?: number; application?: string; end_use?: string };
  value_estimate?: number;
  probability?: number;
  owner_id: string;
  source?: string;
  expected_close?: Timestamp;
  lost_reason?: string;
  won_at?: Timestamp;
}

export type IntakeStage =
  | 'rfq' | 'quoting' | 'quote_sent'
  | 'po_received' | 'order_confirmed' | 'passport_released';
export interface IntakeFlow {
  id?: string;
  opp_id?: string;
  company_id: string;
  title: string;
  contact: string;
  contact_email: string;
  stage: IntakeStage;
  entered_at: Timestamp;
  artifacts: {
    rfq?: { received_at: Timestamp; via: string; notes: string; target_sku?: string; target_qty?: number; target_deadline?: Timestamp };
    quote?: Quote;
    customer_po?: CustomerPO;
    sales_order?: { id: string; issued_at: Timestamp; issued_by: string; total: number; art_gate: 'pass'|'fail'; credit_check: 'pass'|'fail'; material_check: 'pass'|'fail'; blockers?: string[] };
    passport?: { id: string; released_at: Timestamp; released_by: string; ticket_count: number; tickets: string[] };
  };
  history: { at: Timestamp; by: string; event: string }[];
}
export interface QuoteLineItem { sku: string; desc: string; qty: number; unit: string; unit_price: number; total: number; }
export interface Quote {
  id: string;
  version: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  sent_at?: Timestamp;
  viewed_at?: Timestamp;
  accepted_at?: Timestamp;
  validity_days: number;
  line_items: QuoteLineItem[];
  subtotal: number;
  freight: number;
  total: number;
  terms: string;
  drive_pdf_id?: string;
}
export interface CustomerPO {
  number: string;
  received_at: Timestamp;
  file_name: string;
  drive_file_id?: string;
  total: number;
  ship_to: string;
  confirmed_delivery: Timestamp;
  notes?: string;
}

export interface SalesOrder {
  id?: string;
  opp_id?: string;
  company_id: string;
  customer_po: string;
  status: 'open' | 'confirmed' | 'in_production' | 'ready' | 'shipped' | 'invoiced' | 'closed';
  line_items: { product_id: string; qty: number; qty_unit: 'pcs'|'rolls'|'kg'; unit_price: number; total: number }[];
  requested_delivery?: Timestamp;
  confirmed_delivery: Timestamp;
  ship_to?: Address;
  drive_folder_id?: string;
  passport_id?: string;
  total: number;
}

export type PassportStatus = 'draft' | 'released' | 'in_production' | 'complete' | 'closed' | 'on_hold';
export interface JobPassport {
  id?: string;
  passport_no: string;
  order_id: string;
  company_id: string;
  customer_po: string;
  status: PassportStatus;
  issued_at: Timestamp;
  issued_by: string;
  released_at?: Timestamp;
  closed_at?: Timestamp;
  due_date: Timestamp;
  rollup: {
    planned_kg: number; actual_kg: number; scrap_kg: number; yield_pct?: number;
    on_time?: boolean; ticket_count: number; tickets_complete: number;
  };
  qr_code_url?: string;
  drive_pdf_id?: string;
}

export type TicketStatus = 'draft' | 'released' | 'queued' | 'in_progress' | 'qc_hold' | 'complete' | 'cancelled';
export type StageId =
  | 'art_approval' | 'plate_prep' | 'printing' | 'lamination' | 'slitting'
  | 'pouch_forming' | 'fitment_attach' | 'die_cut' | 'folding_gluing'
  | 'assembly' | 'qc' | 'pack_out';
export interface RouteStep {
  seq: number;
  stage: StageId;
  machine_id?: string | null;
  est_hours?: number;
  planned_start?: Timestamp;
  planned_end?: Timestamp;
  actual_start?: Timestamp | null;
  actual_end?: Timestamp | null;
  status: 'queued' | 'active' | 'done' | 'hold';
}
export interface JobTicket {
  id?: string;
  ticket_no: string;
  line_index: number;
  sku: string;
  product_id: string;
  spec_snapshot: Record<string, unknown>;
  planned: { qty: number; qty_unit: 'pcs'|'rolls'|'kg'; deadline: Timestamp; priority: number };
  bom?: { material_id: string; material_name: string; qty: number; qty_unit: string; lot_required: boolean }[];
  route: RouteStep[];
  actuals: { produced_kg: number; scrap_kg: number; yield_pct: number; downtime_min?: number };
  qc: { result: 'pending' | 'pass' | 'fail' | 'hold' | 'conditional'; coa_drive_id?: string; inspector_id?: string; inspected_at?: Timestamp; measurements?: Record<string, unknown>; defect_log?: unknown[]; note?: string };
  traceability: { in_lots: { material_id: string; lot_no: string; vendor_id: string; po_id: string; qty_kg: number }[]; out_lot?: string | null; operators?: string[]; shifts?: string[] };
  ship?: { shipment_id?: string; ship_to?: string; scheduled_ship?: Timestamp };
  status: TicketStatus;
  hold_reason?: string;
  hold_by?: string;
  hold_at?: Timestamp;
}

export interface PurchaseOrder {
  id?: string;
  vendor_id: string;
  po_number: string;
  status: 'open' | 'received' | 'exception' | 'closed';
  line_items: { material_id: string; qty: number; unit_price: number; expected?: Timestamp }[];
  total: number;
  currency?: string;
  expected_arrival?: Timestamp;
  drive_pdf_id?: string;
}

export interface Shipment {
  id?: string;
  direction: 'inbound' | 'outbound';
  related_id: string;
  carrier: string;
  service?: string;
  tracking?: string;
  bol_drive_id?: string;
  scheduled_pickup?: Timestamp;
  scheduled_delivery: Timestamp;
  actual_delivery?: Timestamp;
  status: 'scheduled' | 'in_transit' | 'delivered' | 'exception';
}

export interface Invoice {
  id?: string;
  type: 'AR' | 'AP';
  related_id: string;
  amount: number;
  currency: string;
  due_date: Timestamp;
  paid_at?: Timestamp;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
  drive_pdf_id?: string;
}

export interface Task {
  id?: string;
  title: string;
  description?: string;
  due_at?: Timestamp;
  assignee_id?: string;
  assignee_role?: Role;
  status: 'open' | 'in_progress' | 'done' | 'cancelled';
  priority: 'high' | 'med' | 'low';
  parent?: { collection: string; id: string };
}

export interface User {
  id?: string;
  email: string;
  name: string;
  photo_url?: string;
  role: Role;
  department?: string;
  manager_id?: string;
  is_active: boolean;
}
