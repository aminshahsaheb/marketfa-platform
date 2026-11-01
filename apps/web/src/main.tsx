import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  INDUSTRY_CAPABILITIES,
  INDUSTRY_PROFILES,
  type IndustryCapability,
  type IndustryProfile,
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

interface IndustryCatalogItem {
  id: string;
  profileVersion: number;
  labelKey: string;
  group: string;
  regulated: boolean;
  capabilities: string[];
}

function isIndustryCapability(value: string): value is IndustryCapability {
  return INDUSTRY_CAPABILITIES.includes(value as IndustryCapability);
}

function App(): React.JSX.Element {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("general-retail");
  const [language, setLanguage] = useState<"fa" | "en">("fa");
  const [profiles, setProfiles] = useState<IndustryProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [catalogReload, setCatalogReload] = useState(0);
  const isPersian = language === "fa";

  useEffect(() => {
    let cancelled = false;

    async function loadIndustryCatalog(): Promise<void> {
      setLoading(true);
      setCatalogError("");

      try {
        const response = await fetch("/api/v1/industries", {
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          throw new Error(`Industry catalogue request failed (${response.status}).`);
        }

        const catalog = (await response.json()) as IndustryCatalogItem[];
        const mapped = catalog.flatMap((item) => {
          const presentation = INDUSTRY_PROFILES.find(
            (profile) => profile.id === item.id,
          );
          if (!presentation) return [];

          const capabilities = item.capabilities.filter(isIndustryCapability);
          return [
            {
              ...presentation,
              group: item.group,
              regulated: item.regulated,
              capabilities,
            },
          ];
        });

        if (mapped.length === 0) {
          throw new Error("The industry catalogue is empty or has no supported profiles.");
        }

        if (!cancelled) {
          setProfiles(mapped);
          setSelectedId((current) =>
            mapped.some((profile) => profile.id === current)
              ? current
              : mapped[0].id,
          );
        }
      } catch {
        if (!cancelled) {
          setCatalogError(
            isPersian
              ? "فهرست صنف‌ها از سرور دریافت نشد. اتصال را بررسی کنید و دوباره تلاش کنید."
              : "The industry list could not be loaded. Check the connection and try again.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadIndustryCatalog();
    return () => {
      cancelled = true;
    };
  }, [catalogReload, isPersian]);

  const selected = profiles.find((profile) => profile.id === selectedId);

  const visibleProfiles = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return profiles;

    return profiles.filter((profile) =>
      [
        profile.labelFa,
        profile.labelEn,
        profile.descriptionFa,
        profile.group,
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query),
    );
  }, [profiles, search]);

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
        <p className="eyebrow">
          {isPersian ? "فضای کاری کسب‌وکار شما" : "YOUR BUSINESS WORKSPACE"}
        </p>
        <h1>
          {isPersian
            ? "کسب‌وکار شما در چه حوزه‌ای است؟"
            : "What type of business do you run?"}
        </h1>
        <p className="intro-copy">
          {isPersian
            ? "صنف خود را انتخاب کنید. بخش‌های پنل بر اساس نیازهای آن حوزه تنظیم می‌شوند."
            : "Choose your industry. The workspace modules will match its operational needs."}
        </p>
      </section>

      <section
        className="workspace-layout"
        aria-label={
          isPersian
            ? "انتخاب صنف و پیش‌نمایش پنل"
            : "Industry selection and workspace preview"
        }
      >
        <div className="industry-picker">
          <div className="picker-heading">
            <h2>{isPersian ? "انتخاب نوع فعالیت" : "Choose an industry"}</h2>
            <span>
              {loading
                ? isPersian
                  ? "در حال دریافت..."
                  : "Loading..."
                : `${visibleProfiles.length} ${isPersian ? "حوزه" : "industries"}`}
            </span>
          </div>
          <label className="search-box">
            <span className="search-icon" aria-hidden="true">
              ⌕
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                isPersian ? "جست‌وجوی شغل یا صنف..." : "Search an industry..."
              }
              aria-label={isPersian ? "جست‌وجوی صنف" : "Search industries"}
              disabled={loading || Boolean(catalogError)}
            />
          </label>

          {catalogError ? (
            <div className="catalog-error" role="alert">
              <p>{catalogError}</p>
              <button
                type="button"
                onClick={() => setCatalogReload((value) => value + 1)}
              >
                {isPersian ? "تلاش دوباره" : "Retry"}
              </button>
            </div>
          ) : null}

          {loading ? (
            <p className="empty-state">
              {isPersian ? "در حال آماده‌سازی فهرست صنف‌ها..." : "Loading industries..."}
            </p>
          ) : null}

          {!loading && !catalogError ? (
            <>
              <div className="industry-grid">
                {visibleProfiles.map((profile) => {
                  const active = profile.id === selectedId;

                  return (
                    <button
                      className={
                        active ? "industry-card selected" : "industry-card"
                      }
                      type="button"
                      key={profile.id}
                      aria-pressed={active}
                      onClick={() => setSelectedId(profile.id)}
                    >
                      <span className="industry-card-top">
                        <span className="industry-symbol" aria-hidden="true">
                          {profile.labelFa.slice(0, 1)}
                        </span>
                        {active ? (
                          <span
                            className="selected-mark"
                            aria-label={isPersian ? "انتخاب‌شده" : "Selected"}
                          >
                            ✓
                          </span>
                        ) : null}
                      </span>
                      <strong>
                        {isPersian ? profile.labelFa : profile.labelEn}
                      </strong>
                      <span className="industry-description">
                        {isPersian ? profile.descriptionFa : profile.labelEn}
                      </span>
                    </button>
                  );
                })}
              </div>
              {visibleProfiles.length === 0 ? (
                <p className="empty-state">
                  {isPersian
                    ? "نتیجه‌ای پیدا نشد. «سایر مشاغل» را جست‌وجو کنید."
                    : "No results. Search for Other business."}
                </p>
              ) : null}
            </>
          ) : null}
        </div>

        <aside className="workspace-preview" aria-live="polite">
          <div className="preview-kicker">
            {isPersian ? "پیش‌نمایش فضای کاری" : "WORKSPACE PREVIEW"}
          </div>
          {selected ? (
            <>
              <div className="preview-title-row">
                <div>
                  <p className="preview-label">
                    {isPersian ? "قالب انتخاب‌شده" : "Selected profile"}
                  </p>
                  <h2>{isPersian ? selected.labelFa : selected.labelEn}</h2>
                </div>
                <span className="preview-icon" aria-hidden="true">
                  ✳
                </span>
              </div>
              <p className="preview-description">
                {isPersian
                  ? selected.descriptionFa
                  : "A workspace configured for this type of business."}
              </p>
              {selected.regulated ? (
                <p className="regulatory-note">
                  {isPersian
                    ? "این حوزه ممکن است به مجوز، کنترل داده یا قواعد تخصصی نیاز داشته باشد. این پنل به‌تنهایی تأییدیهٔ قانونی یا صنفی ایجاد نمی‌کند."
                    : "This industry may require licences, data controls or specialist rules. This workspace does not provide regulatory approval."}
                </p>
              ) : null}
              <div className="module-heading">
                <strong>
                  {isPersian
                    ? "بخش‌های فعال این حوزه"
                    : "Enabled workspace modules"}
                </strong>
                <span>{selected.capabilities.length}</span>
              </div>
              <ul className="module-list">
                {selected.capabilities.map((capability) => (
                  <li key={capability}>
                    <span className="module-check">✓</span>
                    {isPersian
                      ? capabilityLabels[capability]
                      : capability.replaceAll("_", " ")}
                  </li>
                ))}
              </ul>
              <p className="preview-note">
                {isPersian
                  ? "این انتخاب در این مرحله پیش‌نمایش است. ذخیرهٔ نهایی صنف در زمان ایجاد حساب و کسب‌وکار انجام می‌شود."
                  : "This is a preview. The selected industry is saved when the user creates an account and business."}
              </p>
            </>
          ) : (
            <p className="empty-state">
              {isPersian
                ? "برای دیدن بخش‌های پنل، یک صنف انتخاب کنید."
                : "Choose an industry to preview its workspace."}
            </p>
          )}
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
