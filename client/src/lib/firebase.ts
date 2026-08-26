import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { FirebaseMessaging, Importance } from "@capacitor-firebase/messaging";
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getMessaging, isSupported, type Messaging } from "firebase/messaging";
import { shouldRequestNativeFcmPermission } from "./firebase-permissions";

const firebaseConfig = {
  apiKey: String(import.meta.env.VITE_FIREBASE_API_KEY || "").trim(),
  authDomain: String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "").trim(),
  projectId: String(import.meta.env.VITE_FIREBASE_PROJECT_ID || "").trim(),
  storageBucket: String(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "").trim(),
  messagingSenderId: String(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "").trim(),
  appId: String(import.meta.env.VITE_FIREBASE_APP_ID || "").trim(),
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId,
);

export const firebaseApp: FirebaseApp | null = isFirebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const isNativeFirebaseRuntime = () => Capacitor.isNativePlatform();

export type GoogleProfilePrefill = {
  name: string;
  email: string;
};

/**
 * يجلب الاسم والبريد من Google لملء نموذج الانضمام فقط. لا ينشئ حساب
 * سوق الجيران ولا يتجاوز رقم الهاتف أو بقية الحقول الإلزامية.
 */
export async function requestGoogleProfilePrefill(): Promise<GoogleProfilePrefill> {
  if (!isFirebaseConfigured) {
    throw new Error("خدمة Google غير مهيأة لهذا التطبيق بعد.");
  }

  try {
    // The native plugin reads the Android OAuth client from google-services.json.
    // Do not pass an undocumented webClientId option: it is not part of the
    // current plugin contract and would make the native call fail silently.
    const { user } = await FirebaseAuthentication.signInWithGoogle();
    const email = String(user?.email || "").trim().toLowerCase();
    if (!email) {
      throw new Error("لم تُرجع Google بريداً إلكترونياً صالحاً. اختر حساباً آخر.");
    }

    return {
      name: String(user?.displayName || "").trim(),
      email,
    };
  } catch (error) {
    const details = error && typeof error === "object" ? error as { code?: unknown; message?: unknown } : {};
    const code = String(details.code || details.message || "").toLowerCase();
    if (code.includes("developer_error") || code.includes("10") || code.includes("12500")) {
      throw new Error("تعذر تسجيل Google على هذا الإصدار. تحقّق من SHA-1 في Firebase ومن تنزيل google-services.json بعد إضافة البصمة.");
    }
    throw error;
  }
}

export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (!firebaseApp || isNativeFirebaseRuntime() || !(await isSupported())) return null;
  return getMessaging(firebaseApp);
}

export async function requestNativeFcmToken(): Promise<string | null> {
  if (!isNativeFirebaseRuntime()) return null;

  const current = await FirebaseMessaging.checkPermissions();
  const permission = shouldRequestNativeFcmPermission(current.receive)
    ? await FirebaseMessaging.requestPermissions()
    : current;
  if (permission.receive !== "granted") return null;

  const result = await FirebaseMessaging.getToken();
  const token = String(result.token || "").trim();
  return token || null;
}

export async function listenForNativeFcmToken(onToken: (token: string) => void) {
  if (!isNativeFirebaseRuntime()) return null;
  return FirebaseMessaging.addListener("tokenReceived", ({ token }) => onToken(token));
}

type NativeOrderNotification = {
  title?: string;
  body?: string;
  data?: unknown;
};

export async function listenForNativeOrderNotifications(
  onForeground: (notification: NativeOrderNotification) => void,
  onAction: (notification: NativeOrderNotification) => void,
) {
  if (!isNativeFirebaseRuntime()) return null;
  // Android requires an explicit high-importance channel for lock-screen
  // alerts, sound, and heads-up presentation. iOS safely ignores this call.
  try {
    await FirebaseMessaging.createChannel({
      id: "order_updates",
      name: "تحديثات الطلبات",
      description: "تنبيهات تغيّر حالة طلبات سوق الجيران",
      importance: Importance.High,
      sound: "default",
      visibility: 1,
      vibration: true,
    });
  } catch {
    // The delivery path still works when a platform does not expose channels.
  }
  const foreground = await FirebaseMessaging.addListener("notificationReceived", ({ notification }) => onForeground(notification));
  const action = await FirebaseMessaging.addListener("notificationActionPerformed", ({ notification }) => onAction(notification));
  return {
    remove: async () => {
      await foreground.remove();
      await action.remove();
    },
  };
}
