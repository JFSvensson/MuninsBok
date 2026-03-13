import { Link } from "react-router-dom";
import { useLocale } from "../context/LocaleContext";

export function NotFound() {
  const { t } = useLocale();

  return (
    <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
      <h2 style={{ marginBottom: "1rem" }}>404 — {t("notFound.title")}</h2>
      <p style={{ marginBottom: "2rem", color: "var(--color-text-muted)" }}>
        {t("notFound.message")}
      </p>
      <Link to="/dashboard">
        <button>{t("notFound.back")}</button>
      </Link>
    </div>
  );
}
