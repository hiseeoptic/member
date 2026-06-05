import { createHmac } from "node:crypto";

// ---------------------------------------------------------------------------
// VNPay helper — HMAC-SHA512
// ---------------------------------------------------------------------------
// Required env vars:
//   VNPAY_TMN_CODE      — Terminal code
//   VNPAY_HASH_SECRET   — Secret hash key
//   VNPAY_URL           — Payment gateway URL
//   VNPAY_RETURN_URL    — Return URL after payment
// ---------------------------------------------------------------------------

function formatDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    String(date.getFullYear()) +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
}

function hmacSha512(secret: string, data: string): string {
  return createHmac("sha512", secret).update(data, "utf8").digest("hex");
}

export function createVnpayUrl(params: {
  amount: number; // VND amount
  orderId: string;
  orderInfo: string;
  ipAddr: string;
  locale?: "vn" | "en";
}): string {
  const tmnCode = process.env.VNPAY_TMN_CODE ?? "";
  const hashSecret = process.env.VNPAY_HASH_SECRET ?? "";
  const vnpUrl = process.env.VNPAY_URL ?? "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
  const returnUrl =
    process.env.VNPAY_RETURN_URL ?? "https://member.nguyenduchoa.com/api/payment/vnpay/return";

  const now = new Date();
  const expire = new Date(now.getTime() + 15 * 60 * 1000);

  const rawParams: Record<string, string> = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: tmnCode,
    vnp_Amount: String(params.amount * 100),
    vnp_CreateDate: formatDate(now),
    vnp_CurrCode: "VND",
    vnp_IpAddr: params.ipAddr,
    vnp_Locale: params.locale ?? "vn",
    vnp_OrderInfo: params.orderInfo,
    vnp_OrderType: "other",
    vnp_ReturnUrl: returnUrl,
    vnp_TxnRef: params.orderId,
    vnp_ExpireDate: formatDate(expire),
  };

  // Sort alphabetically
  const sortedKeys = Object.keys(rawParams).sort();
  const signData = sortedKeys.map((k) => `${k}=${encodeURIComponent(rawParams[k]).replace(/%20/g, "+")}`).join("&");
  const secureHash = hmacSha512(hashSecret, signData);

  const queryString =
    sortedKeys.map((k) => `${k}=${encodeURIComponent(rawParams[k]).replace(/%20/g, "+")}`).join("&") +
    `&vnp_SecureHash=${secureHash}`;

  return `${vnpUrl}?${queryString}`;
}

export function verifyVnpayReturn(query: Record<string, string>): boolean {
  const hashSecret = process.env.VNPAY_HASH_SECRET ?? "";
  const secureHash = query["vnp_SecureHash"];
  if (!secureHash) return false;

  const filtered: Record<string, string> = {};
  for (const [k, v] of Object.entries(query)) {
    if (k !== "vnp_SecureHash" && k !== "vnp_SecureHashType") {
      filtered[k] = v;
    }
  }

  const sortedKeys = Object.keys(filtered).sort();
  const signData = sortedKeys.map((k) => `${k}=${encodeURIComponent(filtered[k]).replace(/%20/g, "+")}`).join("&");
  const expectedHash = hmacSha512(hashSecret, signData);

  return expectedHash.toLowerCase() === secureHash.toLowerCase();
}
