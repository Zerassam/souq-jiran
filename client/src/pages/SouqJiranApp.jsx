import { supabase } from "@/lib/supabase";
import React, { useState, useEffect, useMemo, useRef } from "react";
import Papa from "papaparse";
import {
  Store, ShoppingCart, ShoppingBag, ShoppingBasket, Search, MapPin, Clock,
  Plus, Minus, Trash2, Check, X, CheckCircle2, ClipboardList,
  User, ChevronRight, ChevronLeft, AlertCircle, Wheat, Bell,
  Star, Building2, TrendingUp, PackageCheck, PackageX, Loader2,
  Printer, Tag, MessageSquare, Copy, Navigation,
  Package, Droplet, Sparkles, Map as MapIcon, List, Upload, Download,
  FileText, Phone, Palette, CreditCard, Bike, Lock, LogOut, Wallet,
  Percent, CalendarClock, Home, Sun, Sunset, Moon,
  Mail, LogIn, UserPlus, ShieldCheck
} from "lucide-react";

/* ---------------------------------------------------------
   Design tokens
--------------------------------------------------------- */
const C = {
  paper: "#F7F2E4", paperDark: "#EDE4CC", ink: "#23201B", inkSoft: "#5B5548",
  teal: "#1E4B43", tealDark: "#123430", rust: "#B24A2B", ochre: "#D9A441",
  sage: "#7C9A81", line: "#DED2AE", purple: "#6B4A8A",
};
const LOGO_COLORS = [C.teal, C.rust, C.ochre, C.sage, C.purple];
const PLATFORM_COURIER_FEE = 120;

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
    lat: 52, lng: 47, distance: "350 م", status: "approved", rating: 4.6,
    open: 7, close: 22, minOrder: 500, deliveryFee: 150, hasOwnDelivery: true,
    deliveryCommunes: ["البليدة", "بوفاريك"], approvedCourierIds: ["c1"],
    commissionType: "percentage", commissionRate: 10, subscriptionFee: 3000, duesPaid: 0,
    logo: { text: "سأ", color: C.teal }, ccp: "0079999912 45", idDocName: "سجل_تجاري.pdf",
    reviews: [{ id: "r1", customer: "سارة ب.", stars: 5, comment: "خدمة سريعة ومنتجات طازجة", date: "قبل يومين" }],
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
    lat: 55, lng: 50, distance: "700 م", status: "approved", rating: 4.8,
    open: 6, close: 21, minOrder: 300, deliveryFee: 100, hasOwnDelivery: false,
    deliveryCommunes: [], approvedCourierIds: ["c1"],
    commissionType: "percentage", commissionRate: 8, subscriptionFee: 2500, duesPaid: 0,
    logo: { text: "نر", color: C.rust }, ccp: "0088888844 12", idDocName: "سجل_تجاري.pdf",
    reviews: [{ id: "r2", customer: "يوسف ك.", stars: 5, comment: "أسعار ممتازة", date: "أمس" }],
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
    lat: 38, lng: 30, distance: "—", status: "approved", rating: 4.3,
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
    lat: 70, lng: 78, distance: "—", status: "approved", rating: 4.5,
    open: 8, close: 23, minOrder: 400, deliveryFee: 180, hasOwnDelivery: false,
    deliveryCommunes: [], approvedCourierIds: ["c2"],
    commissionType: "percentage", commissionRate: 12, subscriptionFee: 3500, duesPaid: 0,
    logo: { text: "وه", color: C.sage }, ccp: "0099887766 33", idDocName: "سجل_تجاري.pdf",
    reviews: [{ id: "r3", customer: "أمينة ز.", stars: 4, comment: "توصيل سريع", date: "قبل 3 أيام" }],
    products: [
      { id: "p14", name: "بيض بلدي (12)", price: 320, unit: "الطبق", department: "dairy", available: true },
      { id: "p15", name: "بطاطا", price: 70, unit: "الكيلوغرام", department: "veggies", available: true },
      { id: "p16", name: "شاي أخضر", price: 180, unit: "العلبة", department: "pantry", available: true },
    ],
  },
  {
    id: "s5", name: "سوبر ماركت قسنطينة الجديد", phone: "0666 44 55 66",
    wilaya: "قسنطينة", commune: "قسنطينة", address: "",
    lat: 24, lng: 18, distance: "—", status: "awaiting_profile", rating: 0,
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
  lat: 48, lng: 53, distance: "—", status: "pending_review", rating: 0,
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
function StripeDivider({ height = 7 }) { return <div style={{ height, borderRadius: 999, backgroundImage: `repeating-linear-gradient(115deg, ${C.teal} 0 10px, ${C.ochre} 10px 20px)`, opacity: 0.9 }} />; }
function PriceTag({ amount, size = "md" }) {
  const big = size === "lg";
  return (
    <span className="relative inline-flex items-center" style={{ background: C.paper, border: `2px solid ${C.ink}`, borderRadius: 6, padding: big ? "8px 16px 8px 10px" : "4px 10px 4px 8px", transform: "rotate(-2.5deg)", boxShadow: "2px 3px 0 rgba(35,32,27,0.18)" }}>
      <span className="absolute" style={{ width: 9, height: 9, borderRadius: 999, background: C.paper, border: `2px solid ${C.ink}`, left: -5, top: "50%", transform: "translateY(-50%)" }} />
      <span style={{ fontFamily: "Tajawal, sans-serif", fontWeight: 800, color: C.rust, fontSize: big ? 20 : 13 }}>{money(amount)}</span>
    </span>
  );
}
function DeptBadge({ id, size = 16 }) { const info = deptInfo(id); const Icon = info.icon; return <span className="inline-flex items-center justify-center" style={{ width: size + 14, height: size + 14, borderRadius: 999, background: info.color + "22", color: info.color }}><Icon size={size} strokeWidth={2.3} /></span>; }
function StoreAvatar({ logo, size = 42 }) { return <span className="flex items-center justify-center rounded-xl shrink-0 font-black" style={{ width: size, height: size, background: logo?.color || C.teal, color: "#fff", fontSize: size * 0.36, fontFamily: "'Reem Kufi', sans-serif" }}>{logo?.text || <Store size={size * 0.5} />}</span>; }
const STATUS_MAP = {
  pending: { label: "قيد الانتظار", color: C.ochre }, accepted: { label: "تم القبول", color: C.sage },
  preparing: { label: "قيد التحضير", color: C.teal }, ready: { label: "جاهز للتسليم", color: C.rust },
  delivered: { label: "تم التسليم", color: C.tealDark }, declined: { label: "مرفوض", color: "#8B3A2A" },
};
function StatusPill({ status }) { const s = STATUS_MAP[status]; return <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full" style={{ background: s.color + "1F", color: s.color }}><span style={{ width: 6, height: 6, borderRadius: 999, background: s.color }} />{s.label}</span>; }
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
function mapGridStyle(size = 34) { return { backgroundImage: `repeating-linear-gradient(0deg, ${C.line} 0 1px, transparent 1px ${size}px), repeating-linear-gradient(90deg, ${C.line} 0 1px, transparent 1px ${size}px)`, backgroundColor: C.sage + "17" }; }
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
  const wilayaStores = selectedWilaya ? stores.filter((s) => s.wilaya === selectedWilaya) : stores;
  const bounds = computeBounds(wilayaStores.length ? wilayaStores : stores);
  function project(s) { const { minX, maxX, minY, maxY } = bounds; const x = ((s.lng - minX) / (maxX - minX || 1)) * 100, y = ((s.lat - minY) / (maxY - minY || 1)) * 100; return { x: Math.min(96, Math.max(4, x)), y: Math.min(96, Math.max(4, y)) }; }
  const selected = wilayaStores.find((s) => s.id === pinId);
  return (
    <div className="space-y-3">
      <select value={selectedWilaya || ""} onChange={(e) => { onSelectWilaya(e.target.value || null); setPinId(null); }} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }}>
        <option value="">كل الولايات</option>
        {WILAYAS.filter((w) => stores.some((s) => s.wilaya === w)).map((w) => <option key={w} value={w}>{w}</option>)}
      </select>
      <div className="relative rounded-2xl overflow-hidden" style={{ height: 340, ...mapGridStyle(26) }}>
        {wilayaStores.length === 0 && <p className="absolute inset-0 flex items-center justify-center text-sm" style={{ color: C.inkSoft }}>لا محلات في هذه المنطقة بعد.</p>}
        {wilayaStores.map((s) => { const p = project(s); return (<button key={s.id} onClick={() => setPinId(s.id)} className="absolute" style={{ left: `${p.x}%`, top: `${p.y}%`, transform: "translate(-50%, -100%)" }}><MapPin size={pinId === s.id ? 30 : 24} color={C.rust} fill={pinId === s.id ? C.rust : C.rust + "40"} strokeWidth={2.2} /></button>); })}
        {selected && (() => { const p = project(selected); return (
          <div className="absolute z-10 w-60 p-3.5 rounded-xl shadow-lg" style={{ left: `${p.x}%`, top: `${p.y}%`, transform: "translate(-50%, -128%)", background: "#fff", border: `1px solid ${C.line}` }}>
            <div className="flex items-center gap-2 mb-1.5"><StoreAvatar logo={selected.logo} size={30} /><div><div className="font-black text-sm" style={{ color: C.ink }}>{selected.name}</div><div className="text-xs" style={{ color: C.inkSoft }}>{selected.wilaya} · {selected.commune}</div></div></div>
            <div className="flex items-center gap-1 mb-2 text-xs font-bold" style={{ color: C.ochre }}><Star size={12} fill={C.ochre} strokeWidth={0} /> {selected.rating || "جديد"}</div>
            <button onClick={() => onOpenStore(selected.id)} className="w-full py-2 rounded-lg text-xs font-bold" style={{ background: C.teal, color: "#fff" }}>تصفح المنتجات والشراء</button>
          </div>
        ); })()}
      </div>
      <p className="text-xs flex items-center gap-1" style={{ color: C.inkSoft }}><MapIcon size={12} /> خريطة تفاعلية مبسّطة داخل التطبيق.</p>
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
  return (<div className="flex gap-3 overflow-x-auto pb-1">{PROMOS.map((p) => (<div key={p.code} className="shrink-0 w-64 p-3.5 rounded-2xl flex items-center justify-between gap-2" style={{ background: p.color, color: "#fff" }}><div><div className="flex items-center gap-1 text-xs font-bold opacity-90 mb-1"><Tag size={12} /> {p.title}</div><div className="text-xs opacity-90 mb-2">{p.desc}</div><span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.22)" }}>{p.code}</span></div><button onClick={() => copyCode(p.code)} className="flex items-center justify-center rounded-full shrink-0" style={{ width: 32, height: 32, background: "rgba(255,255,255,0.22)" }}><Copy size={14} color="#fff" /></button></div>))}</div>);
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
  const [form, setForm] = useState({ name: "", phone: "", email: "", password: "", vehicle: VEHICLES[0], wilaya: "", commune: "", communes: [], availability: [], useCustomHours: false, hoursFrom: "08:00", hoursTo: "18:00", storeMode: "all", selectedStoreIds: [] });
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

  async function submit() {
    if (!form.name || !form.phone || !form.wilaya) return;
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
    if (!emailValid) { setAuthError("أدخل بريدًا إلكترونيًا صالحًا (مثال: name@example.com)"); setStep(1); return; }
    if (form.password.length < 6) { setAuthError("كلمة المرور يجب أن تكون 6 أحرف على الأقل"); setStep(1); return; }
    setAuthError("");
    setIsSubmitting(true);
    const result = await onSubmit({ ...form, coverageLabel, timeLabel });
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
            <input placeholder="رقم الهاتف" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} />
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ border: `1px solid ${C.line}` }}><Mail size={15} color={C.inkSoft} /><input placeholder="البريد الإلكتروني (اسم المستخدم للدخول)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="flex-1 outline-none text-sm bg-transparent dir-ltr" dir="ltr" /></div>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ border: `1px solid ${C.line}` }}><Lock size={15} color={C.inkSoft} /><input type="password" placeholder="كلمة المرور (4 أحرف على الأقل)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="flex-1 outline-none text-sm bg-transparent" dir="ltr" /></div>
            <select value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }}>{VEHICLES.map((v) => <option key={v} value={v}>{v}</option>)}</select>
            {authError && <p className="text-xs font-bold" style={{ color: "#8B3A2A" }}>{authError}</p>}
            <button onClick={() => setStep(2)} disabled={!form.name || !form.phone} className="w-full py-3 rounded-xl font-black disabled:opacity-40" style={{ background: C.teal, color: "#fff" }}>التالي: التواقيت ونطاق التغطية</button>
            <p className="text-[10px] text-center" style={{ color: C.inkSoft }}>سيُستخدم بريدك الإلكتروني وكلمة المرور للدخول إلى لوحة الموصل مباشرةً.</p>
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
          <p className="text-[11px]" style={{ color: C.inkSoft }}>الدخول لاحقًا: <b dir="ltr" style={{ color: C.ink }}>{form.email}</b></p>
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
   شاشة تسجيل الدخول / إنشاء حساب (إيميل + كلمة مرور)
