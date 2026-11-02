export type Role = "executive" | "manager";
export type ShipmentStatus = "draft" | "processing" | "needs_review";
export type Profile = { id: string; display_name: string; role: Role };
export type Shipment = { id: string; reference: string; supplier: string; created_by: string; status: ShipmentStatus; created_at: string };
export type Document = { id: string; shipment_id: string; kind: "invoice" | "packing_list" | "bill_of_lading"; filename: string; storage_path: string; mime_type: string; size_bytes: number; created_at: string };
export type ExtractionRun = { id: string; document_id: string; status: "processing" | "completed" | "failed"; result: unknown; error_message: string | null; created_at: string };
