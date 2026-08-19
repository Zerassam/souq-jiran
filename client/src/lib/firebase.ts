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
      verificationId: string;
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
  if (!isFirebaseConfigured || !firebaseAuth) throw firebaseSetupError();

  if (isNativeFirebaseRuntime()) {
    let listener: { remove: () => Promise<void> } | undefined;
    try {
      const verification = await new Promise<{ verificationId: string }>(async (resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error("انتهت مهلة إرسال رمز التحقق. حاول مرة أخرى.")), 45_000);
        listener = await FirebaseAuthentication.addListener("phoneCodeSent", (event) => {
          window.clearTimeout(timeout);
          resolve({ verificationId: event.verificationId });
        });
        await FirebaseAuthentication.signInWithPhoneNumber({ phoneNumber });
      });
      return { platform: "native", verificationId: verification.verificationId };
    } finally {
      await listener?.remove();
    }
  }

  const container = document.getElementById(recaptchaContainerId);
  if (!container) throw new Error("تعذر تهيئة حماية reCAPTCHA في شاشة التحقق.");
  const recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, container, { size: "invisible" });
  const confirmationResult = await signInWithPhoneNumber(firebaseAuth, phoneNumber, recaptchaVerifier);
  return { platform: "web", confirmationResult, recaptchaVerifier };
}

export async function completeFirebasePhoneVerification(
  verification: PhoneVerificationSession,
  verificationCode: string,
): Promise<{ firebaseUid: string; phoneNumber: string | null }> {
  if (verification.platform === "native") {
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
