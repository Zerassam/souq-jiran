import { supabase } from "@/lib/supabase";
const loadFirebaseHelpers = () => import("@/lib/firebase");
import { FULL_COMMUNES_BY_WILAYA } from "@/data/algeriaCommunes";
import { MapView as GoogleMapView } from "@/components/Map";
import { getStoreBusinessHours, isStoreOpenAtHour } from "@/lib/store-hours";
import { App as CapacitorApp } from "@capacitor/app";
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Store, ShoppingCart, ShoppingBag, ShoppingBasket, Search, MapPin, Clock,
  Plus, Minus, Trash2, Check, X, CheckCircle2, ClipboardList,
  User, ChevronRight, ChevronLeft, AlertCircle, Wheat, Bell,
  Star, Building2, TrendingUp, PackageCheck, PackageX, Loader2,
  Printer, Tag, MessageSquare, Copy, Navigation,
  Package, Droplet, Sparkles, Map as MapIcon, List, Upload, Download,
  FileText, Phone, Palette, CreditCard, Bike, Lock, LogOut, Wallet,
  Percent, CalendarClock, Home, Sun, Sunset, Moon,
  Mail, LogIn, UserPlus, ShieldCheck, Archive, MessageCircle, ArrowLeft, Languages,
  Car, Truck, Images, FileUp, ShieldAlert
} from "lucide-react";

/* ---------------------------------------------------------
   Design tokens
--------------------------------------------------------- */
const C = {
  paper: "#F7F8FC", paperDark: "#EEF0FF", ink: "#172033", inkSoft: "#697386",
  teal: "#5B5BF7", tealDark: "#3730A3", rust: "#F45B7A", ochre: "#F59E0B",
  sage: "#10B981", line: "#E5E7F0", purple: "#8B5CF6",
};
// أدوات التصدير والرموز لا تُحتاج عند فتح السوق؛ تُحمّل فقط عند استعمالها.
const loadCsvParser = () => import("papaparse").then(({ default: parser }) => parser);
const loadQrCode = () => import("qrcode").then(({ default: qrCode }) => qrCode);
const loadJsPdf = () => import("jspdf").then(({ jsPDF }) => jsPDF);
const LANGUAGE_OPTIONS = [
  { code: "ar", label: "العربية", shortLabel: "ع" },
  { code: "fr", label: "Français", shortLabel: "FR" },
];
const UI_COPY = {
  ar: {
    appName: "سوق الجيران", marketplaceCaption: "طلبات محلية، تجربة رقمية أسرع", adminWorkspace: "مساحة إدارة المنصة", signOutAdmin: "خروج من لوحة الإدارة", phone: "الهاتف", signOut: "خروج",
    language: "اللغة", languageArabic: "العربية", languageFrench: "Français", privacy: "تُحفَظ بياناتك تلقائياً وتبقى الخصوصية تحت تحكمك.",
    nearbyStores: "المحلات القريبة", myOrders: "طلباتي", invitationsRewards: "دعوات ومكافآت", cart: "السلة", storeUnavailable: "هذا المتجر غير متاح حالياً عبر الرابط العام.",
    courierService: "خدمة الموصل", approvedCourier: "المعتمد", coverage: "تغطية {area}. تُسند الطلبات عبر المنصة عند الجاهزية لحماية الخصوصية.", profileUnavailable: "هذا الملف غير متاح حالياً؛ يمكنك متابعة التسوق واختيار التوصيل عبر المنصة عند الطلب.",
    searchStores: "ابحث باسم المحل أو نوع النشاط...", suggestedStores: "متاجر مقترحة في {area}", suggestedStoresDescription: "نختار حتى 6 متاجر فقط مع إعطاء الأولوية لتنوع الأنشطة المتاح في المنطقة.", storesCount: "{count}/{max} متجر",
    openNow: "مفتوح الآن", closed: "مغلق", new: "جديد", products: "عرض المنتجات", noStores: "لا توجد محلات مطابقة لبحثك.", backToStores: "رجوع إلى المحلات", allDepartments: "كل الأقسام", verifiedReviews: "آراء موثقة", noOrders: "لا توجد طلبات بعد.", storeHours: "من {from}:00 إلى {to}:00", storeRating: "{rating} ({count} تقييم)", minimumOrder: "الحد الأدنى للطلب: {amount}",
    cartHeading: "سلتك", cartEmpty: "سلتك فارغة حالياً.", orderFrom: "الطلب من: {store}", deliveryMethod: "طريقة الاستلام", deliveryAddress: "عنوان التوصيل", setOnMap: "تحديد على الخريطة", openMap: "فتح الخريطة", addressHint: "وصف دقيق: الحي، الشارع، المعلم القريب", useGps: "استخدام موقعي GPS الحالي", gpsSaved: "تم حفظ إحداثيات GPS الدقيقة للعنوان.", gpsHint: "يمكنك حفظ GPS بعد منح إذن الموقع؛ الخريطة تبقى بديلاً لتحديد نقطة الوصول.", calculatingDelivery: "جارٍ احتساب رسوم التوصيل من الخادم…", serverQuote: "تسعير محسوب من الخادم", distanceEta: "المسافة التقديرية: {distance} كم · الوصول المتوقع: {eta} دقيقة", interwilaya: "توصيل بين الولايات", emailConfirmation: "تأكيد الحساب عبر البريد الإلكتروني", emailVerifiedCopy: "هذا الحساب موثّق ببريد إلكتروني. يمكنك متابعة الطلب.", emailRequiredCopy: "سجّل الدخول وأكمل رمز البريد الإلكتروني قبل متابعة هذا الطلب.", rewardCoupon: "قسيمة مكافأة الإحالة", applyCoupon: "استخدام القسيمة", rewardHeld: "تم حجز خصم مكافأة {amount} ({code})", subtotal: "المجموع الفرعي", deliveryFee: "رسوم التوصيل {computed}", storeDeliveryFee: "رسوم توصيل المحل", discount: "الخصم", cashOnDelivery: "يُدفع نقداً عند الاستلام", orderMinimumNotice: "الحد الأدنى للطلب من هذا المحل هو {amount}.", confirmCashOrder: "تأكيد الطلب (دفع نقدي)", checkoutProgress: "تقدم الطلب", cartStep: "السلة", deliveryStep: "التوصيل", confirmStep: "التأكيد", checkoutReady: "كل شيء جاهز لتأكيد الطلب.", checkoutNeedsAddress: "أضف عنوان التوصيل للمتابعة.", checkoutNeedsQuote: "أدخل العنوان لاحتساب رسوم التوصيل.", checkoutNeedsEmail: "أكمل تأكيد البريد الإلكتروني للمتابعة.", currentStage: "المرحلة الحالية: {stage}", stageReceived: "تم استلام طلبك", stagePreparing: "قيد تحضير الطلب", stageHandover: "قيد تسليمه للموصل", stageOnTheWay: "في الطريق إليك", stageDelivered: "تم التسليم", invoice: "الفاتورة", confirmReceipt: "تأكيد الاستلام والدفع", rateExperience: "قيّم تجربتك", rated: "تم التقييم",
    storeOffers: "عروض تجار", offerCarousel: "شريط عروض", chooseOffer: "اختيار عرض تاجر", merchantOffer: "عرض تاجر", offerNumber: "عرض {count}: {title}", discountPercent: "خصم {value}%", discountAmount: "خصم {value}", offerLimited: "مدة العرض محدودة", offerEnds: "ينتهي {date}",
    buildPresence: "ابنِ حضورك على المنصة", onboardingDescription: "اختر مساحة العمل المناسبة لك، وابدأ برقم هاتفك أو بريدك الإلكتروني.", explorePaths: "استكشف المسارات", merchant: "انضم كتاجر", merchantDescription: "بيانات المحل ونطاق التوصيل في خطوات واضحة.", courier: "انضم كموصل", courierDescription: "تحكم في ساعاتك ونطاقك وطلباتك النشطة في أي وقت.", customer: "حساب الزبون", customerDescription: "تابع طلباتك وعناوينك وقسائمك من بوابتك الخاصة.", createAccount: "إنشاء حساب", signIn: "دخول", accountLogin: "دخول الحساب", customerAuth: "دخول أو إنشاء حساب",
    backShopping: "العودة للتسوّق", clearPath: "مسار واضح قبل التسجيل", joinNetwork: "انضم إلى شبكة الحيّ", roleGuideDescription: "اختر الدور الأنسب لك. ابدأ برقم هاتف محمول جزائري أو بريد إلكتروني، ثم تابع أعمالك من لوحتك الخاصة بعد اكتمال المراجعة.", merchantFor: "للتاجر", merchantTitle: "أدر محلّك من مكان واحد", merchantGuide: "أضف المنتجات، راقب الطلبات، وحدد الموصلين الذين تتعامل معهم ضمن نطاق توصيلك.", merchantBenefit1: "إدارة المنتجات والمخزون", merchantBenefit2: "متابعة الطلبات خطوة بخطوة", merchantBenefit3: "اختيار الموصلين المعتمدين", startMerchant: "ابدأ كتاجر", courierFor: "للموصل", courierTitle: "نظّم توصيلاتك بطريقتك", courierGuide: "حدد أوقاتك، ونطاق تغطيتك، والمحلات التي تناسب مسارك قبل استقبال الطلبات.", courierBenefit1: "أوقات عمل مرنة", courierBenefit2: "تغطية الأحياء والبلديات التي تختارها", courierBenefit3: "طلبات متاحة ضمن نطاقك", startCourier: "ابدأ كموصل",
  },
  fr: {
    appName: "Souq Jiran", marketplaceCaption: "Commandes locales, expérience numérique plus rapide", adminWorkspace: "Espace d’administration", signOutAdmin: "Quitter l’administration", phone: "Téléphone", signOut: "Déconnexion",
    language: "Langue", languageArabic: "العربية", languageFrench: "Français", privacy: "Vos données sont enregistrées automatiquement et votre confidentialité reste sous votre contrôle.",
    nearbyStores: "Commerces proches", myOrders: "Mes commandes", invitationsRewards: "Invitations et récompenses", cart: "Panier", storeUnavailable: "Ce commerce n’est pas disponible actuellement via ce lien public.",
    courierService: "Service de livraison", approvedCourier: "agréé", coverage: "Zone couverte : {area}. Les commandes sont attribuées par la plateforme lorsqu’elles sont prêtes, afin de protéger la confidentialité.", profileUnavailable: "Ce profil n’est pas disponible actuellement. Vous pouvez continuer vos achats et choisir la livraison via la plateforme lors de la commande.",
    searchStores: "Rechercher un commerce ou une activité…", suggestedStores: "Commerces proposés à {area}", suggestedStoresDescription: "Nous proposons jusqu’à 6 commerces en privilégiant la diversité des activités disponibles dans la zone.", storesCount: "{count}/{max} commerces",
    openNow: "Ouvert", closed: "Fermé", new: "Nouveau", products: "Voir les produits", noStores: "Aucun commerce ne correspond à votre recherche.", backToStores: "Retour aux commerces", allDepartments: "Tous les rayons", verifiedReviews: "Avis vérifiés", noOrders: "Aucune commande pour le moment.", storeHours: "De {from}:00 à {to}:00", storeRating: "{rating} ({count} avis)", minimumOrder: "Commande minimale : {amount}",
    cartHeading: "Votre panier", cartEmpty: "Votre panier est vide.", orderFrom: "Commande auprès de : {store}", deliveryMethod: "Mode de réception", deliveryAddress: "Adresse de livraison", setOnMap: "Placer sur la carte", openMap: "Ouvrir la carte", addressHint: "Précisez : quartier, rue, point de repère", useGps: "Utiliser ma position GPS", gpsSaved: "Les coordonnées GPS précises de l’adresse sont enregistrées.", gpsHint: "Autorisez la localisation pour enregistrer le GPS ; la carte reste disponible pour placer le point d’arrivée.", calculatingDelivery: "Calcul des frais de livraison par le serveur…", serverQuote: "Tarif calculé par le serveur", distanceEta: "Distance estimée : {distance} km · arrivée prévue : {eta} min", interwilaya: "Livraison inter-wilayas", emailConfirmation: "Confirmation du compte par e-mail", emailVerifiedCopy: "Ce compte est confirmé par e-mail. Vous pouvez poursuivre la commande.", emailRequiredCopy: "Connectez-vous et confirmez votre e-mail avant de poursuivre cette commande.", rewardCoupon: "Coupon de récompense de parrainage", applyCoupon: "Appliquer", rewardHeld: "Réduction réservée de {amount} ({code})", subtotal: "Sous-total", deliveryFee: "Frais de livraison {computed}", storeDeliveryFee: "Frais de livraison du commerce", discount: "Réduction", cashOnDelivery: "À payer en espèces à la réception", orderMinimumNotice: "La commande minimale pour ce commerce est de {amount}.", confirmCashOrder: "Confirmer la commande (paiement en espèces)", checkoutProgress: "Progression de la commande", cartStep: "Panier", deliveryStep: "Livraison", confirmStep: "Confirmation", checkoutReady: "Tout est prêt pour confirmer la commande.", checkoutNeedsAddress: "Ajoutez l’adresse de livraison pour continuer.", checkoutNeedsQuote: "Indiquez l’adresse pour calculer les frais de livraison.", checkoutNeedsEmail: "Confirmez votre e-mail pour continuer.", currentStage: "Étape actuelle : {stage}", stageReceived: "Commande reçue", stagePreparing: "Préparation en cours", stageHandover: "Remise au livreur", stageOnTheWay: "En route vers vous", stageDelivered: "Livrée", invoice: "Facture", confirmReceipt: "Confirmer la réception et le paiement", rateExperience: "Évaluer votre expérience", rated: "Évaluée",
    storeOffers: "Offres des commerces", offerCarousel: "Carrousel d’offres", chooseOffer: "Choisir une offre", merchantOffer: "Offre commerçant", offerNumber: "Offre {count} : {title}", discountPercent: "Réduction de {value}%", discountAmount: "Réduction de {value}", offerLimited: "Offre à durée limitée", offerEnds: "Se termine le {date}",
    buildPresence: "Développez votre présence sur la plateforme", onboardingDescription: "Choisissez l’espace adapté à votre activité et commencez avec votre téléphone ou votre adresse e-mail.", explorePaths: "Découvrir les parcours", merchant: "Devenir commerçant", merchantDescription: "Les informations du commerce et la zone de livraison en quelques étapes simples.", courier: "Devenir livreur", courierDescription: "Gérez vos horaires, votre zone et vos commandes actives à tout moment.", customer: "Compte client", customerDescription: "Suivez vos commandes, adresses et coupons depuis votre espace personnel.", createAccount: "Créer un compte", signIn: "Connexion", accountLogin: "Connexion au compte", customerAuth: "Connexion ou création de compte",
    backShopping: "Retour aux achats", clearPath: "Un parcours clair avant l’inscription", joinNetwork: "Rejoignez le réseau de votre quartier", roleGuideDescription: "Choisissez le rôle qui vous convient. Commencez avec un numéro algérien ou une adresse e-mail, puis gérez votre activité depuis votre espace après validation.", merchantFor: "Pour les commerçants", merchantTitle: "Gérez votre commerce au même endroit", merchantGuide: "Ajoutez vos produits, suivez vos commandes et choisissez les livreurs avec lesquels vous travaillez dans votre zone.", merchantBenefit1: "Gestion des produits et du stock", merchantBenefit2: "Suivi des commandes étape par étape", merchantBenefit3: "Choix des livreurs agréés", startMerchant: "Commencer comme commerçant", courierFor: "Pour les livreurs", courierTitle: "Organisez vos livraisons à votre rythme", courierGuide: "Définissez vos horaires, votre zone de couverture et les commerces adaptés à votre parcours avant de recevoir des commandes.", courierBenefit1: "Horaires flexibles", courierBenefit2: "Couverture des quartiers et communes de votre choix", courierBenefit3: "Commandes disponibles dans votre zone", startCourier: "Commencer comme livreur",
  },
};
Object.assign(UI_COPY.ar, {
});
Object.assign(UI_COPY.fr, {
});
function uiText(language, key, values = {}) {
  const value = UI_COPY[language]?.[key] ?? UI_COPY.ar[key] ?? key;
  return value.replace(/\{(\w+)\}/g, (_, token) => String(values[token] ?? ""));
}
function localeFor(language) { return language === "fr" ? "fr-DZ" : "ar-DZ"; }
function formatLocalizedMoney(value, language) { return `${Number(value || 0).toLocaleString(localeFor(language))} ${language === "fr" ? "DA" : "دج"}`; }
const PUBLIC_APP_ORIGIN = "https://jiranapp-km95ryzi.manus.space";
const AMIRI_TTF_URL = "/manus-storage/Amiri-Regular_2c083de5.ttf";
let arabicPdfFontBase64Promise;

function buildPublicAppLink(params) {
  const url = new URL("/", PUBLIC_APP_ORIGIN);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

function readPublicQrDestination() {
  const params = new URLSearchParams(window.location.search);
  return {
    storeId: params.get("store")?.trim() || "",
    courierId: params.get("courier")?.trim() || "",
    referralCode: params.get("ref")?.trim().toUpperCase() || "",
  };
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function getArabicPdfFontBase64() {
  if (!arabicPdfFontBase64Promise) {
    arabicPdfFontBase64Promise = fetch(AMIRI_TTF_URL)
      .then((response) => {
        if (!response.ok) throw new Error("Arabic PDF font download failed");
        return response.arrayBuffer();
      })
      .then(arrayBufferToBase64)
      .catch((error) => {
        arabicPdfFontBase64Promise = undefined;
        throw error;
      });
  }
  return arabicPdfFontBase64Promise;
}

async function registerArabicPdfFont(pdf) {
  const fontBase64 = await getArabicPdfFontBase64();
  pdf.addFileToVFS("Amiri-Regular.ttf", fontBase64);
  pdf.addFont("Amiri-Regular.ttf", "Amiri", "normal", 400, "Identity-H");
  pdf.setFont("Amiri", "normal");
}

function writeArabicPdfText(pdf, text, x, y, size, color) {
  pdf.setFont("Amiri", "normal");
  pdf.setFontSize(size);
  pdf.setTextColor(...color);
  // jsPDF processes Arabic joining before drawing; this enables bidi layout too.
  pdf.setR2L(true);
  pdf.text(text, x, y, { align: "center", isInputRtl: true });
  pdf.setR2L(false);
}
const LOGO_COLORS = [C.teal, C.rust, C.ochre, C.sage, C.purple];
const PLATFORM_COURIER_FEE = 120;
const MAX_DISCOVERY_STORES = 6;
const MAX_DISCOVERY_COURIERS = 2;
const EMAIL_OTP_LENGTH = 8;
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
   التقسيم الجغرافي — 58 ولاية جزائرية و1541 بلدية
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
function getCommunes(wilaya) {
  return FULL_COMMUNES_BY_WILAYA[wilaya] || COMMUNES_BY_WILAYA[wilaya] || (wilaya ? [wilaya] : []);
}

const VEHICLE_OPTIONS = [
  { id: "bicycle", label: "دراجة هوائية", ownershipDocumentRequired: false },
  { id: "motorcycle", label: "دراجة نارية", ownershipDocumentRequired: true },
  { id: "car", label: "سيارة", ownershipDocumentRequired: true },
  { id: "truck", label: "شاحنة", ownershipDocumentRequired: true },
];
const LEGACY_VEHICLE_IDS = {
  "دراجة هوائية": "bicycle", "دراجة نارية": "motorcycle", "سيارة": "car", "شاحنة": "truck",
};
const PROVIDER_MEDIA_BUCKET = "provider-media";
const MAX_STORE_PHOTOS = 3;
const MAX_PROVIDER_UPLOAD_BYTES = 8 * 1024 * 1024;
const PROVIDER_DOCUMENT_POLICY = {
  mode: "optional",
  futureRule: "قد تُطلب هذه الوثائق مستقبلاً لإثبات الهوية والنشاط أو ملكية الوسيلة وحماية جميع مستخدمي المنصة.",
};
function normalizeCourierVehicles(value) {
  const source = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(source.map((item) => LEGACY_VEHICLE_IDS[item] || item).filter((id) => VEHICLE_OPTIONS.some((option) => option.id === id)))];
}
function vehicleLabel(value) {
  const ids = normalizeCourierVehicles(value);
  return ids.map((id) => VEHICLE_OPTIONS.find((option) => option.id === id)?.label).filter(Boolean).join("، ") || "غير محددة";
}
function ownershipDocumentVehicleIds(value) {
  return normalizeCourierVehicles(value).filter((id) => VEHICLE_OPTIONS.find((option) => option.id === id)?.ownershipDocumentRequired);
}
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
  return null;
}

async function openAdminContactLink(action, reference) {
  const response = await fetch("/api/account-contact-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, reference }),
  });
  if (!response.ok) return false;
  const payload = await response.json();
  if (!payload?.url) return false;
  window.location.assign(payload.url);
  return true;
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
   Production data
   All accounts, shops, orders and couriers are loaded from Supabase.
