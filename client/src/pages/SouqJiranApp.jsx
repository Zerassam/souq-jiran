import { firebaseSupabase, supabase } from "@/lib/supabase";
import {
  beginFirebasePhoneVerification,
  clearFirebasePhoneVerification,
  completeFirebasePhoneVerification,
  listenForNativeFcmToken,
  listenForNativeOrderNotifications,
  requestNativeFcmToken,
} from "@/lib/firebase";
import { MapView as GoogleMapView } from "@/components/Map";
import React, { useState, useEffect, useMemo, useRef } from "react";
import Papa from "papaparse";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import {
  Store, ShoppingCart, ShoppingBag, ShoppingBasket, Search, MapPin, Clock,
  Plus, Minus, Trash2, Check, X, CheckCircle2, ClipboardList,
  User, ChevronRight, ChevronLeft, AlertCircle, Wheat, Bell,
  Star, Building2, TrendingUp, PackageCheck, PackageX, Loader2,
  Printer, Tag, MessageSquare, Copy, Navigation,
  Package, Droplet, Sparkles, Map as MapIcon, List, Upload, Download,
  FileText, Phone, Palette, CreditCard, Bike, Lock, LogOut, Wallet,
  Percent, CalendarClock, Home, Sun, Sunset, Moon,
  Mail, LogIn, UserPlus, ShieldCheck, Archive, MessageCircle, ArrowLeft
} from "lucide-react";

/* ---------------------------------------------------------
   Design tokens
--------------------------------------------------------- */
const C = {
  paper: "#F7F8FC", paperDark: "#EEF0FF", ink: "#172033", inkSoft: "#697386",
  teal: "#5B5BF7", tealDark: "#3730A3", rust: "#F45B7A", ochre: "#F59E0B",
  sage: "#10B981", line: "#E5E7F0", purple: "#8B5CF6",
};
const LOGO_COLORS = [C.teal, C.rust, C.ochre, C.sage, C.purple];
const PLATFORM_COURIER_FEE = 120;
const MAX_DISCOVERY_STORES = 6;
const MAX_DISCOVERY_COURIERS = 2;
const WILAYA_MAP_CENTERS = {
  "الجزائر": { lat: 36.7538, lng: 3.0588 }, "البليدة": { lat: 36.4700, lng: 2.8290 },
  "سطيف": { lat: 36.1911, lng: 5.4137 }, "أم البواقي": { lat: 35.8754, lng: 7.1135 },
  "وهران": { lat: 35.6971, lng: -0.6308 }, "قسنطينة": { lat: 36.3650, lng: 6.6147 },
  "عنابة": { lat: 36.9000, lng: 7.7667 }, "باتنة": { lat: 35.5550, lng: 6.1741 },
  "بجاية": { lat: 36.7500, lng: 5.0667 }, "تيزي وزو": { lat: 36.7118, lng: 4.0459 },
  "الشلف": { lat: 36.1653, lng: 1.3340 }, "تلمسان": { lat: 34.8783, lng: -1.3150 },
  "بسكرة": { lat: 34.8504, lng: 5.7281 }, "الجلفة": { lat: 34.6728, lng: 3.2630 },
};
function getStoreMapPosition(store, index = 0) {
  const latitude = Number(store?.latitude ?? store?.lat);
  const longitude = Number(store?.longitude ?? store?.lng);
  if (Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 36.95 && Math.abs(longitude) <= 12) {
    return { lat: latitude, lng: longitude };
  }
  const center = WILAYA_MAP_CENTERS[store?.wilaya] || { lat: 28.0339, lng: 1.6596 };
  const offset = ((index % 5) - 2) * 0.012;
  return { lat: center.lat + offset, lng: center.lng + offset };
}

const DEPARTMENTS = [
  { id: "veggies", label: "خضر وفواكه", icon: ShoppingBasket, color: C.sage },
  { id: "dairy", label: "ألبان وأجبان", icon: Package, color: C.ochre },
  { id: "bakery", label: "مخبوزات", icon: Wheat, color: C.rust },
  { id: "drinks", label: "مشروبات", icon: Droplet, color: C.teal },
  { id: "cleaning", label: "منظفات ومنزل", icon: Sparkles, color: C.purple },
  { id: "pantry", label: "مواد غذائية أساسية", icon: Store, color: "#8A6318" },
];
const deptInfo = (id) => DEPARTMENTS.find((d) => d.id === id) || DEPARTMENTS[5];

/* ---------------------------------------------------------
   التقسيم الجغرافي — 58 ولاية جزائرية
   ملاحظة: قوائم البلديات هنا تمثيلية (أهم البلديات لكل ولاية)
   وليست السجل الرسمي الكامل (~1541 بلدية) تفادياً لإدخال بيانات
   غير دقيقة لكل بلدية في الجزائر.
--------------------------------------------------------- */
const WILAYAS = [
  "أدرار", "الشلف", "الأغواط", "أم البواقي", "باتنة", "بجاية", "بسكرة", "بشار",
  "البليدة", "البويرة", "تمنراست", "تبسة", "تلمسان", "تيارت", "تيزي وزو", "الجزائر",
  "الجلفة", "جيجل", "سطيف", "سعيدة", "سكيكدة", "سيدي بلعباس", "عنابة", "قالمة",
  "قسنطينة", "المدية", "مستغانم", "المسيلة", "معسكر", "ورقلة", "وهران", "البيض",
  "إليزي", "برج بوعريريج", "بومرداس", "الطارف", "تندوف", "تيسمسيلت", "الوادي", "خنشلة",
  "سوق أهراس", "تيبازة", "ميلة", "عين الدفلى", "النعامة", "عين تموشنت", "غرداية", "غليزان",
  "تيميمون", "برج باجي مختار", "أولاد جلال", "بني عباس", "عين صالح", "عين قزام", "تقرت",
  "جانت", "المغير", "المنيعة",
];

const COMMUNES_BY_WILAYA = {
  "الجزائر": ["الجزائر الوسطى", "باب الوادي", "حسين داي", "بئر مراد رايس", "الحراش", "درارية", "بئر خادم", "الأبيار"],
  "وهران": ["وهران", "السانيا", "بئر الجير", "عين الترك", "بطيوة", "أرزيو", "المرسى الكبير"],
  "قسنطينة": ["قسنطينة", "الخروب", "حامة بوزيان", "ديدوش مراد", "زيغود يوسف"],
  "عنابة": ["عنابة", "البوني", "الحجار", "سيدي عمار", "برحال"],
  "البليدة": ["البليدة", "بوفاريك", "الأربعاء", "موزاية", "العفرون", "بوقرة"],
  "سطيف": ["سطيف", "العلمة", "عين ولمان", "بابور", "بوقاعة"],
  "تلمسان": ["تلمسان", "مغنية", "الغزوات", "ندرومة", "الرمشي"],
  "بجاية": ["بجاية", "أقبو", "سيدي عيش", "تيشي", "أميزور"],
  "تيزي وزو": ["تيزي وزو", "عزازقة", "الأربعاء ناث إيراثن", "بوغني", "تيقزيرت"],
  "باتنة": ["باتنة", "بريكة", "عين التوتة", "أريس", "تيمقاد"],
  "ورقلة": ["ورقلة", "حاسي مسعود", "الطيبات", "النزلة"],
  "غرداية": ["غرداية", "متليلي", "القرارة", "بريان", "المنصورة"],
  "بسكرة": ["بسكرة", "طولقة", "سيدي عقبة", "زريبة الوادي"],
  "سيدي بلعباس": ["سيدي بلعباس", "تلاغ", "سفيزف", "رأس الماء"],
  "مستغانم": ["مستغانم", "حاسي ماماش", "عين تادلس", "سيدي علي"],
  "الشلف": ["الشلف", "تنس", "الشطية", "أولاد فارس"],
  "تيارت": ["تيارت", "سوقر", "مهدية", "فرندة"],
  "جيجل": ["جيجل", "الطاهير", "الميلية", "تاكسنة"],
  "سكيكدة": ["سكيكدة", "عزابة", "القل", "الحروش"],
  "برج بوعريريج": ["برج بوعريريج", "رأس الوادي", "المنصورة", "العناصر"],
  "بومرداس": ["بومرداس", "بودواو", "برج منايل", "دلس", "ثنية الحد"],
  "المدية": ["المدية", "برواقية", "قصر البخاري", "عين بوسيف"],
  "معسكر": ["معسكر", "سيق", "تيغنيف", "المحمدية"],
  "تبسة": ["تبسة", "بئر العاتر", "الشريعة", "الحمة"],
  "الأغواط": ["الأغواط", "أفلو", "حاسي الدلاعة"],
  "خنشلة": ["خنشلة", "بابار", "قايس"],
  "سوق أهراس": ["سوق أهراس", "سدراتة", "مداوروش"],
  "قالمة": ["قالمة", "وادي الزناتي", "بوشقوف"],
  "أم البواقي": ["أم البواقي", "عين البيضاء", "عين مليلة"],
  "تيبازة": ["تيبازة", "حجوط", "القليعة", "بوسماعيل", "شرشال"],
  "عين تموشنت": ["عين تموشنت", "حمام بوحجر", "بني صاف"],
  "غليزان": ["غليزان", "وادي رهيو", "مازونة"],
  "ميلة": ["ميلة", "فرجيوة", "شلغوم العيد"],
  "عين الدفلى": ["عين الدفلى", "خميس مليانة", "العطاف"],
  "الجلفة": ["الجلفة", "عين وسارة", "حاسي بحبح"],
  "سعيدة": ["سعيدة", "عين الحجر"],
  "بشار": ["بشار", "بني ونيف", "القنادسة"],
  "أدرار": ["أدرار", "رقان", "أولف"],
  "الوادي": ["الوادي", "البياضة", "الرباح"],
  "المسيلة": ["المسيلة", "بوسعادة", "سيدي عيسى"],
  "البويرة": ["البويرة", "سور الغزلان", "لخضرية"],
  "الطارف": ["الطارف", "القالة", "بوثلجة", "الذرعان", "الشعارة"],
  "تمنراست": ["تمنراست", "أبلسة", "عين غار", "إدلس", "تين زاوتين"],
  "تندوف": ["تندوف", "أم العسل"],
  "البيض": ["البيض", "الأبيض سيدي الشيخ", "بوقطب", "بريزينة", "البنود"],
  "إليزي": ["إليزي", "إن أمناس", "دبداب", "برج عمر إدريس"],
  "تيسمسيلت": ["تيسمسيلت", "ثنية الأحد", "برج بونعامة", "لرجام", "خميستي"],
  "النعامة": ["النعامة", "المشرية", "عين الصفراء", "تيوت", "البيوض"],
  "تيميمون": ["تيميمون", "أولاد سعيد", "أوقروت", "دلضول", "تينركوك", "طالمين", "أولاد عيسى"],
  "برج باجي مختار": ["برج باجي مختار", "تيمياوين"],
  "أولاد جلال": ["أولاد جلال", "سيدي خالد", "رأس الميعاد", "البسباس", "الشعيبة", "الدوسن"],
  "بني عباس": ["بني عباس", "تامترت", "كرزاز", "تيمودي", "الوطأة", "تبلبالة", "أولاد خضير"],
  "عين صالح": ["عين صالح", "فقارة الزاوية", "إن غار"],
  "عين قزام": ["عين قزام", "تين زواتين"],
  "تقرت": ["تقرت", "الزاوية العابدية", "تماسين", "بليدة عمر", "المنقر", "الطيبات", "سيدي سليمان", "الحجيرة", "النزلة", "البرمة"],
  "جانت": ["جانت", "برج الحواس"],
  "المغير": ["المغير", "أم الطيور", "سطيل", "سيدي خليل", "جامعة", "سيدي عمران", "تندلة", "مرارة"],
  "المنيعة": ["المنيعة", "حاسي القارة", "حاسي الفحل"],
};
function getCommunes(wilaya) { return COMMUNES_BY_WILAYA[wilaya] || (wilaya ? [wilaya] : []); }

const VEHICLES = ["دراجة نارية", "سيارة", "دراجة هوائية"];
const AVAILABILITY_SLOTS = [
  { id: "morning", label: "صباحاً", icon: Sun },
  { id: "afternoon", label: "عصراً", icon: Sunset },
  { id: "evening", label: "ليلاً", icon: Moon },
];
const money = (n) => `${Number(n || 0).toLocaleString("ar-DZ")} دج`;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeAlgerianMobile(value = "") {
  const compact = String(value).trim().replace(/[\s().-]/g, "");
  if (/^0[567]\d{8}$/.test(compact)) return `+213${compact.slice(1)}`;
  if (/^\+213[567]\d{8}$/.test(compact)) return compact;
  if (/^00213[567]\d{8}$/.test(compact)) return `+${compact.slice(2)}`;
  return "";
}

function normalizeSearchText(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ـ/g, "")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseLoginIdentifier(value = "") {
  const identifier = String(value).trim();
  if (EMAIL_PATTERN.test(identifier)) {
    const email = identifier.toLowerCase();
    return { kind: "email", value: email, email, authEmail: email };
  }
  const phone = normalizeAlgerianMobile(identifier);
  if (!phone) return null;
  // يبقى OTP تجريبياً حالياً؛ يستعمل هذا الاسم الداخلي فقط لربط كلمة المرور
  // بحساب Supabase إلى أن يهيئ المشرف مزود هاتف/WhatsApp فعلياً.
  return { kind: "phone", value: phone, phone, authEmail: `phone-${phone.replace(/\D/g, "")}@phone.souqjiran.local` };
}

function formatRelativeActivity(isoTimestamp) {
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(isoTimestamp).getTime()) / 60000));
  const formatter = new Intl.RelativeTimeFormat("ar-DZ", { numeric: "auto" });
  if (elapsedMinutes < 60) return formatter.format(-elapsedMinutes, "minute");
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return formatter.format(-elapsedHours, "hour");
  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 30) return formatter.format(-elapsedDays, "day");
  const elapsedMonths = Math.floor(elapsedDays / 30);
  if (elapsedMonths < 12) return formatter.format(-elapsedMonths, "month");
  return formatter.format(-Math.floor(elapsedMonths / 12), "year");
}
function escapeCSVCell(value) {
  const normalized = String(value ?? "");
  const formulaSafe = /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
  return `"${formulaSafe.replaceAll('"', '""')}"`;
}
function groupRowsBy(rows, keySelector) {
  return rows.reduce((groups, row) => {
    const key = keySelector(row);
    (groups[key] ||= []).push(row);
    return groups;
  }, {});
}

const STORE_STATUS = {
  pending_review: { label: "قيد المراجعة الأولية", color: C.ochre },
  awaiting_profile: { label: "بانتظار إكمال الملف", color: C.purple },
  approved: { label: "محل مفعّل", color: C.sage },
  rejected: { label: "مرفوض", color: "#8B3A2A" },
};

/* ---------------------------------------------------------
   Mock data
--------------------------------------------------------- */
const initialStores = [
  {
    id: "s1", name: "سوبر ماركت الأمل", phone: "0555 12 34 56",
    wilaya: "البليدة", commune: "البليدة", address: "شارع الاستقلال",
    lat: 52, lng: 47, distance: "350 م", status: "approved", rating: null,
    open: 7, close: 22, minOrder: 500, deliveryFee: 150, hasOwnDelivery: true,
    deliveryCommunes: ["البليدة", "بوفاريك"], approvedCourierIds: ["c1"],
    commissionType: "percentage", commissionRate: 10, subscriptionFee: 3000, duesPaid: 0,
    logo: { text: "سأ", color: C.teal }, ccp: "0079999912 45", idDocName: "سجل_تجاري.pdf",
    reviews: [],
    products: [
      { id: "p1", name: "خبز تقليدي", price: 25, unit: "الوحدة", department: "bakery", available: true },
      { id: "p2", name: "حليب طازج 1ل", price: 90, unit: "العلبة", department: "dairy", available: true },
      { id: "p3", name: "طماطم", price: 80, unit: "الكيلوغرام", department: "veggies", available: true },
      { id: "p4", name: "عصير برتقال 1ل", price: 220, unit: "العلبة", department: "drinks", available: true },
      { id: "p5", name: "مسحوق غسيل 3 كغ", price: 890, unit: "العلبة", department: "cleaning", available: true },
      { id: "p6", name: "أرز 5 كغ", price: 780, unit: "الكيس", department: "pantry", available: true },
    ],
  },
  {
    id: "s2", name: "سوبر ماركت النور", phone: "0661 22 33 44",
    wilaya: "البليدة", commune: "بوفاريك", address: "نهج بن باديس",
    lat: 55, lng: 50, distance: "700 م", status: "approved", rating: null,
    open: 6, close: 21, minOrder: 300, deliveryFee: 100, hasOwnDelivery: false,
    deliveryCommunes: [], approvedCourierIds: ["c1"],
    commissionType: "percentage", commissionRate: 8, subscriptionFee: 2500, duesPaid: 0,
    logo: { text: "نر", color: C.rust }, ccp: "0088888844 12", idDocName: "سجل_تجاري.pdf",
    reviews: [],
    products: [
      { id: "p7", name: "جبن أبيض 500غ", price: 340, unit: "العلبة", department: "dairy", available: true },
      { id: "p8", name: "كرواسون زبدة", price: 40, unit: "الوحدة", department: "bakery", available: true },
      { id: "p9", name: "خيار", price: 60, unit: "الكيلوغرام", department: "veggies", available: true },
      { id: "p10", name: "مياه معدنية 1.5ل", price: 45, unit: "القارورة", department: "drinks", available: true },
    ],
  },
  {
    id: "s3", name: "سوبر ماركت العاصمة", phone: "0770 55 66 77",
    wilaya: "الجزائر", commune: "باب الوادي", address: "شارع العربي بن مهيدي",
    lat: 38, lng: 30, distance: "—", status: "approved", rating: null,
    open: 8, close: 22, minOrder: 600, deliveryFee: 200, hasOwnDelivery: true,
    deliveryCommunes: ["باب الوادي", "حسين داي"], approvedCourierIds: [],
    commissionType: "subscription", commissionRate: 10, subscriptionFee: 4000, duesPaid: 0,
    logo: { text: "عص", color: C.ochre }, ccp: "0011223344 78", idDocName: "سجل_تجاري.pdf",
    reviews: [],
    products: [
      { id: "p11", name: "سكر أبيض 2 كغ", price: 260, unit: "الكيس", department: "pantry", available: true },
      { id: "p12", name: "معجون طماطم", price: 130, unit: "العلبة", department: "pantry", available: true },
      { id: "p13", name: "معقم أسطح", price: 310, unit: "القارورة", department: "cleaning", available: true },
    ],
  },
  {
    id: "s4", name: "سوبر ماركت وهران المركزي", phone: "0540 88 99 00",
    wilaya: "وهران", commune: "وهران", address: "الطريق الوطني رقم 2",
    lat: 70, lng: 78, distance: "—", status: "approved", rating: null,
    open: 8, close: 23, minOrder: 400, deliveryFee: 180, hasOwnDelivery: false,
    deliveryCommunes: [], approvedCourierIds: ["c2"],
    commissionType: "percentage", commissionRate: 12, subscriptionFee: 3500, duesPaid: 0,
    logo: { text: "وه", color: C.sage }, ccp: "0099887766 33", idDocName: "سجل_تجاري.pdf",
    reviews: [],
    products: [
      { id: "p14", name: "بيض بلدي (12)", price: 320, unit: "الطبق", department: "dairy", available: true },
      { id: "p15", name: "بطاطا", price: 70, unit: "الكيلوغرام", department: "veggies", available: true },
      { id: "p16", name: "شاي أخضر", price: 180, unit: "العلبة", department: "pantry", available: true },
    ],
  },
  {
    id: "s5", name: "سوبر ماركت قسنطينة الجديد", phone: "0666 44 55 66",
    wilaya: "قسنطينة", commune: "قسنطينة", address: "",
    lat: 24, lng: 18, distance: "—", status: "awaiting_profile", rating: null,
    open: 8, close: 21, minOrder: 0, deliveryFee: 0, hasOwnDelivery: true,
    deliveryCommunes: [], approvedCourierIds: [],
    commissionType: "percentage", commissionRate: 10, subscriptionFee: 3000, duesPaid: 0,
    logo: { text: "قج", color: C.teal }, ccp: "", idDocName: "",
    reviews: [], products: [],
  },
];

const initialOrders = [
  { id: "o1", storeId: "s1", storeName: "سوبر ماركت الأمل", customer: "سارة ب.", items: [{ id: "p2", name: "حليب طازج 1ل", price: 90, qty: 2 }], subtotal: 180, deliveryFee: 150, total: 330, status: "preparing", createdAt: "10:12", rated: false, deliveryType: "store", courier: null, confirmed: false },
  { id: "o2", storeId: "s2", storeName: "سوبر ماركت النور", customer: "يوسف ك.", items: [{ id: "p7", name: "جبن أبيض 500غ", price: 340, qty: 1 }], subtotal: 340, deliveryFee: 120, total: 460, status: "pending", createdAt: "10:40", rated: false, deliveryType: "courier", courier: { id: "c1", name: "رضا ب.", phone: "0555 66 77 88" }, confirmed: false },
  { id: "o3", storeId: "s4", storeName: "سوبر ماركت وهران المركزي", customer: "أمينة ز.", items: [{ id: "p14", name: "بيض بلدي (12)", price: 320, qty: 1 }, { id: "p15", name: "بطاطا", price: 70, qty: 3 }], subtotal: 530, deliveryFee: 0, total: 530, status: "delivered", createdAt: "أمس", rated: true, deliveryType: "pickup", courier: null, confirmed: true },
];

const pendingStoreSeed = {
  id: "s6", name: "سوبر ماركت الجيران", phone: "0555 99 00 11",
  wilaya: "البليدة", commune: "الأربعاء", address: "",
  lat: 48, lng: 53, distance: "—", status: "pending_review", rating: null,
  open: 8, close: 21, minOrder: 0, deliveryFee: 0, hasOwnDelivery: true,
  deliveryCommunes: [], approvedCourierIds: [],
  commissionType: "percentage", commissionRate: 10, subscriptionFee: 3000, duesPaid: 0,
  logo: { text: "سج", color: C.rust }, ccp: "", idDocName: "",
  reviews: [], products: [],
};

const initialCouriers = [
  { id: "c1", name: "رضا ب.", phone: "0555 66 77 88", vehicle: "دراجة نارية", wilaya: "البليدة", communes: ["البليدة", "بوفاريك"], availability: ["morning", "afternoon"], customHours: null, storeMode: "all", selectedStoreIds: [], status: "approved" },
  { id: "c2", name: "كريم س.", phone: "0666 11 22 33", vehicle: "سيارة", wilaya: "وهران", communes: ["وهران", "السانيا"], availability: ["afternoon", "evening"], customHours: null, storeMode: "selected", selectedStoreIds: ["s4"], status: "approved" },
  { id: "c3", name: "محمد ر.", phone: "0777 44 55 66", vehicle: "دراجة هوائية", wilaya: "البليدة", communes: ["البليدة"], availability: ["morning"], customHours: null, storeMode: "all", selectedStoreIds: [], status: "pending" },
];

// حسابات تجريبية جاهزة: إيميل + كلمة سر (الجميع: 1234)
const initialAccounts = [
  { type: "merchant", email: "s1@example.com", password: "1234", storeId: "s1", name: "سوبر ماركت الأمل" },
  { type: "merchant", email: "s2@example.com", password: "1234", storeId: "s2", name: "سوبر ماركت النور" },
  { type: "merchant", email: "s3@example.com", password: "1234", storeId: "s3", name: "محل التوفير" },
  { type: "merchant", email: "s4@example.com", password: "1234", storeId: "s4", name: "سوبر ماركت وهران المركزي" },
  { type: "courier", email: "c1@example.com", password: "1234", courierId: "c1", name: "رضا ب." },
  { type: "courier", email: "c2@example.com", password: "1234", courierId: "c2", name: "كريم س." },
];

const PROMOS = [
  { code: "AHLAN20", title: "خصم الترحيب", discount: 20, desc: "خصم 20% على أول طلب لك", color: C.rust },
  { code: "TOUSSOL10", title: "خصم التوصيل", discount: 10, desc: "خصم 10% على كل الطلبات هذا الأسبوع", color: C.teal },
  { code: "FRIDAY15", title: "عرض الجمعة", discount: 15, desc: "خصم 15% على المواد الغذائية", color: C.ochre },
];

/* ---------------------------------------------------------
   عناصر مشتركة
--------------------------------------------------------- */
function StripeDivider({ height = 3 }) { return <div className="app-signal-line" style={{ height, borderRadius: 999, backgroundImage: `linear-gradient(90deg, ${C.teal}, ${C.purple} 48%, ${C.rust})` }} />; }
function PriceTag({ amount, size = "md" }) {
  const big = size === "lg";
  return (
    <span className="inline-flex items-center" style={{ background: C.teal + "12", border: `1px solid ${C.teal}26`, borderRadius: 999, padding: big ? "8px 14px" : "4px 10px" }}>
      <span style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif", fontWeight: 800, color: C.teal, fontSize: big ? 20 : 13 }}>{money(amount)}</span>
    </span>
  );
}
function DeptBadge({ id, size = 16 }) { const info = deptInfo(id); const Icon = info.icon; return <span className="inline-flex items-center justify-center" style={{ width: size + 14, height: size + 14, borderRadius: 999, background: info.color + "22", color: info.color }}><Icon size={size} strokeWidth={2.3} /></span>; }
function StoreAvatar({ logo, size = 42 }) { return <span className="flex items-center justify-center rounded-[14px] shrink-0 font-black" style={{ width: size, height: size, background: `linear-gradient(145deg, ${logo?.color || C.teal}, ${C.purple})`, color: "#fff", fontSize: size * 0.36, fontFamily: "'IBM Plex Sans Arabic', sans-serif", boxShadow: `0 8px 18px ${(logo?.color || C.teal)}35` }}>{logo?.text || <Store size={size * 0.5} />}</span>; }
function getDiscoveryCategory(store) {
  const raw = `${store?.category || ""} ${store?.businessType || ""} ${store?.name || ""}`.toLowerCase();
  if (/صيدل/.test(raw)) return { id: "pharmacy", label: "صيدلية" };
  if (/فاست|fast|مطعم|restaurant/.test(raw)) return { id: "fast-food", label: "وجبات سريعة" };
  if (/حلويات|patisserie|pastry/.test(raw)) return { id: "sweets", label: "حلويات" };
  if (/خرد|بقال|épicer|grocery/.test(raw)) return { id: "grocery", label: "بقالة" };
  if (/سوبر|supermarket|ماركت/.test(raw)) return { id: "supermarket", label: "سوبرماركت" };
  return { id: "local", label: store?.category || store?.businessType || "متجر محلي" };
}
function curateDiscoveryStores(stores) {
  const buckets = new Map();
  stores.forEach((store) => {
    const category = getDiscoveryCategory(store);
    if (!buckets.has(category.id)) buckets.set(category.id, []);
    buckets.get(category.id).push(store);
  });
  const preferredOrder = ["supermarket", "pharmacy", "fast-food", "sweets", "grocery", "local"];
  const categoryIds = [...preferredOrder, ...[...buckets.keys()].filter((id) => !preferredOrder.includes(id))];
  const selected = [];
  categoryIds.forEach((categoryId) => {
    const first = buckets.get(categoryId)?.[0];
    if (first && selected.length < MAX_DISCOVERY_STORES) selected.push(first);
  });
  stores.forEach((store) => {
    if (selected.length < MAX_DISCOVERY_STORES && !selected.some((item) => item.id === store.id)) selected.push(store);
  });
  return selected;
}
function PublicCourierAvailability({ couriers, areaLabel }) {
  return <section className="space-y-3" data-testid="nearby-couriers-panel">
    <div className="flex items-end justify-between gap-3"><div><h3 className="font-black" style={{ color: C.ink, fontFamily: "'Reem Kufi', sans-serif" }}>موصلون متاحون عبر المنصة</h3><p className="text-xs mt-1" style={{ color: C.inkSoft }}>تظهر حالة التوفر فقط؛ تُحفظ هوية الموصل وبياناته الخاصة حتى إسناد الطلب.</p></div><span className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0" style={{ background: C.teal + "12", color: C.teal }}>{couriers.length}/{MAX_DISCOVERY_COURIERS} متاح</span></div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {Array.from({ length: MAX_DISCOVERY_COURIERS }).map((_, index) => {
        const courier = couriers[index];
        return <div key={courier?.id || `courier-slot-${index}`} className="p-4 rounded-2xl flex items-center gap-3" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
          <span className="flex items-center justify-center rounded-xl shrink-0" style={{ width: 42, height: 42, background: courier ? C.sage + "18" : C.paperDark, color: courier ? C.sage : C.inkSoft }}><Bike size={20} /></span>
          <div className="min-w-0"><div className="text-sm font-black" style={{ color: C.ink }}>{courier ? `موصل المنصة ${index + 1}` : "بانتظار موصل متاح"}</div><div className="text-xs mt-1" style={{ color: C.inkSoft }}>{courier ? `${courier.wilaya || areaLabel} · ${courier.commune || "يغطي نطاق المنطقة"}` : `${areaLabel} · ستظهر البطاقة عند توفر موصل معتمد`}</div></div>
        </div>;
      })}
    </div>
  </section>;
}
function VerifiedFeedbackPanel({ stores }) {
  const reviews = useMemo(() => stores.flatMap((store) => (store.reviews || []).filter((review) => review?.verified === true && review?.comment).map((review) => ({ ...review, storeName: store.name }))), [stores]);
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => {
    setActiveIndex(0);
    if (reviews.length < 2) return undefined;
    const timer = window.setInterval(() => setActiveIndex((current) => (current + 1) % reviews.length), 5500);
    return () => window.clearInterval(timer);
  }, [reviews.length]);
  if (reviews.length === 0) return <section data-testid="verified-feedback-panel" className="p-5 rounded-2xl" style={{ background: `linear-gradient(135deg, ${C.paperDark}, #fff)`, border: `1px solid ${C.line}` }}><div className="flex items-start gap-3"><span className="flex items-center justify-center rounded-xl shrink-0" style={{ width: 42, height: 42, background: C.teal + "12", color: C.teal }}><MessageSquare size={20} /></span><div><h3 className="font-black" style={{ color: C.ink, fontFamily: "'Reem Kufi', sans-serif" }}>آراء موثقة من المجتمع</h3><p className="text-xs leading-6 mt-1" style={{ color: C.inkSoft }}>ستظهر هنا تقييمات العملاء والتجار والموصلين بعد اكتمال الطلب واعتماد المراجعة. لا نعرض أي تعليق تجريبي أو تقييم غير موثق.</p></div></div></section>;
  const review = reviews[activeIndex % reviews.length];
  return <section data-testid="verified-feedback-panel" className="p-5 rounded-2xl overflow-hidden" style={{ background: `linear-gradient(135deg, ${C.ink}, ${C.tealDark})`, color: "#fff" }}><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-1.5 text-xs font-bold opacity-75"><MessageSquare size={14} /> آراء موثقة من المجتمع</div><h3 className="font-black text-lg mt-2" style={{ fontFamily: "'Reem Kufi', sans-serif" }}>{review.storeName}</h3></div><div className="flex gap-1"><button aria-label="التعليق السابق" onClick={() => setActiveIndex((current) => (current - 1 + reviews.length) % reviews.length)} className="p-2 rounded-xl" style={{ background: "rgba(255,255,255,.12)" }}><ChevronRight size={16} /></button><button aria-label="التعليق التالي" onClick={() => setActiveIndex((current) => (current + 1) % reviews.length)} className="p-2 rounded-xl" style={{ background: "rgba(255,255,255,.12)" }}><ChevronLeft size={16} /></button></div></div><div key={review.id} className="mt-5 transition-all duration-300"><StarRating value={review.stars} size={14} /><p className="mt-3 text-sm leading-7">{review.comment}</p><p className="mt-3 text-xs opacity-70">{review.authorRole || "عضو موثّق"} · {review.date || ""}</p></div>{reviews.length > 1 && <div className="flex gap-1.5 mt-5">{reviews.map((item, index) => <button key={item.id} aria-label={`انتقال إلى التعليق ${index + 1}`} onClick={() => setActiveIndex(index)} className="h-1.5 rounded-full transition-all" style={{ width: index === activeIndex ? 22 : 7, background: index === activeIndex ? "#fff" : "rgba(255,255,255,.3)" }} />)}</div>}</section>;
}
const STATUS_MAP = {
  pending: { label: "قيد الانتظار", color: C.ochre }, accepted: { label: "تم القبول", color: C.sage },
  preparing: { label: "قيد التحضير", color: C.teal }, ready: { label: "جاهز للتسليم", color: C.rust },
  assigned: { label: "أُسند للموصل", color: C.purple }, picked_up: { label: "استلمه الموصل", color: C.teal },
  out_for_delivery: { label: "في الطريق إليك", color: C.teal }, delivered: { label: "تم التسليم", color: C.tealDark },
  customer_confirmed: { label: "أكد العميل الاستلام", color: C.sage }, remittance_confirmed: { label: "حوّل الموصل المستحقات", color: C.sage },
  settled: { label: "تمت التسوية", color: C.sage }, declined: { label: "مرفوض", color: "#8B3A2A" }, cancelled: { label: "ملغى", color: "#8B3A2A" },
};
function StatusPill({ status }) { const s = STATUS_MAP[status] ?? { label: "بانتظار التحديث", color: C.inkSoft }; return <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full" style={{ background: s.color + "1F", color: s.color }}><span style={{ width: 6, height: 6, borderRadius: 999, background: s.color }} />{s.label}</span>; }
function Toast({ message }) { if (!message) return null; return <div className="fixed bottom-6 left-1/2 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-bold" style={{ transform: "translateX(-50%)", background: C.ink, color: C.paper }}>{message}</div>; }
function Truck2(props) { return <Store {...props} />; }
const DELIVERY_LABELS = { store: { label: "توصيل المحل", icon: Truck2 }, courier: { label: "موصل معتمد من المنصة", icon: Bike }, pickup: { label: "استلام ذاتي من المحل", icon: Home } };

/* ---------------------------------------------------------
   قائمتا الولاية/البلدية المتتاليتان (Cascading Select)
--------------------------------------------------------- */
function WilayaCommuneSelect({ wilaya, commune, onChange, allowAllWilaya = false, allowAllCommune = false }) {
  const communes = getCommunes(wilaya);
  return (
    <div className="flex gap-2">
      <select value={wilaya || ""} onChange={(e) => onChange({ wilaya: e.target.value, commune: "" })} className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }}>
        {allowAllWilaya && <option value="">كل الولايات</option>}
        {!allowAllWilaya && !wilaya && <option value="" disabled>اختر الولاية</option>}
        {WILAYAS.map((w) => <option key={w} value={w}>{w}</option>)}
      </select>
      <select value={commune || ""} onChange={(e) => onChange({ wilaya, commune: e.target.value })} disabled={!wilaya} className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none disabled:opacity-50" style={{ border: `1px solid ${C.line}` }}>
        {allowAllCommune && <option value="">كل البلديات</option>}
        {!allowAllCommune && <option value="" disabled>اختر البلدية</option>}
        {communes.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );
}

/* ---------------------------------------------------------
   الخريطة
--------------------------------------------------------- */
function mapGridStyle(size = 34) { return { backgroundImage: `linear-gradient(${C.teal}08 1px, transparent 1px), linear-gradient(90deg, ${C.teal}08 1px, transparent 1px), radial-gradient(circle at 80% 20%, ${C.purple}1c, transparent 34%)`, backgroundSize: `${size}px ${size}px, ${size}px ${size}px, auto`, backgroundColor: "#F9FAFF" }; }
function MapPreview({ x = 50, y = 50, height = 64 }) { return (<div className="relative rounded-lg overflow-hidden" style={{ height, ...mapGridStyle(18) }}><span className="absolute" style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -95%)" }}><MapPin size={18} color={C.rust} fill={C.rust + "33"} /></span></div>); }
function MapPicker({ initial, title = "حدد الموقع على الخريطة", onConfirm, onClose }) {
  const [pos, setPos] = useState(initial || { x: 50, y: 50 });
  function handleClick(e) { const rect = e.currentTarget.getBoundingClientRect(); const x = ((e.clientX - rect.left) / rect.width) * 100; const y = ((e.clientY - rect.top) / rect.height) * 100; setPos({ x: Math.max(3, Math.min(97, x)), y: Math.max(3, Math.min(97, y)) }); }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(35,32,27,0.5)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl p-5" style={{ background: C.paper }}>
        <div className="flex items-center justify-between mb-1"><h3 className="font-black flex items-center gap-1.5" style={{ fontFamily: "'Reem Kufi', sans-serif", color: C.ink }}><Navigation size={16} color={C.teal} /> {title}</h3><button onClick={onClose}><X size={18} color={C.inkSoft} /></button></div>
        <p className="text-xs mb-3" style={{ color: C.inkSoft }}>انقر في أي نقطة على الخريطة لتثبيت الموقع.</p>
        <div onClick={handleClick} className="relative rounded-xl cursor-crosshair overflow-hidden" style={{ height: 230, ...mapGridStyle(30) }}><span className="absolute" style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%, -95%)" }}><MapPin size={30} color={C.rust} fill={C.rust + "33"} strokeWidth={2.2} /></span></div>
        <button onClick={() => { onConfirm(pos); onClose(); }} className="w-full mt-4 py-2.5 rounded-xl font-black flex items-center justify-center gap-1.5" style={{ background: C.teal, color: "#fff" }}><Check size={15} /> تأكيد هذا الموقع</button>
      </div>
    </div>
  );
}
function computeBounds(list) {
  if (!list.length) return { minX: 0, maxX: 100, minY: 0, maxY: 100 };
  const xs = list.map((s) => s.lng), ys = list.map((s) => s.lat);
  let minX = Math.min(...xs) - 12, maxX = Math.max(...xs) + 12, minY = Math.min(...ys) - 12, maxY = Math.max(...ys) + 12;
  minX = Math.max(0, minX); minY = Math.max(0, minY); maxX = Math.min(100, maxX); maxY = Math.min(100, maxY);
  if (maxX - minX < 24) { const c = (maxX + minX) / 2; minX = Math.max(0, c - 12); maxX = Math.min(100, c + 12); }
  if (maxY - minY < 24) { const c = (maxY + minY) / 2; minY = Math.max(0, c - 12); maxY = Math.min(100, c + 12); }
  return { minX, maxX, minY, maxY };
}
function MapView({ stores, selectedWilaya, onSelectWilaya, onOpenStore }) {
  const [pinId, setPinId] = useState(null);
  const [mapError, setMapError] = useState("");
  const wilayaStores = selectedWilaya ? stores.filter((s) => s.wilaya === selectedWilaya) : stores;
  const selected = wilayaStores.find((s) => s.id === pinId);
  const storeMarkers = wilayaStores.map((store, index) => ({
    id: store.id,
    position: getStoreMapPosition(store, index),
    title: store.name,
    onClick: () => {
      setPinId(store.id);
      onOpenStore(store.id);
    },
  }));
  return (
    <div className="space-y-3">
      <select value={selectedWilaya || ""} onChange={(e) => { onSelectWilaya(e.target.value || null); setPinId(null); }} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }}>
        <option value="">كل الولايات</option>
        {WILAYAS.filter((w) => stores.some((s) => s.wilaya === w)).map((w) => <option key={w} value={w}>{w}</option>)}
      </select>
      <div className="relative rounded-2xl overflow-hidden" style={{ height: 340, background: C.paperDark }}>
        {!mapError && <GoogleMapView key={selectedWilaya || "all-stores"} className="h-full" initialCenter={{ lat: 28.0339, lng: 1.6596 }} initialZoom={5} markers={storeMarkers} onMapError={() => setMapError("تعذر تحميل الخريطة حالياً. تحقق من اتصال الإنترنت ثم أعد المحاولة.")} />}
        {mapError && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center" style={{ ...mapGridStyle(26), color: C.inkSoft }}><MapPin size={28} color={C.rust} /><p className="text-sm font-bold">{mapError}</p><button onClick={() => setMapError("")} className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: C.teal, color: "#fff" }}>إعادة المحاولة</button></div>}
        {wilayaStores.length === 0 && !mapError && <p className="absolute bottom-3 right-3 left-3 p-2 rounded-lg text-center text-xs" style={{ background: "#ffffffe8", color: C.inkSoft }}>لا محلات مفعلة في هذه المنطقة بعد.</p>}
      </div>
      {wilayaStores.length > 0 && <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{wilayaStores.map((store) => <button key={store.id} onClick={() => { setPinId(store.id); onOpenStore(store.id); }} className="p-3 rounded-xl text-right flex items-center gap-2" style={{ background: "#fff", border: `1px solid ${pinId === store.id ? C.teal : C.line}` }}><StoreAvatar logo={store.logo} size={30} /><span className="min-w-0 flex-1"><span className="block text-sm font-black truncate" style={{ color: C.ink }}>{store.name}</span><span className="block text-[11px]" style={{ color: C.inkSoft }}>{store.wilaya} · {store.commune}</span></span><ChevronLeft size={15} color={C.teal} /></button>)}</div>}
      {selected && <p className="text-xs" style={{ color: C.inkSoft }}>المحل المحدد: {selected.name}</p>}
      <p className="text-xs flex items-center gap-1" style={{ color: C.inkSoft }}><MapIcon size={12} /> خريطة تفاعلية لتحديد الولاية، مع قائمة المحلات المفعلة المتاحة للشراء.</p>
    </div>
  );
}

