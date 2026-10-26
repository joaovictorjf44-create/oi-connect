import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";

import { AuthShell, authInputClass, authPrimaryButtonClass } from "@/components/AuthShell";
import { supabase } from "@/integrations/supabase/client";
import { translateAuthError } from "@/lib/auth-errors";

type Mode = "login" | "signup" | "forgot";

function safeRedirect(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/painel";
}

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search["redirect"] === "string" ? { redirect: search["redirect"] } : {},
  head: () => ({
    meta: [
      { title: "Entrar | Minha Gestão Pessoal" },
      { name: "description", content: "Entre ou crie sua conta para acessar seu controle financeiro com segurança." },
      { property: "og:title", content: "Entrar | Minha Gestão Pessoal" },
      { property: "og:description", content: "Entre ou crie sua conta para acessar seu controle financeiro com segurança." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const target = safeRedirect(search.redirect);
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  // Already signed in (or just confirmed the e-mail link): go straight to the dashboard.
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) navigate({ to: target, replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: target, replace: true });
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [navigate, target]);

  function switchMode(next: Mode) {
    setMode(next); setError(""); setInfo(""); setPassword(""); setConfirm("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setInfo("");
    const cleanEmail = email.trim();
    if (mode === "signup" && password !== confirm) { setError("As senhas não são iguais."); return; }
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) throw error;
        navigate({ to: target, replace: true });
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { emailRedirectTo: window.location.origin + "/auth" },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: target, replace: true });
        } else {
          setInfo("Conta criada! Enviamos um link de confirmação para " + cleanEmail + ". Abra o e-mail, confirme e depois entre aqui.");
          setMode("login"); setPassword(""); setConfirm("");
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (error) throw error;
        setInfo("Se esse e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.");
      }
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<Mode, [string, string]> = {
    login: ["Entrar", "Acesse seu controle financeiro."],
    signup: ["Criar conta", "Seus dados ficam guardados só para você."],
    forgot: ["Recuperar senha", "Informe seu e-mail para receber o link de nova senha."],
  };

  return (
    <AuthShell title={titles[mode][0]} subtitle={titles[mode][1]}>
      {mode !== "forgot" && (
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-blue-400/15 bg-[#050914] p-1 text-sm" role="tablist">
          <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => switchMode("login")} className={`rounded-lg px-3 py-2 font-semibold transition ${mode === "login" ? "bg-blue-500/15 text-cyan-200" : "text-slate-400 hover:text-slate-200"}`}>Entrar</button>
          <button type="button" role="tab" aria-selected={mode === "signup"} onClick={() => switchMode("signup")} className={`rounded-lg px-3 py-2 font-semibold transition ${mode === "signup" ? "bg-blue-500/15 text-cyan-200" : "text-slate-400 hover:text-slate-200"}`}>Criar conta</button>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm text-slate-300">E-mail
          <input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" className={authInputClass} />
        </label>
        {mode !== "forgot" && (
          <label className="block text-sm text-slate-300">Senha
            <input required type="password" minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className={authInputClass} />
          </label>
        )}
        {mode === "signup" && (
          <label className="block text-sm text-slate-300">Confirmar senha
            <input required type="password" minLength={6} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repita a senha" className={authInputClass} />
          </label>
        )}
        {error && <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300" role="alert">{error}</p>}
        {info && <p className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-200" role="status">{info}</p>}
        <button disabled={busy} className={authPrimaryButtonClass}>
          {busy ? "Aguarde..." : mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link de recuperação"}
        </button>
      </form>
      <div className="mt-5 text-center text-sm">
        {mode === "login" && <button type="button" onClick={() => switchMode("forgot")} className="text-cyan-300 hover:underline">Esqueci minha senha</button>}
        {mode === "forgot" && <button type="button" onClick={() => switchMode("login")} className="text-cyan-300 hover:underline">Voltar para o login</button>}
      </div>
    </AuthShell>
  );
}
