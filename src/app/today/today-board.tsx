"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addOrder, moveOrder, bookOrder } from "./actions";
import { baht, channels, stages, total, type DeliveryOrder, type OrderItem, type Stage } from "@/lib/orders";

type Recipe = { id: string; name: string; target_sell_price: number | null };
const clock = (iso: string) => new Date(iso).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });

export function TodayBoard({ recipes, initialOrders }: { recipes: Recipe[]; initialOrders: DeliveryOrder[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<"active" | "delivered" | "cancelled">("active");
  const [online, setOnline] = useState(true);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const sync = () => { setOnline(navigator.onLine); if (navigator.onLine && !document.hidden) startTransition(() => router.refresh()); };
    const offline = () => setOnline(false);
    sync();
    const timer = setInterval(sync, 15000);
    window.addEventListener("online", sync); window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", sync);
    return () => { clearInterval(timer); window.removeEventListener("online", sync); window.removeEventListener("offline", offline); document.removeEventListener("visibilitychange", sync); };
  }, [router]);
  const active = initialOrders.filter(o => ["new", "cooking", "ready"].includes(o.status));
  const visible = initialOrders.filter(o => filter === "active" ? ["new", "cooking", "ready"].includes(o.status) : o.status === filter);
  return <div className="space-y-4">
    <div className="flex items-center justify-between text-xs text-text-secondary"><span>{online ? "อัปเดตคิวทุก 15 วินาที • เวลาประเทศไทย" : "ออฟไลน์ — ยังส่งข้อมูลไม่ได้ กรุณาเชื่อมต่อก่อน"}</span><button disabled={pending} onClick={() => startTransition(() => router.refresh())} className="px-2 py-3 underline">รีเฟรช</button></div>
    <div className="grid grid-cols-3 gap-2">{(["new", "cooking", "ready"] as Stage[]).map(s => <div key={s} className="card text-center"><p className="text-2xl font-bold">{active.filter(o => o.status === s).length}</p><p className="text-sm text-text-secondary">{stages[s]}</p></div>)}</div>
    <button className="btn-primary w-full" onClick={() => setAdding(v => !v)} aria-expanded={adding}>{adding ? "ปิดช่องเพิ่มออเดอร์" : "+ เพิ่มออเดอร์"}</button>
    <p className="text-xs text-text-secondary">กรอกออเดอร์จากแอปด้วยตนเอง • ยังไม่เชื่อม Grab / LINE MAN อัตโนมัติ</p>
    <div hidden={!adding}><OrderForm recipes={recipes} online={online} onSaved={() => { setAdding(false); router.refresh(); }} /></div>
    <div className="flex gap-2" aria-label="กรองออเดอร์">{([["active", "งานค้าง"], ["delivered", "ส่งแล้ว / รอลงยอด"], ["cancelled", "ยกเลิก"]] as const).map(([key, label]) => <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)} className={`rounded-xl border px-3 py-3 text-sm ${filter === key ? "border-accent text-accent" : "border-border"}`}>{label}</button>)}</div>
    {!visible.length && <div className="card py-10 text-center"><p>{filter === "active" ? "ไม่มีออเดอร์ค้าง" : "ยังไม่มีรายการในกลุ่มนี้"}</p><p className="mt-2 text-sm text-text-secondary">{filter === "active" ? "เมื่อมีลูกค้าสั่ง กดเพิ่มออเดอร์ด้านบนได้เลย" : "แสดงรายการวันนี้ และรายการส่งแล้วที่ยังไม่ได้ลงยอดขาย"}</p></div>}
    {visible.map(order => <OrderCard key={order.id} order={order} online={online} />)}
    <div className="grid grid-cols-2 gap-2 text-sm"><Link className="card" href="/financials/purchases">ซื้อของเข้าร้าน →</Link><Link className="card" href="/closing">ปิดยอดประจำวัน →</Link></div>
    <p className="text-xs text-text-secondary">คิวนี้ยังไม่ตัดสต็อก เมื่อส่งแล้ว ให้กดลงยอดขายเพื่อบันทึกเข้ารายงานและตัดสต็อกตามระบบเดิม อย่าบันทึกซ้ำในหน้าขาย</p>
  </div>;
}

