import type { PermissionState } from "@capacitor/core";

/**
 * يطلب Android الإذن فقط عندما يستطيع النظام إظهاره للمستخدم. حالة
 * `prompt-with-rationale` تعني أن التطبيق ينبغي أن يعيد طلب الإذن بعد
 * توضيح سببه، وليست رفضاً نهائياً.
 */
export function shouldRequestNativeFcmPermission(receive: PermissionState): boolean {
  return receive === "prompt" || receive === "prompt-with-rationale";
}
