import type { Express, Request } from "express";
import { timingSafeEqual } from "node:crypto";
import { sendOrderStatusPush, validateOrderPushEvent } from "./fcm";

function hasValidWebhookSecret(request: Request) {
  const expected = String(process.env.ORDER_PUSH_WEBHOOK_SECRET || "").trim();
  const supplied = String(request.header("x-souq-webhook-secret") || "").trim();
  if (!expected || !supplied) return false;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export function registerOrderPushWebhook(app: Express) {
  app.post("/api/hooks/orders/push", async (request, response) => {
    if (!hasValidWebhookSecret(request)) {
      response.status(401).json({ error: "Invalid webhook signature" });
      return;
    }
    const event = validateOrderPushEvent(request.body);
    if (!event) {
      response.status(400).json({ error: "Invalid order push payload" });
      return;
    }
    if (event.recipients.length === 0) {
      response.status(202).json({ eventId: event.eventId, attempted: 0, delivered: 0, failed: 0 });
      return;
    }
    try {
      const result = await sendOrderStatusPush(event);
      response.status(202).json({ eventId: event.eventId, ...result });
    } catch {
      // لا نسجل رموز الأجهزة أو حمولة الطلب؛ تعيد pg_net حفظ الاستجابة للمراجعة.
      response.status(502).json({ error: "Unable to deliver FCM notification" });
    }
  });
}
