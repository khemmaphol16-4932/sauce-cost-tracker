"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { buildReceiptCanvas, type ReceiptData } from "@/lib/receipt";
import { getSerial, printCanvas, type SerialPortLike } from "@/lib/peripage";
import type { ReceiptProfile } from "@/lib/data/receipt-profile";
import type { PrintJob } from "@/lib/print-jobs";
import { todayISO } from "@/lib/dates";
import { claimPrintJobs, finishPrintJob, retryPrintJob } from "./actions";

const POLL_MS = 15_000; // fallback only — realtime normally wakes us instantly

const STATUS_STYLES: Record<PrintJob["status"], string> = {
  queued: "bg-surface text-text-secondary",
  printing: "bg-accent/15 text-accent",
  printed: "bg-success/20 text-success",
  failed: "bg-alert-bg text-alert",
};

// Runs on the shop computer in Chrome/Edge, connected to the paired PeriPage
// A6 through Web Serial. New jobs (queued by checkout on any phone) arrive via
// Supabase realtime, with a slow poll as a safety net.
export function PrintStation({
  profile,
  businessId,
  initialJobs,
  setupError,
}: {
  profile: ReceiptProfile;
  businessId: string;
  initialJobs: PrintJob[];
  setupError: string | null;
}) {
  const [supported, setSupported] = useState(true);
  const [port, setPort] = useState<SerialPortLike | null>(null);
  const [jobs, setJobs] = useState<PrintJob[]>(initialJobs);
  const [message, setMessage] = useState<string | null>(setupError);
  const [live, setLive] = useState(false);
  const busy = useRef(false);
  const again = useRef(false);
  const portRef = useRef<SerialPortLike | null>(null);

  const upsertJob = (job: PrintJob) =>
    setJobs((list) => [job, ...list.filter((j) => j.id !== job.id)].slice(0, 20));

  const printOne = useCallback(
    async (data: ReceiptData) => {
      const p = portRef.current;
      if (!p) throw new Error("Printer isn't connected");
      const canvas = await buildReceiptCanvas(data, 1); // exactly 384 dots wide
      await printCanvas(p, canvas);
    },
    []
  );

  // Claim everything queued and print it in order. Re-entrancy guarded: a
  // wake-up that arrives mid-print just schedules one more pass.
  const processQueue = useCallback(async () => {
    if (!portRef.current) return;
    if (busy.current) {
      again.current = true;
      return;
    }
    busy.current = true;
    try {
      do {
        again.current = false;
        const claimed = await claimPrintJobs();
        if ("error" in claimed) {
          setMessage(claimed.error);
          break;
        }
        for (const job of claimed.jobs) {
          upsertJob({ ...job, status: "printing" });
          try {
            await printOne({ ...profile, ...job.payload });
            await finishPrintJob(job.id, null);
            upsertJob({ ...job, status: "printed", error: null });
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Print failed";
            await finishPrintJob(job.id, msg);
            upsertJob({ ...job, status: "failed", error: msg });
          }
        }
      } while (again.current);
    } finally {
      busy.current = false;
    }
  }, [printOne, profile]);

  const openPort = useCallback(
    async (p: SerialPortLike) => {
      // Bluetooth serial ports ignore the baud rate, but open() requires one.
      await p.open({ baudRate: 115200 });
      portRef.current = p;
      setPort(p);
      setMessage(null);
      void processQueue();
    },
    [processQueue]
  );

  // Reconnect automatically to a printer this browser was allowed before.
  useEffect(() => {
    const serial = getSerial();
    if (!serial) {
      setSupported(false);
      return;
    }
    serial
      .getPorts()
      .then((ports) => (ports.length === 1 ? openPort(ports[0]) : undefined))
      .catch(() => undefined);
    const onDisconnect = (e: Event) => {
      if ((e.target as unknown) === portRef.current) {
        portRef.current = null;
        setPort(null);
        setMessage("Printer disconnected — turn it on, then press Connect printer.");
      }
    };
    (serial as unknown as EventTarget).addEventListener?.("disconnect", onDisconnect);
    return () => (serial as unknown as EventTarget).removeEventListener?.("disconnect", onDisconnect);
  }, [openPort]);

  // Realtime wake-up on new jobs. `worker: true` keeps the socket heartbeat
  // alive when this window is in the background.
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { isSingleton: false, realtime: { worker: true } }
    );
    const channel = supabase
      .channel(`print_jobs:${businessId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "print_jobs", filter: `business_id=eq.${businessId}` },
        () => void processQueue()
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    const poll = setInterval(() => void processQueue(), POLL_MS);
    return () => {
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [businessId, processQueue]);

  // Ask the computer not to sleep while the station is open (best effort).
  useEffect(() => {
    type WakeLockNav = Navigator & { wakeLock?: { request(type: "screen"): Promise<unknown> } };
    (navigator as WakeLockNav).wakeLock?.request("screen").catch(() => undefined);
  }, []);

  const connect = async () => {
    const serial = getSerial();
    if (!serial) return;
    try {
      await openPort(await serial.requestPort());
    } catch (err) {
      if (err instanceof Error && err.name === "NotFoundError") return; // picker cancelled
      setMessage(
        err instanceof Error
          ? `Couldn't open the printer: ${err.message}. Check it's on and paired, then try the other COM port.`
          : "Couldn't open the printer"
      );
    }
  };

  const testPrint = async () => {
    setMessage(null);
    try {
      await printOne({
        ...profile,
        dateLabel: todayISO(),
        customerRef: "ทดสอบ / Test",
        lines: [{ name: "Test print", qty: 1, price: 0 }],
        total: 0,
      });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Test print failed");
    }
  };

  const retry = async (id: string) => {
    const result = await retryPrintJob(id);
    if (result?.error) setMessage(result.error);
    else void processQueue();
  };

  if (!supported) {
    return (
      <div className="card space-y-2 text-sm text-text">
        <p className="font-semibold">Open this page on the shop computer in Chrome or Edge.</p>
        <p className="text-text-secondary">
          This browser can&apos;t talk to the printer (phones and Safari can&apos;t). Orders you take on
          your phone will still be queued and print once the station is running.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`h-3 w-3 rounded-full ${port ? "bg-success" : "bg-alert"}`}
            aria-hidden
          />
          <div>
            <p className="text-base font-semibold text-text">
              {port ? "Printer connected" : "Printer not connected"}
            </p>
            <p className="text-xs text-text-secondary">
              {live ? "Listening for new orders" : "Connecting to order queue…"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {port && (
            <button
              type="button"
              onClick={testPrint}
              className="min-h-11 rounded-xl border border-border px-4 text-sm font-medium text-text"
            >
              Test print
            </button>
          )}
          {!port && (
            <button type="button" onClick={connect} className="min-h-11 rounded-xl btn-primary px-4">
              Connect printer
            </button>
          )}
        </div>
      </div>

      {message && <p className="rounded-xl bg-alert-bg px-4 py-3 text-sm text-alert">{message}</p>}

      {!port && (
        <div className="card space-y-2 text-sm text-text-secondary">
          <p className="font-semibold text-text">First time on this computer</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Turn the PeriPage A6 on and pair it in the computer&apos;s Bluetooth settings.</li>
            <li>
              Press <span className="text-text">Connect printer</span> and pick its port (on Windows it
              shows as “Standard Serial over Bluetooth link (COMx)” — if one doesn&apos;t work, try the
              other).
            </li>
            <li>After that the browser remembers it and reconnects by itself.</li>
          </ol>
          <p>Keep this window open (it can sit behind others) and the computer awake.</p>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-secondary">
          Recent labels
        </p>
        {jobs.length === 0 ? (
          <p className="py-4 text-center text-sm text-text-secondary">
            Nothing yet. Sell with “Print on: Shop computer” and labels appear here.
          </p>
        ) : (
          <ul className="rounded-2xl border border-border bg-surface px-4">
            {jobs.map((job) => (
              <li key={job.id} className="flex items-center gap-3 border-b border-border py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">
                    {job.payload.customerRef || "No name"} ·{" "}
                    <span className="font-mono">฿{job.payload.total.toFixed(0)}</span>
                  </p>
                  <p className="truncate text-xs text-text-secondary">
                    {job.payload.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}
                  </p>
                  {job.error && <p className="text-xs text-alert">{job.error}</p>}
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[job.status]}`}>
                  {job.status}
                </span>
                {(job.status === "failed" || job.status === "printing") && (
                  <button
                    type="button"
                    onClick={() => retry(job.id)}
                    className="min-h-11 shrink-0 px-2 text-xs text-accent underline underline-offset-2"
                  >
                    Retry
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