--------------------------------------------------------- */
function AuthModal({ authenticate, onClose }) {
  const [mode, setMode] = useState("login");
  const [type, setType] = useState("merchant");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailValid) { setError("أدخل بريدًا إلكترونيًا صالحًا"); return; }
    if (password.length < 6) { setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل"); return; }
    setError("");
    setIsSubmitting(true);
    const result = await authenticate({ mode, type, email, password });
    setIsSubmitting(false);
    if (result?.error) { setError(result.error); return; }
    if (result?.notice) { setError(result.notice); return; }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(35,32,27,0.55)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl p-5 space-y-3" style={{ background: C.paper }}>
        <div className="flex items-center justify-between"><h3 className="font-black text-lg flex items-center gap-1.5" style={{ fontFamily: "'Reem Kufi', sans-serif", color: C.ink }}>{mode === "login" ? <LogIn size={18} color={C.teal} /> : <UserPlus size={18} color={C.teal} />} {type === "merchant" ? "منصة التاجر" : type === "courier" ? "لوحة الموصل" : type === "customer" ? "حساب العميل" : "لوحة الإدارة"}</h3><button onClick={onClose}><X size={18} color={C.inkSoft} /></button></div>
        <div className="flex gap-2 p-1 rounded-2xl" style={{ background: C.paperDark, border: `1px solid ${C.line}` }}>
          <button onClick={() => setType("merchant")} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold" style={{ background: type === "merchant" ? C.teal : "transparent", color: type === "merchant" ? "#fff" : C.inkSoft }}><Store size={15} /> تاجر</button>
          <button onClick={() => setType("courier")} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold" style={{ background: type === "courier" ? C.teal : "transparent", color: type === "courier" ? "#fff" : C.inkSoft }}><Bike size={15} /> موصّل</button>
          <button onClick={() => setType("customer")} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold" style={{ background: type === "customer" ? C.teal : "transparent", color: type === "customer" ? "#fff" : C.inkSoft }}><User size={15} /> عميل</button>
          {mode === "login" && <button onClick={() => setType("admin")} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold" style={{ background: type === "admin" ? C.ink : "transparent", color: type === "admin" ? "#fff" : C.inkSoft }}><ShieldCheck size={15} /> إدارة</button>}
        </div>
        <div className="flex gap-2 p-1 rounded-2xl" style={{ background: C.paperDark, border: `1px solid ${C.line}` }}>
          <button onClick={() => { setMode("login"); setError(""); }} className="flex-1 px-3 py-2 rounded-xl text-xs font-bold" style={{ background: mode === "login" ? C.ink : "transparent", color: mode === "login" ? "#fff" : C.inkSoft }}>دخول</button>
          <button onClick={() => { setMode("register"); if (type === "admin") setType("merchant"); setError(""); }} className="flex-1 px-3 py-2 rounded-xl text-xs font-bold" style={{ background: mode === "register" ? C.ink : "transparent", color: mode === "register" ? "#fff" : C.inkSoft }}>حساب جديد</button>
        </div>
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ border: `1px solid ${C.line}` }}><Mail size={15} color={C.inkSoft} /><input placeholder="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1 outline-none text-sm bg-transparent" dir="ltr" /></div>
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ border: `1px solid ${C.line}` }}><Lock size={15} color={C.inkSoft} /><input type="password" placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} className="flex-1 outline-none text-sm bg-transparent" dir="ltr" /></div>
        {error && <p className="text-xs font-bold" style={{ color: "#8B3A2A" }}>{error}</p>}
        <button disabled={isSubmitting} onClick={submit} className="w-full py-3 rounded-xl font-black flex items-center justify-center gap-1.5 disabled:opacity-50" style={{ background: C.rust, color: "#fff" }}>{isSubmitting ? "جارٍ المعالجة..." : mode === "login" ? <><LogIn size={16} /> تسجيل الدخول</> : <><UserPlus size={16} /> إنشاء حساب</>}</button>
        {mode === "register" && <p className="text-[10px] text-center" style={{ color: C.inkSoft }}>{type === "merchant" ? "سيُنشأ حساب محلك فورًا، ثم تكمل بيانات محلك" : type === "courier" ? "بعد الموافقة على انضمامك من المشرف، تدخل لوحتك مباشرةً" : "يُستخدم حسابك لإرسال الطلبات ومتابعتها بأمان."}</p>}
      </div>
    </div>
  );
}

