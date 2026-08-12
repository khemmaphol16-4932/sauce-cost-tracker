import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/data/businesses";

export const RETENTION_WINDOWS_DAYS = [3, 7, 14, 30, 45, 60] as const;

export type RetentionWindow = {
  days: number;
  uniqueCustomers: number;
  repeatCustomers: number;
  repeatRatePct: number | null;
};

export type PeakHour = { hour: number; count: number };

export type SalesAnalytics = {
  retention: RetentionWindow[];
  peakHours: PeakHour[];
};

// Sales are logged close to when they happen, but created_at is a logging
// timestamp, not a verified customer-order timestamp — peak-hour accuracy
// depends on that logging habit.
const DISPLAY_TIMEZONE = "Asia/Bangkok";

export async function getSalesAnalytics(): Promise<SalesAnalytics> {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId();

  const maxWindowDays = Math.max(...RETENTION_WINDOWS_DAYS);
  const maxWindowStart = new Date();
  maxWindowStart.setDate(maxWindowStart.getDate() - maxWindowDays);
  const maxWindowStartStr = maxWindowStart.toISOString().slice(0, 10);

  const [{ data: retentionSales, error: retentionError }, { data: allSales, error: allSalesError }] =
    await Promise.all([
      supabase
        .from("sales")
        .select("customer_ref, sale_date")
        .eq("business_id", businessId)
        .not("customer_ref", "is", null)
        .gte("sale_date", maxWindowStartStr),
      supabase.from("sales").select("created_at").eq("business_id", businessId),
    ]);
  if (retentionError) throw new Error(retentionError.message);
  if (allSalesError) throw new Error(allSalesError.message);

  const customerSales = (retentionSales ?? []).filter(
    (s) => s.customer_ref && s.customer_ref.trim() !== ""
  );

  const today = new Date();
  const retention: RetentionWindow[] = RETENTION_WINDOWS_DAYS.map((days) => {
    const windowStart = new Date(today);
    windowStart.setDate(windowStart.getDate() - days);
    const windowStartStr = windowStart.toISOString().slice(0, 10);

    const countByCustomer = new Map<string, number>();
    for (const s of customerSales) {
      if (s.sale_date < windowStartStr) continue;
      const ref = s.customer_ref as string;
      countByCustomer.set(ref, (countByCustomer.get(ref) ?? 0) + 1);
    }

    const uniqueCustomers = countByCustomer.size;
    const repeatCustomers = Array.from(countByCustomer.values()).filter((c) => c >= 2).length;

    return {
      days,
      uniqueCustomers,
      repeatCustomers,
      repeatRatePct: uniqueCustomers > 0 ? (repeatCustomers / uniqueCustomers) * 100 : null,
    };
  });

  const hourFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: DISPLAY_TIMEZONE,
  });

  const countByHour = new Map<number, number>();
  for (const s of allSales ?? []) {
    const hour = Number(hourFormatter.format(new Date(s.created_at))) % 24;
    countByHour.set(hour, (countByHour.get(hour) ?? 0) + 1);
  }
  const peakHours: PeakHour[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: countByHour.get(hour) ?? 0,
  }));

  return { retention, peakHours };
}