--------------------------------------------------------- */

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
function formatOfferValue(offer) {
  if (offer.discountType === "percent") return `خصم ${Number(offer.discountValue)}%`;
  return `خصم ${money(offer.discountValue)}`;
}
function formatOfferEndsAt(endsAt) {
  const end = new Date(endsAt);
  if (Number.isNaN(end.getTime())) return "مدة العرض محدودة";
  return `ينتهي ${end.toLocaleDateString("ar-DZ", { day: "numeric", month: "short" })}`;
}
function OfferMarquee({ offers, onOpenStore, language = "ar" }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isInteracting, setIsInteracting] = useState(false);
  const activeOffers = useMemo(() => offers.filter((offer) => offer.status === "approved" && new Date(offer.startsAt).getTime() <= Date.now() && new Date(offer.endsAt).getTime() > Date.now()), [offers]);
  useEffect(() => {
    setActiveIndex((index) => (activeOffers.length ? index % activeOffers.length : 0));
  }, [activeOffers.length]);
  useEffect(() => {
    const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || isInteracting || activeOffers.length < 2) return undefined;
    const timer = window.setInterval(() => setActiveIndex((index) => (index + 1) % activeOffers.length), 6500);
    return () => window.clearInterval(timer);
  }, [activeOffers.length, isInteracting]);
  if (!activeOffers.length) return null;
  const activeOffer = activeOffers[activeIndex];
  return <section data-testid="merchant-offer-marquee" className="merchant-offer-marquee" aria-label={uiText(language, "storeOffers")} aria-roledescription={uiText(language, "offerCarousel")} onMouseEnter={() => setIsInteracting(true)} onMouseLeave={() => setIsInteracting(false)} onFocusCapture={() => setIsInteracting(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsInteracting(false); }}>
    <div className="merchant-offer-marquee__header"><span className="merchant-offer-marquee__label"><Tag size={13} /> {uiText(language, "storeOffers")}</span></div>
    <div className="merchant-offer-marquee__viewport" id="active-merchant-offer">
      <button key={activeOffer.id} type="button" onClick={() => onOpenStore(activeOffer.merchantId)} className="merchant-offer-marquee__item"><span className="merchant-offer-marquee__badge">{uiText(language, "merchantOffer")}</span><span className="merchant-offer-marquee__store">{activeOffer.storeName}</span><span className="merchant-offer-marquee__title">{activeOffer.title}</span><span className="merchant-offer-marquee__value">{activeOffer.discountType === "percent" ? uiText(language, "discountPercent", { value: Number(activeOffer.discountValue || 0) }) : uiText(language, "discountAmount", { value: formatLocalizedMoney(activeOffer.discountValue, language) })}</span>{activeOffer.description && <span className="merchant-offer-marquee__description">{activeOffer.description}</span>}<span className="merchant-offer-marquee__ends">{uiText(language, "offerEnds", { date: new Date(activeOffer.endsAt).toLocaleDateString(localeFor(language), { day: "numeric", month: "short" }) })}</span></button>
    </div>
    <div className="merchant-offer-marquee__dots" role="tablist" aria-label={uiText(language, "chooseOffer")}>{activeOffers.map((offer, index) => <button key={offer.id} type="button" role="tab" aria-controls="active-merchant-offer" aria-selected={index === activeIndex} tabIndex={index === activeIndex ? 0 : -1} className={`merchant-offer-marquee__dot${index === activeIndex ? " is-active" : ""}`} onClick={() => setActiveIndex(index)}><span className="sr-only">{uiText(language, "offerNumber", { count: index + 1, title: offer.title })}</span></button>)}</div>
  </section>;
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
function PublicCourierAvailability({ couriers, areaLabel, language = "ar" }) {
  return <section className="space-y-3" data-testid="nearby-couriers-panel">
    <div className="flex items-end justify-between gap-3"><div><h3 className="font-black" style={{ color: C.ink, fontFamily: "'Reem Kufi', sans-serif" }}>{uiText(language, "courierService")}</h3><p className="text-xs mt-1" style={{ color: C.inkSoft }}>{uiText(language, "coverage", { area: areaLabel })}</p></div><span className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0" style={{ background: C.teal + "12", color: C.teal }}>{couriers.length}/{MAX_DISCOVERY_COURIERS} {uiText(language, "approvedCourier")}</span></div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {Array.from({ length: MAX_DISCOVERY_COURIERS }).map((_, index) => {
        const courier = couriers[index];
        return <div key={courier?.id || `courier-slot-${index}`} className="p-4 rounded-2xl flex items-center gap-3" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
          <span className="flex items-center justify-center rounded-xl shrink-0" style={{ width: 42, height: 42, background: courier ? C.sage + "18" : C.paperDark, color: courier ? C.sage : C.inkSoft }}><Bike size={20} /></span>
          <div className="min-w-0"><div className="text-sm font-black" style={{ color: C.ink }}>{courier ? `${uiText(language, "courierService")} ${index + 1}` : uiText(language, "approvedCourier")}</div><div className="text-xs mt-1" style={{ color: C.inkSoft }}>{courier ? `${courier.wilaya || areaLabel} · ${courier.commune || uiText(language, "coverage", { area: areaLabel })}` : uiText(language, "coverage", { area: areaLabel })}</div></div>
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
function CheckoutProgress({ cartCount, deliveryChoice, addressReady, language }) {
  const activeIndex = cartCount === 0 ? 0 : deliveryChoice !== "pickup" && !addressReady ? 1 : 2;
  const steps = [
    { label: uiText(language, "cartStep"), icon: ShoppingBasket },
    { label: uiText(language, "deliveryStep"), icon: MapPin },
    { label: uiText(language, "confirmStep"), icon: CheckCircle2 },
  ];
  return <section aria-label={uiText(language, "checkoutProgress")} className="grid grid-cols-3 gap-2 p-3 rounded-xl mb-4" style={{ background: C.teal + "0D", border: `1px solid ${C.teal}25` }}>{steps.map((step, index) => { const Icon = step.icon; const active = index <= activeIndex; return <div key={step.label} className="flex flex-col items-center gap-1 text-center"><span className="flex items-center justify-center rounded-full" style={{ width: 26, height: 26, background: active ? C.teal : C.paperDark, color: active ? "#fff" : C.inkSoft }}>{index < activeIndex ? <Check size={13} /> : <Icon size={13} />}</span><span className="text-[10px] font-bold" style={{ color: active ? C.teal : C.inkSoft }}>{step.label}</span></div>; })}</section>;
}
function getCustomerTrackingStage(status, language) {
  if (["pending", "accepted"].includes(status)) return { key: "stageReceived", index: 0 };
  if (status === "preparing") return { key: "stagePreparing", index: 1 };
  if (["ready", "assigned", "picked_up"].includes(status)) return { key: "stageHandover", index: 2 };
  if (status === "out_for_delivery") return { key: "stageOnTheWay", index: 3 };
  return { key: "stageDelivered", index: 4 };
}
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
function MapPreview({ latitude, longitude, height = 96, onClick }) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  if (!hasCoordinates) {
    return <button type="button" onClick={onClick} className="relative w-full rounded-xl overflow-hidden text-right" style={{ height, ...mapGridStyle(18) }} aria-label="اختيار موقع المحل على الخريطة"><span className="absolute inset-0 flex items-center justify-center gap-2 text-xs font-bold" style={{ color: C.teal }}><MapPin size={17} /> اختر موقع المحل لعرض الخريطة</span></button>;
  }
  return <button type="button" onClick={onClick} className="relative w-full rounded-xl overflow-hidden text-right shadow-sm" style={{ height, border: `1px solid ${C.line}` }} aria-label="فتح خريطة موقع المحل لتعديله"><div className="pointer-events-none absolute inset-0"><GoogleMapView initialCenter={{ lat, lng }} initialZoom={15} markers={[{ id: "merchant-store-location", position: { lat, lng }, title: "موقع المحل" }]} className="h-full w-full rounded-none" /></div><span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black shadow-sm" style={{ background: "#ffffffeb", color: C.teal }}><MapPin size={12} /> موقع المحل</span></button>;
}
function MapPicker({ initial, title = "حدد الموقع على الخريطة", onConfirm, onClose }) {
  const hasInitialCoordinates = Number.isFinite(initial?.latitude) && Number.isFinite(initial?.longitude);
  const legacyPercentMode = !hasInitialCoordinates && Number.isFinite(initial?.x) && Number.isFinite(initial?.y);
  const [pos, setPos] = useState(hasInitialCoordinates ? { latitude: initial.latitude, longitude: initial.longitude } : (initial || { latitude: 28.0339, longitude: 1.6596 }));
  const [locationError, setLocationError] = useState("");
  const [locating, setLocating] = useState(false);
  const mapRef = useRef(null);
  const geographicPosition = Number.isFinite(pos.latitude) && Number.isFinite(pos.longitude);
  function handleMapClick(event) {
    const { lat, lng } = event.latlng;
    setPos({ latitude: lat, longitude: lng });
    setLocationError("");
  }
  function handleLegacyClick(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setPos((current) => ({ ...current, x: Math.max(3, Math.min(97, x)), y: Math.max(3, Math.min(97, y)) }));
  }
  function locateMe() {
    if (!navigator.geolocation) { setLocationError("هذا الجهاز لا يدعم تحديد الموقع. اختر النقطة على الخريطة."); return; }
    setLocating(true); setLocationError("");
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const next = { latitude: coords.latitude, longitude: coords.longitude };
      setPos(next);
      mapRef.current?.setView([next.latitude, next.longitude], Math.max(mapRef.current.getZoom(), 15));
      setLocating(false);
    }, (error) => {
      setLocating(false);
      setLocationError(error.code === 1 ? "اسمح للتطبيق باستخدام الموقع ثم حاول مجدداً." : "تعذر تحديد الموقع حالياً. اختر النقطة على الخريطة.");
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  }
  function confirm() {
    if (!legacyPercentMode && !geographicPosition) { setLocationError("اختر نقطة على الخريطة قبل التأكيد."); return; }
    onConfirm(pos);
    onClose();
  }
  const initialCenter = geographicPosition ? { lat: pos.latitude, lng: pos.longitude } : { lat: 28.0339, lng: 1.6596 };
  const markers = geographicPosition ? [{ id: "selected-location", position: initialCenter, title: "الموقع المحدد" }] : [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(35,32,27,0.5)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl p-5" style={{ background: C.paper }}>
        <div className="flex items-center justify-between mb-1"><h3 className="font-black flex items-center gap-1.5" style={{ fontFamily: "'Reem Kufi', sans-serif", color: C.ink }}><Navigation size={16} color={C.teal} /> {title}</h3><button onClick={onClose} aria-label="إغلاق محدد الموقع"><X size={18} color={C.inkSoft} /></button></div>
        <p className="text-xs mb-3" style={{ color: C.inkSoft }}>{legacyPercentMode ? "اختر النقطة يدوياً." : "انقر على الخريطة لتحديد الموقع بدقة، أو استخدم GPS."}</p>
        {!legacyPercentMode && <button type="button" onClick={locateMe} disabled={locating} className="w-full mb-3 py-2 rounded-xl text-xs font-black disabled:opacity-50" style={{ color: C.teal, border: `1px solid ${C.teal}55` }}><Navigation size={14} className="inline ml-1" /> {locating ? "جارٍ تحديد الموقع..." : "استخدام موقعي الحالي بدقة GPS"}</button>}
        {locationError && <p className="text-xs font-bold mb-2" style={{ color: C.rust }}>{locationError}</p>}
        {legacyPercentMode ? <div onClick={handleLegacyClick} className="relative rounded-xl cursor-crosshair overflow-hidden" style={{ height: 230, ...mapGridStyle(30) }}><span className="absolute" style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%, -95%)" }}><MapPin size={30} color={C.rust} fill={C.rust + "33"} strokeWidth={2.2} /></span></div> : <><div className="rounded-xl overflow-hidden" data-testid="merchant-location-map"><GoogleMapView className="h-[280px]" initialCenter={initialCenter} initialZoom={geographicPosition ? 14 : 6} markers={markers} onMapReady={(map) => { mapRef.current = map; }} onMapClick={handleMapClick} onMapError={() => setLocationError("تعذر تحميل الخريطة. تحقق من الاتصال ثم حاول مجدداً.")} /></div>{geographicPosition && <p className="text-[10px] mt-1 text-center" dir="ltr" style={{ color: C.inkSoft }}>{pos.latitude.toFixed(6)}, {pos.longitude.toFixed(6)}</p>}</>}
        <button onClick={confirm} data-testid="confirm-location" className="w-full mt-4 py-2.5 rounded-xl font-black flex items-center justify-center gap-1.5" style={{ background: C.teal, color: "#fff" }}><Check size={15} /> تأكيد هذا الموقع</button>
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
    reader.onload = async (ev) => {
      try {
        const Papa = await loadCsvParser();
        const parsed = Papa.parse(String(ev.target.result), { header: true, skipEmptyLines: true });
        const cleaned = parsed.data.map((r, i) => ({ id: "tmp" + i, name: (r["الاسم"] || r["name"] || "").trim(), price: Number(r["السعر"] || r["price"] || 0), unit: (r["الوحدة"] || r["unit"] || "الوحدة").trim(), department: DEPARTMENTS.some((d) => d.id === (r["القسم"] || r["department"])) ? (r["القسم"] || r["department"]) : "pantry" })).filter((r) => r.name && r.price > 0);
        if (cleaned.length === 0) setError("لم يتم العثور على صفوف صالحة.");
        setRows(cleaned);
      } catch {
        setRows([]); setError("تعذر قراءة ملف CSV. أعد المحاولة بملف صالح.");
      }
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
  const [form, setForm] = useState({ name: "", email: "", phone: "", wilaya: "", commune: "", addressLabel: "", latitude: null, longitude: null, vehicles: ["motorcycle"], communes: [], deliveryScope: "local", adjacentWilayas: [], availability: [], useCustomHours: false, hoursFrom: "08:00", hoursTo: "18:00", storeMode: "all", selectedStoreIds: [] });
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [step, setStep] = useState(1);
  const [authError, setAuthError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function toggleCommune(c) { setForm((f) => ({ ...f, communes: f.communes.includes(c) ? f.communes.filter((x) => x !== c) : [...f.communes, c] })); }
  function toggleSlot(id) { setForm((f) => ({ ...f, availability: f.availability.includes(id) ? f.availability.filter((x) => x !== id) : [...f.availability, id] })); }
  function toggleStore(id) { setForm((f) => ({ ...f, selectedStoreIds: f.selectedStoreIds.includes(id) ? f.selectedStoreIds.filter((x) => x !== id) : [...f.selectedStoreIds, id] })); }
  function toggleAdjacentWilaya(wilaya) { setForm((f) => ({ ...f, adjacentWilayas: f.adjacentWilayas.includes(wilaya) ? f.adjacentWilayas.filter((item) => item !== wilaya) : [...f.adjacentWilayas, wilaya] })); }
  function toggleVehicle(vehicleId) { setForm((f) => ({ ...f, vehicles: f.vehicles.includes(vehicleId) ? f.vehicles.filter((item) => item !== vehicleId) : [...f.vehicles, vehicleId] })); }

  async function fillFromGoogle() {
    try {
      const profile = await (await loadFirebaseHelpers()).requestGoogleProfilePrefill();
      setForm((current) => ({ ...current, name: profile.name || current.name, email: profile.email }));
      setAuthError("");
    } catch (googleError) { setAuthError(googleError?.message || "تعذر إكمال الملء من Google. أدخل بياناتك يدوياً."); }
  }

  const wilayaStores = stores.filter((s) => s.status === "approved" && s.wilaya === form.wilaya);

  const timeLabel = form.useCustomHours
    ? `من ${form.hoursFrom} إلى ${form.hoursTo}`
    : form.availability.map((a) => AVAILABILITY_SLOTS.find((s) => s.id === a)?.label).join(" / ") || "—";
  const coverageLabel = form.deliveryScope === "local"
    ? `داخل بلدية ${form.commune || "المقر"}`
    : form.deliveryScope === "wilaya"
      ? `جميع بلديات ${form.wilaya || "الولاية"}`
      : `${form.wilaya || "الولاية"} + ${form.adjacentWilayas.join("، ") || "ولايات مجاورة"}`;
  async function submit() {
    if (!form.name || !parseLoginIdentifier(form.email)?.email || !normalizeAlgerianMobile(form.phone) || form.vehicles.length === 0) { setAuthError("أدخل الاسم والبريد الإلكتروني ورقم الهاتف الجزائري، واختر وسيلة توصيل واحدة على الأقل."); setStep(1); return; }
    if (!form.wilaya || (form.deliveryScope === "local" && !form.commune) || (form.deliveryScope === "inter_wilaya" && form.adjacentWilayas.length === 0)) { setAuthError("أكمل نطاق التوصيل قبل إرسال الطلب."); setStep(2); return; }
    setAuthError("");
    setIsSubmitting(true);
    const result = await onSubmit({ ...form, phone: normalizeAlgerianMobile(form.phone), coverageLabel, timeLabel });
    setIsSubmitting(false);
    if (result?.error) { setAuthError(result.error); setStep(1); return; }
    if (result?.pendingOtp) onClose();
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
            <button type="button" onClick={fillFromGoogle} className="w-full py-2 rounded-xl text-xs font-bold" style={{ border: `1px solid ${C.line}`, color: C.teal }}>إكمال الاسم والبريد من Google</button>
            <input required placeholder="الاسم الكامل" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} />
            <input required type="email" autoComplete="email" data-testid="courier-email-input" placeholder="البريد الإلكتروني" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} dir="ltr" />
            <input required placeholder="رقم الهاتف للتواصل (05/06/07)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} inputMode="tel" dir="ltr" />
            <div className="space-y-2"><p className="text-xs font-bold" style={{ color: C.ink }}>منطقة الموصل وعنوانه</p><div className="flex gap-2"><select aria-label="ولاية الموصل" value={form.wilaya} onChange={(e) => setForm({ ...form, wilaya: e.target.value, commune: "", communes: [] })} className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }}><option value="">اختر الولاية</option>{WILAYAS.map((wilaya) => <option key={wilaya} value={wilaya}>{wilaya}</option>)}</select><select aria-label="بلدية الموصل" value={form.commune} onChange={(e) => setForm({ ...form, commune: e.target.value })} disabled={!form.wilaya} className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none disabled:opacity-50" style={{ border: `1px solid ${C.line}` }}><option value="">اختر البلدية</option>{getCommunes(form.wilaya).map((commune) => <option key={commune} value={commune}>{commune}</option>)}</select></div><input aria-label="عنوان الموصل" placeholder="العنوان التفصيلي (اختياري)" value={form.addressLabel} onChange={(e) => setForm({ ...form, addressLabel: e.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} /><button type="button" onClick={() => setShowMapPicker(true)} className="w-full py-2 rounded-xl text-xs font-bold" style={{ color: C.teal, border: `1px solid ${C.teal}55` }}><Navigation size={14} className="inline ml-1" /> {Number.isFinite(form.latitude) && Number.isFinite(form.longitude) ? "تم حفظ موقع GPS" : "تحديد الموقع عبر GPS"}</button></div>
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5"><span className="text-xs font-bold" style={{ color: C.ink }}>وسائل التوصيل المستخدمة</span><span className="text-[10px]" style={{ color: C.inkSoft }}>يمكنك اختيار أكثر من وسيلة</span></div>
              <div className="grid grid-cols-2 gap-2">{VEHICLE_OPTIONS.map((option) => {
                const selected = form.vehicles.includes(option.id);
                const Icon = option.id === "bicycle" || option.id === "motorcycle" ? Bike : option.id === "car" ? Car : Truck;
                return (
                  <button key={option.id} type="button" aria-pressed={selected} onClick={() => toggleVehicle(option.id)} className="p-2.5 rounded-xl text-right flex items-center gap-2" style={{ background: selected ? C.teal + "14" : "#fff", border: `1px solid ${selected ? C.teal : C.line}`, color: selected ? C.teal : C.inkSoft }}>
                    <Icon size={16} /><span className="text-xs font-bold">{option.label}</span>{selected && <Check size={14} className="mr-auto" />}
                  </button>
                );
              })}</div>
              <p className="text-[10px] mt-1.5 leading-5" style={{ color: C.inkSoft }}>يمكنك إضافة صورة لكل وسيلة وفتح صفحة الوثائق الاختيارية من لوحة الموصل بعد إنشاء الملف.</p>
            </div>
            {authError && <p className="text-xs font-bold" style={{ color: "#8B3A2A" }}>{authError}</p>}
            <button onClick={() => { if (!form.name || !parseLoginIdentifier(form.email)?.email || !normalizeAlgerianMobile(form.phone) || form.vehicles.length === 0) { setAuthError("أكمل الاسم والبريد الإلكتروني ورقم الهاتف، واختر وسيلة توصيل واحدة على الأقل."); return; } setAuthError(""); setStep(2); }} className="w-full py-3 rounded-xl font-black" style={{ background: C.teal, color: "#fff" }}>التالي: بيانات الموصل</button>
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
              <p className="text-[11px] mt-2 mb-1" style={{ color: C.inkSoft }}>اختر مستوى نطاق التوصيل المناسب لوسيلتك:</p>
              <div className="grid grid-cols-1 gap-1.5">
                {[{ id: "local", label: "توصيل محلي", note: "داخل البلدية فقط — للدراجات والمشاة" }, { id: "wilaya", label: "توصيل ولائي", note: "جميع بلديات الولاية — للسيارات والدراجات الكبيرة" }, { id: "inter_wilaya", label: "توصيل بين الولايات", note: "ولايتك وولايات مجاورة — للسيارات والشاحنات" }].map((scope) => <button key={scope.id} type="button" onClick={() => setForm({ ...form, deliveryScope: scope.id, communes: scope.id === "local" ? form.communes : [], adjacentWilayas: scope.id === "inter_wilaya" ? form.adjacentWilayas : [] })} className="text-right p-2.5 rounded-xl" style={{ background: form.deliveryScope === scope.id ? C.teal + "14" : "#fff", border: `1px solid ${form.deliveryScope === scope.id ? C.teal : C.line}` }}><b className="block text-xs" style={{ color: form.deliveryScope === scope.id ? C.teal : C.ink }}>{scope.label}</b><span className="block text-[10px] mt-0.5" style={{ color: C.inkSoft }}>{scope.note}</span></button>)}
              </div>
              {form.deliveryScope === "local" && <div className="mt-2"><p className="text-[11px] mb-1" style={{ color: C.inkSoft }}>يمكنك إضافة أحياء أو تجمعات ضمن نطاق البلدية:</p><div className="flex flex-wrap gap-1.5">{getCommunes(form.wilaya).map((c) => (<button key={c} type="button" onClick={() => toggleCommune(c)} className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: form.communes.includes(c) ? C.teal : "transparent", color: form.communes.includes(c) ? "#fff" : C.inkSoft, border: `1px solid ${form.communes.includes(c) ? C.teal : C.line}` }}>{c}</button>))}</div></div>}
              {form.deliveryScope === "inter_wilaya" && <div className="mt-2"><p className="text-[11px] mb-1" style={{ color: C.inkSoft }}>حدد الولايات المجاورة التي تستطيع التوصيل إليها:</p><div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">{WILAYAS.filter((wilaya) => wilaya !== form.wilaya).map((wilaya) => <button key={wilaya} type="button" onClick={() => toggleAdjacentWilaya(wilaya)} className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: form.adjacentWilayas.includes(wilaya) ? C.teal : "transparent", color: form.adjacentWilayas.includes(wilaya) ? "#fff" : C.inkSoft, border: `1px solid ${form.adjacentWilayas.includes(wilaya) ? C.teal : C.line}` }}>{wilaya}</button>)}</div></div>}
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

        {step === 2 && <>
        <div className="p-3.5 rounded-xl space-y-1" style={{ background: C.teal + "12", border: `1px solid ${C.teal}40` }}>
          <p className="text-[11px] font-bold flex items-center gap-1" style={{ color: C.teal }}><CheckCircle2 size={12} /> معاينة إعداداتك</p>
          <p className="text-[11px]" style={{ color: C.inkSoft }}>التواقيت: <b style={{ color: C.ink }}>{timeLabel}</b></p>
          <p className="text-[11px]" style={{ color: C.inkSoft }}>نطاق التغطية: <b style={{ color: C.ink }}>{form.wilaya} — {coverageLabel}</b></p>
          <p className="text-[11px]" style={{ color: C.inkSoft }}>المحلات: <b style={{ color: C.ink }}>{form.storeMode === "all" ? "التوصيل لجميع محلات المنطقة" : `${form.selectedStoreIds.length} محل محدد`}</b></p>
          <p className="text-[11px]" style={{ color: C.inkSoft }}>وسائل التوصيل: <b style={{ color: C.ink }}>{vehicleLabel(form.vehicles)}</b></p>
          <p className="text-[11px]" style={{ color: C.inkSoft }}>البريد: <b dir="ltr" style={{ color: C.ink }}>{form.email || "—"}</b></p>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl font-bold text-sm" style={{ background: "transparent", color: C.inkSoft, border: `1px solid ${C.line}` }}>رجوع</button>
          <button disabled={isSubmitting} onClick={submit} className="flex-1 py-3 rounded-xl font-black disabled:opacity-50" style={{ background: C.rust, color: "#fff" }}>{isSubmitting ? "جارٍ إنشاء الحساب..." : "إرسال طلب الانضمام"}</button>
        </div>
        </>}
        {showMapPicker && <MapPicker initial={Number.isFinite(form.latitude) ? { latitude: form.latitude, longitude: form.longitude, x: 50, y: 50 } : undefined} title="حدد موقع الموصل" onConfirm={(position) => { setForm((current) => ({ ...current, latitude: Number(position.latitude) || null, longitude: Number(position.longitude) || null })); setShowMapPicker(false); }} onClose={() => setShowMapPicker(false)} />}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   تسجيل تاجر — بيانات الحساب ثم بيانات المحل ونطاق التوصيل
--------------------------------------------------------- */
function MerchantRegisterModal({ onSubmit, onClose }) {
  const [form, setForm] = useState({ ownerName: "", email: "", phone: "", storeName: "", wilaya: "", commune: "", addressLabel: "", latitude: null, longitude: null, hasOwnDelivery: true, deliveryWilayas: [], deliveryCommunes: [], nationwideCoverage: false });
  const [step, setStep] = useState(1);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [authError, setAuthError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [communeSearch, setCommuneSearch] = useState("");

  function toggleDeliveryCommune(commune) {
    setForm((current) => ({ ...current, deliveryCommunes: current.deliveryCommunes.includes(commune) ? current.deliveryCommunes.filter((item) => item !== commune) : [...current.deliveryCommunes, commune] }));
  }
  function toggleDeliveryWilaya(wilaya) { setForm((current) => ({ ...current, nationwideCoverage: false, deliveryWilayas: current.deliveryWilayas.includes(wilaya) ? current.deliveryWilayas.filter((item) => item !== wilaya) : [...current.deliveryWilayas, wilaya] })); }
  function setNationwideCoverage() { setForm((current) => ({ ...current, nationwideCoverage: true, deliveryWilayas: [...WILAYAS], deliveryCommunes: [] })); }
  async function fillFromGoogle() {
    try {
      const profile = await (await loadFirebaseHelpers()).requestGoogleProfilePrefill();
      setForm((current) => ({ ...current, ownerName: profile.name || current.ownerName, email: profile.email }));
      setAuthError("");
    } catch (googleError) { setAuthError(googleError?.message || "تعذر إكمال الملء من Google. أدخل بياناتك يدوياً."); }
  }

  async function submit() {
    if (!form.storeName || !form.wilaya || !form.commune || (!form.nationwideCoverage && form.deliveryWilayas.length === 0)) { setAuthError("أكمل اسم المحل والولاية والبلدية وحدد ولاية تغطية واحدة على الأقل أو كامل التراب الوطني."); setStep(2); return; }
    if (!form.ownerName || !parseLoginIdentifier(form.email)?.email || !normalizeAlgerianMobile(form.phone)) { setAuthError("أدخل اسم صاحب المحل والبريد الإلكتروني ورقم الهاتف الجزائري في الحقول المخصصة."); setStep(1); return; }
    setAuthError("");
    setIsSubmitting(true);
    const result = await onSubmit({ ...form, name: form.storeName, phone: normalizeAlgerianMobile(form.phone), deliveryWilayas: form.nationwideCoverage ? [...WILAYAS] : form.deliveryWilayas });
    setIsSubmitting(false);
    if (result?.error) { setAuthError(result.error); setStep(1); return; }
    if (result?.pendingOtp) onClose();
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
          <button type="button" onClick={fillFromGoogle} className="w-full py-2 rounded-xl text-xs font-bold" style={{ border: `1px solid ${C.line}`, color: C.rust }}>إكمال الاسم والبريد من Google</button>
          <input required aria-label="اسم صاحب المحل" placeholder="اسم صاحب المحل" value={form.ownerName} onChange={(event) => setForm({ ...form, ownerName: event.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} />
          <input required type="email" autoComplete="email" data-testid="merchant-email-input" placeholder="البريد الإلكتروني" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} dir="ltr" />
          <input required aria-label="هاتف التواصل للتاجر" placeholder="رقم الهاتف للتواصل (05/06/07)" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} inputMode="tel" dir="ltr" />
          {authError && <p className="text-xs font-bold" style={{ color: "#8B3A2A" }}>{authError}</p>}
          <button onClick={() => { if (!form.ownerName || !parseLoginIdentifier(form.email)?.email || !normalizeAlgerianMobile(form.phone)) { setAuthError("أكمل اسم صاحب المحل والبريد الإلكتروني ورقم الهاتف في الحقول المخصصة."); return; } setAuthError(""); setStep(2); }} className="w-full py-3 rounded-xl font-black" style={{ background: C.rust, color: "#fff" }}>التالي: بيانات المحل</button>
        </div>}
        {step === 2 && <div className="space-y-4">
          <div><label className="text-xs font-bold flex items-center gap-1 mb-1.5" style={{ color: C.ink }}><Store size={13} /> بيانات المحل</label><input aria-label="اسم المحل" placeholder="اسم المحل" value={form.storeName} onChange={(event) => setForm({ ...form, storeName: event.target.value })} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} /></div>
          <div><label className="text-xs font-bold flex items-center gap-1 mb-1.5" style={{ color: C.ink }}><MapPin size={13} /> موقع المحل ونطاق التوصيل</label><div className="flex gap-2"><select value={form.wilaya} onChange={(event) => setForm({ ...form, wilaya: event.target.value, commune: "", deliveryCommunes: [] })} className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }}><option value="" disabled>اختر الولاية</option>{WILAYAS.map((wilaya) => <option key={wilaya} value={wilaya}>{wilaya}</option>)}</select><select value={form.commune} onChange={(event) => setForm({ ...form, commune: event.target.value })} disabled={!form.wilaya} className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none disabled:opacity-50" style={{ border: `1px solid ${C.line}` }}><option value="">بلدية المحل</option>{getCommunes(form.wilaya).map((commune) => <option key={commune} value={commune}>{commune}</option>)}</select></div><input aria-label="عنوان المحل" placeholder="العنوان التفصيلي (الشارع، رقم المحل...)" value={form.addressLabel} onChange={(event) => setForm({ ...form, addressLabel: event.target.value })} className="w-full mt-2 px-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} /><button type="button" onClick={() => setShowMapPicker(true)} className="w-full mt-2 py-2.5 rounded-xl text-xs font-black" style={{ color: C.teal, border: `1px solid ${C.teal}55` }}><Navigation size={14} className="inline ml-1" /> {Number.isFinite(form.latitude) && Number.isFinite(form.longitude) ? "تم تحديد موقع المحل بدقة GPS" : "تحديد موقع المحل بدقة عبر GPS"}</button>{Number.isFinite(form.latitude) && <p className="text-[10px] mt-1" dir="ltr" style={{ color: C.inkSoft }}>{form.latitude.toFixed(6)}, {form.longitude.toFixed(6)}</p>}</div>
          <div className="space-y-2"><p className="text-[11px] font-bold" style={{ color: C.ink }}>من سيتولى التوصيل؟</p><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setForm((current) => ({ ...current, hasOwnDelivery: true }))} className="px-3 py-2 rounded-xl text-xs font-bold" style={{ background: form.hasOwnDelivery ? C.teal : "transparent", color: form.hasOwnDelivery ? "#fff" : C.inkSoft, border: `1px solid ${form.hasOwnDelivery ? C.teal : C.line}` }}>توصيل المحل</button><button type="button" onClick={() => setForm((current) => ({ ...current, hasOwnDelivery: false }))} className="px-3 py-2 rounded-xl text-xs font-bold" style={{ background: !form.hasOwnDelivery ? C.teal : "transparent", color: !form.hasOwnDelivery ? "#fff" : C.inkSoft, border: `1px solid ${!form.hasOwnDelivery ? C.teal : C.line}` }}>توصيل المنصة</button></div><p className="text-[10px]" style={{ color: C.inkSoft }}>يمكن تغيير هذا الإعداد لاحقاً؛ اختيار توصيل المنصة لا يعتمد على GPS الخاص بالمحل.</p><div className="flex items-center justify-between"><p className="text-[11px] font-bold" style={{ color: C.ink }}>الولايات المغطاة</p><button type="button" onClick={setNationwideCoverage} className="text-[11px] font-bold px-2 py-1 rounded-lg" style={{ color: C.rust, border: `1px solid ${C.rust}55` }}>تغطية كامل التراب الوطني (58 ولاية)</button></div><div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">{WILAYAS.map((wilaya) => <button key={wilaya} type="button" onClick={() => toggleDeliveryWilaya(wilaya)} className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: form.deliveryWilayas.includes(wilaya) ? C.rust : "transparent", color: form.deliveryWilayas.includes(wilaya) ? "#fff" : C.inkSoft, border: `1px solid ${form.deliveryWilayas.includes(wilaya) ? C.rust : C.line}` }}>{wilaya}</button>)}</div></div>
          {form.wilaya && <div><div className="flex items-center justify-between gap-2 mb-2"><p className="text-[11px]" style={{ color: C.inkSoft }}>بلديات ولاية المحل: ابحث، حدد الكل، أو ألغِ أي بلدية بالنقر.</p><button type="button" onClick={() => setForm((current) => ({ ...current, deliveryCommunes: getCommunes(form.wilaya) }))} className="text-[11px] font-bold" style={{ color: C.rust }}>تحديد كافة البلديات</button></div><input value={communeSearch} onChange={(event) => setCommuneSearch(event.target.value)} placeholder="بحث داخل البلديات" className="w-full px-3 py-2 rounded-xl text-xs outline-none mb-2" style={{ border: `1px solid ${C.line}` }} /> <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">{getCommunes(form.wilaya).filter((commune) => commune.includes(communeSearch.trim())).map((commune) => <button key={commune} type="button" onClick={() => toggleDeliveryCommune(commune)} className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: form.deliveryCommunes.includes(commune) ? C.rust : "transparent", color: form.deliveryCommunes.includes(commune) ? "#fff" : C.inkSoft, border: `1px solid ${form.deliveryCommunes.includes(commune) ? C.rust : C.line}` }}>{commune}</button>)}</div></div>}
          <div className="p-3.5 rounded-xl space-y-1" style={{ background: C.rust + "12", border: `1px solid ${C.rust}35` }}><p className="text-[11px] font-bold" style={{ color: C.rust }}>معاينة طلب الانضمام</p><p className="text-[11px]" style={{ color: C.inkSoft }}>المحل: <b style={{ color: C.ink }}>{form.storeName || "—"}</b></p><p className="text-[11px]" style={{ color: C.inkSoft }}>التغطية: <b style={{ color: C.ink }}>{form.nationwideCoverage ? "كامل التراب الوطني" : `${form.deliveryWilayas.length || 0} ولاية`}</b></p><p className="text-[11px]" style={{ color: C.inkSoft }}>البريد: <b dir="ltr" style={{ color: C.ink }}>{form.email || "—"}</b></p></div>
        </div>}
        {step === 2 && <div className="flex gap-2"><button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl font-bold text-sm" style={{ background: "transparent", color: C.inkSoft, border: `1px solid ${C.line}` }}>رجوع</button><button disabled={isSubmitting} onClick={submit} className="flex-1 py-3 rounded-xl font-black disabled:opacity-50" style={{ background: C.rust, color: "#fff" }}>{isSubmitting ? "جارٍ إنشاء الحساب..." : "إرسال طلب الانضمام"}</button></div>}
      </div>
      {showMapPicker && <MapPicker initial={Number.isFinite(form.latitude) ? { latitude: form.latitude, longitude: form.longitude, x: 50, y: 50 } : undefined} title="حدد موقع المحل بدقة" onConfirm={(position) => setForm((current) => ({ ...current, latitude: Number(position.latitude) || null, longitude: Number(position.longitude) || null }))} onClose={() => setShowMapPicker(false)} />}

    </div>
  );
}

