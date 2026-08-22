import express from "express";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { registerAdminContactRoute } from "./admin-contact";

const servers: Array<ReturnType<ReturnType<typeof express>["listen"]>> = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))));
});

async function startContactEndpoint() {
  const app = express();
  app.use(express.json());
  registerAdminContactRoute(app);
  const server = app.listen(0);
  servers.push(server);
  await new Promise<void>(resolve => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}/api/account-contact-link`;
}

describe("admin contact endpoint", () => {
  it("uses the configured administrative phone only through the server-side WhatsApp deep-link endpoint", async () => {
    expect(process.env.ADMIN_PHONE_NUMBER).toMatch(/^\+213[567]\d{8}$/);
    const endpoint = await startContactEndpoint();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "merchant_membership_request", reference: "req_12345" }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({ url: expect.stringMatching(/^https:\/\/wa\.me\/213[567]\d{8}\?text=/) });
    expect(decodeURIComponent(payload.url)).toContain("طلب انضمام تاجر جديد");
    expect(decodeURIComponent(payload.url)).toContain("req_12345");
  });
});
