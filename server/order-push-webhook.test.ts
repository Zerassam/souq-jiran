import express from "express";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { registerOrderPushWebhook } from "./order-push-webhook";

const servers: Array<ReturnType<ReturnType<typeof express>["listen"]>> = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))));
});

async function startWebhook() {
  const app = express();
  app.use(express.json());
  registerOrderPushWebhook(app);
  const server = app.listen(0);
  servers.push(server);
  await new Promise<void>(resolve => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}/api/hooks/orders/push`;
}

describe("order push webhook secret", () => {
  it("accepts an event only with the configured shared secret and avoids FCM for an empty recipient list", async () => {
    const secret = process.env.ORDER_PUSH_WEBHOOK_SECRET;
    expect(secret).toBeTruthy();
    const endpoint = await startWebhook();
    const payload = { event_id: "test-event", order_id: "test-order", status: "ready", recipients: [] };

    const rejected = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    expect(rejected.status).toBe(401);

    const accepted = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-souq-webhook-secret": secret! },
      body: JSON.stringify(payload),
    });
    expect(accepted.status).toBe(202);
    await expect(accepted.json()).resolves.toMatchObject({ eventId: "test-event", attempted: 0, delivered: 0, failed: 0 });
  });
});
