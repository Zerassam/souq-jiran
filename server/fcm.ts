import { importPKCS8, SignJWT } from "jose";

type FirebaseServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri?: string;
};

export type OrderPushRecipient = {
  profileId: string;
  role: "customer" | "merchant" | "courier";
  token: string;
};

export type OrderPushEvent = {
  eventId: string;
  orderId: string;
  status: string;
  previousStatus: string | null;
  recipients: OrderPushRecipient[];
};

type FcmAccessToken = { token: string; expiresAt: number };
let cachedAccessToken: FcmAccessToken | null = null;

const STATUS_COPY: Record<string, { title: string; body: string }> = {
  pending: { title: "طلب جديد بانتظارك", body: "وصل طلب جديد إلى متجرك. راجعه وابدأ تحضيره." },
  accepted: { title: "تم قبول طلبك", body: "أكد المتجر طلبك وسيبدأ التحضير قريباً." },
  preparing: { title: "طلبك قيد التحضير", body: "يعمل المتجر على تجهيز طلبك الآن." },
  ready: { title: "طلبك جاهز", body: "أصبح الطلب جاهزاً للتسليم أو الاستلام." },
  assigned: { title: "تم تعيين موصل", body: "تم تعيين موصل لطلبك. تابع حالة التوصيل." },
  picked_up: { title: "استلم الموصل الطلب", body: "تم استلام الطلب من المتجر ويجري التحضير للانطلاق." },
  out_for_delivery: { title: "طلبك في الطريق", body: "الموصل في طريقه إليك الآن." },
  delivered: { title: "تم تسجيل التسليم", body: "يرجى تأكيد الاستلام والدفع عند اكتمال العملية." },
  customer_confirmed: { title: "تم تأكيد الاستلام", body: "تم تأكيد استلام الطلب والدفع بنجاح." },
  remittance_confirmed: { title: "تم تسجيل تحويل المستحقات", body: "أكّد الموصل تحويل مستحقات الطلب إلى المتجر." },
  settled: { title: "اكتملت دورة الطلب", body: "تم تأكيد التسوية النهائية للطلب." },
  declined: { title: "تعذر قبول الطلب", body: "اعتذر المتجر عن قبول الطلب. راجع التفاصيل." },
  cancelled: { title: "تم إلغاء الطلب", body: "تغيرت حالة طلبك إلى ملغى. راجع التفاصيل." },
};

function parseServiceAccount(): FirebaseServiceAccount {
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
  if (!raw) throw new Error("Firebase FCM service account is not configured");
  const account = JSON.parse(raw) as Partial<FirebaseServiceAccount>;
  if (!account.client_email || !account.private_key || !account.project_id) {
    throw new Error("Firebase FCM service account is incomplete");
  }
  return account as FirebaseServiceAccount;
}

async function getMessagingAccessToken(account: FirebaseServiceAccount): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }

  const tokenUri = account.token_uri || "https://oauth2.googleapis.com/token";
  const now = Math.floor(Date.now() / 1000);
  const signingKey = await importPKCS8(account.private_key, "RS256");
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(account.client_email)
    .setSubject(account.client_email)
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
  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!response.ok || !payload.access_token) throw new Error("Unable to authorize Firebase Cloud Messaging request");
  cachedAccessToken = {
    token: payload.access_token,
    expiresAt: Date.now() + Math.max(60, Number(payload.expires_in || 300)) * 1000,
  };
  return cachedAccessToken.token;
}

export function buildOrderStatusMessage(event: Pick<OrderPushEvent, "orderId" | "status">, token: string) {
  const copy = STATUS_COPY[event.status] || {
    title: "تم تحديث حالة الطلب",
    body: "هناك تحديث جديد على طلبك في سوق الجيران.",
  };
  return {
    message: {
      token,
      notification: copy,
      data: {
        order_id: event.orderId,
        order_status: event.status,
        destination: "order_details",
      },
      android: {
        priority: "HIGH",
        notification: {
          channel_id: "order_updates",
          sound: "default",
          notification_priority: "PRIORITY_HIGH",
          default_vibrate_timings: true,
          visibility: "PUBLIC",
        },
      },
    },
  };
}

export async function sendOrderStatusPush(event: OrderPushEvent) {
  const account = parseServiceAccount();
  const accessToken = await getMessagingAccessToken(account);
  const uniqueRecipients = Array.from(
    new Map(event.recipients.map(recipient => [recipient.token, recipient])).values(),
  );
  const results = await Promise.allSettled(uniqueRecipients.map(async recipient => {
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildOrderStatusMessage(event, recipient.token)),
      },
    );
    if (!response.ok) throw new Error(`FCM rejected a recipient with HTTP ${response.status}`);
  }));
  const delivered = results.filter(result => result.status === "fulfilled").length;
  const failed = results.length - delivered;
  return { attempted: results.length, delivered, failed };
}

export function validateOrderPushEvent(value: unknown): OrderPushEvent | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const eventId = typeof candidate.event_id === "string" ? candidate.event_id.trim() : "";
  const orderId = typeof candidate.order_id === "string" ? candidate.order_id.trim() : "";
  const status = typeof candidate.status === "string" ? candidate.status.trim() : "";
  const previousStatus = typeof candidate.previous_status === "string" ? candidate.previous_status.trim() : null;
  if (!eventId || !orderId || !status || !Array.isArray(candidate.recipients)) return null;
  const recipients = candidate.recipients.flatMap((item): OrderPushRecipient[] => {
    if (!item || typeof item !== "object") return [];
    const recipient = item as Record<string, unknown>;
    const profileId = typeof recipient.profile_id === "string" ? recipient.profile_id.trim() : "";
    const role = recipient.role;
    const token = typeof recipient.token === "string" ? recipient.token.trim() : "";
    if (!profileId || !token || token.length < 20 || !["customer", "merchant", "courier"].includes(String(role))) return [];
    return [{ profileId, role: role as OrderPushRecipient["role"], token }];
  });
  return { eventId, orderId, status, previousStatus, recipients };
}