function OrderForm({ recipes, online, onSaved }: { recipes: Recipe[]; online: boolean; onSaved: () => void }) {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [channel, setChannel] = useState<keyof typeof channels>("self");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [minutes, setMinutes] = useState(20);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const requestId = useRef<string | null>(null);
  const update = (index: number, patch: Partial<OrderItem>) => setItems(rows => rows.map((r, i) => i === index ? { ...r, ...patch } : r));
  return <form className="card space-y-4" onSubmit={e => {
    e.preventDefault(); if (!items.length || pending) return;
    requestId.current ??= crypto.randomUUID();
    startTransition(async () => {
      try {
        const result = await addOrder({ id: requestId.current!, channel, reference, items, notes, minutes });
        if (result.error) { setError(result.error); return; }
        requestId.current = null; setItems([]); setReference(""); setNotes(""); setError(""); onSaved();
      } catch { setError("ยังยืนยันไม่ได้ว่าบันทึกสำเร็จ กดบันทึกอีกครั้งได้โดยไม่สร้างออเดอร์ซ้ำ"); }
    });
  }}>
    <fieldset disabled={pending} className="space-y-4">
      <legend className="mb-3 text-lg font-semibold">ออเดอร์ใหม่</legend>
      <label className="block">ช่องทาง<select value={channel} onChange={e => setChannel(e.target.value as keyof typeof channels)} className="field-input mt-1">{Object.entries(channels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <div className="grid grid-cols-2 gap-3"><label>เลขออเดอร์ / ชื่อลูกค้า<input className="field-input mt-1" maxLength={80} value={reference} onChange={e => setReference(e.target.value)} placeholder="ไม่บังคับ" /></label><label>พร้อมใน (นาที)<input className="field-input mt-1" required type="number" min={1} max={240} value={minutes} onChange={e => setMinutes(Number(e.target.value))} /></label></div>
      {!recipes.length ? <p>ยังไม่มีเมนู <Link className="text-accent underline" href="/recipes">เพิ่มเมนูอาหารก่อน</Link></p> : <><label className="block">เลือกอาหาร<input className="field-input mt-1" placeholder="ค้นหาชื่อเมนู" value={search} onChange={e => setSearch(e.target.value)} /></label><div className="grid max-h-60 grid-cols-2 gap-2 overflow-y-auto">{recipes.filter(r => r.name.toLowerCase().includes(search.toLowerCase())).map(r => <button type="button" key={r.id} className="rounded-xl border border-border p-3 text-left" onClick={() => setItems(rows => [...rows, { recipe_id: r.id, name: r.name, qty: 1, price: r.target_sell_price ?? 0, note: "" }])}><span className="block">+ {r.name}</span><span className="text-sm text-text-secondary">{r.target_sell_price == null ? "ระบุราคา" : baht(r.target_sell_price)}</span></button>)}</div></>}
      <p className="text-xs text-text-secondary">ราคาเริ่มจากเมนูเดิม แก้ให้ตรงกับช่องทางนี้ได้ • เลือกเมนูซ้ำเพื่อแยกหมายเหตุ</p>
      {items.map((item, i) => <div key={i} className="space-y-2 rounded-xl border border-border p-3"><div className="flex items-center justify-between gap-2"><strong>{item.name}</strong><button type="button" className="px-3 py-2 text-alert" aria-label={`ลบ ${item.name} รายการ ${i + 1}`} onClick={() => setItems(rows => rows.filter((_, index) => index !== i))}>ลบ</button></div><div className="grid grid-cols-2 gap-2"><label>จำนวน<input required className="field-input" type="number" min={1} max={999} step={1} value={item.qty} onChange={e => update(i, { qty: Number(e.target.value) })} /></label><label>ราคาต่อชุด (บาท)<input required className="field-input" type="number" min={0} max={100000} step="0.01" value={item.price} onChange={e => update(i, { price: Number(e.target.value) })} /></label></div><label className="block">ตัวเลือก / หมายเหตุ<input className="field-input" maxLength={300} placeholder="เช่น ไม่เผ็ด ไม่ใส่ผัก" value={item.note} onChange={e => update(i, { note: e.target.value })} /></label></div>)}
      <label className="block">หมายเหตุทั้งออเดอร์<input className="field-input mt-1" value={notes} maxLength={500} onChange={e => setNotes(e.target.value)} placeholder="เช่น ไม่รับช้อน แยกน้ำซุป" /></label>
      <div className="flex justify-between text-lg font-semibold"><span>รวม {items.reduce((n, i) => n + i.qty, 0)} ชุด</span><span>{baht(total(items))}</span></div>
      <button disabled={!items.length || items.length > 50 || !online} className="btn-primary w-full">{pending ? "กำลังบันทึก…" : "ยืนยันออเดอร์"}</button>
    </fieldset>
    {error && <p role="alert" className="text-alert">{error}</p>}
  </form>;
}

function OrderCard({ order, online }: { order: DeliveryOrder; online: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [checked, setChecked] = useState<number[]>([]);
  const [fee, setFee] = useState("");
  const [cancel, setCancel] = useState(false);
  const next = { new: "cooking", cooking: "ready", ready: "delivered" } as const;
  const labels = { new: "เริ่มทำ", cooking: "เช็กครบแล้ว • พร้อมส่ง", ready: "ส่งให้ไรเดอร์แล้ว" };
  const act = (operation: () => Promise<{ error?: string }>) => startTransition(async () => {
    setError("");
    try { const result = await operation(); if (result.error) setError(result.error); router.refresh(); }
    catch { setError("เชื่อมต่อไม่สำเร็จ รีเฟรชเพื่อตรวจสถานะก่อนลองอีกครั้ง"); }
  });
  return <article className={`card space-y-3 ${order.status === "ready" ? "border-success" : ""}`}>
    <div className="flex items-start justify-between gap-2"><div><span className="text-xs text-accent">{channels[order.channel]}</span><h2 className="text-lg font-bold">{order.reference || `#${order.id.slice(0, 8)}`}</h2><p className="text-xs text-text-secondary">รับ {clock(order.created_at)} • พร้อม {clock(order.due_at)}</p></div><span className="rounded-lg bg-bg px-3 py-2 text-sm">{stages[order.status]}</span></div>
    <ul className="space-y-2">{order.items.map((item, i) => <li key={i}><label className="flex items-start gap-3">{order.status === "cooking" && <input type="checkbox" className="mt-1 h-5 w-5" checked={checked.includes(i)} onChange={e => setChecked(rows => e.target.checked ? [...rows, i] : rows.filter(n => n !== i))} />}<span><strong>{item.qty} × {item.name}</strong>{item.note && <span className="block text-sm text-accent">{item.note}</span>}</span></label></li>)}</ul>
    {order.notes && <p className="rounded-lg bg-bg p-3 text-accent">{order.notes}</p>}
    <p className="text-right font-semibold">{baht(total(order.items))}</p>
    {order.status === "cooking" && <label className="flex gap-3 text-sm"><input type="checkbox" className="h-5 w-5" checked={checked.includes(-1)} onChange={e => setChecked(rows => e.target.checked ? [...rows, -1] : rows.filter(n => n !== -1))} />เครื่องเคียง บรรจุภัณฑ์ และเลขออเดอร์ถูกต้อง</label>}
    {(order.status === "new" || order.status === "cooking" || order.status === "ready") && <button className="btn-primary w-full" disabled={pending || !online || (order.status === "cooking" && checked.length !== order.items.length + 1)} onClick={() => act(() => moveOrder(order.id, order.status, next[order.status as keyof typeof next]))}>{pending ? "กำลังบันทึก…" : labels[order.status]}</button>}
    {order.status === "new" && (cancel ? <div className="flex items-center gap-3 text-sm"><span>ยืนยันยกเลิกออเดอร์นี้?</span><button disabled={pending || !online} className="btn-danger" onClick={() => act(() => moveOrder(order.id, "new", "cancelled"))}>ยืนยัน</button><button onClick={() => setCancel(false)}>กลับ</button></div> : <button className="px-2 py-3 text-sm text-text-secondary underline" onClick={() => setCancel(true)}>ยกเลิกก่อนเริ่มทำ</button>)}
    {order.status === "delivered" && (order.booked_at ? <p className="text-sm text-success">ลงยอดขายและตัดสต็อกแล้ว • ตรวจรับเงินได้ในหน้าขาย</p> : <div className="space-y-2 border-t border-border pt-3"><p className="text-sm">ยังไม่ลงยอดขาย / ตัดสต็อก</p><label className="block text-sm">ค่าธรรมเนียมตามจริง (%)<input className="field-input mt-1" type="number" min={0} max={100} step="0.01" placeholder="ระบุเอง เช่น 0 สำหรับสั่งตรง" value={fee} onChange={e => setFee(e.target.value)} /></label><button disabled={pending || !online || fee === "" || !Number.isFinite(Number(fee)) || Number(fee) < 0 || Number(fee) > 100} className="btn-primary w-full" onClick={() => act(() => bookOrder(order.id, Number(fee)))}>ลงยอดขายและตัดสต็อก</button><p className="text-xs text-text-secondary">สถานะเงินเริ่มเป็นรอรับ ยังไม่รองรับส่วนลดและยอดปรับปรุงแพลตฟอร์มในขั้นนี้</p></div>)}
    {error && <p role="alert" className="text-sm text-alert">{error}</p>}
  </article>;
}
