import type { ReceiptLine } from "@/lib/receipt";

// What a queued job carries. Shop details (logo, contact, thank-you) are added
// by the print station from the current profile, not copied into every job.
export type PrintJobPayload = {
  dateLabel: string;
  lines: ReceiptLine[];
  total: number;
  customerRef: string | null;
};

export type PrintJob = {
  id: string;
  payload: PrintJobPayload;
  status: "queued" | "printing" | "printed" | "failed";
  error: string | null;
  created_at: string;
};