/* ---------------------------------------------------------
   تقييمات
--------------------------------------------------------- */
function StarRating({ value = 0, size = 14, interactive = false, onChange }) {
  const [hover, setHover] = useState(0); const display = interactive ? hover || value : value;
  return (<div className="flex items-center gap-0.5">{[1, 2, 3, 4, 5].map((n) => (<span key={n} onClick={() => interactive && onChange && onChange(n)} onMouseEnter={() => interactive && setHover(n)} onMouseLeave={() => interactive && setHover(0)} style={{ cursor: interactive ? "pointer" : "default" }}><Star size={size} color={C.ochre} fill={n <= display ? C.ochre : "transparent"} strokeWidth={1.8} /></span>))}</div>);
}
function ReviewModal({ order, onSubmit, onClose }) {
  const [stars, setStars] = useState(5); const [comment, setComment] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(35,32,27,0.5)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl p-5" style={{ background: C.paper }}>
        <div className="flex items-center justify-between mb-3"><h3 className="font-black flex items-center gap-1.5" style={{ fontFamily: "'Reem Kufi', sans-serif", color: C.ink }}><MessageSquare size={16} color={C.teal} /> قيّم تجربتك مع {order.storeName}</h3><button onClick={onClose}><X size={18} color={C.inkSoft} /></button></div>
        <div className="flex justify-center py-3"><StarRating value={stars} size={30} interactive onChange={setStars} /></div>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="اكتب تعليقك (اختياري)..." rows={3} className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" style={{ border: `1px solid ${C.line}`, fontFamily: "Tajawal, sans-serif" }} />
        <button onClick={() => onSubmit(stars, comment)} className="w-full mt-3 py-2.5 rounded-xl font-black" style={{ background: C.rust, color: "#fff" }}>إرسال التقييم</button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   عروض وإشعارات
--------------------------------------------------------- */
function PromoBar({ notify }) {
  function copyCode(code) { try { navigator.clipboard.writeText(code); } catch (e) {} notify(`تم نسخ الكود «${code}»`); }
  return (<div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">{PROMOS.map((p, index) => (<div key={p.code} className="promo-card shrink-0 w-64 p-4 rounded-2xl flex items-center justify-between gap-2" style={{ background: `linear-gradient(135deg, ${p.color}, ${index === 1 ? C.purple : C.teal})`, color: "#fff" }}><div><div className="flex items-center gap-1 text-xs font-bold opacity-90 mb-1"><Tag size={12} /> {p.title}</div><div className="text-xs opacity-90 mb-2 leading-5">{p.desc}</div><span className="text-xs font-black px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.18)" }}>{p.code}</span></div><button aria-label={`نسخ ${p.code}`} onClick={() => copyCode(p.code)} className="flex items-center justify-center rounded-xl shrink-0" style={{ width: 34, height: 34, background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.18)" }}><Copy size={14} color="#fff" /></button></div>))}</div>);
}
function NotificationsBell({ notifications, markAllRead }) {
  const [open, setOpen] = useState(false); const unread = notifications.filter((n) => !n.read).length;
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative flex items-center justify-center rounded-xl" style={{ width: 38, height: 38, border: `1px solid ${C.line}`, background: "#fff" }}><Bell size={17} color={C.ink} />{unread > 0 && <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center text-[10px] font-black rounded-full" style={{ width: 17, height: 17, background: C.rust, color: "#fff" }}>{unread}</span>}</button>
      {open && (<><div className="fixed inset-0 z-30" onClick={() => setOpen(false)} /><div className="absolute left-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-2xl z-40 shadow-lg" style={{ background: "#fff", border: `1px solid ${C.line}` }}><div className="flex items-center justify-between p-3" style={{ borderBottom: `1px solid ${C.line}` }}><span className="font-bold text-sm" style={{ color: C.ink }}>الإشعارات</span>{unread > 0 && <button onClick={markAllRead} className="text-xs font-bold" style={{ color: C.teal }}>تعليم الكل كمقروء</button>}</div>{notifications.length === 0 ? <p className="text-xs text-center py-8" style={{ color: C.inkSoft }}>لا توجد إشعارات بعد.</p> : notifications.map((n) => (<div key={n.id} className="flex items-start gap-2 p-3" style={{ borderBottom: `1px solid ${C.line}`, background: n.read ? "transparent" : C.ochre + "12" }}>{!n.read && <span className="shrink-0 mt-1" style={{ width: 6, height: 6, borderRadius: 999, background: C.rust }} />}<div className={n.read ? "mr-2" : ""}><p className="text-xs font-bold" style={{ color: C.ink }}>{n.message}</p><p className="text-[10px] mt-0.5" style={{ color: C.inkSoft }}>{n.time}</p></div></div>))}</div></>)}
    </div>
  );
}

/* ---------------------------------------------------------
   فاتورة
--------------------------------------------------------- */
function InvoiceModal({ order, store, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(35,32,27,0.55)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: "#fff" }}>
        <div id="invoice-print-area" className="p-6">
          <div className="flex items-center justify-between mb-4"><div><div className="font-black text-lg" style={{ fontFamily: "'Reem Kufi', sans-serif", color: C.ink }}>سوق الجيران</div><div className="text-xs" style={{ color: C.inkSoft }}>فاتورة طلب #{order.id}</div></div><PackageCheck size={26} color={C.teal} /></div>
          <StripeDivider height={4} />
          <div className="my-4 text-xs space-y-1" style={{ color: C.inkSoft }}>
            <div>المحل: <span style={{ color: C.ink, fontWeight: 700 }}>{order.storeName}</span></div>
            {store?.address && <div>عنوان المحل: {store.address}{store.commune ? `، ${store.commune}` : ""}{store.wilaya ? `، ولاية ${store.wilaya}` : ""}</div>}
            <div>العميل: <span style={{ color: C.ink, fontWeight: 700 }}>{order.customer}</span></div>
            <div>طريقة التسليم: {DELIVERY_LABELS[order.deliveryType]?.label || "—"}{order.courier ? ` (${order.courier.name})` : ""}</div>
            <div>الدفع: نقداً عند الاستلام</div>
            <div>التاريخ: {order.createdAt}</div>
          </div>
          <table className="w-full text-xs mb-4"><thead><tr style={{ borderBottom: `1px solid ${C.line}` }}><th className="text-right py-1.5" style={{ color: C.inkSoft }}>المنتج</th><th className="text-center py-1.5" style={{ color: C.inkSoft }}>الكمية</th><th className="text-left py-1.5" style={{ color: C.inkSoft }}>السعر</th></tr></thead><tbody>{order.items.map((i) => (<tr key={i.id} style={{ borderBottom: `1px solid ${C.line}` }}><td className="py-1.5" style={{ color: C.ink }}>{i.name}</td><td className="py-1.5 text-center" style={{ color: C.ink }}>{i.qty}</td><td className="py-1.5 text-left" style={{ color: C.ink }}>{money(i.price * i.qty)}</td></tr>))}</tbody></table>
          <div className="text-xs space-y-1 mb-2" style={{ color: C.inkSoft }}>
            <div className="flex justify-between"><span>المجموع الفرعي</span><span>{money(order.subtotal ?? order.total)}</span></div>
            {order.deliveryFee > 0 && <div className="flex justify-between"><span>رسوم التوصيل</span><span>{money(order.deliveryFee)}</span></div>}
            {order.discountCode && <div className="flex justify-between" style={{ color: C.sage }}><span>خصم ({order.discountCode})</span><span>- {money(order.discountAmount || 0)}</span></div>}
          </div>
          <div className="flex justify-between items-center pt-2" style={{ borderTop: `2px solid ${C.ink}` }}><span className="font-black text-sm" style={{ color: C.ink }}>المبلغ الواجب دفعه نقداً</span><span className="font-black text-base" style={{ color: C.rust }}>{money(order.total)}</span></div>
          <p className="text-center text-[10px] mt-5" style={{ color: C.inkSoft }}>شكراً لطلبكم من سوق الجيران 🌿</p>
        </div>
        <div className="no-print flex gap-2 p-4" style={{ borderTop: `1px solid ${C.line}` }}><button onClick={onClose} className="flex-1 py-2.5 rounded-xl font-bold text-sm" style={{ border: `1px solid ${C.line}`, color: C.inkSoft }}>إغلاق</button><button onClick={() => window.print()} className="flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5" style={{ background: C.teal, color: "#fff" }}><Printer size={15} /> طباعة / تصدير</button></div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   استيراد المنتجات (CSV)
--------------------------------------------------------- */
function BulkImportModal({ onConfirm, onClose }) {
  const [rows, setRows] = useState([]); const [fileName, setFileName] = useState(""); const [error, setError] = useState("");
  function downloadTemplate() {
    const csv = "الاسم,السعر,الوحدة,القسم\nحليب طازج 1ل,90,العلبة,dairy\nخبز تقليدي,25,الوحدة,bakery\nطماطم,80,الكيلوغرام,veggies\n";
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "نموذج_منتجات.csv"; a.click(); URL.revokeObjectURL(url);
  }
  function handleFile(e) {
    const file = e.target.files[0]; if (!file) return;
    setFileName(file.name); setError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = Papa.parse(String(ev.target.result), { header: true, skipEmptyLines: true });
      const cleaned = parsed.data.map((r, i) => ({ id: "tmp" + i, name: (r["الاسم"] || r["name"] || "").trim(), price: Number(r["السعر"] || r["price"] || 0), unit: (r["الوحدة"] || r["unit"] || "الوحدة").trim(), department: DEPARTMENTS.some((d) => d.id === (r["القسم"] || r["department"])) ? (r["القسم"] || r["department"]) : "pantry" })).filter((r) => r.name && r.price > 0);
      if (cleaned.length === 0) setError("لم يتم العثور على صفوف صالحة.");
      setRows(cleaned);
    };
    reader.readAsText(file, "UTF-8");
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(35,32,27,0.5)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl p-5 max-h-[85vh] overflow-y-auto" style={{ background: C.paper }}>
        <div className="flex items-center justify-between mb-3"><h3 className="font-black flex items-center gap-1.5" style={{ fontFamily: "'Reem Kufi', sans-serif", color: C.ink }}><Upload size={16} color={C.teal} /> استيراد المنتجات</h3><button onClick={onClose}><X size={18} color={C.inkSoft} /></button></div>
        <button onClick={downloadTemplate} className="w-full mb-3 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5" style={{ border: `1px solid ${C.line}`, color: C.teal }}><Download size={15} /> تنزيل نموذج تجريبي (CSV)</button>
        <label className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl font-bold text-sm cursor-pointer" style={{ background: "#fff", border: `1.5px dashed ${C.line}`, color: C.inkSoft }}><FileText size={16} /> {fileName || "اختر ملف CSV"}<input type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" /></label>
        {error && <p className="text-xs mt-2 font-bold" style={{ color: "#8B3A2A" }}>{error}</p>}
        {rows.length > 0 && (<><p className="text-xs font-bold mt-4 mb-2" style={{ color: C.ink }}>معاينة ({rows.length} منتج):</p><div className="rounded-xl overflow-hidden mb-4" style={{ border: `1px solid ${C.line}` }}><table className="w-full text-xs"><thead><tr style={{ background: C.paperDark }}><th className="text-right p-2 font-bold" style={{ color: C.inkSoft }}>الاسم</th><th className="text-center p-2 font-bold" style={{ color: C.inkSoft }}>السعر</th><th className="text-center p-2 font-bold" style={{ color: C.inkSoft }}>الوحدة</th><th className="text-center p-2 font-bold" style={{ color: C.inkSoft }}>القسم</th></tr></thead><tbody>{rows.map((r) => (<tr key={r.id} style={{ borderTop: `1px solid ${C.line}`, background: "#fff" }}><td className="p-2" style={{ color: C.ink }}>{r.name}</td><td className="p-2 text-center" style={{ color: C.ink }}>{money(r.price)}</td><td className="p-2 text-center" style={{ color: C.inkSoft }}>{r.unit}</td><td className="p-2 text-center" style={{ color: C.inkSoft }}>{deptInfo(r.department).label}</td></tr>))}</tbody></table></div><button onClick={() => onConfirm(rows)} className="w-full py-3 rounded-xl font-black" style={{ background: C.rust, color: "#fff" }}>تأكيد إضافة {rows.length} منتج</button></>)}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   تسجيل موصّل — مواقيت، نطاق تغطية، اختيار المحلات
--------------------------------------------------------- */
function CourierRegisterModal({ stores, onSubmit, onClose }) {
  const [form, setForm] = useState({ name: "", contact: "", phone: "", password: "", mockOtpCode: "", vehicle: VEHICLES[0], wilaya: "", commune: "", communes: [], availability: [], useCustomHours: false, hoursFrom: "08:00", hoursTo: "18:00", storeMode: "all", selectedStoreIds: [] });
  const [step, setStep] = useState(1);
  const [authError, setAuthError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function toggleCommune(c) { setForm((f) => ({ ...f, communes: f.communes.includes(c) ? f.communes.filter((x) => x !== c) : [...f.communes, c] })); }
  function toggleSlot(id) { setForm((f) => ({ ...f, availability: f.availability.includes(id) ? f.availability.filter((x) => x !== id) : [...f.availability, id] })); }
  function toggleStore(id) { setForm((f) => ({ ...f, selectedStoreIds: f.selectedStoreIds.includes(id) ? f.selectedStoreIds.filter((x) => x !== id) : [...f.selectedStoreIds, id] })); }

  const wilayaStores = stores.filter((s) => s.status === "approved" && s.wilaya === form.wilaya);

  const timeLabel = form.useCustomHours
    ? `من ${form.hoursFrom} إلى ${form.hoursTo}`
    : form.availability.map((a) => AVAILABILITY_SLOTS.find((s) => s.id === a)?.label).join(" / ") || "—";
  const coverageLabel = form.communes.length > 0
    ? form.communes.join("، ")
    : form.wilaya ? "كل بلديات وأحياء الولاية" : "—";
  const contactIdentity = parseLoginIdentifier(form.contact);
  const usesPhoneIdentity = contactIdentity?.kind === "phone";

  async function submit() {
    if (!form.name || !form.wilaya) return;
    if (!contactIdentity) { setAuthError("أدخل بريداً إلكترونياً صالحاً أو رقم هاتف جزائرياً يبدأ بـ 05 أو 06 أو 07."); setStep(1); return; }
    const operationalPhone = contactIdentity.phone || normalizeAlgerianMobile(form.phone);
    if (!operationalPhone) { setAuthError("أدخل رقم هاتف محمول جزائرياً للتواصل يبدأ بـ 05 أو 06 أو 07."); setStep(1); return; }
    if (form.password.length < 6) { setAuthError("كلمة المرور يجب أن تكون 6 أحرف على الأقل"); setStep(1); return; }
    if (usesPhoneIdentity && form.mockOtpCode !== "123456") { setAuthError("أدخل رمز OTP التجريبي 123456 لتأكيد رقم الهاتف."); setStep(1); return; }
    setAuthError("");
    setIsSubmitting(true);
    const result = await onSubmit({ ...form, phone: operationalPhone, phoneMockVerified: usesPhoneIdentity, coverageLabel, timeLabel });
    setIsSubmitting(false);
    if (result?.error) { setAuthError(result.error); setStep(1); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(35,32,27,0.5)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl p-5 space-y-4 max-h-[88vh] overflow-y-auto" style={{ background: C.paper }}>
        <div className="flex items-center justify-between"><h3 className="font-black flex items-center gap-1.5" style={{ fontFamily: "'Reem Kufi', sans-serif", color: C.ink }}><Bike size={17} color={C.teal} /> انضم كموصل — إعدادات التسجيل</h3><button onClick={onClose}><X size={18} color={C.inkSoft} /></button></div>
        <div className="flex gap-2 p-1 rounded-2xl" style={{ background: C.paperDark, border: `1px solid ${C.line}` }}>
          <button onClick={() => setStep(1)} className="flex-1 px-3 py-2 rounded-xl text-xs font-bold" style={{ background: step === 1 ? C.teal : "transparent", color: step === 1 ? "#fff" : C.inkSoft }}>1. البيانات الأساسية</button>
          <button onClick={() => setStep(2)} className="flex-1 px-3 py-2 rounded-xl text-xs font-bold" style={{ background: step === 2 ? C.teal : "transparent", color: step === 2 ? "#fff" : C.inkSoft }}>2. التواقيت والنطاق</button>
        </div>

        {step === 1 && (
          <div className="space-y-3">
            <input placeholder="الاسم الكامل" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} />
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ border: `1px solid ${C.line}` }}><Phone size={15} color={C.inkSoft} /><input data-testid="courier-identifier-input" placeholder="رقم الهاتف أو البريد الإلكتروني" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value, mockOtpCode: "" })} className="flex-1 outline-none text-sm bg-transparent" dir="ltr" inputMode={form.contact.includes("@") ? "email" : "tel"} /></div>
            {!usesPhoneIdentity && <input placeholder="رقم الهاتف للتواصل (05/06/07)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} inputMode="tel" />}
            {usesPhoneIdentity && <div className="p-3 rounded-xl space-y-2" style={{ background: C.ochre + "12", border: `1px solid ${C.ochre}44` }}><p className="text-[11px] font-bold" style={{ color: C.ink }}>تأكيد الهاتف في وضع OTP التجريبي. الرمز: 123456</p><input aria-label="رمز OTP التجريبي للموصل" value={form.mockOtpCode} onChange={(e) => setForm({ ...form, mockOtpCode: e.target.value.replace(/\D/g, "").slice(0, 6) })} placeholder="رمز OTP التجريبي" inputMode="numeric" className="w-full px-3 py-2 rounded-lg text-sm outline-none bg-white" style={{ border: `1px solid ${C.line}` }} /></div>}
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ border: `1px solid ${C.line}` }}><Lock size={15} color={C.inkSoft} /><input type="password" placeholder="كلمة المرور (4 أحرف على الأقل)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="flex-1 outline-none text-sm bg-transparent" dir="ltr" /></div>
            <select value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }}>{VEHICLES.map((v) => <option key={v} value={v}>{v}</option>)}</select>
            {authError && <p className="text-xs font-bold" style={{ color: "#8B3A2A" }}>{authError}</p>}
            <button onClick={() => setStep(2)} disabled={!form.name || !contactIdentity} className="w-full py-3 rounded-xl font-black disabled:opacity-40" style={{ background: C.teal, color: "#fff" }}>التالي: التواقيت ونطاق التغطية</button>
            <p className="text-[10px] text-center" style={{ color: C.inkSoft }}>يمكنك الدخول برقم الهاتف أو البريد الإلكتروني؛ يستمر OTP التجريبي حتى تهيئة مزود رسائل فعلي.</p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <span className="text-xs font-bold flex items-center gap-1 mb-1.5" style={{ color: C.ink }}><Clock size={13} /> أوقات العمل المتاحة</span>
              <div className="flex gap-2 mb-2">{AVAILABILITY_SLOTS.map((s) => (<button key={s.id} onClick={() => toggleSlot(s.id)} className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-xs font-bold" style={{ background: form.availability.includes(s.id) ? C.teal : "#fff", color: form.availability.includes(s.id) ? "#fff" : C.inkSoft, border: `1px solid ${form.availability.includes(s.id) ? C.teal : C.line}` }}><s.icon size={15} /> {s.label}</button>))}</div>
              <label className="flex items-center gap-1.5 text-xs" style={{ color: C.inkSoft }}><input type="checkbox" checked={form.useCustomHours} onChange={(e) => setForm({ ...form, useCustomHours: e.target.checked, availability: e.target.checked ? [] : form.availability })} /> أو تحديد ساعات محددة</label>
              {form.useCustomHours && (<div className="flex gap-2 mt-2"><input type="time" value={form.hoursFrom} onChange={(e) => setForm({ ...form, hoursFrom: e.target.value })} className="flex-1 px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} /><input type="time" value={form.hoursTo} onChange={(e) => setForm({ ...form, hoursTo: e.target.value })} className="flex-1 px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} /></div>)}
            </div>

            <div>
              <span className="text-xs font-bold flex items-center gap-1 mb-1.5" style={{ color: C.ink }}><MapPin size={13} /> نطاق التغطية</span>
              <div className="flex gap-2">
                <select value={form.wilaya} onChange={(e) => setForm({ ...form, wilaya: e.target.value, commune: "", communes: [] })} className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }}>
                  <option value="" disabled>اختر الولاية</option>
                  {WILAYAS.map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
                <select value={form.commune} onChange={(e) => setForm({ ...form, commune: e.target.value })} disabled={!form.wilaya} className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none disabled:opacity-50" style={{ border: `1px solid ${C.line}` }}>
                  <option value="">البلدية الرئيسية</option>
                  {getCommunes(form.wilaya).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <p className="text-[11px] mt-2 mb-1" style={{ color: C.inkSoft }}>اختر البلديات والأحياء والتجمعات السكانية التي يمكنك التوصيل إليها (تعدد الاختيارات):</p>
              <div className="flex flex-wrap gap-1.5">{getCommunes(form.wilaya).map((c) => (<button key={c} onClick={() => toggleCommune(c)} className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: form.communes.includes(c) ? C.teal : "transparent", color: form.communes.includes(c) ? "#fff" : C.inkSoft, border: `1px solid ${form.communes.includes(c) ? C.teal : C.line}` }}>{c}</button>))}</div>
            </div>

            <div>
              <span className="text-xs font-bold flex items-center gap-1 mb-1.5" style={{ color: C.ink }}><Store size={13} /> المحلات التي تتعامل معها</span>
              <div className="flex gap-2 mb-2">
                <button onClick={() => setForm({ ...form, storeMode: "all" })} className="flex-1 py-2 rounded-xl text-xs font-bold" style={{ background: form.storeMode === "all" ? C.teal : "transparent", color: form.storeMode === "all" ? "#fff" : C.inkSoft, border: `1px solid ${form.storeMode === "all" ? C.teal : C.line}` }}>كل محلات المنطقة</button>
                <button onClick={() => setForm({ ...form, storeMode: "selected" })} className="flex-1 py-2 rounded-xl text-xs font-bold" style={{ background: form.storeMode === "selected" ? C.teal : "transparent", color: form.storeMode === "selected" ? "#fff" : C.inkSoft, border: `1px solid ${form.storeMode === "selected" ? C.teal : C.line}` }}>تحديد محلات معينة</button>
              </div>
              {form.storeMode === "selected" && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {!form.wilaya && <p className="text-xs" style={{ color: C.inkSoft }}>اختر الولاية أولاً لعرض محلاتها.</p>}
                  {form.wilaya && wilayaStores.length === 0 && <p className="text-xs" style={{ color: C.inkSoft }}>لا محلات مفعّلة في هذه الولاية بعد.</p>}
                  {wilayaStores.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 p-2 rounded-lg text-xs" style={{ border: `1px solid ${C.line}`, background: "#fff" }}>
                      <input type="checkbox" checked={form.selectedStoreIds.includes(s.id)} onChange={() => toggleStore(s.id)} />
                      <StoreAvatar logo={s.logo} size={22} /> {s.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="p-3.5 rounded-xl space-y-1" style={{ background: C.teal + "12", border: `1px solid ${C.teal}40` }}>
          <p className="text-[11px] font-bold flex items-center gap-1" style={{ color: C.teal }}><CheckCircle2 size={12} /> معاينة إعداداتك</p>
          <p className="text-[11px]" style={{ color: C.inkSoft }}>التواقيت: <b style={{ color: C.ink }}>{timeLabel}</b></p>
          <p className="text-[11px]" style={{ color: C.inkSoft }}>نطاق التغطية: <b style={{ color: C.ink }}>{form.wilaya} — {coverageLabel}</b></p>
          <p className="text-[11px]" style={{ color: C.inkSoft }}>المحلات: <b style={{ color: C.ink }}>{form.storeMode === "all" ? "التوصيل لجميع محلات المنطقة" : `${form.selectedStoreIds.length} محل محدد`}</b></p>
          <p className="text-[11px]" style={{ color: C.inkSoft }}>الدخول لاحقًا: <b dir="ltr" style={{ color: C.ink }}>{form.contact || "—"}</b></p>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl font-bold text-sm" style={{ background: "transparent", color: C.inkSoft, border: `1px solid ${C.line}` }}>رجوع</button>
          <button disabled={isSubmitting} onClick={submit} className="flex-1 py-3 rounded-xl font-black disabled:opacity-50" style={{ background: C.rust, color: "#fff" }}>{isSubmitting ? "جارٍ إنشاء الحساب..." : "إرسال طلب الانضمام"}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   تسجيل تاجر — بيانات الحساب ثم بيانات المحل ونطاق التوصيل
--------------------------------------------------------- */
function MerchantRegisterModal({ onSubmit, onClose }) {
  const [form, setForm] = useState({ ownerName: "", contact: "", phone: "", password: "", mockOtpCode: "", storeName: "", wilaya: "", commune: "", deliveryCommunes: [] });
  const [step, setStep] = useState(1);
  const [authError, setAuthError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const contactIdentity = parseLoginIdentifier(form.contact);
  const usesPhoneIdentity = contactIdentity?.kind === "phone";

  function toggleDeliveryCommune(commune) {
    setForm((current) => ({ ...current, deliveryCommunes: current.deliveryCommunes.includes(commune) ? current.deliveryCommunes.filter((item) => item !== commune) : [...current.deliveryCommunes, commune] }));
  }

  async function submit() {
    if (!form.storeName || !form.wilaya) { setAuthError("أكمل اسم المحل والولاية قبل إرسال الطلب."); setStep(2); return; }
    if (!form.ownerName || !contactIdentity) { setAuthError("أدخل اسم صاحب المحل وبريداً إلكترونياً صالحاً أو رقم هاتف جزائرياً صحيحاً."); setStep(1); return; }
    const operationalPhone = contactIdentity.phone || normalizeAlgerianMobile(form.phone);
    if (!operationalPhone) { setAuthError("أدخل رقم هاتف محمول جزائرياً للتواصل يبدأ بـ 05 أو 06 أو 07."); setStep(1); return; }
    if (form.password.length < 6) { setAuthError("كلمة المرور يجب أن تكون 6 أحرف على الأقل."); setStep(1); return; }
    if (usesPhoneIdentity && form.mockOtpCode !== "123456") { setAuthError("أدخل رمز OTP التجريبي 123456 لتأكيد رقم الهاتف."); setStep(1); return; }
    setAuthError("");
    setIsSubmitting(true);
    const result = await onSubmit({ ...form, name: form.storeName, phone: operationalPhone, phoneMockVerified: usesPhoneIdentity });
    setIsSubmitting(false);
    if (result?.error) { setAuthError(result.error); setStep(1); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(35,32,27,0.5)" }} onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-2xl p-5 space-y-4 max-h-[88vh] overflow-y-auto" style={{ background: C.paper }}>
        <div className="flex items-center justify-between"><h3 className="font-black flex items-center gap-1.5" style={{ fontFamily: "'Reem Kufi', sans-serif", color: C.ink }}><Store size={17} color={C.rust} /> انضم كتاجر — إعدادات التسجيل</h3><button onClick={onClose} aria-label="إغلاق"><X size={18} color={C.inkSoft} /></button></div>
        <div className="flex gap-2 p-1 rounded-2xl" style={{ background: C.paperDark, border: `1px solid ${C.line}` }}>
          <button onClick={() => setStep(1)} className="flex-1 px-3 py-2 rounded-xl text-xs font-bold" style={{ background: step === 1 ? C.rust : "transparent", color: step === 1 ? "#fff" : C.inkSoft }}>1. بيانات الحساب</button>
          <button onClick={() => setStep(2)} className="flex-1 px-3 py-2 rounded-xl text-xs font-bold" style={{ background: step === 2 ? C.rust : "transparent", color: step === 2 ? "#fff" : C.inkSoft }}>2. بيانات المحل</button>
        </div>
        {step === 1 && <div className="space-y-3">
          <input aria-label="اسم صاحب المحل" placeholder="اسم صاحب المحل" value={form.ownerName} onChange={(event) => setForm({ ...form, ownerName: event.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} />
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ border: `1px solid ${C.line}` }}><Phone size={15} color={C.inkSoft} /><input data-testid="merchant-identifier-input" placeholder="رقم الهاتف أو البريد الإلكتروني" value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value, mockOtpCode: "" })} className="flex-1 outline-none text-sm bg-transparent" dir="ltr" inputMode={form.contact.includes("@") ? "email" : "tel"} /></div>
          {!usesPhoneIdentity && <input aria-label="هاتف التواصل للتاجر" placeholder="رقم الهاتف للتواصل (05/06/07)" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} inputMode="tel" />}
          {usesPhoneIdentity && <div className="p-3 rounded-xl space-y-2" style={{ background: C.ochre + "12", border: `1px solid ${C.ochre}44` }}><p className="text-[11px] font-bold" style={{ color: C.ink }}>تأكيد الهاتف في وضع OTP التجريبي. الرمز: 123456</p><input aria-label="رمز OTP التجريبي للتاجر" value={form.mockOtpCode} onChange={(event) => setForm({ ...form, mockOtpCode: event.target.value.replace(/\D/g, "").slice(0, 6) })} placeholder="رمز OTP التجريبي" inputMode="numeric" className="w-full px-3 py-2 rounded-lg text-sm outline-none bg-white" style={{ border: `1px solid ${C.line}` }} /></div>}
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ border: `1px solid ${C.line}` }}><Lock size={15} color={C.inkSoft} /><input type="password" placeholder="كلمة المرور (6 أحرف على الأقل)" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="flex-1 outline-none text-sm bg-transparent" dir="ltr" /></div>
          {authError && <p className="text-xs font-bold" style={{ color: "#8B3A2A" }}>{authError}</p>}
          <button onClick={() => setStep(2)} disabled={!form.ownerName || !contactIdentity} className="w-full py-3 rounded-xl font-black disabled:opacity-40" style={{ background: C.rust, color: "#fff" }}>التالي: بيانات المحل</button>
        </div>}
        {step === 2 && <div className="space-y-4">
          <div><label className="text-xs font-bold flex items-center gap-1 mb-1.5" style={{ color: C.ink }}><Store size={13} /> بيانات المحل</label><input aria-label="اسم المحل" placeholder="اسم المحل" value={form.storeName} onChange={(event) => setForm({ ...form, storeName: event.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} /></div>
          <div><label className="text-xs font-bold flex items-center gap-1 mb-1.5" style={{ color: C.ink }}><MapPin size={13} /> موقع المحل ونطاق التوصيل</label><div className="flex gap-2"><select value={form.wilaya} onChange={(event) => setForm({ ...form, wilaya: event.target.value, commune: "", deliveryCommunes: [] })} className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }}><option value="" disabled>اختر الولاية</option>{WILAYAS.map((wilaya) => <option key={wilaya} value={wilaya}>{wilaya}</option>)}</select><select value={form.commune} onChange={(event) => setForm({ ...form, commune: event.target.value })} disabled={!form.wilaya} className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none disabled:opacity-50" style={{ border: `1px solid ${C.line}` }}><option value="">بلدية المحل</option>{getCommunes(form.wilaya).map((commune) => <option key={commune} value={commune}>{commune}</option>)}</select></div></div>
          {form.wilaya && <div><p className="text-[11px] mb-2" style={{ color: C.inkSoft }}>حدد البلديات الإضافية التي يغطيها توصيل محلك، أو اتركها فارغة لخدمة بلدية المحل فقط.</p><div className="flex flex-wrap gap-1.5">{getCommunes(form.wilaya).map((commune) => <button key={commune} type="button" onClick={() => toggleDeliveryCommune(commune)} className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: form.deliveryCommunes.includes(commune) ? C.rust : "transparent", color: form.deliveryCommunes.includes(commune) ? "#fff" : C.inkSoft, border: `1px solid ${form.deliveryCommunes.includes(commune) ? C.rust : C.line}` }}>{commune}</button>)}</div></div>}
          <div className="p-3.5 rounded-xl space-y-1" style={{ background: C.rust + "12", border: `1px solid ${C.rust}35` }}><p className="text-[11px] font-bold" style={{ color: C.rust }}>معاينة طلب الانضمام</p><p className="text-[11px]" style={{ color: C.inkSoft }}>المحل: <b style={{ color: C.ink }}>{form.storeName || "—"}</b></p><p className="text-[11px]" style={{ color: C.inkSoft }}>الموقع: <b style={{ color: C.ink }}>{form.wilaya || "—"}{form.commune ? ` — ${form.commune}` : ""}</b></p><p className="text-[11px]" style={{ color: C.inkSoft }}>الدخول لاحقاً: <b dir="ltr" style={{ color: C.ink }}>{form.contact || "—"}</b></p></div>
        </div>}
        <div className="flex gap-2"><button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl font-bold text-sm" style={{ background: "transparent", color: C.inkSoft, border: `1px solid ${C.line}` }}>رجوع</button><button disabled={isSubmitting} onClick={submit} className="flex-1 py-3 rounded-xl font-black disabled:opacity-50" style={{ background: C.rust, color: "#fff" }}>{isSubmitting ? "جارٍ إنشاء الحساب..." : "إرسال طلب انضمام المحل"}</button></div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   استعادة الحساب / تغيير رقم الهاتف