/* ---------------------------------------------------------
   صور الملف ووثائقه — اختيارية في المرحلة الحالية
--------------------------------------------------------- */
function ProviderMediaManager({ providerId, providerRole, vehicles = [], accent = C.teal, title }) {
  const [mediaItems, setMediaItems] = useState([]);
  const [loadingMedia, setLoadingMedia] = useState(true);
  const [uploadingSlot, setUploadingSlot] = useState("");
  const [mediaError, setMediaError] = useState("");
  const vehicleIds = normalizeCourierVehicles(vehicles);
  const ownershipVehicleIds = ownershipDocumentVehicleIds(vehicles);
  const isMerchant = providerRole === "merchant";
  const storePhotos = mediaItems.filter((item) => item.kind === "store_photo");

  async function withSignedUrls(rows) {
    return Promise.all(rows.map(async (item) => {
      const { data, error } = await supabase.storage.from(PROVIDER_MEDIA_BUCKET).createSignedUrl(item.storage_path, 60 * 30);
      return { ...item, signedUrl: error ? "" : data?.signedUrl || "" };
    }));
  }
  async function loadMedia() {
    if (!providerId) return;
    setLoadingMedia(true); setMediaError("");
    const { data, error } = await supabase.from("provider_media").select("*").eq("provider_id", providerId).order("created_at", { ascending: true });
    if (error) {
      setMediaItems([]);
      setMediaError(error.code === "42P01" ? "تجهيز مساحة الصور والوثائق لم يُطبّق بعد. طبّق ترحيل الوسائط الجديد في Supabase ثم أعد المحاولة." : "تعذر تحميل ملفاتك الخاصة حالياً.");
    } else {
      setMediaItems(await withSignedUrls(data || []));
    }
    setLoadingMedia(false);
  }
  useEffect(() => { void loadMedia(); }, [providerId]);

  function slotItem(kind, vehicleType = null) { return mediaItems.find((item) => item.kind === kind && (item.vehicle_type || null) === vehicleType); }
  async function uploadMedia(file, kind, vehicleType = null) {
    if (!file || !providerId) return;
    const isPhoto = kind === "store_photo" || kind === "vehicle_photo";
    if (file.size > MAX_PROVIDER_UPLOAD_BYTES) { setMediaError("الحد الأقصى لحجم الملف هو 8 ميغابايت."); return; }
    if (isPhoto && !file.type.startsWith("image/")) { setMediaError("اختر صورة بصيغة مدعومة لهذه الخانة."); return; }
    if (!isPhoto && !(file.type.startsWith("image/") || file.type === "application/pdf")) { setMediaError("اختر صورة أو ملف PDF للوثيقة الاختيارية."); return; }
    if (kind === "store_photo" && storePhotos.length >= MAX_STORE_PHOTOS) { setMediaError("يمكنك إدراج ثلاث صور للمتجر كحد أقصى."); return; }
    if (kind !== "store_photo" && slotItem(kind, vehicleType)) { setMediaError("توجد بالفعل مادة مرتبطة بهذه الخانة؛ احذفها أولاً إذا أردت استبدالها."); return; }
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-90) || "file";
    const storagePath = `${providerId}/${kind}/${vehicleType || "general"}-${crypto.randomUUID()}-${safeName}`;
    const slotKey = `${kind}-${vehicleType || "general"}`;
    setUploadingSlot(slotKey); setMediaError("");
    const { error: uploadError } = await supabase.storage.from(PROVIDER_MEDIA_BUCKET).upload(storagePath, file, { cacheControl: "3600", upsert: false, contentType: file.type });
    if (uploadError) { setUploadingSlot(""); setMediaError("تعذر رفع الملف إلى المساحة الخاصة. تحقق من تطبيق ترحيل الوسائط وصلاحيات الحساب."); return; }
    const { error: recordError } = await supabase.from("provider_media").insert({
      provider_id: providerId, provider_role: providerRole, kind, vehicle_type: vehicleType,
      storage_path: storagePath, original_name: file.name, mime_type: file.type,
    });
    setUploadingSlot("");
    if (recordError) { setMediaError("رُفع الملف لكن تعذر ربطه بملفك. لن يُعرض ضمن حسابك حتى تكتمل تهيئة قاعدة البيانات."); return; }
    await loadMedia();
  }
  async function removeMedia(item) {
    const { error } = await supabase.from("provider_media").delete().eq("id", item.id);
    if (error) { setMediaError("تعذر إزالة مرجع الملف من ملفك."); return; }
    await loadMedia();
  }
  function fileChange(event, kind, vehicleType = null) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void uploadMedia(file, kind, vehicleType);
  }
  function UploadSlot({ label, note, kind, vehicleType = null, accept = "image/*,.pdf", existing }) {
    const slotKey = `${kind}-${vehicleType || "general"}`;
    if (existing) return <div className="p-3 rounded-xl flex items-center gap-2" style={{ background: "#fff", border: `1px solid ${C.line}` }}><FileText size={17} color={accent} /><div className="min-w-0 flex-1"><p className="text-xs font-bold truncate" style={{ color: C.ink }}>{existing.original_name}</p><p className="text-[10px] mt-0.5" style={{ color: C.inkSoft }}>مرفوع اختيارياً ولم تتم مراجعته أو اعتماده.</p></div>{existing.signedUrl && <a href={existing.signedUrl} target="_blank" rel="noreferrer" className="text-[11px] font-bold" style={{ color: accent }}>عرض</a>}<button type="button" onClick={() => void removeMedia(existing)} className="text-[11px] font-bold" style={{ color: C.rust }}>إزالة</button></div>;
    return <label className="block p-3 rounded-xl cursor-pointer" style={{ background: "#fff", border: `1px dashed ${accent}88` }}><div className="flex items-start gap-2"><FileUp size={17} color={accent} /><div className="flex-1"><p className="text-xs font-bold" style={{ color: C.ink }}>{label}</p><p className="text-[10px] leading-5 mt-0.5" style={{ color: C.inkSoft }}>{note}</p></div>{uploadingSlot === slotKey && <Loader2 size={15} color={accent} className="animate-spin" />}</div><input type="file" accept={accept} onChange={(event) => fileChange(event, kind, vehicleType)} className="hidden" /></label>;
  }

  return <section className="space-y-4" data-testid={`${providerRole}-media-manager`}>
    <div className="p-4 rounded-2xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
      <div className="flex items-start gap-3"><span className="flex items-center justify-center rounded-xl shrink-0" style={{ width: 40, height: 40, background: accent + "18", color: accent }}><Images size={20} /></span><div><h3 className="font-black" style={{ color: C.ink }}>{title}</h3><p className="text-xs leading-5 mt-1" style={{ color: C.inkSoft }}>الصور تعرّف بنشاطك أو بوسائل توصيلك. تبقى الملفات خاصة بصاحب الحساب والإدارة، ولا تعرض الوثائق ضمن واجهة التسوق العامة.</p></div></div>
    </div>
    {mediaError && <p className="text-xs leading-5 font-bold p-3 rounded-xl" style={{ background: C.rust + "10", color: C.rust, border: `1px solid ${C.rust}33` }}>{mediaError}</p>}
    {loadingMedia ? <div className="py-8 text-center"><Loader2 size={22} color={accent} className="animate-spin" style={{ margin: "0 auto" }} /></div> : <>
      {isMerchant ? <section className="p-4 rounded-2xl space-y-3" style={{ background: C.paperDark, border: `1px solid ${C.line}` }}><div><h4 className="font-black text-sm" style={{ color: C.ink }}>صور المتجر</h4><p className="text-[11px] leading-5 mt-1" style={{ color: C.inkSoft }}>أضف من صورة واحدة إلى ثلاث صور للمحل، واجهته أو منتجاته. تظهر هذه الصور في ملفك الإداري فقط إلى أن توسع المنصة عرضها العام لاحقاً.</p></div><div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{storePhotos.map((item) => <article key={item.id} className="overflow-hidden rounded-xl bg-white" style={{ border: `1px solid ${C.line}` }}>{item.signedUrl ? <img src={item.signedUrl} alt="صورة المتجر المضافة" className="w-full h-28 object-cover" /> : <div className="h-28 flex items-center justify-center" style={{ background: C.paper }}><Images size={22} color={C.inkSoft} /></div>}<div className="p-2 flex items-center justify-between gap-2"><span className="text-[10px] truncate" style={{ color: C.inkSoft }}>{item.original_name}</span><button type="button" onClick={() => void removeMedia(item)} className="text-[10px] font-bold shrink-0" style={{ color: C.rust }}>إزالة</button></div></article>)}{storePhotos.length < MAX_STORE_PHOTOS && <label className="h-full min-h-36 p-3 rounded-xl cursor-pointer flex flex-col items-center justify-center text-center" style={{ background: "#fff", border: `1.5px dashed ${accent}88`, color: accent }}><Upload size={19} /><span className="text-xs font-bold mt-2">إدراج صورة {storePhotos.length + 1}</span><span className="text-[10px] mt-1" style={{ color: C.inkSoft }}>JPG أو PNG حتى 8 م.ب.</span><input type="file" accept="image/*" onChange={(event) => fileChange(event, "store_photo")} className="hidden" /></label>}</div></section> : <section className="p-4 rounded-2xl space-y-3" style={{ background: C.paperDark, border: `1px solid ${C.line}` }}><div><h4 className="font-black text-sm" style={{ color: C.ink }}>صور وسائل التوصيل</h4><p className="text-[11px] leading-5 mt-1" style={{ color: C.inkSoft }}>أضف صورة لكل وسيلة اخترتها؛ لا يظهر أي شيء منها للزبائن تلقائياً.</p></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{vehicleIds.map((vehicleType) => { const option = VEHICLE_OPTIONS.find((item) => item.id === vehicleType); const existing = slotItem("vehicle_photo", vehicleType); return <div key={vehicleType} className="p-3 rounded-xl bg-white" style={{ border: `1px solid ${C.line}` }}>{existing?.signedUrl ? <img src={existing.signedUrl} alt={`صورة ${option?.label || "وسيلة التوصيل"}`} className="w-full h-28 rounded-lg object-cover mb-2" /> : <div className="h-24 rounded-lg flex items-center justify-center mb-2" style={{ background: C.paper }}><Bike size={24} color={C.inkSoft} /></div>}<div className="flex items-center justify-between gap-2"><span className="text-xs font-bold" style={{ color: C.ink }}>{option?.label}</span>{existing ? <button type="button" onClick={() => void removeMedia(existing)} className="text-[11px] font-bold" style={{ color: C.rust }}>إزالة</button> : <label className="text-[11px] font-bold cursor-pointer" style={{ color: accent }}>إضافة صورة<input type="file" accept="image/*" onChange={(event) => fileChange(event, "vehicle_photo", vehicleType)} className="hidden" /></label>}</div></div>; })}</div></section>}
      <section className="p-4 rounded-2xl space-y-3" style={{ background: C.ochre + "10", border: `1px solid ${C.ochre}44` }}>
        <div className="flex items-start gap-2"><ShieldAlert size={18} color={C.ochre} className="shrink-0 mt-0.5" /><div><h4 className="font-black text-sm" style={{ color: C.ink }}>إكمال الوثائق — اختياري الآن</h4><p className="text-[11px] leading-5 mt-1" style={{ color: C.inkSoft }}>هذه المساحة لا تعني مراجعة أو تصديقاً أو تأكيداً بأن المنصة استلمت وثائق رسمية. يمكن فتحها اختيارياً في هذه المرحلة، ثم نوضح أي التزام مسبقاً إذا أصبحت سياسة التحقق مطلوبة لاحقاً.</p></div></div>
        {isMerchant ? <div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><UploadSlot label="وثيقة هوية صاحب النشاط" note="صورة أو PDF اختياري لإثبات الهوية عند الحاجة مستقبلاً." kind="merchant_identity" existing={slotItem("merchant_identity")} /><UploadSlot label="وثيقة النشاط أو السجل التجاري" note="صورة أو PDF اختياري يصف نشاط المتجر." kind="merchant_business" existing={slotItem("merchant_business")} /></div> : <div className="space-y-2">{ownershipVehicleIds.length === 0 ? <p className="text-xs leading-5 p-3 rounded-xl" style={{ background: "#fff", color: C.inkSoft }}>اخترت الدراجة الهوائية فقط؛ لا نطلب وثيقة ملكية لها في هذه المرحلة.</p> : ownershipVehicleIds.map((vehicleType) => { const option = VEHICLE_OPTIONS.find((item) => item.id === vehicleType); return <UploadSlot key={vehicleType} label={`وثيقة ملكية ${option?.label || "الوسيلة"}`} note="صورة أو PDF اختياري لإثبات ملكية هذه الوسيلة عند الحاجة مستقبلاً." kind="vehicle_ownership" vehicleType={vehicleType} existing={slotItem("vehicle_ownership", vehicleType)} />; })}</div>}
        <p className="text-[10px] leading-5" style={{ color: C.inkSoft }}>{PROVIDER_DOCUMENT_POLICY.futureRule}</p>
      </section>
    </>}
  </section>;
}

/* ---------------------------------------------------------
   استعادة الحساب / تغيير رقم الهاتف
--------------------------------------------------------- */
function PhoneChangeModal({ currentPhone, onConfirm, onClose }) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const normalizedPhone = normalizeAlgerianMobile(phone);

  async function confirmChange() {
    if (!normalizedPhone) { setError("أدخل رقم هاتف محمول جزائرياً يبدأ بـ 05 أو 06 أو 07."); return; }
    setError(""); setIsSubmitting(true);
    try {
      const result = await onConfirm({ phone: normalizedPhone });
      if (result?.error) { setError(result.error); return; }
      onClose();
    } catch (changeError) {
      setError(changeError?.message || "تعذر حفظ رقم التواصل. حاول مجدداً.");
    } finally { setIsSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(35,32,27,0.55)" }} onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-2xl p-5 space-y-3" style={{ background: C.paper }}>
        <div className="flex items-center justify-between gap-3"><div><h3 className="font-black flex items-center gap-1.5" style={{ color: C.ink }}><Phone size={18} color={C.teal} /> تغيير رقم الهاتف</h3><p className="text-[11px] mt-1" style={{ color: C.inkSoft }}>رقمك الحالي: <span dir="ltr">{currentPhone || "غير مضاف"}</span></p></div><button onClick={onClose} aria-label="إغلاق"><X size={18} color={C.inkSoft} /></button></div>
        <p className="text-xs leading-5 p-3 rounded-xl" style={{ background: C.ochre + "12", color: C.ink, border: `1px solid ${C.ochre}42` }}>جلسة حسابك موثّقة بالبريد الإلكتروني. احفظ رقم التواصل الجديد، ولا يُستخدم إرسال SMS أو Firebase في هذا المسار.</p>
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white" style={{ border: `1px solid ${C.line}` }}><Phone size={15} color={C.inkSoft} /><input aria-label="رقم الهاتف الجديد" placeholder="0551234567 أو +213551234567" value={phone} onChange={(event) => setPhone(event.target.value)} className="flex-1 outline-none text-sm bg-transparent" dir="ltr" inputMode="tel" /></div>
        <button disabled={isSubmitting} onClick={confirmChange} className="w-full py-3 rounded-xl font-black text-sm disabled:opacity-50" style={{ background: C.rust, color: "#fff" }}>{isSubmitting ? "جارٍ حفظ الرقم..." : "حفظ رقم التواصل"}</button>
        {error && <p className="text-xs font-bold" style={{ color: "#8B3A2A" }}>{error}</p>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   تأكيد بريد الانضمام للتاجر أو الموصل قبل إنشاء الملفات
--------------------------------------------------------- */
function ProviderEmailOtpModal({ registration, onVerified, onClose }) {
  const [otpCode, setOtpCode] = useState("");
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isMerchant = registration.type === "merchant";
  const email = registration.form.email.trim().toLowerCase();

  async function requestOtp() {
    setError(""); setNotice(""); setIsSubmitting(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true, data: { role: registration.type, name: registration.form.name, phone: normalizeAlgerianMobile(registration.form.phone), contact_email: email } },
      });
      if (otpError) throw otpError;
      setRequested(true); setOtpCode("");
      setNotice(`أُرسل رمز تحقق من ${EMAIL_OTP_LENGTH} أرقام إلى بريدك. لن يُحفظ طلب الانضمام قبل إدخال الرمز الصحيح.`);
    } catch (otpError) { setError(otpError?.message || "تعذر إرسال الرمز. تحقق من إعداد SMTP في Supabase ثم حاول مجدداً."); }
    finally { setIsSubmitting(false); }
  }

  async function verify() {
    if (!requested) { await requestOtp(); return; }
    if (otpCode.length !== EMAIL_OTP_LENGTH) { setError(`أدخل رمز البريد المكوّن من ${EMAIL_OTP_LENGTH} أرقام.`); return; }
    setError(""); setNotice(""); setIsSubmitting(true);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({ email, token: otpCode, type: "email" });
      if (verifyError || !data.session) throw verifyError || new Error("تعذر فتح جلسة آمنة بعد التحقق من الرمز.");
      const result = await onVerified({ ...registration, verifiedSession: data.session });
      if (result?.error) { setError(result.error); return; }
      onClose();
    } catch (verifyError) { setError(verifyError?.message || "تعذر إكمال التحقق. حاول مجدداً."); }
    finally { setIsSubmitting(false); }
  }

  return <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(35,32,27,.55)" }} onClick={onClose}>
    <div onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-2xl p-5 space-y-3" style={{ background: C.paper }}>
      <div className="flex items-center justify-between gap-3"><div><h3 className="font-black flex items-center gap-1.5" style={{ color: C.ink }}><Mail size={18} color={isMerchant ? C.rust : C.teal} /> تحقق من بريد {isMerchant ? "التاجر" : "الموصل"}</h3><p className="text-[11px] mt-1" style={{ color: C.inkSoft }}>سيُنشأ طلب الانضمام بعد توثيق البريد فقط.</p></div><button onClick={onClose} aria-label="إغلاق"><X size={18} color={C.inkSoft} /></button></div>
      <div className="p-3 rounded-xl text-xs" style={{ background: C.ochre + "12", border: `1px solid ${C.ochre}35`, color: C.ink }}><b dir="ltr">{email}</b><br />رقم الهاتف يبقى مخصصاً للتواصل فقط، ولا يُستخدم Firebase أو SMS في هذا المسار.</div>
      {requested && <input aria-label="رمز تحقق بريد الانضمام" value={otpCode} onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, EMAIL_OTP_LENGTH))} placeholder={`رمز من ${EMAIL_OTP_LENGTH} أرقام`} inputMode="numeric" autoComplete="one-time-code" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none bg-white" style={{ border: `1px solid ${C.line}` }} />}
      {error && <p className="text-xs font-bold" style={{ color: "#8B3A2A" }}>{error}</p>}
      {notice && <p className="text-xs font-bold" style={{ color: C.sage }}>{notice}</p>}
      <button disabled={isSubmitting} onClick={verify} className="w-full py-3 rounded-xl font-black disabled:opacity-50" style={{ background: isMerchant ? C.rust : C.teal, color: "#fff" }}>{isSubmitting ? "جارٍ المعالجة..." : requested ? "تأكيد البريد وإرسال الطلب" : "إرسال رمز البريد"}</button>
      {requested && <button type="button" disabled={isSubmitting} onClick={requestOtp} className="w-full py-1 text-xs font-bold" style={{ color: isMerchant ? C.rust : C.teal }}>إعادة إرسال رمز البريد بعد الانتظار دقيقة واحدة</button>}
    </div>
  </div>;
}

