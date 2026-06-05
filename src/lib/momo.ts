import { createHmac } from "node:crypto";

// ---------------------------------------------------------------------------
// MoMo helper — HMAC-SHA256
// ---------------------------------------------------------------------------
// Required env vars:
//   MOMO_PARTNER_CODE   — Partner code
//   MOMO_ACCESS_KEY     — Access key
//   MOMO_SECRET_KEY     — Secret key
//   MOMO_ENDPOINT       — API endpoint
//   MOMO_REDIRECT_URL   — Redirect URL after payment
//   MOMO_IPN_URL        — IPN (webhook) URL
// ---------------------------------------------------------------------------

function hmacSha256(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data, "utf8").digest("hex");
}

export async function createMomoPayment(params: {
  amount: number; // VND
  orderId: string;
  orderInfo: string;
  requestId: string;
}): Promise<{ payUrl: string; resultCode: number; message: string }> {
  const partnerCode = process.env.MOMO_PARTNER_CODE ?? "";
  const accessKey = process.env.MOMO_ACCESS_KEY ?? "";
  const secretKey = process.env.MOMO_SECRET_KEY ?? "";
  const endpoint =
    process.env.MOMO_ENDPOINT ?? "https://test-payment.momo.vn/v2/gateway/api/create";
  const redirectUrl =
    process.env.MOMO_REDIRECT_URL ?? "https://member.nguyenduchoa.com/api/payment/momo/return";
  const ipnUrl =
    process.env.MOMO_IPN_URL ?? "https://member.nguyenduchoa.com/api/payment/momo/ipn";

  const requestType = "payWithMethod";
  const extraData = "";

  const rawSignature = [
    `accessKey=${accessKey}`,
    `amount=${params.amount}`,
    `extraData=${extraData}`,
    `ipnUrl=${ipnUrl}`,
    `orderId=${params.orderId}`,
    `orderInfo=${params.orderInfo}`,
    `partnerCode=${partnerCode}`,
    `redirectUrl=${redirectUrl}`,
    `requestId=${params.requestId}`,
    `requestType=${requestType}`,
  ].join("&");

  const signature = hmacSha256(secretKey, rawSignature);

  const body = {
    partnerCode,
    accessKey,
    requestId: params.requestId,
    amount: params.amount,
    orderId: params.orderId,
    orderInfo: params.orderInfo,
    redirectUrl,
    ipnUrl,
    requestType,
    extraData,
    lang: "vi",
    signature,
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`MoMo API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { payUrl?: string; resultCode: number; message: string };

  return {
    payUrl: data.payUrl ?? "",
    resultCode: data.resultCode,
    message: data.message,
  };
}

export function verifyMomoSignature(
  data: Record<string, unknown>,
  signature: string
): boolean {
  const accessKey = process.env.MOMO_ACCESS_KEY ?? "";
  const secretKey = process.env.MOMO_SECRET_KEY ?? "";

  const rawSignature = [
    `accessKey=${accessKey}`,
    `amount=${data.amount}`,
    `extraData=${data.extraData ?? ""}`,
    `message=${data.message}`,
    `orderId=${data.orderId}`,
    `orderInfo=${data.orderInfo}`,
    `orderType=${data.orderType}`,
    `partnerCode=${data.partnerCode}`,
    `payType=${data.payType}`,
    `requestId=${data.requestId}`,
    `responseTime=${data.responseTime}`,
    `resultCode=${data.resultCode}`,
    `transId=${data.transId}`,
  ].join("&");

  const expected = hmacSha256(secretKey, rawSignature);
  return expected === signature;
}
