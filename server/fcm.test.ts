import { describe, expect, it } from "vitest";
import { buildOrderStatusMessage, validateOrderPushEvent } from "./fcm";

describe("FCM order notifications", () => {
  it("builds a high-priority Android message that opens the correct order", () => {
    const message = buildOrderStatusMessage({ orderId: "order-42", status: "out_for_delivery" }, "a".repeat(32));
    expect(message.message.data).toEqual({ order_id: "order-42", order_status: "out_for_delivery", destination: "order_details" });
    expect(message.message.android.notification).toMatchObject({ channel_id: "order_updates", sound: "default", visibility: "PUBLIC" });
    expect(message.message.notification.title).toContain("الطريق");
  });

  it("accepts only valid recipients and never passes malformed device tokens to FCM", () => {
    const event = validateOrderPushEvent({
      event_id: "evt-1",
      order_id: "order-42",
      status: "ready",
      previous_status: "preparing",
      recipients: [
        { profile_id: "customer-1", role: "customer", token: "x".repeat(30) },
        { profile_id: "bad-1", role: "admin", token: "y".repeat(30) },
        { profile_id: "bad-2", role: "courier", token: "short" },
      ],
    });
    expect(event).toMatchObject({ orderId: "order-42", recipients: [{ profileId: "customer-1", role: "customer" }] });
    expect(event?.recipients).toHaveLength(1);
  });
});
