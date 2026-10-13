import React, { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../i18n/useLanguage.js";
import { getLocale } from "../../i18n/locale.js";
import { t } from "../../i18n/translate.js";

export default function SessionCountdown({ startsAt, now: suppliedNow, onStart }) {
  useLanguage();
  const [clock, setClock] = useState(() => Date.now());
  const locale = getLocale();
  const formats = useMemo(() => ["hour", "minute", "second"].map((unit, index) =>
    new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: "short", minimumIntegerDigits: index ? 2 : 1 })
  ), [locale]);

  useEffect(() => {
    if (suppliedNow != null) return undefined;
    let reportedStart = false;
    const update = () => {
      const current = Date.now();
      setClock(current);
      if (!reportedStart && current >= startsAt) {
        reportedStart = true;
        clearInterval(timer);
        onStart?.(current);
      }
    };
    // Read the clock again each tick, so a suspended tab never accumulates drift.
    const timer = setInterval(update, 1000);
    const resume = () => { if (!document.hidden) update(); };
    update();
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", resume);
    return () => {
      clearInterval(timer);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", resume);
    };
  }, [startsAt, suppliedNow, onStart]);

  const remaining = Math.max(0, Math.ceil((startsAt - (suppliedNow ?? clock)) / 1000));
  const duration = [Math.floor(remaining / 3600), Math.floor(remaining % 3600 / 60), remaining % 60]
    .map((value, index) => formats[index].format(value)).join(" ");
  return <span className="nxt5-home-countdown" role="timer" aria-live="off">
    {remaining > 0 ? `${t("Dans")} ${duration}` : t("En ce moment")}
  </span>;
}
