// Turns Supabase Auth error messages into short Portuguese messages.
export function translateAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : "";
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar. Procure o link na sua caixa de entrada (e no spam).";
  if (m.includes("user already registered") || m.includes("already been registered")) return "Já existe uma conta com esse e-mail. Tente entrar.";
  if (m.includes("password should be at least") || m.includes("weak password")) return "A senha é muito fraca. Use pelo menos 6 caracteres.";
  if (m.includes("same password") || m.includes("different from the old")) return "A nova senha precisa ser diferente da anterior.";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes")) return "Muitas tentativas. Aguarde um pouco e tente de novo.";
  if (m.includes("email provider is disabled") || m.includes("signups not allowed") || m.includes("email logins are disabled")) return "O login por e-mail está desativado no Supabase. Ative o provedor Email em Authentication → Providers.";
  if (m.includes("invalid email") || m.includes("unable to validate email")) return "Digite um e-mail válido.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Sem conexão com o servidor. Verifique sua internet.";
  return message || "Algo deu errado. Tente novamente.";
}
