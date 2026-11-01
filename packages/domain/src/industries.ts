export const INDUSTRY_CAPABILITIES = [
  "customers",
  "suppliers",
  "sales",
  "payments",
  "expenses",
  "finance",
  "reports",
  "catalog",
  "inventory",
  "procurement",
  "point_of_sale",
  "appointments",
  "work_orders",
  "projects",
  "reservations",
  "production",
  "delivery",
] as const;

export type IndustryCapability = (typeof INDUSTRY_CAPABILITIES)[number];

export type IndustryProfile = {
  id: string;
  labelFa: string;
  labelEn: string;
  group: string;
  descriptionFa: string;
  capabilities: readonly IndustryCapability[];
};

const shared: readonly IndustryCapability[] = [
  "customers",
  "sales",
  "payments",
  "expenses",
  "finance",
  "reports",
];

const retailCapabilities: readonly IndustryCapability[] = [
  ...shared,
  "suppliers",
  "catalog",
  "inventory",
  "procurement",
  "point_of_sale",
];

export const INDUSTRY_PROFILES: readonly IndustryProfile[] = [
  {
    id: "general-retail",
    labelFa: "فروشگاه عمومی",
    labelEn: "General retail",
    group: "retail",
    descriptionFa: "فروش کالا، موجودی، خرید و صندوق",
    capabilities: retailCapabilities,
  },
  {
    id: "grocery",
    labelFa: "سوپرمارکت و خواربار",
    labelEn: "Grocery",
    group: "retail",
    descriptionFa: "کالای متنوع، بارکد، وزن، تاریخ انقضا و صندوق",
    capabilities: retailCapabilities,
  },
  {
    id: "apparel",
    labelFa: "پوشاک و کفش",
    labelEn: "Apparel and footwear",
    group: "retail",
    descriptionFa: "تنوع رنگ و سایز، کالا، موجودی و فروش",
    capabilities: retailCapabilities,
  },
  {
    id: "electronics",
    labelFa: "موبایل و کالای دیجیتال",
    labelEn: "Electronics",
    group: "retail",
    descriptionFa: "مدل، سریال، ضمانت، موجودی و فروش",
    capabilities: retailCapabilities,
  },
  {
    id: "pharmacy",
    labelFa: "داروخانه",
    labelEn: "Pharmacy",
    group: "regulated-retail",
    descriptionFa: "فروش و موجودی با نیاز به قواعد تخصصی و مجوزهای مرتبط",
    capabilities: retailCapabilities,
  },
  {
    id: "restaurant",
    labelFa: "رستوران و تهیه غذا",
    labelEn: "Restaurant",
    group: "food-service",
    descriptionFa: "سفارش، میز، منو، آشپزخانه و تحویل",
    capabilities: [...retailCapabilities, "reservations", "delivery"],
  },
  {
    id: "cafe-bakery",
    labelFa: "کافه و نانوایی",
    labelEn: "Cafe and bakery",
    group: "food-service",
    descriptionFa: "منو، دستور ساخت، سفارش و فروش حضوری",
    capabilities: [...retailCapabilities, "production"],
  },
  {
    id: "professional-services",
    labelFa: "خدمات حرفه‌ای و مشاوره",
    labelEn: "Professional services",
    group: "services",
    descriptionFa: "مشتری، قرارداد، خدمت، صورتحساب و هزینه",
    capabilities: [...shared, "projects"],
  },
  {
    id: "repair-maintenance",
    labelFa: "تعمیرات و خدمات فنی",
    labelEn: "Repair and maintenance",
    group: "services",
    descriptionFa: "پذیرش کار، سفارش کار، قطعه و تحویل",
    capabilities: [
      ...shared,
      "suppliers",
      "catalog",
      "inventory",
      "procurement",
      "work_orders",
    ],
  },
  {
    id: "health-wellness",
    labelFa: "سلامت و زیبایی",
    labelEn: "Health and beauty",
    group: "appointments",
    descriptionFa:
      "نوبت‌دهی، خدمات، کارکنان و پرداخت؛ دادهٔ حساس نیازمند کنترل جداگانه است",
    capabilities: [...shared, "appointments"],
  },
  {
    id: "education",
    labelFa: "آموزشگاه و کلاس",
    labelEn: "Education and classes",
    group: "services",
    descriptionFa: "هنرجو، دوره، جلسه، ثبت‌نام و دریافت شهریه",
    capabilities: [...shared, "appointments", "projects"],
  },
  {
    id: "construction",
    labelFa: "ساختمان و پیمانکاری",
    labelEn: "Construction and contracting",
    group: "projects",
    descriptionFa: "پروژه، برآورد، خرید، هزینه و صورت‌وضعیت",
    capabilities: [
      ...shared,
      "suppliers",
      "procurement",
      "projects",
      "work_orders",
    ],
  },
  {
    id: "wholesale",
    labelFa: "عمده‌فروشی و پخش",
    labelEn: "Wholesale and distribution",
    group: "trade",
    descriptionFa: "مشتری سازمانی، قیمت‌گذاری، سفارش و توزیع",
    capabilities: [
      ...shared,
      "suppliers",
      "catalog",
      "inventory",
      "procurement",
      "delivery",
    ],
  },
  {
    id: "manufacturing",
    labelFa: "تولید و کارگاه",
    labelEn: "Manufacturing",
    group: "production",
    descriptionFa: "مواد اولیه، دستور تولید، عملیات و محصول نهایی",
    capabilities: [
      ...shared,
      "suppliers",
      "catalog",
      "inventory",
      "procurement",
      "production",
      "work_orders",
    ],
  },
  {
    id: "transport",
    labelFa: "حمل‌ونقل و لجستیک",
    labelEn: "Transport and logistics",
    group: "operations",
    descriptionFa: "سفارش حمل، مسیر، تحویل و هزینه",
    capabilities: [...shared, "delivery", "work_orders"],
  },
  {
    id: "hospitality",
    labelFa: "هتل و اقامت",
    labelEn: "Hospitality",
    group: "hospitality",
    descriptionFa: "رزرو، پذیرش، خدمات و تسویه",
    capabilities: [...shared, "reservations", "appointments"],
  },
  {
    id: "custom",
    labelFa: "سایر مشاغل",
    labelEn: "Other business",
    group: "custom",
    descriptionFa: "شروع با ابزارهای پایه و افزودن قابلیت‌های موردنیاز",
    capabilities: shared,
  },
];

export function getIndustryProfile(id: string): IndustryProfile | undefined {
  return INDUSTRY_PROFILES.find((profile) => profile.id === id);
}

export function hasIndustryCapability(
  profile: IndustryProfile,
  capability: IndustryCapability,
): boolean {
  return profile.capabilities.includes(capability);
}
