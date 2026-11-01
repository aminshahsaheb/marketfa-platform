import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  INDUSTRY_PROFILES,
  type IndustryCapability,
} from "@marketfa/domain/industries";
import "./styles.css";

const capabilityLabels: Record<IndustryCapability, string> = {
  customers: "مشتریان",
  suppliers: "تأمین‌کنندگان",
  sales: "فروش و صورتحساب",
  payments: "دریافت و پرداخت",
  expenses: "هزینه‌ها",
  finance: "مالی و حسابداری",
  reports: "گزارش‌ها",
  catalog: "کالا و خدمات",
  inventory: "موجودی و انبار",
  procurement: "خرید و تأمین",
  point_of_sale: "صندوق فروش",
  appointments: "نوبت‌دهی",
  work_orders: "سفارش کار",
  projects: "پروژه‌ها",
  reservations: "رزرو و پذیرش",
  production: "تولید و دستور ساخت",
  delivery: "ارسال و تحویل",
};

function App(): React.JSX.Element {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("general-retail");
  const [language, setLanguage] = useState<"fa" | "en">("fa");
  const isPersian = language === "fa";
  const selected = INDUSTRY_PROFILES.find((profile) => profile.id === selectedId);

  const visibleProfiles = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return INDUSTRY_PROFILES;
    return INDUSTRY_PROFILES.filter((profile) =>
      [profile.labelFa, profile.labelEn, profile.descriptionFa, profile.group]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query),
    );
  }, [search]);

  return (
    <main className="app-shell" dir={isPersian ? "rtl" : "ltr"}>
      <header className="topbar">
        <a className="brand" href="/" aria-label="MarketFa home">
          <span className="brand-mark">م</span>
          <span>MarketFa</span>
        </a>
        <button
          className="language-button"
          type="button"
          onClick={() => setLanguage(isPersian ? "en" : "fa")}
        >
          {isPersian ? "English" : "فارسی"}
        </button>
      </header>

      <section className="intro">
        <p className="eyebrow">{isPersian ? "فضای کاری کسب‌وکار شما" : "Your business workspace"}</p>
        <h1>{isPersian ? "کسب‌وکار شما در چه حوزه‌ای است؟" : "What type of business do you run?"}</h1>
        <p className="intro-copy">
          {isPersian
            ? "صنف خود را انتخاب کنید. MarketFa ابزارها و بخش‌های مرتبط را برای شما آماده می‌کند."
            : "Choose your industry. MarketFa will prepare the tools and work areas that fit your business."}
        </p>
      </section>

      <section className="workspace-layout" aria-label={isPersian ? "انتخاب صنف و پیش‌نمایش پنل" : "Industry selection and workspace preview"}>
        <div className="industry-picker">
          <div className="picker-heading">
            <h2>{isPersian ? "انتخاب نوع فعالیت" : "Choose an industry"}</h2>
            <span>{visibleProfiles.length} {isPersian ? "حوزه" : "industries"}</span>
          </div>
          <label className="search-box">
            <span className="search-icon" aria-hidden="true">⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={isPersian ? "جست‌وجوی شغل یا صنف..." : "Search an industry..."}
              aria-label={isPersian ? "جست‌وجوی صنف" : "Search industries"}
            />
          </label>
          <div className="industry-grid">
            {visibleProfiles.map((profile) => {
              const active = profile.id === selectedId;
              return (
                <button
                  className={active ? "industry-card selected" : "industry-card"}
                  type="button"
                  key={profile.id}
                  aria-pressed={active}
                  onClick={() => setSelectedId(profile.id)}
                >
                  <span className="industry-card-top">
                    <span className="industry-symbol" aria-hidden="true">{profile.labelFa.slice(0, 1)}</span>
                    {active ? <span className="selected-mark" aria-label={isPersian ? "انتخاب‌شده" : "Selected"}>✓</span> : null}
                  </span>
                  <strong>{isPersian ? profile.labelFa : profile.labelEn}</strong>
                  <span className="industry-description">
                    {isPersian ? profile.descriptionFa : profile.labelEn}
                  </span>
                </button>
              );
            })}
          </div>
          {visibleProfiles.length === 0 ? (
            <p className="empty-state">
              {isPersian ? "نتیجه‌ای پیدا نشد. «سایر مشاغل» را انتخاب کنید." : "No results. Choose Other business to start with core tools."}
            </p>
          ) : null}
        </div>

        <aside className="workspace-preview" aria-live="polite">
          <div className="preview-kicker">{isPersian ? "پیش‌نمایش فضای کاری" : "WORKSPACE PREVIEW"}</div>
          {selected ? (
            <>
              <div className="preview-title-row">
                <div>
                  <p className="preview-label">{isPersian ? "قالب انتخاب‌شده" : "Selected profile"}</p>
                  <h2>{isPersian ? selected.labelFa : selected.labelEn}</h2>
                </div>
                <span className="preview-icon" aria-hidden="true">✳</span>
              </div>
              <p className="preview-description">
                {isPersian ? selected.descriptionFa : "A workspace configured for this type of business."}
              </p>
              <div className="module-heading">
                <strong>{isPersian ? "بخش‌های پیشنهادی پنل" : "Suggested workspace modules"}</strong>
                <span>{selected.capabilities.length}</span>
              </div>
              <ul className="module-list">
                {selected.capabilities.map((capability) => (
                  <li key={capability}>
                    <span className="module-check">✓</span>
                    {isPersian ? capabilityLabels[capability] : capability.replaceAll("_", " ")}
                  </li>
                ))}
              </ul>
              <p className="preview-note">
                {isPersian
                  ? "این انتخاب فقط پیش‌نمایش است. ذخیره‌سازی و فعال‌سازی واقعی پس از تکمیل ورود، ایجاد کسب‌وکار و API انجام می‌شود."
                  : "This is a preview. Saving and enabling modules requires the account, business setup and API flows."}
              </p>
            </>
          ) : null}
        </aside>
      </section>
      <footer className="footer">
        {isPersian
          ? "یک هستهٔ مشترک؛ ابزارهای متناسب با هر کسب‌وکار."
          : "One shared core. Tools that fit each business."}
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
