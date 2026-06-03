// Lightweight transactional email via Resend REST API.
// No-ops safely when no API key is configured, so it never breaks a flow.

const RESEND_KEY = process.env.RESEND_API_KEY || process.env.AUTH_RESEND_KEY;
const FROM = process.env.AUTH_EMAIL_FROM || "Auto Flow Pro <noreply@nguyenduchoa.com>";
const APP_URL = process.env.NEXTAUTH_URL || "https://member.nguyenduchoa.com";

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_KEY || !to) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
    if (!res.ok) {
      console.error("sendEmail failed:", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.error("sendEmail error:", err);
  }
}

function wrap(title: string, body: string, cta?: { label: string; href: string }): string {
  return `
  <div style="font-family:system-ui,Arial,sans-serif;max-width:480px;margin:0 auto;background:#0a0a0a;color:#e4e4e7;padding:32px;border-radius:16px">
    <div style="font-weight:800;font-size:18px;color:#fff;margin-bottom:4px">Auto Flow Pro</div>
    <div style="font-size:11px;letter-spacing:3px;color:#818cf8;text-transform:uppercase;margin-bottom:20px">Membership</div>
    <h2 style="color:#fff;font-size:18px;margin:0 0 12px">${title}</h2>
    <div style="color:#a1a1aa;font-size:14px;line-height:1.6">${body}</div>
    ${
      cta
        ? `<a href="${cta.href}" style="display:inline-block;margin-top:20px;background:#4f46e5;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:12px;font-size:14px">${cta.label}</a>`
        : ""
    }
    <div style="margin-top:28px;color:#52525b;font-size:11px">Auto Flow Pro · ${APP_URL}</div>
  </div>`;
}

// --- Specific notifications ---

export function notifyNewReferral(to: string, refEmailMasked: string) {
  return sendEmail(
    to,
    "🎉 Bạn vừa có người đăng ký qua link của bạn!",
    wrap(
      "Có người mới dùng link giới thiệu của bạn",
      `Người dùng <b>${refEmailMasked}</b> vừa đăng ký bằng link affiliate của bạn. Khi họ nâng cấp Pro, bạn sẽ nhận <b>20% hoa hồng</b>.`,
      { label: "Xem affiliate", href: `${APP_URL}/affiliate` }
    )
  );
}

export function notifyNewCommission(to: string, amount: number) {
  return sendEmail(
    to,
    `💰 Bạn vừa nhận hoa hồng $${amount.toFixed(2)}`,
    wrap(
      "Hoa hồng mới!",
      `Một người bạn giới thiệu vừa thanh toán. Bạn nhận được <b>$${amount.toFixed(
        2
      )}</b> hoa hồng. Số dư sẽ sẵn sàng để rút khi đạt mức tối thiểu.`,
      { label: "Xem số dư", href: `${APP_URL}/affiliate` }
    )
  );
}

export function notifyPayout(to: string, amount: number, status: string, txHash?: string | null) {
  const done = status === "COMPLETED";
  return sendEmail(
    to,
    done ? `✅ Đã chuyển $${amount.toFixed(2)} USDT cho bạn` : `⏳ Yêu cầu rút $${amount.toFixed(2)} đang xử lý`,
    wrap(
      done ? "Rút tiền thành công" : "Yêu cầu rút tiền đang được xử lý",
      done
        ? `Khoản rút <b>$${amount.toFixed(2)}</b> đã được chuyển tới ví USDT của bạn.${
            txHash ? ` Mã giao dịch: <code>${txHash}</code>` : ""
          }`
        : `Yêu cầu rút <b>$${amount.toFixed(2)}</b> của bạn đang được admin xử lý. Bạn sẽ nhận thông báo khi hoàn tất.`,
      { label: "Xem chi tiết", href: `${APP_URL}/affiliate` }
    )
  );
}
