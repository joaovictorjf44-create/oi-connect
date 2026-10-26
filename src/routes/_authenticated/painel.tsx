import { createFileRoute } from "@tanstack/react-router";

import { FinanceDashboard } from "@/components/FinanceDashboard";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel financeiro | Minha Gestão Pessoal" },
      { name: "description", content: "Acompanhe entradas, saídas, dívidas, metas e contas da sua barbearia." },
      { property: "og:title", content: "Painel financeiro | Minha Gestão Pessoal" },
      { property: "og:description", content: "Acompanhe entradas, saídas, dívidas, metas e contas da sua barbearia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PainelPage,
});

function PainelPage() {
  const { user } = Route.useRouteContext();
  return <FinanceDashboard key={user.id} user={user} />;
}