/* ===========================================================
   CUSTOMER VIEW
=========================================================== */
function CustomerView({ stores, setStores, cart, setCart, orders, setOrders, couriers, placeOrder, notify, customerId }) {
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

  const approvedStores = stores.filter((s) => s.status === "approved");
  const visibleStores = useMemo(() => {
    const q = query.trim();
    return approvedStores.filter((s) => {
      if (filterWilaya && s.wilaya !== filterWilaya) return false;
      if (filterCommune && s.commune !== filterCommune) return false;
      if (!q) return true;
      const inName = s.name.includes(q) || s.commune.includes(q) || s.wilaya.includes(q);
      const inDept = s.products.some((p) => deptInfo(p.department).label.includes(q));
      return inName || inDept;
    });
  }, [approvedStores, query, filterWilaya, filterCommune]);

  const openStore = stores.find((s) => s.id === openStoreId);
  const cartStore = stores.find((s) => s.id === cart.storeId);
  const cartCount = cart.items.reduce((a, i) => a + i.qty, 0);
  const cartSubtotal = cart.items.reduce((a, i) => a + i.qty * i.price, 0);
  const discountAmount = appliedPromo ? Math.round((cartSubtotal * appliedPromo.discount) / 100) : 0;
  const deliveryFee = deliveryChoice === "store" ? (cartStore?.deliveryFee || 0) : deliveryChoice === "courier" ? PLATFORM_COURIER_FEE : 0;
  const finalTotal = Math.max(0, cartSubtotal - discountAmount + deliveryFee);
  const belowMinOrder = cartStore && cartStore.minOrder && cartSubtotal < cartStore.minOrder;

  const availableCourier = useMemo(() => {
    if (!cartStore) return null;
    const matching = couriers.filter((c) => c.status === "approved" && c.wilaya === cartStore.wilaya && (c.communes.length === 0 || c.communes.includes(cartStore.commune)) && (c.storeMode === "all" || (c.selectedStoreIds || []).includes(cartStore.id)));
    if (cartStore.approvedCourierIds?.length) { const preferred = matching.find((c) => cartStore.approvedCourierIds.includes(c.id)); if (preferred) return preferred; }
    return matching[0] || null;
  }, [cartStore, couriers]);

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
  function submitReview(order, stars, comment) {
    setStores((prev) => prev.map((s) => { if (s.id !== order.storeId) return s; const reviews = [...(s.reviews || []), { id: "r" + Math.random().toString(36).slice(2, 7), customer: "أنت", stars, comment, date: "الآن" }]; const avg = reviews.reduce((a, r) => a + r.stars, 0) / reviews.length; return { ...s, reviews, rating: Math.round(avg * 10) / 10 }; }));
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, rated: true } : o)));
    setReviewingOrder(null); notify("شكراً على تقييمك! ⭐");
  }

  const myOrders = orders.filter((o) => o.customerId ? o.customerId === customerId : o.customer === "أنت");
  const visibleDepts = openStore ? DEPARTMENTS.filter((d) => openStore.products.some((p) => p.department === d.id)) : [];
  const shownProducts = openStore ? openStore.products.filter((p) => activeDept === "all" || p.department === activeDept) : [];
  const deliveryOptions = [
    cartStore?.hasOwnDelivery && { id: "store", label: "توصيل المحل", desc: money(cartStore.deliveryFee), icon: Truck2 },
    { id: "courier", label: "موصل معتمد من المنصة", desc: availableCourier ? `${availableCourier.name} — ${money(PLATFORM_COURIER_FEE)}` : "لا يوجد موصل متاح حالياً في منطقتك", icon: Bike, disabled: !availableCourier },
    { id: "pickup", label: "استلام ذاتي من المحل", desc: "بدون رسوم توصيل", icon: Home },
  ].filter(Boolean);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          <button onClick={() => setTab("browse")} className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: tab === "browse" ? C.teal : "transparent", color: tab === "browse" ? C.paper : C.inkSoft, border: `1px solid ${tab === "browse" ? C.teal : C.line}` }}>المحلات القريبة</button>
          <button onClick={() => setTab("orders")} className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: tab === "orders" ? C.teal : "transparent", color: tab === "orders" ? C.paper : C.inkSoft, border: `1px solid ${tab === "orders" ? C.teal : C.line}` }}>طلباتي {myOrders.length > 0 && `(${myOrders.length})`}</button>
        </div>
        <button onClick={() => setShowCart(true)} className="relative flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-sm" style={{ background: C.rust, color: C.paper }}><ShoppingCart size={17} /> السلة{cartCount > 0 && <span className="absolute -top-2 -right-2 flex items-center justify-center text-xs font-black rounded-full" style={{ width: 20, height: 20, background: C.ink, color: C.paper }}>{cartCount}</span>}</button>
      </div>

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
            <MapView stores={visibleStores} selectedWilaya={filterWilaya} onSelectWilaya={(w) => { setFilterWilaya(w || ""); setFilterCommune(""); }} onOpenStore={setOpenStoreId} />
          ) : (
            <>
              <WilayaCommuneSelect wilaya={filterWilaya} commune={filterCommune} allowAllWilaya allowAllCommune onChange={({ wilaya, commune }) => { setFilterWilaya(wilaya); setFilterCommune(commune); }} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {visibleStores.map((s) => {
                  const isOpen = new Date().getHours() >= s.open && new Date().getHours() < s.close;
                  return (
                    <button key={s.id} onClick={() => setOpenStoreId(s.id)} className="text-right p-4 rounded-2xl transition hover:-translate-y-0.5" style={{ background: "#fff", border: `1px solid ${C.line}`, boxShadow: "0 1px 0 rgba(35,32,27,0.05)" }}>
                      <div className="flex items-start justify-between mb-3"><StoreAvatar logo={s.logo} size={38} /><span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: isOpen ? C.sage + "22" : "#8883", color: isOpen ? C.sage : C.inkSoft }}>{isOpen ? "مفتوح الآن" : "مغلق"}</span></div>
                      <div className="font-black text-base" style={{ color: C.ink, fontFamily: "'Reem Kufi', sans-serif" }}>{s.name}</div>
                      <div className="flex items-center gap-1 text-xs mt-1" style={{ color: C.inkSoft }}><MapPin size={12} /> {s.wilaya} · {s.commune}</div>
                      <div className="flex items-center justify-between mt-3"><span className="flex items-center gap-1 text-xs font-bold" style={{ color: C.ochre }}><Star size={13} fill={C.ochre} strokeWidth={0} /> {s.rating || "جديد"}{(s.reviews || []).length > 0 && <span style={{ color: C.inkSoft, fontWeight: 500 }}>({s.reviews.length})</span>}</span><span className="text-xs font-bold flex items-center gap-1" style={{ color: C.teal }}>عرض المنتجات <ChevronLeft size={14} /></span></div>
                    </button>
                  );
                })}
                {visibleStores.length === 0 && <p className="col-span-2 text-center py-10 text-sm" style={{ color: C.inkSoft }}>لا توجد محلات مطابقة لبحثك.</p>}
              </div>
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
          {(openStore.reviews || []).length > 0 && (<div><h4 className="font-black text-sm mb-2 flex items-center gap-1.5" style={{ color: C.ink }}><MessageSquare size={14} color={C.teal} /> آراء العملاء</h4><div className="space-y-2">{openStore.reviews.map((r) => (<div key={r.id} className="p-3 rounded-xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}><div className="flex items-center justify-between mb-1"><span className="text-xs font-bold" style={{ color: C.ink }}>{r.customer}</span><StarRating value={r.stars} size={12} /></div>{r.comment && <p className="text-xs" style={{ color: C.inkSoft }}>{r.comment}</p>}<p className="text-[10px] mt-1" style={{ color: C.inkSoft }}>{r.date}</p></div>))}</div></div>)}
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
                {o.status === "delivered" && !o.rated && <button onClick={() => setReviewingOrder(o)} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: C.ochre + "25", color: "#8A6318" }}><Star size={12} /> قيّم تجربتك</button>}
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

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1.5"><span className="text-xs font-bold flex items-center gap-1" style={{ color: C.ink }}><MapPin size={13} /> عنوان التوصيل</span><button onClick={() => setShowMapPicker(true)} className="text-xs font-bold" style={{ color: C.teal }}>{cart.address ? "تعديل الموقع" : "تحديد على الخريطة"}</button></div>
                  {cart.address ? <MapPreview x={cart.address.x} y={cart.address.y} height={60} /> : <p className="text-xs" style={{ color: C.inkSoft }}>لم يتم تحديد الموقع بعد (اختياري).</p>}
                </div>

                <div className="flex gap-2 mb-3"><input value={promoInput} onChange={(e) => setPromoInput(e.target.value)} placeholder="أدخل كود الخصم" className="flex-1 px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} /><button onClick={applyPromo} className="px-4 py-2 rounded-xl text-xs font-bold" style={{ background: C.ochre, color: "#fff" }}>تطبيق</button></div>
                {appliedPromo && <p className="text-xs font-bold mb-3 flex items-center gap-1" style={{ color: C.sage }}><Tag size={12} /> تم تطبيق خصم {appliedPromo.discount}% ({appliedPromo.code})</p>}

                <StripeDivider />
                <div className="my-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs" style={{ color: C.inkSoft }}><span>المجموع الفرعي</span><span>{money(cartSubtotal)}</span></div>
                  {deliveryFee > 0 && <div className="flex items-center justify-between text-xs" style={{ color: C.inkSoft }}><span>رسوم التوصيل</span><span>{money(deliveryFee)}</span></div>}
                  {discountAmount > 0 && <div className="flex items-center justify-between text-xs" style={{ color: C.sage }}><span>الخصم</span><span>- {money(discountAmount)}</span></div>}
                  <div className="flex items-center justify-between pt-1"><span className="font-bold text-sm" style={{ color: C.ink }}>يُدفع نقداً عند الاستلام</span><PriceTag amount={finalTotal} size="lg" /></div>
                </div>
                {belowMinOrder && <p className="text-xs font-bold mb-3" style={{ color: "#8B3A2A" }}>الحد الأدنى للطلب من هذا المحل هو {money(cartStore.minOrder)}.</p>}
                <button disabled={belowMinOrder} onClick={() => { const courierAssigned = deliveryChoice === "courier" ? availableCourier : null; placeOrder(cartStore, appliedPromo, discountAmount, cart.address, deliveryChoice, deliveryFee, courierAssigned); setAppliedPromo(null); setPromoInput(""); setShowCart(false); setTab("orders"); setDeliveryChoice("pickup"); }} className="w-full py-3 rounded-xl font-black disabled:opacity-40" style={{ background: C.rust, color: "#fff" }}>تأكيد الطلب (دفع نقدي)</button>
              </>
            )}
          </div>
        </div>
      )}

      {showMapPicker && <MapPicker title="حدد عنوان التوصيل" initial={cart.address ? { x: cart.address.x, y: cart.address.y } : undefined} onConfirm={(pos) => setCart((prev) => ({ ...prev, address: { x: pos.x, y: pos.y } }))} onClose={() => setShowMapPicker(false)} />}
      {reviewingOrder && <ReviewModal order={reviewingOrder} onSubmit={(stars, comment) => submitReview(reviewingOrder, stars, comment)} onClose={() => setReviewingOrder(null)} />}
      {invoiceOrder && <InvoiceModal order={invoiceOrder} store={stores.find((s) => s.id === invoiceOrder.storeId)} onClose={() => setInvoiceOrder(null)} />}
    </div>
  );
}

