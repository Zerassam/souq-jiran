import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { FirebaseMessaging } from "@capacitor-firebase/messaging";
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { getMessaging, isSupported, type Messaging } from "firebase/messaging";

type PhoneVerificationSession =
  | {
      platform: "native";
      verificationId?: string;
      completedUser?: { firebaseUid: string; phoneNumber: string | null };
    }
  | {
      platform: "web";
      confirmationResult: ConfirmationResult;
      recaptchaVerifier: RecaptchaVerifier;
    };

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

export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
export const isNativeFirebaseRuntime = () => Capacitor.isNativePlatform();

function firebaseSetupError() {
  return new Error("إعداد Firebase غير مكتمل. راجع متغيرات VITE_FIREBASE_* قبل تفعيل التحقق بالهاتف.");
}

function readablePhoneVerificationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  const normalized = message.toLowerCase();
  if (normalized.includes("too-many-requests")) return "تم تجاوز عدد محاولات SMS المسموح بها مؤقتاً. انتظر قليلاً ثم حاول مجدداً.";
  if (normalized.includes("invalid-phone-number")) return "رقم الهاتف غير صالح. استخدم رقماً جزائرياً بصيغة +213 ثم تسعة أرقام.";
  if (normalized.includes("invalid app credential") || normalized.includes("app verification")) return "تعذر التحقق من هوية التطبيق. تأكد من إضافة بصمة SHA للتطبيق ومن اتصال Google Play services ثم أعد المحاولة.";
  if (normalized.includes("network")) return "تعذر الاتصال بخدمة Firebase. تحقق من الإنترنت وحاول مجدداً.";
  return message || "تعذر إرسال رمز SMS. تحقق من إعداد Phone Authentication وحاول مجدداً.";
}

function normalizeFirebasePhoneNumber(value: string) {
  const compact = String(value || "").trim().replace(/[\s().-]/g, "");
  const national = compact.replace(/^0+/, "");
  const normalized = compact.startsWith("+213")
    ? `+213${compact.slice(4)}`
    : compact.startsWith("00213")
      ? `+213${compact.slice(5)}`
      : /^[5-7]\d{8}$/.test(national)
        ? `+213${national}`
        : compact;
  if (!/^\+213[5-7]\d{8}$/.test(normalized)) {
    throw new Error("رقم الهاتف غير صالح. استخدم رقماً جزائرياً يبدأ بـ 05 أو 06 أو 07.");
  }
  return normalized;
}

export async function getFirebaseIdToken(forceRefresh = false): Promise<string | null> {
  try {
    if (isNativeFirebaseRuntime()) {
      const result = await FirebaseAuthentication.getIdToken({ forceRefresh });
      return result.token || null;
    }
    return (await firebaseAuth?.currentUser?.getIdToken(forceRefresh)) || null;
  } catch {
    return null;
  }
}

export async function beginFirebasePhoneVerification(
  phoneNumber: string,
  recaptchaContainerId: string,
): Promise<PhoneVerificationSession> {
  const normalizedPhoneNumber = normalizeFirebasePhoneNumber(phoneNumber);
  if (isNativeFirebaseRuntime()) {
    let codeSentListener: { remove: () => Promise<void> } | undefined;
    let failureListener: { remove: () => Promise<void> } | undefined;
    let completionListener: { remove: () => Promise<void> } | undefined;
    try {
      const verification = await new Promise<{ verificationId?: string; completedUser?: { firebaseUid: string; phoneNumber: string | null } }>(async (resolve, reject) => {
        let settled = false;
        const settle = (callback: (value: any) => void, value: any) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeout);
          callback(value);
        };
        const timeout = window.setTimeout(
          () => settle(reject, new Error("لم يصل رد من Firebase خلال دقيقة. تحقق من الإنترنت وبصمات SHA ثم حاول مجدداً.")),
          65_000,
        );

        try {
          [codeSentListener, failureListener, completionListener] = await Promise.all([
            FirebaseAuthentication.addListener("phoneCodeSent", (event) => settle(resolve, { verificationId: event.verificationId })),
            FirebaseAuthentication.addListener("phoneVerificationFailed", (event) => settle(reject, new Error(readablePhoneVerificationError(event.message)))),
            FirebaseAuthentication.addListener("phoneVerificationCompleted", (event) => {
              if (!event.user?.uid) {
                settle(reject, new Error("أكملت Firebase التحقق دون إرجاع هوية مستخدم صالحة."));
                return;
              }
              settle(resolve, { completedUser: { firebaseUid: event.user.uid, phoneNumber: event.user.phoneNumber } });
            }),
          ]);
          await FirebaseAuthentication.signInWithPhoneNumber({ phoneNumber: normalizedPhoneNumber, timeout: 60 });
        } catch (error) {
          settle(reject, new Error(readablePhoneVerificationError(error)));
        }
      });
      return { platform: "native", ...verification };
    } finally {
      await Promise.all([codeSentListener?.remove(), failureListener?.remove(), completionListener?.remove()]);
    }
  }

  if (!isFirebaseConfigured || !firebaseAuth) throw firebaseSetupError();

  const container = document.getElementById(recaptchaContainerId);
  if (!container) throw new Error("تعذر تهيئة حماية reCAPTCHA في شاشة التحقق.");
  const recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, container, { size: "invisible" });
  const confirmationResult = await signInWithPhoneNumber(firebaseAuth, normalizedPhoneNumber, recaptchaVerifier);
  return { platform: "web", confirmationResult, recaptchaVerifier };
}

export async function completeFirebasePhoneVerification(
  verification: PhoneVerificationSession,
  verificationCode: string,
): Promise<{ firebaseUid: string; phoneNumber: string | null }> {
  if (verification.platform === "native") {
    if (verification.completedUser) return verification.completedUser;
    if (!verification.verificationId) throw new Error("لم تُرجع Firebase معرّف تحقق صالحاً. أعد طلب الرمز.");
    const result = await FirebaseAuthentication.confirmVerificationCode({
      verificationId: verification.verificationId,
      verificationCode,
    });
    if (!result.user?.uid) throw new Error("لم تُرجع Firebase هوية مستخدم صالحة بعد التحقق.");
    return { firebaseUid: result.user.uid, phoneNumber: result.user.phoneNumber };
  }

  try {
    const credential = await verification.confirmationResult.confirm(verificationCode);
    return { firebaseUid: credential.user.uid, phoneNumber: credential.user.phoneNumber };
  } finally {
    verification.recaptchaVerifier.clear();
  }
}

export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (!firebaseApp || isNativeFirebaseRuntime() || !(await isSupported())) return null;
  return getMessaging(firebaseApp);
}

export async function requestNativeFcmToken(): Promise<string | null> {
  if (!isNativeFirebaseRuntime()) return null;
  const permission = await FirebaseMessaging.requestPermissions();
  if (permission.receive !== "granted") return null;
  const result = await FirebaseMessaging.getToken();
  return result.token || null;
}

export async function listenForNativeFcmToken(onToken: (token: string) => void) {
  if (!isNativeFirebaseRuntime()) return null;
  return FirebaseMessaging.addListener("tokenReceived", ({ token }) => onToken(token));
}
