import { createFileRoute, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

// "/" sends signed-in people to the dashboard and everyone else to the login page.
export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Minha Gestão Pessoal — controle financeiro" },
      { name: "description", content: "Controle entradas, saídas, dívidas e metas da sua barbearia com login seguro." },
      { property: "og:title", content: "Minha Gestão Pessoal — controle financeiro" },
      { property: "og:description", content: "Controle entradas, saídas, dívidas e metas da sua barbearia com login seguro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    throw redirect({ to: data.session ? "/painel" : "/auth", replace: true });
  },
  component: () => null,
});