function OrderTracker({ status }) {
  const steps = ["pending", "accepted", "preparing", "ready", "delivered"];
  if (status === "declined") return <p className="text-xs font-bold" style={{ color: STATUS_MAP.declined.color }}>تم رفض الطلب من المحل.</p>;
  const idx = steps.indexOf(status);
  return (<div className="flex items-center">{steps.map((s, i) => (<React.Fragment key={s}><div className="flex items-center justify-center rounded-full shrink-0" style={{ width: 20, height: 20, background: i <= idx ? C.teal : C.paperDark, color: i <= idx ? "#fff" : C.inkSoft }}>{i <= idx ? <Check size={11} /> : <span style={{ width: 5, height: 5, borderRadius: 999, background: C.inkSoft }} />}</div>{i < steps.length - 1 && <div className="flex-1 h-0.5" style={{ background: i < idx ? C.teal : C.paperDark }} />}</React.Fragment>))}</div>);
}

/* ===========================================================
   MERCHANT VIEW
=========================================================== */
function MerchantView({ stores, setStores, orders, couriers, myStoreId, setMyStoreId, notify, registerMerchant, createProduct, createBulkProducts, removeProductRemote, setProductAvailability, setMerchantOrderStatus }) {
  const myStore = stores.find((s) => s.id === myStoreId);
  const [merchantMode, setMerchantMode] = useState("select");
  const [form, setForm] = useState({ name: "", phone: "", email: "", password: "", wilaya: "", commune: "", lat: 50, lng: 50 });
  const [stage2, setStage2] = useState({ open: 8, close: 21, minOrder: 0, deliveryFee: 0, hasOwnDelivery: true, deliveryCommunes: [], logoText: "", logoColor: C.teal, ccp: "", idDocName: "" });
  const [authError, setAuthError] = useState("");
  const [tab, setTab] = useState("products");
  const [newProduct, setNewProduct] = useState({ name: "", price: "", unit: "الوحدة", department: "pantry" });
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [invoiceOrder, setInvoiceOrder] = useState(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateStore(patch) { setStores((prev) => prev.map((s) => (s.id === myStoreId ? { ...s, ...patch } : s))); }

  async function registerStore() {
    if (!form.name || !form.phone || !form.wilaya || !form.commune) { notify("يرجى إدخال اسم المحل والهاتف والولاية والبلدية"); return; }
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
    if (!emailValid) { setAuthError("أدخل بريدًا إلكترونيًا صالحًا (مثال: shop@example.com)"); return; }
    if (form.password.length < 6) { setAuthError("كلمة المرور يجب أن تكون 6 أحرف على الأقل"); return; }
    setAuthError("");
    setIsSubmitting(true);
    const result = await registerMerchant(form);
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
  async function setOrderStatus(id, status) { await setMerchantOrderStatus(id, status); }
  const nextStatus = { accepted: "preparing", preparing: "ready", ready: "delivered" };

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
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ border: `1px solid ${C.line}` }}><Phone size={15} color={C.inkSoft} /><input placeholder="رقم الهاتف" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="flex-1 outline-none text-sm bg-transparent" /></div>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ border: `1px solid ${C.line}` }}><Mail size={15} color={C.inkSoft} /><input placeholder="البريد الإلكتروني (اسم المستخدم للدخول)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="flex-1 outline-none text-sm bg-transparent" dir="ltr" /></div>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ border: `1px solid ${C.line}` }}><Lock size={15} color={C.inkSoft} /><input type="password" placeholder="كلمة المرور (4 أحرف على الأقل)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="flex-1 outline-none text-sm bg-transparent" dir="ltr" /></div>
            <WilayaCommuneSelect wilaya={form.wilaya} commune={form.commune} onChange={({ wilaya, commune }) => setForm({ ...form, wilaya, commune })} />
            <div><div className="flex items-center justify-between mb-1.5"><span className="text-xs font-bold flex items-center gap-1" style={{ color: C.ink }}><MapPin size={13} /> موقع المحل</span><button type="button" onClick={() => setShowMapPicker(true)} className="text-xs font-bold" style={{ color: C.teal }}>تحديد / تعديل</button></div><MapPreview x={form.lng} y={form.lat} height={70} /></div>
            {authError && <p className="text-xs font-bold" style={{ color: "#8B3A2A" }}>{authError}</p>}
            <button disabled={isSubmitting} onClick={registerStore} className="w-full py-3 rounded-xl font-black disabled:opacity-50" style={{ background: C.teal, color: "#fff" }}>{isSubmitting ? "جارٍ إنشاء الحساب..." : "إرسال طلب التسجيل"}</button>
            <p className="text-[10px] text-center" style={{ color: C.inkSoft }}>سيُستخدم بريدك الإلكتروني وكلمة المرور للدخول إلى منصة محلك مباشرةً.</p>
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
    <div className="space-y-5">
      <div className="p-4 rounded-2xl" style={{ background: C.paperDark }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3"><StoreAvatar logo={myStore.logo} size={44} /><div><div className="font-black" style={{ fontFamily: "'Reem Kufi', sans-serif", color: C.ink }}>{myStore.name}</div><div className="text-xs" style={{ color: C.inkSoft }}>{myStore.wilaya} · {myStore.commune} · {myStore.open}:00 - {myStore.close}:00</div><div className="flex items-center gap-1 mt-1"><StarRating value={Math.round(myStore.rating || 0)} size={11} /><span className="text-xs font-bold" style={{ color: C.inkSoft }}>{myStore.rating || "لا تقييمات بعد"}</span></div></div></div>
          <span className="text-xs font-bold px-3 py-1 rounded-full shrink-0" style={{ background: C.sage + "30", color: C.tealDark }}>محل مفعّل</span>
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

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setTab("products")} className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: tab === "products" ? C.teal : "transparent", color: tab === "products" ? "#fff" : C.inkSoft, border: `1px solid ${tab === "products" ? C.teal : C.line}` }}>المنتجات</button>
        <button onClick={() => setTab("orders")} className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: tab === "orders" ? C.teal : "transparent", color: tab === "orders" ? "#fff" : C.inkSoft, border: `1px solid ${tab === "orders" ? C.teal : C.line}` }}>الطلبات الواردة {myOrders.filter((o) => o.status === "pending").length > 0 && `(${myOrders.filter((o) => o.status === "pending").length})`}</button>
        <button onClick={() => setTab("delivery")} className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: tab === "delivery" ? C.teal : "transparent", color: tab === "delivery" ? "#fff" : C.inkSoft, border: `1px solid ${tab === "delivery" ? C.teal : C.line}` }}>إعدادات التوصيل</button>
      </div>

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
        <div className="space-y-3">
          {myOrders.length === 0 && <p className="text-center text-sm py-10" style={{ color: C.inkSoft }}>لا توجد طلبات واردة حالياً.</p>}
          {myOrders.map((o) => (<div key={o.id} className="p-4 rounded-2xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}><div className="flex items-center justify-between mb-2"><span className="font-bold text-sm" style={{ color: C.ink }}>{o.customer} · {o.createdAt}</span><StatusPill status={o.status} /></div><div className="text-xs mb-1" style={{ color: C.inkSoft }}>{o.items.map((i) => `${i.name} ×${i.qty}`).join(" · ")}</div><div className="text-xs mb-3 flex items-center gap-1" style={{ color: C.teal }}>{React.createElement(DELIVERY_LABELS[o.deliveryType]?.icon || Home, { size: 12 })} {DELIVERY_LABELS[o.deliveryType]?.label}{o.courier ? ` — ${o.courier.name}` : ""}</div><div className="flex items-center justify-between flex-wrap gap-2"><PriceTag amount={o.total} /><div className="flex gap-2 flex-wrap"><button onClick={() => setInvoiceOrder(o)} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ border: `1px solid ${C.line}`, color: C.inkSoft }}><Printer size={12} /> الفاتورة</button>{o.status === "pending" && (<><button onClick={() => setOrderStatus(o.id, "declined")} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: "#8B3A2A20", color: "#8B3A2A" }}><X size={13} /> رفض</button><button onClick={() => setOrderStatus(o.id, "accepted")} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: C.teal, color: "#fff" }}><Check size={13} /> قبول</button></>)}{nextStatus[o.status] && <button onClick={() => setOrderStatus(o.id, nextStatus[o.status])} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: C.rust, color: "#fff" }}>تحديث إلى «{STATUS_MAP[nextStatus[o.status]].label}»</button>}</div></div></div>))}
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

      {invoiceOrder && <InvoiceModal order={invoiceOrder} store={myStore} onClose={() => setInvoiceOrder(null)} />}
      {showBulkImport && <BulkImportModal onConfirm={addBulkProducts} onClose={() => setShowBulkImport(false)} />}
    </div>
  );
}



/* ---------------------------------------------------------
   لوحة الموصل — الطلبات المتاحة حوله وساعات عمله
--------------------------------------------------------- */
function CourierDashboard({ courierId, stores, orders, couriers, setCouriers, notify, onLogout, claimReadyOrder, completeDelivery }) {
  const [tab, setTab] = useState("available");
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

  const myActiveOrders = (orders || []).filter((o) => o.courier?.id === courierId && !["delivered", "declined"].includes(o.status));
  const completedOrders = (orders || []).filter((o) => o.courier?.id === courierId && o.status === "delivered");

  async function acceptOrder(orderId) { await claimReadyOrder(orderId); }
  async function advanceOrder(orderId) { await completeDelivery(orderId); }

  function updateCourier(patch) { setCouriers((prev) => prev.map((c) => (c.id === courierId ? { ...c, ...patch } : c))); }

  const hoursText = courier.customHours
    ? `من ${courier.customHours.from} إلى ${courier.customHours.to}`
    : (courier.availability || []).map((a) => AVAILABILITY_SLOTS.find((s) => s.id === a)?.label).join(" / ") || "—";

  return (
    <div className="space-y-5">
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
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setTab("available")} className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: tab === "available" ? C.teal : "transparent", color: tab === "available" ? "#fff" : C.inkSoft, border: `1px solid ${tab === "available" ? C.teal : C.line}` }}>الطلبات المتاحة {availableOrders.length > 0 && `(${availableOrders.length})`}</button>
          <button onClick={() => setTab("my")} className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: tab === "my" ? C.teal : "transparent", color: tab === "my" ? "#fff" : C.inkSoft, border: `1px solid ${tab === "my" ? C.teal : C.line}` }}>طلباتي النشطة {myActiveOrders.length > 0 && `(${myActiveOrders.length})`}</button>
          <button onClick={() => setTab("history")} className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: tab === "history" ? C.teal : "transparent", color: tab === "history" ? "#fff" : C.inkSoft, border: `1px solid ${tab === "history" ? C.teal : C.line}` }}>سجل التسليمات ({completedOrders.length})</button>
          <button onClick={() => setTab("hours")} className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: tab === "hours" ? C.teal : "transparent", color: tab === "hours" ? "#fff" : C.inkSoft, border: `1px solid ${tab === "hours" ? C.teal : C.line}` }}>ساعات العمل</button>
        </div>
      </div>

      {tab === "available" && (
        <div className="space-y-3">
          {courier.status !== "approved" && <p className="text-xs font-bold p-3 rounded-xl" style={{ background: C.ochre + "18", color: C.ochre }}>حسابك قيد مراجعة المشرف — ستظهر الطلبات بعد الموافقة على انضمامك.</p>}
          {availableOrders.length === 0 && <div className="text-center py-14 rounded-2xl" style={{ background: "#fff", border: `1px dashed ${C.line}` }}><Bike size={28} style={{ margin: "0 auto 8px", color: C.inkSoft }} /><p className="text-sm" style={{ color: C.inkSoft }}>لا توجد طلبات متاحة في نطاقك حاليًا.</p></div>}
          {availableOrders.map((o) => (
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
          {myActiveOrders.length === 0 && <div className="text-center py-14 rounded-2xl" style={{ background: "#fff", border: `1px dashed ${C.line}` }}><ClipboardList size={28} style={{ margin: "0 auto 8px", color: C.inkSoft }} /><p className="text-sm" style={{ color: C.inkSoft }}>لا توجد طلبات نشطة لديك.</p></div>}
          {myActiveOrders.map((o) => {
            const store = storeById[o.storeId];
            return (
              <div key={o.id} className="p-4 rounded-2xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
                <div className="flex items-center justify-between mb-2"><span className="font-bold text-sm" style={{ color: C.ink }}>{o.storeName}</span><StatusPill status={o.status} /></div>
                <div className="text-xs mb-1" style={{ color: C.inkSoft }}>{o.items.map((i) => `${i.name} ×${i.qty}`).join(" · ")}</div>
                {store && <div className="text-xs mb-3 flex items-center gap-1" style={{ color: C.teal }}><MapPin size={12} /> {store.wilaya} · {store.commune}{store.phone ? ` · هاتف المحل: ${store.phone}` : ""}</div>}
                <OrderTracker status={o.status} />
                <div className="flex gap-2 mt-3 pt-3 flex-wrap" style={{ borderTop: `1px solid ${C.line}` }}>
                  {o.status === "assigned" && <button onClick={() => advanceOrder(o.id)} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: C.sage, color: "#fff" }}><Check size={12} /> تسليم للعميل (تحصيل نقدًا)</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-3">
          {completedOrders.length === 0 && <div className="text-center py-14 rounded-2xl" style={{ background: "#fff", border: `1px dashed ${C.line}` }}><CheckCircle2 size={28} style={{ margin: "0 auto 8px", color: C.inkSoft }} /><p className="text-sm" style={{ color: C.inkSoft }}>لم تُسلّم أي طلبات بعد.</p></div>}
          {completedOrders.map((o) => (
            <div key={o.id} className="p-4 rounded-2xl flex items-center justify-between" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
              <div><div className="text-sm font-bold" style={{ color: C.ink }}>{o.storeName} → {o.customer}</div><div className="text-xs mt-0.5" style={{ color: C.inkSoft }}>{o.items.map((i) => `${i.name} ×${i.qty}`).join(" · ")} · {o.createdAt}</div></div>
              <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: C.sage + "25", color: C.tealDark }}>تم التسليم ✓</span>
            </div>
          ))}
        </div>
      )}

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
function AdminView({ stores, orders, couriers, notify, setProviderStatus }) {
  const pendingReview = stores.filter((s) => s.status === "pending_review");
  const awaitingProfile = stores.filter((s) => s.status === "awaiting_profile");
  const approved = stores.filter((s) => s.status === "approved");
  const revenue = orders.filter((o) => o.status === "delivered").reduce((a, o) => a + o.total, 0);
  const pendingCouriers = couriers.filter((c) => c.status === "pending");

  async function approveInitial(id) { if (await setProviderStatus("merchant", id, "approved")) notify("تم اعتماد التاجر."); }
  async function reject(id) { if (await setProviderStatus("merchant", id, "suspended")) notify("تم تعليق طلب التاجر."); }
  async function approveCourier(id) { if (await setProviderStatus("courier", id, "approved")) notify("تم اعتماد الموصل."); }
  async function rejectCourier(id) { if (await setProviderStatus("courier", id, "suspended")) notify("تم تعليق طلب الموصل."); }

  function storeCommissionDue(store) { if (store.commissionType !== "percentage") return 0; const earned = orders.filter((o) => o.storeId === store.id && o.status === "delivered").reduce((a, o) => a + (o.subtotal || 0) * (store.commissionRate / 100), 0); return Math.max(0, Math.round(earned - (store.duesPaid || 0))); }
  function settleDues(store) { notify(`إدارة العمولات ستُحفظ في مرحلة مالية مستقلة؛ لم يُسجّل تحصيل ${store.name}.`); }
  function updateCommission() { notify("إعدادات العمولة ليست ضمن ترحيل المنتجات والطلبات الحالي."); }

  const totalDues = approved.filter((s) => s.commissionType === "percentage").reduce((a, s) => a + storeCommissionDue(s), 0);
  const stats = [
    { label: "محلات مفعّلة", value: approved.length, icon: Building2, color: C.teal },
    { label: "قيد المراجعة", value: pendingReview.length, icon: AlertCircle, color: C.ochre },
    { label: "الإيرادات المكتملة", value: money(revenue), icon: TrendingUp, color: C.sage },
    { label: "مستحقات المنصة غير المحصّلة", value: money(totalDues), icon: Wallet, color: C.rust },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{stats.map((s) => (<div key={s.label} className="p-4 rounded-2xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}><s.icon size={18} color={s.color} /><div className="font-black text-lg mt-2" style={{ color: C.ink }}>{s.value}</div><div className="text-xs" style={{ color: C.inkSoft }}>{s.label}</div></div>))}</div>

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
   APP ROOT
=========================================================== */
export default function App() {
  const [role, setRole] = useState("customer");
  const [stores, setStores] = useState([]);
  const [orders, setOrders] = useState([]);
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
  const [showAuth, setShowAuth] = useState(false);
  const prevOrdersRef = useRef(null);

  function notify(msg) { setToast(msg); setTimeout(() => setToast(""), 2400); }
  function pushNotification(message) { setNotifications((prev) => { const next = [{ id: "n" + Math.random().toString(36).slice(2, 7), message, time: new Date().toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" }), read: false }, ...prev].slice(0, 25); saveKey(STORAGE.notifications, next); return next; }); }
  function markAllRead() { setNotifications((prev) => { const next = prev.map((n) => ({ ...n, read: true })); saveKey(STORAGE.notifications, next); return next; }); }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [loadedCart, loadedMyStoreId, loadedNotifications] = await Promise.all([
        loadKey(STORAGE.cart, { storeId: null, items: [], address: null }), loadKey(STORAGE.myStoreId, null), loadKey(STORAGE.notifications, []),
      ]);
      if (cancelled) return;
      setStores([]); setOrders([]); setCouriers([]);
      setAccounts([]); setAuth(null);
      setCart(loadedCart); setMyStoreId(loadedMyStoreId); setNotifications(loadedNotifications);
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
    return {
      type,
      id: user.id,
      email: user.email || "",
      name: profile?.name || metadata.name || user.email?.split("@")[0] || "مستخدم سوق الجيران",
      profileUnavailable: Boolean(error),
    };
  }

  async function applySupabaseSession(session) {
    if (!session?.user) {
      setAuth(null);
      setMyStoreId(null);
      setRole("customer");
      setStores([]); setOrders([]); setCouriers([]);
      return;
    }
    const nextAuth = await resolveSupabaseUser(session.user);
    setAuth(nextAuth);
    setRole(nextAuth.type);
    if (nextAuth.type === "merchant") setMyStoreId(nextAuth.id);
    await refreshSupabaseData();
  }

  async function refreshSupabaseData() {
    const [merchantsResult, productsResult, couriersResult, ordersResult, itemsResult] = await Promise.all([
      supabase.from("merchants").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("couriers").select("*").order("created_at", { ascending: false }),
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("order_items").select("*").order("created_at", { ascending: true }),
    ]);
    const migrationMissing = [merchantsResult, productsResult, couriersResult, ordersResult, itemsResult].some((result) => result.error?.code === "42P01");
    if (migrationMissing) {
      notify("طبّق امتداد التجارة في supabase/schema.sql لتفعيل المنتجات والطلبات السحابية.");
      return;
    }
    const productRows = productsResult.data || [];
    const merchantRows = merchantsResult.data || [];
    const courierRows = couriersResult.data || [];
    const productsByMerchant = Object.groupBy(productRows, ({ merchant_id }) => merchant_id);
    const storesById = Object.fromEntries(merchantRows.map((merchant) => [merchant.id, merchant]));
    const itemsByOrder = Object.groupBy(itemsResult.data || [], ({ order_id }) => order_id);
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
      deliveryType: order.delivery_choice, courier: order.courier_id ? { id: order.courier_id, name: "موصل" } : null, rated: false, confirmed: false,
      createdAt: new Date(order.created_at).toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" }),
    })));
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

  async function placeOrder(store, _promo, _discountAmount = 0, address = null, deliveryType = "pickup", deliveryFee = 0) {
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
    persistentSetCart({ storeId: null, items: [], address: null });
    await refreshSupabaseData();
    notify("تم إرسال طلبك — الدفع نقداً عند الاستلام");
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
    return true;
  }

  async function claimReadyOrder(orderId) {
    const { error } = await supabase.rpc("claim_ready_order", { p_order_id: orderId });
    if (error) { notify("تعذر قبول الطلب: " + error.message); return false; }
    await refreshSupabaseData();
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

  async function setProviderStatus(providerType, providerId, status) {
    if (auth?.type !== "admin") { notify("لا تملك صلاحية الإدارة."); return false; }
    const { error } = await supabase.rpc("admin_set_provider_status", { p_provider_type: providerType, p_provider_id: providerId, p_status: status });
    if (error) { notify("تعذر تحديث حالة الحساب: " + error.message); return false; }
    await refreshSupabaseData();
    return true;
  }

  async function createSupabaseAccount({ email, password, role: authRole, name, phone }) {
    const { data: existing } = await supabase.auth.getSession();
    if (existing.session) {
      if (existing.session.user.email?.toLowerCase() !== email.trim().toLowerCase()) {
        return { error: "سجّل الخروج من حسابك الحالي قبل إنشاء حساب جديد." };
      }
      return { user: existing.session.user, session: existing.session, resumed: true };
    }
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { role: authRole, name, phone } },
    });
    if (error) return { error: error.message };
    if (!data.user) return { error: "تعذر إنشاء الحساب. حاول مجدداً." };
    if (data.user.identities?.length === 0) return { error: "هذا البريد مسجل بالفعل. سجّل الدخول لإكمال ملفك." };
    if (!data.session) {
      return { user: data.user, notice: "تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيده، ثم سجّل الدخول." };
    }
    return { user: data.user, session: data.session };
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

  async function authenticate({ mode, type, email, password }) {
    if (mode === "register") {
      const created = await createSupabaseAccount({ email, password, role: type, name: email.split("@")[0], phone: "" });
      if (created.error || created.notice) return created;
      await applySupabaseSession(created.session);
      notify("تم إنشاء الحساب عبر Supabase بنجاح.");
      return {};
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error || !data.session) return { error: "تعذر تسجيل الدخول. تحقق من بريدك الإلكتروني وكلمة المرور." };
    const signedIn = await resolveSupabaseUser(data.session.user);
    if (signedIn.type !== type) {
      await supabase.auth.signOut();
      return { error: "نوع الحساب لا يطابق البوابة المحددة. اختر بوابة حسابك الصحيحة." };
    }
    await applySupabaseSession(data.session);
    if (signedIn.profileUnavailable) notify("تم الدخول. أكمل تطبيق ملف الترحيل في Supabase لتفعيل ملفات الأدوار.");
    return {};
  }

  async function registerMerchant(form) {
    const created = await createSupabaseAccount({ email: form.email, password: form.password, role: "merchant", name: form.name, phone: form.phone });
    if (created.error || created.notice) return created;
    const profile = await ensureSupabaseProfile({ user: created.user, role: "merchant", name: form.name, phone: form.phone });
    if (profile.error) return profile;
    const merchant = {
      id: created.user.id,
      store_name: form.name,
      wilaya: form.wilaya,
      commune: form.commune,
      phone: form.phone,
      delivery_communes: [],
      status: "pending_review",
    };
    const { error } = await supabase.from("merchants").insert(merchant);
    if (error) {
      return { error: "تعذر حفظ ملف المحل. بقي حساب الدخول صالحاً؛ طبّق ملف supabase/schema.sql ثم أرسل النموذج مجدداً لإكمال الملف." };
    }
    const store = { id: created.user.id, name: form.name, phone: form.phone, email: form.email, wilaya: form.wilaya, commune: form.commune, address: "", lat: form.lat, lng: form.lng, distance: "—", status: "pending_review", rating: 0, open: 8, close: 21, minOrder: 0, deliveryFee: 0, hasOwnDelivery: true, deliveryCommunes: [], approvedCourierIds: [], commissionType: "percentage", commissionRate: 10, subscriptionFee: 3000, duesPaid: 0, logo: { text: form.name.slice(0, 2), color: C.teal }, ccp: "", idDocName: "", products: [], reviews: [] };
    persistentSetStores((prev) => [...prev.filter((item) => item.id !== store.id), store]);
    await applySupabaseSession(created.session);
    return { id: created.user.id };
  }

  async function registerCourier(form) {
    const created = await createSupabaseAccount({ email: form.email, password: form.password, role: "courier", name: form.name, phone: form.phone });
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
    const { error } = await supabase.from("couriers").insert(courier);
    if (error) {
      return { error: "تعذر حفظ ملف الموصل. بقي حساب الدخول صالحاً؛ طبّق ملف supabase/schema.sql ثم أرسل النموذج مجدداً لإكمال الملف." };
    }
    const localCourier = { id: created.user.id, name: form.name, phone: form.phone, email: form.email, vehicle: form.vehicle, wilaya: form.wilaya, commune: form.commune || "", communes: form.communes, availability: form.useCustomHours ? [] : form.availability, customHours: form.useCustomHours ? { from: form.hoursFrom, to: form.hoursTo } : null, timeLabel: form.timeLabel || "", coverageLabel: form.coverageLabel || "", storeMode: form.storeMode, selectedStoreIds: form.selectedStoreIds, status: "pending" };
    persistentSetCouriers((prev) => [...prev.filter((item) => item.id !== localCourier.id), localCourier]);
    await applySupabaseSession(created.session);
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
    await supabase.auth.signOut();
    setAuth(null);
    setMyStoreId(null); persistentSetMyStoreId(null);
    setRole("customer");
    notify("تم تسجيل الخروج بنجاح");
  }

  if (loading) {
    return (<div dir="rtl" className="flex flex-col items-center justify-center gap-3" style={{ minHeight: "60vh", background: C.paper, fontFamily: "Tajawal, sans-serif" }}><style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');`}</style><Loader2 size={26} className="animate-spin" color={C.teal} /><span className="text-sm font-bold" style={{ color: C.inkSoft }}>جارٍ تحميل بياناتك المحفوظة...</span></div>);
  }

  return (
    <div dir="rtl" style={{ fontFamily: "Tajawal, sans-serif", background: C.paper, minHeight: "100%", color: C.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&family=Reem+Kufi:wght@400;600;700&display=swap');
        * { box-sizing: border-box; }
        input, select { font-family: 'Tajawal', sans-serif; }
        ::selection { background: ${C.ochre}55; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media print { body * { visibility: hidden; } #invoice-print-area, #invoice-print-area * { visibility: visible; } #invoice-print-area { position: absolute; top: 0; left: 0; width: 100%; } .no-print { display: none !important; } }
      `}</style>

      <div className="max-w-5xl mx-auto px-4 py-5">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: C.teal, color: C.paper }}><ShoppingBag size={20} /></span>
            <div><div className="font-black text-xl leading-none" style={{ fontFamily: "'Reem Kufi', sans-serif" }}>سوق الجيران</div><div className="text-xs mt-0.5" style={{ color: C.inkSoft }}>{role === "admin" ? "لوحة الإدارة" : "توصيل سوبر ماركت — الدفع نقداً عند الاستلام"}</div></div>
          </div>
          {role === "admin" ? (
            <button onClick={signOut} className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm" style={{ background: C.ink, color: "#fff" }}><LogOut size={15} /> خروج من لوحة الإدارة</button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex gap-2 p-1 rounded-2xl" style={{ background: C.paperDark, border: `1px solid ${C.line}` }}>
                <button onClick={() => { signOut(); setRole("customer"); }} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold" style={{ background: role === "customer" ? C.teal : "transparent", color: role === "customer" ? "#fff" : C.inkSoft }}><User size={16} /> عميل</button>
                <button onClick={() => (auth?.type === "merchant" ? (setRole("merchant"), setMyStoreId(auth.id)) : setShowAuth(true))} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold" style={{ background: role === "merchant" ? C.teal : "transparent", color: role === "merchant" ? "#fff" : C.inkSoft }}><Store size={16} /> تاجر</button>
                <button onClick={() => (auth?.type === "courier" ? setRole("courier") : setShowAuth(true))} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold" style={{ background: role === "courier" ? C.teal : "transparent", color: role === "courier" ? "#fff" : C.inkSoft }}><Bike size={16} /> موصّل</button>
              </div>
              {auth ? (
                <div className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-2 rounded-xl" style={{ background: C.sage + "18", color: C.tealDark }}><span style={{ width: 7, height: 7, borderRadius: 999, background: C.sage }} />{auth.name}<button onClick={signOut} className="flex items-center gap-1 mr-1" style={{ color: C.inkSoft, fontSize: 10 }}><LogOut size={12} /> خروج</button></div>
              ) : (
                <button onClick={() => setShowAuth(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold" style={{ background: C.rust, color: "#fff" }}><LogIn size={14} /> دخول بالإيميل</button>
              )}
              <NotificationsBell notifications={notifications} markAllRead={markAllRead} />
              <button onClick={() => setShowResetConfirm(true)} title="إعادة ضبط البيانات التجريبية" className="text-xs font-bold px-3 py-2 rounded-xl" style={{ color: C.inkSoft, border: `1px solid ${C.line}` }}>إعادة ضبط</button>
            </div>
          )}
        </div>

        <StripeDivider />
        {role !== "admin" && <p className="text-xs mt-3 mb-1 flex items-center gap-1.5" style={{ color: C.inkSoft }}><PackageCheck size={13} color={C.sage} /> بياناتك تُحفظ تلقائياً — أغلق المحادثة وارجع لاحقاً وستجدها كما تركتها.</p>}

        <div className="mt-4">
          {role === "customer" && <CustomerView stores={stores} setStores={persistentSetStores} cart={cart} setCart={persistentSetCart} orders={orders} setOrders={persistentSetOrders} couriers={couriers} placeOrder={placeOrder} notify={notify} customerId={auth?.id || null} />}
          {role === "merchant" && <MerchantView stores={stores} setStores={persistentSetStores} orders={orders} couriers={couriers} myStoreId={myStoreId} setMyStoreId={persistentSetMyStoreId} notify={notify} registerMerchant={registerMerchant} createProduct={createProduct} createBulkProducts={createBulkProducts} removeProductRemote={removeProductRemote} setProductAvailability={setProductAvailability} setMerchantOrderStatus={setMerchantOrderStatus} />}
          {role === "courier" && <CourierDashboard courierId={auth?.id || null} stores={stores} orders={orders} couriers={couriers} setCouriers={persistentSetCouriers} notify={notify} onLogout={signOut} claimReadyOrder={claimReadyOrder} completeDelivery={completeDelivery} />}
          {role === "admin" && <AdminView stores={stores} orders={orders} couriers={couriers} notify={notify} setProviderStatus={setProviderStatus} />}
        </div>

        {role !== "admin" && (
          <div className="mt-10 pt-4 flex items-center justify-between" style={{ borderTop: `1px solid ${C.line}` }}>
            <button onClick={() => setShowCourierForm(true)} className="text-xs font-bold flex items-center gap-1.5" style={{ color: C.teal }}><Bike size={14} /> انضم كموصل</button>
          </div>
        )}
      </div>

      <Toast message={toast} />

      {showResetConfirm && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(35,32,27,0.5)" }} onClick={() => setShowResetConfirm(false)}><div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl p-5" style={{ background: C.paper }}><div className="flex items-center gap-2 mb-2"><AlertCircle size={20} color={C.rust} /><h3 className="font-black" style={{ fontFamily: "'Reem Kufi', sans-serif", color: C.ink }}>تأكيد إعادة الضبط</h3></div><p className="text-sm mb-5" style={{ color: C.inkSoft }}>سيتم إرجاع كل البيانات إلى حالتها الافتراضية.</p><div className="flex gap-2"><button onClick={() => setShowResetConfirm(false)} className="flex-1 py-2.5 rounded-xl font-bold text-sm" style={{ border: `1px solid ${C.line}`, color: C.inkSoft }}>إلغاء</button><button onClick={resetDemoData} className="flex-1 py-2.5 rounded-xl font-black text-sm" style={{ background: C.rust, color: "#fff" }}>نعم، إعادة الضبط</button></div></div></div>)}
      {showCourierForm && <CourierRegisterModal stores={stores} onSubmit={registerCourier} onClose={() => setShowCourierForm(false)} />}
      {showAuth && <AuthModal authenticate={authenticate} onClose={() => setShowAuth(false)} />}
    </div>
  );
}



window.SJApp = { default: App };