/* ---------------------------------------------------------
   شاشة تسجيل الدخول / إنشاء حساب / استعادة حساب
--------------------------------------------------------- */
function AuthModal({ authenticate, requestAccountRecovery, onClose, adminOnly = false, initialType = "merchant", initialMode = "login", lockRole = true, allowRegistration = initialType === "customer" }) {
  const [mode, setMode] = useState(adminOnly ? "login" : initialMode);
  const [type, setType] = useState(adminOnly ? "admin" : initialType);
  const [identifier, setIdentifier] = useState("");
  const [fullName, setFullName] = useState("");
  const [registrationEmail, setRegistrationEmail] = useState("");
  const [registrationPhone, setRegistrationPhone] = useState("");
  const [registrationWilaya, setRegistrationWilaya] = useState("");
  const [registrationCommune, setRegistrationCommune] = useState("");
  const [registrationAddress, setRegistrationAddress] = useState("");
  const [registrationLatitude, setRegistrationLatitude] = useState(null);
  const [registrationLongitude, setRegistrationLongitude] = useState(null);
  const [showRegistrationMap, setShowRegistrationMap] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [emailOtpRequested, setEmailOtpRequested] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const parsedIdentifier = parseLoginIdentifier(identifier);

  function resetEmailOtp() {
    setOtpCode("");
    setEmailOtpRequested(false);
  }

  function closeAuthModal() {
    resetEmailOtp();
    onClose();
  }

  async function requestEmailOtp() {
    const email = mode === "register" ? parseLoginIdentifier(registrationEmail)?.email : parsedIdentifier?.email;
    if (!email) {
      setError("أدخل بريداً إلكترونياً صالحاً. التحقق عبر البريد فقط.");
      return;
    }
    if (mode === "register" && (!fullName.trim() || !normalizeAlgerianMobile(registrationPhone))) {
      setError("أدخل الاسم ورقم الهاتف قبل طلب رمز البريد.");
      return;
    }
    setError("");
    setNotice("");
    setIsSubmitting(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: mode === "register",
          data: mode === "register" ? {
            role: type,
            name: fullName.trim(),
            phone: normalizeAlgerianMobile(registrationPhone),
            contact_email: email,
            wilaya: registrationWilaya,
            commune: registrationCommune,
            address_label: registrationAddress.trim(),
            latitude: registrationLatitude,
            longitude: registrationLongitude,
          } : undefined,
        },
      });
      if (otpError) throw otpError;
      setEmailOtpRequested(true);
      setOtpCode("");
      setNotice(`أُرسل رمز تحقق من ${EMAIL_OTP_LENGTH} أرقام إلى بريدك الإلكتروني. أدخله لإكمال العملية.`);
    } catch (requestError) {
      setError(requestError?.message || "تعذر إرسال رمز البريد. تحقق من إعداد SMTP في Supabase ثم حاول مجدداً.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function fillFromGoogle() {
    setError("");
    setNotice("");
    setIsSubmitting(true);
    try {
      const profile = await (await loadFirebaseHelpers()).requestGoogleProfilePrefill();
      if (!profile?.email) {
        setError("تعذر جلب البريد من Google. أدخل بياناتك يدوياً أو أكمل إعداد Google Sign-In في Firebase.");
        return;
      }
      setRegistrationEmail(profile.email);
      setFullName(profile.name || fullName);
      setNotice("تمت تعبئة الاسم والبريد. أكمل رقم الهاتف ثم اطلب رمز البريد للمتابعة.");
    } catch (googleError) {
      setError(googleError?.message || "تعذر الاتصال بـ Google حالياً. يمكنك متابعة التسجيل يدوياً.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submit() {
    const emailCredential = mode === "register" ? parseLoginIdentifier(registrationEmail) : parsedIdentifier;
    const normalizedPhone = normalizeAlgerianMobile(registrationPhone);
    if (!emailCredential?.email) { setError("أدخل بريداً إلكترونياً صالحاً. أرقام الهاتف للتواصل فقط ولا تُستخدم للدخول."); return; }
    if (mode === "register" && (!fullName.trim() || !normalizedPhone)) { setError("أدخل الاسم ورقم الهاتف في الحقول المخصصة."); return; }
    if (!emailOtpRequested) { await requestEmailOtp(); return; }
    if (otpCode.length !== EMAIL_OTP_LENGTH) { setError(`أدخل رمز البريد المكوّن من ${EMAIL_OTP_LENGTH} أرقام.`); return; }
    setError(""); setNotice("");
    setIsSubmitting(true);
    let result;
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({ email: emailCredential.email, token: otpCode, type: "email" });
      if (verifyError || !data.session) throw verifyError || new Error("تعذر فتح جلسة آمنة بعد التحقق من الرمز.");
      result = await authenticate({ mode, type, identifier: emailCredential.email, name: fullName.trim(), phone: normalizedPhone, wilaya: registrationWilaya, commune: registrationCommune, addressLabel: registrationAddress.trim(), latitude: registrationLatitude, longitude: registrationLongitude, verifiedSession: data.session });
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
          <button onClick={() => { resetEmailOtp(); setMode("login"); setError(""); setNotice(""); }} className="flex-1 px-3 py-2 rounded-xl text-xs font-bold" style={{ background: mode === "login" ? C.ink : "transparent", color: mode === "login" ? "#fff" : C.inkSoft }}>دخول بالبريد</button>
          {allowRegistration && <button onClick={() => { resetEmailOtp(); setMode("register"); setError(""); setNotice(""); }} className="flex-1 px-3 py-2 rounded-xl text-xs font-bold" style={{ background: mode === "register" ? C.ink : "transparent", color: mode === "register" ? "#fff" : C.inkSoft }}>حساب جديد</button>}
        </div></>}
        {mode === "register" ? <div className="space-y-2"><div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ border: `1px solid ${C.line}` }}><User size={15} color={C.inkSoft} /><input aria-label="الاسم الكامل" type="text" lang="ar" dir="auto" inputMode="text" enterKeyHint="next" autoCapitalize="words" spellCheck={false} placeholder="الاسم الكامل" value={fullName} onChange={(event) => { resetEmailOtp(); setFullName(event.target.value); }} className="flex-1 outline-none text-sm bg-transparent" autoComplete="name" /></div><div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ border: `1px solid ${C.line}` }}><Mail size={15} color={C.inkSoft} /><input aria-label="البريد الإلكتروني" type="email" autoComplete="email" placeholder="name@example.com" value={registrationEmail} onChange={(event) => { resetEmailOtp(); setRegistrationEmail(event.target.value); }} className="flex-1 outline-none text-sm bg-transparent" dir="ltr" inputMode="email" /></div><div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ border: `1px solid ${C.line}` }}><Phone size={15} color={C.inkSoft} /><input aria-label="رقم الهاتف للتواصل" type="tel" placeholder="0551234567" value={registrationPhone} onChange={(event) => { resetEmailOtp(); setRegistrationPhone(event.target.value); }} className="flex-1 outline-none text-sm bg-transparent" dir="ltr" inputMode="tel" enterKeyHint="next" autoComplete="tel" /></div><div className="space-y-2 pt-1"><p className="text-xs font-bold" style={{ color: C.ink }}>موقع الحساب (اختياري للعميل، مطلوب للتاجر والموصل عند الحاجة)</p><div className="flex gap-2"><select aria-label="ولاية التسجيل" value={registrationWilaya} onChange={(event) => { resetEmailOtp(); setRegistrationWilaya(event.target.value); setRegistrationCommune(""); }} className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none bg-white" style={{ border: `1px solid ${C.line}` }}><option value="">اختر الولاية</option>{WILAYAS.map((wilaya) => <option key={wilaya} value={wilaya}>{wilaya}</option>)}</select><select aria-label="بلدية التسجيل" value={registrationCommune} onChange={(event) => { resetEmailOtp(); setRegistrationCommune(event.target.value); }} disabled={!registrationWilaya} className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none bg-white disabled:opacity-50" style={{ border: `1px solid ${C.line}` }}><option value="">اختر البلدية</option>{getCommunes(registrationWilaya).map((commune) => <option key={commune} value={commune}>{commune}</option>)}</select></div><input aria-label="العنوان التفصيلي للتسجيل" placeholder="العنوان التفصيلي (اختياري)" value={registrationAddress} onChange={(event) => { resetEmailOtp(); setRegistrationAddress(event.target.value); }} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none bg-white" style={{ border: `1px solid ${C.line}` }} /><button type="button" onClick={() => setShowRegistrationMap(true)} className="w-full py-2 rounded-xl text-xs font-bold" style={{ color: C.teal, border: `1px solid ${C.teal}55` }}><Navigation size={14} className="inline ml-1" /> {Number.isFinite(registrationLatitude) && Number.isFinite(registrationLongitude) ? "تم حفظ موقع GPS" : "تحديد الموقع عبر GPS"}</button></div><button type="button" disabled={isSubmitting} onClick={fillFromGoogle} className="w-full py-2.5 rounded-xl text-xs font-bold disabled:opacity-50" style={{ color: C.teal, border: `1px solid ${C.teal}55` }}>تعبئة الاسم والبريد من Google</button></div> : <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ border: `1px solid ${C.line}` }}><Mail size={15} color={C.inkSoft} /><input data-testid="auth-identifier-input" type="email" autoComplete="email" placeholder="البريد الإلكتروني" value={identifier} onChange={(e) => { resetEmailOtp(); setIdentifier(e.target.value); }} onKeyDown={(e) => e.key === "Enter" && submit()} className="flex-1 outline-none text-sm bg-transparent" dir="ltr" inputMode="email" /></div>}
        {emailOtpRequested && <div data-testid="email-otp" className="p-3 rounded-xl space-y-2" style={{ background: C.ochre + "12", border: `1px solid ${C.ochre}44` }}><p className="text-xs leading-5 font-bold" style={{ color: C.ink }}>أدخل رمز التحقق الذي وصلك إلى بريدك الإلكتروني.</p><input aria-label="رمز التحقق البريدي" value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, EMAIL_OTP_LENGTH))} placeholder={`رمز من ${EMAIL_OTP_LENGTH} أرقام`} inputMode="numeric" autoComplete="one-time-code" className="w-full px-3 py-2 rounded-lg text-sm outline-none bg-white" style={{ border: `1px solid ${C.line}` }} /><button type="button" disabled={isSubmitting} onClick={requestEmailOtp} className="text-xs font-bold" style={{ color: C.teal }}>إعادة إرسال رمز البريد</button></div>}
        {error && <p className="text-xs font-bold" style={{ color: "#8B3A2A" }}>{error}</p>}
        {notice && <p className="text-xs font-bold" style={{ color: C.sage }}>{notice}</p>}
        <button disabled={isSubmitting} onClick={submit} className="w-full py-3 rounded-xl font-black flex items-center justify-center gap-1.5 disabled:opacity-50" style={{ background: C.rust, color: "#fff" }}>{isSubmitting ? "جارٍ المعالجة..." : !emailOtpRequested ? <><Mail size={16} /> إرسال رمز البريد</> : mode === "register" ? <><UserPlus size={16} /> تأكيد الحساب</> : <><LogIn size={16} /> تأكيد الدخول</>}</button>
        {!adminOnly && <button onClick={() => { resetEmailOtp(); setMode("recover"); setError(""); setNotice(""); }} className="w-full text-xs font-bold py-1" style={{ color: C.teal }}>الدخول برمز البريد</button>}
        {adminOnly && <p className="text-[10px] text-center" style={{ color: C.inkSoft }}>لا تتاح لوحة الإدارة إلا للحسابات المصرح لها في قاعدة البيانات.</p>}
        {!adminOnly && mode === "register" && <p className="text-[10px] text-center" style={{ color: C.inkSoft }}>البريد ورقم الهاتف مطلوبان. رقم الهاتف للتواصل فقط؛ التحقق والدخول يتمان برمز يُرسل إلى البريد.</p>}
        {!adminOnly && mode === "recover" && <p className="text-[10px] text-center" style={{ color: C.inkSoft }}>أدخل بريد الحساب؛ يرسل التطبيق رمز دخول آمن بدلاً من كلمة مرور أو رسالة SMS.</p>}
      </div>
      {showRegistrationMap && <MapPicker initial={Number.isFinite(registrationLatitude) ? { latitude: registrationLatitude, longitude: registrationLongitude, x: 50, y: 50 } : undefined} title="حدد موقعك بدقة" onConfirm={(position) => { setRegistrationLatitude(Number(position.latitude) || null); setRegistrationLongitude(Number(position.longitude) || null); setShowRegistrationMap(false); }} onClose={() => setShowRegistrationMap(false)} />}

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
  const inviteLink = referralCode ? buildPublicAppLink({ ref: referralCode }) : "";
  useEffect(() => {
    let active = true;
    if (!inviteLink) { setQrDataUrl(""); return undefined; }
    void loadQrCode().then((QRCode) => QRCode.toDataURL(inviteLink, { errorCorrectionLevel: "H", width: 600, margin: 2, color: { dark: C.ink, light: "#FFFFFF" } })).then((value) => { if (active) setQrDataUrl(value); }).catch(() => notify("تعذر إنشاء رمز الدعوة."));
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
    <div className="p-4 rounded-2xl" style={{ background: C.paperDark, border: `1px solid ${C.line}` }}><button type="button" onClick={() => setShowTerms((value) => !value)} className="w-full flex items-center justify-between text-right"><span className="font-black text-sm" style={{ color: C.ink }}>شروط برنامج الإحالة وحدود القسائم</span><span className="text-xs font-bold" style={{ color: C.teal }}>{showTerms ? "إخفاء" : "عرض"}</span></button>{showTerms && <div className="mt-3 text-xs leading-6 space-y-2" style={{ color: C.inkSoft }}><p>يُستخدم كود الدعوة مرة واحدة قبل أول طلب غير ملغى، ولا يرتبط بالحساب إلا بعد تأكيد البريد عبر Email OTP.</p><p>تُمنح القسائم للطرفين بعد تسوية أول طلب ناجح للصديق المدعو، ولا تُستبدل نقداً أو تُنقل بين الحسابات.</p><p>يظهر مبلغ الخصم والحد الأدنى وتاريخ الصلاحية على كل قسيمة. لا يمكن جمع قسيمتين في الطلب نفسه، وقد تُلغى القسيمة عند إساءة الاستخدام.</p></div>}</div>
  </section>;
}

/* ===========================================================
   CUSTOMER VIEW
=========================================================== */
function CustomerView({ stores, setStores, cart, setCart, orders, setOrders, couriers, merchantOffers = [], placeOrder, notify, customerId, customerConfirmDelivery, quoteDelivery, referralCode = "", rewardCoupons = [], claimReferralCode, publicStoreId = "", publicCourierId = "", language = "ar" }) {
  const [tab, setTab] = useState("browse");
  const [browseMode, setBrowseMode] = useState("list");
  const [query, setQuery] = useState("");
  const [filterWilaya, setFilterWilaya] = useState("");
  const [filterCommune, setFilterCommune] = useState("");
  const [openStoreId, setOpenStoreId] = useState(null);
  const [activeDept, setActiveDept] = useState("all");
  const [showCart, setShowCart] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [reviewingOrder, setReviewingOrder] = useState(null);
  const [invoiceOrder, setInvoiceOrder] = useState(null);
  const [activeDraftId, setActiveDraftId] = useState(null);
  const [quoteError, setQuoteError] = useState("");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [rewardCouponInput, setRewardCouponInput] = useState("");

  const approvedStores = stores.filter((s) => ["approved", "active", "open"].includes(String(s.status || "approved").toLowerCase()));
  const qrStore = publicStoreId ? approvedStores.find((store) => store.id === publicStoreId) : null;
  const qrCourier = publicCourierId ? couriers.find((courier) => courier.id === publicCourierId && ["approved", "active", "available"].includes(String(courier.status || "").toLowerCase())) : null;
  useEffect(() => {
    if (qrStore) { setTab("browse"); setOpenStoreId(qrStore.id); }
  }, [qrStore?.id]);
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
  const drafts = Array.isArray(cart?.drafts) ? cart.drafts : [];
  const activeDraft = drafts.find((draft) => draft.id === activeDraftId) || drafts[0] || null;
  const activeItems = activeDraft?.items || [];
  const cartStore = stores.find((s) => s.id === activeDraft?.storeId);
  const cartCount = drafts.reduce((sum, draft) => sum + (draft.items || []).reduce((itemSum, item) => itemSum + item.qty, 0), 0);
  const cartSubtotal = activeItems.reduce((a, i) => a + i.qty * i.price, 0);
  const deliveryChoice = activeDraft?.deliveryChoice || "pickup";
  const deliveryQuote = activeDraft?.deliveryQuote || null;
  const appliedReward = activeDraft?.rewardCoupon || null;
  const rewardDiscountAmount = appliedReward ? Math.min(Number(appliedReward.amount || 0), cartSubtotal) : 0;
  const discountAmount = rewardDiscountAmount;
  // The administration-owned quote is the source of truth for both delivery
  // services. A merchant only publishes whether their own service is available;
  // they do not override the platform distance price in the checkout.
  const deliveryFee = deliveryChoice === "pickup" ? 0 : Number(deliveryQuote?.fee || 0);
  const finalTotal = Math.max(0, cartSubtotal - discountAmount + deliveryFee);
  const belowMinOrder = cartStore && cartStore.minOrder && cartSubtotal < cartStore.minOrder;
  const isInterwilaya = Boolean(deliveryQuote?.isInterwilaya || (activeDraft?.address?.wilaya && cartStore?.wilaya && activeDraft.address.wilaya !== cartStore.wilaya));
  const requiresVerifiedEmail = deliveryChoice === "courier" && (finalTotal >= 10000 || isInterwilaya);
  const emailVerified = Boolean(customerId);
  const addressReady = Boolean(activeDraft?.address?.wilaya && activeDraft?.address?.commune && activeDraft?.address?.label?.trim());
  const needsDeliveryAddress = deliveryChoice !== "pickup";
  const needsDeliveryQuote = deliveryChoice !== "pickup";
  // Every order is immediate. GPS refines the address and quote, but must not
  // hard-block checkout once the required written delivery address is present.
  const checkoutDisabled = activeItems.length === 0 || Boolean(belowMinOrder) || quoteLoading || (needsDeliveryAddress && !addressReady) || (needsDeliveryQuote && !deliveryQuote) || (requiresVerifiedEmail && !emailVerified);
  const checkoutHint = activeItems.length === 0
    ? uiText(language, "cartEmpty")
    : belowMinOrder
      ? uiText(language, "orderMinimumNotice", { amount: money(cartStore?.minOrder) })
      : needsDeliveryAddress && !addressReady
        ? uiText(language, "checkoutNeedsAddress")
        : needsDeliveryQuote && !deliveryQuote
          ? uiText(language, "checkoutNeedsQuote")
          : requiresVerifiedEmail && !emailVerified
            ? uiText(language, "checkoutNeedsEmail")
            : uiText(language, "checkoutReady");

  // The customer chooses the platform delivery service, not a named courier.
  // Assignment occurs after the merchant marks the order ready, preserving courier privacy.
  // Existing stores pre-date this field; only an explicit false disables platform delivery.
  const platformCourierEnabled = Boolean(cartStore && cartStore.platformDeliveryEnabled !== false);
  const storeDeliveryEnabled = Boolean(cartStore?.hasOwnDelivery || cartStore?.storeDeliveryEnabled);

  useEffect(() => {
    if (drafts.length === 0 && activeDraftId !== null) setActiveDraftId(null);
    else if (drafts.length > 0 && !drafts.some((draft) => draft.id === activeDraftId)) setActiveDraftId(drafts[0].id);
  }, [activeDraftId, drafts]);

  function updateActiveDraft(values) {
    if (!activeDraft?.id) return;
    setCart((prev) => ({ ...prev, drafts: (prev.drafts || []).map((draft) => draft.id === activeDraft.id ? { ...draft, ...values } : draft) }), customerId);
  }

  useEffect(() => {
    let cancelled = false;
    if (deliveryChoice === "pickup" || !cartStore?.id || !activeDraft?.address?.wilaya || !activeDraft?.address?.commune) {
      if (activeDraft?.deliveryQuote) updateActiveDraft({ deliveryQuote: null });
      setQuoteError(""); setQuoteLoading(false); return undefined;
    }
    setQuoteLoading(true); setQuoteError("");
    quoteDelivery(cartStore.id, activeDraft.address, activeItems.reduce((sum, item) => sum + item.qty, 0)).then((result) => {
      if (cancelled) return;
      if (!result?.ok) { updateActiveDraft({ deliveryQuote: null }); setQuoteError(result?.message || "تعذر احتساب رسوم التوصيل."); }
      else updateActiveDraft({ deliveryQuote: result.quote });
      setQuoteLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeDraft?.id, activeDraft?.address?.wilaya, activeDraft?.address?.commune, activeDraft?.address?.label, activeDraft?.address?.latitude, activeDraft?.address?.longitude, activeDraft?.address?.x, activeDraft?.address?.y, activeItems, cartStore?.id, deliveryChoice, quoteDelivery]);

  // Android back events are dispatched by the app shell. The customer view owns
  // its local navigation state, so it consumes the event before the shell can
  // fall back to browser history or app exit.
  useEffect(() => {
    const handleBack = (event) => {
      if (showMapPicker) { setShowMapPicker(false); event.preventDefault(); return; }
      if (reviewingOrder) { setReviewingOrder(null); event.preventDefault(); return; }
      if (invoiceOrder) { setInvoiceOrder(null); event.preventDefault(); return; }
      if (showCart) { setShowCart(false); event.preventDefault(); return; }
      if (openStoreId) { setOpenStoreId(null); setActiveDept("all"); event.preventDefault(); return; }
      if (tab !== "browse") { setTab("browse"); event.preventDefault(); }
    };
    window.addEventListener("souq-jiran:back", handleBack);
    return () => window.removeEventListener("souq-jiran:back", handleBack);
  }, [invoiceOrder, openStoreId, reviewingOrder, showCart, showMapPicker, tab]);

  function addToCart(store, product) {
    const targetDraft = activeDraft?.storeId === store.id ? activeDraft : drafts.find((draft) => draft.storeId === store.id && (draft.items || []).length > 0);
    const targetDraftId = targetDraft?.id || createOrderDraft(store.id).id;
    if (targetDraft?.id !== activeDraft?.id) setActiveDraftId(targetDraftId);
    setCart((prev) => {
      const existingDraft = (prev.drafts || []).find((draft) => draft.id === targetDraftId);
      const nextDraft = existingDraft || createOrderDraft(store.id, targetDraftId);
      const existingItem = (nextDraft.items || []).find((item) => item.id === product.id);
      const items = existingItem ? nextDraft.items.map((item) => item.id === product.id ? { ...item, qty: item.qty + 1 } : item) : [...(nextDraft.items || []), { id: product.id, name: product.name, price: product.price, qty: 1 }];
      const updatedDraft = { ...nextDraft, items };
      return { ...prev, drafts: existingDraft ? prev.drafts.map((draft) => draft.id === targetDraftId ? updatedDraft : draft) : [...(prev.drafts || []), updatedDraft] };
    }, customerId);
    notify(targetDraft ? `تمت إضافة «${product.name}» إلى الطلب المفتوح` : `تم إنشاء طلب مستقل وإضافة «${product.name}» إليه`);
  }
  function changeQty(id, delta) { if (!activeDraft?.id) return; setCart((prev) => ({ ...prev, drafts: (prev.drafts || []).map((draft) => draft.id === activeDraft.id ? { ...draft, items: (draft.items || []).map((item) => item.id === id ? { ...item, qty: item.qty + delta } : item).filter((item) => item.qty > 0) } : draft) }), customerId); }
  function removeActiveDraft() { if (!activeDraft?.id) return; setCart((prev) => ({ ...prev, drafts: (prev.drafts || []).filter((draft) => draft.id !== activeDraft.id) }), customerId); setActiveDraftId(null); setRewardCouponInput(""); notify("تم حذف مسودة الطلب هذه فقط."); }
  function startIndependentDraft() { if (!cartStore?.id) return; const draft = createOrderDraft(cartStore.id); setCart((prev) => ({ ...prev, drafts: [...(prev.drafts || []), draft] }), customerId); setActiveDraftId(draft.id); setShowCart(false); setTab("browse"); setOpenStoreId(cartStore.id); notify("أُنشئت مسودة مستقلة. أضف منتجاتها ثم حدّد عنوانها وطريقة التوصيل."); }
  function applyRewardCoupon() { const coupon = rewardCoupons.find((item) => item.status === "available" && item.code.toUpperCase() === rewardCouponInput.trim().toUpperCase()); if (!coupon) { notify("قسيمة المكافأة غير متاحة أو غير صالحة."); return; } if (cartSubtotal < Number(coupon.minimumOrderTotal || 0)) { notify(`هذه القسيمة تتطلب طلباً بقيمة ${money(coupon.minimumOrderTotal)} على الأقل.`); return; } updateActiveDraft({ rewardCoupon: coupon }); notify(`تم حجز خصم المكافأة بقيمة ${money(coupon.amount)} لهذا الطلب المستقل.`); }
  function updateAddress(values) { updateActiveDraft({ address: { ...(activeDraft?.address || {}), ...values }, deliveryQuote: null }); }
  function requestCurrentLocation() {
    if (!navigator.geolocation) { notify("لا يدعم متصفحك تحديد الموقع الجغرافي."); return; }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { updateAddress({ latitude: coords.latitude, longitude: coords.longitude }); notify("تم حفظ موقع GPS الدقيق. أكمل الولاية والبلدية ووصف العنوان."); },
      () => notify("تعذر الوصول إلى GPS. راجع أذونات الموقع أو حدد الموقع على الخريطة."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
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
    storeDeliveryEnabled && { id: "store", label: "توصيل المحل", desc: "يُسلّم المحل الطلب — تُحسب الرسوم بالمسافة بعد إدخال العنوان", icon: Truck2 },
    { id: "courier", label: "موصل معتمد من المنصة", desc: platformCourierEnabled ? "يُسند تلقائياً عند الجاهزية — تُحسب الرسوم بعد إدخال العنوان" : "التوصيل عبر المنصة غير مفعّل لهذا المحل", icon: Bike, disabled: !platformCourierEnabled },
    { id: "pickup", label: "استلام ذاتي من المحل", desc: "بدون رسوم توصيل", icon: Home },
  ].filter(Boolean);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          <button onClick={() => setTab("browse")} className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: tab === "browse" ? C.teal : "transparent", color: tab === "browse" ? C.paper : C.inkSoft, border: `1px solid ${tab === "browse" ? C.teal : C.line}` }}>{uiText(language, "nearbyStores")}</button>
          <button onClick={() => setTab("orders")} className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: tab === "orders" ? C.teal : "transparent", color: tab === "orders" ? C.paper : C.inkSoft, border: `1px solid ${tab === "orders" ? C.teal : C.line}` }}>{uiText(language, "myOrders")} {myOrders.length > 0 && `(${myOrders.length})`}</button>
          <button data-testid="customer-rewards-tab" onClick={() => setTab("rewards")} className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: tab === "rewards" ? C.teal : "transparent", color: tab === "rewards" ? C.paper : C.inkSoft, border: `1px solid ${tab === "rewards" ? C.teal : C.line}` }}>{uiText(language, "invitationsRewards")}</button>
        </div>
        <button onClick={() => setShowCart(true)} className="relative flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-sm" style={{ background: C.rust, color: C.paper }}><ShoppingCart size={17} /> {uiText(language, "cart")}{cartCount > 0 && <span className="absolute -top-2 -right-2 flex items-center justify-center text-xs font-black rounded-full" style={{ width: 20, height: 20, background: C.ink, color: C.paper }}>{cartCount}</span>}</button>
      </div>

      {tab === "rewards" && <ReferralRewardsPanel referralCode={referralCode} rewardCoupons={rewardCoupons} notify={notify} claimReferralCode={claimReferralCode} />}

      {tab === "browse" && !openStore && (
        <>
          {publicStoreId && !qrStore && <div data-testid="qr-store-route-unavailable" className="p-4 rounded-2xl text-sm font-bold" style={{ background: "#FFF7E7", color: C.ink, border: `1px solid ${C.ochre}55` }}>{uiText(language, "storeUnavailable")}</div>}
          {publicCourierId && <div data-testid="qr-courier-route" className="p-4 rounded-2xl" style={{ background: C.teal + "10", border: `1px solid ${C.teal}33` }}><div className="font-black text-sm" style={{ color: C.ink }}>{qrCourier ? `${uiText(language, "courierService")} ${qrCourier.name || uiText(language, "approvedCourier")}` : uiText(language, "courierService")}</div><p className="text-xs leading-5 mt-1" style={{ color: C.inkSoft }}>{qrCourier ? uiText(language, "coverage", { area: qrCourier.wilaya || "—" }) : uiText(language, "profileUnavailable")}</p></div>}
          <OfferMarquee offers={merchantOffers} language={language} onOpenStore={(storeId) => { setOpenStoreId(storeId); setActiveDept("all"); }} />
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
            <Search size={17} color={C.inkSoft} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} type="search" lang={language} dir="auto" inputMode="search" enterKeyHint="search" placeholder={uiText(language, "searchStores")} className="flex-1 outline-none text-sm bg-transparent" style={{ color: C.ink, fontFamily: "inherit" }} />
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
              <div className="flex items-end justify-between gap-3 flex-wrap"><div><h2 className="font-black" style={{ color: C.ink, fontFamily: "inherit" }}>{uiText(language, "suggestedStores", { area: discoveryAreaLabel })}</h2><p className="text-xs mt-1" style={{ color: C.inkSoft }}>{uiText(language, "suggestedStoresDescription")}</p></div><span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: C.teal + "12", color: C.teal }}>{uiText(language, "storesCount", { count: curatedStores.length, max: MAX_DISCOVERY_STORES })}</span></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {curatedStores.map((s) => {
                  const isOpen = isStoreOpenAtHour(s);
                  const { openingHour, closingHour } = getStoreBusinessHours(s);
                  const verifiedReviewCount = (s.reviews || []).filter((review) => review?.verified === true).length;
                  const category = getDiscoveryCategory(s);
                  return (
                    <button key={s.id} onClick={() => setOpenStoreId(s.id)} className="text-right p-4 rounded-2xl transition hover:-translate-y-0.5" style={{ background: "#fff", border: `1px solid ${C.line}`, boxShadow: "0 1px 0 rgba(35,32,27,0.05)" }}>
                      <div className="flex items-start justify-between mb-3"><StoreAvatar logo={s.logo} size={38} /><div className="flex flex-col items-end gap-1"><span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: isOpen ? C.sage + "22" : "#8883", color: isOpen ? C.sage : C.inkSoft }}>{isOpen ? uiText(language, "openNow") : uiText(language, "closed")}</span><span className="text-[10px] font-bold" style={{ color: C.teal }}>{category.label}</span></div></div>
                      <div className="font-black text-base" style={{ color: C.ink, fontFamily: "inherit" }}>{s.name}</div>
                      <div className="flex items-center gap-1 text-xs mt-1" style={{ color: C.inkSoft }}><MapPin size={12} /> {s.wilaya} · {s.commune}</div>
                      <div className="flex items-center gap-1 text-[11px] mt-1" style={{ color: C.inkSoft }}><Clock size={11} /> {uiText(language, "storeHours", { from: openingHour, to: closingHour })}</div>
                      <div className="flex items-center justify-between mt-3"><span className="flex items-center gap-1 text-xs font-bold" style={{ color: C.ochre }}><Star size={13} fill={C.ochre} strokeWidth={0} /> {s.rating || uiText(language, "new")}{verifiedReviewCount > 0 && <span style={{ color: C.inkSoft, fontWeight: 500 }}>({verifiedReviewCount})</span>}</span><span className="text-xs font-bold flex items-center gap-1" style={{ color: C.teal }}>{uiText(language, "products")} <ChevronLeft size={14} /></span></div>
                    </button>
                  );
                })}
                {curatedStores.length === 0 && <p className="col-span-2 text-center py-10 text-sm" style={{ color: C.inkSoft }}>{uiText(language, "noStores")}</p>}
              </div>
              <PublicCourierAvailability couriers={publicCouriers} areaLabel={discoveryAreaLabel} language={language} />
              <VerifiedFeedbackPanel stores={curatedStores} />
            </>
          )}
        </>
      )}

      {tab === "browse" && openStore && (
        <div className="space-y-4">
          <button onClick={() => { setOpenStoreId(null); setActiveDept("all"); }} className="flex items-center gap-1 text-sm font-bold" style={{ color: C.teal }}><ChevronRight size={16} /> {uiText(language, "backToStores")}</button>
          <div className="p-4 rounded-2xl flex items-center gap-3" style={{ background: C.paperDark }}>
            <StoreAvatar logo={openStore.logo} size={46} />
            <div className="flex-1"><div className="font-black text-lg" style={{ color: C.ink, fontFamily: "'Reem Kufi', sans-serif" }}>{openStore.name}</div><div className="text-xs" style={{ color: C.inkSoft }}>{openStore.wilaya} · {openStore.commune} · يعمل من {openStore.open}:00 إلى {openStore.close}:00</div><div className="flex items-center gap-1 mt-1"><StarRating value={Math.round(openStore.rating || 0)} size={12} /><span className="text-xs font-bold" style={{ color: C.inkSoft }}>{openStore.rating || "جديد"} ({(openStore.reviews || []).length} تقييم)</span></div></div>
          </div>
          {openStore.minOrder > 0 && <p className="text-xs" style={{ color: C.inkSoft }}>الحد الأدنى للطلب: <span style={{ fontWeight: 800, color: C.ink }}>{money(openStore.minOrder)}</span></p>}
          {visibleDepts.length > 1 && (<div className="flex gap-2 overflow-x-auto pb-1"><button onClick={() => setActiveDept("all")} className="shrink-0 px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: activeDept === "all" ? C.ink : "transparent", color: activeDept === "all" ? "#fff" : C.inkSoft, border: `1px solid ${activeDept === "all" ? C.ink : C.line}` }}>{uiText(language, "allDepartments")}</button>{visibleDepts.map((d) => <button key={d.id} onClick={() => setActiveDept(d.id)} className="shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: activeDept === d.id ? d.color : "transparent", color: activeDept === d.id ? "#fff" : C.inkSoft, border: `1px solid ${activeDept === d.id ? d.color : C.line}` }}><d.icon size={14} /> {d.label}</button>)}</div>)}
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
              <div className="text-[11px] mb-1" style={{ color: C.inkSoft }}>رقم الطلب: #{String(o.id).slice(0, 8)}</div>
              <div className="text-xs mb-1" style={{ color: C.inkSoft }}>{o.items.map((i) => `${i.name} ×${i.qty}`).join(" · ")}</div>
              <div className="text-xs mb-3 flex items-center gap-1" style={{ color: C.teal }}>{React.createElement(DELIVERY_LABELS[o.deliveryType]?.icon || Home, { size: 12 })} {DELIVERY_LABELS[o.deliveryType]?.label}{o.courier ? ` — ${o.courier.name}` : ""}</div>
              <OrderTracker status={o.status} language={language} />
              <div className="flex items-center gap-2 mt-3 pt-3 flex-wrap" style={{ borderTop: `1px solid ${C.line}` }}>
                <button onClick={() => setInvoiceOrder(o)} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ border: `1px solid ${C.line}`, color: C.inkSoft }}><Printer size={12} /> {uiText(language, "invoice")}</button>
                {o.status === "delivered" && <button onClick={() => customerConfirmDelivery(o.id)} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: C.sage + "20", color: C.sage }}><CheckCircle2 size={12} /> {uiText(language, "confirmReceipt")}</button>}
                {o.status === "customer_confirmed" && !o.rated && <button onClick={() => setReviewingOrder(o)} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: C.ochre + "25", color: "#8A6318" }}><Star size={12} /> {uiText(language, "rateExperience")}</button>}
                {o.rated && <span className="text-xs font-bold flex items-center gap-1" style={{ color: C.sage }}><Check size={12} /> {uiText(language, "rated")}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCart && (
        <div className="fixed inset-0 z-40 flex justify-end" style={{ background: "rgba(35,32,27,0.45)" }} onClick={() => setShowCart(false)}>
          <div onClick={(e) => e.stopPropagation()} className="h-full w-full sm:w-96 p-5 overflow-y-auto" style={{ background: C.paper }}>
            <div className="flex items-center justify-between mb-4"><h3 className="font-black text-lg" style={{ fontFamily: "'Reem Kufi', sans-serif", color: C.ink }}>{uiText(language, "cartHeading")}</h3><button onClick={() => setShowCart(false)}><X size={20} color={C.inkSoft} /></button></div>
            {drafts.length === 0 ? <p className="text-sm text-center py-10" style={{ color: C.inkSoft }}>لا توجد مسودات طلبات بانتظار التأكيد.</p> : activeDraft && (
              <>
                <div className="mb-4 p-3 rounded-xl" style={{ background: C.paperDark, border: `1px solid ${C.line}` }}>
                  <div className="flex items-center justify-between gap-2"><div><p className="text-xs font-black" style={{ color: C.ink }}>طلبات بانتظار التأكيد ({drafts.length})</p><p className="text-[11px] mt-1" style={{ color: C.inkSoft }}>كل مسودة تُرسل وحدها؛ لا تُدمج متاجر أو عناوين مختلفة في طلب واحد.</p></div><button onClick={startIndependentDraft} className="px-3 py-2 rounded-xl text-xs font-black" style={{ background: C.teal, color: "#fff" }}>طلب مستقل جديد</button></div>
                  <div className="mt-3 space-y-2">{drafts.map((draft) => { const draftStore = stores.find((store) => store.id === draft.storeId); const selected = draft.id === activeDraft.id; return <button key={draft.id} onClick={() => { setActiveDraftId(draft.id); setQuoteError(""); }} className="w-full p-2.5 rounded-xl text-right flex items-center justify-between gap-3" style={{ background: selected ? C.teal + "12" : "#fff", border: `1px solid ${selected ? C.teal : C.line}` }}><span><span className="block text-xs font-black" style={{ color: C.ink }}>{draftStore?.name || "متجر"}</span><span className="block text-[11px] mt-0.5" style={{ color: C.inkSoft }}>{(draft.items || []).reduce((sum, item) => sum + item.qty, 0)} منتجات · {draft.deliveryChoice === "pickup" ? "استلام ذاتي" : draft.address?.label || "العنوان قيد الاستكمال"}</span></span>{selected && <CheckCircle2 size={16} color={C.teal} />}</button>; })}</div>
                </div>
                <CheckoutProgress cartCount={activeItems.reduce((sum, item) => sum + item.qty, 0)} deliveryChoice={deliveryChoice} addressReady={addressReady} language={language} />
                <p className="text-xs mb-3 font-bold" style={{ color: C.teal }}>{uiText(language, "orderFrom", { store: cartStore?.name || "—" })}</p>
                <div className="space-y-3 mb-3">{activeItems.map((i) => (<div key={i.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}><div><div className="text-sm font-bold" style={{ color: C.ink }}>{i.name}</div><div className="text-xs" style={{ color: C.inkSoft }}>{money(i.price)} × {i.qty}</div></div><div className="flex items-center gap-2"><button onClick={() => changeQty(i.id, -1)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: C.paperDark }}><Minus size={13} /></button><span className="text-sm font-bold w-4 text-center">{i.qty}</span><button onClick={() => changeQty(i.id, 1)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: C.paperDark }}><Plus size={13} /></button></div></div>))}</div>
                <button onClick={removeActiveDraft} className="text-xs font-bold mb-5" style={{ color: "#8B3A2A" }}>حذف هذه المسودة فقط</button>

                <div className="mb-4">
                  <span className="text-xs font-bold flex items-center gap-1 mb-2" style={{ color: C.ink }}><Truck2 size={13} /> {uiText(language, "deliveryMethod")}</span>
                  <div className="space-y-2">{deliveryOptions.map((opt) => (<button key={opt.id} disabled={opt.disabled} onClick={() => updateActiveDraft({ deliveryChoice: opt.id, deliveryQuote: null })} className="w-full flex items-center gap-2.5 p-2.5 rounded-xl text-right disabled:opacity-40" style={{ border: `1.5px solid ${deliveryChoice === opt.id ? C.teal : C.line}`, background: deliveryChoice === opt.id ? C.teal + "10" : "#fff" }}><opt.icon size={17} color={deliveryChoice === opt.id ? C.teal : C.inkSoft} /><div className="flex-1"><div className="text-xs font-bold" style={{ color: C.ink }}>{opt.label}</div><div className="text-[11px]" style={{ color: C.inkSoft }}>{opt.desc}</div></div>{deliveryChoice === opt.id && <CheckCircle2 size={16} color={C.teal} />}</button>))}</div>
                </div>

                {deliveryChoice !== "pickup" && <div className="mb-4 p-3 rounded-xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
                  <div className="flex items-center justify-between mb-2"><span className="text-xs font-bold flex items-center gap-1" style={{ color: C.ink }}><MapPin size={13} /> {uiText(language, "deliveryAddress")}</span><button onClick={() => setShowMapPicker(true)} className="text-xs font-bold" style={{ color: C.teal }}>{activeDraft.address ? uiText(language, "setOnMap") : uiText(language, "openMap")}</button></div>
                  <p className="text-[11px] leading-5 mb-2" style={{ color: C.inkSoft }}>الولاية والبلدية تحددان منطقة التوصيل، لكن وصف الحي أو الشارع أو المعلم مطلوب لتأكيد التوصيل. تحديد GPS اختياري لتحسين الدقة ولا يمنع إرسال الطلب.</p>
                  <WilayaCommuneSelect wilaya={activeDraft.address?.wilaya || ""} commune={activeDraft.address?.commune || ""} onChange={({ wilaya, commune }) => updateAddress({ wilaya, commune })} />
                  <input value={activeDraft.address?.label || ""} onChange={(e) => updateAddress({ label: e.target.value })} placeholder={uiText(language, "addressHint")} className="w-full mt-2 px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} />
                  <button onClick={requestCurrentLocation} className="mt-2 flex items-center gap-1 text-xs font-bold" style={{ color: C.teal }}><Navigation size={13} /> {uiText(language, "useGps")}</button>
                  {activeDraft.address?.latitude && activeDraft.address?.longitude ? <p className="mt-2 text-[11px] font-bold" style={{ color: C.sage }}>{uiText(language, "gpsSaved")}</p> : <p className="mt-2 text-[11px]" style={{ color: C.inkSoft }}>{uiText(language, "gpsHint")}</p>}
                  {activeDraft.address?.x !== undefined && <div className="mt-2"><MapPreview x={activeDraft.address.x} y={activeDraft.address.y} height={60} /></div>}
                </div>}

                {deliveryChoice !== "pickup" && quoteLoading && <p className="text-xs mb-3" style={{ color: C.inkSoft }}>{uiText(language, "calculatingDelivery")}</p>}
                {deliveryChoice !== "pickup" && deliveryQuote && <div className="mb-3 p-3 rounded-xl text-xs" style={{ background: C.teal + "0F", border: `1px solid ${C.teal}30`, color: C.ink }}><div className="font-bold" style={{ color: C.teal }}>{uiText(language, "serverQuote")}</div><div className="mt-1">{uiText(language, "distanceEta", { distance: Number(deliveryQuote.distanceKm || 0).toFixed(1), eta: deliveryQuote.etaMinutes || "—" })}{deliveryQuote.isInterwilaya ? ` · ${uiText(language, "interwilaya")}` : ""}</div></div>}
                {deliveryChoice !== "pickup" && quoteError && <p className="text-xs font-bold mb-3" style={{ color: "#8B3A2A" }}>{quoteError}</p>}
                {requiresVerifiedEmail && <div className="mb-3 p-3 rounded-xl" style={{ background: C.teal + "12", border: `1px solid ${C.teal}35` }}><div className="text-xs font-black" style={{ color: C.teal }}>{uiText(language, "emailConfirmation")}</div><p className="text-[11px] mt-1 leading-5" style={{ color: C.inkSoft }}>{emailVerified ? uiText(language, "emailVerifiedCopy") : uiText(language, "emailRequiredCopy")}</p></div>}

                <div className="flex gap-2 mb-3"><input value={rewardCouponInput} onChange={(e) => setRewardCouponInput(e.target.value.toUpperCase())} placeholder={uiText(language, "rewardCoupon")} dir="ltr" className="flex-1 px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} /><button onClick={applyRewardCoupon} className="px-4 py-2 rounded-xl text-xs font-bold" style={{ background: C.teal, color: "#fff" }}>{uiText(language, "applyCoupon")}</button></div>
                {appliedReward && <p className="text-xs font-bold mb-3 flex items-center gap-1" style={{ color: C.sage }}><Tag size={12} /> {uiText(language, "rewardHeld", { amount: money(appliedReward.amount), code: appliedReward.code })}</p>}

                <StripeDivider />
                <div className="my-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs" style={{ color: C.inkSoft }}><span>{uiText(language, "subtotal")}</span><span>{money(cartSubtotal)}</span></div>
                  {deliveryChoice !== "pickup" && <div className="flex items-center justify-between text-xs" style={{ color: C.inkSoft }}><span>{deliveryChoice === "store" ? uiText(language, "storeDeliveryFee") : uiText(language, "deliveryFee", { computed: deliveryQuote ? "✓" : "" })}</span><span>{quoteLoading ? "…" : deliveryQuote ? money(deliveryFee) : "—"}</span></div>}
                  {discountAmount > 0 && <div className="flex items-center justify-between text-xs" style={{ color: C.sage }}><span>{uiText(language, "discount")}</span><span>- {money(discountAmount)}</span></div>}
                  <div className="flex items-center justify-between pt-1"><span className="font-bold text-sm" style={{ color: C.ink }}>{uiText(language, "cashOnDelivery")}</span><PriceTag amount={finalTotal} size="lg" /></div>
                </div>
                <p className="text-xs font-bold mb-3" style={{ color: checkoutDisabled ? C.inkSoft : C.sage }}>{checkoutHint}</p>
                <div className="mb-3 p-3 rounded-xl text-xs" style={{ background: C.paperDark, border: `1px solid ${C.line}`, color: C.ink }}><span className="font-black">ملخص التأكيد: </span>{cartStore?.name || "المحل"} · {deliveryChoice === "pickup" ? "استلام ذاتي" : `${activeDraft.address?.wilaya || "—"}، ${activeDraft.address?.commune || "—"}، ${activeDraft.address?.label || "وصف العنوان مطلوب"}`} · {deliveryChoice === "pickup" ? "دون رسوم توصيل" : `رسوم التوصيل ${deliveryQuote ? money(deliveryFee) : "قيد الاحتساب"}`}</div>
                <button disabled={checkoutDisabled} onClick={async () => { const ok = await placeOrder(cartStore, activeItems, null, discountAmount, activeDraft.address, deliveryChoice, deliveryFee, appliedReward?.code); if (!ok) return; setCart((prev) => ({ ...prev, drafts: (prev.drafts || []).filter((draft) => draft.id !== activeDraft.id) }), customerId); setActiveDraftId(null); setRewardCouponInput(""); setShowCart(false); setTab("orders"); }} className="w-full py-3 rounded-xl font-black disabled:opacity-40" style={{ background: C.rust, color: "#fff" }}>تأكيد هذا الطلب من {cartStore?.name || "المحل"} وإرساله الآن</button>
              </>
            )}
          </div>
        </div>
      )}

      {showMapPicker && <MapPicker title="حدد عنوان التوصيل" initial={activeDraft?.address ? { x: activeDraft.address.x, y: activeDraft.address.y } : undefined} onConfirm={(pos) => updateAddress({ x: pos.x, y: pos.y })} onClose={() => setShowMapPicker(false)} />}
      {reviewingOrder && <ReviewModal order={reviewingOrder} onSubmit={(stars, comment) => submitReview(reviewingOrder, stars, comment)} onClose={() => setReviewingOrder(null)} />}
      {invoiceOrder && <InvoiceModal order={invoiceOrder} store={stores.find((s) => s.id === invoiceOrder.storeId)} onClose={() => setInvoiceOrder(null)} />}
    </div>
  );
}

