import type { Express, Request, Response } from "express";

const ALGERIAN_ADMIN_PHONE = /^\+213[567]\d{8}$/;
const SAFE_REFERENCE = /^[A-Za-z0-9_-]{3,96}$/;

export type AdminContactAction = "merchant_membership_request" | "courier_membership_request" | "account_recovery";

function messageFor(action: AdminContactAction, reference: string) {
  if (action === "account_recovery") {
    return `طلب استعادة حساب سوق الجيران. المرجع: ${reference}`;
  }
  if (action === "merchant_membership_request") {
    return `طلب انضمام تاجر جديد إلى سوق الجيران (قيد المراجعة). المرجع: ${reference}`;
  }
  return `طلب انضمام موصل جديد إلى سوق الجيران (قيد المراجعة). المرجع: ${reference}`;
}

export function createAdminContactLink(action: AdminContactAction, reference: string) {
  const adminPhone = String(process.env.ADMIN_PHONE_NUMBER || "").trim();
  if (!ALGERIAN_ADMIN_PHONE.test(adminPhone)) {
    throw new Error("ADMIN_PHONE_NUMBER is not configured as an Algerian mobile number");
  }
  if (!SAFE_REFERENCE.test(reference)) {
    throw new Error("Invalid account reference");
  }

  return `https://wa.me/${adminPhone.slice(1)}?text=${encodeURIComponent(messageFor(action, reference))}`;
}

export function registerAdminContactRoute(app: Express) {
  app.post("/api/account-contact-link", (req: Request, res: Response) => {
    const action = req.body?.action;
    const reference = req.body?.reference;
    if ((action !== "merchant_membership_request" && action !== "courier_membership_request" && action !== "account_recovery") || typeof reference !== "string") {
      return res.status(400).json({ error: "INVALID_CONTACT_REQUEST" });
    }

    try {
      return res.status(200).json({ url: createAdminContactLink(action, reference) });
    } catch {
      return res.status(503).json({ error: "ADMIN_CONTACT_UNAVAILABLE" });
    }
  });
}
