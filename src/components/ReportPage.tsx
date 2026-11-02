import { useId, useState, type FormEvent } from "react";
import { submitReport } from "../lib/api.ts";
import { useI18n } from "../lib/i18n.tsx";

const KINDS = ["wrong", "missing", "bug", "accessibility", "other"] as const;

/** "Report a problem" form, stored by Netlify Forms. No address is requested. */
export function ReportPage() {
  const { t } = useI18n();
  const id = useId();
  const [kind, setKind] = useState<(typeof KINDS)[number]>("wrong");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [bot, setBot] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (message.trim().length < 5) return;
    setStatus("sending");
    try {
      await submitReport({ kind, message: message.trim(), email: email.trim(), page: document.referrer ? "app" : "direct", "bot-field": bot });
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="card mx-auto max-w-2xl" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="h2">
        {t("report.heading")}
      </h2>
      <p className="mt-1">{t("report.lead")}</p>
      {status === "done" ? (
        <p role="status" className="mt-4 rounded-[20px] bg-emerald-50/80 p-4 font-medium text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          {t("report.thanks")}
        </p>
      ) : (
        <form className="mt-4 space-y-4" onSubmit={submit} name="report">
          <p hidden>
            <label>
              Don't fill this out: <input name="bot-field" value={bot} onChange={(e) => setBot(e.target.value)} />
            </label>
          </p>
          <div>
            <label htmlFor={`${id}-kind`} className="block font-semibold">
              {t("report.kind")}
            </label>
            <select id={`${id}-kind`} className="input mt-1" value={kind} onChange={(e) => setKind(e.target.value as (typeof KINDS)[number])}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`report.kind.${k}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-msg`} className="block font-semibold">
              {t("report.message")}
            </label>
            <p id={`${id}-msg-hint`} className="muted text-sm">
              {t("report.messageHint")}
            </p>
            <textarea
              id={`${id}-msg`}
              aria-describedby={`${id}-msg-hint`}
              className="input mt-1 min-h-[140px]"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              minLength={5}
              maxLength={4000}
            />
          </div>
          <div>
            <label htmlFor={`${id}-email`} className="block font-semibold">
              {t("report.email")}
            </label>
            <input id={`${id}-email`} type="email" autoComplete="email" className="input mt-1" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} />
          </div>
          {status === "error" && (
            <p role="alert" className="font-medium text-red-700 dark:text-red-300">
              {t("report.error")}
            </p>
          )}
          <button type="submit" className="btn-primary" disabled={status === "sending" || message.trim().length < 5}>
            {status === "sending" ? t("form.loading") : t("report.submit")}
          </button>
        </form>
      )}
    </section>
  );
}
