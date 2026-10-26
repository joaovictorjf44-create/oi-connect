import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";

import { AuthShell, authInputClass, authPrimaryButtonClass } from "@/components/AuthShell";
import { supabase } from "@/integrations/supabase/client";
import { translateAuthError } from "@/lib/auth-errors";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nova senha | Minha Gestão Pessoal" },
      { name: "description", content: "Crie uma nova senha para sua conta do Minha Gestão Pessoal." },
      { property: "og:title", content: "Nova senha | Minha Gestão Pessoal" },
      { property: "og:description", content: "Crie uma nova senha para sua conta do Minha Gestão Pessoal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [checked, setChecked] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // The recovery link signs the person in temporarily (type=recovery in the URL).
  useEffect(() => {
    const isRecoveryLink = window.location.hash.includes("type=recovery") || window.location.search.includes("code=");
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) { setReady(true); setChecked(true); }
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      if (!isRecoveryLink || data.session) setChecked(true);
      else window.setTimeout(() => setChecked(true), 2500);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirm) { setError("As senhas não são iguais."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      window.setTimeout(() => navigate({ to: "/painel", replace: true }), 1500);
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  if (!checked) {
    return <AuthShell title="Nova senha" subtitle="Verificando seu link..."><div className="h-10" /></AuthShell>;
  }

  if (!ready) {
    return (
      <AuthShell title="Link inválido ou expirado" subtitle="Peça um novo link de recuperação na tela de login.">
        <button onClick={() => navigate({ to: "/auth" })} className={authPrimaryButtonClass}>Voltar para o login</button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Criar nova senha" subtitle="Escolha uma senha nova para sua conta.">
      {done ? (
        <p className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-300" role="status">Senha alterada! Abrindo seu painel...</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm text-slate-300">Nova senha
            <input required type="password" minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className={authInputClass} />
          </label>
          <label className="block text-sm text-slate-300">Confirmar nova senha
            <input required type="password" minLength={6} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repita a senha" className={authInputClass} />
          </label>
          {error && <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300" role="alert">{error}</p>}
          <button disabled={busy} className={authPrimaryButtonClass}>{busy ? "Salvando..." : "Salvar nova senha"}</button>
        </form>
      )}
    </AuthShell>
  );
}