--------------------------------------------------------- */
function PhoneChangeModal({ currentPhone, onRequest, onConfirm, onClose }) {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [phoneVerification, setPhoneVerification] = useState(null);
  const [phoneChallenge, setPhoneChallenge] = useState(null);
  const [requested, setRequested] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const normalizedPhone = normalizeAlgerianMobile(phone);

  async function requestCode() {
    if (!normalizedPhone) { setError("أدخل رقم هاتف محمول جزائرياً يبدأ بـ 05 أو 06 أو 07."); return; }
    setError(""); setFeedback(""); setIsSubmitting(true);
    try {
      const result = await onRequest(normalizedPhone);
      if (result?.error) { setError(result.error); return; }
      const verification = await beginFirebasePhoneVerification(normalizedPhone, "firebase-phone-change-recaptcha");
      setPhoneVerification(verification);
      setPhoneChallenge(result?.challenge || null);
      setOtp("");
      setRequested(true);
      setFeedback(verification.platform === "native" && verification.completedUser
        ? "تم التحقق من رقم الهاتف تلقائياً بواسطة Firebase. أكد حفظ الرقم الجديد."
        : "أُرسل رمز التحقق عبر رسالة SMS من Firebase. أدخله لتأكيد الرقم الجديد.");
    } catch (requestError) {
      setError(requestError?.message || "تعذر إرسال رمز Firebase. تحقق من إعداد Phone Authentication وحاول مجدداً.");
    } finally { setIsSubmitting(false); }
  }

  async function confirmChange() {
    if (!normalizedPhone || !phoneVerification || !phoneChallenge) { setError("أرسل رمز Firebase أولاً ثم أكمل التحقق."); return; }
    setError(""); setIsSubmitting(true);
    try {
      const verification = phoneVerification.platform === "native" && phoneVerification.completedUser
        ? phoneVerification
        : await completeFirebasePhoneVerification(phoneVerification, otp);
      const result = await onConfirm({ phone: normalizedPhone, firebasePhoneVerification: verification, challenge: phoneChallenge });
      if (result?.error) { setError(result.error); return; }
      onClose();
    } catch (verificationError) {
      setError(verificationError?.message || "رمز Firebase غير صحيح أو انتهت صلاحيته. أعد طلب رمز جديد.");
    } finally { setIsSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(35,32,27,0.55)" }} onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-2xl p-5 space-y-3" style={{ background: C.paper }}>
        <div className="flex items-center justify-between gap-3"><div><h3 className="font-black flex items-center gap-1.5" style={{ color: C.ink }}><Phone size={18} color={C.teal} /> تغيير رقم الهاتف</h3><p className="text-[11px] mt-1" style={{ color: C.inkSoft }}>رقمك الحالي: <span dir="ltr">{currentPhone || "غير مضاف"}</span></p></div><button onClick={onClose} aria-label="إغلاق"><X size={18} color={C.inkSoft} /></button></div>
        <p className="text-xs leading-5 p-3 rounded-xl" style={{ background: C.ochre + "12", color: C.ink, border: `1px solid ${C.ochre}42` }}>ستتحقق من الرقم الجديد عبر رسالة SMS من Firebase قبل حفظه في ملفك.</p>
        <div id="firebase-phone-change-recaptcha" aria-hidden="true" />
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white" style={{ border: `1px solid ${C.line}` }}><Phone size={15} color={C.inkSoft} /><input aria-label="رقم الهاتف الجديد" placeholder="0551234567 أو +213551234567" value={phone} onChange={(event) => { setPhone(event.target.value); setRequested(false); setPhoneVerification(null); setOtp(""); }} className="flex-1 outline-none text-sm bg-transparent" dir="ltr" inputMode="tel" /></div>
        {!requested ? <button disabled={isSubmitting} onClick={requestCode} className="w-full py-3 rounded-xl font-black text-sm disabled:opacity-50" style={{ background: C.teal, color: "#fff" }}>{isSubmitting ? "جارٍ إرسال الرمز..." : "إرسال رمز Firebase"}</button> : <><input aria-label="رمز تأكيد تغيير الهاتف" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="رمز التحقق عبر SMS" inputMode="numeric" disabled={phoneVerification?.platform === "native" && phoneVerification?.completedUser} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none bg-white disabled:opacity-50" style={{ border: `1px solid ${C.line}` }} /><button disabled={isSubmitting} onClick={confirmChange} className="w-full py-3 rounded-xl font-black text-sm disabled:opacity-50" style={{ background: C.rust, color: "#fff" }}>{isSubmitting ? "جارٍ حفظ الرقم..." : "تأكيد الرقم الجديد"}</button></>}
        {feedback && <p className="text-xs font-bold" style={{ color: C.sage }}>{feedback}</p>}
        {error && <p className="text-xs font-bold" style={{ color: "#8B3A2A" }}>{error}</p>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   شاشة تسجيل الدخول / إنشاء حساب / استعادة حساب
--------------------------------------------------------- */
function AuthModal({ authenticate, requestAccountRecovery, onClose, adminOnly = false, initialType = "merchant", initialMode = "login", lockRole = true, allowRegistration = initialType === "customer" }) {
  const [mode, setMode] = useState(adminOnly ? "login" : initialMode);
  const [type, setType] = useState(adminOnly ? "admin" : initialType);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [phoneVerification, setPhoneVerification] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const phoneRequestInFlightRef = useRef(false);
  const parsedIdentifier = parseLoginIdentifier(identifier);
  const phoneOtpRequired = !adminOnly && parsedIdentifier?.kind === "phone";
  const waitingForPhoneCode = Boolean(phoneVerification);
  const phoneAutoVerified = Boolean(phoneVerification?.platform === "native" && phoneVerification?.completedUser);

  function resetPhoneVerification() {
    clearFirebasePhoneVerification("firebase-phone-recaptcha");
    setOtpCode("");
    setPhoneVerification(null);
  }

  function closeAuthModal() {
    resetPhoneVerification();
    onClose();
  }

  useEffect(() => () => clearFirebasePhoneVerification("firebase-phone-recaptcha"), []);

  async function requestPhoneCode() {
    if (!parsedIdentifier?.phone) return;
    if (phoneRequestInFlightRef.current) return;
    phoneRequestInFlightRef.current = true;
    setError("");
    setNotice("");
    setIsSubmitting(true);
    try {
      resetPhoneVerification();
      const verification = await beginFirebasePhoneVerification(parsedIdentifier.phone, "firebase-phone-recaptcha");
      setPhoneVerification(verification);
      setOtpCode("");
      setNotice(verification.platform === "native" && verification.completedUser
        ? "تم التحقق من رقم الهاتف تلقائياً بواسطة Firebase. تابع لإكمال العملية."
        : "أُرسل رمز التحقق عبر رسالة SMS. أدخله لإكمال العملية.");
    } catch (requestError) {
      setError(requestError?.message || "تعذر إرسال رمز Firebase. تحقق من إعداد Phone Authentication وحاول مجدداً.");
    } finally {
      phoneRequestInFlightRef.current = false;
      setIsSubmitting(false);
    }
  }

  async function submit() {
    if (!parsedIdentifier) { setError("أدخل بريداً إلكترونياً صالحاً أو رقم هاتف جزائرياً يبدأ بـ 05 أو 06 أو 07."); return; }
    if (mode !== "recover" && password.length < 6) { setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل"); return; }
    if (phoneOtpRequired && !waitingForPhoneCode) { await requestPhoneCode(); return; }
    if (phoneOtpRequired && !phoneAutoVerified && otpCode.length !== 6) { setError("أدخل رمز SMS المكوّن من ستة أرقام."); return; }
    setError(""); setNotice("");
    setIsSubmitting(true);
    let result;
    try {
      const firebasePhoneVerification = phoneOtpRequired
        ? await completeFirebasePhoneVerification(phoneVerification, otpCode)
        : null;
      result = mode === "recover"
        ? await requestAccountRecovery({ identifier: parsedIdentifier.value, firebasePhoneVerification })
        : await authenticate({ mode, type, identifier: parsedIdentifier.value, password, firebasePhoneVerification });
    } catch (submissionError) {
      result = { error: submissionError?.message || "تعذر إكمال العملية. حاول مرة أخرى." };
    } finally {
      setIsSubmitting(false);
    }
    if (result?.error) { setError(result.error); return; }
    if (result?.notice) { setNotice(result.notice); return; }
    closeAuthModal();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(35,32,27,0.55)" }} onClick={closeAuthModal}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl p-5 space-y-3" style={{ background: C.paper }}>
        <div className="flex items-center justify-between"><h3 className="font-black text-lg flex items-center gap-1.5" style={{ fontFamily: "'Reem Kufi', sans-serif", color: C.ink }}>{mode === "login" ? <LogIn size={18} color={C.teal} /> : <UserPlus size={18} color={C.teal} />} {type === "merchant" ? "منصة التاجر" : type === "courier" ? "لوحة الموصل" : type === "customer" ? "حساب العميل" : "لوحة الإدارة"}</h3><button onClick={closeAuthModal}><X size={18} color={C.inkSoft} /></button></div>
        {!adminOnly && <>{!lockRole && <div className="flex gap-2 p-1 rounded-2xl" style={{ background: C.paperDark, border: `1px solid ${C.line}` }}>
          <button onClick={() => setType("merchant")} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold" style={{ background: type === "merchant" ? C.teal : "transparent", color: type === "merchant" ? "#fff" : C.inkSoft }}><Store size={15} /> تاجر</button>
          <button onClick={() => setType("courier")} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold" style={{ background: type === "courier" ? C.teal : "transparent", color: type === "courier" ? "#fff" : C.inkSoft }}><Bike size={15} /> موصّل</button>
          <button onClick={() => setType("customer")} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold" style={{ background: type === "customer" ? C.teal : "transparent", color: type === "customer" ? "#fff" : C.inkSoft }}><User size={15} /> عميل</button>
        </div>}
        <div className="flex gap-2 p-1 rounded-2xl" style={{ background: C.paperDark, border: `1px solid ${C.line}` }}>
          <button onClick={() => { resetPhoneVerification(); setMode("login"); setError(""); setNotice(""); }} className="flex-1 px-3 py-2 rounded-xl text-xs font-bold" style={{ background: mode === "login" ? C.ink : "transparent", color: mode === "login" ? "#fff" : C.inkSoft }}>دخول</button>
          {allowRegistration && <button onClick={() => { resetPhoneVerification(); setMode("register"); setError(""); setNotice(""); }} className="flex-1 px-3 py-2 rounded-xl text-xs font-bold" style={{ background: mode === "register" ? C.ink : "transparent", color: mode === "register" ? "#fff" : C.inkSoft }}>حساب جديد</button>}
        </div></>}
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ border: `1px solid ${C.line}` }}><Phone size={15} color={C.inkSoft} /><input data-testid="auth-identifier-input" placeholder="رقم الهاتف أو البريد الإلكتروني" value={identifier} onChange={(e) => { resetPhoneVerification(); setIdentifier(e.target.value); }} className="flex-1 outline-none text-sm bg-transparent" dir="ltr" inputMode={identifier.includes("@") ? "email" : "tel"} /></div>
        <div id="firebase-phone-recaptcha" aria-hidden="true" />
        {phoneOtpRequired && <div data-testid="firebase-phone-otp" className="p-3 rounded-xl space-y-2" style={{ background: C.ochre + "12", border: `1px solid ${C.ochre}44` }}><p className="text-xs leading-5 font-bold" style={{ color: C.ink }}>تم التعرف على رقم الهاتف <span dir="ltr">{parsedIdentifier.phone}</span>. {phoneAutoVerified ? "تم التحقق منه تلقائياً؛ يمكنك المتابعة." : waitingForPhoneCode ? "أدخل رمز SMS الذي وصلك من Firebase." : "أرسل رمز SMS لتأكيد ملكية الرقم قبل المتابعة."}</p>{waitingForPhoneCode && !phoneAutoVerified && <><input aria-label="رمز SMS من Firebase" value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="رمز SMS المكوّن من 6 أرقام" inputMode="numeric" className="w-full px-3 py-2 rounded-lg text-sm outline-none bg-white" style={{ border: `1px solid ${C.line}` }} /><button type="button" disabled={isSubmitting} onClick={requestPhoneCode} className="text-xs font-bold" style={{ color: C.teal }}>إعادة إرسال رمز SMS</button></>}</div>}
        {mode !== "recover" && <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ border: `1px solid ${C.line}` }}><Lock size={15} color={C.inkSoft} /><input type="password" placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} className="flex-1 outline-none text-sm bg-transparent" dir="ltr" /></div>}
        {error && <p className="text-xs font-bold" style={{ color: "#8B3A2A" }}>{error}</p>}
        {notice && <p className="text-xs font-bold" style={{ color: C.sage }}>{notice}</p>}
        <button disabled={isSubmitting} onClick={submit} className="w-full py-3 rounded-xl font-black flex items-center justify-center gap-1.5 disabled:opacity-50" style={{ background: C.rust, color: "#fff" }}>{isSubmitting ? "جارٍ المعالجة..." : mode === "login" ? <><LogIn size={16} /> تسجيل الدخول</> : mode === "recover" ? <><Phone size={16} /> بدء الاستعادة</> : <><UserPlus size={16} /> إنشاء حساب</>}</button>
        {!adminOnly && <button onClick={() => { resetPhoneVerification(); setMode("recover"); setError(""); setNotice(""); }} className="w-full text-xs font-bold py-1" style={{ color: C.teal }}>هل نسيت كلمة المرور؟ ابدأ الاستعادة برقم الهاتف أو البريد</button>}
        {adminOnly && <p className="text-[10px] text-center" style={{ color: C.inkSoft }}>لا تتاح لوحة الإدارة إلا للحسابات المصرح لها في قاعدة البيانات.</p>}
        {!adminOnly && mode === "register" && <p className="text-[10px] text-center" style={{ color: C.inkSoft }}>{type === "merchant" ? "يمكنك البدء برقم الهاتف أو البريد، ثم تكمل بيانات محلك." : type === "courier" ? "يمكنك البدء برقم الهاتف أو البريد؛ بعد الموافقة تدخل لوحتك مباشرةً." : "يمكنك المتابعة برقم الهاتف أو البريد لإرسال الطلبات ومتابعتها بأمان."}</p>}
        {!adminOnly && mode === "recover" && <p className="text-[10px] text-center" style={{ color: C.inkSoft }}>تصل استعادة البريد إلى رابط إعادة التعيين، أما الهاتف فيُثبت برمز SMS من Firebase ثم يُسجَّل طلب استعادة آمن دون كشف وجود الحساب.</p>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   صندوق الرسائل — الإخفاء شخصي للتاجر/الموصل، والحذف نهائي للإدارة
--------------------------------------------------------- */
function MessagesInbox({ messages, orders, userId, admin = false, onArchiveMessage, onDeleteMessage }) {
  const orderById = Object.fromEntries((orders || []).map((order) => [order.id, order]));
  return (
    <div className="space-y-3">
      {messages.length === 0 && <p className="text-center text-sm py-10" style={{ color: C.inkSoft }}>لا توجد رسائل محفوظة في هذه القائمة.</p>}
      {messages.map((message) => {
        const order = orderById[message.orderId];
        const outgoing = message.senderId === userId;
        return (
          <div key={message.id} className="p-4 rounded-2xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
            <div className="flex items-center justify-between gap-3 mb-2"><span className="text-xs font-bold" style={{ color: C.teal }}>{order ? `طلب ${order.storeName}` : "رسالة مرتبطة بطلب"}</span><span className="text-[10px]" style={{ color: C.inkSoft }}>{message.createdAt}</span></div>
            <p className="text-sm" style={{ color: C.ink }}>{message.body}</p>
            <div className="mt-3 flex items-center justify-between gap-2"><span className="text-[11px]" style={{ color: C.inkSoft }}>{admin ? "الأرشيف الإداري" : outgoing ? "رسالة صادرة" : "رسالة واردة"}</span><button onClick={() => (admin ? onDeleteMessage(message.id) : onArchiveMessage(message.id))} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: "#8B3A2A18", color: "#8B3A2A" }}><Trash2 size={12} /> {admin ? "حذف نهائي" : "حذف من قائمتي"}</button></div>
          </div>
        );
      })}
    </div>
  );
}

function ReferralRewardsPanel({ referralCode, rewardCoupons, notify, claimReferralCode }) {
  const [claimCode, setClaimCode] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [showTerms, setShowTerms] = useState(false);
  const inviteLink = referralCode ? `${window.location.origin}${window.location.pathname}?ref=${encodeURIComponent(referralCode)}` : "";
  useEffect(() => {
    let active = true;
    if (!inviteLink) { setQrDataUrl(""); return undefined; }
    QRCode.toDataURL(inviteLink, { errorCorrectionLevel: "H", width: 600, margin: 2, color: { dark: C.ink, light: "#FFFFFF" } }).then((value) => { if (active) setQrDataUrl(value); }).catch(() => notify("تعذر إنشاء رمز الدعوة."));
    return () => { active = false; };
  }, [inviteLink, notify]);
  const available = rewardCoupons.filter((coupon) => coupon.status === "available");
  async function claim() { if (!claimCode.trim()) { notify("أدخل كود الدعوة أولاً."); return; } await claimReferralCode(claimCode.trim()); setClaimCode(""); }
  async function copyInvite() { try { await navigator.clipboard.writeText(inviteLink); notify("تم نسخ رابط دعوتك للمشاركة."); } catch { notify("استخدم زر WhatsApp أو امسح رمز QR للمشاركة."); } }
  return <section data-testid="customer-rewards-panel" className="space-y-4">
    <div className="p-4 rounded-2xl" style={{ background: C.teal + "10", border: `1px solid ${C.teal}33` }}><div className="flex items-start justify-between gap-3 flex-wrap"><div><h3 className="font-black text-lg" style={{ color: C.ink }}>دعوات ومكافآت الجيران</h3><p className="text-xs leading-5 mt-1" style={{ color: C.inkSoft }}>ادعُ صديقاً برابط خاص؛ تُمنح القسائم للطرفين عند تسوية أول طلب ناجح للصديق.</p></div><span className="px-3 py-1.5 rounded-full text-xs font-black" style={{ background: C.teal, color: "#fff" }}>مكافأة للطرفين</span></div>
      {referralCode ? <div className="grid sm:grid-cols-[150px_1fr] gap-4 items-center mt-4"><div className="bg-white p-2 rounded-xl mx-auto" style={{ border: `1px solid ${C.line}` }}>{qrDataUrl && <img src={qrDataUrl} alt="QR رابط دعوتك" className="w-32 h-32" />}</div><div><p className="text-xs font-bold" style={{ color: C.ink }}>كود دعوتك: <span dir="ltr" className="font-black">{referralCode}</span></p><input readOnly value={inviteLink} dir="ltr" className="w-full mt-2 px-3 py-2 rounded-xl text-xs bg-white outline-none" style={{ border: `1px solid ${C.line}`, color: C.inkSoft }} /><div className="flex flex-wrap gap-2 mt-2"><button onClick={copyInvite} className="px-3 py-2 rounded-xl text-xs font-bold" style={{ background: "#fff", color: C.teal, border: `1px solid ${C.teal}66` }}>نسخ الرابط</button><a href={`https://wa.me/?text=${encodeURIComponent(`انضم إلى سوق الجيران عبر رابط دعوتي: ${inviteLink}`)}`} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-xl text-xs font-bold" style={{ background: C.teal, color: "#fff" }}>مشاركة WhatsApp</a></div></div></div> : <p className="text-xs mt-3" style={{ color: C.inkSoft }}>يجري تجهيز كود دعوتك الآمن…</p>}</div>
    <div className="p-4 rounded-2xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}><h4 className="font-black text-sm" style={{ color: C.ink }}>لديك كود دعوة؟</h4><p className="text-xs mt-1" style={{ color: C.inkSoft }}>يمكن إدخاله قبل أول طلب غير ملغى فقط.</p><div className="flex gap-2 mt-3"><input value={claimCode} onChange={(event) => setClaimCode(event.target.value.toUpperCase())} placeholder="كود الدعوة" dir="ltr" className="flex-1 px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} /><button data-testid="claim-referral-code" onClick={claim} className="px-4 py-2 rounded-xl text-xs font-black" style={{ background: C.ochre, color: "#fff" }}>تفعيل الدعوة</button></div></div>
    <div className="p-4 rounded-2xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}><div className="flex items-center justify-between"><h4 className="font-black text-sm" style={{ color: C.ink }}>محفظة القسائم</h4><span className="text-xs font-bold" style={{ color: C.sage }}>{available.length} متاحة</span></div>{available.length ? <div className="space-y-2 mt-3">{available.map((coupon) => <div key={coupon.id} className="flex items-center justify-between gap-2 p-3 rounded-xl" style={{ background: C.paperDark }}><div><div className="text-xs font-black" style={{ color: C.ink }}>{money(coupon.amount)} خصم</div><div className="text-[11px]" style={{ color: C.inkSoft }}>الكود: <span dir="ltr">{coupon.code}</span> · حد أدنى {money(coupon.minimumOrderTotal)}</div></div><span className="text-[11px] font-bold" style={{ color: C.teal }}>استخدمه في السلة</span></div>)}</div> : <p className="text-xs py-4 text-center" style={{ color: C.inkSoft }}>لا توجد قسائم متاحة بعد. تكتمل المكافأة بعد تسوية أول طلب للصديق المدعو.</p>}</div>
    <div className="p-4 rounded-2xl" style={{ background: C.paperDark, border: `1px solid ${C.line}` }}><button type="button" onClick={() => setShowTerms((value) => !value)} className="w-full flex items-center justify-between text-right"><span className="font-black text-sm" style={{ color: C.ink }}>شروط برنامج الإحالة وحدود القسائم</span><span className="text-xs font-bold" style={{ color: C.teal }}>{showTerms ? "إخفاء" : "عرض"}</span></button>{showTerms && <div className="mt-3 text-xs leading-6 space-y-2" style={{ color: C.inkSoft }}><p>يُستخدم كود الدعوة مرة واحدة قبل أول طلب غير ملغى، ولا يرتبط بالحساب إلا بعد توثيق رقم الهاتف.</p><p>تُمنح القسائم للطرفين بعد تسوية أول طلب ناجح للصديق المدعو، ولا تُستبدل نقداً أو تُنقل بين الحسابات.</p><p>يظهر مبلغ الخصم والحد الأدنى وتاريخ الصلاحية على كل قسيمة. لا يمكن جمع قسيمتين في الطلب نفسه، وقد تُلغى القسيمة عند إساءة الاستخدام.</p></div>}</div>
  </section>;
}

/* ===========================================================
   CUSTOMER VIEW
=========================================================== */
function CustomerView({ stores, setStores, cart, setCart, orders, setOrders, couriers, placeOrder, notify, customerId, customerConfirmDelivery, quoteDelivery, confirmCustomerPhoneVerification, requestCustomerPhoneVerification, referralCode = "", rewardCoupons = [], claimReferralCode }) {
  const [tab, setTab] = useState("browse");
  const [browseMode, setBrowseMode] = useState("list");
  const [query, setQuery] = useState("");
  const [filterWilaya, setFilterWilaya] = useState("");
  const [filterCommune, setFilterCommune] = useState("");
  const [openStoreId, setOpenStoreId] = useState(null);
  const [activeDept, setActiveDept] = useState("all");
  const [showCart, setShowCart] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [reviewingOrder, setReviewingOrder] = useState(null);
  const [invoiceOrder, setInvoiceOrder] = useState(null);
  const [deliveryChoice, setDeliveryChoice] = useState("pickup");
  const [deliveryQuote, setDeliveryQuote] = useState(null);
  const [quoteError, setQuoteError] = useState("");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [mockPhone, setMockPhone] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpStatus, setOtpStatus] = useState("");
  const [rewardCouponInput, setRewardCouponInput] = useState("");
  const [appliedReward, setAppliedReward] = useState(null);

  const approvedStores = stores.filter((s) => ["approved", "active", "open"].includes(String(s.status || "approved").toLowerCase()));
  const visibleStores = useMemo(() => {
    const q = normalizeSearchText(query);
    return approvedStores.filter((s) => {
      if (filterWilaya && s.wilaya !== filterWilaya) return false;
      if (filterCommune && s.commune !== filterCommune) return false;
      if (!q) return true;
      const storeTerms = [s.name, s.commune, s.wilaya, s.description, s.category].map(normalizeSearchText);
      const productTerms = (s.products || []).flatMap((product) => [product.name, product.department, deptInfo(product.department).label]).map(normalizeSearchText);
      return [...storeTerms, ...productTerms].some((term) => term && (term.includes(q) || q.includes(term)));
    });
  }, [approvedStores, query, filterWilaya, filterCommune]);
  const curatedStores = useMemo(() => curateDiscoveryStores(visibleStores), [visibleStores]);
  const discoveryAreaLabel = filterCommune || filterWilaya || curatedStores[0]?.wilaya || "نطاقك الحالي";
  const publicCouriers = useMemo(() => {
    const localWilaya = filterWilaya || curatedStores[0]?.wilaya;
    const localCommune = filterCommune;
    return couriers.filter((courier) => {
      const status = String(courier.status || "").toLowerCase();
      if (!["approved", "active", "available"].includes(status)) return false;
      if (localWilaya && courier.wilaya !== localWilaya) return false;
      if (localCommune && !(courier.communes || []).includes(localCommune)) return false;
      return true;
    }).slice(0, MAX_DISCOVERY_COURIERS);
  }, [couriers, curatedStores, filterWilaya, filterCommune]);

  const openStore = stores.find((s) => s.id === openStoreId);
  const cartStore = stores.find((s) => s.id === cart.storeId);
  const cartCount = cart.items.reduce((a, i) => a + i.qty, 0);
  const cartSubtotal = cart.items.reduce((a, i) => a + i.qty * i.price, 0);
  const promoDiscountAmount = appliedPromo ? Math.round((cartSubtotal * appliedPromo.discount) / 100) : 0;
  const rewardDiscountAmount = appliedReward ? Math.min(Number(appliedReward.amount || 0), cartSubtotal) : 0;
  const discountAmount = promoDiscountAmount + rewardDiscountAmount;
  const deliveryFee = deliveryChoice === "store" ? (cartStore?.deliveryFee || 0) : deliveryChoice === "courier" ? Number(deliveryQuote?.fee || 0) : 0;
  const finalTotal = Math.max(0, cartSubtotal - discountAmount + deliveryFee);
  const belowMinOrder = cartStore && cartStore.minOrder && cartSubtotal < cartStore.minOrder;
  const isInterwilaya = Boolean(deliveryQuote?.isInterwilaya || (cart.address?.wilaya && cartStore?.wilaya && cart.address.wilaya !== cartStore.wilaya));
  const requiresPhoneVerification = deliveryChoice === "courier" && (finalTotal >= 10000 || isInterwilaya);

  // The customer chooses the platform delivery service, not a named courier.
  // Assignment occurs after the merchant marks the order ready, preserving courier privacy.
  const platformCourierEnabled = Boolean(cartStore && !cartStore.hasOwnDelivery);

  useEffect(() => {
    let cancelled = false;
    if (deliveryChoice !== "courier" || !cartStore?.id || !cart.address?.wilaya || !cart.address?.commune) {
      setDeliveryQuote(null); setQuoteError(""); setQuoteLoading(false); return undefined;
    }
    setQuoteLoading(true); setQuoteError("");
    quoteDelivery(cartStore.id, cart.address, cart.items.reduce((sum, item) => sum + item.qty, 0)).then((result) => {
      if (cancelled) return;
      if (!result?.ok) { setDeliveryQuote(null); setQuoteError(result?.message || "تعذر احتساب رسوم التوصيل."); }
      else setDeliveryQuote(result.quote);
      setQuoteLoading(false);
    });
    return () => { cancelled = true; };
  }, [deliveryChoice, cartStore?.id, cart.address?.wilaya, cart.address?.commune, cart.address?.label, cart.items, quoteDelivery]);

  useEffect(() => {
    if (otpCooldown <= 0) return undefined;
    const timer = window.setInterval(() => setOtpCooldown((remaining) => Math.max(0, remaining - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [otpCooldown]);

  function addToCart(store, product) {
    setCart((prev) => {
      const sameStore = prev.storeId === store.id || prev.items.length === 0;
      const base = sameStore ? prev.items : [];
      if (!sameStore) notify("تم تفريغ السلة السابقة لأن هذا منتج من محل مختلف");
      const existing = base.find((i) => i.id === product.id);
      const items = existing ? base.map((i) => (i.id === product.id ? { ...i, qty: i.qty + 1 } : i)) : [...base, { id: product.id, name: product.name, price: product.price, qty: 1 }];
      return { ...prev, storeId: store.id, items };
    });
    notify(`تمت إضافة «${product.name}» للسلة`);
  }
  function changeQty(id, delta) { setCart((prev) => ({ ...prev, items: prev.items.map((i) => (i.id === id ? { ...i, qty: i.qty + delta } : i)).filter((i) => i.qty > 0) })); }
  function applyPromo() { const match = PROMOS.find((p) => p.code.toLowerCase() === promoInput.trim().toLowerCase()); if (!match) { notify("كود الخصم غير صالح"); return; } setAppliedPromo(match); notify(`تم تطبيق خصم ${match.discount}%`); }
  function applyRewardCoupon() { const coupon = rewardCoupons.find((item) => item.status === "available" && item.code.toUpperCase() === rewardCouponInput.trim().toUpperCase()); if (!coupon) { notify("قسيمة المكافأة غير متاحة أو غير صالحة."); return; } if (cartSubtotal < Number(coupon.minimumOrderTotal || 0)) { notify(`هذه القسيمة تتطلب طلباً بقيمة ${money(coupon.minimumOrderTotal)} على الأقل.`); return; } setAppliedReward(coupon); notify(`تم حجز خصم المكافأة بقيمة ${money(coupon.amount)} للطلب.`); }
  function updateAddress(values) { setCart((prev) => ({ ...prev, address: { ...(prev.address || {}), ...values } })); setPhoneVerified(false); }
  function requestCurrentLocation() {
    if (!navigator.geolocation) { notify("لا يدعم متصفحك تحديد الموقع الجغرافي."); return; }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { updateAddress({ latitude: coords.latitude, longitude: coords.longitude }); notify("تم حفظ موقع GPS الدقيق. أكمل الولاية والبلدية ووصف العنوان."); },
      () => notify("تعذر الوصول إلى GPS. راجع أذونات الموقع أو حدد الموقع على الخريطة."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  }
  async function verifyMockPhone(method) {
    if (!mockPhone.trim()) { notify("أدخل رقم هاتفك أولاً."); return; }
    const ok = await confirmCustomerPhoneVerification(mockPhone.trim(), method);
    if (ok) setPhoneVerified(true);
  }
  async function requestOtp(channel) {
    if (!mockPhone.trim()) { notify("أدخل رقم هاتفك أولاً قبل طلب الرمز."); return; }
    setOtpSending(true);
    const result = await requestCustomerPhoneVerification(mockPhone.trim(), channel);
    setOtpSending(false);
    if (!result?.ok) { setOtpStatus(result?.message || "تعذر طلب رمز التحقق."); setOtpCooldown(Number(result?.retryAfter || 0)); return; }
    setOtpCooldown(Number(result.cooldownSeconds || 60));
    setOtpStatus(result.message || "تم تجهيز مسار التحقق التجريبي.");
  }
  function submitReview(order, stars, comment) {
    setStores((prev) => prev.map((s) => { if (s.id !== order.storeId) return s; const reviews = [...(s.reviews || []), { id: "r" + Math.random().toString(36).slice(2, 7), customer: "أنت", authorRole: "زبون", stars, comment, date: "الآن", verified: false }]; return { ...s, reviews }; }));
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, rated: true } : o)));
    setReviewingOrder(null); notify("تم استلام تقييمك للمراجعة قبل نشره.");
  }

  const myOrders = orders.filter((o) => o.customerId ? o.customerId === customerId : o.customer === "أنت");
  const visibleDepts = openStore ? DEPARTMENTS.filter((d) => openStore.products.some((p) => p.department === d.id)) : [];
  const shownProducts = openStore ? openStore.products.filter((p) => activeDept === "all" || p.department === activeDept) : [];
  const deliveryOptions = [
    cartStore?.hasOwnDelivery && { id: "store", label: "توصيل المحل", desc: money(cartStore.deliveryFee), icon: Truck2 },
    { id: "courier", label: "موصل معتمد من المنصة", desc: platformCourierEnabled ? "يُسند تلقائياً عند الجاهزية — تُحسب الرسوم بعد إدخال العنوان" : "التوصيل عبر المنصة غير مفعّل لهذا المحل", icon: Bike, disabled: !platformCourierEnabled },
    { id: "pickup", label: "استلام ذاتي من المحل", desc: "بدون رسوم توصيل", icon: Home },
  ].filter(Boolean);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          <button onClick={() => setTab("browse")} className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: tab === "browse" ? C.teal : "transparent", color: tab === "browse" ? C.paper : C.inkSoft, border: `1px solid ${tab === "browse" ? C.teal : C.line}` }}>المحلات القريبة</button>
          <button onClick={() => setTab("orders")} className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: tab === "orders" ? C.teal : "transparent", color: tab === "orders" ? C.paper : C.inkSoft, border: `1px solid ${tab === "orders" ? C.teal : C.line}` }}>طلباتي {myOrders.length > 0 && `(${myOrders.length})`}</button>
          <button data-testid="customer-rewards-tab" onClick={() => setTab("rewards")} className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: tab === "rewards" ? C.teal : "transparent", color: tab === "rewards" ? C.paper : C.inkSoft, border: `1px solid ${tab === "rewards" ? C.teal : C.line}` }}>دعوات ومكافآت</button>
        </div>
        <button onClick={() => setShowCart(true)} className="relative flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-sm" style={{ background: C.rust, color: C.paper }}><ShoppingCart size={17} /> السلة{cartCount > 0 && <span className="absolute -top-2 -right-2 flex items-center justify-center text-xs font-black rounded-full" style={{ width: 20, height: 20, background: C.ink, color: C.paper }}>{cartCount}</span>}</button>
      </div>

      {tab === "rewards" && <ReferralRewardsPanel referralCode={referralCode} rewardCoupons={rewardCoupons} notify={notify} claimReferralCode={claimReferralCode} />}

      {tab === "browse" && !openStore && (
        <>
          <PromoBar notify={notify} />
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
            <Search size={17} color={C.inkSoft} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث باسم المحل أو نوع النشاط..." className="flex-1 outline-none text-sm bg-transparent" style={{ color: C.ink, fontFamily: "Tajawal, sans-serif" }} />
            <div className="flex p-1 rounded-xl shrink-0" style={{ background: C.paperDark, border: `1px solid ${C.line}` }}>
              <button onClick={() => setBrowseMode("list")} className="p-1.5 rounded-lg" style={{ background: browseMode === "list" ? C.teal : "transparent", color: browseMode === "list" ? "#fff" : C.inkSoft }}><List size={16} /></button>
              <button onClick={() => setBrowseMode("map")} className="p-1.5 rounded-lg" style={{ background: browseMode === "map" ? C.teal : "transparent", color: browseMode === "map" ? "#fff" : C.inkSoft }}><MapIcon size={16} /></button>
            </div>
          </div>

          {browseMode === "map" ? (
            <MapView stores={curatedStores} selectedWilaya={filterWilaya} onSelectWilaya={(w) => { setFilterWilaya(w || ""); setFilterCommune(""); }} onOpenStore={setOpenStoreId} />
          ) : (
            <>
              <WilayaCommuneSelect wilaya={filterWilaya} commune={filterCommune} allowAllWilaya allowAllCommune onChange={({ wilaya, commune }) => { setFilterWilaya(wilaya); setFilterCommune(commune); }} />
              <div className="flex items-end justify-between gap-3 flex-wrap"><div><h2 className="font-black" style={{ color: C.ink, fontFamily: "'Reem Kufi', sans-serif" }}>متاجر مقترحة في {discoveryAreaLabel}</h2><p className="text-xs mt-1" style={{ color: C.inkSoft }}>نختار حتى 6 متاجر فقط مع إعطاء الأولوية لتنوع الأنشطة المتاح في المنطقة.</p></div><span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: C.teal + "12", color: C.teal }}>{curatedStores.length}/{MAX_DISCOVERY_STORES} متجر</span></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {curatedStores.map((s) => {
                  const isOpen = new Date().getHours() >= s.open && new Date().getHours() < s.close;
                  const verifiedReviewCount = (s.reviews || []).filter((review) => review?.verified === true).length;
                  const category = getDiscoveryCategory(s);
                  return (
                    <button key={s.id} onClick={() => setOpenStoreId(s.id)} className="text-right p-4 rounded-2xl transition hover:-translate-y-0.5" style={{ background: "#fff", border: `1px solid ${C.line}`, boxShadow: "0 1px 0 rgba(35,32,27,0.05)" }}>
                      <div className="flex items-start justify-between mb-3"><StoreAvatar logo={s.logo} size={38} /><div className="flex flex-col items-end gap-1"><span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: isOpen ? C.sage + "22" : "#8883", color: isOpen ? C.sage : C.inkSoft }}>{isOpen ? "مفتوح الآن" : "مغلق"}</span><span className="text-[10px] font-bold" style={{ color: C.teal }}>{category.label}</span></div></div>
                      <div className="font-black text-base" style={{ color: C.ink, fontFamily: "'Reem Kufi', sans-serif" }}>{s.name}</div>
                      <div className="flex items-center gap-1 text-xs mt-1" style={{ color: C.inkSoft }}><MapPin size={12} /> {s.wilaya} · {s.commune}</div>
                      <div className="flex items-center justify-between mt-3"><span className="flex items-center gap-1 text-xs font-bold" style={{ color: C.ochre }}><Star size={13} fill={C.ochre} strokeWidth={0} /> {s.rating || "جديد"}{verifiedReviewCount > 0 && <span style={{ color: C.inkSoft, fontWeight: 500 }}>({verifiedReviewCount})</span>}</span><span className="text-xs font-bold flex items-center gap-1" style={{ color: C.teal }}>عرض المنتجات <ChevronLeft size={14} /></span></div>
                    </button>
                  );
                })}
                {curatedStores.length === 0 && <p className="col-span-2 text-center py-10 text-sm" style={{ color: C.inkSoft }}>لا توجد محلات مطابقة لبحثك.</p>}
              </div>
              <PublicCourierAvailability couriers={publicCouriers} areaLabel={discoveryAreaLabel} />
              <VerifiedFeedbackPanel stores={curatedStores} />
            </>
          )}
        </>
      )}

      {tab === "browse" && openStore && (
        <div className="space-y-4">
          <button onClick={() => { setOpenStoreId(null); setActiveDept("all"); }} className="flex items-center gap-1 text-sm font-bold" style={{ color: C.teal }}><ChevronRight size={16} /> رجوع إلى المحلات</button>
          <div className="p-4 rounded-2xl flex items-center gap-3" style={{ background: C.paperDark }}>
            <StoreAvatar logo={openStore.logo} size={46} />
            <div className="flex-1"><div className="font-black text-lg" style={{ color: C.ink, fontFamily: "'Reem Kufi', sans-serif" }}>{openStore.name}</div><div className="text-xs" style={{ color: C.inkSoft }}>{openStore.wilaya} · {openStore.commune} · يعمل من {openStore.open}:00 إلى {openStore.close}:00</div><div className="flex items-center gap-1 mt-1"><StarRating value={Math.round(openStore.rating || 0)} size={12} /><span className="text-xs font-bold" style={{ color: C.inkSoft }}>{openStore.rating || "جديد"} ({(openStore.reviews || []).length} تقييم)</span></div></div>
          </div>
          {openStore.minOrder > 0 && <p className="text-xs" style={{ color: C.inkSoft }}>الحد الأدنى للطلب: <span style={{ fontWeight: 800, color: C.ink }}>{money(openStore.minOrder)}</span></p>}
          {visibleDepts.length > 1 && (<div className="flex gap-2 overflow-x-auto pb-1"><button onClick={() => setActiveDept("all")} className="shrink-0 px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: activeDept === "all" ? C.ink : "transparent", color: activeDept === "all" ? "#fff" : C.inkSoft, border: `1px solid ${activeDept === "all" ? C.ink : C.line}` }}>كل الأقسام</button>{visibleDepts.map((d) => <button key={d.id} onClick={() => setActiveDept(d.id)} className="shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: activeDept === d.id ? d.color : "transparent", color: activeDept === d.id ? "#fff" : C.inkSoft, border: `1px solid ${activeDept === d.id ? d.color : C.line}` }}><d.icon size={14} /> {d.label}</button>)}</div>)}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {shownProducts.map((p) => (
              <div key={p.id} className="p-4 rounded-2xl flex items-center justify-between gap-3" style={{ background: "#fff", border: `1px solid ${C.line}`, opacity: p.available ? 1 : 0.5 }}>
                <div><div className="flex items-center gap-1.5 mb-1"><DeptBadge id={p.department} size={13} /><span className="text-[10px]" style={{ color: C.inkSoft }}>{deptInfo(p.department).label}</span></div><div className="font-bold text-sm" style={{ color: C.ink }}>{p.name}</div><div className="text-xs mb-2" style={{ color: C.inkSoft }}>{p.unit}</div><PriceTag amount={p.price} /></div>
                <button disabled={!p.available} onClick={() => addToCart(openStore, p)} className="flex items-center justify-center rounded-full shrink-0 disabled:opacity-40" style={{ width: 38, height: 38, background: C.teal, color: C.paper }}><Plus size={18} /></button>
              </div>
            ))}
          </div>
          {(openStore.reviews || []).filter((review) => review?.verified === true).length > 0 && (<div><h4 className="font-black text-sm mb-2 flex items-center gap-1.5" style={{ color: C.ink }}><MessageSquare size={14} color={C.teal} /> آراء موثقة</h4><div className="space-y-2">{openStore.reviews.filter((review) => review?.verified === true).map((r) => (<div key={r.id} className="p-3 rounded-xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}><div className="flex items-center justify-between mb-1"><span className="text-xs font-bold" style={{ color: C.ink }}>{r.authorRole || r.customer || "عضو موثّق"}</span><StarRating value={r.stars} size={12} /></div>{r.comment && <p className="text-xs" style={{ color: C.inkSoft }}>{r.comment}</p>}<p className="text-[10px] mt-1" style={{ color: C.inkSoft }}>{r.date}</p></div>))}</div></div>)}
        </div>
      )}

      {tab === "orders" && (
        <div className="space-y-3">
          {myOrders.length === 0 && <div className="text-center py-14 rounded-2xl" style={{ background: "#fff", border: `1px dashed ${C.line}` }}><ClipboardList size={28} style={{ margin: "0 auto 8px", color: C.inkSoft }} /><p className="text-sm" style={{ color: C.inkSoft }}>لا توجد طلبات بعد.</p></div>}
          {myOrders.map((o) => (
            <div key={o.id} className="p-4 rounded-2xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
              <div className="flex items-center justify-between mb-2"><span className="font-bold text-sm" style={{ color: C.ink }}>{o.storeName}</span><StatusPill status={o.status} /></div>
              <div className="text-xs mb-1" style={{ color: C.inkSoft }}>{o.items.map((i) => `${i.name} ×${i.qty}`).join(" · ")}</div>
              <div className="text-xs mb-3 flex items-center gap-1" style={{ color: C.teal }}>{React.createElement(DELIVERY_LABELS[o.deliveryType]?.icon || Home, { size: 12 })} {DELIVERY_LABELS[o.deliveryType]?.label}{o.courier ? ` — ${o.courier.name}` : ""}</div>
              <OrderTracker status={o.status} />
              <div className="flex items-center gap-2 mt-3 pt-3 flex-wrap" style={{ borderTop: `1px solid ${C.line}` }}>
                <button onClick={() => setInvoiceOrder(o)} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ border: `1px solid ${C.line}`, color: C.inkSoft }}><Printer size={12} /> الفاتورة</button>
                {o.status === "delivered" && <button onClick={() => customerConfirmDelivery(o.id)} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: C.sage + "20", color: C.sage }}><CheckCircle2 size={12} /> تأكيد الاستلام والدفع</button>}
                {o.status === "customer_confirmed" && !o.rated && <button onClick={() => setReviewingOrder(o)} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: C.ochre + "25", color: "#8A6318" }}><Star size={12} /> قيّم تجربتك</button>}
                {o.rated && <span className="text-xs font-bold flex items-center gap-1" style={{ color: C.sage }}><Check size={12} /> تم التقييم</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCart && (
        <div className="fixed inset-0 z-40 flex justify-end" style={{ background: "rgba(35,32,27,0.45)" }} onClick={() => setShowCart(false)}>
          <div onClick={(e) => e.stopPropagation()} className="h-full w-full sm:w-96 p-5 overflow-y-auto" style={{ background: C.paper }}>
            <div className="flex items-center justify-between mb-4"><h3 className="font-black text-lg" style={{ fontFamily: "'Reem Kufi', sans-serif", color: C.ink }}>سلتك</h3><button onClick={() => setShowCart(false)}><X size={20} color={C.inkSoft} /></button></div>
            {cart.items.length === 0 ? <p className="text-sm text-center py-10" style={{ color: C.inkSoft }}>سلتك فارغة حالياً.</p> : (
              <>
                <p className="text-xs mb-3 font-bold" style={{ color: C.teal }}>الطلب من: {cartStore?.name}</p>
                <div className="space-y-3 mb-5">{cart.items.map((i) => (<div key={i.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}><div><div className="text-sm font-bold" style={{ color: C.ink }}>{i.name}</div><div className="text-xs" style={{ color: C.inkSoft }}>{money(i.price)} × {i.qty}</div></div><div className="flex items-center gap-2"><button onClick={() => changeQty(i.id, -1)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: C.paperDark }}><Minus size={13} /></button><span className="text-sm font-bold w-4 text-center">{i.qty}</span><button onClick={() => changeQty(i.id, 1)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: C.paperDark }}><Plus size={13} /></button></div></div>))}</div>

                <div className="mb-4">
                  <span className="text-xs font-bold flex items-center gap-1 mb-2" style={{ color: C.ink }}><Truck2 size={13} /> طريقة الاستلام</span>
                  <div className="space-y-2">{deliveryOptions.map((opt) => (<button key={opt.id} disabled={opt.disabled} onClick={() => setDeliveryChoice(opt.id)} className="w-full flex items-center gap-2.5 p-2.5 rounded-xl text-right disabled:opacity-40" style={{ border: `1.5px solid ${deliveryChoice === opt.id ? C.teal : C.line}`, background: deliveryChoice === opt.id ? C.teal + "10" : "#fff" }}><opt.icon size={17} color={deliveryChoice === opt.id ? C.teal : C.inkSoft} /><div className="flex-1"><div className="text-xs font-bold" style={{ color: C.ink }}>{opt.label}</div><div className="text-[11px]" style={{ color: C.inkSoft }}>{opt.desc}</div></div>{deliveryChoice === opt.id && <CheckCircle2 size={16} color={C.teal} />}</button>))}</div>
                </div>

                {deliveryChoice !== "pickup" && <div className="mb-4 p-3 rounded-xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
                  <div className="flex items-center justify-between mb-2"><span className="text-xs font-bold flex items-center gap-1" style={{ color: C.ink }}><MapPin size={13} /> عنوان التوصيل</span><button onClick={() => setShowMapPicker(true)} className="text-xs font-bold" style={{ color: C.teal }}>{cart.address ? "تحديد على الخريطة" : "فتح الخريطة"}</button></div>
                  <WilayaCommuneSelect wilaya={cart.address?.wilaya || ""} commune={cart.address?.commune || ""} onChange={({ wilaya, commune }) => updateAddress({ wilaya, commune })} />
                  <input value={cart.address?.label || ""} onChange={(e) => updateAddress({ label: e.target.value })} placeholder="وصف دقيق: الحي، الشارع، المعلم القريب" className="w-full mt-2 px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} />
                  <button onClick={requestCurrentLocation} className="mt-2 flex items-center gap-1 text-xs font-bold" style={{ color: C.teal }}><Navigation size={13} /> استخدام موقعي GPS الحالي</button>
                  {cart.address?.latitude && cart.address?.longitude ? <p className="mt-2 text-[11px] font-bold" style={{ color: C.sage }}>تم حفظ إحداثيات GPS الدقيقة للعنوان.</p> : <p className="mt-2 text-[11px]" style={{ color: C.inkSoft }}>يمكنك حفظ GPS بعد منح إذن الموقع؛ الخريطة تبقى بديلاً لتحديد نقطة الوصول.</p>}
                  {cart.address?.x !== undefined && <div className="mt-2"><MapPreview x={cart.address.x} y={cart.address.y} height={60} /></div>}
                </div>}

                {deliveryChoice === "courier" && quoteLoading && <p className="text-xs mb-3" style={{ color: C.inkSoft }}>جارٍ احتساب رسوم التوصيل من الخادم…</p>}
                {deliveryChoice === "courier" && deliveryQuote && <div className="mb-3 p-3 rounded-xl text-xs" style={{ background: C.teal + "0F", border: `1px solid ${C.teal}30`, color: C.ink }}><div className="font-bold" style={{ color: C.teal }}>تسعير محسوب من الخادم</div><div className="mt-1">المسافة التقديرية: {Number(deliveryQuote.distanceKm || 0).toFixed(1)} كم · الوصول المتوقع: {deliveryQuote.etaMinutes || "—"} دقيقة{deliveryQuote.isInterwilaya ? " · توصيل بين الولايات" : ""}</div></div>}
                {deliveryChoice === "courier" && quoteError && <p className="text-xs font-bold mb-3" style={{ color: "#8B3A2A" }}>{quoteError}</p>}
                {requiresPhoneVerification && <div className="mb-3 p-3 rounded-xl" style={{ background: C.ochre + "16", border: `1px solid ${C.ochre}40` }}><div className="flex items-center justify-between gap-2"><div className="text-xs font-black" style={{ color: "#8A6318" }}>تحقق الهاتف مطلوب لهذا الطلب</div><span className="text-[10px] font-black px-2 py-1 rounded-full" style={{ background: "#fff", color: C.ochre }}>وضع تجريبي</span></div><p className="text-[11px] mt-1 leading-5" style={{ color: C.inkSoft }}>سيصلك رمز التحقق عبر تطبيق واتساب/فايبر عند تفعيل القنوات لاحقاً. حالياً لا يُرسل رمز حقيقي؛ نستعمل تأكيداً تجريبياً واضحاً كي لا يتعطل طلبك.</p><div className="flex gap-2 mt-2"><input value={mockPhone} onChange={(e) => { setMockPhone(e.target.value); setPhoneVerified(false); setOtpStatus(""); }} inputMode="tel" placeholder="رقم الهاتف" className="flex-1 px-3 py-2 rounded-xl text-sm outline-none bg-white" style={{ border: `1px solid ${C.line}` }} /><button disabled={phoneVerified} onClick={() => verifyMockPhone("mock_otp")} className="px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-50" style={{ background: C.ochre, color: "#fff" }}>{phoneVerified ? "تم التحقق" : "تأكيد الرمز التجريبي"}</button></div><div className="flex flex-wrap gap-2 mt-2"><button disabled={otpSending || otpCooldown > 0} onClick={() => requestOtp("whatsapp")} className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg disabled:opacity-50" style={{ background: "#fff", color: C.teal, border: `1px solid ${C.teal}55` }}>{otpSending ? "جارٍ تجهيز التحقق…" : otpCooldown ? `إعادة الإرسال بعد ${otpCooldown}ث` : "إرسال عبر WhatsApp"}</button><button disabled={otpSending || otpCooldown > 0} onClick={() => requestOtp("viber")} className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg disabled:opacity-50" style={{ background: "#fff", color: C.teal, border: `1px solid ${C.teal}55` }}>التحويل إلى Viber</button><a href="mailto:support@souqjiran.dz?subject=OTP%20support" className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg" style={{ color: C.inkSoft, border: `1px solid ${C.line}` }}>لم يصلك الرمز؟ تواصل مع الدعم</a></div>{otpStatus && <p className="text-[11px] mt-2" role="status" style={{ color: C.inkSoft }}>{otpStatus}</p>}</div>}

                <div className="flex gap-2 mb-3"><input value={promoInput} onChange={(e) => setPromoInput(e.target.value)} placeholder="أدخل كود الخصم" className="flex-1 px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} /><button onClick={applyPromo} className="px-4 py-2 rounded-xl text-xs font-bold" style={{ background: C.ochre, color: "#fff" }}>تطبيق</button></div>
                {appliedPromo && <p className="text-xs font-bold mb-3 flex items-center gap-1" style={{ color: C.sage }}><Tag size={12} /> تم تطبيق خصم {appliedPromo.discount}% ({appliedPromo.code})</p>}
                <div className="flex gap-2 mb-3"><input value={rewardCouponInput} onChange={(e) => setRewardCouponInput(e.target.value.toUpperCase())} placeholder="قسيمة مكافأة الإحالة" dir="ltr" className="flex-1 px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} /><button onClick={applyRewardCoupon} className="px-4 py-2 rounded-xl text-xs font-bold" style={{ background: C.teal, color: "#fff" }}>استخدام القسيمة</button></div>
                {appliedReward && <p className="text-xs font-bold mb-3 flex items-center gap-1" style={{ color: C.sage }}><Tag size={12} /> تم حجز خصم مكافأة {money(appliedReward.amount)} ({appliedReward.code})</p>}

                <StripeDivider />
                <div className="my-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs" style={{ color: C.inkSoft }}><span>المجموع الفرعي</span><span>{money(cartSubtotal)}</span></div>
                  {deliveryChoice === "courier" && <div className="flex items-center justify-between text-xs" style={{ color: C.inkSoft }}><span>رسوم التوصيل {deliveryQuote ? "المحسوبة" : ""}</span><span>{quoteLoading ? "…" : money(deliveryFee)}</span></div>}
                  {deliveryChoice === "store" && deliveryFee > 0 && <div className="flex items-center justify-between text-xs" style={{ color: C.inkSoft }}><span>رسوم توصيل المحل</span><span>{money(deliveryFee)}</span></div>}
                  {discountAmount > 0 && <div className="flex items-center justify-between text-xs" style={{ color: C.sage }}><span>الخصم</span><span>- {money(discountAmount)}</span></div>}
                  <div className="flex items-center justify-between pt-1"><span className="font-bold text-sm" style={{ color: C.ink }}>يُدفع نقداً عند الاستلام</span><PriceTag amount={finalTotal} size="lg" /></div>
                </div>
                {belowMinOrder && <p className="text-xs font-bold mb-3" style={{ color: "#8B3A2A" }}>الحد الأدنى للطلب من هذا المحل هو {money(cartStore.minOrder)}.</p>}
                <button disabled={belowMinOrder || quoteLoading || (deliveryChoice === "courier" && (!cart.address?.wilaya || !cart.address?.commune || !cart.address?.label || !deliveryQuote || (requiresPhoneVerification && !phoneVerified)))} onClick={async () => { const ok = await placeOrder(cartStore, appliedPromo, discountAmount, cart.address, deliveryChoice, deliveryFee, appliedReward?.code); if (!ok) return; setAppliedPromo(null); setAppliedReward(null); setPromoInput(""); setRewardCouponInput(""); setShowCart(false); setTab("orders"); setDeliveryChoice("pickup"); setDeliveryChoice("pickup"); setDeliveryQuote(null); setPhoneVerified(false); }} className="w-full py-3 rounded-xl font-black disabled:opacity-40" style={{ background: C.rust, color: "#fff" }}>تأكيد الطلب (دفع نقدي)</button>
              </>
            )}
          </div>
        </div>
      )}

      {showMapPicker && <MapPicker title="حدد عنوان التوصيل" initial={cart.address ? { x: cart.address.x, y: cart.address.y } : undefined} onConfirm={(pos) => updateAddress({ x: pos.x, y: pos.y })} onClose={() => setShowMapPicker(false)} />}
      {reviewingOrder && <ReviewModal order={reviewingOrder} onSubmit={(stars, comment) => submitReview(reviewingOrder, stars, comment)} onClose={() => setReviewingOrder(null)} />}
      {invoiceOrder && <InvoiceModal order={invoiceOrder} store={stores.find((s) => s.id === invoiceOrder.storeId)} onClose={() => setInvoiceOrder(null)} />}
    </div>
  );
}