function OrderTracker({ status, language = "ar" }) {
  if (["declined", "cancelled"].includes(status)) return <p className="text-xs font-bold" style={{ color: STATUS_MAP[status].color }}>{STATUS_MAP[status].label}.</p>;
  const current = getCustomerTrackingStage(status, language);
  const steps = ["stageReceived", "stagePreparing", "stageHandover", "stageOnTheWay", "stageDelivered"];
  return <section aria-label={uiText(language, "currentStage", { stage: uiText(language, current.key) })} className="mt-2">
    <p className="text-[11px] font-bold mb-2" style={{ color: C.inkSoft }}>{uiText(language, "currentStage", { stage: uiText(language, current.key) })}</p>
    <div className="flex items-center" aria-hidden="true">
      {steps.map((key, index) => (
        <React.Fragment key={key}>
          <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: 21, height: 21, background: index <= current.index ? C.teal : C.paperDark, color: index <= current.index ? "#fff" : C.inkSoft }}>
            {index < current.index ? <Check size={11} /> : <span style={{ width: 5, height: 5, borderRadius: 999, background: index === current.index ? "currentColor" : C.inkSoft }} />}
          </div>
          {index < steps.length - 1 && <div className="flex-1 h-0.5" style={{ background: index < current.index ? C.teal : C.paperDark }} />}
        </React.Fragment>
      ))}
    </div>
  </section>;
}

