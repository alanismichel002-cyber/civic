import { useId, useState, type FormEvent } from "react";
import type { VoterInfo } from "../../shared/types.ts";
import { ApiRequestError, subscribeReminders } from "../lib/api.ts";
import { track } from "../lib/analytics.ts";
import { useI18n, type MessageKey } from "../lib/i18n.tsx";

/** FR-17: opt-in reminders by email or text, with confirmation and one-tap unsubscribe. */
export function RemindersCard({
  info,
  address,
  channels,
}: {
  info: VoterInfo;
  address: string;
  channels: { email: boolean; sms: boolean };
}) {
  const { t, lang } = useI18n();
  const id = useId();
  const available = (["email", "sms"] as const).filter((c) => channels[c]);
  const [channel, setChannel] = useState<"email" | "sms">(available[0] ?? "email");
  const [contact, setContact] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string>("");
  const today = new Date().toISOString().slice(0, 10);

  if (!available.length || !address || info.election.day < today) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!consent) {
      setStatus("error");
      setError(t("remind.needConsent"));
      return;
    }
    setStatus("sending");
    try {
      await subscribeReminders({ channel, contact, address, electionId: info.election.id, lang, consent });
      setStatus("done");
      track("reminder_signup", { channel });
    } catch (err) {
      setStatus("error");
      const code = err instanceof ApiRequestError ? err.code : "network";
      setError(code === "bad_request" ? t(channel === "email" ? "remind.badEmail" : "remind.badPhone") : t(`err.${code}` as MessageKey));
    }
  }

  return (
    <section className="card no-print" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="h3">
        {t("remind.title")}
      </h3>
      <p className="muted mt-1 text-sm">{t("remind.lead")}</p>
      {status === "done" ? (
        <p role="status" className="mt-3 rounded-[20px] bg-emerald-50/80 p-4 font-medium text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          {t(channel === "email" ? "remind.checkEmail" : "remind.checkPhone")}
        </p>
      ) : (
        <form className="mt-3 space-y-3" onSubmit={submit} noValidate>
          {available.length > 1 && (
            <fieldset>
              <legend className="text-sm font-semibold">{t("remind.how")}</legend>
              <div className="mt-1 flex gap-2">
                {available.map((c) => (
                  <label
                    key={c}
                    className={
                      "inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border px-4 " +
                      (channel === c ? "border-white bg-white/90 font-semibold text-brand-700 shadow-[0_0_0_2px_rgba(29,78,216,.5)] dark:border-sky-300/40 dark:bg-white/15 dark:text-white" : "border-white/80 bg-white/50 dark:border-white/10 dark:bg-white/5")
                    }
                  >
                    <input type="radio" name={`${id}-ch`} className="h-5 w-5 accent-brand-700" checked={channel === c} onChange={() => setChannel(c)} />
                    {t(c === "email" ? "remind.email" : "remind.sms")}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div>
            <label htmlFor={`${id}-contact`} className="block text-sm font-semibold">
              {t(channel === "email" ? "remind.emailLabel" : "remind.phoneLabel")}
            </label>
            <input
              id={`${id}-contact`}
              className="input mt-1"
              type={channel === "email" ? "email" : "tel"}
              autoComplete={channel === "email" ? "email" : "tel"}
              inputMode={channel === "email" ? "email" : "tel"}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              required
              maxLength={254}
            />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-brand-700" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>{t(channel === "email" ? "remind.consentEmail" : "remind.consentSms")}</span>
          </label>
          {status === "error" && (
            <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">
              {error}
            </p>
          )}
          <button type="submit" className="btn-primary" disabled={status === "sending" || !contact.trim()}>
            {status === "sending" ? t("form.loading") : t("remind.submit")}
          </button>
          <p className="muted text-xs">{t("remind.privacy")}</p>
        </form>
      )}
    </section>
  );
}