function OrderTracker({ status }) {
  const steps = ["pending", "accepted", "preparing", "ready", "assigned", "picked_up", "out_for_delivery", "delivered", "customer_confirmed", "remittance_confirmed", "settled"];
  if (["declined", "cancelled"].includes(status)) return <p className="text-xs font-bold" style={{ color: STATUS_MAP[status].color }}>{STATUS_MAP[status].label}.</p>;
  const idx = steps.indexOf(status);
  return (<div className="flex items-center">{steps.map((s, i) => (<React.Fragment key={s}><div className="flex items-center justify-center rounded-full shrink-0" style={{ width: 20, height: 20, background: i <= idx ? C.teal : C.paperDark, color: i <= idx ? "#fff" : C.inkSoft }}>{i <= idx ? <Check size={11} /> : <span style={{ width: 5, height: 5, borderRadius: 999, background: C.inkSoft }} />}</div>{i < steps.length - 1 && <div className="flex-1 h-0.5" style={{ background: i < idx ? C.teal : C.paperDark }} />}</React.Fragment>))}</div>);
}

/* ===========================================================
   MERCHANT VIEW
=========================================================== */
function MerchantQrPoster({ store, notify }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const deepLink = useMemo(() => `${window.location.origin}${window.location.pathname}?store=${encodeURIComponent(store.id)}`, [store.id]);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(deepLink, { errorCorrectionLevel: "H", width: 900, margin: 2, color: { dark: C.ink, light: "#FFFFFF" } })
      .then((value) => { if (active) setQrDataUrl(value); })
      .catch(() => notify("تعذر إنشاء رمز QR لهذا المحل."));
    return () => { active = false; };
  }, [deepLink, notify]);

  async function copyDeepLink() {
    try { await navigator.clipboard.writeText(deepLink); notify("تم نسخ رابط المحل للمشاركة."); }
    catch { notify("انسخ الرابط يدوياً من الحقل الظاهر."); }
  }

  function downloadPoster() {
    if (!qrDataUrl) { notify("جارٍ تجهيز الملصق، حاول بعد لحظات."); return; }
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    pdf.setFillColor(247, 248, 252); pdf.rect(0, 0, 210, 297, "F");
    pdf.setFillColor(91, 91, 247); pdf.roundedRect(18, 18, 174, 20, 5, 5, "F");
    pdf.setTextColor(255, 255, 255); pdf.setFontSize(19); pdf.text("SOUQ JIRAN · اطلب من المنزل", 105, 31, { align: "center" });
    pdf.setTextColor(23, 32, 51); pdf.setFontSize(22); pdf.text(store.name, 105, 57, { align: "center" });
    pdf.setFontSize(12); pdf.setTextColor(105, 115, 134); pdf.text(`${store.commune} · ${store.wilaya}`, 105, 66, { align: "center" });
    pdf.addImage(qrDataUrl, "PNG", 47, 76, 116, 116);
    pdf.setTextColor(23, 32, 51); pdf.setFontSize(15); pdf.text("امسح الرمز لتطلب مباشرة من محلك", 105, 210, { align: "center" });
    pdf.setFontSize(10); pdf.setTextColor(105, 115, 134); pdf.text("سوق الجيران · طلبات محلية وتوصيل منظم", 105, 220, { align: "center" });
    pdf.save(`souq-jiran-${store.name.replace(/[^\w\u0600-\u06FF]+/g, "-")}-qr.pdf`);
    notify("تم تنزيل ملصق PDF جاهز للطباعة.");
  }

  return <section data-testid="merchant-qr-poster" className="p-5 rounded-2xl space-y-4" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
    <div className="flex items-start justify-between gap-3 flex-wrap"><div><h3 className="font-black text-lg" style={{ color: C.ink }}>ملصق QR للمحل</h3><p className="text-xs mt-1 leading-5" style={{ color: C.inkSoft }}>يمسح العميل الرمز للوصول إلى متجر <b>{store.name}</b> مباشرةً داخل سوق الجيران.</p></div><span className="px-3 py-1.5 rounded-full text-xs font-black" style={{ background: C.teal + "18", color: C.teal }}>رابط خاص بالمحل</span></div>
    <div className="grid md:grid-cols-[220px_1fr] gap-5 items-center rounded-2xl p-4" style={{ background: C.paperDark }}>
      <div className="bg-white rounded-2xl p-3 mx-auto" style={{ border: `1px solid ${C.line}` }}>{qrDataUrl ? <img src={qrDataUrl} alt={`رمز QR لمحل ${store.name}`} className="w-44 h-44" /> : <div className="w-44 h-44 flex items-center justify-center text-xs" style={{ color: C.inkSoft }}>جارٍ إنشاء الرمز…</div>}</div>
      <div className="space-y-3"><label className="block text-xs font-bold" style={{ color: C.ink }}>الرابط العميق للمشاركة<input aria-label="رابط المتجر" readOnly value={deepLink} dir="ltr" className="w-full mt-1.5 px-3 py-2.5 rounded-xl text-xs bg-white outline-none" style={{ border: `1px solid ${C.line}`, color: C.inkSoft }} /></label><div className="flex flex-wrap gap-2"><button data-testid="merchant-copy-deep-link" onClick={copyDeepLink} className="px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-1.5" style={{ background: "#fff", color: C.teal, border: `1px solid ${C.teal}55` }}><Copy size={15} /> نسخ الرابط</button><button data-testid="merchant-download-qr-pdf" onClick={downloadPoster} className="px-4 py-2.5 rounded-xl text-sm font-black flex items-center gap-1.5" style={{ background: C.teal, color: "#fff" }}><Download size={15} /> تنزيل ملصق PDF</button></div><p className="text-[11px] leading-5" style={{ color: C.inkSoft }}>اطبع الملصق بحجم A4 وضعه قرب صندوق الدفع أو عند مدخل المحل.</p></div>
    </div>
  </section>;
}