/* ===========================================================
   MERCHANT VIEW
=========================================================== */
function MerchantQrPoster({ store, notify }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const deepLink = useMemo(() => buildPublicAppLink({ store: store.id }), [store.id]);

  useEffect(() => {
    let active = true;
    void loadQrCode().then((QRCode) => QRCode.toDataURL(deepLink, { errorCorrectionLevel: "H", width: 900, margin: 2, color: { dark: C.ink, light: "#FFFFFF" } }))
      .then((value) => { if (active) setQrDataUrl(value); })
      .catch(() => notify("تعذر إنشاء رمز QR لهذا المحل."));
    return () => { active = false; };
  }, [deepLink, notify]);

  async function copyDeepLink() {
    try { await navigator.clipboard.writeText(deepLink); notify("تم نسخ رابط المحل للمشاركة."); }
    catch { notify("انسخ الرابط يدوياً من الحقل الظاهر."); }
  }

  async function downloadPoster() {
    if (!qrDataUrl) { notify("جارٍ تجهيز الملصق، حاول بعد لحظات."); return; }
    let pdf;
    try {
      const JsPdf = await loadJsPdf();
      pdf = new JsPdf({ orientation: "portrait", unit: "mm", format: "a4" });
      await registerArabicPdfFont(pdf);
    } catch {
      notify("تعذر تجهيز ملصق PDF العربي. تحقق من الاتصال ثم أعد المحاولة.");
      return;
    }
    pdf.setFillColor(247, 248, 252); pdf.rect(0, 0, 210, 297, "F");
    pdf.setFillColor(91, 91, 247); pdf.roundedRect(18, 18, 174, 20, 5, 5, "F");
    writeArabicPdfText(pdf, "SOUQ JIRAN · اطلب من المنزل", 105, 31, 19, [255, 255, 255]);
    writeArabicPdfText(pdf, store.name, 105, 57, 22, [23, 32, 51]);
    writeArabicPdfText(pdf, `${store.commune} · ${store.wilaya}`, 105, 66, 12, [105, 115, 134]);
    pdf.addImage(qrDataUrl, "PNG", 47, 76, 116, 116);
    writeArabicPdfText(pdf, "امسح الرمز لتطلب مباشرة من محلك", 105, 210, 15, [23, 32, 51]);
    writeArabicPdfText(pdf, "سوق الجيران · طلبات محلية وتوصيل منظم", 105, 220, 10, [105, 115, 134]);
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

function MerchantView({ stores, setStores, orders, messages, couriers, merchantOffers = [], myStoreId, setMyStoreId, notify, onStartMerchantRegistration, createProduct, createBulkProducts, removeProductRemote, setProductAvailability, setMerchantOrderStatus, merchantConfirmSettlement, reportCustomerAccount, archiveOrder, archiveMessage, submitMerchantOffer, pauseMerchantOffer, userId, isResolvingMerchantStore = false }) {
  const myStore = stores.find((s) => s.id === myStoreId);
  const [stage2, setStage2] = useState({ open: 8, close: 21, minOrder: 0, deliveryFee: 0, hasOwnDelivery: true, deliveryCommunes: [], logoText: "", logoColor: C.teal, ccp: "", idDocName: "" });
  const [tab, setTab] = useState("products");
  const [businessHours, setBusinessHours] = useState({ openingHour: "8", closingHour: "21" });
  const [savingBusinessHours, setSavingBusinessHours] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", price: "", unit: "الوحدة", department: "pantry" });
  const [invoiceOrder, setInvoiceOrder] = useState(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [savingDeliveryPreferences, setSavingDeliveryPreferences] = useState(false);
  const [editingOfferId, setEditingOfferId] = useState(null);
  const [offerForm, setOfferForm] = useState(() => {
    const start = new Date();
    const end = new Date(start.getTime() + (7 * 24 * 60 * 60 * 1000));
    return { title: "", description: "", discountType: "percent", discountValue: "", startsAt: start.toISOString().slice(0, 16), endsAt: end.toISOString().slice(0, 16) };
  });

  function updateStore(patch) { setStores((prev) => prev.map((s) => (s.id === myStoreId ? { ...s, ...patch } : s))); }
  const deliveryCoverageZones = useMemo(() => {
    const zones = Array.isArray(myStore?.deliveryCoverageZones) ? myStore.deliveryCoverageZones : [];
    if (zones.length > 0) return zones.map((zone) => ({ wilaya: zone?.wilaya || "", mainCommune: zone?.mainCommune || "", coveredCommunes: Array.isArray(zone?.coveredCommunes) ? zone.coveredCommunes : [] }));
    return [{ wilaya: myStore?.wilaya || "", mainCommune: myStore?.commune || "", coveredCommunes: Array.isArray(myStore?.deliveryCommunes) ? myStore.deliveryCommunes : [] }];
  }, [myStore?.commune, myStore?.deliveryCommunes, myStore?.deliveryCoverageZones, myStore?.wilaya]);
  function updateDeliveryCoverageZone(index, patch) { updateStore({ deliveryCoverageZones: deliveryCoverageZones.map((zone, currentIndex) => currentIndex === index ? { ...zone, ...patch } : zone) }); }
  function toggleDeliveryCoverageCommune(index, commune) { const zone = deliveryCoverageZones[index]; const coveredCommunes = zone.coveredCommunes.includes(commune) ? zone.coveredCommunes.filter((item) => item !== commune) : [...zone.coveredCommunes, commune]; updateDeliveryCoverageZone(index, { coveredCommunes }); }
  function addDeliveryCoverageZone() { updateStore({ deliveryCoverageZones: [...deliveryCoverageZones, { wilaya: myStore?.wilaya || "", mainCommune: myStore?.commune || "", coveredCommunes: [] }] }); }
  function removeDeliveryCoverageZone(index) { if (deliveryCoverageZones.length === 1) { notify("أبقِ منطقة واحدة على الأقل أو أوقف مساري التوصيل إن كان الاستلام الذاتي فقط."); return; } updateStore({ deliveryCoverageZones: deliveryCoverageZones.filter((_, currentIndex) => currentIndex !== index) }); }
  async function saveDeliveryPreferences() {
    const coverageZones = deliveryCoverageZones.map((zone) => ({ wilaya: zone.wilaya, mainCommune: zone.mainCommune, coveredCommunes: zone.coveredCommunes }));
    setSavingDeliveryPreferences(true);
    const { error } = await supabase.rpc("merchant_save_delivery_preferences", { p_has_own_delivery: Boolean(myStore.hasOwnDelivery), p_platform_delivery_enabled: myStore.platformDeliveryEnabled !== false, p_delivery_fee: Number(myStore.deliveryFee) || 0, p_coverage_zones: coverageZones });
    setSavingDeliveryPreferences(false);
    if (error) {
      const missingRpc = error.code === "42883" || /merchant_save_delivery_preferences|schema cache/i.test(error.message || "");
      notify(missingRpc ? "يلزم تشغيل ترحيل التوصيل المتوازي 20260909 في Supabase SQL Editor قبل الحفظ." : `تعذر حفظ إعدادات التوصيل: ${error.message}`);
      return;
    }
    updateStore({ deliveryCoverageZones: coverageZones, platformDeliveryEnabled: myStore.platformDeliveryEnabled !== false });
    notify("تم حفظ مسارات التوصيل ومناطق التغطية.");
  }
  useEffect(() => {
    const handleBack = (event) => {
      if (showMapPicker) { setShowMapPicker(false); event.preventDefault(); return; }
      if (showBulkImport) { setShowBulkImport(false); event.preventDefault(); return; }
      if (invoiceOrder) { setInvoiceOrder(null); event.preventDefault(); return; }
      if (editingOfferId) { setEditingOfferId(null); event.preventDefault(); return; }
      if (tab !== "products") { setTab("products"); event.preventDefault(); }
    };
    window.addEventListener("souq-jiran:back", handleBack);
    return () => window.removeEventListener("souq-jiran:back", handleBack);
  }, [editingOfferId, invoiceOrder, showBulkImport, showMapPicker, tab]);
  useEffect(() => {
    if (!myStore) return;
    const { openingHour, closingHour } = getStoreBusinessHours(myStore);
    setBusinessHours({ openingHour: String(openingHour), closingHour: String(closingHour) });
  }, [myStore?.id, myStore?.open, myStore?.close]);

  async function saveBusinessHours() {
    const openingHour = Number(businessHours.openingHour);
    const closingHour = Number(businessHours.closingHour);
    if (!Number.isInteger(openingHour) || openingHour < 0 || openingHour > 23 || !Number.isInteger(closingHour) || closingHour < 0 || closingHour > 23) {
      notify("أدخل ساعات صحيحة بين 00 و23.");
      return;
    }
    if (openingHour === closingHour) {
      notify("اختر ساعتين مختلفتين؛ يدعم التطبيق النطاق الذي يعبر منتصف الليل.");
      return;
    }
    const previousHours = { open: myStore.open, close: myStore.close };
    updateStore({ open: openingHour, close: closingHour });
    setSavingBusinessHours(true);
    const { error } = await supabase.rpc("merchant_update_business_hours", { p_opening_hour: openingHour, p_closing_hour: closingHour });
    setSavingBusinessHours(false);
    if (error) {
      updateStore(previousHours);
      const missingHoursRpc = error.code === "42883" || /merchant_update_business_hours|opening_hour|closing_hour|schema cache/i.test(error.message || "");
      notify(missingHoursRpc ? "تعذر حفظ الساعات لأن ترحيل ساعات عمل المتاجر غير مفعّل في Supabase بعد." : `تعذر حفظ ساعات العمل: ${error.message}`);
      return;
    }
    notify("تم حفظ ساعات عمل المحل. ستتحدث الحالة الظاهرة للعملاء تلقائياً.");
  }
  async function updateStoreLocation({ latitude, longitude }) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) { notify("إحداثيات الموقع غير صالحة."); return false; }
    const previousLocation = {
      lat: myStore.lat ?? null,
      lng: myStore.lng ?? null,
      latitude: myStore.latitude ?? null,
      longitude: myStore.longitude ?? null,
    };
    updateStore({ lat: latitude, lng: longitude, latitude, longitude });
    const { error } = await supabase.rpc("merchant_update_location", { p_latitude: latitude, p_longitude: longitude });
    if (error) {
      const missingRpc = error.code === "42883" || /merchant_update_location|schema cache/i.test(error.message || "");
      const missingCoordinates = error.code === "42703" || /column.*(latitude|longitude).*does not exist/i.test(error.message || "");
      updateStore(previousLocation);
      notify(missingRpc
        ? "تعذر حفظ الموقع لأن دالة Supabase غير مفعّلة. شغّل ترحيل merchant_location_update ثم أعد المحاولة."
        : missingCoordinates
          ? "تعذر حفظ الموقع لأن أعمدة الإحداثيات غير مفعّلة في Supabase. شغّل ترحيل 20260907_merchant_location_columns_repair ثم أعد المحاولة."
          : "تعذر مزامنة موقع المتجر: " + error.message);
      return false;
    }
    notify("تم تحديث موقع المحل وحفظه بنجاح.");
    return true;
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
  const myOffers = merchantOffers.filter((offer) => offer.merchantId === myStoreId);
  const offerStatusLabels = { draft: "مسودة", pending: "قيد المراجعة", approved: "معتمد", rejected: "مرفوض", paused: "موقوف", expired: "منتهٍ" };

  function resetOfferForm() {
    const start = new Date();
    const end = new Date(start.getTime() + (7 * 24 * 60 * 60 * 1000));
    setEditingOfferId(null);
    setOfferForm({ title: "", description: "", discountType: "percent", discountValue: "", startsAt: start.toISOString().slice(0, 16), endsAt: end.toISOString().slice(0, 16) });
  }
  function editOffer(offer) {
    setEditingOfferId(offer.id);
    setOfferForm({ title: offer.title, description: offer.description || "", discountType: offer.discountType, discountValue: String(offer.discountValue), startsAt: new Date(offer.startsAt).toISOString().slice(0, 16), endsAt: new Date(offer.endsAt).toISOString().slice(0, 16) });
    setTab("offers");
  }
  async function saveOffer() {
    const result = await submitMerchantOffer({ id: editingOfferId || undefined, merchantId: myStoreId, ...offerForm });
    if (!result) return;
    notify(editingOfferId ? "أُعيد إرسال التعديل للمراجعة." : "أُرسل العرض للمراجعة الإدارية.");
    resetOfferForm();
  }

  if (isResolvingMerchantStore) {
    return (
      <div className="max-w-md mx-auto p-6 rounded-2xl space-y-3 text-center" style={{ background: "#fff", border: `1px solid ${C.line}` }} data-testid="merchant-store-hydration">
        <Loader2 size={30} color={C.teal} className="animate-spin" style={{ margin: "0 auto" }} />
        <h3 className="font-black text-lg" style={{ fontFamily: "'Reem Kufi', sans-serif", color: C.ink }}>جارٍ تحميل لوحة محلك</h3>
        <p className="text-sm leading-6" style={{ color: C.inkSoft }}>نتحقق من بيانات المتجر المرتبطة بحسابك بأمان.</p>
      </div>
    );
  }

  if (!myStore) {
    return (
      <div className="max-w-md mx-auto p-6 rounded-2xl space-y-4 text-center" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
        <Store size={32} color={C.rust} style={{ margin: "0 auto" }} />
        <h3 className="font-black text-lg" style={{ fontFamily: "'Reem Kufi', sans-serif", color: C.ink }}>لا يوجد محل مرتبط بهذا الحساب</h3>
        <p className="text-sm leading-6" style={{ color: C.inkSoft }}>سجّل بيانات محلك، ثم وثّق بريدك برمز من Supabase قبل إنشاء طلب الانضمام. لا توجد حسابات أو بيانات تجريبية في هذه البوابة.</p>
        <button onClick={onStartMerchantRegistration} className="w-full py-3 rounded-xl font-black" style={{ background: C.rust, color: "#fff" }}>إرسال طلب انضمام كتاجر</button>
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

  if (myStore.status !== "approved") {
    return (
      <div className="max-w-md mx-auto p-6 rounded-2xl text-center space-y-3" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
        <ShieldCheck size={30} color={C.ochre} style={{ margin: "0 auto" }} />
        <h3 className="font-black text-lg" style={{ fontFamily: "'Reem Kufi', sans-serif", color: C.ink }}>حساب المحل غير مفعّل حالياً</h3>
        <p className="text-sm leading-6" style={{ color: C.inkSoft }}>تبقى إدارة المنتجات والطلبات والعروض متاحة بعد اعتماد الإدارة لحساب المحل.</p>
        <button onClick={() => setMyStoreId(null)} className="text-xs font-bold flex items-center gap-1 mx-auto" style={{ color: C.inkSoft }}><ChevronLeft size={13} /> تبديل المحل</button>
      </div>
    );
  }

  return (
    <div className="dashboard-shell space-y-5">
      <div className="p-4 rounded-2xl" style={{ background: C.paperDark }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3"><StoreAvatar logo={myStore.logo} size={44} /><div><div className="font-black" style={{ fontFamily: "'Reem Kufi', sans-serif", color: C.ink }}>{myStore.name}</div><div className="text-xs" style={{ color: C.inkSoft }}>{myStore.wilaya} · {myStore.commune} · {getStoreBusinessHours(myStore).openingHour}:00 - {getStoreBusinessHours(myStore).closingHour}:00</div><div className="flex items-center gap-1 mt-1"><StarRating value={Math.round(myStore.rating || 0)} size={11} /><span className="text-xs font-bold" style={{ color: C.inkSoft }}>{myStore.rating || "لا تقييمات بعد"}</span></div></div></div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end"><button data-testid="merchant-new-orders-counter" onClick={openNewMerchantOrders} className="flex items-center gap-1 text-xs font-black px-3 py-1.5 rounded-full" aria-label={`${newMerchantOrders.length} طلبات جديدة`} style={{ background: newMerchantOrders.length ? C.rust + "18" : C.sage + "22", color: newMerchantOrders.length ? C.rust : C.tealDark }}><Bell size={13} />{newMerchantOrders.length} طلبات جديدة</button><button data-testid="merchant-new-orders-link" onClick={openNewMerchantOrders} className="flex items-center gap-1 text-xs font-bold px-2 py-1.5 rounded-full" style={{ color: C.teal, border: `1px solid ${C.teal}55` }}><ArrowLeft size={12} /> عرض الطلبات الجديدة</button><span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: C.sage + "30", color: C.tealDark }}>محل مفعّل</span></div>
        </div>
        <div className="flex items-center gap-3 text-xs mb-2 flex-wrap" style={{ color: C.inkSoft }}>
          <span className="flex items-center gap-1"><Truck2 size={12} /> {myStore.hasOwnDelivery ? `توصيل خاص (${money(myStore.deliveryFee)})` : "يعتمد موصلي المنصة"}</span>
          <span className="flex items-center gap-1"><Percent size={12} /> {myStore.commissionType === "percentage" ? `عمولة ${myStore.commissionRate}% لكل طلب` : `اشتراك شهري ${money(myStore.subscriptionFee)}`}</span>
        </div>
        <div className="flex items-center justify-between mb-1.5"><span className="text-xs font-bold flex items-center gap-1" style={{ color: C.ink }}><MapPin size={12} /> {myStore.address || "لم يُحدد عنوان تفصيلي"}</span><button onClick={() => setShowMapPicker(true)} className="text-xs font-bold" style={{ color: C.teal }}>تعديل الموقع</button></div>
        <MapPreview latitude={myStore.latitude ?? myStore.lat} longitude={myStore.longitude ?? myStore.lng} height={96} onClick={() => setShowMapPicker(true)} />
        <button onClick={() => setMyStoreId(null)} className="mt-3 text-xs font-bold flex items-center gap-1" style={{ color: C.inkSoft }}><ChevronLeft size={13} /> تبديل المحل</button>
      </div>
      {showMapPicker && <MapPicker title="تعديل موقع المحل" initial={Number.isFinite(myStore.latitude ?? myStore.lat) && Number.isFinite(myStore.longitude ?? myStore.lng) ? { latitude: Number(myStore.latitude ?? myStore.lat), longitude: Number(myStore.longitude ?? myStore.lng) } : undefined} onConfirm={(pos) => updateStoreLocation({ latitude: pos.latitude, longitude: pos.longitude })} onClose={() => setShowMapPicker(false)} />}

      <div className="dashboard-tabs flex gap-2 flex-wrap">
        <button onClick={() => setTab("products")} className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: tab === "products" ? C.teal : "transparent", color: tab === "products" ? "#fff" : C.inkSoft, border: `1px solid ${tab === "products" ? C.teal : C.line}` }}>المنتجات</button>
        <button onClick={() => setTab("orders")} className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: tab === "orders" ? C.teal : "transparent", color: tab === "orders" ? "#fff" : C.inkSoft, border: `1px solid ${tab === "orders" ? C.teal : C.line}` }}>الطلبات الواردة {newMerchantOrders.length > 0 && `(${newMerchantOrders.length})`}</button>
        <button onClick={() => setTab("delivery")} className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: tab === "delivery" ? C.teal : "transparent", color: tab === "delivery" ? "#fff" : C.inkSoft, border: `1px solid ${tab === "delivery" ? C.teal : C.line}` }}>إعدادات التوصيل</button>
        <button data-testid="merchant-business-hours-tab" onClick={() => setTab("hours")} className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: tab === "hours" ? C.teal : "transparent", color: tab === "hours" ? "#fff" : C.inkSoft, border: `1px solid ${tab === "hours" ? C.teal : C.line}` }}>ساعات العمل</button>
        <button data-testid="merchant-offers-tab" onClick={() => setTab("offers")} className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: tab === "offers" ? C.teal : "transparent", color: tab === "offers" ? "#fff" : C.inkSoft, border: `1px solid ${tab === "offers" ? C.teal : C.line}` }}>عروضي</button>
        <button data-testid="merchant-qr-tab" onClick={() => setTab("qr")} className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: tab === "qr" ? C.teal : "transparent", color: tab === "qr" ? "#fff" : C.inkSoft, border: `1px solid ${tab === "qr" ? C.teal : C.line}` }}>QR المحل</button>
        <button data-testid="merchant-media-tab" onClick={() => setTab("media")} className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: tab === "media" ? C.teal : "transparent", color: tab === "media" ? "#fff" : C.inkSoft, border: `1px solid ${tab === "media" ? C.teal : C.line}` }}>صور المتجر والوثائق</button>
        <button onClick={() => setTab("messages")} className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: tab === "messages" ? C.teal : "transparent", color: tab === "messages" ? "#fff" : C.inkSoft, border: `1px solid ${tab === "messages" ? C.teal : C.line}` }}>الرسائل</button>
      </div>

      {tab === "qr" && <MerchantQrPoster store={myStore} notify={notify} />}
      {tab === "media" && <ProviderMediaManager providerId={myStore.id} providerRole="merchant" accent={C.rust} title="صور متجرك ووثائق النشاط" />}

      {tab === "hours" && <div className="p-4 rounded-2xl space-y-4" style={{ background: "#fff", border: `1px solid ${C.line}` }} data-testid="merchant-business-hours-panel"><div><h3 className="font-black text-base" style={{ color: C.ink }}>ساعات عمل المحل</h3><p className="text-xs leading-5 mt-1" style={{ color: C.inkSoft }}>تُعرض هذه الساعات تلقائياً للعملاء. يمكنك أيضاً ضبط وقت إغلاق بعد منتصف الليل، مثل 19:00 إلى 02:00.</p></div><div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold" style={{ color: C.inkSoft }}>وقت الفتح (00–23)<input aria-label="وقت فتح المحل" type="number" min="0" max="23" value={businessHours.openingHour} onChange={(event) => setBusinessHours((current) => ({ ...current, openingHour: event.target.value }))} className="w-full mt-1 px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} /></label><label className="text-xs font-bold" style={{ color: C.inkSoft }}>وقت الغلق (00–23)<input aria-label="وقت غلق المحل" type="number" min="0" max="23" value={businessHours.closingHour} onChange={(event) => setBusinessHours((current) => ({ ...current, closingHour: event.target.value }))} className="w-full mt-1 px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} /></label></div><button disabled={savingBusinessHours} onClick={saveBusinessHours} className="w-full py-2.5 rounded-xl text-sm font-black disabled:opacity-50" style={{ background: C.teal, color: "#fff" }}>{savingBusinessHours ? "جارٍ الحفظ…" : "حفظ ساعات العمل"}</button></div>}

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

      {tab === "offers" && <div className="space-y-4" data-testid="merchant-offers-panel">
        <div className="p-4 rounded-2xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
          <div className="flex items-start justify-between gap-3 mb-3"><div><h3 className="font-black" style={{ color: C.ink }}>عرض متجر للمراجعة</h3><p className="text-xs leading-5 mt-1" style={{ color: C.inkSoft }}>لا يظهر العرض للزوار إلا بعد اعتماد الإدارة وخلال مدته المحددة.</p></div>{editingOfferId && <button onClick={resetOfferForm} className="text-xs font-bold shrink-0" style={{ color: C.teal }}>عرض جديد</button>}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs font-bold sm:col-span-2" style={{ color: C.inkSoft }}>عنوان العرض<input value={offerForm.title} maxLength={80} onChange={(event) => setOfferForm({ ...offerForm, title: event.target.value })} placeholder="مثال: تخفيض نهاية الأسبوع" className="w-full mt-1 px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} /></label>
            <label className="text-xs font-bold sm:col-span-2" style={{ color: C.inkSoft }}>وصف مختصر (اختياري)<textarea value={offerForm.description} maxLength={240} onChange={(event) => setOfferForm({ ...offerForm, description: event.target.value })} rows={2} placeholder="أضف الشروط أو الفئة المشمولة بوضوح" className="w-full mt-1 px-3 py-2 rounded-xl text-sm outline-none resize-none" style={{ border: `1px solid ${C.line}` }} /></label>
            <label className="text-xs font-bold" style={{ color: C.inkSoft }}>نوع الخصم<select value={offerForm.discountType} onChange={(event) => setOfferForm({ ...offerForm, discountType: event.target.value })} className="w-full mt-1 px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }}><option value="percent">نسبة مئوية</option><option value="fixed">قيمة بالدينار</option></select></label>
            <label className="text-xs font-bold" style={{ color: C.inkSoft }}>{offerForm.discountType === "percent" ? "نسبة الخصم (%)" : "قيمة الخصم (دج)"}<input value={offerForm.discountValue} type="number" min="1" max={offerForm.discountType === "percent" ? "100" : "100000"} onChange={(event) => setOfferForm({ ...offerForm, discountValue: event.target.value })} className="w-full mt-1 px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} /></label>
            <label className="text-xs font-bold" style={{ color: C.inkSoft }}>بداية العرض<input value={offerForm.startsAt} type="datetime-local" onChange={(event) => setOfferForm({ ...offerForm, startsAt: event.target.value })} className="w-full mt-1 px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} /></label>
            <label className="text-xs font-bold" style={{ color: C.inkSoft }}>نهاية العرض<input value={offerForm.endsAt} type="datetime-local" onChange={(event) => setOfferForm({ ...offerForm, endsAt: event.target.value })} className="w-full mt-1 px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} /></label>
          </div>
          <button onClick={saveOffer} className="mt-4 w-full py-2.5 rounded-xl font-black text-sm" style={{ background: C.rust, color: "#fff" }}>{editingOfferId ? "إرسال التعديل للمراجعة" : "إرسال العرض للمراجعة"}</button>
        </div>
        <div className="space-y-2"><div className="flex items-center justify-between"><h3 className="font-black text-sm" style={{ color: C.ink }}>سجل عروض المحل</h3><span className="text-xs" style={{ color: C.inkSoft }}>{myOffers.length} عرض</span></div>{myOffers.length === 0 && <p className="text-sm text-center py-6 rounded-2xl" style={{ color: C.inkSoft, background: C.paperDark }}>لا توجد عروض مقدمة لهذا المحل بعد.</p>}{myOffers.map((offer) => <article key={offer.id} className="p-3.5 rounded-2xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}><div className="flex items-start justify-between gap-3"><div><div className="font-bold text-sm" style={{ color: C.ink }}>{offer.title}</div><div className="text-xs mt-1" style={{ color: C.teal }}>{formatOfferValue(offer)} · {formatOfferEndsAt(offer.endsAt)}</div>{offer.description && <p className="text-xs mt-1.5 leading-5" style={{ color: C.inkSoft }}>{offer.description}</p>}{offer.adminNote && <p className="text-xs mt-2 p-2 rounded-lg" style={{ background: C.ochre + "12", color: C.inkSoft }}>ملاحظة الإدارة: {offer.adminNote}</p>}</div><span className="shrink-0 text-[11px] font-black px-2 py-1 rounded-full" style={{ background: (offer.status === "approved" ? C.sage : offer.status === "rejected" ? C.rust : C.ochre) + "22", color: offer.status === "approved" ? C.tealDark : offer.status === "rejected" ? C.rust : C.ochre }}>{offerStatusLabels[offer.status] || offer.status}</span></div><div className="mt-3 flex gap-2"><button onClick={() => editOffer(offer)} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ border: `1px solid ${C.teal}55`, color: C.teal }}>تعديل</button>{["approved", "pending"].includes(offer.status) && <button onClick={() => pauseMerchantOffer(offer)} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ border: `1px solid ${C.rust}55`, color: C.rust }}>إيقاف</button>}</div></article>)}</div>
      </div>}

      {tab === "orders" && (
        <div id="merchant-new-orders" tabIndex={-1} className="space-y-3 outline-none">
          {myOrders.length === 0 && <p className="text-center text-sm py-10" style={{ color: C.inkSoft }}>لا توجد طلبات واردة حالياً.</p>}
          {myOrders.map((o) => (
            <div key={o.id} className="p-4 rounded-2xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
              <div className="flex items-center justify-between mb-2"><span className="font-bold text-sm" style={{ color: C.ink }}>{o.customer} · {o.createdAt}</span><StatusPill status={o.status} /></div>
              <div className="text-xs mb-1" style={{ color: C.inkSoft }}>{o.items.map((i) => `${i.name} ×${i.qty}`).join(" · ")}</div>
              <div className="text-xs mb-3 flex items-center gap-1" style={{ color: C.teal }}>{React.createElement(DELIVERY_LABELS[o.deliveryType]?.icon || Home, { size: 12 })} {DELIVERY_LABELS[o.deliveryType]?.label}{o.courier ? ` — ${o.courier.name}` : ""}</div>
              {o.isInterwilaya && <p className="text-[11px] font-bold mb-3" style={{ color: C.purple }}>توصيل بين الولايات · {Number(o.deliveryDistanceKm || 0).toFixed(1)} كم · {o.estimatedDeliveryMinutes || "—"} دقيقة</p>}
              <div className="flex items-center justify-between flex-wrap gap-2"><PriceTag amount={o.total} /><div className="flex gap-2 flex-wrap"><button onClick={() => setInvoiceOrder(o)} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ border: `1px solid ${C.line}`, color: C.inkSoft }}><Printer size={12} /> الفاتورة</button>{o.customerId && <button onClick={() => { const reason = window.prompt("سبب البلاغ (5 أحرف على الأقل)"); if (reason) reportCustomerAccount(o.customerId, reason, o.id); }} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ border: `1px solid ${C.rust}55`, color: C.rust }}>إبلاغ عن الحساب</button>}<button onClick={() => archiveOrder(o.id)} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: "#8B3A2A18", color: "#8B3A2A" }}><Trash2 size={12} /> حذف من قائمتي</button>{o.status === "pending" && (<><button onClick={() => setOrderStatus(o.id, "declined")} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: "#8B3A2A20", color: "#8B3A2A" }}><X size={13} /> رفض</button><button onClick={() => setOrderStatus(o.id, "accepted")} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: C.teal, color: "#fff" }}><Check size={13} /> قبول</button></>)}{nextStatus[o.status] && <button onClick={() => setOrderStatus(o.id, nextStatus[o.status])} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: C.rust, color: "#fff" }}>تحديث إلى «{STATUS_MAP[nextStatus[o.status]].label}»</button>}{o.status === "remittance_confirmed" && <button onClick={() => merchantConfirmSettlement(o.id)} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: C.sage, color: "#fff" }}><Wallet size={12} /> تأكيد استلام المستحقات</button>}</div></div>
            </div>
          ))}
        </div>
      )}

      {tab === "delivery" && (
        <div className="space-y-5">
          <div className="p-4 rounded-2xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
            <div className="flex items-start justify-between gap-3 mb-3"><div><h3 className="font-black text-sm flex items-center gap-1.5" style={{ color: C.ink }}><Truck2 size={14} color={C.teal} /> مسارات التوصيل المتاحة</h3><p className="text-[11px] leading-5 mt-1" style={{ color: C.inkSoft }}>يمكن تفعيل توصيل المحل وتوصيل المنصة معاً؛ يختار العميل أحدهما عند الطلب، والاستلام الذاتي يبقى مستقلاً.</p></div></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
              <label className="p-3 rounded-xl cursor-pointer" style={{ border: `1px solid ${myStore.hasOwnDelivery ? C.teal : C.line}`, background: myStore.hasOwnDelivery ? C.teal + "0F" : "transparent" }}><span className="flex items-center gap-2 text-sm font-black" style={{ color: C.ink }}><input type="checkbox" checked={Boolean(myStore.hasOwnDelivery)} onChange={(event) => updateStore({ hasOwnDelivery: event.target.checked })} /> توصيل المحل</span><span className="block text-[11px] leading-5 mt-1" style={{ color: C.inkSoft }}>يظهر كخيار مستقل ولا يلغي خدمة المنصة.</span></label>
              <label className="p-3 rounded-xl cursor-pointer" style={{ border: `1px solid ${myStore.platformDeliveryEnabled !== false ? C.teal : C.line}`, background: myStore.platformDeliveryEnabled !== false ? C.teal + "0F" : "transparent" }}><span className="flex items-center gap-2 text-sm font-black" style={{ color: C.ink }}><input type="checkbox" checked={myStore.platformDeliveryEnabled !== false} onChange={(event) => updateStore({ platformDeliveryEnabled: event.target.checked })} /> توصيل المنصة</span><span className="block text-[11px] leading-5 mt-1" style={{ color: C.inkSoft }}>تُحسب رسومه حسب المسافة والتسعير المركزي في لوحة الإدارة.</span></label>
            </div>
            {myStore.hasOwnDelivery && <label className="text-xs block mb-4" style={{ color: C.inkSoft }}>رسوم توصيل المحل (دج)<input type="number" min="0" value={myStore.deliveryFee} onChange={(event) => updateStore({ deliveryFee: Number(event.target.value) })} className="w-full mt-1 px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }} /></label>}
            <div className="space-y-3 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
              <div><p className="text-xs font-black" style={{ color: C.ink }}>مناطق التغطية</p><p className="text-[11px] leading-5 mt-1" style={{ color: C.inkSoft }}>أضف ولاية، ثم بلديتها الرئيسة والبلديات المغطاة. يمكنك إضافة ولايات متجاورة دون استبدال المنطقة الأولى.</p></div>
              {deliveryCoverageZones.map((zone, index) => <div key={`${index}-${zone.wilaya}-${zone.mainCommune}`} className="p-3 rounded-xl space-y-2" style={{ background: C.paperDark, border: `1px solid ${C.line}` }}>
                <div className="flex items-center justify-between gap-2"><span className="text-xs font-black" style={{ color: C.ink }}>منطقة {index + 1}</span><button type="button" onClick={() => removeDeliveryCoverageZone(index)} className="text-[11px] font-bold" style={{ color: deliveryCoverageZones.length === 1 ? C.inkSoft : C.rust }}>إزالة</button></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><label className="text-[11px] font-bold" style={{ color: C.inkSoft }}>الولاية<select value={zone.wilaya} onChange={(event) => updateDeliveryCoverageZone(index, { wilaya: event.target.value, mainCommune: "", coveredCommunes: [] })} className="w-full mt-1 px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${C.line}` }}><option value="">اختر الولاية</option>{WILAYAS.map((wilaya) => <option key={wilaya} value={wilaya}>{wilaya}</option>)}</select></label><label className="text-[11px] font-bold" style={{ color: C.inkSoft }}>البلدية الرئيسية<select value={zone.mainCommune} onChange={(event) => updateDeliveryCoverageZone(index, { mainCommune: event.target.value })} disabled={!zone.wilaya} className="w-full mt-1 px-3 py-2 rounded-xl text-sm outline-none disabled:opacity-50" style={{ border: `1px solid ${C.line}` }}><option value="">اختر البلدية</option>{getCommunes(zone.wilaya).map((commune) => <option key={commune} value={commune}>{commune}</option>)}</select></label></div>
                <div><p className="text-[11px] font-bold mb-1.5" style={{ color: C.inkSoft }}>البلديات المغطاة إضافة إلى البلدية الرئيسة</p><div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">{getCommunes(zone.wilaya).filter((commune) => commune !== zone.mainCommune).map((commune) => <button type="button" key={commune} onClick={() => toggleDeliveryCoverageCommune(index, commune)} className="px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: zone.coveredCommunes.includes(commune) ? C.teal : "#fff", color: zone.coveredCommunes.includes(commune) ? "#fff" : C.inkSoft, border: `1px solid ${zone.coveredCommunes.includes(commune) ? C.teal : C.line}` }}>{commune}</button>)}</div></div>
              </div>)}
              <button type="button" onClick={addDeliveryCoverageZone} className="text-xs font-bold px-3 py-2 rounded-xl" style={{ border: `1px dashed ${C.teal}`, color: C.teal }}>+ إضافة منطقة أخرى</button>
              <button type="button" onClick={saveDeliveryPreferences} disabled={savingDeliveryPreferences} className="w-full py-2.5 rounded-xl text-sm font-black disabled:opacity-50" style={{ background: C.teal, color: "#fff" }}>{savingDeliveryPreferences ? "جارٍ الحفظ…" : "حفظ إعدادات التوصيل"}</button>
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
  const deepLink = useMemo(() => buildPublicAppLink({ courier: courier.id }), [courier.id]);

  useEffect(() => {
    let active = true;
    void loadQrCode().then((QRCode) => QRCode.toDataURL(deepLink, { errorCorrectionLevel: "H", width: 560, margin: 2, color: { dark: C.ink, light: "#FFFFFF" } }))
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

  // يجب أن يُسجَّل هذا الـHook في كل عرض، بما في ذلك فترة تحميل ملف الموصل.
  // فالعودة المبكرة قبل useEffect كانت تغيّر عدد Hooks عند وصول بيانات الموصل لاحقاً.
  useEffect(() => {
    const handleBack = (event) => {
      if (editingHours) { setEditingHours(false); event.preventDefault(); return; }
      if (tab !== "available") { setTab("available"); event.preventDefault(); }
    };
    window.addEventListener("souq-jiran:back", handleBack);
    return () => window.removeEventListener("souq-jiran:back", handleBack);
  }, [editingHours, tab]);

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
              <div className="text-xs" style={{ color: C.inkSoft }}>{vehicleLabel(courier.vehicles || courier.vehicle)} · نطاقه: {courier.communes.join("، ") || (courier.wilaya + " — كل البلديات")}</div>
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
          <button data-testid="courier-vehicles-tab" onClick={() => setTab("vehicles")} className="px-4 py-1.5 rounded-full text-sm font-bold" style={{ background: tab === "vehicles" ? C.teal : "transparent", color: tab === "vehicles" ? "#fff" : C.inkSoft, border: `1px solid ${tab === "vehicles" ? C.teal : C.line}` }}>وسائلي والوثائق</button>
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
              <div className="text-xs mb-3" style={{ color: C.inkSoft }}>العميل: {o.customer}{o.customerPhone ? ` · ${o.customerPhone}` : ""} · {o.createdAt}</div>
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

      {tab === "vehicles" && <ProviderMediaManager providerId={courier.id} providerRole="courier" vehicles={courier.vehicles || courier.vehicle} accent={C.teal} title="وسائل توصيلك ووثائق الملكية" />}

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
function AdminView({ stores, orders, messages, couriers, merchantOffers = [], archiveAuditLogs = [], archiveNotifications = [], orderNotifications = [], archiveAlertSettings, testAccountCandidates = [], testAccountReviewAuditLogs = [], customerReports = [], customerBlacklist = [], deliveryPricing, referralAnalytics = { totalReferrals: 0, qualifiedReferrals: 0, awardedReferrals: 0, issuedCoupons: 0, redeemedCoupons: 0, redeemedValue: 0 }, notify, setProviderStatus, deleteOrderPermanently, deleteMessagePermanently, deleteTestAccount, markArchiveNotificationRead, markOrderNotificationRead, markAllOrderNotificationsRead, saveArchiveAlertSettings, setCustomerBlacklist, saveDeliveryPricing, reviewMerchantOffer }) {
  const pendingReview = stores.filter((s) => s.status === "pending_review");
  const awaitingProfile = stores.filter((s) => s.status === "awaiting_profile");
  const approved = stores.filter((s) => s.status === "approved");
  const revenue = orders.filter((o) => o.status === "delivered").reduce((a, o) => a + o.total, 0);
  const pendingCouriers = couriers.filter((c) => c.status === "pending");
  const pendingMerchantOffers = merchantOffers.filter((offer) => offer.status === "pending");
  const activeMerchantOffers = merchantOffers.filter((offer) => offer.status === "approved" && new Date(offer.endsAt).getTime() > Date.now());
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
  async function reviewOffer(offer, action) {
    const adminNote = window.prompt(action === "approved" ? "ملاحظة للإدارة أو للتاجر (اختيارية)" : "سبب القرار للتاجر (اختياري)") || "";
    const completed = await reviewMerchantOffer(offer.id, action, adminNote);
    if (completed) notify(action === "approved" ? "تم اعتماد عرض المتجر." : action === "paused" ? "تم إيقاف العرض." : "تم رفض العرض.");
  }

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

      <section className="p-4 sm:p-5 rounded-2xl space-y-4" style={{ background: "#fff", border: `1px solid ${C.line}` }} data-testid="admin-merchant-offers-panel">
        <div className="flex items-start justify-between gap-3 flex-wrap"><div><h3 className="font-black" style={{ color: C.ink }}>مراجعة عروض المتاجر</h3><p className="text-xs mt-1" style={{ color: C.inkSoft }}>العرض لا يظهر للشريحة العامة إلا إذا كان معتمداً وضمن نافذته الزمنية.</p></div><div className="flex gap-2 text-xs font-bold"><span className="px-2.5 py-1 rounded-full" style={{ background: C.ochre + "18", color: C.ochre }}>{pendingMerchantOffers.length} بانتظار القرار</span><span className="px-2.5 py-1 rounded-full" style={{ background: C.sage + "22", color: C.tealDark }}>{activeMerchantOffers.length} ظاهر حالياً</span></div></div>
        {merchantOffers.length === 0 && <p className="text-sm text-center py-6 rounded-xl" style={{ background: C.paperDark, color: C.inkSoft }}>لا توجد عروض متاجر متاحة للمراجعة بعد.</p>}
        <div className="space-y-2">{merchantOffers.map((offer) => <article key={offer.id} className="p-3.5 rounded-xl" style={{ border: `1px solid ${C.line}`, background: offer.status === "pending" ? C.ochre + "08" : "#fff" }}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold" style={{ color: C.teal }}>{offer.storeName}</p><h4 className="font-black text-sm mt-1" style={{ color: C.ink }}>{offer.title}</h4><p className="text-xs mt-1" style={{ color: C.inkSoft }}>{formatOfferValue(offer)} · يبدأ {new Date(offer.startsAt).toLocaleDateString("ar-DZ")} · {formatOfferEndsAt(offer.endsAt)}</p>{offer.description && <p className="text-xs leading-5 mt-1.5" style={{ color: C.inkSoft }}>{offer.description}</p>}{offer.adminNote && <p className="text-xs mt-2 p-2 rounded-lg" style={{ background: C.paperDark, color: C.inkSoft }}>آخر ملاحظة: {offer.adminNote}</p>}</div><span className="text-[11px] font-black px-2 py-1 rounded-full shrink-0" style={{ background: (offer.status === "approved" ? C.sage : offer.status === "rejected" ? C.rust : C.ochre) + "22", color: offer.status === "approved" ? C.tealDark : offer.status === "rejected" ? C.rust : C.ochre }}>{offer.status === "pending" ? "قيد المراجعة" : offer.status === "approved" ? "معتمد" : offer.status === "paused" ? "موقوف" : offer.status === "rejected" ? "مرفوض" : offer.status}</span></div><div className="mt-3 flex gap-2 flex-wrap">{offer.status === "pending" && <><button onClick={() => reviewOffer(offer, "approved")} className="text-xs px-3 py-1.5 rounded-full font-bold" style={{ background: C.teal, color: "#fff" }}>اعتماد</button><button onClick={() => reviewOffer(offer, "rejected")} className="text-xs px-3 py-1.5 rounded-full font-bold" style={{ border: `1px solid ${C.rust}66`, color: C.rust }}>رفض</button></>}{offer.status === "approved" && <button onClick={() => reviewOffer(offer, "paused")} className="text-xs px-3 py-1.5 rounded-full font-bold" style={{ border: `1px solid ${C.rust}66`, color: C.rust }}>إيقاف العرض</button>}</div></article>)}</div>
      </section>

      <section className="p-4 sm:p-5 rounded-2xl space-y-4" style={{ background: "#fff", border: `1px solid ${C.line}` }} data-testid="advanced-order-admin-panel">
        <div><h3 className="font-black" style={{ color: C.ink }}>ضبط جدية العملاء وتسعير التوصيل</h3><p className="text-xs mt-1" style={{ color: C.inkSoft }}>المبالغ التالية تستخدمها خدمة التسعير في الخادم؛ لا تُعدّل رسوم طلب قائم.</p></div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">{[["baseFee", "الرسم الأساسي"], ["feePerKm", "رسم الكيلومتر"], ["feePerKg", "رسم الكيلوغرام"], ["interwilayaSurcharge", "إضافة بين الولايات"], ["minimumFee", "الحد الأدنى"], ["averageSpeedKmh", "السرعة المتوسطة"]].map(([key, label]) => <label key={key} className="text-xs font-bold" style={{ color: C.inkSoft }}>{label}<input type="number" min="0" value={pricingDraft[key] ?? ""} onChange={(e) => setPricingDraft((draft) => ({ ...draft, [key]: Number(e.target.value) }))} className="mt-1 w-full px-2.5 py-2 rounded-lg outline-none" style={{ border: `1px solid ${C.line}`, color: C.ink }} /></label>)}</div>
        <button onClick={() => saveDeliveryPricing(pricingDraft)} className="text-xs px-3 py-2 rounded-xl font-black" style={{ background: C.purple, color: "#fff" }}>حفظ إعدادات التسعير</button>
        <div className="pt-3" style={{ borderTop: `1px solid ${C.line}` }}><h4 className="font-black text-sm" style={{ color: C.ink }}>بلاغات العملاء المفتوحة</h4><div className="space-y-2 mt-2">{customerReports.filter((report) => report.status === "open").map((report) => <div key={report.id} className="p-3 rounded-xl flex items-start justify-between gap-3" style={{ background: C.paperDark }}><div><p className="text-xs font-bold" style={{ color: C.ink }}>{report.reason}</p><p className="text-[11px] mt-1" style={{ color: C.inkSoft }}>طلب مرتبط: {report.relatedOrderId ? report.relatedOrderId.slice(0, 8) : "غير محدد"}</p></div><button onClick={() => setCustomerBlacklist(report.customerId, report.reason, true)} className="text-xs px-2.5 py-1.5 rounded-lg font-bold shrink-0" style={{ background: C.rust, color: "#fff" }}>حظر الحساب</button></div>)}{customerReports.filter((report) => report.status === "open").length === 0 && <p className="text-xs py-2" style={{ color: C.inkSoft }}>لا توجد بلاغات مفتوحة.</p>}</div></div>
        <div className="pt-3" style={{ borderTop: `1px solid ${C.line}` }}><h4 className="font-black text-sm" style={{ color: C.ink }}>الحسابات المحظورة</h4><div className="space-y-2 mt-2">{customerBlacklist.filter((entry) => !entry.revokedAt).map((entry) => <div key={entry.customerId} className="p-3 rounded-xl flex items-center justify-between gap-3" style={{ background: C.rust + "10" }}><div><p className="text-xs font-bold" style={{ color: C.ink }}>{entry.reason}</p><p className="text-[11px] mt-1" style={{ color: C.inkSoft }}>معرّف العميل: {entry.customerId.slice(0, 8)}</p></div><button onClick={() => setCustomerBlacklist(entry.customerId, entry.reason, false)} className="text-xs px-2.5 py-1.5 rounded-lg font-bold" style={{ border: `1px solid ${C.rust}`, color: C.rust }}>رفع الحظر</button></div>)}{customerBlacklist.filter((entry) => !entry.revokedAt).length === 0 && <p className="text-xs py-2" style={{ color: C.inkSoft }}>لا توجد حسابات محظورة حالياً.</p>}</div></div>
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
          {pendingCouriers.map((c) => (<div key={c.id} className="p-3 rounded-2xl flex items-center justify-between flex-wrap gap-2" style={{ background: "#fff", border: `1px solid ${C.line}` }}><div><div className="font-bold text-sm" style={{ color: C.ink }}>{c.name}</div><div className="text-xs" style={{ color: C.inkSoft }}>{vehicleLabel(c.vehicles || c.vehicle)} · {c.wilaya} ({c.communes.join("، ") || c.wilaya + " — كل البلديات"}) · {c.phone}</div><div className="text-xs" style={{ color: C.inkSoft }}>الأوقات: {c.timeLabel || c.availability.map((a) => AVAILABILITY_SLOTS.find((s) => s.id === a)?.label).join(" / ") || "—"} · {c.storeMode === "all" ? "كل المحلات" : `${(c.selectedStoreIds || []).length} محل محدد`}</div></div><div className="flex gap-2"><button onClick={() => rejectCourier(c.id)} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: "#8B3A2A20", color: "#8B3A2A" }}><X size={13} /> رفض</button><button onClick={() => approveCourier(c.id)} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: C.teal, color: "#fff" }}><Check size={13} /> موافقة</button></div></div>))}
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
  legacyCart: { key: "souq-jiran:cart:v4", shared: false },
  myStoreId: { key: "souq-jiran:my-store-id:v4", shared: false },
  notifications: { key: "souq-jiran:notifications:v4", shared: false },
};
const createOrderDraft = (storeId, id = `draft-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`) => ({ id, storeId, items: [], address: null, deliveryChoice: "pickup", deliveryQuote: null, rewardCoupon: null });
const emptyCart = () => ({ drafts: [] });
const normalizeCartDrafts = (savedCart) => {
  if (Array.isArray(savedCart?.drafts)) return { drafts: savedCart.drafts.filter((draft) => draft?.id && draft?.storeId && Array.isArray(draft.items)).map((draft) => ({ ...createOrderDraft(draft.storeId, draft.id), ...draft, items: draft.items })) };
  if (savedCart?.storeId && Array.isArray(savedCart.items) && savedCart.items.length > 0) {
    return { drafts: [{ ...createOrderDraft(savedCart.storeId, `migrated-${savedCart.storeId}`), items: savedCart.items, address: savedCart.address || null }] };
  }
  return emptyCart();
};
const customerCartStorage = (customerId) => ({ key: `souq-jiran:cart:v5:${customerId}`, shared: false });
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
async function clearKey(storageKey, replacement) {
  try {
    if (window.storage?.delete) await window.storage.delete(storageKey.key, storageKey.shared);
    else if (window.storage?.set) await window.storage.set(storageKey.key, JSON.stringify(replacement), storageKey.shared);
    else window.localStorage.removeItem(storageKey.key);
  } catch (e) { console.error("تعذّر مسح البيانات:", e); }
}

