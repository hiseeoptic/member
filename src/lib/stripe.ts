import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_placeholder", {
  apiVersion: "2026-05-27.dahlia",
});

export const PLANS = {
  MONTHLY: {
    name: "Pro Monthly",
    price: 1999, // $19.99 in cents
    interval: "month" as const,
    trialDays: 15,
  },
  YEARLY: {
    name: "Pro Yearly",
    price: 14999, // $149.99 in cents
    interval: "year" as const,
    trialDays: 15,
  },
};

// One-time products from nguyenduchoa.com/shop
export const ONE_TIME_PRODUCTS: Record<string, { name: string; price: number; description: string }> = {
  "ai-marketing-course": {
    name: "Khóa học AI Marketing",
    price: 9700, // $97 in cents
    description: "Toàn bộ chiến lược AI Marketing từ A-Z — video, tài liệu, template",
  },
  "flowveo": {
    name: "FlowVeo — Tạo Video AI",
    price: 900,
    description: "Subscription hàng tháng — FlowVeo AI Video Generator",
  },
  "thansohoc": {
    name: "ThansOhoc — AI Content",
    price: 900,
    description: "Subscription hàng tháng — ThansOhoc AI Writing",
  },
  "ai-studio": {
    name: "AI Studio — Tạo Hình Ảnh AI",
    price: 900,
    description: "Subscription hàng tháng — AI Studio Image Generator",
  },
  "bundle-all": {
    name: "Bundle ALL Tools",
    price: 1500,
    description: "Toàn bộ 6 công cụ AI — FlowVeo, ThansOhoc, AI Studio, VinaLink, Content AI Writer, Storyboard AI",
  },
};
