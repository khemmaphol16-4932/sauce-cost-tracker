// Sales channels and their default fee %. Shared by the Sell cart and the
// custom sale form so the presets can't drift apart.
export const PLATFORM_OPTIONS = [
  { value: "self", label: "Self-sell", feePct: 0 },
  { value: "tiktok", label: "TikTok Shop", feePct: 5 },
  { value: "shopee", label: "Shopee", feePct: 5.42 },
  { value: "lazada", label: "Lazada", feePct: 6.3 },
  { value: "other", label: "Other", feePct: 0 },
] as const;

export const PAYMENT_METHODS = ["cash", "transfer", "cod"] as const;