function MerchantView({ stores, setStores, orders, messages, couriers, myStoreId, setMyStoreId, notify, registerMerchant, createProduct, createBulkProducts, removeProductRemote, setProductAvailability, setMerchantOrderStatus, merchantConfirmSettlement, reportCustomerAccount, archiveOrder, archiveMessage, userId }) {
  const myStore = stores.find((s) => s.id === myStoreId);
  const [merchantMode, setMerchantMode] = useState("select");
  const [form, setForm] = useState({ name: "", contact: "", phone: "", password: "", mockOtpCode: "", wilaya: "", commune: "", lat: 50, lng: 50 });
  const [stage2, setStage2] = useState({ open: 8, close: 21, minOrder: 0, deliveryFee: 0, hasOwnDelivery: true, deliveryCommunes: [], logoText: "", logoColor: C.teal, ccp: "", idDocName: "" });
  const [authError, setAuthError] = useState("");
  const [tab, setTab] = useState("products");
  const [newProduct, setNewProduct] = useState({ name: "", price: "", unit: "الوحدة", department: "pantry" });
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [invoiceOrder, setInvoiceOrder] = useState(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const contactIdentity = parseLoginIdentifier(form.contact);
  const usesPhoneIdentity = contactIdentity?.kind === "phone";

  function updateStore(patch) { setStores((prev) => prev.map((s) => (s.id === myStoreId ? { ...s, ...patch } : s))); }

  async function registerStore() {
    if (!form.name || !form.wilaya || !form.commune) { notify("يرجى إدخال اسم المحل والولاية والبلدية"); return; }
    if (!contactIdentity) { setAuthError("أدخل بريداً إلكترونياً صالحاً أو رقم هاتف جزائرياً يبدأ بـ 05 أو 06 أو 07."); return; }
    const operationalPhone = contactIdentity.phone || normalizeAlgerianMobile(form.phone);
    if (!operationalPhone) { setAuthError("أدخل رقم هاتف محمول جزائرياً للتواصل يبدأ بـ 05 أو 06 أو 07."); return; }
    if (form.password.length < 6) { setAuthError("كلمة المرور يجب أن تكون 6 أحرف على الأقل"); return; }
    if (usesPhoneIdentity && form.mockOtpCode !== "123456") { setAuthError("أدخل رمز OTP التجريبي 123456 لتأكيد رقم الهاتف."); return; }
    setAuthError("");
    setIsSubmitting(true);
    const result = await registerMerchant({ ...form, phone: operationalPhone, phoneMockVerified: usesPhoneIdentity });
    setIsSubmitting(false);
    if (result?.error) { setAuthError(result.error); return; }
    setMyStoreId(result.id);
    notify(result?.notice || "تم إرسال طلب التسجيل الأولي، بانتظار الموافقة المبدئية من المشرف");
  }

  function completeProfile() {
    if (!stage2.logoText) { notify("أدخل حرفين على الأقل لشعار محلك"); return; }
    updateStore({ open: Number(stage2.open), close: Number(stage2.close), minOrder: Number(stage2.minOrder) || 0, deliveryFee: Number(stage2.deliveryFee) || 0, hasOwnDelivery: stage2.hasOwnDelivery, deliveryCommunes: stage2.deliveryCommunes, logo: { text: stage2.logoText.slice(0, 2), color: stage2.logoColor }, ccp: stage2.ccp, idDocName: stage2.idDocName, status: "approved" });
    notify("تم تفعيل محلك بنجاح! أصبح ظاهراً للعملاء الآن 🎉");
  }

  function toggleDeliveryCommune(c) { setStage2((s) => ({ ...s, deliveryCommunes: s.deliveryCommunes.includes(c) ? s.deliveryCommunes.filter((x) => x !== c) : [...s.deliveryCommunes, c] })); }
  function toggleStoreDeliveryCommune(c) { const cur = myStore.deliveryCommunes || []; updateStore({ deliveryCommunes: cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c] }); }
  function toggleApprovedCourier(id) { const cur = myStore.approvedCourierIds || []; updateStore({ approvedCourierIds: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] }); }

  async function addProduct() { if (!newProduct.name || !newProduct.price) { notify("أدخل اسم المنتج وسعره"); return; } const result = await createProduct(myStoreId, { ...newProduct, price: Number(newProduct.price) }); if (!result) return; setNewProduct({ name: "", price: "", unit: "الوحدة", department: "pantry" }); notify("تمت إضافة المنتج"); }
  async function addBulkProducts(rows) { const result = await createBulkProducts(myStoreId, rows); if (!result) return; setShowBulkImport(false); notify(`تمت إضافة ${rows.length} منتج من الملف`); }
  async function removeProduct(id) { if (await removeProductRemote(id)) notify("تم حذف المنتج"); }
  async function toggleAvailable(id) { const product = myStore.products.find((item) => item.id === id); if (product) await setProductAvailability(id, !product.available); }

  const myOrders = orders.filter((o) => o.storeId === myStoreId);
  const newMerchantOrders = myOrders.filter((o) => o.status === "pending");
  async function setOrderStatus(id, status) { await setMerchantOrderStatus(id, status); }
  const nextStatus = { pending: "accepted", accepted: "preparing", preparing: "ready" };

  function openNewMerchantOrders() {
    setTab("orders");
    window.requestAnimationFrame(() => document.getElementById("merchant-new-orders")?.scrollIntoView({ block: "start" }));
  }

  const matchingCouriers = myStore ? couriers.filter((c) => c.status === "approved" && c.wilaya === myStore.wilaya && (c.communes.length === 0 || c.communes.includes(myStore.commune)) && (c.storeMode === "all" || (c.selectedStoreIds || []).includes(myStore.id))) : [];

  if (!myStore) {
    return (
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex gap-2 p-1 rounded-2xl" style={{ background: C.paperDark, border: `1px solid ${C.line}` }}>
          <button onClick={() => setMerchantMode("select")} className="flex-1 px-3 py-2 rounded-xl text-sm font-bold" style={{ background: merchantMode === "select" ? C.teal : "transparent", color: merchantMode === "select" ? "#fff" : C.inkSoft }}>إدارة محل موجود</button>
          <button onClick={() => setMerchantMode("register")} className="flex-1 px-3 py-2 rounded-xl text-sm font-bold" style={{ background: merchantMode === "register" ? C.teal : "transparent", color: merchantMode === "register" ? "#fff" : C.inkSoft }}>تسجيل محل جديد</button>
        </div>
        {merchantMode === "select" && (<div className="p-5 rounded-2xl space-y-3" style={{ background: "#fff", border: `1px solid ${C.line}` }}><h3 className="font-black text-lg" style={{ fontFamily: "'Reem Kufi', sans-serif", color: C.ink }}>اختر محلك للتجربة</h3><div className="space-y-2">{stores.map((s) => (<button key={s.id} onClick={() => setMyStoreId(s.id)} className="w-full flex items-center justify-between p-3 rounded-xl text-right" style={{ border: `1px solid ${C.line}` }}><div className="flex items-center gap-2.5"><StoreAvatar logo={s.logo} size={32} /><div><div className="text-sm font-bold" style={{ color: C.ink }}>{s.name}</div><div className="text-xs" style={{ color: C.inkSoft }}>{s.wilaya} · {s.commune}</div></div></div><span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: STORE_STATUS[s.status].color + "25", color: STORE_STATUS[s.status].color }}>{STORE_STATUS[s.status].label}</span></button>))}</div></div>)}
        {merchantMode === "register" && (
          <div className="p-6 rounded-2xl space-y-4" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
            <h3 className="font-black text-lg" style={{ fontFamily: "'Reem Kufi', sans-serif", color: C.ink }}>سجّل محلك — المرحلة 1</h3>
            <input placeholder="اسم السوبر ماركت" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} />
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ border: `1px solid ${C.line}` }}><Phone size={15} color={C.inkSoft} /><input data-testid="merchant-identifier-input" placeholder="رقم الهاتف أو البريد الإلكتروني" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value, mockOtpCode: "" })} className="flex-1 outline-none text-sm bg-transparent" dir="ltr" inputMode={form.contact.includes("@") ? "email" : "tel"} /></div>
            {!usesPhoneIdentity && <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ border: `1px solid ${C.line}` }}><Phone size={15} color={C.inkSoft} /><input placeholder="رقم الهاتف للتواصل (05/06/07)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="flex-1 outline-none text-sm bg-transparent" inputMode="tel" /></div>}
            {usesPhoneIdentity && <div className="p-3 rounded-xl space-y-2" style={{ background: C.ochre + "12", border: `1px solid ${C.ochre}44` }}><p className="text-[11px] font-bold" style={{ color: C.ink }}>تأكيد الهاتف في وضع OTP التجريبي. الرمز: 123456</p><input aria-label="رمز OTP التجريبي للتاجر" value={form.mockOtpCode} onChange={(e) => setForm({ ...form, mockOtpCode: e.target.value.replace(/\D/g, "").slice(0, 6) })} placeholder="رمز OTP التجريبي" inputMode="numeric" className="w-full px-3 py-2 rounded-lg text-sm outline-none bg-white" style={{ border: `1px solid ${C.line}` }} /></div>}
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ border: `1px solid ${C.line}` }}><Lock size={15} color={C.inkSoft} /><input type="password" placeholder="كلمة المرور (4 أحرف على الأقل)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="flex-1 outline-none text-sm bg-transparent" dir="ltr" /></div>
            <WilayaCommuneSelect wilaya={form.wilaya} commune={form.commune} onChange={({ wilaya, commune }) => setForm({ ...form, wilaya, commune })} />
            <div><div className="flex items-center justify-between mb-1.5"><span className="text-xs font-bold flex items-center gap-1" style={{ color: C.ink }}><MapPin size={13} /> موقع المحل</span><button type="button" onClick={() => setShowMapPicker(true)} className="text-xs font-bold" style={{ color: C.teal }}>تحديد / تعديل</button></div><MapPreview x={form.lng} y={form.lat} height={70} /></div>
            {authError && <p className="text-xs font-bold" style={{ color: "#8B3A2A" }}>{authError}</p>}
            <button disabled={isSubmitting} onClick={registerStore} className="w-full py-3 rounded-xl font-black disabled:opacity-50" style={{ background: C.teal, color: "#fff" }}>{isSubmitting ? "جارٍ إنشاء الحساب..." : "إرسال طلب التسجيل"}</button>
            <p className="text-[10px] text-center" style={{ color: C.inkSoft }}>يمكنك الدخول برقم الهاتف أو البريد الإلكتروني؛ OTP تجريبي حتى تهيئة خدمة رسائل فعلية.</p>
            {showMapPicker && <MapPicker title="حدد موقع محلك" initial={{ x: form.lng, y: form.lat }} onConfirm={(pos) => setForm((f) => ({ ...f, lat: pos.y, lng: pos.x }))} onClose={() => setShowMapPicker(false)} />}
          </div>
        )}
      </div>
    );
  }

  if (myStore.status === "pending_review") {
    return (<div className="max-w-md mx-auto p-6 rounded-2xl text-center space-y-3" style={{ background: "#fff", border: `1px solid ${C.line}` }}><Loader2 size={30} color={C.ochre} className="animate-spin" style={{ margin: "0 auto" }} /><h3 className="font-black text-lg" style={{ fontFamily: "'Reem Kufi', sans-serif", color: C.ink }}>طلبك قيد المراجعة الأولية</h3><p className="text-sm" style={{ color: C.inkSoft }}>سيراجع المشرف بيانات <b style={{ color: C.ink }}>{myStore.name}</b> قريباً.</p><button onClick={() => setMyStoreId(null)} className="text-xs font-bold flex items-center gap-1 mx-auto" style={{ color: C.inkSoft }}><ChevronLeft size={13} /> تبديل المحل</button></div>);
  }

  if (myStore.status === "awaiting_profile") {
    return (
      <div className="max-w-md mx-auto p-6 rounded-2xl space-y-4" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
        <div className="flex items-center gap-2"><CheckCircle2 size={20} color={C.sage} /><h3 className="font-black text-lg" style={{ fontFamily: "'Reem Kufi', sans-serif", color: C.ink }}>أكمل ملف {myStore.name}</h3></div>
        <div className="flex gap-3"><label className="flex-1 text-xs" style={{ color: C.inkSoft }}>وقت الفتح<input type="number" min="0" max="23" value={stage2.open} onChange={(e) => setStage2({ ...stage2, open: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} /></label><label className="flex-1 text-xs" style={{ color: C.inkSoft }}>وقت الغلق<input type="number" min="0" max="23" value={stage2.close} onChange={(e) => setStage2({ ...stage2, close: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} /></label></div>
        <label className="text-xs" style={{ color: C.inkSoft }}>الحد الأدنى لقيمة الطلب (دج)<input type="number" min="0" value={stage2.minOrder} onChange={(e) => setStage2({ ...stage2, minOrder: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} /></label>

        <div>
          <span className="text-xs font-bold flex items-center gap-1 mb-1.5" style={{ color: C.ink }}><Truck2 size={13} /> هل تملك توصيلاً خاصاً بمحلك؟</span>
          <div className="flex gap-2 mb-2"><button onClick={() => setStage2({ ...stage2, hasOwnDelivery: true })} className="flex-1 py-2.5 rounded-xl text-sm font-bold" style={{ background: stage2.hasOwnDelivery ? C.teal : "transparent", color: stage2.hasOwnDelivery ? "#fff" : C.inkSoft, border: `1px solid ${stage2.hasOwnDelivery ? C.teal : C.line}` }}>نعم، لدي توصيل خاص</button><button onClick={() => setStage2({ ...stage2, hasOwnDelivery: false })} className="flex-1 py-2.5 rounded-xl text-sm font-bold" style={{ background: !stage2.hasOwnDelivery ? C.teal : "transparent", color: !stage2.hasOwnDelivery ? "#fff" : C.inkSoft, border: `1px solid ${!stage2.hasOwnDelivery ? C.teal : C.line}` }}>لا، اعتمد موصلي المنصة</button></div>
          {stage2.hasOwnDelivery && (
            <>
              <label className="text-xs block mb-2" style={{ color: C.inkSoft }}>رسوم توصيلك الخاص (دج)<input type="number" min="0" value={stage2.deliveryFee} onChange={(e) => setStage2({ ...stage2, deliveryFee: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} /></label>
              <p className="text-[11px] mb-1" style={{ color: C.inkSoft }}>نطاق التوصيل (البلديات التي يغطيها توصيلك):</p>
              <div className="flex flex-wrap gap-1.5">{getCommunes(myStore.wilaya).map((c) => (<button key={c} onClick={() => toggleDeliveryCommune(c)} className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: stage2.deliveryCommunes.includes(c) ? C.teal : "transparent", color: stage2.deliveryCommunes.includes(c) ? "#fff" : C.inkSoft, border: `1px solid ${stage2.deliveryCommunes.includes(c) ? C.teal : C.line}` }}>{c}</button>))}</div>
            </>
          )}
        </div>

        <div><span className="text-xs font-bold flex items-center gap-1 mb-1.5" style={{ color: C.ink }}><Palette size={13} /> شعار المحل</span><div className="flex items-center gap-2"><input placeholder="حرفان" maxLength={2} value={stage2.logoText} onChange={(e) => setStage2({ ...stage2, logoText: e.target.value })} className="flex-1 px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} /><div className="flex gap-1.5">{LOGO_COLORS.map((c) => <button key={c} onClick={() => setStage2({ ...stage2, logoColor: c })} className="rounded-full" style={{ width: 26, height: 26, background: c, border: stage2.logoColor === c ? `2.5px solid ${C.ink}` : "2.5px solid transparent" }} />)}</div><StoreAvatar logo={{ text: stage2.logoText || "؟؟", color: stage2.logoColor }} size={38} /></div></div>
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ border: `1px solid ${C.line}` }}><CreditCard size={15} color={C.inkSoft} /><input placeholder="رقم CCP / RIP" value={stage2.ccp} onChange={(e) => setStage2({ ...stage2, ccp: e.target.value })} className="flex-1 outline-none text-sm bg-transparent" /></div>
        <div><span className="text-xs font-bold flex items-center gap-1 mb-1.5" style={{ color: C.ink }}><FileText size={13} /> السجل التجاري / بطاقة التعريف</span><label className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl font-bold text-sm cursor-pointer" style={{ background: C.paperDark, border: `1.5px dashed ${C.line}`, color: C.inkSoft }}>{stage2.idDocName ? <><Check size={15} color={C.sage} /> {stage2.idDocName}</> : <><Upload size={15} /> اختر صورة أو ملف PDF</>}<input type="file" accept="image/*,.pdf" onChange={(e) => setStage2({ ...stage2, idDocName: e.target.files[0]?.name || "" })} className="hidden" /></label><p className="text-[10px] mt-1" style={{ color: C.inkSoft }}>* يُحفظ اسم الملف فقط في هذه المعاينة.</p></div>
        <button onClick={completeProfile} className="w-full py-3 rounded-xl font-black" style={{ background: C.rust, color: "#fff" }}>تفعيل المحل</button>
      </div>
    );
  }

  return (
    <div className="dashboard-shell space-y-5">
      <div className="p-4 rounded-2xl" style={{ background: C.paperDark }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3"><StoreAvatar logo={myStore.logo} size={44} /><div><div className="font-black" style={{ fontFamily: "'Reem Kufi', sans-serif", color: C.ink }}>{myStore.name}</div><div className="text-xs" style={{ color: C.inkSoft }}>{myStore.wilaya} · {myStore.commune} · {myStore.open}:00 - {myStore.close}:00</div><div className="flex items-center gap-1 mt-1"><StarRating value={Math.round(myStore.rating || 0)} size={11} /><span className="text-xs font-bold" style={{ color: C.inkSoft }}>{myStore.rating || "لا تقييمات بعد"}</span></div></div></div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end"><button data-testid="merchant-new-orders-counter" onClick={openNewMerchantOrders} className="flex items-center gap-1 text-xs font-black px-3 py-1.5 rounded-full" aria-label={`${newMerchantOrders.length} طلبات جديدة`} style={{ background: newMerchantOrders.length ? C.rust + "18" : C.sage + "22", color: newMerchantOrders.length ? C.rust : C.tealDark }}><Bell size={13} />{newMerchantOrders.length} طلبات جديدة</button><button data-testid="merchant-new-orders-link" onClick={openNewMerchantOrders} className="flex items-center gap-1 text-xs font-bold px-2 py-1.5 rounded-full" style={{ color: C.teal, border: `1px solid ${C.teal}55` }}><ArrowLeft size={12} /> عرض الطلبات الجديدة</button><span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: C.sage + "30", color: C.tealDark }}>محل مفعّل</span></div>
        </div>
        <div className="flex items-center gap-3 text-xs mb-2 flex-wrap" style={{ color: C.inkSoft }}>
          <span className="flex items-center gap-1"><Truck2 size={12} /> {myStore.hasOwnDelivery ? `توصيل خاص (${money(myStore.deliveryFee)})` : "يعتمد موصلي المنصة"}</span>
          <span className="flex items-center gap-1"><Percent size={12} /> {myStore.commissionType === "percentage" ? `عمولة ${myStore.commissionRate}% لكل طلب` : `اشتراك شهري ${money(myStore.subscriptionFee)}`}</span>
        </div>
        <div className="flex items-center justify-between mb-1.5"><span className="text-xs font-bold flex items-center gap-1" style={{ color: C.ink }}><MapPin size={12} /> {myStore.address || "لم يُحدد عنوان تفصيلي"}</span><button onClick={() => setShowMapPicker(true)} className="text-xs font-bold" style={{ color: C.teal }}>تعديل الموقع</button></div>
        <MapPreview x={myStore.lng ?? 50} y={myStore.lat ?? 50} height={64} />
        <button onClick={() => setMyStoreId(null)} className="mt-3 text-xs font-bold flex items-center gap-1" style={{ color: C.inkSoft }}><ChevronLeft size={13} /> تبديل المحل</button>
      </div>
      {showMapPicker && <MapPicker title="تعديل موقع المحل" initial={{ x: myStore.lng ?? 50, y: myStore.lat ?? 50 }} onConfirm={(pos) => updateStore({ lat: pos.y, lng: pos.x })} onClose={() => setShowMapPicker(false)} />}

      <div className="dashboard-tabs flex gap-2 flex-wrap">
        <button onClick={() => setTab("products")} className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: tab === "products" ? C.teal : "transparent", color: tab === "products" ? "#fff" : C.inkSoft, border: `1px solid ${tab === "products" ? C.teal : C.line}` }}>المنتجات</button>
        <button onClick={() => setTab("orders")} className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: tab === "orders" ? C.teal : "transparent", color: tab === "orders" ? "#fff" : C.inkSoft, border: `1px solid ${tab === "orders" ? C.teal : C.line}` }}>الطلبات الواردة {newMerchantOrders.length > 0 && `(${newMerchantOrders.length})`}</button>
        <button onClick={() => setTab("delivery")} className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: tab === "delivery" ? C.teal : "transparent", color: tab === "delivery" ? "#fff" : C.inkSoft, border: `1px solid ${tab === "delivery" ? C.teal : C.line}` }}>إعدادات التوصيل</button>
        <button data-testid="merchant-qr-tab" onClick={() => setTab("qr")} className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: tab === "qr" ? C.teal : "transparent", color: tab === "qr" ? "#fff" : C.inkSoft, border: `1px solid ${tab === "qr" ? C.teal : C.line}` }}>QR المحل</button>
        <button onClick={() => setTab("messages")} className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: tab === "messages" ? C.teal : "transparent", color: tab === "messages" ? "#fff" : C.inkSoft, border: `1px solid ${tab === "messages" ? C.teal : C.line}` }}>الرسائل</button>
      </div>

      {tab === "qr" && <MerchantQrPoster store={myStore} notify={notify} />}

      {tab === "products" && (
        <div className="space-y-4">
          <button onClick={() => setShowBulkImport(true)} className="w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5" style={{ background: C.teal + "15", color: C.teal, border: `1px dashed ${C.teal}` }}><Upload size={15} /> استيراد المنتجات من Excel / CSV دفعة واحدة</button>
          <div className="p-4 rounded-2xl flex flex-wrap gap-2 items-end" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
            <input placeholder="اسم المنتج" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} className="flex-1 min-w-[140px] px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} />
            <input placeholder="السعر" type="number" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} className="w-24 px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} />
            <input placeholder="الوحدة" value={newProduct.unit} onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })} className="w-24 px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} />
            <select value={newProduct.department} onChange={(e) => setNewProduct({ ...newProduct, department: e.target.value })} className="px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }}>{DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select>
            <button onClick={addProduct} className="px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-1" style={{ background: C.teal, color: "#fff" }}><Plus size={15} /> إضافة</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {myStore.products.map((p) => (<div key={p.id} className="p-4 rounded-2xl flex items-center justify-between" style={{ background: "#fff", border: `1px solid ${C.line}`, opacity: p.available ? 1 : 0.55 }}><div><div className="flex items-center gap-1.5 mb-1"><DeptBadge id={p.department} size={12} /><span className="text-[10px]" style={{ color: C.inkSoft }}>{deptInfo(p.department).label}</span></div><div className="font-bold text-sm" style={{ color: C.ink }}>{p.name}</div><div className="text-xs mb-2" style={{ color: C.inkSoft }}>{p.unit}</div><PriceTag amount={p.price} /></div><div className="flex flex-col gap-2 items-end"><button onClick={() => toggleAvailable(p.id)} className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: p.available ? C.sage + "25" : "#8883", color: p.available ? C.tealDark : C.inkSoft }}>{p.available ? "متوفر" : "نفد"}</button><button onClick={() => removeProduct(p.id)}><Trash2 size={16} color={C.rust} /></button></div></div>))}
            {myStore.products.length === 0 && <p className="col-span-2 text-center text-sm py-6" style={{ color: C.inkSoft }}>لم تُضف أي منتجات بعد.</p>}
          </div>
        </div>
      )}

      {tab === "orders" && (
        <div id="merchant-new-orders" tabIndex={-1} className="space-y-3 outline-none">
          {myOrders.length === 0 && <p className="text-center text-sm py-10" style={{ color: C.inkSoft }}>لا توجد طلبات واردة حالياً.</p>}
          {myOrders.map((o) => (<div key={o.id} className="p-4 rounded-2xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}><div className="flex items-center justify-between mb-2"><span className="font-bold text-sm" style={{ color: C.ink }}>{o.customer} · {o.createdAt}</span><StatusPill status={o.status} /></div><div className="text-xs mb-1" style={{ color: C.inkSoft }}>{o.items.map((i) => `${i.name} ×${i.qty}`).join(" · ")}</div><div className="text-xs mb-3 flex items-center gap-1" style={{ color: C.teal }}>{React.createElement(DELIVERY_LABELS[o.deliveryType]?.icon || Home, { size: 12 })} {DELIVERY_LABELS[o.deliveryType]?.label}{o.courier ? ` — ${o.courier.name}` : ""}</div>{o.isInterwilaya && <p className="text-[11px] font-bold mb-3" style={{ color: C.purple }}>توصيل بين الولايات · {Number(o.deliveryDistanceKm || 0).toFixed(1)} كم · {o.estimatedDeliveryMinutes || "—"} دقيقة</p>}<div className="flex items-center justify-between flex-wrap gap-2"><PriceTag amount={o.total} /><div className="flex gap-2 flex-wrap"><button onClick={() => setInvoiceOrder(o)} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ border: `1px solid ${C.line}`, color: C.inkSoft }}><Printer size={12} /> الفاتورة</button>{o.customerId && <button onClick={() => { const reason = window.prompt("سبب البلاغ (5 أحرف على الأقل)"); if (reason) reportCustomerAccount(o.customerId, reason, o.id); }} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ border: `1px solid ${C.rust}55`, color: C.rust }}>إبلاغ عن الحساب</button>}<button onClick={() => archiveOrder(o.id)} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: "#8B3A2A18", color: "#8B3A2A" }}><Trash2 size={12} /> حذف من قائمتي</button>{o.status === "pending" && (<><button onClick={() => setOrderStatus(o.id, "declined")} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: "#8B3A2A20", color: "#8B3A2A" }}><X size={13} /> رفض</button><button onClick={() => setOrderStatus(o.id, "accepted")} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: C.teal, color: "#fff" }}><Check size={13} /> قبول</button></>)}{nextStatus[o.status] && <button onClick={() => setOrderStatus(o.id, nextStatus[o.status])} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: C.rust, color: "#fff" }}>تحديث إلى «{STATUS_MAP[nextStatus[o.status]].label}»</button>}{o.status === "remittance_confirmed" && <button onClick={() => merchantConfirmSettlement(o.id)} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: C.sage, color: "#fff" }}><Wallet size={12} /> تأكيد استلام المستحقات</button>}</div></div></div>))}
        </div>
      )}

      {tab === "delivery" && (
        <div className="space-y-5">
          <div className="p-4 rounded-2xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
            <span className="text-xs font-bold flex items-center gap-1 mb-1.5" style={{ color: C.ink }}><Truck2 size={13} /> هل تملك توصيلاً خاصاً؟</span>
            <div className="flex gap-2 mb-3"><button onClick={() => updateStore({ hasOwnDelivery: true })} className="flex-1 py-2.5 rounded-xl text-sm font-bold" style={{ background: myStore.hasOwnDelivery ? C.teal : "transparent", color: myStore.hasOwnDelivery ? "#fff" : C.inkSoft, border: `1px solid ${myStore.hasOwnDelivery ? C.teal : C.line}` }}>نعم، لدي توصيل خاص</button><button onClick={() => updateStore({ hasOwnDelivery: false })} className="flex-1 py-2.5 rounded-xl text-sm font-bold" style={{ background: !myStore.hasOwnDelivery ? C.teal : "transparent", color: !myStore.hasOwnDelivery ? "#fff" : C.inkSoft, border: `1px solid ${!myStore.hasOwnDelivery ? C.teal : C.line}` }}>لا، اعتمد موصلي المنصة</button></div>
            {myStore.hasOwnDelivery && (
              <label className="text-xs block mb-2" style={{ color: C.inkSoft }}>رسوم توصيلك الخاص (دج)<input type="number" min="0" value={myStore.deliveryFee} onChange={(e) => updateStore({ deliveryFee: Number(e.target.value) })} className="w-full mt-1 px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} /></label>
            )}
            <div>
              <p className="text-[11px] mb-1 font-bold" style={{ color: C.ink }}>نطاق توصيل المحل (الأحياء والبلديات التي يغطيها)</p>
              <div className="flex gap-2 mb-2">
                <span className="text-xs font-bold self-center px-2" style={{ color: C.inkSoft }}>الولاية:</span>
                <select value={myStore.wilaya || ""} onChange={(e) => updateStore({ wilaya: e.target.value, deliveryCommunes: [] })} className="flex-1 px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }}>
                  {WILAYAS.map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
                <span className="text-xs font-bold self-center px-2" style={{ color: C.inkSoft }}>البلدية الرئيسية:</span>
                <select value={myStore.commune || ""} onChange={(e) => updateStore({ commune: e.target.value })} disabled={!myStore.wilaya} className="flex-1 px-3 py-2 rounded-xl text-sm outline-none disabled:opacity-50" style={{ border: `1px solid ${C.line}` }}>
                  <option value="">—</option>
                  {getCommunes(myStore.wilaya).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex flex-wrap gap-1.5">{getCommunes(myStore.wilaya).map((c) => (<button key={c} onClick={() => toggleStoreDeliveryCommune(c)} className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: (myStore.deliveryCommunes || []).includes(c) ? C.teal : "transparent", color: (myStore.deliveryCommunes || []).includes(c) ? "#fff" : C.inkSoft, border: `1px solid ${(myStore.deliveryCommunes || []).includes(c) ? C.teal : C.line}` }}>{c}</button>))}</div>
              <p className="text-[11px] mt-1.5" style={{ color: C.inkSoft }}>{(myStore.deliveryCommunes || []).length > 0 ? `المغطاة: ${myStore.deliveryCommunes.join("، ")}` : "لم تحدد بلديات بعد — يُعرض المحل للعملاء في الولاية بالكامل."}</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
            <span className="text-xs font-bold flex items-center gap-1 mb-2" style={{ color: C.ink }}><Bike size={13} /> الموصلون المتاحون في منطقتك</span>
            {matchingCouriers.length === 0 && <p className="text-xs" style={{ color: C.inkSoft }}>لا يوجد موصلون معتمدون يغطون منطقتك حالياً.</p>}
            <div className="space-y-2">
              {matchingCouriers.map((c) => {
                const isApproved = (myStore.approvedCourierIds || []).includes(c.id);
                return (
                  <div key={c.id} className="flex items-center justify-between p-2.5 rounded-xl flex-wrap gap-2" style={{ border: `1px solid ${C.line}` }}>
                    <div>
                      <div className="text-sm font-bold flex items-center gap-1" style={{ color: C.ink }}><Bike size={13} color={C.teal} /> {c.name} {c.storeMode === "selected" ? <Tag size={12} color={C.ochre} /> : null}</div>
                      <div className="text-xs mt-0.5" style={{ color: C.inkSoft }}>{c.vehicle} · نطاقه: {c.communes.join("، ") || (c.wilaya + " — كل البلديات")}</div>
                      <div className="text-xs mt-0.5" style={{ color: C.inkSoft }}>التواقيت: {c.timeLabel || c.availability.map((a) => AVAILABILITY_SLOTS.find((s) => s.id === a)?.label).join(" / ") || "—"} · المحلات: {c.storeMode === "all" ? "كل محلات المنطقة" : "محلات محددة فقط"}</div>
                      {c.storeMode === "selected" && (c.selectedStoreIds || []).includes(myStore.id) && <div className="text-[11px] font-bold mt-1" style={{ color: C.sage }}>✓ هذا الموصل اختار محلك من محلاته</div>}
                      {c.storeMode === "selected" && !(c.selectedStoreIds || []).includes(myStore.id) && <div className="text-[11px] mt-1" style={{ color: C.inkSoft }}>هذا الموصل لا يتعامل مع محلك حالياً</div>}
                    </div>
                    <button onClick={() => toggleApprovedCourier(c.id)} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: isApproved ? C.sage : C.teal + "15", color: isApproved ? "#fff" : C.teal }}>{isApproved ? "معتمد ✓" : "اعتماد"}</button>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] mt-2" style={{ color: C.inkSoft }}>الموصلون "المعتمدون" هم من يُقترحون أولاً للعملاء عند اختيار "موصل معتمد من المنصة".</p>
          </div>
        </div>
      )}

      {tab === "messages" && <MessagesInbox messages={messages} orders={myOrders} userId={userId} onArchiveMessage={archiveMessage} />}
      {invoiceOrder && <InvoiceModal order={invoiceOrder} store={myStore} onClose={() => setInvoiceOrder(null)} />}
      {showBulkImport && <BulkImportModal onConfirm={addBulkProducts} onClose={() => setShowBulkImport(false)} />}
    </div>
  );
}



/* ---------------------------------------------------------
   لوحة الموصل — الطلبات المتاحة حوله وساعات عمله
--------------------------------------------------------- */
function CourierQrCard({ courier, notify }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const deepLink = useMemo(() => `${window.location.origin}${window.location.pathname}?courier=${encodeURIComponent(courier.id)}`, [courier.id]);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(deepLink, { errorCorrectionLevel: "H", width: 560, margin: 2, color: { dark: C.ink, light: "#FFFFFF" } })
      .then((value) => { if (active) setQrDataUrl(value); })
      .catch(() => { if (active) notify("تعذر إنشاء رمز QR لملف الموصل."); });
    return () => { active = false; };
  }, [deepLink, notify]);

  async function copyLink() {
    try { await navigator.clipboard.writeText(deepLink); notify("تم نسخ رابط الموصل."); }
    catch { notify("تعذر النسخ تلقائياً؛ انسخ الرابط يدوياً."); }
  }

  return <div data-testid="courier-qr-card" className="mt-3 p-3 rounded-xl flex items-center gap-3 flex-wrap" style={{ background: "rgba(255,255,255,.55)", border: `1px solid ${C.line}` }}>
    <div className="bg-white rounded-lg p-1.5" style={{ border: `1px solid ${C.line}` }}>{qrDataUrl ? <img src={qrDataUrl} alt={`رمز QR للموصل ${courier.name}`} className="w-20 h-20" /> : <div className="w-20 h-20 flex items-center justify-center text-[10px]" style={{ color: C.inkSoft }}>جارٍ التوليد…</div>}</div>
    <div className="min-w-0 flex-1"><p className="text-xs font-black" style={{ color: C.ink }}>رمز QR الخاص بملف الموصل</p><p className="text-[11px] mt-1" style={{ color: C.inkSoft }}>مرتبط بالمعرّف الآمن للحساب: {courier.id.slice(0, 8)}…</p><button onClick={copyLink} className="mt-2 px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1" style={{ background: "#fff", color: C.teal, border: `1px solid ${C.teal}55` }}><Copy size={12} /> نسخ الرابط</button></div>
  </div>;
}

function CourierDashboard({ courierId, stores, orders, messages, couriers, setCouriers, notify, onLogout, claimReadyOrder, courierConfirmPickup, courierStartDelivery, courierConfirmDelivery, courierConfirmRemittance, archiveOrder, archiveMessage, userId }) {
  const [tab, setTab] = useState("available");
  const [orderStatusFilter, setOrderStatusFilter] = useState(() => {
    try { return window.sessionStorage.getItem("souq-jiran:courier-order-filter") || "all"; } catch { return "all"; }
  });
  const courier = (couriers || []).find((c) => c.id === courierId);
  const [editingHours, setEditingHours] = useState(false);

  if (!courier) {
    return (
      <div className="max-w-md mx-auto p-6 rounded-2xl text-center space-y-3" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
        <AlertCircle size={28} color={C.rust} style={{ margin: "0 auto" }} />
        <h3 className="font-black text-lg" style={{ fontFamily: "'Reem Kufi', sans-serif", color: C.ink }}>لا يوجد ملف موصل لحسابك</h3>
        <p className="text-sm" style={{ color: C.inkSoft }}>قد يكون حسابك لم يُوافق عليه بعد من المشرف، أو تم حذف ملفك.</p>
      </div>
    );
  }

  const approvedStores = (stores || []).filter((s) => s.status === "approved");
  const storeById = Object.fromEntries(approvedStores.map((s) => [s.id, s]));

  // الطلبات المتاحة: ضمن نطاق الموصل، توصيل بالموصلي، لم يُعيّن لها موصل
  const availableOrders = (orders || []).filter((o) => {
    if (o.deliveryType !== "courier" || o.status !== "ready" || o.courier) return false;
    const store = storeById[o.storeId];
    if (!store) return false;
    if (store.wilaya !== courier.wilaya) return false;
    if (courier.communes.length > 0 && !courier.communes.includes(store.commune)) return false;
    if (courier.storeMode === "selected" && !(courier.selectedStoreIds || []).includes(store.id)) return false;
    return true;
  });

  const myActiveOrders = (orders || []).filter((o) => o.courier?.id === courierId && !["settled", "declined", "cancelled"].includes(o.status));
  const completedOrders = (orders || []).filter((o) => o.courier?.id === courierId && o.status === "settled");
  const newAvailableOrdersCount = availableOrders.length;
  const visibleAvailableOrders = ["all", "ready"].includes(orderStatusFilter) ? availableOrders : [];
  const visibleMyActiveOrders = orderStatusFilter === "all" ? myActiveOrders : myActiveOrders.filter((order) => order.status === orderStatusFilter);
  const visibleCompletedOrders = ["all", "settled"].includes(orderStatusFilter) ? completedOrders : [];

  async function acceptOrder(orderId) { await claimReadyOrder(orderId); }
  async function advanceOrder(orderId, action) {
    const actions = { picked_up: courierConfirmPickup, out_for_delivery: courierStartDelivery, delivered: courierConfirmDelivery, remittance_confirmed: courierConfirmRemittance };
    await actions[action]?.(orderId);
  }

  function selectCourierOrderFilter(filter) {
    setOrderStatusFilter(filter);
    try { window.sessionStorage.setItem("souq-jiran:courier-order-filter", filter); } catch { /* التخزين غير متاح في بعض أوضاع الخصوصية */ }
    const targetTab = { ready: "available", assigned: "my", picked_up: "my", out_for_delivery: "my", customer_confirmed: "my", settled: "history", all: "available" }[filter] || "available";
    setTab(targetTab);
    window.requestAnimationFrame(() => document.getElementById("courier-new-orders")?.scrollIntoView({ block: "start" }));
  }

  function updateCourier(patch) { setCouriers((prev) => prev.map((c) => (c.id === courierId ? { ...c, ...patch } : c))); }

  const hoursText = courier.customHours
    ? `من ${courier.customHours.from} إلى ${courier.customHours.to}`
    : (courier.availability || []).map((a) => AVAILABILITY_SLOTS.find((s) => s.id === a)?.label).join(" / ") || "—";

  return (
    <div className="dashboard-shell space-y-5">
      <div className="p-4 rounded-2xl" style={{ background: C.paperDark }}>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center rounded-xl" style={{ width: 44, height: 44, background: C.teal, color: "#fff" }}><Bike size={22} /></span>
            <div>
              <div className="font-black" style={{ fontFamily: "'Reem Kufi', sans-serif", color: C.ink }}>{courier.name} {courier.status !== "approved" && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: C.ochre + "30", color: C.ochre }}>{courier.status === "pending" ? "بانتظار الموافقة" : courier.status}</span>}</div>
              <div className="text-xs" style={{ color: C.inkSoft }}>{courier.vehicle} · نطاقه: {courier.communes.join("، ") || (courier.wilaya + " — كل البلديات")}</div>
              <div className="text-xs mt-1" style={{ color: C.tealDark }}>التواقيت: <b>{hoursText}</b> · {courier.storeMode === "all" ? "كل محلات المنطقة" : `${(courier.selectedStoreIds || []).length} محل محدد`}</div>
            </div>
          </div>
          <button onClick={onLogout} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: "#8B3A2A20", color: "#8B3A2A" }}><LogOut size={12} /> خروج</button>
          </div>
          <CourierQrCard courier={courier} notify={notify} />
          <button data-testid="courier-new-orders-counter" onClick={() => selectCourierOrderFilter("ready")} className="w-full mb-2 p-3 rounded-xl flex items-center justify-between gap-3 text-right" aria-label={`${newAvailableOrdersCount} طلبات جديدة متاحة`} style={{ background: newAvailableOrdersCount ? C.teal + "10" : "rgba(255,255,255,.42)", border: `1px solid ${newAvailableOrdersCount ? C.teal + "38" : C.line}`, color: C.ink }}><span className="flex items-center gap-2 text-xs font-black"><span className="flex items-center justify-center rounded-lg" style={{ width: 28, height: 28, background: newAvailableOrdersCount ? C.teal : C.sage, color: "#fff" }}><Bell size={14} /></span>طلبات جديدة ضمن نطاقك</span><span className="text-sm font-black px-2.5 py-1 rounded-full" style={{ background: newAvailableOrdersCount ? C.teal : C.sage, color: "#fff" }}>{newAvailableOrdersCount}</span></button>
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap"><button data-testid="courier-new-orders-link" onClick={() => selectCourierOrderFilter("ready")} className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full" style={{ color: C.teal, border: `1px solid ${C.teal}55` }}><ArrowLeft size={12} /> عرض الطلبات الجديدة</button><label className="flex items-center gap-2 text-xs font-bold" style={{ color: C.inkSoft }}>فلتر الحالة<select data-testid="courier-order-status-filter" value={orderStatusFilter} onChange={(event) => selectCourierOrderFilter(event.target.value)} className="px-2 py-1 rounded-lg bg-white outline-none" style={{ border: `1px solid ${C.line}`, color: C.ink }}><option value="all">كل الحالات</option><option value="ready">طلبات جديدة متاحة</option><option value="assigned">بانتظار الاستلام من المحل</option><option value="picked_up">تم الاستلام</option><option value="out_for_delivery">في الطريق</option><option value="customer_confirmed">بانتظار تحويل المستحقات</option><option value="settled">مكتمل التسوية</option></select></label></div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setTab("available")} className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: tab === "available" ? C.teal : "transparent", color: tab === "available" ? "#fff" : C.inkSoft, border: `1px solid ${tab === "available" ? C.teal : C.line}` }}>الطلبات المتاحة {newAvailableOrdersCount > 0 && `(${newAvailableOrdersCount})`}</button>
          <button onClick={() => setTab("my")} className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: tab === "my" ? C.teal : "transparent", color: tab === "my" ? "#fff" : C.inkSoft, border: `1px solid ${tab === "my" ? C.teal : C.line}` }}>طلباتي النشطة {myActiveOrders.length > 0 && `(${myActiveOrders.length})`}</button>
          <button onClick={() => setTab("history")} className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: tab === "history" ? C.teal : "transparent", color: tab === "history" ? "#fff" : C.inkSoft, border: `1px solid ${tab === "history" ? C.teal : C.line}` }}>سجل التسليمات ({completedOrders.length})</button>
          <button onClick={() => setTab("hours")} className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: tab === "hours" ? C.teal : "transparent", color: tab === "hours" ? "#fff" : C.inkSoft, border: `1px solid ${tab === "hours" ? C.teal : C.line}` }}>ساعات العمل</button>
          <button onClick={() => setTab("messages")} className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: tab === "messages" ? C.teal : "transparent", color: tab === "messages" ? "#fff" : C.inkSoft, border: `1px solid ${tab === "messages" ? C.teal : C.line}` }}>الرسائل</button>
        </div>
      </div>

      {tab === "available" && (
        <div id="courier-new-orders" tabIndex={-1} className="space-y-3 outline-none">
          {courier.status !== "approved" && <p className="text-xs font-bold p-3 rounded-xl" style={{ background: C.ochre + "18", color: C.ochre }}>حسابك قيد مراجعة المشرف — ستظهر الطلبات بعد الموافقة على انضمامك.</p>}
          {visibleAvailableOrders.length === 0 && <div className="text-center py-14 rounded-2xl" style={{ background: "#fff", border: `1px dashed ${C.line}` }}><Bike size={28} style={{ margin: "0 auto 8px", color: C.inkSoft }} /><p className="text-sm" style={{ color: C.inkSoft }}>{orderStatusFilter === "all" || orderStatusFilter === "ready" ? "لا توجد طلبات متاحة في نطاقك حاليًا." : "لا توجد طلبات مطابقة للفلتر الحالي."}</p></div>}
          {visibleAvailableOrders.map((o) => (
            <div key={o.id} className="p-4 rounded-2xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
              <div className="flex items-center justify-between mb-2"><span className="font-bold text-sm" style={{ color: C.ink }}>{o.storeName}</span><StatusPill status={o.status} /></div>
              <div className="text-xs mb-1" style={{ color: C.inkSoft }}>{o.items.map((i) => `${i.name} ×${i.qty}`).join(" · ")}</div>
              <div className="text-xs mb-3" style={{ color: C.inkSoft }}>العميل: {o.customer} · {o.createdAt}</div>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <PriceTag amount={o.total} />
                <div className="flex gap-2">
                  <button onClick={() => acceptOrder(o.id)} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: C.teal, color: "#fff" }}><Check size={13} /> قبول واستلام</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "my" && (
        <div className="space-y-3">
          {visibleMyActiveOrders.length === 0 && <div className="text-center py-14 rounded-2xl" style={{ background: "#fff", border: `1px dashed ${C.line}` }}><ClipboardList size={28} style={{ margin: "0 auto 8px", color: C.inkSoft }} /><p className="text-sm" style={{ color: C.inkSoft }}>{orderStatusFilter === "all" || orderStatusFilter === "assigned" ? "لا توجد طلبات نشطة لديك." : "لا توجد طلبات مطابقة للفلتر الحالي."}</p></div>}
          {visibleMyActiveOrders.map((o) => {
            const store = storeById[o.storeId];
            return (
              <div key={o.id} className="p-4 rounded-2xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
                <div className="flex items-center justify-between mb-2"><span className="font-bold text-sm" style={{ color: C.ink }}>{o.storeName}</span><StatusPill status={o.status} /></div>
                <div className="text-xs mb-1" style={{ color: C.inkSoft }}>{o.items.map((i) => `${i.name} ×${i.qty}`).join(" · ")}</div>
                {store && <div className="text-xs mb-3 flex items-center gap-1" style={{ color: C.teal }}><MapPin size={12} /> {store.wilaya} · {store.commune}{store.phone ? ` · هاتف المحل: ${store.phone}` : ""}</div>}
                <OrderTracker status={o.status} />
                <div className="flex gap-2 mt-3 pt-3 flex-wrap" style={{ borderTop: `1px solid ${C.line}` }}>
                  {o.status === "assigned" && <button onClick={() => advanceOrder(o.id, "picked_up")} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: C.teal, color: "#fff" }}><PackageCheck size={12} /> تأكيد استلام الطلب من المحل</button>}
                  {o.status === "picked_up" && <button onClick={() => advanceOrder(o.id, "out_for_delivery")} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: C.teal, color: "#fff" }}><Navigation size={12} /> بدء التوصيل</button>}
                  {o.status === "out_for_delivery" && <button onClick={() => advanceOrder(o.id, "delivered")} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: C.sage, color: "#fff" }}><Check size={12} /> تأكيد التسليم للعميل</button>}
                  {o.status === "customer_confirmed" && <button onClick={() => advanceOrder(o.id, "remittance_confirmed")} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: C.purple, color: "#fff" }}><Wallet size={12} /> تأكيد تحويل المستحقات للتاجر</button>}
                  <button onClick={() => archiveOrder(o.id)} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: "#8B3A2A18", color: "#8B3A2A" }}><Trash2 size={12} /> حذف من قائمتي</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-3">
          {visibleCompletedOrders.length === 0 && <div className="text-center py-14 rounded-2xl" style={{ background: "#fff", border: `1px dashed ${C.line}` }}><CheckCircle2 size={28} style={{ margin: "0 auto 8px", color: C.inkSoft }} /><p className="text-sm" style={{ color: C.inkSoft }}>{orderStatusFilter === "all" || orderStatusFilter === "settled" ? "لم تُغلق أي طلبات بالتسوية بعد." : "لا توجد طلبات مطابقة للفلتر الحالي."}</p></div>}
          {visibleCompletedOrders.map((o) => (
            <div key={o.id} className="p-4 rounded-2xl flex items-center justify-between" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
              <div><div className="text-sm font-bold" style={{ color: C.ink }}>{o.storeName} → {o.customer}</div><div className="text-xs mt-0.5" style={{ color: C.inkSoft }}>{o.items.map((i) => `${i.name} ×${i.qty}`).join(" · ")} · {o.createdAt}</div></div>
              <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: C.sage + "25", color: C.tealDark }}>تم التسليم ✓</span>
            </div>
          ))}
        </div>
      )}

      {tab === "messages" && <MessagesInbox messages={messages} orders={[...myActiveOrders, ...completedOrders]} userId={userId} onArchiveMessage={archiveMessage} />}

      {tab === "hours" && (
        <div className="p-5 rounded-2xl space-y-4" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
          <div className="flex items-center justify-between">
            <h4 className="font-black text-sm flex items-center gap-1.5" style={{ color: C.ink }}><Clock size={14} color={C.teal} /> ساعات عملك</h4>
            <button onClick={() => setEditingHours(!editingHours)} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ border: `1px solid ${C.line}`, color: C.teal }}>{editingHours ? "إلغاء" : "تعديل"}</button>
          </div>
          {editingHours ? (
            <CourierHoursEditor courier={courier} onSave={(patch) => { updateCourier(patch); setEditingHours(false); notify("تم تحديث ساعات عملك"); }} />
          ) : (
            <div className="space-y-2 text-xs" style={{ color: C.inkSoft }}>
              <div className="flex justify-between p-2.5 rounded-xl" style={{ background: C.paperDark }}><span>نمط التوقيت</span><b style={{ color: C.ink }}>{courier.customHours ? "ساعات محددة" : "أوقات عامة"}</b></div>
              {courier.customHours ? (
                <div className="flex justify-between p-2.5 rounded-xl" style={{ background: C.paperDark }}><span>الساعات</span><b dir="ltr" style={{ color: C.ink }}>{courier.customHours.from} → {courier.customHours.to}</b></div>
              ) : (
                <div className="flex justify-between p-2.5 rounded-xl" style={{ background: C.paperDark }}><span>الأوقات</span><b style={{ color: C.ink }}>{(courier.availability || []).map((a) => AVAILABILITY_SLOTS.find((s) => s.id === a)?.label).join(" / ") || "—"}</b></div>
              )}
              <div className="flex justify-between p-2.5 rounded-xl" style={{ background: C.paperDark }}><span>نطاق التغطية</span><b style={{ color: C.ink }}>{courier.wilaya} — {courier.communes.join("، ") || "كل البلديات"}</b></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   محرر ساعات عمل الموصل
--------------------------------------------------------- */
function CourierHoursEditor({ courier, onSave }) {
  const [availability, setAvailability] = useState(courier.availability || []);
  const [useCustomHours, setUseCustomHours] = useState(Boolean(courier.customHours));
  const [hoursFrom, setHoursFrom] = useState(courier.customHours?.from || "08:00");
  const [hoursTo, setHoursTo] = useState(courier.customHours?.to || "18:00");

  function toggleSlot(id) { setAvailability((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]); }

  function save() {
    if (!useCustomHours && availability.length === 0) { return; }
    onSave(useCustomHours ? { availability: [], customHours: { from: hoursFrom, to: hoursTo } } : { availability, customHours: null });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">{AVAILABILITY_SLOTS.map((s) => (<button key={s.id} onClick={() => toggleSlot(s.id)} className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-xs font-bold" style={{ background: availability.includes(s.id) ? C.teal : "#fff", color: availability.includes(s.id) ? "#fff" : C.inkSoft, border: `1px solid ${availability.includes(s.id) ? C.teal : C.line}` }}><s.icon size={15} /> {s.label}</button>))}</div>
      <label className="flex items-center gap-1.5 text-xs" style={{ color: C.inkSoft }}><input type="checkbox" checked={useCustomHours} onChange={(e) => setUseCustomHours(e.target.checked)} /> أو تحديد ساعات محددة</label>
      {useCustomHours && (<div className="flex gap-2"><input type="time" value={hoursFrom} onChange={(e) => setHoursFrom(e.target.value)} className="flex-1 px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} /><input type="time" value={hoursTo} onChange={(e) => setHoursTo(e.target.value)} className="flex-1 px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} /></div>)}
      <button onClick={save} disabled={!useCustomHours && availability.length === 0} className="w-full py-2.5 rounded-xl font-black disabled:opacity-40" style={{ background: C.teal, color: "#fff" }}>حفظ ساعات العمل</button>
    </div>
  );
}

