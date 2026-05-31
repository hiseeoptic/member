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
