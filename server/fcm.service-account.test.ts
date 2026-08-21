import { importPKCS8, SignJWT } from "jose";
import { describe, expect, it } from "vitest";

type FirebaseServiceAccount = {
  client_email?: string;
  private_key?: string;
  project_id?: string;
  token_uri?: string;
};

async function mintFirebaseMessagingAccessToken(rawServiceAccount: string) {
  const serviceAccount = JSON.parse(rawServiceAccount) as FirebaseServiceAccount;
  const tokenUri = serviceAccount.token_uri || "https://oauth2.googleapis.com/token";

  if (!serviceAccount.client_email || !serviceAccount.private_key || !serviceAccount.project_id) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is missing required service-account fields");
  }

  const now = Math.floor(Date.now() / 1000);
  const signingKey = await importPKCS8(serviceAccount.private_key, "RS256");
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(serviceAccount.client_email)
    .setSubject(serviceAccount.client_email)
    .setAudience(tokenUri)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(signingKey);

  const response = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const payload = (await response.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(`Firebase service-account validation failed: ${payload.error || response.status}`);
  }

  return payload;
}

describe("Firebase FCM service account", () => {
  it("mints a short-lived Messaging API access token without exposing credentials", async () => {
    const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    expect(rawServiceAccount).toBeTruthy();

    const payload = await mintFirebaseMessagingAccessToken(rawServiceAccount!);
    expect(payload.access_token).toEqual(expect.any(String));
    expect(payload.access_token!.length).toBeGreaterThan(20);
    expect(payload.expires_in).toBeGreaterThan(0);
  }, 20_000);
});
