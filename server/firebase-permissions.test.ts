import { describe, expect, it } from "vitest";
import { shouldRequestNativeFcmPermission } from "../client/src/lib/firebase-permissions";

describe("إذن إشعارات FCM الأصلي", () => {
  it("يطلب الإذن عندما يسمح Android بعرض نافذة الطلب أو التبرير", () => {
    expect(shouldRequestNativeFcmPermission("prompt")).toBe(true);
    expect(shouldRequestNativeFcmPermission("prompt-with-rationale")).toBe(true);
  });

  it("لا يعيد طلب الإذن عندما يكون ممنوحاً أو مرفوضاً نهائياً", () => {
    expect(shouldRequestNativeFcmPermission("granted")).toBe(false);
    expect(shouldRequestNativeFcmPermission("denied")).toBe(false);
  });
});