/* ===========================================================
   صفحة تعريف الانضمام
=========================================================== */
function RoleBenefitsPage({ onBack, onMerchant, onCourier, language = "ar" }) {
  const roles = [
    { id: "merchant", icon: Store, accent: C.rust, label: uiText(language, "merchantFor"), title: uiText(language, "merchantTitle"), description: uiText(language, "merchantGuide"), benefits: [uiText(language, "merchantBenefit1"), uiText(language, "merchantBenefit2"), uiText(language, "merchantBenefit3")], action: uiText(language, "startMerchant"), onClick: onMerchant },
    { id: "courier", icon: Bike, accent: C.teal, label: uiText(language, "courierFor"), title: uiText(language, "courierTitle"), description: uiText(language, "courierGuide"), benefits: [uiText(language, "courierBenefit1"), uiText(language, "courierBenefit2"), uiText(language, "courierBenefit3")], action: uiText(language, "startCourier"), onClick: onCourier },
  ];

  return (
    <section className="space-y-5" data-testid="role-benefits-page">
      <div className="p-5 sm:p-7 rounded-[28px]" style={{ background: `linear-gradient(125deg, ${C.teal}, ${C.purple})`, color: "#fff", boxShadow: `0 20px 45px ${C.teal}30` }}>
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-bold mb-5 opacity-90 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 rounded-md"><ChevronRight size={15} /> {uiText(language, "backShopping")}</button>
        <span className="text-[11px] font-black px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,.14)" }}>{uiText(language, "clearPath")}</span>
        <h1 className="font-black text-2xl mt-3 tracking-tight">{uiText(language, "joinNetwork")}</h1>
        <p className="text-sm leading-6 mt-2 max-w-2xl" style={{ color: "rgba(255,255,255,.82)" }}>{uiText(language, "roleGuideDescription")}</p>
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
  const deliveryLocationText = typeof order.deliveryLocation === "string"
    ? order.deliveryLocation
    : [order.deliveryLocation?.label, order.deliveryLocation?.commune, order.deliveryLocation?.wilaya].filter(Boolean).join("، ");
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-5" style={{ background: "rgba(23,32,51,.44)" }} onClick={onClose} data-testid="order-notification-details">
      <section className="w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] p-5 sm:p-6" style={{ background: "#fff", boxShadow: "0 24px 60px rgba(23,32,51,.24)" }} onClick={(event) => event.stopPropagation()} aria-label="تفاصيل الطلب من الإشعار">
        <div className="flex items-start justify-between gap-4"><div><span className="text-[11px] font-black px-2.5 py-1 rounded-full" style={{ background: status.color + "18", color: status.color }}>تحديث فوري</span><h2 className="font-black text-xl mt-3" style={{ color: C.ink }}>تفاصيل الطلب</h2><p className="text-xs mt-1" style={{ color: C.inkSoft }}>رقم الطلب: {String(order.id).slice(0, 8)} · {order.storeName}</p></div><button onClick={onClose} className="p-2 rounded-xl" style={{ background: C.paper, color: C.inkSoft }} aria-label="إغلاق"><X size={18} /></button></div>
        <div className="mt-5 p-4 rounded-2xl" style={{ background: status.color + "10", border: `1px solid ${status.color}2A` }}><div className="font-black" style={{ color: status.color }}>{status.label}</div><p className="text-xs mt-1.5 leading-5" style={{ color: C.inkSoft }}>{order.estimatedDeliveryMinutes ? `الزمن التقديري للتسليم: ${order.estimatedDeliveryMinutes} دقيقة.` : "ستظهر تحديثات التوصيل الجديدة هنا فور وصولها."}</p></div>
        <div className="mt-5 space-y-2">{order.items.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 text-sm p-3 rounded-xl" style={{ background: C.paper }}><span className="font-bold" style={{ color: C.ink }}>{item.name} × {item.qty}</span><span style={{ color: C.inkSoft }}>{money(item.price * item.qty)}</span></div>)}</div>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm"><div className="p-3 rounded-xl" style={{ border: `1px solid ${C.line}` }}><div className="text-[11px] font-bold" style={{ color: C.inkSoft }}>الإجمالي</div><div className="font-black mt-1" style={{ color: C.ink }}>{money(order.total)}</div></div><div className="p-3 rounded-xl" style={{ border: `1px solid ${C.line}` }}><div className="text-[11px] font-bold" style={{ color: C.inkSoft }}>التوصيل</div><div className="font-black mt-1" style={{ color: C.ink }}>{money(order.deliveryFee)}</div></div></div>
        {deliveryLocationText && <div className="mt-4 flex items-start gap-2 text-xs leading-5 p-3 rounded-xl" style={{ background: C.paper, color: C.inkSoft }}><MapPin size={15} color={C.teal} className="shrink-0 mt-0.5" />{deliveryLocationText}</div>}
      </section>
    </div>
  );
}

