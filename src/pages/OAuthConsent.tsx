import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Loader2, Shield, Check, X, Eye, EyeOff } from "lucide-react";
import CountryCodeSelect from "@/components/CountryCodeSelect";
import trainerLogo from "@/assets/trainer-logo.png";

// Tiny typed wrapper for the beta auth.oauth namespace.
interface OAuthAuthorizationDetails {
  client?: { name: string; uri?: string } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
  scopes?: string[];
  scope?: string;
}
interface OAuthApi {
  getAuthorizationDetails: (id: string) => Promise<{
    data?: OAuthAuthorizationDetails | null;
    error?: { message: string } | null;
  }>;
  approveAuthorization: (id: string) => Promise<{
    data?: { redirect_url?: string | null; redirect_to?: string | null } | null;
    error?: { message: string } | null;
  }>;
  denyAuthorization: (id: string) => Promise<{
    data?: { redirect_url?: string | null; redirect_to?: string | null } | null;
    error?: { message: string } | null;
  }>;
}
const oauthApi = (): OAuthApi => (supabase.auth as any).oauth;

const phoneToEmail = (countryCode: string, phone: string) => {
  const digits = `${countryCode}${phone}`.replace(/[^0-9]/g, "");
  return `${digits}@phone.fitness.local`;
};

