// The business runs in Thailand (UTC+7). `new Date().toISOString()` is UTC, so
// anything logged between midnight and 07:00 local time used to land on
// yesterday's date. Always derive "today" in Bangkok time — on the client and
// on the server (Netlify functions run in UTC).
export const BUSINESS_TIME_ZONE = "Asia/Bangkok";

// "en-CA" formats as YYYY-MM-DD, the shape <input type="date"> and Postgres expect.
export function todayISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: BUSINESS_TIME_ZONE });
}
