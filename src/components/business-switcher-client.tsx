"use client";

import { useRef, useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import { createBusiness, switchBusiness } from "@/app/businesses/actions";
import type { Business } from "@/lib/data/businesses";

export function BusinessSwitcherClient({
  businesses,
  currentId,
}: {
  businesses: Business[];
  currentId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const onSwitch = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === "__new__") {
      setOpen(true);
      return;
    }
    const formData = new FormData();
    formData.set("business_id", e.target.value);
    startTransition(async () => {
      await switchBusiness(formData);
    });
  };

  const submitNew = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await createBusiness(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        formRef.current?.reset();
        setOpen(false);
      }
    });
  };

  return (
    <>
      <select
        value={currentId}
        onChange={onSwitch}
        disabled={isPending}
        className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs font-medium text-text disabled:opacity-50"
      >
        {businesses.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
        <option value="__new__">+ New business…</option>
      </select>

      <Modal open={open} onClose={() => setOpen(false)} title="New business">
        <form ref={formRef} onSubmit={submitNew} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary">Name</label>
            <input
              name="name"
              required
              autoFocus
              placeholder="e.g. เส้นเย็นญี่ปุ่น by ครัวบ้านจิ้ม"
              className="mt-1 field-input"
            />
          </div>
          {error && <p className="text-sm text-alert">{error}</p>}
          <button type="submit" disabled={isPending} className="w-full btn-primary">
            {isPending ? "Creating…" : "Create & switch"}
          </button>
        </form>
      </Modal>
    </>
  );
}
