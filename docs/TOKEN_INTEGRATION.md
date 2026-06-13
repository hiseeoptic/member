# Hướng dẫn tích hợp Token Economy cho Webapp

Mọi webapp trong hệ sinh thái (FlowVeo, ThansOhoc, AI Studio, Content AI Writer, Storyboard AI, VinaLink...) trừ credits của user qua API trung tâm tại `member.nguyenduchoa.com`.

## 1. Lấy Service API Key

Admin tạo key cho từng webapp (mỗi app một key riêng):

```bash
POST https://member.nguyenduchoa.com/api/admin/api-keys
Content-Type: application/json
# (đăng nhập với tài khoản ADMIN)

{ "name": "FlowVeo Production", "appId": "flowveo" }

# Response — key chỉ hiện MỘT LẦN, lưu ngay vào env của webapp:
{ "key": "ndk_flowveo_xxxxxxxxxxxxxxxx" }
```

Lưu key vào env của webapp: `TOKEN_SERVICE_KEY=ndk_flowveo_xxx`

## 2. Xác định user (SSO)

Tất cả subdomain `*.nguyenduchoa.com` dùng chung session cookie NextAuth.
Webapp đọc session để lấy `userId` của user đang đăng nhập.

## 3. Trừ credits sau mỗi lần gọi AI

Sau khi gọi AI model (Gemini/GPT/Claude) và biết số token thực tế đã dùng:

```typescript
const res = await fetch("https://member.nguyenduchoa.com/api/tokens/consume", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.TOKEN_SERVICE_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    userId: "user_cuid_from_session",
    modelId: "gemini-2.0-flash",   // xem danh sách ở mục 5
    inputTokens: 1200,
    outputTokens: 850,
    description: "Tạo video script", // tuỳ chọn
  }),
});

if (res.status === 402) {
  // Hết credits — chuyển user đến trang nạp
  // https://member.nguyenduchoa.com/tokens
}

const data = await res.json();
// { ok: true, creditsDeducted: 1, balanceAfter: 24999 }
```

**Khuyến nghị**: kiểm tra số dư TRƯỚC khi gọi AI để tránh gọi xong mới biết user hết credits (xem mục 4), hoặc chấp nhận âm nhẹ lần cuối.

## 4. Kiểm tra số dư (phía user, qua cookie SSO)

```typescript
// Gọi từ browser của user (cookie tự gửi kèm vì cùng domain .nguyenduchoa.com)
const res = await fetch("https://member.nguyenduchoa.com/api/tokens/balance", {
  credentials: "include",
});
const { balance } = await res.json(); // số credits hiện có
```

## 5. Bảng giá model (credits / 1.000 AI tokens)

| Model ID | Input | Output |
|---|---|---|
| `gemini-2.0-flash` | 0.19 | 0.75 |
| `gemini-1.5-pro` | 3.13 | 12.5 |
| `gpt-4o-mini` | 0.38 | 1.5 |
| `gpt-4o` | 6.25 | 25.0 |
| `claude-haiku-4-5` | 2.0 | 10.0 |
| `claude-sonnet-4-6` | 7.5 | 37.5 |
| `claude-opus-4-8` | 37.5 | 187.5 |

1 credit = $0.001 USD. Giá đã gồm markup ~2.5x so với giá API thực.
Danh sách luôn cập nhật tại: `GET /api/tokens/models` (public, không cần key).

## 6. Lỗi thường gặp

| Status | Ý nghĩa | Xử lý |
|---|---|---|
| 401 | Key sai / bị vô hiệu hoá | Kiểm tra env, liên hệ admin |
| 400 | Thiếu userId/modelId hoặc model không tồn tại | Kiểm tra payload |
| 402 | User hết credits | Hiện popup nạp credits, link `/tokens` |

## 7. Checklist khi thêm webapp mới

- [ ] Admin tạo Service API Key với `appId` riêng
- [ ] Thêm `TOKEN_SERVICE_KEY` vào env (Vercel)
- [ ] Đọc session SSO để lấy `userId`
- [ ] Gọi `/api/tokens/consume` sau mỗi AI call
- [ ] Xử lý lỗi 402 → redirect đến trang nạp credits
