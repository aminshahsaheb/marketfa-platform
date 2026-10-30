import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
function App(): React.JSX.Element {
  return (
    <main className="shell">
      <section className="card" aria-labelledby="app-title">
        <p className="eyebrow">Retail operations platform</p>
        <h1 id="app-title">MarketFa</h1>
        <p>زیرساخت فروش، انبار و حسابداری فروشگاه</p>
        <div className="status" role="status">
          <span className="status-dot" />
          پوستهٔ اولیه اجرا شد
        </div>
        <p className="languages">فارسی · English</p>
      </section>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
