import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { onConsentBannerNeeded, setAdsConsent } from "@/lib/gtag";

const ConsentBanner = () => {
  const [visible, setVisible] = useState(false);
  const { lang } = useLanguage();

  useEffect(() => {
    onConsentBannerNeeded(() => setVisible(true));
    const reopen = () => setVisible(true);
    window.addEventListener("open-consent-settings", reopen);
    return () => window.removeEventListener("open-consent-settings", reopen);
  }, []);

  const choose = (choice: "granted" | "denied") => {
    setAdsConsent(choice);
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          className="fixed inset-x-3 bottom-3 z-[95] md:inset-x-auto md:right-6 md:bottom-6 md:max-w-sm"
          style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
          role="dialog"
          aria-label={lang === "en" ? "Cookie consent" : "Настройки cookies"}
        >
          <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-2xl">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <Cookie className="w-4 h-4 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {lang === "en"
                  ? "We use cookies for visit statistics and to measure our ads (Google Analytics / Google Ads). You can change your choice anytime at the bottom of the Contacts section."
                  : "Мы используем cookies для статистики посещений и измерения рекламы (Google Analytics / Google Ads). Вы можете изменить выбор в любой момент внизу раздела «Контакты»."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => choose("denied")}
                className="h-10 rounded-xl border border-border/60 text-sm font-semibold text-foreground hover:bg-muted/50 active:scale-[0.98] transition-all"
              >
                {lang === "en" ? "Decline" : "Отклонить"}
              </button>
              <button
                onClick={() => choose("granted")}
                className="h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
              >
                {lang === "en" ? "Accept" : "Принять"}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ConsentBanner;
