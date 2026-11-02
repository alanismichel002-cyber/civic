import { useI18n, type MessageKey } from "../lib/i18n.tsx";

export function ErrorNotice({ code, onRetry }: { code: string; onRetry?: () => void }) {
  const { t } = useI18n();
  const key = `err.${code}` as MessageKey;
  const message = t(key) === key ? t("err.upstream_error") : t(key);
  return (
    <div role="alert" className="card border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
      <h2 className="h3">{t("err.title")}</h2>
      <p className="mt-1">{message}</p>
      {onRetry && code !== "address_not_found" && code !== "bad_request" && (
        <button type="button" className="btn-secondary mt-3" onClick={onRetry}>
          {t("err.retry")}
        </button>
      )}
    </div>
  );
}