export default function OAuthConsent() {
  const [searchParams] = useSearchParams();
  const authorizationId = searchParams.get("authorization_id") ?? "";

  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [details, setDetails] = useState<OAuthAuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [loginMode, setLoginMode] = useState<"phone" | "email">("phone");
  const [countryCode, setCountryCode] = useState("+357");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!active) return;
      setHasSession(!!session);
      setSessionChecked(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!sessionChecked || !hasSession || !authorizationId) return;
    let active = true;
    (async () => {
      const api = oauthApi();
      if (!api) {
        setError("OAuth consent is not available. Please contact support.");
        return;
      }
      const { data, error: detailsError } = await api.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (detailsError) {
        setError(detailsError.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data ?? null);
    })();
    return () => {
      active = false;
    };
  }, [sessionChecked, hasSession, authorizationId]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    if (!password) {
      setLoginError("Введите пароль / Enter your password");
      return;
    }
    if (loginMode === "phone" && (!phone.trim() || phone.length < 5)) {
      setLoginError("Введите корректный номер телефона / Enter a valid phone number");
      return;
    }
    if (loginMode === "email" && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setLoginError("Введите корректный email / Enter a valid email");
      return;
    }
    setLoginSubmitting(true);
    try {
      const emailForAuth =
        loginMode === "phone" ? phoneToEmail(countryCode, phone) : email.trim().toLowerCase();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: emailForAuth,
        password,
      });
      if (signInError) throw signInError;
      // Preserve the consent URL by reloading it after login.
      window.location.href = window.location.pathname + window.location.search;
    } catch (err: any) {
      setLoginSubmitting(false);
      if (err.message?.includes("Invalid login credentials")) {
        setLoginError("Неверные данные для входа / Wrong credentials");
      } else {
        setLoginError(err.message);
      }
    }
  }

  async function handleGoogleSignIn() {
    setLoginSubmitting(true);
    // Preserve the consent URL so the app can return here after the Google OAuth round-trip.
    try {
      sessionStorage.setItem("mcp_consent_return_url", window.location.href);
    } catch {
      /* ignore storage errors */
    }
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setLoginSubmitting(false);
      setLoginError(result.error.message);
    }
  }


  async function decide(approve: boolean) {
    setBusy(true);
    const api = oauthApi();
    if (!api) {
      setError("OAuth consent is not available.");
      setBusy(false);
      return;
    }
    const { data, error: decisionError } = approve
      ? await api.approveAuthorization(authorizationId)
      : await api.denyAuthorization(authorizationId);
    if (decisionError) {
      setBusy(false);
      setError(decisionError.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  const inputClass =
    "w-full bg-secondary/50 border border-border/50 rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50";

  if (!sessionChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-5">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!authorizationId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-5">
        <div className="bg-card border border-border/50 rounded-3xl p-6 max-w-sm w-full text-center">
          <p className="text-sm text-muted-foreground">
            Некорректный запрос авторизации / Invalid authorization request
          </p>
        </div>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-5">
        <div className="bg-card border border-border/50 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-6 space-y-5">
          <div className="text-center space-y-2">
            <img src={trainerLogo} alt="Limassol Fitness" className="w-12 h-12 rounded-2xl mx-auto" />
            <h1 className="text-lg font-extrabold font-heading uppercase tracking-tight">
              Вход в приложение / Sign in
            </h1>
            <p className="text-xs text-muted-foreground">
              Чтобы разрешить доступ внешнему ассистенту, войдите в аккаунт
            </p>
          </div>

          <button
            onClick={handleGoogleSignIn}
            disabled={loginSubmitting}
            className="w-full bg-[hsl(0,0%,100%)] text-[hsl(0,0%,20%)] font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Войти через Google / Continue with Google
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border/50" />
            <span className="text-[10px] text-muted-foreground uppercase">или / or</span>
            <div className="flex-1 h-px bg-border/50" />
          </div>

          <form onSubmit={handleLogin} className="space-y-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLoginMode("phone")}
                className={`flex-1 py-2 text-xs rounded-lg border ${
                  loginMode === "phone" ? "bg-primary/20 border-primary/50" : "bg-secondary/50 border-border/50"
                }`}
              >
                Телефон
              </button>
              <button
                type="button"
                onClick={() => setLoginMode("email")}
                className={`flex-1 py-2 text-xs rounded-lg border ${
                  loginMode === "email" ? "bg-primary/20 border-primary/50" : "bg-secondary/50 border-border/50"
                }`}
              >
                Email
              </button>
            </div>

            {loginMode === "phone" ? (
              <CountryCodeSelect
                value={countryCode}
                onChange={setCountryCode}
                phoneNumber={phone}
                onPhoneChange={setPhone}
                placeholder="Phone"
              />
            ) : (

              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                autoComplete="email"
              />
            )}

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Пароль / Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {loginError && (
              <p className="text-xs px-1 py-2 rounded-lg text-center text-destructive bg-destructive/10">
                {loginError}
              </p>
            )}

            <button
              type="submit"
              disabled={loginSubmitting}
              className="w-full gradient-primary text-primary-foreground font-semibold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loginSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Войти / Sign in</span>}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-5">
        <div className="bg-card border border-border/50 rounded-3xl p-6 max-w-sm w-full text-center space-y-4">
          <Shield className="w-10 h-10 text-destructive mx-auto" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-5">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const clientName = details.client?.name ?? "Внешний ассистент / External assistant";
  const redirectHost = details.redirect_url ? new URL(details.redirect_url).host : undefined;
  const scopes = details.scopes?.length
    ? details.scopes
    : details.scope
      ? details.scope.split(" ").filter(Boolean)
      : ["openid", "email", "profile"];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-5">
      <PageHead
        title="Connect your account — Limassol Fitness"
        description="Authorize a third-party app to access your Limassol Fitness account data securely."
        path="/.lovable/oauth/consent"
        noIndex
      />

      <div className="bg-card border border-border/50 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-6 space-y-5">
        <div className="text-center space-y-2">
          <img src={trainerLogo} alt="Limassol Fitness" className="w-12 h-12 rounded-2xl mx-auto" />
          <h1 className="text-lg font-extrabold font-heading uppercase tracking-tight">
            Подключение / Connect
          </h1>
        </div>

        <div className="bg-secondary/50 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-medium">
            <span className="text-primary">{clientName}</span> запрашивает доступ к вашему аккаунту Limassol Fitness
          </p>
          {redirectHost && (
            <p className="text-xs text-muted-foreground">Будет перенаправлено на / Will redirect to: {redirectHost}</p>
          )}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Доступ / Access</p>
            <ul className="text-xs text-foreground space-y-1">
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                Чтение данных профиля / Read profile
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                Чтение данных тренировок, питания и замеров / Read training, nutrition and body data
              </li>
            </ul>
          </div>
          {scopes.length > 0 && (
            <p className="text-[10px] text-muted-foreground">Scopes: {scopes.join(", ")}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => decide(false)}
            disabled={busy}
            className="py-3 rounded-xl border border-border/50 font-semibold text-sm hover:bg-secondary/50 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" />
            Отклонить / Deny
          </button>
          <button
            onClick={() => decide(true)}
            disabled={busy}
            className="py-3 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Разрешить / Approve
          </button>
        </div>
      </div>
    </div>
  );
}