export default function App() {
  const [role, setRole] = useState("customer");
  const [language, setLanguage] = useState(() => {
    try { return localStorage.getItem("souq-jiran:language") === "fr" ? "fr" : "ar"; } catch { return "ar"; }
  });
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
  const publicQrDestination = useMemo(() => readPublicQrDestination(), []);
  const [referralCode, setReferralCode] = useState("");
  const [pendingReferralCode, setPendingReferralCode] = useState(() => publicQrDestination.referralCode);
  const [rewardCoupons, setRewardCoupons] = useState([]);
  const [merchantOffers, setMerchantOffers] = useState([]);
  const [referralAnalytics, setReferralAnalytics] = useState({ totalReferrals: 0, qualifiedReferrals: 0, awardedReferrals: 0, issuedCoupons: 0, redeemedCoupons: 0, redeemedValue: 0 });
  const [archiveAlertSettings, setArchiveAlertSettings] = useState({ sensitiveOrderTotal: 5000, sensitiveStatuses: ["ready", "delivering", "delivered"], notifyOnMessageArchive: false });
  const [couriers, setCouriers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [auth, setAuth] = useState(null);
  const [cart, setCart] = useState(() => emptyCart());
  const [myStoreId, setMyStoreId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCourierForm, setShowCourierForm] = useState(false);
  const [showMerchantForm, setShowMerchantForm] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [pendingProviderRegistration, setPendingProviderRegistration] = useState(null);
  const [authEntry, setAuthEntry] = useState({ type: "merchant", mode: "login" });
  const [showPhoneChange, setShowPhoneChange] = useState(false);
  const [adminLoginRequested, setAdminLoginRequested] = useState(false);
  const [showRoleGuide, setShowRoleGuide] = useState(false);
  const [isAppGateway, setIsAppGateway] = useState(true);
  const [focusedOrderId, setFocusedOrderId] = useState(null);
  const [isResolvingMerchantStore, setIsResolvingMerchantStore] = useState(false);
  const prevOrdersRef = useRef(null);
  const sessionHydrationRef = useRef(0);
  const cartOwnerRef = useRef(null);
  const cartHydratedRef = useRef(false);
  const cartStorageEpochRef = useRef(0);
  const cartStorageQueueRef = useRef(Promise.resolve());

  const focusedOrder = useMemo(() => orders.find((order) => order.id === focusedOrderId) || null, [orders, focusedOrderId]);

  function openAppGateway() {
    setFocusedOrderId(null);
    setShowPhoneChange(false);
    setShowAuth(false);
    setAdminLoginRequested(false);
    setPendingProviderRegistration(null);
    setShowCourierForm(false);
    setShowMerchantForm(false);
    setShowRoleGuide(false);
    setRole("customer");
    setIsAppGateway(true);
  }

  function handleAppBack({ canGoBack = false, allowExit = false } = {}) {
    // Global overlays always take precedence over navigation inside a role view.
    if (focusedOrderId) { setFocusedOrderId(null); return true; }
    if (showPhoneChange) { setShowPhoneChange(false); return true; }
    if (showAuth) { setShowAuth(false); setAdminLoginRequested(false); return true; }
    if (pendingProviderRegistration) { setPendingProviderRegistration(null); return true; }
    if (showCourierForm) { setShowCourierForm(false); return true; }
    if (showMerchantForm) { setShowMerchantForm(false); return true; }
    if (showRoleGuide) { setShowRoleGuide(false); return true; }

    const nestedBack = new Event("souq-jiran:back", { cancelable: true });
    window.dispatchEvent(nestedBack);
    if (nestedBack.defaultPrevented) return true;

    if (!isAppGateway) {
      openAppGateway();
      return true;
    }

    if (canGoBack && window.history.length > 1) {
      window.history.back();
      return true;
    }
    if (allowExit) {
      void CapacitorApp.exitApp();
      return true;
    }
    notify(language === "fr" ? "Vous êtes déjà sur l’écran principal." : "أنت بالفعل في الصفحة الرئيسية.");
    return false;
  }

  useEffect(() => {
    let listenerHandle;
    let active = true;
    void CapacitorApp.addListener("backButton", ({ canGoBack }) => {
      if (active) handleAppBack({ canGoBack, allowExit: !canGoBack && isAppGateway });
    }).then((handle) => {
      if (active) listenerHandle = handle;
      else void handle.remove();
    }).catch(() => {
      // The browser preview does not need a native back-button listener.
    });
    return () => {
      active = false;
      if (listenerHandle) void listenerHandle.remove();
    };
  }, [focusedOrderId, isAppGateway, language, pendingProviderRegistration, showAuth, showCourierForm, showMerchantForm, showPhoneChange, showRoleGuide]);

  useEffect(() => {
    try { localStorage.setItem("souq-jiran:language", language); } catch { /* preference storage is optional */ }
    document.documentElement.lang = language;
    document.documentElement.dir = language === "fr" ? "ltr" : "rtl";
  }, [language]);

  function notify(msg) { setToast(msg); setTimeout(() => setToast(""), 2400); }
  function pushNotification(message) { setNotifications((prev) => { const next = [{ id: "n" + Math.random().toString(36).slice(2, 7), message, time: new Date().toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" }), read: false }, ...prev].slice(0, 25); saveKey(STORAGE.notifications, next); return next; }); }
  function markAllRead() { setNotifications((prev) => { const next = prev.map((n) => ({ ...n, read: true })); saveKey(STORAGE.notifications, next); return next; }); }
  useEffect(() => {
    let cancelled = false;
    // لا نطلب إذن FCM قبل وجود جلسة Supabase؛ الرمز لا يجوز ربطه بحساب
    // مجهول، كما أن Android قد يرفض الطلب المبكر داخل WebView.
    (async () => {
      const [, loadedNotifications] = await Promise.all([
        clearKey(STORAGE.legacyCart, emptyCart()), loadKey(STORAGE.notifications, []),
      ]);
      if (cancelled) return;
      setStores([]); setOrders([]); setMessages([]); setArchiveAuditLogs([]); setArchiveNotifications([]); setAdminOrderNotifications([]); setTestAccountCandidates([]); setTestAccountReviewAuditLogs([]); setCustomerReports([]); setCustomerBlacklist([]); setDeliveryPricing(null); setCouriers([]);
      setAccounts([]); setAuth(null); setReferralCode(""); setRewardCoupons([]); setMerchantOffers([]); setReferralAnalytics({ totalReferrals: 0, qualifiedReferrals: 0, awardedReferrals: 0, issuedCoupons: 0, redeemedCoupons: 0, redeemedValue: 0 });
      // معرّف المتجر يُشتق دائماً من جلسة Supabase الحالية. لا نعيد استعمال قيمة
      // محلية قديمة كي لا تُعرض لوحة تاجر قبل التأكد من الحساب الحالي.
      setCart(emptyCart()); setMyStoreId(null); setNotifications(loadedNotifications);
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
    const email = metadata.contact_email || user.email || "";
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

  function queueCartStorage(operation) {
    const queuedOperation = cartStorageQueueRef.current
      .catch(() => undefined)
      .then(operation);
    cartStorageQueueRef.current = queuedOperation;
    return queuedOperation;
  }

  function resetCartForSession() {
    // This must be synchronous: do not render the preceding user's cart while
    // Supabase, window.storage, or profile resolution is still in flight.
    // The next generation invalidates every queued write made by the old owner.
    cartStorageEpochRef.current += 1;
    cartOwnerRef.current = null;
    cartHydratedRef.current = false;
    setCart(emptyCart());
  }

  async function clearCartForSession(ownerId = cartOwnerRef.current) {
    resetCartForSession();
    const targets = [STORAGE.legacyCart];
    if (ownerId) targets.push(customerCartStorage(ownerId));
    await queueCartStorage(() => Promise.all(targets.map((target) => clearKey(target, emptyCart()))));
  }

  async function applySupabaseSession(session) {
    const hydrationId = ++sessionHydrationRef.current;
    const incomingUserId = session?.user?.id || null;
    const previousCartOwnerId = cartOwnerRef.current;
    // Every auth event starts from an empty, unowned cart. This invalidates any
    // delayed load/write belonging to the prior session before the first await.
    if (cartOwnerRef.current !== incomingUserId || !cartHydratedRef.current) resetCartForSession();
    if (!session?.user) {
      if (previousCartOwnerId) void clearCartForSession(previousCartOwnerId);
      setIsResolvingMerchantStore(false);
      setAuth(null);
      setMyStoreId(null);
      setRole("customer");
      setIsAppGateway(true);
      setOrders([]); setMessages([]); setArchiveAuditLogs([]); setArchiveNotifications([]); setAdminOrderNotifications([]); setTestAccountCandidates([]); setTestAccountReviewAuditLogs([]); setCustomerReports([]); setCustomerBlacklist([]); setDeliveryPricing(null); setCouriers([]); setReferralCode(""); setRewardCoupons([]); setMerchantOffers([]); setReferralAnalytics({ totalReferrals: 0, qualifiedReferrals: 0, awardedReferrals: 0, issuedCoupons: 0, redeemedCoupons: 0 });
      // تبقى الصفحة الرئيسية متاحة للزائر: سياسة RLS تسمح بقراءة المحلات المعتمدة
      // فقط، لذا لا ينبغي لمسح القائمة عند عدم وجود جلسة تسجيل دخول.
      await refreshSupabaseData("public");
      return;
    }
    if (previousCartOwnerId && previousCartOwnerId !== incomingUserId) {
      // Handles a direct Supabase session replacement that bypasses signOut().
      // The queued clear runs after any old write already in progress.
      void clearCartForSession(previousCartOwnerId);
    }
    setIsResolvingMerchantStore(true);
    const nextAuth = await resolveSupabaseUser(session.user);
    if (hydrationId !== sessionHydrationRef.current) return;
    const isCustomer = nextAuth.type === "customer";
    const nextCart = isCustomer ? normalizeCartDrafts(await loadKey(customerCartStorage(nextAuth.id), emptyCart())) : emptyCart();
    if (hydrationId !== sessionHydrationRef.current) return;
    if (isCustomer) {
      cartOwnerRef.current = nextAuth.id;
      cartHydratedRef.current = true;
    }
    setAuth(nextAuth);
    setRole(nextAuth.type);
    setIsAppGateway(false);
    setCart(nextCart);
    if (nextAuth.type === "merchant") setMyStoreId(nextAuth.id);
    else setMyStoreId(null);
    await refreshSupabaseData(nextAuth.type);
    if (hydrationId === sessionHydrationRef.current) setIsResolvingMerchantStore(false);
  }

  async function syncNativeFcmToken(profileId, suppliedToken) {
    try {
    const token = suppliedToken || await (await loadFirebaseHelpers()).requestNativeFcmToken();
      if (!token || !profileId) return;
      const { error } = await supabase.rpc("update_my_fcm_token", { p_token: token });
      if (error && error.code !== "42883") console.warn("تعذر حفظ رمز FCM:", error.message);
    } catch (fcmError) {
      // Notification permission is voluntary and must not interrupt auth.
      console.warn("تعذر تهيئة إشعارات Firebase:", fcmError);
    }
  }

  async function refreshSupabaseData(activeRole = auth?.type) {
    const [merchantsResult, productsResult, couriersResult, ordersResult, itemsResult, messagesResult, auditResult, archiveNotificationsResult, orderNotificationsResult, alertSettingsResult, customerReportsResult, customerBlacklistResult, pricingResult, referralCodeResult, rewardCouponsResult, adminReferralsResult, adminRewardCouponsResult, merchantOffersResult, orderContactsResult] = await Promise.all([
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
      supabase.from("merchant_store_offers").select("*").order("created_at", { ascending: false }),
      // اسم وهاتف الزبون الحقيقيان — فقط للتاجر/الموصل/المشرف، ومحصورة بطلباتهم فعلياً عبر RLS داخل الدالة نفسها.
      activeRole === "customer" ? Promise.resolve({ data: [] }) : supabase.rpc("get_my_order_contacts"),
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
    const contactsByOrder = Object.fromEntries((orderContactsResult?.data || []).map((c) => [c.order_id, c]));
    setStores(merchantRows.map((merchant) => ({
      id: merchant.id, name: merchant.store_name, phone: merchant.phone || "", wilaya: merchant.wilaya || "", commune: merchant.commune || "", open: merchant.opening_hour ?? 8, close: merchant.closing_hour ?? 21,
      latitude: merchant.latitude ?? null, longitude: merchant.longitude ?? null, addressLabel: merchant.address_label || "",
      status: merchant.status, deliveryCommunes: merchant.delivery_communes || [], approvedCourierIds: merchant.approved_courier_ids || [],
      hasOwnDelivery: merchant.has_own_delivery ?? true, platformDeliveryEnabled: merchant.platform_delivery_enabled ?? true, deliveryFee: merchant.delivery_fee || 0, deliveryCoverageZones: merchant.delivery_coverage_zones || [], minOrder: merchant.min_order || 0,
      products: (productsByMerchant[merchant.id] || []).map((product) => ({ id: product.id, name: product.name, price: product.price, unit: product.unit, department: product.department, available: product.available })),
      logo: { text: merchant.store_name.slice(0, 2), color: C.teal }, reviews: [], commissionType: "percentage", commissionRate: 0, subscriptionFee: 0, duesPaid: 0,
    })));
    if (merchantOffersResult.error?.code === "42P01") {
      setMerchantOffers([]);
    } else if (!merchantOffersResult.error) {
      setMerchantOffers((merchantOffersResult.data || []).map((offer) => ({
        id: offer.id,
        merchantId: offer.merchant_id,
        storeName: storesById[offer.merchant_id]?.store_name || "متجر معتمد",
        title: offer.title,
        description: offer.description || "",
        discountType: offer.discount_type,
        discountValue: Number(offer.discount_value || 0),
        startsAt: offer.starts_at,
        endsAt: offer.ends_at,
        status: offer.status,
        adminNote: offer.admin_note || "",
        createdAt: offer.created_at,
        reviewedAt: offer.reviewed_at,
      })));
    }
    setCouriers(courierRows.map((courier) => ({
      id: courier.id, name: "موصل", phone: "", vehicle: courier.vehicle || "", vehicles: normalizeCourierVehicles(courier.vehicles?.length ? courier.vehicles : courier.vehicle), wilaya: courier.wilaya || "", communes: courier.communes || [],
      availability: courier.availability || [], storeMode: courier.store_mode || "all", selectedStoreIds: courier.selected_store_ids || [], status: courier.status,
    })));
    setOrders((ordersResult.data || []).map((order) => ({
      id: order.id, storeId: order.merchant_id, storeName: storesById[order.merchant_id]?.store_name || "محل الحي", customerId: order.customer_id,
      customer: order.customer_id === auth?.id ? "أنت" : (contactsByOrder[order.id]?.name || "عميل"),
      customerPhone: contactsByOrder[order.id]?.phone || "",
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
    let active = true;
    let listener;
    const profileId = auth.id;

    const bootstrapFcm = async () => {
      try {
        const { listenForNativeFcmToken } = await loadFirebaseHelpers();
        if (!active) return;
        // Attach the rotation listener before the initial getToken call so a
        // newly-created or refreshed Android token cannot be missed.
        listener = await listenForNativeFcmToken((token) => {
          if (active) void syncNativeFcmToken(profileId, token);
        });
        if (!active) {
          await listener?.remove();
          listener = undefined;
          return;
        }
        await syncNativeFcmToken(profileId);
      } catch (error) {
        // FCM is optional and must never block a logged-in customer/merchant.
        console.warn("تعذر تهيئة مزامنة FCM بعد تسجيل الدخول:", error);
      }
    };

    void bootstrapFcm();
    return () => {
      active = false;
      void listener?.remove();
    };
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
    void loadFirebaseHelpers()
      .then(({ listenForNativeOrderNotifications }) => listenForNativeOrderNotifications(
        (notification) => {
          const heading = notification.title || "تحديث جديد على الطلب";
          const body = notification.body || "اضغط على التنبيه لمراجعة تفاصيل الطلب.";
          pushNotification(`${heading}: ${body}`);
          notify(heading);
          void refreshSupabaseData(auth.type);
        },
        (notification) => { void openOrderFromPush(notification.data); },
      ))
      .then((handle) => { listener = handle; });
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
  function persistentSetCart(updater, expectedOwnerId = cartOwnerRef.current) {
    setCart((prev) => {
      if (!expectedOwnerId || !cartHydratedRef.current || cartOwnerRef.current !== expectedOwnerId) return prev;
      const next = typeof updater === "function" ? updater(prev) : updater;
      const writeEpoch = cartStorageEpochRef.current;
      void queueCartStorage(async () => {
        if (writeEpoch !== cartStorageEpochRef.current || !cartHydratedRef.current || cartOwnerRef.current !== expectedOwnerId) return;
        await saveKey(customerCartStorage(expectedOwnerId), next);
      });
      return next;
    });
  }
  function persistentSetMyStoreId(id) { setMyStoreId(id); saveKey(STORAGE.myStoreId, id); }

  async function placeOrder(store, items, _promo, _discountAmount = 0, address = null, deliveryType = "pickup", deliveryFee = 0, rewardCouponCode = null) {
    if (!auth || auth.type !== "customer") { notify("سجّل الدخول كعميل لإرسال طلبك."); return false; }
    if (!store || !Array.isArray(items) || items.length === 0) return false;

    const { data, error } = await supabase.rpc("create_customer_order", {
      p_merchant_id: store.id,
      p_items: items.map((item) => ({ product_id: item.id, qty: item.qty })),
      p_delivery_choice: deliveryType,
      p_delivery_address: deliveryType === "pickup" ? {} : address,
      p_delivery_fee: Number(deliveryFee || 0),
    });
    if (error) { notify("تعذر إرسال الطلب: " + error.message); return false; }
    const createdOrder = Array.isArray(data) ? data[0] : data;
    if (!createdOrder?.id) { notify("تعذر تأكيد إنشاء الطلب. لم تُحذف المسودة، حاول مرة أخرى."); return false; }
    const confirmedOrder = {
      id: createdOrder.id, storeId: createdOrder.merchant_id || store.id, storeName: stores.find((candidate) => candidate.id === (createdOrder.merchant_id || store.id))?.name || store.name || "محل الحي", customerId: createdOrder.customer_id || auth.id, customer: "أنت",
      items: items.map((item) => ({ ...item })), subtotal: Number(createdOrder.subtotal ?? items.reduce((sum, item) => sum + item.price * item.qty, 0)), deliveryFee: Number(createdOrder.delivery_fee ?? 0), total: Number(createdOrder.total ?? 0), status: createdOrder.status || "pending", deliveryLocation: createdOrder.delivery_address || address,
      isInterwilaya: Boolean(createdOrder.is_interwilaya), deliveryDistanceKm: Number(createdOrder.delivery_distance_km || 0), estimatedDeliveryMinutes: createdOrder.estimated_delivery_minutes, requiresPhoneVerification: Boolean(createdOrder.requires_phone_verification), originWilaya: createdOrder.origin_wilaya, destinationWilaya: createdOrder.destination_wilaya, deliveryType: createdOrder.delivery_choice || deliveryType, courier: null, rated: false, confirmed: false,
      createdAt: createdOrder.created_at ? new Date(createdOrder.created_at).toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit" }) : "الآن",
    };
    persistentSetOrders((previousOrders) => [confirmedOrder, ...previousOrders.filter((order) => order.id !== confirmedOrder.id)]);
    if (rewardCouponCode) {
      const { error: couponError } = await supabase.rpc("redeem_reward_coupon", { p_order_id: createdOrder.id, p_coupon_code: rewardCouponCode });
      if (couponError) notify("تم إنشاء الطلب، لكن لم تُطبّق القسيمة: " + couponError.message);
      else notify(`تم تطبيق قسيمة المكافأة ${rewardCouponCode} على طلبك.`);
    }
    try { await refreshSupabaseData("customer"); } catch (refreshError) { console.warn("تعذر تحديث الطلبات بعد الإنشاء:", refreshError); }
    persistentSetOrders((previousOrders) => previousOrders.some((order) => order.id === confirmedOrder.id) ? previousOrders : [confirmedOrder, ...previousOrders]);
    notify(`تم تأكيد طلبك رقم #${String(createdOrder.id).slice(0, 8)} — الدفع نقداً عند الاستلام`);
    return true;
  }

  async function claimCustomerReferral(code, silent = false) {
    if (!auth || auth.type !== "customer") { if (!silent) notify("سجّل الدخول كعميل لاستخدام كود الدعوة."); return false; }
    const normalized = String(code || "").trim().toUpperCase();
    if (!normalized) { if (!silent) notify("أدخل كود دعوة صحيحاً."); return false; }
    const { error } = await supabase.rpc("claim_customer_referral", { p_referral_code: normalized });
    if (error) { if (!silent) notify(error.message?.includes("EMAIL_OTP_VERIFICATION_REQUIRED") ? "أكّد بريدك الإلكتروني عبر الرمز أولاً، ثم أعد المحاولة." : "تعذر تفعيل الدعوة: " + error.message); return false; }
    await refreshSupabaseData("customer");
    if (!silent) notify("تم تفعيل الدعوة بنجاح.");
    return true;
  }

  async function submitMerchantOffer(offer) {
    if (auth?.type !== "merchant" || auth.id !== offer.merchantId) { notify("لا تملك صلاحية تقديم عرض لهذا المتجر."); return false; }
    const startsAt = new Date(offer.startsAt);
    const endsAt = new Date(offer.endsAt);
    const discountValue = Number(offer.discountValue);
    if (!offer.title?.trim() || !Number.isFinite(discountValue) || discountValue <= 0 || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) { notify("تحقق من عنوان العرض وقيمته وتاريخي البداية والنهاية."); return false; }
    const { error } = await supabase.rpc("merchant_save_store_offer", {
      p_offer_id: offer.id || null,
      p_title: offer.title.trim(),
      p_description: offer.description?.trim() || null,
      p_discount_type: offer.discountType,
      p_discount_value: discountValue,
      p_starts_at: startsAt.toISOString(),
      p_ends_at: endsAt.toISOString(),
      p_submit: true,
    });
    if (error) { notify(error.code === "42883" ? "يلزم تشغيل ترحيل عروض المتاجر أولاً." : `تعذر حفظ العرض: ${error.message}`); return false; }
    await refreshSupabaseData("merchant");
    return true;
  }

  async function pauseMerchantOffer(offer) {
    if (auth?.type !== "merchant" || auth.id !== offer.merchantId) { notify("لا تملك صلاحية إيقاف هذا العرض."); return false; }
    const { error } = await supabase.rpc("merchant_pause_store_offer", { p_offer_id: offer.id });
    if (error) { notify(`تعذر إيقاف العرض: ${error.message}`); return false; }
    await refreshSupabaseData("merchant");
    return true;
  }

  async function reviewMerchantOffer(offerId, action, adminNote = "") {
    if (auth?.type !== "admin") { notify("هذه العملية متاحة للإدارة فقط."); return false; }
    const { error } = await supabase.rpc("admin_review_store_offer", { p_offer_id: offerId, p_status: action, p_admin_note: adminNote || null });
    if (error) { notify(`تعذر تحديث حالة العرض: ${error.message}`); return false; }
    await refreshSupabaseData("admin");
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

  async function runLifecycleAction(orderId, rpcName, successMessage) {
    const { error } = await supabase.rpc(rpcName, { p_order_id: orderId });
    if (error) { notify("تعذر تحديث مرحلة الطلب: " + error.message); return false; }
    await refreshSupabaseData();
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

  async function ensureSupabaseProfile({ user, role: profileRole, name, phone, wilaya = "", commune = "", addressLabel = "", latitude = null, longitude = null }) {
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
      wilaya: wilaya || null,
      commune: commune || null,
      address_label: addressLabel || null,
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null,
    });
    if (error) return { error: "تعذر إنشاء ملف المستخدم. طبّق ملف supabase/schema.sql ثم سجّل الدخول لإكمال ملفك." };
    return {};
  }

  async function ensureCourierReviewRequest(userId) {
    if (!userId) return { error: "تعذر تحديد حساب الموصل الجديد." };
    const { error } = await supabase.from("couriers").upsert({
      id: userId,
      vehicle: "",
      vehicles: [],
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

  async function authenticate({ mode, type, identifier, name = "", phone = "", wilaya = "", commune = "", addressLabel = "", latitude = null, longitude = null, verifiedSession = null }) {
    const credential = parseLoginIdentifier(identifier);
    if (!credential?.email) return { error: "التحقق والدخول متاحان عبر بريد إلكتروني صالح فقط." };
    if (!verifiedSession?.user || verifiedSession.user.email?.toLowerCase() !== credential.email.toLowerCase()) {
      return { error: "انتهت جلسة التحقق أو لا تطابق البريد المدخل. اطلب رمزاً جديداً." };
    }
    if (mode === "register" && type === "admin") return { error: "إنشاء حسابات المشرفين متاح فقط عبر قاعدة البيانات." };
    if (mode === "register") {
      const normalizedPhone = normalizeAlgerianMobile(phone);
      if (type === "customer" && (!credential.email || !name.trim() || !normalizedPhone)) return { error: "الاسم والبريد الإلكتروني ورقم الهاتف حقول مطلوبة لإنشاء حساب العميل." };
      const accountName = name.trim() || credential.email?.split("@")[0] || credential.phone;
      const accountPhone = normalizedPhone || credential.phone || "";
      const signedIn = await resolveSupabaseUser(verifiedSession.user);
      if (signedIn.type && signedIn.type !== type) {
        await clearCartForSession(signedIn.type === "customer" ? signedIn.id : cartOwnerRef.current);
        await supabase.auth.signOut();
        return { error: "هذا البريد مرتبط بدور مختلف. اختر بوابة الحساب الصحيحة أو استخدم بريداً جديداً." };
      }
      await applySupabaseSession(verifiedSession);
      const profile = await ensureSupabaseProfile({ user: verifiedSession.user, role: type, name: accountName, phone: accountPhone, wilaya, commune, addressLabel, latitude, longitude });
      if (profile.error) return profile;
      if (type === "courier") {
        const courierRequest = await ensureCourierReviewRequest(verifiedSession.user.id);
        if (courierRequest.error) return courierRequest;
      }
      notify(type === "courier"
        ? "تم إنشاء حساب الموصل وإرسال طلبه إلى لوحة الإدارة للمراجعة."
        : "تم إنشاء الحساب والتحقق من بريدك الإلكتروني بنجاح.");
      return {};
    }
    const signedIn = await resolveSupabaseUser(verifiedSession.user);
    if (signedIn.type !== type) {
      await clearCartForSession(signedIn.type === "customer" ? signedIn.id : cartOwnerRef.current);
      await supabase.auth.signOut();
      return { error: "نوع الحساب لا يطابق البوابة المحددة. اختر بوابة حسابك الصحيحة." };
    }
    await applySupabaseSession(verifiedSession);
    if (signedIn.profileUnavailable) notify("تم الدخول. أكمل تطبيق ملف الترحيل في Supabase لتفعيل ملفات الأدوار.");
    return {};
  }

  async function requestAccountRecovery({ identifier }) {
    const credential = parseLoginIdentifier(identifier);
    if (!credential || credential.kind !== "email") return { error: "أدخل البريد الإلكتروني المرتبط بحسابك لإرسال رمز دخول جديد." };
    const { error } = await supabase.auth.signInWithOtp({
      email: credential.email,
      options: { shouldCreateUser: false },
    });
    if (error) return { error: "تعذر إرسال رمز الدخول. تحقق من البريد وحاول لاحقاً." };
    return { notice: "إذا كان البريد مسجلاً، أُرسل رمز دخول جديد إليه. أدخله في نافذة الدخول لإكمال التحقق." };
  }

  async function confirmPhoneChange({ phone }) {
    if (!auth?.id) return { error: "سجّل الدخول أولاً لتغيير رقم الهاتف." };
    const normalizedPhone = normalizeAlgerianMobile(phone);
    if (!normalizedPhone) return { error: "أدخل رقم هاتف محمول جزائرياً صحيحاً." };
    const { error: profileError } = await supabase.from("profiles").update({ phone: normalizedPhone }).eq("id", auth.id);
    if (profileError) return { error: "تعذر تحديث رقم التواصل في ملفك: " + profileError.message };
    const { error: metadataError } = await supabase.auth.updateUser({ data: { phone: normalizedPhone } });
    if (metadataError) return { error: "تم تحديث الرقم في الملف، لكن تعذر مزامنة بيانات الجلسة. سجّل الخروج ثم ادخل مجدداً." };
    setAuth((current) => current ? { ...current, phone: normalizedPhone, identity: normalizedPhone } : current);
    notify("تم تغيير رقم التواصل ضمن جلسة بريد إلكتروني موثقة.");
    return {};
  }

  async function registerMerchant(form) {
    const credential = parseLoginIdentifier(form.email);
    const phone = normalizeAlgerianMobile(form.phone);
    if (!credential?.email || !phone) return { error: "أدخل بريداً إلكترونياً ورقم هاتف جزائرياً صالحين في الحقلين المخصصين." };
    if (!form.verifiedSession?.user) { setPendingProviderRegistration({ type: "merchant", form }); return { pendingOtp: true }; }
    if (form.verifiedSession.user.email?.toLowerCase() !== credential.email.toLowerCase()) return { error: "جلسة التحقق لا تطابق البريد المدخل. اطلب رمزاً جديداً." };
    const { data: existingProfile, error: profileLookupError } = await supabase.from("profiles").select("role").eq("id", form.verifiedSession.user.id).maybeSingle();
    if (profileLookupError) return { error: "تعذر التحقق من دور الحساب. حاول مرة أخرى بعد تسجيل الدخول." };
    if (existingProfile?.role && existingProfile.role !== "merchant") return { error: "هذا البريد مرتبط بدور مختلف. استخدم بريداً آخر أو بوابة الحساب الصحيحة." };
    const profile = await ensureSupabaseProfile({ user: form.verifiedSession.user, role: "merchant", name: form.ownerName || form.name, phone, wilaya: form.wilaya, commune: form.commune, addressLabel: form.addressLabel, latitude: form.latitude, longitude: form.longitude });
    if (profile.error) return profile;
    const merchant = {
      id: form.verifiedSession.user.id,
      store_name: form.name,
      wilaya: form.wilaya,
      commune: form.commune,
      phone,
      delivery_wilayas: form.deliveryWilayas || [form.wilaya],
      delivery_communes: form.deliveryCommunes || [],
      nationwide_coverage: Boolean(form.nationwideCoverage),
      has_own_delivery: Boolean(form.hasOwnDelivery),
      opening_hour: 8,
      closing_hour: 21,
      address_label: form.addressLabel || null,
      latitude: Number.isFinite(form.latitude) ? form.latitude : null,
      longitude: Number.isFinite(form.longitude) ? form.longitude : null,
      status: "pending_review",
    };
    const { error } = await supabase.from("merchants").insert(merchant);
    if (error) {
      return { error: "تعذر حفظ ملف المحل. بقي حساب الدخول صالحاً؛ طبّق ملف supabase/schema.sql ثم أرسل النموذج مجدداً لإكمال الملف." };
    }
    const store = { id: form.verifiedSession.user.id, name: form.name, phone, email: credential.email, wilaya: form.wilaya, commune: form.commune, address: form.addressLabel || "", addressLabel: form.addressLabel || "", lat: form.latitude, lng: form.longitude, latitude: form.latitude, longitude: form.longitude, distance: "—", status: "pending_review", rating: 0, open: 8, close: 21, minOrder: 0, deliveryFee: 0, hasOwnDelivery: Boolean(form.hasOwnDelivery), deliveryWilayas: form.deliveryWilayas || [form.wilaya], deliveryCommunes: form.deliveryCommunes || [], nationwideCoverage: Boolean(form.nationwideCoverage), approvedCourierIds: [], commissionType: "percentage", commissionRate: 10, subscriptionFee: 3000, duesPaid: 0, logo: { text: form.name.slice(0, 2), color: C.teal }, ccp: "", idDocName: "", products: [], reviews: [] };
    persistentSetStores((prev) => [...prev.filter((item) => item.id !== store.id), store]);
    await applySupabaseSession(form.verifiedSession);
    setShowMerchantForm(false);
    const contactOpened = await openAdminContactLink("merchant_membership_request", form.verifiedSession.user.id).catch(() => false);
    notify(contactOpened ? "تم حفظ طلب المحل Pending وفتح ملخص WhatsApp الجاهز للإدارة." : "تم حفظ طلب انضمام المحل Pending، بانتظار موافقة المشرف.");
    return { id: form.verifiedSession.user.id };
  }

  async function registerCourier(form) {
    const credential = parseLoginIdentifier(form.email);
    const phone = normalizeAlgerianMobile(form.phone);
    if (!credential?.email || !phone) return { error: "أدخل بريداً إلكترونياً ورقم هاتف جزائرياً صالحين في الحقلين المخصصين." };
    if (!form.verifiedSession?.user) { setPendingProviderRegistration({ type: "courier", form }); return { pendingOtp: true }; }
    if (form.verifiedSession.user.email?.toLowerCase() !== credential.email.toLowerCase()) return { error: "جلسة التحقق لا تطابق البريد المدخل. اطلب رمزاً جديداً." };
    const { data: existingProfile, error: profileLookupError } = await supabase.from("profiles").select("role").eq("id", form.verifiedSession.user.id).maybeSingle();
    if (profileLookupError) return { error: "تعذر التحقق من دور الحساب. حاول مرة أخرى بعد تسجيل الدخول." };
    if (existingProfile?.role && existingProfile.role !== "courier") return { error: "هذا البريد مرتبط بدور مختلف. استخدم بريداً آخر أو بوابة الحساب الصحيحة." };
    const profile = await ensureSupabaseProfile({ user: form.verifiedSession.user, role: "courier", name: form.name, phone, wilaya: form.wilaya, commune: form.commune, addressLabel: form.addressLabel, latitude: form.latitude, longitude: form.longitude });
    if (profile.error) return profile;
    const vehicleIds = normalizeCourierVehicles(form.vehicles);
    if (vehicleIds.length === 0) return { error: "اختر وسيلة توصيل واحدة على الأقل قبل إرسال الطلب." };
    const courier = {
      id: form.verifiedSession.user.id,
      vehicle: vehicleLabel(vehicleIds),
      vehicles: vehicleIds,
      wilaya: form.wilaya,
      communes: form.communes,
      availability: form.useCustomHours ? [form.hoursFrom, form.hoursTo] : form.availability,
      store_mode: form.storeMode,
      selected_store_ids: [],
      coverage_level: form.deliveryScope || "local",
      adjacent_wilayas: form.adjacentWilayas || [],
      address_label: form.addressLabel || null,
      latitude: Number.isFinite(form.latitude) ? form.latitude : null,
      longitude: Number.isFinite(form.longitude) ? form.longitude : null,
      status: "pending",
    };
    let activeSession = form.verifiedSession;
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
    const localCourier = { id: form.verifiedSession.user.id, name: form.name, phone, email: credential.email, vehicle: vehicleLabel(vehicleIds), vehicles: vehicleIds, wilaya: form.wilaya, commune: form.commune || "", address: form.addressLabel || "", addressLabel: form.addressLabel || "", latitude: form.latitude, longitude: form.longitude, communes: form.communes, availability: form.useCustomHours ? [] : form.availability, customHours: form.useCustomHours ? { from: form.hoursFrom, to: form.hoursTo } : null, timeLabel: form.timeLabel || "", coverageLabel: form.coverageLabel || "", coverageLevel: form.deliveryScope || "local", adjacentWilayas: form.adjacentWilayas || [], storeMode: form.storeMode, selectedStoreIds: form.selectedStoreIds, status: "pending" };
    persistentSetCouriers((prev) => [...prev.filter((item) => item.id !== localCourier.id), localCourier]);
    await applySupabaseSession(activeSession);
    setShowCourierForm(false);
    const contactOpened = await openAdminContactLink("courier_membership_request", form.verifiedSession.user.id).catch(() => false);
    notify(contactOpened ? "تم حفظ طلبك Pending وفتح ملخص WhatsApp الجاهز للإدارة." : "تم حفظ طلب انضمامك كموصل Pending، بانتظار موافقة المشرف.");
    return {};
  }

  async function signOut() {
    // Token invalidation is best-effort: an older installation may not yet
    // have the companion RPC while the user must still be able to sign out.
    const { error: tokenError } = await supabase.rpc("clear_my_fcm_token");
    if (tokenError && tokenError.code !== "42883") console.warn("تعذر إبطال رمز FCM عند الخروج:", tokenError.message);
    const cartOwnerId = cartOwnerRef.current;
    await clearCartForSession(cartOwnerId);
    await supabase.auth.signOut();
    setAuth(null);
    setMyStoreId(null); persistentSetMyStoreId(null);
    setRole("customer");
    setIsAppGateway(true);
    notify("تم تسجيل الخروج بنجاح");
  }

  if (loading) {
    return (<div dir="rtl" className="flex flex-col items-center justify-center gap-3" style={{ minHeight: "60vh", background: C.paper, fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}><Loader2 size={26} className="animate-spin" color={C.teal} /><span className="text-sm font-bold" style={{ color: C.inkSoft }}>جارٍ تحميل بياناتك المحفوظة...</span></div>);
  }

  return (
    <div dir="rtl" className="souq-next-app" style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif", background: C.paper, minHeight: "100%", color: C.ink }}>
      <style>{`
        * { box-sizing: border-box; }
        input, select, textarea { font-family: inherit; }
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
        [style*="Reem Kufi"] { font-family: var(--font-arabic) !important; letter-spacing: -.025em; }
        .dashboard-shell .dashboard-tabs { padding: .35rem; border-radius: 1rem; width: fit-content; background: rgba(255,255,255,.82); border: 1px solid ${C.line}; box-shadow: 0 8px 20px rgba(51,59,120,.05); }
        .dashboard-shell button, .dashboard-shell input, .dashboard-shell select { transition: border-color 160ms cubic-bezier(.23,1,.32,1), box-shadow 160ms cubic-bezier(.23,1,.32,1), transform 160ms cubic-bezier(.23,1,.32,1); }
        @media (prefers-reduced-motion: reduce) { .role-join-card, .role-benefit-card { transition: none; } .role-join-card:hover, .role-benefit-card:hover { transform: none; } }
        @media print { body * { visibility: hidden; } #invoice-print-area, #invoice-print-area * { visibility: visible; } #invoice-print-area { position: absolute; top: 0; left: 0; width: 100%; } .no-print { display: none !important; } }
      `}</style>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-7">
        <header className="app-header flex items-center justify-between mb-3 gap-3 flex-wrap p-3 sm:p-4 rounded-[22px]" style={{ background: "rgba(255,255,255,.78)", border: `1px solid ${C.line}`, boxShadow: "0 12px 30px rgba(51, 59, 120, .07)" }}>
          <button data-testid="app-gateway-home-link" type="button" onClick={openAppGateway} className="flex items-center gap-2.5 text-right rounded-2xl" aria-label={language === "fr" ? "Ouvrir le portail Souq Jiran" : "فتح بوابة سوق الجيران"}>
            <span className="flex items-center justify-center rounded-2xl" style={{ width: 44, height: 44, background: `linear-gradient(145deg, ${C.teal}, ${C.purple})`, color: "#fff", boxShadow: `0 10px 20px ${C.teal}35` }}><ShoppingBag size={21} /></span>
            <span><span className="block font-black text-xl leading-none tracking-tight">{uiText(language, "appName")}</span><span className="block text-[11px] mt-1 font-semibold" style={{ color: C.inkSoft }}>{uiText(language, "marketplaceCaption")}</span></span>
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            {!isAppGateway && <button data-testid="app-back-button" type="button" onClick={() => handleAppBack()} className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-sm" style={{ background: "#fff", color: C.teal, border: `1px solid ${C.teal}33` }} aria-label={language === "fr" ? "Retour" : "رجوع"}><ChevronRight size={16} /> {language === "fr" ? "Retour" : "رجوع"}</button>}
            <div data-testid="app-language-switcher" className="flex items-center gap-1 p-1 rounded-xl" role="group" aria-label={uiText(language, "language")} style={{ background: C.paperDark, border: `1px solid ${C.line}` }}><Languages size={15} color={C.teal} className="mx-1" />{LANGUAGE_OPTIONS.map((option) => <button key={option.code} type="button" onClick={() => setLanguage(option.code)} aria-pressed={language === option.code} className="px-2.5 py-1.5 rounded-lg text-xs font-black transition" style={{ background: language === option.code ? C.teal : "transparent", color: language === option.code ? "#fff" : C.inkSoft }}>{option.shortLabel}</button>)}</div>
            {role === "admin" ? (
              <button onClick={signOut} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm" style={{ background: C.ink, color: "#fff" }}><LogOut size={15} /> {uiText(language, "signOutAdmin")}</button>
            ) : auth && <div className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl" style={{ background: C.sage + "16", color: C.sage, border: `1px solid ${C.sage}2A` }}><span style={{ width: 7, height: 7, borderRadius: 999, background: C.sage }} />{auth.name}<button onClick={() => setShowPhoneChange(true)} className="flex items-center gap-1 mr-1" style={{ color: C.teal, fontSize: 10 }}><Phone size={12} /> {uiText(language, "phone")}</button><button onClick={signOut} className="flex items-center gap-1 mr-1" style={{ color: C.inkSoft, fontSize: 10 }}><LogOut size={12} /> {uiText(language, "signOut")}</button></div>}
          </div>
        </header>

        <StripeDivider />
        {role !== "admin" && <p className="text-xs mt-3 mb-1 flex items-center gap-1.5 font-medium" style={{ color: C.inkSoft }}><PackageCheck size={13} color={C.sage} /> {uiText(language, "privacy")}</p>}

        <div className="mt-4">
          {role === "customer" && (showRoleGuide ? <RoleBenefitsPage language={language} onBack={() => setShowRoleGuide(false)} onMerchant={() => { setShowRoleGuide(false); if (auth?.type === "merchant") { setRole("merchant"); persistentSetMyStoreId(auth.id); } else setShowMerchantForm(true); }} onCourier={() => { setShowRoleGuide(false); if (auth?.type === "courier") setRole("courier"); else setShowCourierForm(true); }} /> : <CustomerView language={language} stores={stores} merchantOffers={merchantOffers} setStores={persistentSetStores} cart={cart} setCart={persistentSetCart} orders={orders} setOrders={persistentSetOrders} couriers={couriers} placeOrder={placeOrder} notify={notify} customerId={auth?.id || null} customerConfirmDelivery={customerConfirmDelivery} quoteDelivery={quoteDelivery} referralCode={referralCode} rewardCoupons={rewardCoupons} claimReferralCode={claimCustomerReferral} publicStoreId={publicQrDestination.storeId} publicCourierId={publicQrDestination.courierId} />)}
          {role === "merchant" && <MerchantView stores={stores} setStores={persistentSetStores} orders={orders} messages={messages} couriers={couriers} merchantOffers={merchantOffers} myStoreId={myStoreId} setMyStoreId={persistentSetMyStoreId} notify={notify} onStartMerchantRegistration={() => setShowMerchantForm(true)} createProduct={createProduct} createBulkProducts={createBulkProducts} removeProductRemote={removeProductRemote} setProductAvailability={setProductAvailability} setMerchantOrderStatus={setMerchantOrderStatus} merchantConfirmSettlement={merchantConfirmSettlement} reportCustomerAccount={reportCustomerAccount} archiveOrder={archiveOrderForCurrentUser} archiveMessage={archiveMessageForCurrentUser} submitMerchantOffer={submitMerchantOffer} pauseMerchantOffer={pauseMerchantOffer} userId={auth?.id || null} isResolvingMerchantStore={isResolvingMerchantStore} />}
          {role === "courier" && <CourierDashboard courierId={auth?.id || null} stores={stores} orders={orders} messages={messages} couriers={couriers} setCouriers={persistentSetCouriers} notify={notify} onLogout={signOut} claimReadyOrder={claimReadyOrder} courierConfirmPickup={courierConfirmPickup} courierStartDelivery={courierStartDelivery} courierConfirmDelivery={courierConfirmDelivery} courierConfirmRemittance={courierConfirmRemittance} archiveOrder={archiveOrderForCurrentUser} archiveMessage={archiveMessageForCurrentUser} userId={auth?.id || null} />}
          {role === "admin" && <AdminView stores={stores} orders={orders} messages={messages} couriers={couriers} merchantOffers={merchantOffers} archiveAuditLogs={archiveAuditLogs} archiveNotifications={archiveNotifications} orderNotifications={adminOrderNotifications} archiveAlertSettings={archiveAlertSettings} testAccountCandidates={testAccountCandidates} testAccountReviewAuditLogs={testAccountReviewAuditLogs} customerReports={customerReports} customerBlacklist={customerBlacklist} deliveryPricing={deliveryPricing} referralAnalytics={referralAnalytics} notify={notify} setProviderStatus={setProviderStatus} deleteOrderPermanently={deleteOrderPermanently} deleteMessagePermanently={deleteMessagePermanently} deleteTestAccount={deleteTestAccount} markArchiveNotificationRead={markArchiveNotificationRead} markOrderNotificationRead={markOrderNotificationRead} markAllOrderNotificationsRead={markAllOrderNotificationsRead} saveArchiveAlertSettings={saveArchiveAlertSettings} setCustomerBlacklist={setCustomerBlacklistStatus} saveDeliveryPricing={saveDeliveryPricingConfig} reviewMerchantOffer={reviewMerchantOffer} />}
        </div>

        {role === "customer" && !showRoleGuide && (
          <section className="mt-10 p-5 sm:p-6 rounded-[28px]" style={{ background: "rgba(238,240,255,.7)", border: `1px solid ${C.line}` }} data-testid="role-join-cards">
            <div className="flex items-center justify-between gap-3 mb-4"><div><h2 className="font-black text-lg tracking-tight" style={{ color: C.ink }}>{uiText(language, "buildPresence")}</h2><p className="text-xs mt-1" style={{ color: C.inkSoft }}>{uiText(language, "onboardingDescription")}</p></div><div className="flex items-center gap-2"><button data-testid="role-benefits-link" onClick={() => setShowRoleGuide(true)} className="text-xs font-black px-3 py-2 rounded-xl" style={{ background: "#fff", color: C.teal, border: `1px solid ${C.teal}2B` }}>{uiText(language, "explorePaths")}</button></div></div>
            <div data-testid="provider-role-switches" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <article data-testid="merchant-role-button" className="role-join-card group text-right p-5 rounded-[22px]" style={{ background: "#fff", border: `1px solid ${C.line}`, boxShadow: "0 8px 22px rgba(51,59,120,.06)", "--role-accent": C.rust }}>
                <span className="w-11 h-11 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: C.rust + "16", color: C.rust }}><Store size={22} /></span><h3 className="font-black mt-4" style={{ color: C.ink }}>{uiText(language, "merchant")}</h3><p className="text-xs leading-5 mt-1.5" style={{ color: C.inkSoft }}>{uiText(language, "merchantDescription")}</p>
                <div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => (auth?.type === "merchant" ? (setRole("merchant"), setIsAppGateway(false), persistentSetMyStoreId(auth.id)) : setShowMerchantForm(true))} className="py-2.5 rounded-xl text-xs font-black" style={{ background: C.rust, color: "#fff" }}>{uiText(language, "createAccount")}</button><button onClick={() => { setAdminLoginRequested(false); setAuthEntry({ type: "merchant", mode: "login" }); setShowAuth(true); }} className="py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1" style={{ border: `1px solid ${C.rust}44`, color: C.rust }}><LogIn size={13} /> {uiText(language, "signIn")}</button></div>
              </article>
              <article data-testid="courier-role-button" className="role-join-card group text-right p-5 rounded-[22px]" style={{ background: "#fff", border: `1px solid ${C.line}`, boxShadow: "0 8px 22px rgba(51,59,120,.06)", "--role-accent": C.teal }}>
                <span className="w-11 h-11 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: C.teal + "16", color: C.teal }}><Bike size={22} /></span><h3 className="font-black mt-4" style={{ color: C.ink }}>{uiText(language, "courier")}</h3><p className="text-xs leading-5 mt-1.5" style={{ color: C.inkSoft }}>{uiText(language, "courierDescription")}</p>
                <div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => (auth?.type === "courier" ? (setRole("courier"), setIsAppGateway(false)) : setShowCourierForm(true))} className="py-2.5 rounded-xl text-xs font-black" style={{ background: C.teal, color: "#fff" }}>{uiText(language, "createAccount")}</button><button data-testid="courier-login-button" onClick={() => { setAdminLoginRequested(false); setAuthEntry({ type: "courier", mode: "login" }); setShowAuth(true); }} className="py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1" style={{ border: `1px solid ${C.teal}44`, color: C.teal }}><LogIn size={13} /> {uiText(language, "accountLogin")}</button></div>
              </article>
              <article data-testid="customer-role-button" className="role-join-card group text-right p-5 rounded-[22px]" style={{ background: "#fff", border: `1px solid ${C.line}`, boxShadow: "0 8px 22px rgba(51,59,120,.06)", "--role-accent": C.ochre }}>
                <span className="w-11 h-11 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: C.ochre + "16", color: C.ochre }}><User size={22} /></span><h3 className="font-black mt-4" style={{ color: C.ink }}>{uiText(language, "customer")}</h3><p className="text-xs leading-5 mt-1.5" style={{ color: C.inkSoft }}>{uiText(language, "customerDescription")}</p>
                <button onClick={() => { setAdminLoginRequested(false); setAuthEntry({ type: "customer", mode: "register" }); setShowAuth(true); }} className="mt-4 w-full py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5" style={{ background: C.ochre, color: "#fff" }}><UserPlus size={14} /> {uiText(language, "customerAuth")}</button>
              </article>
            </div>
          </section>
        )}
      </div>

      <Toast message={toast} />

      {showCourierForm && <CourierRegisterModal stores={stores} onSubmit={registerCourier} onClose={() => setShowCourierForm(false)} />}
      {showMerchantForm && <MerchantRegisterModal onSubmit={registerMerchant} onClose={() => setShowMerchantForm(false)} />}
      {pendingProviderRegistration && <ProviderEmailOtpModal registration={pendingProviderRegistration} onVerified={({ type, form, verifiedSession }) => type === "merchant" ? registerMerchant({ ...form, verifiedSession }) : registerCourier({ ...form, verifiedSession })} onClose={() => setPendingProviderRegistration(null)} />}
      {showAuth && <AuthModal authenticate={authenticate} requestAccountRecovery={requestAccountRecovery} adminOnly={adminLoginRequested} initialType={authEntry.type} initialMode={authEntry.mode} lockRole onClose={() => { setShowAuth(false); setAdminLoginRequested(false); setAuthEntry({ type: "merchant", mode: "login" }); }} />}
      {showPhoneChange && <PhoneChangeModal currentPhone={auth?.phone} onConfirm={confirmPhoneChange} onClose={() => setShowPhoneChange(false)} />}
      {focusedOrderId && <OrderDetailsOverlay order={focusedOrder} onClose={() => setFocusedOrderId(null)} />}
      {role !== "admin" && <button aria-label="دخول الإدارة" onClick={() => { setAdminLoginRequested(true); setShowAuth(true); }} className="fixed top-1 right-1 h-2 w-2 rounded-full opacity-15 transition-opacity hover:opacity-70 focus:opacity-100" style={{ background: C.ink }} />}
    </div>
  );
}



window.SJApp = { default: App };
