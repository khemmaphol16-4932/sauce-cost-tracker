"use client";

// Tappable reason picker for stock counts. Buttons rather than a <select>
// because this gets used one-handed mid-service — the whole vocabulary should
// be visible and hittable without opening a dropdown. Backed by a hidden input
// so it submits with the rest of the form.
export function ReasonPills({
  options,
  value,
  onChange,
  name = "reason",
}: {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  name?: string;
}) {
  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = option === value;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              aria-pressed={selected}
              className={`rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                selected
                  ? "bg-accent text-[#121212]"
                  : "border border-border text-text-secondary active:bg-surface-hover"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