/* ===========================================================
   ADMIN VIEW
=========================================================== */
function AdminView({ stores, orders, messages, couriers, archiveAuditLogs = [], archiveNotifications = [], orderNotifications = [], mockMessages = [], archiveAlertSettings, testAccountCandidates = [], testAccountReviewAuditLogs = [], customerReports = [], customerBlacklist = [], deliveryPricing, referralAnalytics = { totalReferrals: 0, qualifiedReferrals: 0, awardedReferrals: 0, issuedCoupons: 0, redeemedCoupons: 0, redeemedValue: 0 }, notify, setProviderStatus, deleteOrderPermanently, deleteMessagePermanently, deleteTestAccount, markArchiveNotificationRead, markOrderNotificationRead, markAllOrderNotificationsRead, saveArchiveAlertSettings, setCustomerBlacklist, saveDeliveryPricing }) {
  const pendingReview = stores.filter((s) => s.status === "pending_review");
  const awaitingProfile = stores.filter((s) => s.status === "awaiting_profile");
  const approved = stores.filter((s) => s.status === "approved");
  const revenue = orders.filter((o) => o.status === "delivered").reduce((a, o) => a + o.total, 0);
  const pendingCouriers = couriers.filter((c) => c.status === "pending");
  const [archiveQuery, setArchiveQuery] = useState("");
  const [archiveType, setArchiveType] = useState("all");
  const [archiveStatus, setArchiveStatus] = useState("all");
  const [auditAction, setAuditAction] = useState("all");
  const [onlyUnreadAlerts, setOnlyUnreadAlerts] = useState(false);
  const [onlyUnreadOrderNotifications, setOnlyUnreadOrderNotifications] = useState(false);
  const [testAccountQuery, setTestAccountQuery] = useState("");
  const [settingsDraft, setSettingsDraft] = useState(() => ({ ...archiveAlertSettings }));
  const [pricingDraft, setPricingDraft] = useState(() => ({ baseFee: deliveryPricing?.baseFee ?? 120, feePerKm: deliveryPricing?.feePerKm ?? 18, feePerKg: deliveryPricing?.feePerKg ?? 35, interwilayaSurcharge: deliveryPricing?.interwilayaSurcharge ?? 600, minimumFee: deliveryPricing?.minimumFee ?? 120, averageSpeedKmh: deliveryPricing?.averageSpeedKmh ?? 45 }));
  const [couponRedemptionThreshold, setCouponRedemptionThreshold] = useState(() => Number(window.localStorage.getItem("souq-jiran-coupon-redemption-threshold") || 70));
  useEffect(() => setSettingsDraft({ ...archiveAlertSettings }), [archiveAlertSettings]);
  useEffect(() => { if (deliveryPricing) setPricingDraft(deliveryPricing); }, [deliveryPricing]);
  const issuedCoupons = Number(referralAnalytics.issuedCoupons || 0);
  const redeemedCoupons = Number(referralAnalytics.redeemedCoupons || 0);
  const couponRedemptionRate = issuedCoupons > 0 ? Math.round((redeemedCoupons / issuedCoupons) * 100) : 0;
  const couponRateAlert = issuedCoupons > 0 && couponRedemptionRate >= couponRedemptionThreshold;

  function updateCouponRedemptionThreshold(value) {
    const normalized = Math.min(100, Math.max(1, Number(value) || 1));
    setCouponRedemptionThreshold(normalized);
    window.localStorage.setItem("souq-jiran-coupon-redemption-threshold", String(normalized));
  }

  function exportMonthlyReferralCSV() {
    const monthLabel = new Intl.DateTimeFormat("ar-DZ", { month: "long", year: "numeric" }).format(new Date());
    const rows = [
      ["الشهر", "الدعوات المسجلة", "الطلبات الأولى المؤهلة", "المكافآت الممنوحة", "القسائم الصادرة", "القسائم المستردة", "معدل الاسترداد", "قيمة الخصم المسترد"],
      [monthLabel, referralAnalytics.totalReferrals || 0, referralAnalytics.qualifiedReferrals || 0, referralAnalytics.awardedReferrals || 0, issuedCoupons, redeemedCoupons, `${couponRedemptionRate}%`, referralAnalytics.redeemedValue || 0],
    ];
    const csv = rows.map((row) => row.map(escapeCSVCell).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `souq-jiran-referral-coupons-${new Date().toISOString().slice(0, 7)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    notify("تم تنزيل تقرير الإحالات والقسائم الشهري بصيغة CSV.");
  }

  async function approveInitial(id) { if (await setProviderStatus("merchant", id, "approved")) notify("تم اعتماد التاجر."); }
  async function reject(id) { if (await setProviderStatus("merchant", id, "suspended")) notify("تم تعليق طلب التاجر."); }
  async function approveCourier(id) { if (await setProviderStatus("courier", id, "approved")) notify("تم اعتماد الموصل."); }
  async function rejectCourier(id) { if (await setProviderStatus("courier", id, "suspended")) notify("تم تعليق طلب الموصل."); }

  function storeCommissionDue(store) { if (store.commissionType !== "percentage") return 0; const earned = orders.filter((o) => o.storeId === store.id && o.status === "delivered").reduce((a, o) => a + (o.subtotal || 0) * (store.commissionRate / 100), 0); return Math.max(0, Math.round(earned - (store.duesPaid || 0))); }
  function settleDues(store) { notify(`إدارة العمولات ستُحفظ في مرحلة مالية مستقلة؛ لم يُسجّل تحصيل ${store.name}.`); }
  function updateCommission() { notify("إعدادات العمولة ليست ضمن ترحيل المنتجات والطلبات الحالي."); }

  const normalizedArchiveQuery = archiveQuery.trim().toLocaleLowerCase("ar-DZ");
  const includesArchiveQuery = (values) => !normalizedArchiveQuery || values.some((value) => String(value || "").toLocaleLowerCase("ar-DZ").includes(normalizedArchiveQuery));
  const filteredArchiveOrders = orders.filter((order) => (archiveType === "all" || archiveType === "orders") && (archiveStatus === "all" || order.status === archiveStatus) && includesArchiveQuery([order.storeName, order.customer, order.status, order.items.map((item) => item.name).join(" ")]));
  const filteredArchiveMessages = messages.filter((message) => (archiveType === "all" || archiveType === "messages") && includesArchiveQuery([message.body, message.orderId, message.createdAt]));
  const visibleAuditLogs = archiveAuditLogs.filter((entry) => auditAction === "all" || entry.action === auditAction);
  const visibleNotifications = archiveNotifications.filter((entry) => !onlyUnreadAlerts || !entry.isRead);
  const unreadAlertsCount = archiveNotifications.filter((entry) => !entry.isRead).length;
  const visibleOrderNotifications = orderNotifications.filter((entry) => !onlyUnreadOrderNotifications || !entry.isRead);
  const unreadOrderNotificationsCount = orderNotifications.filter((entry) => !entry.isRead).length;
  const normalizedTestAccountQuery = testAccountQuery.trim().toLocaleLowerCase("ar-DZ");
  const filteredTestAccounts = testAccountCandidates.filter((account) => !normalizedTestAccountQuery || [account.name, account.email, account.roleLabel].some((value) => String(value || "").toLocaleLowerCase("ar-DZ").includes(normalizedTestAccountQuery)));

  function exportTestAccountReviewCSV() {
    if (testAccountReviewAuditLogs.length === 0) { notify("لا توجد عمليات مراجعة لتصديرها بعد."); return; }
    const rows = [
      ["الإجراء", "بريد الحساب المستهدف", "تاريخ ووقت المراجعة"],
      ...testAccountReviewAuditLogs.map((entry) => [entry.actionLabel, entry.targetEmail, entry.createdAt]),
    ];
    const csv = rows.map((row) => row.map(escapeCSVCell).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "test-account-review-audit.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    notify("تم تصدير سجل مراجعة حسابات الاختبار بصيغة CSV.");
  }

  const totalDues = approved.filter((s) => s.commissionType === "percentage").reduce((a, s) => a + storeCommissionDue(s), 0);
  const stats = [
    { label: "محلات مفعّلة", value: approved.length, icon: Building2, color: C.teal },
    { label: "قيد المراجعة", value: pendingReview.length, icon: AlertCircle, color: C.ochre },
    { label: "الإيرادات المكتملة", value: money(revenue), icon: TrendingUp, color: C.sage },
    { label: "مستحقات المنصة غير المحصّلة", value: money(totalDues), icon: Wallet, color: C.rust },
  ];

  return (
    <div className="dashboard-shell space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{stats.map((s) => (<div key={s.label} className="p-4 rounded-2xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}><s.icon size={18} color={s.color} /><div className="font-black text-lg mt-2" style={{ color: C.ink }}>{s.value}</div><div className="text-xs" style={{ color: C.inkSoft }}>{s.label}</div></div>))}</div>

      <section className="p-4 sm:p-5 rounded-2xl space-y-3" style={{ background: "linear-gradient(135deg, #FFFFFF 0%, #F3FAF8 100%)", border: `1px solid ${C.teal}33` }} data-testid="admin-referral-analytics">
        <div className="flex items-start justify-between gap-3 flex-wrap"><div><h3 className="font-black" style={{ color: C.ink }}>تحليلات الإحالات والقسائم</h3><p className="text-xs mt-1" style={{ color: C.inkSoft }}>مؤشرات مجمّعة فقط؛ لا تظهر أرقام الهواتف أو أكواد العملاء الشخصية.</p></div><button onClick={exportMonthlyReferralCSV} className="text-xs px-3 py-2 rounded-xl font-black" style={{ background: C.teal, color: "#fff" }}>تنزيل تقرير CSV الشهري</button></div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">{[
          ["دعوات مسجلة", referralAnalytics.totalReferrals, C.purple], ["أول طلب مؤهل", referralAnalytics.qualifiedReferrals, C.ochre], ["مكافآت ممنوحة", referralAnalytics.awardedReferrals, C.sage], ["قسائم صادرة", referralAnalytics.issuedCoupons, C.teal], ["قسائم مستردة", referralAnalytics.redeemedCoupons, C.rust], ["قيمة الخصم المسترد", money(referralAnalytics.redeemedValue), C.ink],
        ].map(([label, value, color]) => <div key={label} className="p-3 rounded-xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}><p className="font-black text-base" style={{ color }}>{value}</p><p className="text-[11px] mt-1" style={{ color: C.inkSoft }}>{label}</p></div>)}</div>
        <div className="p-3 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3" style={{ background: couponRateAlert ? C.rust + "14" : "#fff", border: `1px solid ${couponRateAlert ? C.rust : C.line}` }} data-testid="coupon-redemption-alert"><div><p className="text-sm font-black" style={{ color: couponRateAlert ? C.rust : C.ink }}>معدل استرداد القسائم: {couponRedemptionRate}%</p><p className="text-[11px] mt-1" style={{ color: C.inkSoft }}>{couponRateAlert ? "تنبيه إداري: معدل الاسترداد بلغ الحد أو تجاوزه؛ راجع حملة القسائم قبل توسيعها." : "المعدل ضمن الحد الإداري المحدد."}</p></div><label className="text-[11px] font-bold shrink-0" style={{ color: C.inkSoft }}>حد التنبيه (%)<input aria-label="حد تنبيه معدل الاسترداد" type="number" min="1" max="100" value={couponRedemptionThreshold} onChange={(event) => updateCouponRedemptionThreshold(event.target.value)} className="block mt-1 w-24 px-2.5 py-2 rounded-lg outline-none" style={{ border: `1px solid ${C.line}`, color: C.ink, background: "#fff" }} /></label></div>
      </section>

      <section className="p-4 sm:p-5 rounded-2xl space-y-4" style={{ background: "#fff", border: `1px solid ${C.line}` }} data-testid="advanced-order-admin-panel">
        <div><h3 className="font-black" style={{ color: C.ink }}>ضبط جدية العملاء وتسعير التوصيل</h3><p className="text-xs mt-1" style={{ color: C.inkSoft }}>المبالغ التالية تستخدمها خدمة التسعير في الخادم؛ لا تُعدّل رسوم طلب قائم.</p></div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">{[["baseFee", "الرسم الأساسي"], ["feePerKm", "رسم الكيلومتر"], ["feePerKg", "رسم الكيلوغرام"], ["interwilayaSurcharge", "إضافة بين الولايات"], ["minimumFee", "الحد الأدنى"], ["averageSpeedKmh", "السرعة المتوسطة"]].map(([key, label]) => <label key={key} className="text-xs font-bold" style={{ color: C.inkSoft }}>{label}<input type="number" min="0" value={pricingDraft[key] ?? ""} onChange={(e) => setPricingDraft((draft) => ({ ...draft, [key]: Number(e.target.value) }))} className="mt-1 w-full px-2.5 py-2 rounded-lg outline-none" style={{ border: `1px solid ${C.line}`, color: C.ink }} /></label>)}</div>
        <button onClick={() => saveDeliveryPricing(pricingDraft)} className="text-xs px-3 py-2 rounded-xl font-black" style={{ background: C.purple, color: "#fff" }}>حفظ إعدادات التسعير</button>
        <div className="pt-3" style={{ borderTop: `1px solid ${C.line}` }}><h4 className="font-black text-sm" style={{ color: C.ink }}>بلاغات العملاء المفتوحة</h4><div className="space-y-2 mt-2">{customerReports.filter((report) => report.status === "open").map((report) => <div key={report.id} className="p-3 rounded-xl flex items-start justify-between gap-3" style={{ background: C.paperDark }}><div><p className="text-xs font-bold" style={{ color: C.ink }}>{report.reason}</p><p className="text-[11px] mt-1" style={{ color: C.inkSoft }}>طلب مرتبط: {report.relatedOrderId ? report.relatedOrderId.slice(0, 8) : "غير محدد"}</p></div><button onClick={() => setCustomerBlacklist(report.customerId, report.reason, true)} className="text-xs px-2.5 py-1.5 rounded-lg font-bold shrink-0" style={{ background: C.rust, color: "#fff" }}>حظر الحساب</button></div>)}{customerReports.filter((report) => report.status === "open").length === 0 && <p className="text-xs py-2" style={{ color: C.inkSoft }}>لا توجد بلاغات مفتوحة.</p>}</div></div>
        <div className="pt-3" style={{ borderTop: `1px solid ${C.line}` }}><h4 className="font-black text-sm" style={{ color: C.ink }}>الحسابات المحظورة</h4><div className="space-y-2 mt-2">{customerBlacklist.filter((entry) => !entry.revokedAt).map((entry) => <div key={entry.customerId} className="p-3 rounded-xl flex items-center justify-between gap-3" style={{ background: C.rust + "10" }}><div><p className="text-xs font-bold" style={{ color: C.ink }}>{entry.reason}</p><p className="text-[11px] mt-1" style={{ color: C.inkSoft }}>معرّف العميل: {entry.customerId.slice(0, 8)}</p></div><button onClick={() => setCustomerBlacklist(entry.customerId, entry.reason, false)} className="text-xs px-2.5 py-1.5 rounded-lg font-bold" style={{ border: `1px solid ${C.rust}`, color: C.rust }}>رفع الحظر</button></div>)}{customerBlacklist.filter((entry) => !entry.revokedAt).length === 0 && <p className="text-xs py-2" style={{ color: C.inkSoft }}>لا توجد حسابات محظورة حالياً.</p>}</div></div>
      </section>

      <section className="p-4 sm:p-5 rounded-2xl space-y-3" style={{ background: "linear-gradient(135deg, #FFFFFF 0%, #EEF0FF 100%)", border: `1px solid ${C.teal}30` }} data-testid="admin-mock-messaging-panel">
        <div className="flex items-start justify-between gap-3 flex-wrap"><div className="flex items-start gap-3"><span className="flex items-center justify-center rounded-xl shrink-0" style={{ width: 40, height: 40, background: C.teal, color: "#fff" }}><MessageCircle size={19} /></span><div><h3 className="font-black" style={{ color: C.ink }}>قنوات الرسائل والأتمتة</h3><p className="text-xs mt-1 leading-5" style={{ color: C.inkSoft }}>وضع الاختبار مفعل: تُحاكى رسائل WhatsApp وViber وسجلها هنا، ولا تُرسل أي رسالة خارج التطبيق.</p></div></div><span className="text-[11px] font-black px-2.5 py-1 rounded-full" style={{ background: C.ochre + "20", color: C.ochre }}>Mock Mode</span></div>
        <div className="grid sm:grid-cols-3 gap-2 text-xs"><div className="p-3 rounded-xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}><p className="font-black" style={{ color: C.ink }}>WhatsApp Business</p><p className="mt-1" style={{ color: C.inkSoft }}>جاهز للمفتاح لاحقاً</p></div><div className="p-3 rounded-xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}><p className="font-black" style={{ color: C.ink }}>Viber Bot</p><p className="mt-1" style={{ color: C.inkSoft }}>جاهز للمفتاح لاحقاً</p></div><div className="p-3 rounded-xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}><p className="font-black" style={{ color: C.ink }}>CallMeBot</p><p className="mt-1" style={{ color: C.inkSoft }}>اختياري للتجارب فقط</p></div></div>
        <p className="text-[11px]" style={{ color: C.inkSoft }}>عند جاهزية مفاتيح القناة، سيُفعّلها المشرف من الإعدادات الآمنة. لا تحفظ المفاتيح في هذه الشاشة أو في window.storage.</p>
        <div className="space-y-2">{mockMessages.length === 0 && <p className="text-xs py-3 text-center rounded-xl" style={{ color: C.inkSoft, background: "rgba(255,255,255,.72)", border: `1px dashed ${C.line}` }}>لم تُحاكَ رسائل بعد. أرسل طلباً تجريبياً لتظهر أحداث الرسائل هنا.</p>}{mockMessages.slice(0, 12).map((message) => <div key={message.id} className="p-3 rounded-xl flex items-start justify-between gap-3" style={{ background: "#fff", border: `1px solid ${C.line}` }}><div className="min-w-0"><p className="text-xs font-black" style={{ color: C.ink }}>{message.recipient} · {message.channel}</p><p className="text-xs mt-1 leading-5" style={{ color: C.inkSoft }}>{message.body}</p></div><span className="text-[10px] shrink-0" style={{ color: C.inkSoft }}>{message.createdAt}</span></div>)}</div>
      </section>

      <section className="p-4 sm:p-5 rounded-2xl space-y-3" style={{ background: "linear-gradient(135deg, #FFFFFF 0%, #F5F3FF 100%)", border: `1px solid ${C.purple}35` }} data-testid="admin-order-notifications-panel">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3"><span className="flex items-center justify-center rounded-xl shrink-0" style={{ width: 40, height: 40, background: C.purple, color: "#fff" }}><Bell size={19} /></span><div><h3 className="font-black flex items-center gap-2" style={{ color: C.ink }}>إشعارات الطلبات <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: unreadOrderNotificationsCount ? C.rust : C.paperDark, color: unreadOrderNotificationsCount ? "#fff" : C.inkSoft }}>{unreadOrderNotificationsCount} غير مقروء</span></h3><p className="text-xs mt-1" style={{ color: C.inkSoft }}>تظهر هنا فوراً الطلبات الجديدة والطلبات المسلّمة مع المبلغ الإجمالي.</p></div></div>
          <div className="flex items-center gap-2"><button onClick={() => setOnlyUnreadOrderNotifications((value) => !value)} className="text-xs font-bold px-3 py-1.5 rounded-xl" style={{ border: `1px solid ${C.line}`, color: onlyUnreadOrderNotifications ? C.purple : C.inkSoft, background: onlyUnreadOrderNotifications ? C.purple + "12" : "#fff" }}>{onlyUnreadOrderNotifications ? "عرض الكل" : "غير المقروءة"}</button><button onClick={markAllOrderNotificationsRead} disabled={!unreadOrderNotificationsCount} className="text-xs font-bold px-3 py-1.5 rounded-xl disabled:opacity-40" style={{ background: C.purple, color: "#fff" }}>تعليم الكل كمقروء</button></div>
        </div>
        <div className="space-y-2">
          {visibleOrderNotifications.length === 0 && <p className="text-xs py-4 text-center rounded-xl" style={{ color: C.inkSoft, background: "rgba(255,255,255,.66)", border: `1px dashed ${C.line}` }}>{onlyUnreadOrderNotifications ? "لا توجد إشعارات طلبات غير مقروءة." : "ستظهر إشعارات الطلبات الجديدة والمسلّمة هنا."}</p>}
          {visibleOrderNotifications.map((entry) => (<button key={entry.id} onClick={() => !entry.isRead && markOrderNotificationRead(entry.id)} className="w-full text-right p-3 rounded-xl flex items-start justify-between gap-3" style={{ background: entry.isRead ? "rgba(255,255,255,.66)" : "#fff", border: `1px solid ${entry.isRead ? C.line : C.purple + "40"}` }}><div className="flex items-start gap-2 min-w-0"><span className="mt-0.5 flex items-center justify-center rounded-lg shrink-0" style={{ width: 27, height: 27, background: entry.eventType === "order_delivered" ? C.sage + "22" : C.rust + "18", color: entry.eventType === "order_delivered" ? C.sage : C.rust }}>{entry.eventType === "order_delivered" ? <CheckCircle2 size={14} /> : <PackageCheck size={14} />}</span><div className="min-w-0"><div className="text-sm font-black" style={{ color: C.ink }}>{entry.title}</div><div className="text-xs leading-5 mt-0.5" style={{ color: C.inkSoft }}>{entry.body}</div><div className="text-[11px] mt-1" style={{ color: C.inkSoft }}>{entry.createdAt}</div></div></div><div className="shrink-0 text-left"><PriceTag amount={entry.orderTotal} />{!entry.isRead && <span className="block text-[10px] mt-1 font-bold" style={{ color: C.purple }}>جديد</span>}</div></button>))}
        </div>
      </section>

      <div>
        <h3 className="font-black mb-3 flex items-center gap-2" style={{ fontFamily: "'Reem Kufi', sans-serif", color: C.ink }}><Wallet size={17} color={C.rust} /> اللوحة المالية للمحلات</h3>
        <div className="space-y-2">
          {approved.map((s) => {
            const sales = orders.filter((o) => o.storeId === s.id && o.status === "delivered").reduce((a, o) => a + (o.subtotal || 0), 0);
            const due = storeCommissionDue(s);
            return (
              <div key={s.id} className="p-4 rounded-2xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2"><div className="flex items-center gap-2.5"><StoreAvatar logo={s.logo} size={32} /><div><div className="font-bold text-sm" style={{ color: C.ink }}>{s.name}</div><div className="text-xs" style={{ color: C.inkSoft }}>{s.wilaya}</div></div></div><div className="text-xs font-bold" style={{ color: C.inkSoft }}>إجمالي المبيعات: <span style={{ color: C.ink }}>{money(sales)}</span></div></div>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <button onClick={() => updateCommission(s.id, { commissionType: "percentage" })} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: s.commissionType === "percentage" ? C.teal : "transparent", color: s.commissionType === "percentage" ? "#fff" : C.inkSoft, border: `1px solid ${s.commissionType === "percentage" ? C.teal : C.line}` }}><Percent size={12} /> نسبة مئوية</button>
                  <button onClick={() => updateCommission(s.id, { commissionType: "subscription" })} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: s.commissionType === "subscription" ? C.teal : "transparent", color: s.commissionType === "subscription" ? "#fff" : C.inkSoft, border: `1px solid ${s.commissionType === "subscription" ? C.teal : C.line}` }}><CalendarClock size={12} /> اشتراك شهري</button>
                  {s.commissionType === "percentage" ? (<div className="flex items-center gap-1"><input type="number" min="0" max="100" value={s.commissionRate} onChange={(e) => updateCommission(s.id, { commissionRate: Number(e.target.value) })} className="w-16 px-2 py-1 rounded-lg text-xs outline-none" style={{ border: `1px solid ${C.line}` }} /><span className="text-xs" style={{ color: C.inkSoft }}>%</span></div>) : (<div className="flex items-center gap-1"><input type="number" min="0" value={s.subscriptionFee} onChange={(e) => updateCommission(s.id, { subscriptionFee: Number(e.target.value) })} className="w-24 px-2 py-1 rounded-lg text-xs outline-none" style={{ border: `1px solid ${C.line}` }} /><span className="text-xs" style={{ color: C.inkSoft }}>دج / شهر</span></div>)}
                </div>
                {s.commissionType === "percentage" ? (<div className="flex items-center justify-between pt-2" style={{ borderTop: `1px solid ${C.line}` }}><span className="text-xs" style={{ color: C.inkSoft }}>مستحقات المنصة لدى التاجر</span><div className="flex items-center gap-2"><PriceTag amount={due} />{due > 0 && <button onClick={() => settleDues(s)} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: C.sage, color: "#fff" }}>تحصيل</button>}</div></div>) : (<p className="text-xs pt-2" style={{ borderTop: `1px solid ${C.line}`, color: C.inkSoft }}>اشتراك شهري ثابت.</p>)}
              </div>
            );
          })}
          {approved.length === 0 && <p className="text-sm" style={{ color: C.inkSoft }}>لا توجد محلات مفعّلة بعد.</p>}
        </div>
      </div>

      <div>
        <h3 className="font-black mb-3 flex items-center gap-2" style={{ fontFamily: "'Reem Kufi', sans-serif", color: C.ink }}><AlertCircle size={17} color={C.ochre} /> طلبات المراجعة الأولية</h3>
        <div className="space-y-2">{pendingReview.length === 0 && <p className="text-sm" style={{ color: C.inkSoft }}>لا توجد طلبات جديدة.</p>}{pendingReview.map((s) => (<div key={s.id} className="p-4 rounded-2xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}><div className="flex items-center justify-between mb-2"><div className="flex items-center gap-3"><StoreAvatar logo={s.logo} size={32} /><div><div className="font-bold text-sm" style={{ color: C.ink }}>{s.name}</div><div className="text-xs" style={{ color: C.inkSoft }}>{s.wilaya} · {s.commune}</div></div></div><div className="flex gap-2"><button onClick={() => reject(s.id)} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: "#8B3A2A20", color: "#8B3A2A" }}><PackageX size={13} /> رفض</button><button onClick={() => approveInitial(s.id)} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: C.teal, color: "#fff" }}><PackageCheck size={13} /> موافقة مبدئية</button></div></div><div className="text-xs flex items-center gap-1" style={{ color: C.inkSoft }}><Phone size={11} /> {s.phone}</div></div>))}</div>
      </div>

      {awaitingProfile.length > 0 && (<div><h3 className="font-black mb-3 flex items-center gap-2" style={{ fontFamily: "'Reem Kufi', sans-serif", color: C.ink }}><FileText size={17} color={C.purple} /> بانتظار إكمال الملف من التاجر</h3><div className="space-y-2">{awaitingProfile.map((s) => (<div key={s.id} className="p-3 rounded-2xl flex items-center gap-3" style={{ background: "#fff", border: `1px solid ${C.line}` }}><StoreAvatar logo={s.logo} size={30} /><div className="flex-1"><div className="font-bold text-sm" style={{ color: C.ink }}>{s.name}</div><div className="text-xs" style={{ color: C.inkSoft }}>{s.wilaya} · {s.commune}</div></div><span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: C.purple + "25", color: C.purple }}>بانتظار التاجر</span></div>))}</div></div>)}

      <div>
        <h3 className="font-black mb-3 flex items-center gap-2" style={{ fontFamily: "'Reem Kufi', sans-serif", color: C.ink }}><Bike size={17} color={C.teal} /> طلبات انضمام الموصلين</h3>
        <div className="space-y-2">
          {pendingCouriers.length === 0 && <p className="text-sm" style={{ color: C.inkSoft }}>لا توجد طلبات جديدة.</p>}
          {pendingCouriers.map((c) => (<div key={c.id} className="p-3 rounded-2xl flex items-center justify-between flex-wrap gap-2" style={{ background: "#fff", border: `1px solid ${C.line}` }}><div><div className="font-bold text-sm" style={{ color: C.ink }}>{c.name}</div><div className="text-xs" style={{ color: C.inkSoft }}>{c.vehicle} · {c.wilaya} ({c.communes.join("، ") || c.wilaya + " — كل البلديات"}) · {c.phone}</div><div className="text-xs" style={{ color: C.inkSoft }}>الأوقات: {c.timeLabel || c.availability.map((a) => AVAILABILITY_SLOTS.find((s) => s.id === a)?.label).join(" / ") || "—"} · {c.storeMode === "all" ? "كل المحلات" : `${(c.selectedStoreIds || []).length} محل محدد`}</div></div><div className="flex gap-2"><button onClick={() => rejectCourier(c.id)} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: "#8B3A2A20", color: "#8B3A2A" }}><X size={13} /> رفض</button><button onClick={() => approveCourier(c.id)} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: C.teal, color: "#fff" }}><Check size={13} /> موافقة</button></div></div>))}
        </div>
        {couriers.filter((c) => c.status === "approved").length > 0 && (<div className="mt-3 flex flex-wrap gap-2">{couriers.filter((c) => c.status === "approved").map((c) => <span key={c.id} className="text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1" style={{ background: C.sage + "20", color: C.tealDark }}><Bike size={12} /> {c.name} · {c.wilaya}</span>)}</div>)}
      </div>

      <div>
        <h3 className="font-black mb-3 flex items-center gap-2" style={{ fontFamily: "'Reem Kufi', sans-serif", color: C.ink }}><ClipboardList size={17} color={C.teal} /> متابعة الطلبات المباشرة</h3>
        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
          <table className="w-full text-sm"><thead><tr style={{ background: C.paperDark }}><th className="text-right p-3 font-bold" style={{ color: C.inkSoft }}>المحل</th><th className="text-right p-3 font-bold" style={{ color: C.inkSoft }}>العميل</th><th className="text-right p-3 font-bold" style={{ color: C.inkSoft }}>المبلغ</th><th className="text-right p-3 font-bold" style={{ color: C.inkSoft }}>الحالة</th></tr></thead><tbody>{orders.map((o) => (<tr key={o.id} style={{ borderTop: `1px solid ${C.line}`, background: "#fff" }}><td className="p-3 font-bold" style={{ color: C.ink }}>{o.storeName}</td><td className="p-3" style={{ color: C.inkSoft }}>{o.customer}</td><td className="p-3" style={{ color: C.inkSoft }}>{money(o.total)}</td><td className="p-3"><StatusPill status={o.status} /></td></tr>))}</tbody></table>
        </div>
      </div>

      <div className="p-4 rounded-2xl space-y-3" style={{ background: "#fff", border: `1px solid ${C.line}` }} data-testid="test-account-review-panel">
        <div className="flex items-center justify-between gap-2 flex-wrap"><div><h3 className="font-black flex items-center gap-2" style={{ color: C.ink }}><ShieldCheck size={17} color={C.teal} /> مراجعة حسابات الاختبار</h3><p className="text-xs mt-1" style={{ color: C.inkSoft }}>تظهر الحسابات الموسومة كاختبار فقط. لا يمكن حذف أي حساب لديه طلبات أو حالة تشغيلية معتمدة.</p></div><span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: testAccountCandidates.length ? C.ochre + "1A" : C.sage + "20", color: testAccountCandidates.length ? C.ochre : C.tealDark }}>{testAccountCandidates.length} مرشح</span></div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white" style={{ border: `1px solid ${C.line}` }}><Search size={15} color={C.inkSoft} /><input data-testid="test-account-review-search" aria-label="بحث في حسابات الاختبار" value={testAccountQuery} onChange={(event) => setTestAccountQuery(event.target.value)} placeholder="ابحث بالاسم أو البريد أو الدور" className="flex-1 text-sm outline-none bg-transparent" /></div>
        <div className="space-y-2">{testAccountCandidates.length === 0 && <p className="text-xs py-2" style={{ color: C.inkSoft }}>لا توجد حسابات اختبار مؤهلة للمراجعة حالياً.</p>}{testAccountCandidates.length > 0 && filteredTestAccounts.length === 0 && <p className="text-xs py-2" style={{ color: C.inkSoft }}>لا توجد حسابات مطابقة للبحث.</p>}{filteredTestAccounts.map((account) => (<div key={account.id} className="p-3 rounded-xl flex items-center justify-between gap-3 flex-wrap" style={{ background: C.paperDark, border: `1px solid ${C.line}` }}><div><div className="text-sm font-black" style={{ color: C.ink }}>{account.name || "حساب اختبار"} <span className="font-normal" style={{ color: C.inkSoft }}>· {account.roleLabel}</span></div><div className="text-xs mt-1" style={{ color: C.inkSoft }}>{account.email} · أُنشئ {account.createdAt}</div><div className="text-[10px] mt-1" style={{ color: C.tealDark }}>آخر نشاط: {account.lastActivityLabel}</div><div className="text-[10px] mt-1" style={{ color: C.tealDark }}>موسوم كاختبار · لا توجد طلبات مرتبطة</div></div><button onClick={() => deleteTestAccount(account)} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: "#8B3A2A18", color: "#8B3A2A", border: "1px solid #8B3A2A33" }}><Trash2 size={12} /> حذف بعد التأكيد</button></div>))}</div>
        <div className="pt-3" style={{ borderTop: `1px solid ${C.line}` }} data-testid="test-account-review-audit">
          <div className="flex items-center justify-between gap-2 flex-wrap"><div><h4 className="text-sm font-black" style={{ color: C.ink }}>سجل المراجعة</h4><p className="text-[10px] mt-1" style={{ color: C.inkSoft }}>يشمل الحذف المؤكد فقط، ويُصدّر الإجراء والبريد المستهدف والتاريخ دون بيانات إضافية.</p></div><button data-testid="test-account-review-csv-export" onClick={exportTestAccountReviewCSV} disabled={testAccountReviewAuditLogs.length === 0} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: C.teal + "12", color: C.teal, border: `1px solid ${C.teal}38` }}><Download size={13} /> تصدير CSV</button></div>
          <div className="space-y-1.5 mt-3">{testAccountReviewAuditLogs.length === 0 && <p className="text-xs py-1" style={{ color: C.inkSoft }}>لا توجد عمليات مراجعة مسجلة بعد.</p>}{testAccountReviewAuditLogs.slice(0, 3).map((entry) => <div key={entry.id} className="text-[11px] p-2 rounded-lg" style={{ background: C.paperDark, color: C.inkSoft }}><b style={{ color: C.ink }}>{entry.actionLabel}</b> · {entry.targetEmail} · {entry.createdAt}</div>)}</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl space-y-3" style={{ background: "#fff", border: `1px solid ${C.line}` }} data-testid="archive-alerts-panel">
          <div className="flex items-center justify-between gap-2"><h3 className="font-black flex items-center gap-2" style={{ color: C.ink }}><Bell size={17} color={C.rust} /> تنبيهات الأرشفة الحساسة</h3><span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: unreadAlertsCount ? C.rust + "18" : C.sage + "20", color: unreadAlertsCount ? C.rust : C.tealDark }}>{unreadAlertsCount ? `${unreadAlertsCount} غير مقروء` : "محدّثة"}</span></div>
          <label className="flex items-center gap-2 text-xs font-bold" style={{ color: C.inkSoft }}><input type="checkbox" checked={onlyUnreadAlerts} onChange={(event) => setOnlyUnreadAlerts(event.target.checked)} /> غير المقروءة فقط</label>
          <div className="space-y-2 max-h-60 overflow-y-auto">{visibleNotifications.length === 0 && <p className="text-xs py-3" style={{ color: C.inkSoft }}>لا توجد تنبيهات مطابقة.</p>}{visibleNotifications.map((alert) => (<div key={alert.id} className="p-3 rounded-xl" style={{ background: alert.isRead ? C.paperDark : C.rust + "0D", border: `1px solid ${alert.isRead ? C.line : C.rust + "55"}` }}><div className="flex items-start justify-between gap-2"><div><div className="text-xs font-black" style={{ color: C.ink }}>{alert.title}</div><p className="text-xs mt-1" style={{ color: C.inkSoft }}>{alert.body}</p><p className="text-[10px] mt-1" style={{ color: C.inkSoft }}>{alert.createdAt}</p></div>{!alert.isRead && <button onClick={() => markArchiveNotificationRead(alert.id)} className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0" style={{ color: C.teal, border: `1px solid ${C.teal}55` }}>تأكيد القراءة</button>}</div></div>))}</div>
        </div>

        <div className="p-4 rounded-2xl space-y-3" style={{ background: "#fff", border: `1px solid ${C.line}` }} data-testid="archive-alert-settings">
          <h3 className="font-black flex items-center gap-2" style={{ color: C.ink }}><AlertCircle size={17} color={C.ochre} /> معيار الأرشفة الحساسة</h3>
          <label className="block text-xs font-bold" style={{ color: C.inkSoft }}>قيمة الطلب (دج)<input aria-label="قيمة الطلب الحساس" type="number" min="0" value={settingsDraft.sensitiveOrderTotal ?? 0} onChange={(event) => setSettingsDraft({ ...settingsDraft, sensitiveOrderTotal: Number(event.target.value) })} className="w-full mt-1.5 px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} /></label>
          <label className="block text-xs font-bold" style={{ color: C.inkSoft }}>حالات الطلب (مفصولة بفواصل)<input aria-label="حالات الأرشفة الحساسة" value={(settingsDraft.sensitiveStatuses || []).join(", ")} onChange={(event) => setSettingsDraft({ ...settingsDraft, sensitiveStatuses: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} className="w-full mt-1.5 px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} /></label>
          <label className="flex items-center gap-2 text-xs font-bold" style={{ color: C.inkSoft }}><input type="checkbox" checked={Boolean(settingsDraft.notifyOnMessageArchive)} onChange={(event) => setSettingsDraft({ ...settingsDraft, notifyOnMessageArchive: event.target.checked })} /> تنبيه عند أرشفة رسالة</label>
          <button onClick={() => saveArchiveAlertSettings(settingsDraft)} className="w-full py-2.5 rounded-xl text-sm font-black" style={{ background: C.teal, color: "#fff" }}>حفظ المعيار</button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2"><h3 className="font-black flex items-center gap-2" style={{ fontFamily: "'Reem Kufi', sans-serif", color: C.ink }}><Archive size={17} color={C.rust} /> أرشيف السجلات الكامل</h3><span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: C.rust + "16", color: C.rust }}>لا يتأثر بحذف التاجر أو الموصل</span></div>
        <div className="p-3 rounded-2xl grid sm:grid-cols-3 gap-2 mb-3" style={{ background: C.paperDark, border: `1px solid ${C.line}` }} data-testid="archive-search-filters"><div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white" style={{ border: `1px solid ${C.line}` }}><Search size={15} color={C.inkSoft} /><input aria-label="بحث في الأرشيف" value={archiveQuery} onChange={(event) => setArchiveQuery(event.target.value)} placeholder="بحث باسم المحل أو العميل أو المحتوى" className="flex-1 text-sm outline-none bg-transparent" /></div><select aria-label="نوع السجل" value={archiveType} onChange={(event) => setArchiveType(event.target.value)} className="px-3 py-2 rounded-xl text-sm outline-none bg-white" style={{ border: `1px solid ${C.line}` }}><option value="all">كل السجلات</option><option value="orders">الطلبات فقط</option><option value="messages">الرسائل فقط</option></select><select aria-label="حالة الطلب" value={archiveStatus} onChange={(event) => setArchiveStatus(event.target.value)} disabled={archiveType === "messages"} className="px-3 py-2 rounded-xl text-sm outline-none bg-white disabled:opacity-50" style={{ border: `1px solid ${C.line}` }}><option value="all">كل الحالات</option>{Object.entries(STATUS_MAP).map(([id, status]) => <option key={id} value={id}>{status.label}</option>)}</select></div>
        <div className="space-y-2">{filteredArchiveOrders.length === 0 && archiveType !== "messages" && <p className="text-sm py-2" style={{ color: C.inkSoft }}>لا توجد طلبات مطابقة للبحث أو الفلترة.</p>}{filteredArchiveOrders.map((o) => (<div key={o.id} className="p-3 rounded-2xl flex items-center justify-between gap-3 flex-wrap" style={{ background: "#fff", border: `1px solid ${C.line}` }}><div><div className="font-bold text-sm" style={{ color: C.ink }}>{o.storeName} · {o.customer}</div><div className="text-xs mt-1" style={{ color: C.inkSoft }}>{o.items.map((item) => `${item.name} ×${item.qty}`).join(" · ")} · {money(o.total)} · {o.createdAt}</div></div><div className="flex items-center gap-2"><StatusPill status={o.status} /><button onClick={() => deleteOrderPermanently(o.id)} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: "#8B3A2A18", color: "#8B3A2A" }}><Trash2 size={12} /> حذف نهائي</button></div></div>))}</div>
      </div>

      <div>
        <h3 className="font-black mb-3 flex items-center gap-2" style={{ fontFamily: "'Reem Kufi', sans-serif", color: C.ink }}><MessageCircle size={17} color={C.teal} /> أرشيف الرسائل</h3>
        <div className="space-y-2">{filteredArchiveMessages.length === 0 && archiveType !== "orders" && <p className="text-sm" style={{ color: C.inkSoft }}>لا توجد رسائل مطابقة للبحث.</p>}{filteredArchiveMessages.map((message) => (<div key={message.id} className="p-3 rounded-2xl flex items-center justify-between gap-3 flex-wrap" style={{ background: "#fff", border: `1px solid ${C.line}` }}><div className="flex-1"><div className="text-sm" style={{ color: C.ink }}>{message.body}</div><div className="text-xs mt-1" style={{ color: C.inkSoft }}>الطلب: {String(message.orderId).slice(0, 8)} · {message.createdAt}</div></div><button onClick={() => deleteMessagePermanently(message.id)} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: "#8B3A2A18", color: "#8B3A2A" }}><Trash2 size={12} /> حذف نهائي</button></div>))}</div>
      </div>

      <div className="p-4 rounded-2xl" style={{ background: "#fff", border: `1px solid ${C.line}` }} data-testid="archive-audit-log">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap"><h3 className="font-black flex items-center gap-2" style={{ color: C.ink }}><ClipboardList size={17} color={C.purple} /> سجل تدقيق الحذف النهائي</h3><select aria-label="إجراء سجل التدقيق" value={auditAction} onChange={(event) => setAuditAction(event.target.value)} className="px-3 py-1.5 rounded-xl text-xs font-bold outline-none" style={{ border: `1px solid ${C.line}`, color: C.inkSoft }}><option value="all">كل الإجراءات</option><option value="permanent_delete_order">حذف طلب نهائي</option><option value="permanent_delete_message">حذف رسالة نهائي</option></select></div>
        <div className="space-y-2">{visibleAuditLogs.length === 0 && <p className="text-xs py-2" style={{ color: C.inkSoft }}>لا توجد عمليات حذف نهائي مسجلة بعد.</p>}{visibleAuditLogs.map((entry) => (<div key={entry.id} className="flex items-center justify-between gap-3 p-2.5 rounded-xl flex-wrap" style={{ background: C.paperDark }}><div className="text-xs" style={{ color: C.ink }}><b>{entry.action === "permanent_delete_order" ? "حذف طلب نهائي" : "حذف رسالة نهائي"}</b> · {entry.resourceType}: {String(entry.resourceId).slice(0, 8)}</div><div className="text-[10px]" style={{ color: C.inkSoft }}>{entry.createdAt}</div></div>))}</div>
      </div>
    </div>
  );
}

/* ===========================================================
   حفظ دائم
=========================================================== */
const STORAGE = {
  stores: { key: "souq-jiran:stores:v4", shared: true },
  orders: { key: "souq-jiran:orders:v4", shared: true },
  couriers: { key: "souq-jiran:couriers:v4", shared: true },
  cart: { key: "souq-jiran:cart:v4", shared: false },
  myStoreId: { key: "souq-jiran:my-store-id:v4", shared: false },
  notifications: { key: "souq-jiran:notifications:v4", shared: false },
  mockMessaging: { key: "souq-jiran:mock-messaging:v1", shared: true },
};
async function loadKey({ key, shared }, fallback) {
  try {
    if (window.storage?.get) {
      const res = await window.storage.get(key, shared);
      return res ? JSON.parse(res.value) : fallback;
    }
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (e) { return fallback; }
}
async function saveKey({ key, shared }, value) {
  try {
    if (window.storage?.set) await window.storage.set(key, JSON.stringify(value), shared);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch (e) { console.error("تعذّر حفظ البيانات:", e); }
}

/* ===========================================================
   صفحة تعريف الانضمام
=========================================================== */
function RoleBenefitsPage({ onBack, onMerchant, onCourier }) {
  const roles = [
    { id: "merchant", icon: Store, accent: C.rust, label: "للتاجر", title: "أدر محلّك من مكان واحد", description: "أضف المنتجات، راقب الطلبات، وحدد الموصلين الذين تتعامل معهم ضمن نطاق توصيلك.", benefits: ["إدارة المنتجات والمخزون", "متابعة الطلبات خطوة بخطوة", "اختيار الموصلين المعتمدين"], action: "ابدأ كتاجر", onClick: onMerchant },
    { id: "courier", icon: Bike, accent: C.teal, label: "للموصل", title: "نظّم توصيلاتك بطريقتك", description: "حدد أوقاتك، ونطاق تغطيتك، والمحلات التي تناسب مسارك قبل استقبال الطلبات.", benefits: ["أوقات عمل مرنة", "تغطية الأحياء والبلديات التي تختارها", "طلبات متاحة ضمن نطاقك"], action: "ابدأ كموصل", onClick: onCourier },
  ];

  return (
    <section className="space-y-5" data-testid="role-benefits-page">
      <div className="p-5 sm:p-7 rounded-[28px]" style={{ background: `linear-gradient(125deg, ${C.teal}, ${C.purple})`, color: "#fff", boxShadow: `0 20px 45px ${C.teal}30` }}>
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-bold mb-5 opacity-90 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 rounded-md"><ChevronRight size={15} /> العودة للتسوّق</button>
        <span className="text-[11px] font-black px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,.14)" }}>مسار واضح قبل التسجيل</span>
        <h1 className="font-black text-2xl mt-3 tracking-tight" style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>انضم إلى شبكة الحيّ</h1>
        <p className="text-sm leading-6 mt-2 max-w-2xl" style={{ color: "rgba(255,255,255,.82)" }}>اختر الدور الأنسب لك. ابدأ برقم هاتف محمول جزائري أو بريد إلكتروني، ثم تابع أعمالك من لوحتك الخاصة بعد اكتمال المراجعة.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {roles.map((roleInfo) => {
          const Icon = roleInfo.icon;
          return (
            <article key={roleInfo.id} className="role-benefit-card p-5 rounded-[24px]" style={{ background: "rgba(255,255,255,.9)", border: `1px solid ${C.line}`, "--role-accent": roleInfo.accent, boxShadow: "0 14px 34px rgba(51, 59, 120, .08)" }}>
              <div className="flex items-start justify-between gap-3"><span className="flex items-center justify-center rounded-2xl" style={{ width: 46, height: 46, background: roleInfo.accent + "18", color: roleInfo.accent }}><Icon size={23} /></span><span className="text-[11px] font-black px-2.5 py-1 rounded-full" style={{ background: roleInfo.accent + "14", color: roleInfo.accent }}>{roleInfo.label}</span></div>
              <h2 className="font-black text-lg mt-4" style={{ color: C.ink }}>{roleInfo.title}</h2>
              <p className="text-sm leading-6 mt-2" style={{ color: C.inkSoft }}>{roleInfo.description}</p>
              <ul className="space-y-2 mt-4">{roleInfo.benefits.map((benefit) => <li key={benefit} className="flex items-center gap-2 text-xs font-bold" style={{ color: C.ink }}><CheckCircle2 size={15} color={roleInfo.accent} />{benefit}</li>)}</ul>
              <button onClick={roleInfo.onClick} className="role-guide-cta w-full mt-5 py-3 rounded-xl text-sm font-black flex items-center justify-center gap-1.5" style={{ background: roleInfo.accent, color: "#fff", "--role-accent": roleInfo.accent }}>{roleInfo.action}<ChevronLeft size={15} /></button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/* ===========================================================
   APP ROOT
=========================================================== */
function OrderDetailsOverlay({ order, onClose }) {
  if (!order) return null;
  const status = STATUS_MAP[order.status] || { label: order.status, color: C.inkSoft };
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-5" style={{ background: "rgba(23,32,51,.44)" }} onClick={onClose} data-testid="order-notification-details">
      <section className="w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] p-5 sm:p-6" style={{ background: "#fff", boxShadow: "0 24px 60px rgba(23,32,51,.24)" }} onClick={(event) => event.stopPropagation()} aria-label="تفاصيل الطلب من الإشعار">
        <div className="flex items-start justify-between gap-4"><div><span className="text-[11px] font-black px-2.5 py-1 rounded-full" style={{ background: status.color + "18", color: status.color }}>تحديث فوري</span><h2 className="font-black text-xl mt-3" style={{ color: C.ink }}>تفاصيل الطلب</h2><p className="text-xs mt-1" style={{ color: C.inkSoft }}>رقم الطلب: {String(order.id).slice(0, 8)} · {order.storeName}</p></div><button onClick={onClose} className="p-2 rounded-xl" style={{ background: C.paper, color: C.inkSoft }} aria-label="إغلاق"><X size={18} /></button></div>
        <div className="mt-5 p-4 rounded-2xl" style={{ background: status.color + "10", border: `1px solid ${status.color}2A` }}><div className="font-black" style={{ color: status.color }}>{status.label}</div><p className="text-xs mt-1.5 leading-5" style={{ color: C.inkSoft }}>{order.estimatedDeliveryMinutes ? `الزمن التقديري للتسليم: ${order.estimatedDeliveryMinutes} دقيقة.` : "ستظهر تحديثات التوصيل الجديدة هنا فور وصولها."}</p></div>
        <div className="mt-5 space-y-2">{order.items.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 text-sm p-3 rounded-xl" style={{ background: C.paper }}><span className="font-bold" style={{ color: C.ink }}>{item.name} × {item.qty}</span><span style={{ color: C.inkSoft }}>{money(item.price * item.qty)}</span></div>)}</div>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm"><div className="p-3 rounded-xl" style={{ border: `1px solid ${C.line}` }}><div className="text-[11px] font-bold" style={{ color: C.inkSoft }}>الإجمالي</div><div className="font-black mt-1" style={{ color: C.ink }}>{money(order.total)}</div></div><div className="p-3 rounded-xl" style={{ border: `1px solid ${C.line}` }}><div className="text-[11px] font-bold" style={{ color: C.inkSoft }}>التوصيل</div><div className="font-black mt-1" style={{ color: C.ink }}>{money(order.deliveryFee)}</div></div></div>
        {order.deliveryLocation && <div className="mt-4 flex items-start gap-2 text-xs leading-5 p-3 rounded-xl" style={{ background: C.paper, color: C.inkSoft }}><MapPin size={15} color={C.teal} className="shrink-0 mt-0.5" />{order.deliveryLocation}</div>}
      </section>
    </div>
  );
}

export default function App() {
  const [role, setRole] = useState("customer");
  const [stores, setStores] = useState([]);
  const [orders, setOrders] = useState([]);
  const [messages, setMessages] = useState([]);
  const [archiveAuditLogs, setArchiveAuditLogs] = useState([]);
  const [archiveNotifications, setArchiveNotifications] = useState([]);
  const [adminOrderNotifications, setAdminOrderNotifications] = useState([]);
  const [testAccountCandidates, setTestAccountCandidates] = useState([]);
  const [testAccountReviewAuditLogs, setTestAccountReviewAuditLogs] = useState([]);
  const [customerReports, setCustomerReports] = useState([]);
  const [customerBlacklist, setCustomerBlacklist] = useState([]);
  const [deliveryPricing, setDeliveryPricing] = useState(null);
  const [mockMessages, setMockMessages] = useState([]);
  const [referralCode, setReferralCode] = useState("");
  const [pendingReferralCode, setPendingReferralCode] = useState(() => new URLSearchParams(window.location.search).get("ref")?.trim().toUpperCase() || "");
  const [rewardCoupons, setRewardCoupons] = useState([]);
  const [referralAnalytics, setReferralAnalytics] = useState({ totalReferrals: 0, qualifiedReferrals: 0, awardedReferrals: 0, issuedCoupons: 0, redeemedCoupons: 0, redeemedValue: 0 });
  const [archiveAlertSettings, setArchiveAlertSettings] = useState({ sensitiveOrderTotal: 5000, sensitiveStatuses: ["ready", "delivering", "delivered"], notifyOnMessageArchive: false });
  const [couriers, setCouriers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [auth, setAuth] = useState(null);
  const [cart, setCart] = useState({ storeId: null, items: [], address: null });
  const [myStoreId, setMyStoreId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showCourierForm, setShowCourierForm] = useState(false);
  const [showMerchantForm, setShowMerchantForm] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authEntry, setAuthEntry] = useState({ type: "merchant", mode: "login" });
  const [showPhoneChange, setShowPhoneChange] = useState(false);
  const [adminLoginRequested, setAdminLoginRequested] = useState(false);
  const [showRoleGuide, setShowRoleGuide] = useState(false);
  const [focusedOrderId, setFocusedOrderId] = useState(null);
  const prevOrdersRef = useRef(null);

  const focusedOrder = useMemo(() => orders.find((order) => order.id === focusedOrderId) || null, [orders, focusedOrderId]);

  function notify(msg) { setToast(msg); setTimeout(() => setToast(""), 2400); }
  function pushNotification(message) { setNotifications((prev) => { const next = [{ id: "n" + Math.random().toString(36).slice(2, 7), message, time: new Date().toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" }), read: false }, ...prev].slice(0, 25); saveKey(STORAGE.notifications, next); return next; }); }
  function markAllRead() { setNotifications((prev) => { const next = prev.map((n) => ({ ...n, read: true })); saveKey(STORAGE.notifications, next); return next; }); }
  function recordMockMessage({ recipient, body, orderId = null, channel = "WhatsApp/Viber (تجريبي)" }) {
    const entry = { id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, recipient, body, orderId, channel, createdAt: new Date().toLocaleString("ar-DZ", { dateStyle: "short", timeStyle: "short" }) };
    setMockMessages((previous) => { const next = [entry, ...previous].slice(0, 80); saveKey(STORAGE.mockMessaging, next); return next; });
    if ((recipient === "العميل" && auth?.type === "customer") || (recipient === "التاجر" && auth?.type === "merchant") || (recipient === "الموصل" && auth?.type === "courier")) pushNotification(`[تجريبي] ${body}`);
  }

  useEffect(() => {
    let cancelled = false;
    // يطلب Android الإذن مرة واحدة فقط لكل تثبيت. لا نربط الرمز بحساب قبل
    // وجود جلسة، ثم تعيد syncNativeFcmToken قراءته وحفظه بعد تسجيل الدخول.
    void requestNativeFcmToken().catch(() => null);
    (async () => {
      const [loadedCart, loadedMyStoreId, loadedNotifications, loadedMockMessages] = await Promise.all([
        loadKey(STORAGE.cart, { storeId: null, items: [], address: null }), loadKey(STORAGE.myStoreId, null), loadKey(STORAGE.notifications, []), loadKey(STORAGE.mockMessaging, []),
      ]);
      if (cancelled) return;
      setStores([]); setOrders([]); setMessages([]); setArchiveAuditLogs([]); setArchiveNotifications([]); setAdminOrderNotifications([]); setTestAccountCandidates([]); setTestAccountReviewAuditLogs([]); setCustomerReports([]); setCustomerBlacklist([]); setDeliveryPricing(null); setCouriers([]);
      setAccounts([]); setAuth(null); setReferralCode(""); setRewardCoupons([]); setReferralAnalytics({ totalReferrals: 0, qualifiedReferrals: 0, awardedReferrals: 0, issuedCoupons: 0, redeemedCoupons: 0, redeemedValue: 0 });
      setCart(loadedCart); setMyStoreId(loadedMyStoreId); setNotifications(loadedNotifications); setMockMessages(loadedMockMessages);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  async function resolveSupabaseUser(user) {
    const metadata = user.user_metadata || {};
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role, name, phone")
      .eq("id", user.id)
      .maybeSingle();
    // The metadata fallback keeps sign-in usable while the user applies schema.sql manually.
    const type = profile?.role || metadata.role || "customer";
    const phone = profile?.phone || metadata.phone || user.phone || "";
    const email = metadata.contact_email || (user.email?.endsWith("@phone.souqjiran.local") ? "" : user.email) || "";
    return {
      type,
      id: user.id,
      email,
      phone,
      identity: phone || email,
      name: profile?.name || metadata.name || email.split("@")[0] || phone || "مستخدم سوق الجيران",
      profileUnavailable: Boolean(error),
    };
  }

  async function applySupabaseSession(session) {
    if (!session?.user) {
      setAuth(null);
      setMyStoreId(null);
      setRole("customer");
      setOrders([]); setMessages([]); setArchiveAuditLogs([]); setArchiveNotifications([]); setAdminOrderNotifications([]); setTestAccountCandidates([]); setTestAccountReviewAuditLogs([]); setCustomerReports([]); setCustomerBlacklist([]); setDeliveryPricing(null); setCouriers([]); setReferralCode(""); setRewardCoupons([]); setReferralAnalytics({ totalReferrals: 0, qualifiedReferrals: 0, awardedReferrals: 0, issuedCoupons: 0, redeemedCoupons: 0 });
      // تبقى الصفحة الرئيسية متاحة للزائر: سياسة RLS تسمح بقراءة المحلات المعتمدة
      // فقط، لذا لا ينبغي لمسح القائمة عند عدم وجود جلسة تسجيل دخول.
      await refreshSupabaseData("public");
      return;
    }
    const nextAuth = await resolveSupabaseUser(session.user);
    setAuth(nextAuth);
    setRole(nextAuth.type);
    if (nextAuth.type === "merchant") setMyStoreId(nextAuth.id);
    await refreshSupabaseData(nextAuth.type);
  }

  async function syncNativeFcmToken(profileId, suppliedToken) {
    try {
      const token = suppliedToken || await requestNativeFcmToken();
      if (!token || !profileId) return;
      const { error } = await supabase.rpc("update_my_fcm_token", { p_token: token });
      if (error && error.code !== "42883") console.warn("تعذر حفظ رمز FCM:", error.message);
    } catch (fcmError) {
      // Notification permission is voluntary and must not interrupt auth.
      console.warn("تعذر تهيئة إشعارات Firebase:", fcmError);
    }
  }

  async function refreshSupabaseData(activeRole = auth?.type) {
    const [merchantsResult, productsResult, couriersResult, ordersResult, itemsResult, messagesResult, auditResult, archiveNotificationsResult, orderNotificationsResult, alertSettingsResult, customerReportsResult, customerBlacklistResult, pricingResult, referralCodeResult, rewardCouponsResult, adminReferralsResult, adminRewardCouponsResult] = await Promise.all([
      supabase.from("merchants").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("couriers").select("*").order("created_at", { ascending: false }),
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("order_items").select("*").order("created_at", { ascending: true }),
      supabase.from("order_messages").select("*").order("created_at", { ascending: false }),
      supabase.from("admin_archive_audit_logs").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("admin_archive_notifications").select("*").order("created_at", { ascending: false }).limit(100),
      activeRole === "admin" ? supabase.from("admin_order_notifications").select("*").order("created_at", { ascending: false }).limit(100) : Promise.resolve({ data: [] }),
      supabase.from("admin_archive_alert_settings").select("*").eq("id", true).maybeSingle(),
      activeRole === "admin" ? supabase.from("customer_behavior_reports").select("*").order("created_at", { ascending: false }).limit(100) : Promise.resolve({ data: [] }),
      activeRole === "admin" ? supabase.from("customer_blacklist").select("*").order("created_at", { ascending: false }).limit(100) : Promise.resolve({ data: [] }),
      supabase.from("delivery_pricing_config").select("*").eq("id", true).maybeSingle(),
      activeRole === "customer" ? supabase.rpc("ensure_my_referral_code") : Promise.resolve({ data: "" }),
      activeRole === "customer" ? supabase.from("reward_coupons").select("*").order("issued_at", { ascending: false }) : Promise.resolve({ data: [] }),
      activeRole === "admin" ? supabase.from("customer_referrals").select("status") : Promise.resolve({ data: [] }),
      activeRole === "admin" ? supabase.from("reward_coupons").select("status, amount") : Promise.resolve({ data: [] }),
    ]);
    const migrationMissing = [merchantsResult, productsResult, couriersResult, ordersResult, itemsResult].some((result) => result.error?.code === "42P01");
    if (migrationMissing) {
      notify("طبّق امتداد التجارة في supabase/schema.sql لتفعيل المنتجات والطلبات السحابية.");
      return;
    }
    const [testAccountsResult, testAccountAuditResult] = activeRole === "admin"
      ? await Promise.all([
        supabase.rpc("admin_list_test_accounts"),
        supabase.from("test_account_review_audit_logs").select("id, target_email, action, created_at").order("created_at", { ascending: false }).limit(100),
      ])
      : [{ data: [] }, { data: [] }];
    const productRows = productsResult.data || [];
    const merchantRows = merchantsResult.data || [];
    const courierRows = couriersResult.data || [];
    const productsByMerchant = groupRowsBy(productRows, ({ merchant_id }) => merchant_id);
    const storesById = Object.fromEntries(merchantRows.map((merchant) => [merchant.id, merchant]));
    const itemsByOrder = groupRowsBy(itemsResult.data || [], ({ order_id }) => order_id);
    setStores(merchantRows.map((merchant) => ({
      id: merchant.id, name: merchant.store_name, phone: merchant.phone || "", wilaya: merchant.wilaya || "", commune: merchant.commune || "",
      status: merchant.status, deliveryCommunes: merchant.delivery_communes || [], approvedCourierIds: merchant.approved_courier_ids || [],
      hasOwnDelivery: merchant.has_own_delivery ?? true, deliveryFee: merchant.delivery_fee || 0, minOrder: merchant.min_order || 0,
      products: (productsByMerchant[merchant.id] || []).map((product) => ({ id: product.id, name: product.name, price: product.price, unit: product.unit, department: product.department, available: product.available })),
      logo: { text: merchant.store_name.slice(0, 2), color: C.teal }, reviews: [], commissionType: "percentage", commissionRate: 0, subscriptionFee: 0, duesPaid: 0,
    })));
    setCouriers(courierRows.map((courier) => ({
      id: courier.id, name: "موصل", phone: "", vehicle: courier.vehicle || "", wilaya: courier.wilaya || "", communes: courier.communes || [],
      availability: courier.availability || [], storeMode: courier.store_mode || "all", selectedStoreIds: courier.selected_store_ids || [], status: courier.status,
    })));
    setOrders((ordersResult.data || []).map((order) => ({
      id: order.id, storeId: order.merchant_id, storeName: storesById[order.merchant_id]?.store_name || "محل الحي", customerId: order.customer_id, customer: order.customer_id === auth?.id ? "أنت" : "عميل",
      items: (itemsByOrder[order.id] || []).map((item) => ({ id: item.product_id || item.id, name: item.product_name, price: item.unit_price, unit: item.unit, qty: item.quantity })),
      subtotal: order.subtotal, deliveryFee: order.delivery_fee, total: order.total, status: order.status, deliveryLocation: order.delivery_address,
      isInterwilaya: order.is_interwilaya || false, deliveryDistanceKm: Number(order.delivery_distance_km || 0), estimatedDeliveryMinutes: order.estimated_delivery_minutes,
      requiresPhoneVerification: order.requires_phone_verification || false, originWilaya: order.origin_wilaya, destinationWilaya: order.destination_wilaya,
      deliveryType: order.delivery_choice, courier: order.courier_id ? { id: order.courier_id, name: "موصل" } : null, rated: false, confirmed: false,
      createdAt: new Date(order.created_at).toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" }),
    })));
    setMessages((messagesResult.data || []).map((message) => ({
      id: message.id, orderId: message.order_id, senderId: message.sender_id, recipientId: message.recipient_id, body: message.body,
      createdAt: new Date(message.created_at).toLocaleString("ar-DZ", { dateStyle: "short", timeStyle: "short" }),
    })));
    setArchiveAuditLogs((auditResult.data || []).map((entry) => ({
      id: entry.id, actorId: entry.actor_id, action: entry.action, resourceType: entry.resource_type, resourceId: entry.resource_id,
      archivedByUserId: entry.archived_by_user_id, createdAt: new Date(entry.created_at).toLocaleString("ar-DZ", { dateStyle: "short", timeStyle: "short" }),
    })));
    setArchiveNotifications((archiveNotificationsResult.data || []).map((entry) => ({
      id: entry.id, kind: entry.kind, orderId: entry.order_id, actorId: entry.actor_id, priority: entry.priority, title: entry.title,
      body: entry.body, metadata: entry.metadata || {}, isRead: entry.is_read, createdAt: new Date(entry.created_at).toLocaleString("ar-DZ", { dateStyle: "short", timeStyle: "short" }),
    })));
    setAdminOrderNotifications((orderNotificationsResult.data || []).map((entry) => ({
      id: entry.id, eventType: entry.event_type, orderId: entry.order_id, orderTotal: Number(entry.order_total || 0), title: entry.title,
      body: entry.body, metadata: entry.metadata || {}, isRead: Boolean(entry.is_read), createdAt: new Date(entry.created_at).toLocaleString("ar-DZ", { dateStyle: "short", timeStyle: "short" }),
    })));
    if (testAccountsResult.error && testAccountsResult.error.code !== "42883") notify("تعذر تحميل قائمة مراجعة حسابات الاختبار: " + testAccountsResult.error.message);
    if (testAccountAuditResult.error) notify("تعذر تحميل سجل مراجعة حسابات الاختبار: " + testAccountAuditResult.error.message);
    setTestAccountCandidates((testAccountsResult.data || []).map((account) => {
      const lastActivityAt = account.last_sign_in_at || null;
      const lastActivityDate = lastActivityAt ? new Date(lastActivityAt).toLocaleString("ar-DZ", { dateStyle: "medium", timeStyle: "short" }) : "لم يسجل دخولاً بعد";
      const lastActivityLabel = lastActivityAt ? `${lastActivityDate} · ${formatRelativeActivity(lastActivityAt)}` : lastActivityDate;
      return { id: account.user_id, email: account.email, role: account.role, roleLabel: account.role === "merchant" ? "تاجر" : "موصل", name: account.name, createdAt: new Date(account.created_at).toLocaleDateString("ar-DZ", { dateStyle: "medium" }), lastActivityAt, lastActivityDate, lastActivityLabel };
    }));
    setTestAccountReviewAuditLogs((testAccountAuditResult.data || []).map((entry) => ({ id: entry.id, targetEmail: entry.target_email, action: entry.action, actionLabel: entry.action === "delete_confirmed" ? "حذف مؤكد" : entry.action, createdAt: new Date(entry.created_at).toLocaleString("ar-DZ", { dateStyle: "medium", timeStyle: "short" }) })));
    setCustomerReports((customerReportsResult.data || []).map((report) => ({ id: report.id, customerId: report.customer_id, reason: report.reason, relatedOrderId: report.related_order_id, status: report.status, createdAt: report.created_at })));
    setCustomerBlacklist((customerBlacklistResult.data || []).map((entry) => ({ customerId: entry.customer_id, reason: entry.reason, createdAt: entry.created_at, expiresAt: entry.expires_at, revokedAt: entry.revoked_at })));
    if (activeRole === "admin") {
      const referrals = adminReferralsResult.data || [];
      const coupons = adminRewardCouponsResult.data || [];
      setReferralAnalytics({
        totalReferrals: referrals.length,
        qualifiedReferrals: referrals.filter((entry) => ["qualified", "rewarded"].includes(entry.status)).length,
        awardedReferrals: referrals.filter((entry) => entry.status === "rewarded").length,
        issuedCoupons: coupons.length,
        redeemedCoupons: coupons.filter((entry) => entry.status === "redeemed").length,
        redeemedValue: coupons.filter((entry) => entry.status === "redeemed").reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
      });
    }
    if (pricingResult.data) setDeliveryPricing({ baseFee: Number(pricingResult.data.base_fee), feePerKm: Number(pricingResult.data.fee_per_km), feePerKg: Number(pricingResult.data.fee_per_kg), interwilayaSurcharge: Number(pricingResult.data.interwilaya_surcharge), minimumFee: Number(pricingResult.data.minimum_fee), averageSpeedKmh: Number(pricingResult.data.average_speed_kmh) });
    if (activeRole === "customer") {
      if (!referralCodeResult.error && referralCodeResult.data) setReferralCode(referralCodeResult.data);
      if (!rewardCouponsResult.error) setRewardCoupons((rewardCouponsResult.data || []).map((coupon) => ({ id: coupon.id, code: coupon.code, amount: Number(coupon.amount || 0), minimumOrderTotal: Number(coupon.minimum_order_total || 0), status: coupon.status, kind: coupon.kind, expiresAt: coupon.expires_at })));
    }
    if (alertSettingsResult.data) {
      setArchiveAlertSettings({
        sensitiveOrderTotal: Number(alertSettingsResult.data.sensitive_order_total),
        sensitiveStatuses: alertSettingsResult.data.sensitive_statuses || [],
        notifyOnMessageArchive: Boolean(alertSettingsResult.data.notify_on_message_archive),
      });
    }
  }

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) void applySupabaseSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) void applySupabaseSession(session);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!auth?.id) return undefined;
    void syncNativeFcmToken(auth.id);
    let listener;
    void listenForNativeFcmToken((token) => { void syncNativeFcmToken(auth.id, token); }).then((handle) => { listener = handle; });
    return () => { void listener?.remove(); };
  }, [auth?.id]);

  function getOrderIdFromPushData(data) {
    if (!data || typeof data !== "object") return null;
    const raw = data.order_id || data.orderId;
    return typeof raw === "string" && raw.trim() ? raw.trim() : null;
  }

  async function openOrderFromPush(data) {
    const orderId = getOrderIdFromPushData(data);
    if (!orderId) { notify("وصل إشعار جديد، لكن لا يحتوي على رقم طلب صالح."); return; }
    await refreshSupabaseData(auth?.type);
    setFocusedOrderId(orderId);
  }

  useEffect(() => {
    if (!auth?.id) return undefined;
    let listener;
    void listenForNativeOrderNotifications(
      (notification) => {
        const heading = notification.title || "تحديث جديد على الطلب";
        const body = notification.body || "اضغط على التنبيه لمراجعة تفاصيل الطلب.";
        pushNotification(`${heading}: ${body}`);
        notify(heading);
        void refreshSupabaseData(auth.type);
      },
      (notification) => { void openOrderFromPush(notification.data); },
    ).then((handle) => { listener = handle; });
    return () => { void listener?.remove(); };
  }, [auth?.id, auth?.type]);

  useEffect(() => {
    if (!auth?.id) return undefined;
    const channel = supabase
      .channel(`orders-live-${auth.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => { void refreshSupabaseData(auth.type); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [auth?.id, auth?.type]);

  useEffect(() => {
    if (loading) return;
    if (prevOrdersRef.current === null) { prevOrdersRef.current = orders; return; }
    const prevMap = Object.fromEntries(prevOrdersRef.current.map((o) => [o.id, o.status]));
    orders.forEach((o) => { if (prevMap[o.id] && prevMap[o.id] !== o.status) pushNotification(`تم تحديث طلبك من ${o.storeName} إلى «${STATUS_MAP[o.status]?.label || o.status}»`); });
    prevOrdersRef.current = orders;
  }, [orders, loading]);

  function persistentSetStores(updater) { setStores((prev) => { const next = typeof updater === "function" ? updater(prev) : updater; saveKey(STORAGE.stores, next); return next; }); }
  function persistentSetOrders(updater) { setOrders((prev) => { const next = typeof updater === "function" ? updater(prev) : updater; saveKey(STORAGE.orders, next); return next; }); }
  function persistentSetCouriers(updater) { setCouriers((prev) => { const next = typeof updater === "function" ? updater(prev) : updater; saveKey(STORAGE.couriers, next); return next; }); }
  function persistentSetCart(updater) { setCart((prev) => { const next = typeof updater === "function" ? updater(prev) : updater; saveKey(STORAGE.cart, next); return next; }); }
  function persistentSetMyStoreId(id) { setMyStoreId(id); saveKey(STORAGE.myStoreId, id); }

  async function placeOrder(store, _promo, _discountAmount = 0, address = null, deliveryType = "pickup", deliveryFee = 0, rewardCouponCode = null) {
    if (!auth || auth.type !== "customer") { notify("سجّل الدخول كعميل لإرسال طلبك."); return false; }
    if (!store || cart.items.length === 0) return false;
    const { error } = await supabase.rpc("create_customer_order", {
      p_merchant_id: store.id,
      p_items: cart.items.map((item) => ({ product_id: item.id, qty: item.qty })),
      p_delivery_choice: deliveryType,
      p_delivery_address: address,
      p_delivery_fee: deliveryFee,
    });
    if (error) { notify("تعذر إرسال الطلب: " + error.message); return false; }
    if (rewardCouponCode) {
      const createdOrder = await supabase.from("orders").select("id").eq("customer_id", auth.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (createdOrder.error || !createdOrder.data?.id) { notify("تم إنشاء الطلب، لكن تعذر ربط قسيمة المكافأة الآن."); }
      else {
        const { error: couponError } = await supabase.rpc("redeem_reward_coupon", { p_order_id: createdOrder.data.id, p_coupon_code: rewardCouponCode });
        if (couponError) { notify("تم إنشاء الطلب، لكن لم تُطبّق القسيمة: " + couponError.message); }
        else recordMockMessage({ recipient: "العميل", orderId: createdOrder.data.id, body: `تم تطبيق قسيمة المكافأة ${rewardCouponCode} على طلبك التجريبي.` });
      }
    }
    persistentSetCart({ storeId: null, items: [], address: null });
    await refreshSupabaseData();
    recordMockMessage({ recipient: "التاجر", body: `طلب جديد من العميل بانتظار المراجعة لدى ${store.name}.` });
    const needsMockOtp = deliveryType === "courier" && (cart.items.reduce((total, item) => total + Number(item.price || 0) * Number(item.qty || 0), 0) >= 10000 || Boolean(address?.wilaya && store.wilaya && address.wilaya !== store.wilaya));
    if (needsMockOtp) recordMockMessage({ recipient: "العميل", body: "رمز OTP تجريبي: 123456 لتأكيد طلب التوصيل. لا تُرسل رسالة فعلية في وضع الاختبار." });
    notify("تم إرسال طلبك — الدفع نقداً عند الاستلام");
    return true;
  }

  async function claimCustomerReferral(code, silent = false) {
    if (!auth || auth.type !== "customer") { if (!silent) notify("سجّل الدخول كعميل لاستخدام كود الدعوة."); return false; }
    const normalized = String(code || "").trim().toUpperCase();
    if (!normalized) { if (!silent) notify("أدخل كود دعوة صحيحاً."); return false; }
    const { error } = await supabase.rpc("claim_customer_referral", { p_referral_code: normalized });
    if (error) { if (!silent) notify(error.message?.includes("PHONE_VERIFICATION_REQUIRED") ? "أكّد رقم هاتفك أولاً؛ سنربط الدعوة تلقائياً فور نجاح التحقق." : "تعذر تفعيل الدعوة: " + error.message); return false; }
    recordMockMessage({ recipient: "العميل", body: `تم تفعيل كود الدعوة ${normalized}. ستُمنح المكافآت بعد أول طلب مكتمل.` });
    await refreshSupabaseData("customer");
    if (!silent) notify("تم تفعيل الدعوة بنجاح.");
    return true;
  }

  async function createProduct(merchantId, product) {
    if (auth?.id !== merchantId) { notify("لا تملك صلاحية تعديل منتجات هذا المحل."); return false; }
    const { error } = await supabase.from("products").insert({ merchant_id: merchantId, ...product, available: true });
    if (error) { notify("تعذر حفظ المنتج: " + error.message); return false; }
    await refreshSupabaseData();
    return true;
  }

  async function createBulkProducts(merchantId, rows) {
    if (auth?.id !== merchantId) { notify("لا تملك صلاحية تعديل منتجات هذا المحل."); return false; }
    const payload = rows.map((row) => ({ merchant_id: merchantId, name: row.name, price: Number(row.price), unit: row.unit || "الوحدة", department: row.department || "pantry", available: true }));
    const { error } = await supabase.from("products").insert(payload);
    if (error) { notify("تعذر استيراد المنتجات: " + error.message); return false; }
    await refreshSupabaseData();
    return true;
  }

  async function removeProductRemote(productId) {
    const { error } = await supabase.from("products").delete().eq("id", productId);
    if (error) { notify("تعذر حذف المنتج: " + error.message); return false; }
    await refreshSupabaseData();
    return true;
  }

  async function setProductAvailability(productId, available) {
    const { error } = await supabase.from("products").update({ available }).eq("id", productId);
    if (error) { notify("تعذر تحديث توفر المنتج: " + error.message); return false; }
    await refreshSupabaseData();
    return true;
  }

  async function setMerchantOrderStatus(orderId, status) {
    const { error } = await supabase.rpc("set_merchant_order_status", { p_order_id: orderId, p_status: status });
    if (error) { notify("تعذر تحديث الطلب: " + error.message); return false; }
    await refreshSupabaseData();
    const order = orders.find((item) => item.id === orderId);
    if (status === "ready") recordMockMessage({ recipient: "الموصل", orderId, body: `طلب ${order?.storeName || "محل الحي"} أصبح جاهزاً للاستلام${order?.isInterwilaya ? ` لمسار ${order.originWilaya || "المصدر"} إلى ${order.destinationWilaya || "الوجهة"}` : ""}.` });
    else recordMockMessage({ recipient: "العميل", orderId, body: `تم تحديث طلبك من ${order?.storeName || "محل الحي"} إلى «${STATUS_MAP[status]?.label || status}».` });
    return true;
  }

  async function claimReadyOrder(orderId) {
    const { error } = await supabase.rpc("claim_ready_order", { p_order_id: orderId });
    if (error) { notify("تعذر قبول الطلب: " + error.message); return false; }
    await refreshSupabaseData();
    const order = orders.find((item) => item.id === orderId);
    recordMockMessage({ recipient: "التاجر", orderId, body: `تم إسناد طلب ${order?.storeName || "محل الحي"} إلى موصل معتمد.` });
    recordMockMessage({ recipient: "العميل", orderId, body: "تم إسناد طلبك إلى موصل. لن تظهر بيانات الموصل حفاظاً على الخصوصية." });
    notify("تم قبول الطلب — توجه إلى المحل لاستلامه");
    return true;
  }

  async function completeDelivery(orderId) {
    const { error } = await supabase.rpc("complete_delivery", { p_order_id: orderId });
    if (error) { notify("تعذر إتمام التسليم: " + error.message); return false; }
    await refreshSupabaseData();
    notify("تم تسجيل التسليم بنجاح.");
    return true;
  }

  async function runLifecycleAction(orderId, rpcName, successMessage) {
    const { error } = await supabase.rpc(rpcName, { p_order_id: orderId });
    if (error) { notify("تعذر تحديث مرحلة الطلب: " + error.message); return false; }
    await refreshSupabaseData();
    const order = orders.find((item) => item.id === orderId);
    const messagesByAction = {
      courier_confirm_pickup: { recipient: "العميل", body: "استلم الموصل طلبك من المحل رسمياً." },
      courier_start_delivery: { recipient: "العميل", body: "طلبك في الطريق إليك الآن." },
      courier_confirm_delivery: { recipient: "العميل", body: "تم تسجيل التسليم. يرجى تأكيد الاستلام والدفع من التطبيق." },
      customer_confirm_delivery: { recipient: "الموصل", body: "أكد العميل الاستلام والدفع. يمكنك تحويل مستحقات التاجر." },
      courier_confirm_remittance: { recipient: "التاجر", body: "أكد الموصل تحويل مستحقات طلبك. يرجى تأكيد الاستلام لإغلاق الدورة." },
      merchant_confirm_settlement: { recipient: "العميل", body: "اكتملت تسوية طلبك بنجاح. شكراً لاستخدام سوق الجيران." },
    };
    const message = messagesByAction[rpcName];
    if (message) recordMockMessage({ ...message, orderId, body: `${message.body}${order?.storeName ? ` (${order.storeName})` : ""}` });
    notify(successMessage);
    return true;
  }

  async function courierConfirmPickup(orderId) { return runLifecycleAction(orderId, "courier_confirm_pickup", "تم تأكيد استلام الطلب من المحل."); }
  async function courierStartDelivery(orderId) { return runLifecycleAction(orderId, "courier_start_delivery", "تم تسجيل بدء التوصيل."); }
  async function courierConfirmDelivery(orderId) { return runLifecycleAction(orderId, "courier_confirm_delivery", "تم تأكيد التسليم؛ ينتظر الطلب تأكيد العميل."); }
  async function customerConfirmDelivery(orderId) { return runLifecycleAction(orderId, "customer_confirm_delivery", "تم تأكيد الاستلام والدفع. شكراً لك."); }
  async function courierConfirmRemittance(orderId) { return runLifecycleAction(orderId, "courier_confirm_remittance", "تم تأكيد تحويل مستحقات التاجر."); }
  async function merchantConfirmSettlement(orderId) { return runLifecycleAction(orderId, "merchant_confirm_settlement", "تم تأكيد استلام المستحقات وإغلاق الطلب."); }

  async function quoteDelivery(merchantId, destination, weightKg = 0) {
    const { data, error } = await supabase.rpc("quote_delivery", { p_merchant_id: merchantId, p_destination_json: destination, p_weight_kg: weightKg });
    if (error) return { ok: false, message: error.message };
    const quote = Array.isArray(data) ? data[0] : data;
    return { ok: Boolean(quote), quote: quote ? { fee: Number(quote.fee || 0), distanceKm: Number(quote.distance_km || 0), etaMinutes: quote.eta_minutes, isInterwilaya: Boolean(quote.is_interwilaya) } : null };
  }

  async function confirmCustomerPhoneVerification(phone, method = "mock_otp") {
    const { error } = await supabase.rpc("confirm_customer_phone_verification", { p_phone: phone, p_method: method });
    if (error) { notify("تعذر حفظ التحقق التجريبي: " + error.message); return false; }
    recordMockMessage({ recipient: "العميل", channel: "OTP تجريبي", body: `تم تسجيل تأكيد الرقم عبر ${method}. لم يُرسل رمز فعلي.` });
    if (pendingReferralCode) {
      const joined = await claimCustomerReferral(pendingReferralCode, true);
      if (joined) setPendingReferralCode("");
    }
    notify("تم تسجيل التحقق في الوضع التجريبي؛ لم يُرسل OTP فعلي.");
    return true;
  }

  async function requestCustomerPhoneVerification(phone, channel = "whatsapp") {
    const { data, error } = await supabase.rpc("request_customer_phone_verification", { p_phone: phone, p_channel: channel });
    if (error) {
      const cooldown = /OTP_RESEND_COOLDOWN:(\d+)/.exec(error.message || "")?.[1];
      return { ok: false, message: cooldown ? `انتظر ${cooldown} ثانية قبل إعادة الإرسال.` : error.message || "تعذر تجهيز التحقق.", retryAfter: cooldown ? Number(cooldown) : 0 };
    }
    const result = Array.isArray(data) ? data[0] : data;
    recordMockMessage({ recipient: "العميل", channel: "OTP تجريبي", body: `طُلب التحقق عبر ${channel === "whatsapp" ? "WhatsApp" : channel === "viber" ? "Viber" : "وضع الاختبار"}. تم تفعيل المسار البديل التجريبي دون إرسال خارجي.` });
    return { ok: true, cooldownSeconds: Number(result?.cooldown_seconds || 60), message: result?.message || "تم تجهيز التحقق في وضع الاختبار." };
  }

  async function archiveOrderForCurrentUser(orderId) {
    if (!auth || !["merchant", "courier"].includes(auth.type)) { notify("ميزة الحذف متاحة للتاجر والموصل فقط."); return false; }
    const { error } = await supabase.rpc("archive_order_for_user", { p_order_id: orderId });
    if (error) { notify("تعذر حذف الطلب من قائمتك: " + error.message); return false; }
    await refreshSupabaseData();
    notify("أُخفي الطلب من قائمتك فقط؛ يبقى محفوظاً في أرشيف الإدارة.");
    return true;
  }

  async function archiveMessageForCurrentUser(messageId) {
    if (!auth || !["merchant", "courier"].includes(auth.type)) { notify("ميزة الحذف متاحة للتاجر والموصل فقط."); return false; }
    const { error } = await supabase.rpc("archive_message_for_user", { p_message_id: messageId });
    if (error) { notify("تعذر حذف الرسالة من قائمتك: " + error.message); return false; }
    await refreshSupabaseData();
    notify("أُخفيت الرسالة من قائمتك فقط؛ تبقى محفوظة في أرشيف الإدارة.");
    return true;
  }

  async function deleteOrderPermanently(orderId) {
    if (auth?.type !== "admin") { notify("لا تملك صلاحية الحذف النهائي."); return false; }
    if (!window.confirm("سيُحذف الطلب نهائياً مع عناصره ورسائله ولا يمكن استعادته. هل تريد المتابعة؟")) return false;
    const { error } = await supabase.rpc("admin_delete_order_permanently", { p_order_id: orderId });
    if (error) { notify("تعذر الحذف النهائي للطلب: " + error.message); return false; }
    await refreshSupabaseData();
    notify("تم حذف الطلب نهائياً من الأرشيف الإداري.");
    return true;
  }

  async function deleteMessagePermanently(messageId) {
    if (auth?.type !== "admin") { notify("لا تملك صلاحية الحذف النهائي."); return false; }
    if (!window.confirm("سيُحذف محتوى الرسالة نهائياً ولا يمكن استعادته. هل تريد المتابعة؟")) return false;
    const { error } = await supabase.rpc("admin_delete_message_permanently", { p_message_id: messageId });
    if (error) { notify("تعذر الحذف النهائي للرسالة: " + error.message); return false; }
    await refreshSupabaseData();
    notify("تم حذف الرسالة نهائياً من الأرشيف الإداري.");
    return true;
  }

  async function deleteTestAccount(account) {
    if (auth?.type !== "admin") { notify("لا تملك صلاحية حذف حسابات الاختبار."); return false; }
    if (!window.confirm(`سيُحذف حساب الاختبار ${account.email} نهائياً. لا يمكن استعادته. هل تريد المتابعة؟`)) return false;
    const { error } = await supabase.rpc("admin_delete_test_account", { p_user_id: account.id });
    if (error) { notify("تعذر حذف حساب الاختبار: " + error.message); return false; }
    await refreshSupabaseData("admin");
    notify("تم حذف حساب الاختبار بعد المراجعة.");
    return true;
  }

  async function markArchiveNotificationRead(notificationId) {
    if (auth?.type !== "admin") { notify("لا تملك صلاحية تعديل إشعارات الأرشيف."); return false; }
    const { error } = await supabase.rpc("admin_mark_archive_notification_read", { p_notification_id: notificationId });
    if (error) { notify("تعذر تحديث الإشعار: " + error.message); return false; }
    await refreshSupabaseData();
    return true;
  }

  async function markOrderNotificationRead(notificationId) {
    if (auth?.type !== "admin") { notify("لا تملك صلاحية تعديل إشعارات الطلبات."); return false; }
    const { error } = await supabase.rpc("admin_mark_order_notification_read", { p_notification_id: notificationId });
    if (error) { notify("تعذر تحديث إشعار الطلب: " + error.message); return false; }
    await refreshSupabaseData("admin");
    return true;
  }

  async function markAllOrderNotificationsRead() {
    if (auth?.type !== "admin") { notify("لا تملك صلاحية تعديل إشعارات الطلبات."); return false; }
    const { error } = await supabase.rpc("admin_mark_all_order_notifications_read");
    if (error) { notify("تعذر تحديث إشعارات الطلبات: " + error.message); return false; }
    await refreshSupabaseData("admin");
    return true;
  }

  async function saveArchiveAlertSettings(nextSettings) {
    if (auth?.type !== "admin") { notify("لا تملك صلاحية تعديل إعدادات الأرشيف."); return false; }
    const sensitiveStatuses = nextSettings.sensitiveStatuses.filter(Boolean);
    if (!Number.isFinite(nextSettings.sensitiveOrderTotal) || nextSettings.sensitiveOrderTotal < 0) {
      notify("أدخل قيمة مالية صحيحة لمعيار الطلب الحساس."); return false;
    }
    const { error } = await supabase.from("admin_archive_alert_settings").upsert({
      id: true,
      sensitive_order_total: nextSettings.sensitiveOrderTotal,
      sensitive_statuses: sensitiveStatuses,
      notify_on_message_archive: nextSettings.notifyOnMessageArchive,
      updated_at: new Date().toISOString(),
      updated_by: auth.id,
    });
    if (error) { notify("تعذر حفظ إعدادات الأرشيف: " + error.message); return false; }
    await refreshSupabaseData();
    notify("تم حفظ معيار الأرشفة الحساسة.");
    return true;
  }

  async function setCustomerBlacklistStatus(customerId, reason, isBlocked) {
    if (auth?.type !== "admin") { notify("لا تملك صلاحية إدارة قائمة الحظر."); return false; }
    const { error } = await supabase.rpc("admin_set_customer_blacklist", { p_customer_id: customerId, p_reason: reason, p_is_blocked: isBlocked, p_expires_at: null });
    if (error) { notify("تعذر تحديث قائمة الحظر: " + error.message); return false; }
    await refreshSupabaseData("admin");
    notify(isBlocked ? "تم حظر الحساب بعد مراجعة البلاغ." : "تم رفع الحظر عن الحساب.");
    return true;
  }

  async function saveDeliveryPricingConfig(nextPricing) {
    if (auth?.type !== "admin") { notify("لا تملك صلاحية تعديل تسعير التوصيل."); return false; }
    const fields = [nextPricing.baseFee, nextPricing.feePerKm, nextPricing.feePerKg, nextPricing.interwilayaSurcharge, nextPricing.minimumFee, nextPricing.averageSpeedKmh];
    if (fields.some((value) => !Number.isFinite(Number(value)) || Number(value) < 0) || Number(nextPricing.averageSpeedKmh) <= 0) { notify("تحقق من القيم الرقمية لإعدادات التسعير."); return false; }
    const { error } = await supabase.from("delivery_pricing_config").upsert({ id: true, base_fee: Number(nextPricing.baseFee), fee_per_km: Number(nextPricing.feePerKm), fee_per_kg: Number(nextPricing.feePerKg), interwilaya_surcharge: Number(nextPricing.interwilayaSurcharge), minimum_fee: Number(nextPricing.minimumFee), average_speed_kmh: Number(nextPricing.averageSpeedKmh), updated_at: new Date().toISOString(), updated_by: auth.id });
    if (error) { notify("تعذر حفظ إعدادات التسعير: " + error.message); return false; }
    await refreshSupabaseData("admin");
    notify("تم حفظ إعدادات التسعير الجديدة.");
    return true;
  }

  async function reportCustomerAccount(customerId, reason, orderId) {
    if (auth?.type !== "merchant") { notify("الإبلاغ متاح للتاجر صاحب الطلب فقط."); return false; }
    if (!reason || reason.trim().length < 5) { notify("اكتب سبباً واضحاً من خمسة أحرف على الأقل."); return false; }
    const { error } = await supabase.rpc("report_customer_account", { p_customer_id: customerId, p_reason: reason.trim(), p_order_id: orderId });
    if (error) { notify("تعذر إرسال البلاغ: " + error.message); return false; }
    notify("تم إرسال البلاغ للمراجعة الإدارية.");
    return true;
  }

  async function setProviderStatus(providerType, providerId, status) {
    if (auth?.type !== "admin") { notify("لا تملك صلاحية الإدارة."); return false; }
    const { error } = await supabase.rpc("admin_set_provider_status", { p_provider_type: providerType, p_provider_id: providerId, p_status: status });
    if (error) { notify("تعذر تحديث حالة الحساب: " + error.message); return false; }
    await refreshSupabaseData();
    return true;
  }

  async function createSupabaseAccount({ identifier, password, role: authRole, name, phone }) {
    const credential = parseLoginIdentifier(identifier);
    if (!credential) return { error: "أدخل بريداً إلكترونياً صالحاً أو رقم هاتف جزائرياً يبدأ بـ 05 أو 06 أو 07." };
    const normalizedPhone = normalizeAlgerianMobile(phone) || credential.phone || "";
    const { data: existing } = await supabase.auth.getSession();
    if (existing.session) {
      if (existing.session.user.email?.toLowerCase() !== credential.authEmail.toLowerCase()) {
        return { error: "سجّل الخروج من حسابك الحالي قبل إنشاء حساب جديد." };
      }
      return { user: existing.session.user, session: existing.session, resumed: true };
    }
    const { data, error } = await supabase.auth.signUp({
      email: credential.authEmail,
      password,
      options: { data: { role: authRole, name, phone: normalizedPhone, contact_email: credential.kind === "email" ? credential.email : "", login_identifier_type: credential.kind } },
    });
    if (error) return { error: error.message };
    if (!data.user) return { error: "تعذر إنشاء الحساب. حاول مجدداً." };
    if (data.user.identities?.length === 0) return { error: "هذه الهوية مسجلة بالفعل. سجّل الدخول لإكمال ملفك." };
    if (!data.session) {
      return { user: data.user, notice: "تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيده، ثم سجّل الدخول." };
    }
    return { user: data.user, session: data.session };
  }

  async function linkVerifiedFirebasePhone(firebasePhoneVerification, challenge = null) {
    const verifiedPhone = normalizeAlgerianMobile(firebasePhoneVerification?.phoneNumber);
    if (!firebasePhoneVerification?.firebaseUid || !verifiedPhone) {
      return { warning: "تعذر التحقق من رقم Firebase الموثق." };
    }
    let phoneChallenge = challenge;
    if (!phoneChallenge) {
      const { data, error } = await supabase.rpc("request_my_firebase_phone_link", { p_phone: verifiedPhone });
      if (error?.code === "42883") return { warning: "يلزم تطبيق ترحيل 20260830_secure_firebase_phone_link.sql لتأمين ربط الهاتف عبر Firebase." };
      if (error) return { warning: "تعذر تجهيز الربط الآمن للهاتف: " + error.message };
      phoneChallenge = data;
    }
    const { error } = await firebaseSupabase.rpc("confirm_my_firebase_phone_link", { p_challenge: phoneChallenge });
    if (error) return { warning: "تم إثبات ملكية الهاتف عبر Firebase، لكن تعذر ربطه بالملف بأمان: " + error.message };
    return {};
  }

  async function ensureSupabaseProfile({ user, role: profileRole, name, phone }) {
    const { data: existing, error: lookupError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (lookupError) return { error: "تعذر الوصول إلى ملف المستخدم. طبّق ملف supabase/schema.sql في لوحة Supabase أولاً." };
    if (existing) return {};
    const { error } = await supabase.from("profiles").insert({
      id: user.id,
      role: profileRole,
      name,
      phone,
      email: user.email,
    });
    if (error) return { error: "تعذر إنشاء ملف المستخدم. طبّق ملف supabase/schema.sql ثم سجّل الدخول لإكمال ملفك." };
    return {};
  }

  async function ensureCourierReviewRequest(userId) {
    if (!userId) return { error: "تعذر تحديد حساب الموصل الجديد." };
    const { error } = await supabase.from("couriers").upsert({
      id: userId,
      vehicle: "",
      wilaya: "غير محددة",
      communes: [],
      availability: [],
      store_mode: "all",
      selected_store_ids: [],
      status: "pending",
    }, { onConflict: "id", ignoreDuplicates: true });
    if (error) return { error: "تم إنشاء الحساب، لكن تعذر إرسال طلب انضمام الموصل للمراجعة: " + error.message };
    return {};
  }

  async function authenticate({ mode, type, identifier, password, firebasePhoneVerification = null }) {
    const credential = parseLoginIdentifier(identifier);
    if (!credential) return { error: "أدخل بريداً إلكترونياً صالحاً أو رقم هاتف جزائرياً يبدأ بـ 05 أو 06 أو 07." };
    if (mode === "register" && type === "admin") return { error: "إنشاء حسابات المشرفين متاح فقط عبر قاعدة البيانات." };
    if (mode === "register") {
      if (credential.kind === "phone" && !firebasePhoneVerification) return { error: "أكمل تحقق Firebase عبر رمز SMS قبل إنشاء حساب بالهاتف." };
      const created = await createSupabaseAccount({ identifier: credential.value, password, role: type, name: credential.email?.split("@")[0] || credential.phone, phone: credential.phone || "" });
      if (created.error || created.notice) return created;
      await applySupabaseSession(created.session);
      const profile = await ensureSupabaseProfile({ user: created.user, role: type, name: credential.email?.split("@")[0] || credential.phone, phone: credential.phone || "" });
      if (profile.error) return profile;
      if (type === "courier") {
        const courierRequest = await ensureCourierReviewRequest(created.user.id);
        if (courierRequest.error) return courierRequest;
      }
      const firebaseRecord = credential.kind === "phone" ? await linkVerifiedFirebasePhone(firebasePhoneVerification) : {};
      notify(firebaseRecord.warning || (type === "courier"
        ? "تم إنشاء حساب الموصل وإرسال طلبه إلى لوحة الإدارة للمراجعة."
        : "تم إنشاء الحساب وربط الهاتف المؤكد عبر Firebase بنجاح."));
      return {};
    }
    if (credential.kind === "phone" && !firebasePhoneVerification) return { error: "أكمل تحقق Firebase عبر رمز SMS قبل تسجيل الدخول بالهاتف." };
    const { data, error } = await supabase.auth.signInWithPassword({ email: credential.authEmail, password });
    if (error || !data.session) return { error: "تعذر تسجيل الدخول. تحقق من رقم الهاتف أو البريد الإلكتروني وكلمة المرور." };
    const signedIn = await resolveSupabaseUser(data.session.user);
    if (signedIn.type !== type) {
      await supabase.auth.signOut();
      return { error: "نوع الحساب لا يطابق البوابة المحددة. اختر بوابة حسابك الصحيحة." };
    }
    await applySupabaseSession(data.session);
    const firebaseRecord = credential.kind === "phone" ? await linkVerifiedFirebasePhone(firebasePhoneVerification) : {};
    if (firebaseRecord.warning) notify(firebaseRecord.warning);
    if (signedIn.profileUnavailable) notify("تم الدخول. أكمل تطبيق ملف الترحيل في Supabase لتفعيل ملفات الأدوار.");
    return {};
  }

  async function requestAccountRecovery({ identifier, firebasePhoneVerification = null }) {
    const credential = parseLoginIdentifier(identifier);
    if (!credential) return { error: "أدخل بريداً إلكترونياً صالحاً أو رقم هاتف جزائرياً يبدأ بـ 05 أو 06 أو 07." };
    if (credential.kind === "email") {
      const { error } = await supabase.auth.resetPasswordForEmail(credential.email, { redirectTo: window.location.origin });
      if (error) return { error: "تعذر إرسال رابط الاستعادة. تحقق من البريد وحاول لاحقاً." };
      return { notice: "إذا كان البريد مسجلاً، أُرسل رابط آمن لإعادة تعيين كلمة المرور إليه." };
    }
    if (!firebasePhoneVerification) return { error: "أكمل تحقق Firebase عبر رمز SMS قبل متابعة استعادة الحساب بالهاتف." };
    return { notice: "تم إثبات ملكية الرقم عبر Firebase دون كشف وجود الحساب. استعادة كلمة مرور الحساب ستحتاج مسار إدارة آمن قبل فتحها للهاتف." };
  }

  async function requestPhoneChange(phone) {
    if (!auth?.id) return { error: "سجّل الدخول أولاً لتغيير رقم الهاتف." };
    const normalizedPhone = normalizeAlgerianMobile(phone);
    if (!normalizedPhone) return { error: "أدخل رقم هاتف محمول جزائرياً صحيحاً." };
    const { data, error } = await supabase.rpc("request_my_firebase_phone_link", { p_phone: normalizedPhone });
    if (error) return { error: "تعذر تجهيز طلب تغيير الرقم. طبّق الترحيل 20260830_secure_firebase_phone_link.sql في Supabase ثم حاول مجدداً." };
    return { challenge: data };
  }

  async function confirmPhoneChange({ phone, firebasePhoneVerification, challenge }) {
    if (!auth?.id) return { error: "سجّل الدخول أولاً لتغيير رقم الهاتف." };
    const normalizedPhone = normalizeAlgerianMobile(phone);
    if (!normalizedPhone || !firebasePhoneVerification?.firebaseUid || !challenge) return { error: "أكمل تحقق Firebase عبر رمز SMS قبل حفظ الرقم." };
    if (firebasePhoneVerification.phoneNumber !== normalizedPhone) return { error: "رمز Firebase مرتبط برقم مختلف. أعد طلب رمز الرقم الجديد." };
    const firebaseRecord = await linkVerifiedFirebasePhone(firebasePhoneVerification, challenge);
    if (firebaseRecord.warning) return { error: firebaseRecord.warning };
    const { error: metadataError } = await supabase.auth.updateUser({ data: { phone: normalizedPhone } });
    if (metadataError) return { error: "تم تحديث الرقم في الملف، لكن تعذر مزامنة بيانات الجلسة. سجّل الخروج ثم ادخل مجدداً." };
    setAuth((current) => current ? { ...current, phone: normalizedPhone, identity: normalizedPhone } : current);
    notify("تم تغيير رقم الهاتف بعد تحقق Firebase.");
    return {};
  }

  async function registerMerchant(form) {
    const credential = parseLoginIdentifier(form.contact);
    if (!credential) return { error: "أدخل بريداً إلكترونياً صالحاً أو رقم هاتف جزائرياً يبدأ بـ 05 أو 06 أو 07." };
    if (credential.kind === "phone" && !form.phoneMockVerified) return { error: "أكمل رمز OTP التجريبي قبل إرسال طلب المحل." };
    const created = await createSupabaseAccount({ identifier: credential.value, password: form.password, role: "merchant", name: form.name, phone: form.phone });
    if (created.error || created.notice) return created;
    const profile = await ensureSupabaseProfile({ user: created.user, role: "merchant", name: form.name, phone: form.phone });
    if (profile.error) return profile;
    const merchant = {
      id: created.user.id,
      store_name: form.name,
      wilaya: form.wilaya,
      commune: form.commune,
      phone: form.phone,
      delivery_communes: form.deliveryCommunes || [],
      status: "pending_review",
    };
    const { error } = await supabase.from("merchants").insert(merchant);
    if (error) {
      return { error: "تعذر حفظ ملف المحل. بقي حساب الدخول صالحاً؛ طبّق ملف supabase/schema.sql ثم أرسل النموذج مجدداً لإكمال الملف." };
    }
    const store = { id: created.user.id, name: form.name, phone: form.phone, email: credential.email || "", wilaya: form.wilaya, commune: form.commune, address: "", lat: form.lat, lng: form.lng, distance: "—", status: "pending_review", rating: 0, open: 8, close: 21, minOrder: 0, deliveryFee: 0, hasOwnDelivery: true, deliveryCommunes: form.deliveryCommunes || [], approvedCourierIds: [], commissionType: "percentage", commissionRate: 10, subscriptionFee: 3000, duesPaid: 0, logo: { text: form.name.slice(0, 2), color: C.teal }, ccp: "", idDocName: "", products: [], reviews: [] };
    persistentSetStores((prev) => [...prev.filter((item) => item.id !== store.id), store]);
    await applySupabaseSession(created.session);
    setShowMerchantForm(false);
    notify("تم إرسال طلب انضمام المحل، بانتظار موافقة المشرف.");
    return { id: created.user.id };
  }

  async function registerCourier(form) {
    const credential = parseLoginIdentifier(form.contact);
    if (!credential) return { error: "أدخل بريداً إلكترونياً صالحاً أو رقم هاتف جزائرياً يبدأ بـ 05 أو 06 أو 07." };
    if (credential.kind === "phone" && !form.phoneMockVerified) return { error: "أكمل رمز OTP التجريبي قبل إرسال طلب الانضمام." };
    const created = await createSupabaseAccount({ identifier: credential.value, password: form.password, role: "courier", name: form.name, phone: form.phone });
    if (created.error || created.notice) return created;
    const profile = await ensureSupabaseProfile({ user: created.user, role: "courier", name: form.name, phone: form.phone });
    if (profile.error) return profile;
    const courier = {
      id: created.user.id,
      vehicle: form.vehicle,
      wilaya: form.wilaya,
      communes: form.communes,
      availability: form.useCustomHours ? [form.hoursFrom, form.hoursTo] : form.availability,
      store_mode: form.storeMode,
      selected_store_ids: [],
      status: "pending",
    };
    let activeSession = created.session;
    let { error: courierError } = await supabase.from("couriers").insert(courier);
    // قد يصل حساب جديد بجلسة سابقة لإنشاء صفّ profiles في trigger، فتفشل سياسة RLS
    // مؤقتاً رغم صحة الدور. نجدد الجلسة مرة واحدة ثم نعيد محاولة الإدراج نفسه فقط.
    if (courierError?.code === "42501") {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && refreshed.session) {
        activeSession = refreshed.session;
        const retry = await supabase.from("couriers").insert(courier);
        courierError = retry.error;
      }
    }
    if (courierError) {
      return { error: "تعذر حفظ ملف الموصل. بقي حساب الدخول صالحاً؛ طبّق ملف supabase/schema.sql ثم أرسل النموذج مجدداً لإكمال الملف." };
    }
    const localCourier = { id: created.user.id, name: form.name, phone: form.phone, email: credential.email || "", vehicle: form.vehicle, wilaya: form.wilaya, commune: form.commune || "", communes: form.communes, availability: form.useCustomHours ? [] : form.availability, customHours: form.useCustomHours ? { from: form.hoursFrom, to: form.hoursTo } : null, timeLabel: form.timeLabel || "", coverageLabel: form.coverageLabel || "", storeMode: form.storeMode, selectedStoreIds: form.selectedStoreIds, status: "pending" };
    persistentSetCouriers((prev) => [...prev.filter((item) => item.id !== localCourier.id), localCourier]);
    await applySupabaseSession(activeSession);
    setShowCourierForm(false);
    notify("تم إرسال طلب انضمامك كموصل، بانتظار موافقة المشرف");
    return {};
  }

  function resetDemoData() {
    persistentSetStores([...initialStores, pendingStoreSeed]);
    persistentSetOrders(initialOrders);
    persistentSetCouriers(initialCouriers);
    setAuth(null); void supabase.auth.signOut();
    persistentSetCart({ storeId: null, items: [], address: null });
    persistentSetMyStoreId(null);
    setNotifications([]); saveKey(STORAGE.notifications, []);
    prevOrdersRef.current = initialOrders;
    setShowResetConfirm(false);
    setRole("customer");
    notify("تمت إعادة ضبط البيانات");
  }

  async function signOut() {
    // Token invalidation is best-effort: an older installation may not yet
    // have the companion RPC while the user must still be able to sign out.
    const { error: tokenError } = await supabase.rpc("clear_my_fcm_token");
    if (tokenError && tokenError.code !== "42883") console.warn("تعذر إبطال رمز FCM عند الخروج:", tokenError.message);
    await supabase.auth.signOut();
    setAuth(null);
    setMyStoreId(null); persistentSetMyStoreId(null);
    setRole("customer");
    notify("تم تسجيل الخروج بنجاح");
  }

  if (loading) {
    return (<div dir="rtl" className="flex flex-col items-center justify-center gap-3" style={{ minHeight: "60vh", background: C.paper, fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}><Loader2 size={26} className="animate-spin" color={C.teal} /><span className="text-sm font-bold" style={{ color: C.inkSoft }}>جارٍ تحميل بياناتك المحفوظة...</span></div>);
  }

  return (
    <div dir="rtl" className="souq-next-app" style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif", background: C.paper, minHeight: "100%", color: C.ink }}>
      <style>{`
        * { box-sizing: border-box; }
        input, select, textarea { font-family: 'IBM Plex Sans Arabic', sans-serif; }
        ::selection { background: ${C.teal}25; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .souq-next-app { background: linear-gradient(180deg, #FBFCFF 0%, ${C.paper} 30%, #F8F9FF 100%); }
        .app-header { backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); }
        .role-join-card, .role-benefit-card { transition: transform 180ms cubic-bezier(.23,1,.32,1), box-shadow 180ms cubic-bezier(.23,1,.32,1), border-color 180ms cubic-bezier(.23,1,.32,1), background 180ms cubic-bezier(.23,1,.32,1); }
        .role-join-card:hover, .role-benefit-card:hover { transform: translateY(-5px); border-color: var(--role-accent) !important; box-shadow: 0 20px 38px rgba(74, 76, 160, .14); }
        .role-join-card:focus-visible, .role-guide-cta:focus-visible, .role-benefit-card:focus-within { outline: 3px solid var(--role-accent, ${C.teal}); outline-offset: 3px; }
        .role-join-card:active, .role-guide-cta:active { transform: scale(.98); }
        .dashboard-shell > div:first-child { box-shadow: 0 14px 34px rgba(51, 59, 120, .08); }
        [style*="Reem Kufi"] { font-family: 'IBM Plex Sans Arabic', Inter, sans-serif !important; letter-spacing: -.025em; }
        .dashboard-shell .dashboard-tabs { padding: .35rem; border-radius: 1rem; width: fit-content; background: rgba(255,255,255,.82); border: 1px solid ${C.line}; box-shadow: 0 8px 20px rgba(51,59,120,.05); }
        .dashboard-shell button, .dashboard-shell input, .dashboard-shell select { transition: border-color 160ms cubic-bezier(.23,1,.32,1), box-shadow 160ms cubic-bezier(.23,1,.32,1), transform 160ms cubic-bezier(.23,1,.32,1); }
        @media (prefers-reduced-motion: reduce) { .role-join-card, .role-benefit-card { transition: none; } .role-join-card:hover, .role-benefit-card:hover { transform: none; } }
        @media print { body * { visibility: hidden; } #invoice-print-area, #invoice-print-area * { visibility: visible; } #invoice-print-area { position: absolute; top: 0; left: 0; width: 100%; } .no-print { display: none !important; } }
      `}</style>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-7">
        <header className="app-header flex items-center justify-between mb-3 gap-3 flex-wrap p-3 sm:p-4 rounded-[22px]" style={{ background: "rgba(255,255,255,.78)", border: `1px solid ${C.line}`, boxShadow: "0 12px 30px rgba(51, 59, 120, .07)" }}>
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center rounded-2xl" style={{ width: 44, height: 44, background: `linear-gradient(145deg, ${C.teal}, ${C.purple})`, color: "#fff", boxShadow: `0 10px 20px ${C.teal}35` }}><ShoppingBag size={21} /></span>
            <div><div className="font-black text-xl leading-none tracking-tight" style={{ fontFamily: "Inter, 'IBM Plex Sans Arabic', sans-serif" }}>سوق الجيران</div><div className="text-[11px] mt-1 font-semibold" style={{ color: C.inkSoft }}>{role === "admin" ? "مساحة إدارة المنصة" : "طلبات محلية، تجربة رقمية أسرع"}</div></div>
          </div>
          {role === "admin" ? (
            <button onClick={signOut} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm" style={{ background: C.ink, color: "#fff" }}><LogOut size={15} /> خروج من لوحة الإدارة</button>
          ) : auth && <div className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl" style={{ background: C.sage + "16", color: C.sage, border: `1px solid ${C.sage}2A` }}><span style={{ width: 7, height: 7, borderRadius: 999, background: C.sage }} />{auth.name}<button onClick={() => setShowPhoneChange(true)} className="flex items-center gap-1 mr-1" style={{ color: C.teal, fontSize: 10 }}><Phone size={12} /> الهاتف</button><button onClick={signOut} className="flex items-center gap-1 mr-1" style={{ color: C.inkSoft, fontSize: 10 }}><LogOut size={12} /> خروج</button></div>}
        </header>

        <StripeDivider />
        {role !== "admin" && <p className="text-xs mt-3 mb-1 flex items-center gap-1.5 font-medium" style={{ color: C.inkSoft }}><PackageCheck size={13} color={C.sage} /> تُحفَظ بياناتك تلقائياً وتبقى الخصوصية تحت تحكمك.</p>}

        <div className="mt-4">
          {role === "customer" && (showRoleGuide ? <RoleBenefitsPage onBack={() => setShowRoleGuide(false)} onMerchant={() => { setShowRoleGuide(false); if (auth?.type === "merchant") { setRole("merchant"); persistentSetMyStoreId(auth.id); } else setShowMerchantForm(true); }} onCourier={() => { setShowRoleGuide(false); if (auth?.type === "courier") setRole("courier"); else setShowCourierForm(true); }} /> : <CustomerView stores={stores} setStores={persistentSetStores} cart={cart} setCart={persistentSetCart} orders={orders} setOrders={persistentSetOrders} couriers={couriers} placeOrder={placeOrder} notify={notify} customerId={auth?.id || null} customerConfirmDelivery={customerConfirmDelivery} quoteDelivery={quoteDelivery} confirmCustomerPhoneVerification={confirmCustomerPhoneVerification} requestCustomerPhoneVerification={requestCustomerPhoneVerification} referralCode={referralCode} rewardCoupons={rewardCoupons} claimReferralCode={claimCustomerReferral} />)}
          {role === "merchant" && <MerchantView stores={stores} setStores={persistentSetStores} orders={orders} messages={messages} couriers={couriers} myStoreId={myStoreId} setMyStoreId={persistentSetMyStoreId} notify={notify} registerMerchant={registerMerchant} createProduct={createProduct} createBulkProducts={createBulkProducts} removeProductRemote={removeProductRemote} setProductAvailability={setProductAvailability} setMerchantOrderStatus={setMerchantOrderStatus} merchantConfirmSettlement={merchantConfirmSettlement} reportCustomerAccount={reportCustomerAccount} archiveOrder={archiveOrderForCurrentUser} archiveMessage={archiveMessageForCurrentUser} userId={auth?.id || null} />}
          {role === "courier" && <CourierDashboard courierId={auth?.id || null} stores={stores} orders={orders} messages={messages} couriers={couriers} setCouriers={persistentSetCouriers} notify={notify} onLogout={signOut} claimReadyOrder={claimReadyOrder} courierConfirmPickup={courierConfirmPickup} courierStartDelivery={courierStartDelivery} courierConfirmDelivery={courierConfirmDelivery} courierConfirmRemittance={courierConfirmRemittance} archiveOrder={archiveOrderForCurrentUser} archiveMessage={archiveMessageForCurrentUser} userId={auth?.id || null} />}
          {role === "admin" && <AdminView stores={stores} orders={orders} messages={messages} couriers={couriers} archiveAuditLogs={archiveAuditLogs} archiveNotifications={archiveNotifications} orderNotifications={adminOrderNotifications} mockMessages={mockMessages} archiveAlertSettings={archiveAlertSettings} testAccountCandidates={testAccountCandidates} testAccountReviewAuditLogs={testAccountReviewAuditLogs} customerReports={customerReports} customerBlacklist={customerBlacklist} deliveryPricing={deliveryPricing} referralAnalytics={referralAnalytics} notify={notify} setProviderStatus={setProviderStatus} deleteOrderPermanently={deleteOrderPermanently} deleteMessagePermanently={deleteMessagePermanently} deleteTestAccount={deleteTestAccount} markArchiveNotificationRead={markArchiveNotificationRead} markOrderNotificationRead={markOrderNotificationRead} markAllOrderNotificationsRead={markAllOrderNotificationsRead} saveArchiveAlertSettings={saveArchiveAlertSettings} setCustomerBlacklist={setCustomerBlacklistStatus} saveDeliveryPricing={saveDeliveryPricingConfig} />}
        </div>

        {role === "customer" && !showRoleGuide && (
          <section className="mt-10 p-5 sm:p-6 rounded-[28px]" style={{ background: "rgba(238,240,255,.7)", border: `1px solid ${C.line}` }} data-testid="role-join-cards">
            <div className="flex items-center justify-between gap-3 mb-4"><div><h2 className="font-black text-lg tracking-tight" style={{ color: C.ink }}>ابنِ حضورك على المنصة</h2><p className="text-xs mt-1" style={{ color: C.inkSoft }}>اختر مساحة العمل المناسبة لك، وابدأ برقم هاتفك أو بريدك الإلكتروني.</p></div><div className="flex items-center gap-2"><button data-testid="role-benefits-link" onClick={() => setShowRoleGuide(true)} className="text-xs font-black px-3 py-2 rounded-xl" style={{ background: "#fff", color: C.teal, border: `1px solid ${C.teal}2B` }}>استكشف المسارات</button></div></div>
            <div data-testid="provider-role-switches" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <article data-testid="merchant-role-button" className="role-join-card group text-right p-5 rounded-[22px]" style={{ background: "#fff", border: `1px solid ${C.line}`, boxShadow: "0 8px 22px rgba(51,59,120,.06)", "--role-accent": C.rust }}>
                <span className="w-11 h-11 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: C.rust + "16", color: C.rust }}><Store size={22} /></span><h3 className="font-black mt-4" style={{ color: C.ink }}>انضم كتاجر</h3><p className="text-xs leading-5 mt-1.5" style={{ color: C.inkSoft }}>بيانات المحل ونطاق التوصيل في خطوات واضحة.</p>
                <div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => (auth?.type === "merchant" ? (setRole("merchant"), persistentSetMyStoreId(auth.id)) : setShowMerchantForm(true))} className="py-2.5 rounded-xl text-xs font-black" style={{ background: C.rust, color: "#fff" }}>إنشاء حساب</button><button onClick={() => { setAdminLoginRequested(false); setAuthEntry({ type: "merchant", mode: "login" }); setShowAuth(true); }} className="py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1" style={{ border: `1px solid ${C.rust}44`, color: C.rust }}><LogIn size={13} /> دخول</button></div>
              </article>
              <article data-testid="courier-role-button" className="role-join-card group text-right p-5 rounded-[22px]" style={{ background: "#fff", border: `1px solid ${C.line}`, boxShadow: "0 8px 22px rgba(51,59,120,.06)", "--role-accent": C.teal }}>
                <span className="w-11 h-11 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: C.teal + "16", color: C.teal }}><Bike size={22} /></span><h3 className="font-black mt-4" style={{ color: C.ink }}>انضم كموصل</h3><p className="text-xs leading-5 mt-1.5" style={{ color: C.inkSoft }}>تحكم في ساعاتك ونطاقك وطلباتك النشطة في أي وقت.</p>
                <div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => (auth?.type === "courier" ? setRole("courier") : setShowCourierForm(true))} className="py-2.5 rounded-xl text-xs font-black" style={{ background: C.teal, color: "#fff" }}>إنشاء حساب</button><button data-testid="courier-login-button" onClick={() => { setAdminLoginRequested(false); setAuthEntry({ type: "courier", mode: "login" }); setShowAuth(true); }} className="py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1" style={{ border: `1px solid ${C.teal}44`, color: C.teal }}><LogIn size={13} /> دخول الحساب</button></div>
              </article>
              <article data-testid="customer-role-button" className="role-join-card group text-right p-5 rounded-[22px]" style={{ background: "#fff", border: `1px solid ${C.line}`, boxShadow: "0 8px 22px rgba(51,59,120,.06)", "--role-accent": C.ochre }}>
                <span className="w-11 h-11 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: C.ochre + "16", color: C.ochre }}><User size={22} /></span><h3 className="font-black mt-4" style={{ color: C.ink }}>حساب الزبون</h3><p className="text-xs leading-5 mt-1.5" style={{ color: C.inkSoft }}>تابع طلباتك وعناوينك وقسائمك من بوابتك الخاصة.</p>
                <button onClick={() => { setAdminLoginRequested(false); setAuthEntry({ type: "customer", mode: "login" }); setShowAuth(true); }} className="mt-4 w-full py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5" style={{ background: C.ochre, color: "#fff" }}><UserPlus size={14} /> دخول أو إنشاء حساب</button>
              </article>
            </div>
          </section>
        )}
      </div>

      <Toast message={toast} />

      {showResetConfirm && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(35,32,27,0.5)" }} onClick={() => setShowResetConfirm(false)}><div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl p-5" style={{ background: C.paper }}><div className="flex items-center gap-2 mb-2"><AlertCircle size={20} color={C.rust} /><h3 className="font-black" style={{ fontFamily: "'Reem Kufi', sans-serif", color: C.ink }}>تأكيد إعادة الضبط</h3></div><p className="text-sm mb-5" style={{ color: C.inkSoft }}>سيتم إرجاع كل البيانات إلى حالتها الافتراضية.</p><div className="flex gap-2"><button onClick={() => setShowResetConfirm(false)} className="flex-1 py-2.5 rounded-xl font-bold text-sm" style={{ border: `1px solid ${C.line}`, color: C.inkSoft }}>إلغاء</button><button onClick={resetDemoData} className="flex-1 py-2.5 rounded-xl font-black text-sm" style={{ background: C.rust, color: "#fff" }}>نعم، إعادة الضبط</button></div></div></div>)}
      {showCourierForm && <CourierRegisterModal stores={stores} onSubmit={registerCourier} onClose={() => setShowCourierForm(false)} />}
      {showMerchantForm && <MerchantRegisterModal onSubmit={registerMerchant} onClose={() => setShowMerchantForm(false)} />}
      {showAuth && <AuthModal authenticate={authenticate} requestAccountRecovery={requestAccountRecovery} adminOnly={adminLoginRequested} initialType={authEntry.type} initialMode={authEntry.mode} lockRole onClose={() => { setShowAuth(false); setAdminLoginRequested(false); setAuthEntry({ type: "merchant", mode: "login" }); }} />}
      {showPhoneChange && <PhoneChangeModal currentPhone={auth?.phone} onRequest={requestPhoneChange} onConfirm={confirmPhoneChange} onClose={() => setShowPhoneChange(false)} />}
      {focusedOrderId && <OrderDetailsOverlay order={focusedOrder} onClose={() => setFocusedOrderId(null)} />}
      {role !== "admin" && <button aria-label="دخول الإدارة" onClick={() => { setAdminLoginRequested(true); setShowAuth(true); }} className="fixed top-1 right-1 h-2 w-2 rounded-full opacity-15 transition-opacity hover:opacity-70 focus:opacity-100" style={{ background: C.ink }} />}
    </div>
  );
}



window.SJApp = { default: App };
