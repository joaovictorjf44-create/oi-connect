import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft, ArrowUpRight, Wallet, Plus, Scissors, Trash2,
  CalendarDays, TrendingUp, TrendingDown, CircleDollarSign, X, Menu,
  LayoutDashboard, ReceiptText, ChartNoAxesCombined, CreditCard, Banknote,
  Smartphone, ChevronDown, CheckCircle2
} from "lucide-react";

export const Route = createFileRoute("/")({ component: FinanceDashboard });

type Movement = {
  id: string;
  type: "entrada" | "saida";
  description: string;
  category: string;
  amount: number;
  payment: string;
  date: string;
  note?: string;
};

const STORAGE_KEY = "gestao-financeira-pra-mim-movements";
const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const todayISO = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

function FinanceDashboard() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [period, setPeriod] = useState<"today" | "month" | "all">("today");
  const [modal, setModal] = useState<"entrada" | "saida" | null>(null);
  const [description, setDescription] = useState("Corte de cabelo");
  const [amount, setAmount] = useState("30");
  const [category, setCategory] = useState("Corte");
  const [payment, setPayment] = useState("Pix");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setMovements(JSON.parse(saved) as Movement[]);
    } catch {
      setMovements([]);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(movements));
  }, [movements, loaded]);

  const filtered = useMemo(() => movements.filter((item) => {
    if (period === "today") return item.date === todayISO();
    if (period === "month") return item.date.slice(0, 7) === todayISO().slice(0, 7);
    return true;
  }), [movements, period]);

  const income = filtered.filter((m) => m.type === "entrada").reduce((sum, m) => sum + m.amount, 0);
  const expenses = filtered.filter((m) => m.type === "saida").reduce((sum, m) => sum + m.amount, 0);
  const balance = income - expenses;
  const cuts = filtered.filter((m) => m.type === "entrada" && m.category === "Corte").length;
  const avg = cuts ? filtered.filter((m) => m.type === "entrada" && m.category === "Corte").reduce((sum, m) => sum + m.amount, 0) / cuts : 0;
  const monthIncome = movements.filter((m) => m.type === "entrada" && m.date.slice(0, 7) === todayISO().slice(0, 7)).reduce((sum, m) => sum + m.amount, 0);
  const monthExpenses = movements.filter((m) => m.type === "saida" && m.date.slice(0, 7) === todayISO().slice(0, 7)).reduce((sum, m) => sum + m.amount, 0);

  const monthlyTrend = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, index) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
      const monthMovements = movements.filter((m) => m.date.slice(0, 7) === key);
      const monthIncome = monthMovements.filter((m) => m.type === "entrada").reduce((sum, m) => sum + m.amount, 0);
      const monthExpenses = monthMovements.filter((m) => m.type === "saida").reduce((sum, m) => sum + m.amount, 0);
      return {
        key,
        label: monthDate.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        income: monthIncome,
        expenses: monthExpenses,
        profit: monthIncome - monthExpenses,
      };
    });
  }, [movements]);
  const trendMax = Math.max(1, ...monthlyTrend.flatMap((month) => [month.income, month.expenses]));
  const profitMax = Math.max(1, ...monthlyTrend.map((month) => Math.abs(month.profit)));

  function openModal(type: "entrada" | "saida", quickCut = false) {
    setModal(type);
    setDescription(quickCut ? "Corte de cabelo" : "");
    setAmount(quickCut ? "30" : "");
    setCategory(quickCut ? "Corte" : type === "entrada" ? "Outro serviço" : "Materiais");
    setPayment("Pix");
    setDate(todayISO());
    setNote("");
  }

  function saveMovement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericAmount = Number(amount.replace(",", "."));
    if (!description.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) return;
    const item: Movement = {
      id: crypto.randomUUID(),
      type: modal ?? "entrada",
      description: description.trim(),
      category,
      amount: numericAmount,
      payment,
      date,
      note: note.trim() || undefined,
    };
    setMovements((current) => [item, ...current]);
    setModal(null);
  }

  const paymentIcon = (method: string) => {
    if (method === "Pix") return <Smartphone size={15} />;
    if (method === "Dinheiro") return <Banknote size={15} />;
    return <CreditCard size={15} />;
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 border-r border-slate-200 bg-white p-5 transition-transform lg:translate-x-0 ${mobileMenu ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-700 text-white"><Scissors size={22} /></div>
          <div><p className="font-bold tracking-tight">Gestão Financeira</p><p className="text-xs text-slate-500">pra mim · barbearia</p></div>
          <button className="ml-auto lg:hidden" onClick={() => setMobileMenu(false)} aria-label="Fechar menu"><X size={20} /></button>
        </div>
        <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[.16em] text-slate-400">Menu principal</p>
        <div className="flex items-center gap-3 rounded-xl bg-blue-50 px-3 py-3 font-semibold text-blue-800"><LayoutDashboard size={19} /> Visão geral</div>
        <button onClick={() => { setPeriod("all"); setMobileMenu(false); }} className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-slate-600 hover:bg-slate-50"><ReceiptText size={19} /> Movimentações</button>
        <button onClick={() => { setPeriod("month"); setMobileMenu(false); }} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-slate-600 hover:bg-slate-50"><ChartNoAxesCombined size={19} /> Resumo mensal</button>
        <div className="absolute bottom-5 left-5 right-5 rounded-2xl bg-slate-900 p-4 text-white">
          <div className="mb-2 flex items-center gap-2 text-blue-200"><Scissors size={16} /><span className="text-xs font-semibold">Seu negócio, organizado</span></div>
          <p className="text-sm text-slate-300">Registre cada entrada e despesa para acompanhar seu dinheiro.</p>
        </div>
      </aside>
      {mobileMenu && <button className="fixed inset-0 z-20 bg-slate-950/30 lg:hidden" onClick={() => setMobileMenu(false)} aria-label="Fechar menu" />}
      <main className="min-w-0 lg:ml-64">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-2 hover:bg-slate-100 lg:hidden" onClick={() => setMobileMenu(true)} aria-label="Abrir menu"><Menu size={21} /></button>
            <div><p className="text-sm text-slate-500">Olá, barbeiro 👋</p><h1 className="text-xl font-bold tracking-tight sm:text-2xl">Visão geral</h1></div>
          </div>
          <div className="hidden items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 sm:flex"><CalendarDays size={16} /> {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</div>
        </header>
        <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><p className="text-sm font-medium text-blue-700">SEU FINANCEIRO EM UM SÓ LUGAR</p><h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Controle seu dinheiro.</h2><p className="mt-1 text-slate-500">Veja quanto entrou, quanto saiu e quanto sobrou.</p></div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => openModal("saida")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"><ArrowUpRight size={17} className="text-rose-600" /> Registrar saída</button>
              <button onClick={() => openModal("entrada", true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"><Plus size={18} /> Registrar entrada</button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Saldo do período" value={money(balance)} icon={<Wallet size={20} />} tint="blue" caption="Entradas menos saídas" />
            <StatCard label="Total de entradas" value={money(income)} icon={<ArrowDownLeft size={20} />} tint="green" caption={period === "today" ? "Recebido hoje" : "Receitas registradas"} />
            <StatCard label="Total de saídas" value={money(expenses)} icon={<ArrowUpRight size={20} />} tint="red" caption={period === "today" ? "Despesas de hoje" : "Despesas registradas"} />
            <StatCard label="Cortes registrados" value={String(cuts)} icon={<Scissors size={20} />} tint="purple" caption={cuts ? `Média por corte: ${money(avg)}` : "Comece registrando um corte"} />
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <h3 className="font-bold">Gráficos financeiros</h3>
                <p className="mt-1 text-sm text-slate-500">Compare entradas, despesas e lucro dos últimos 6 meses.</p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs font-medium text-slate-600">
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Entradas</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose-500" /> Despesas</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-600" /> Lucro</span>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
              {monthlyTrend.map((month) => (
                <div key={month.key} className="min-w-0">
                  <div className="flex h-36 items-end justify-center gap-2 border-b border-slate-200 px-1">
                    <div className="flex h-full w-1/3 flex-col justify-end" title={`Entradas: ${money(month.income)}`}>
                      <div className="w-full rounded-t-md bg-emerald-500 transition-all" style={{ height: `${(month.income / trendMax) * 100}%`, minHeight: month.income > 0 ? "4px" : "0" }} />
                    </div>
                    <div className="flex h-full w-1/3 flex-col justify-end" title={`Despesas: ${money(month.expenses)}`}>
                      <div className="w-full rounded-t-md bg-rose-500 transition-all" style={{ height: `${(month.expenses / trendMax) * 100}%`, minHeight: month.expenses > 0 ? "4px" : "0" }} />
                    </div>
                  </div>
                  <p className="mt-2 text-center text-xs font-semibold capitalize text-slate-600">{month.label}</p>
                  <p className={`mt-1 truncate text-center text-xs font-bold ${month.profit >= 0 ? "text-blue-700" : "text-rose-700"}`} title={`Lucro: ${money(month.profit)}`}>{money(month.profit)}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100" title={`Resultado: ${money(month.profit)}`}>
                    <div className={`h-full rounded-full ${month.profit >= 0 ? "bg-blue-600" : "bg-rose-500"}`} style={{ width: `${(Math.abs(month.profit) / profitMax) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-400">O lucro mostrado é calculado como entradas menos despesas registradas. Meses sem lançamentos aparecem zerados.</p>
          </section>

          <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h3 className="font-bold">Movimentações</h3><p className="mt-1 text-sm text-slate-500">Acompanhe seu dinheiro por período.</p></div>
                <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
                  {([{key:"today",label:"Hoje"},{key:"month",label:"Este mês"},{key:"all",label:"Tudo"}] as const).map((item) => <button key={item.key} onClick={() => setPeriod(item.key)} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${period === item.key ? "bg-white text-blue-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{item.label}</button>)}
                </div>
              </div>
              <div className="mt-5 space-y-1">
                {filtered.length === 0 ? <div className="flex flex-col items-center py-12 text-center"><div className="mb-3 rounded-2xl bg-blue-50 p-4 text-blue-700"><ReceiptText size={25} /></div><p className="font-semibold">Nenhuma movimentação por aqui</p><p className="mt-1 max-w-xs text-sm text-slate-500">Registre seu primeiro corte ou uma despesa para começar a acompanhar seu financeiro.</p><button onClick={() => openModal("entrada", true)} className="mt-4 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"><Plus size={16} className="mr-1 inline" /> Registrar primeiro corte</button></div> :
                  filtered.slice(0, 12).map((m) => <div key={m.id} className="group flex items-center gap-3 border-b border-slate-100 py-3 last:border-0">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${m.type === "entrada" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{m.type === "entrada" ? <ArrowDownLeft size={19} /> : <ArrowUpRight size={19} />}</div>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{m.description}</p><p className="mt-0.5 text-xs text-slate-500">{m.category} · {new Date(m.date + "T12:00:00").toLocaleDateString("pt-BR")} · {m.payment}</p></div>
                    <div className="text-right"><p className={`text-sm font-bold ${m.type === "entrada" ? "text-emerald-700" : "text-rose-700"}`}>{m.type === "entrada" ? "+" : "−"}{money(m.amount)}</p><button onClick={() => setMovements((current) => current.filter((x) => x.id !== m.id))} className="mt-1 text-xs text-slate-400 opacity-100 hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100"><Trash2 size={13} className="inline" /> Excluir</button></div>
                  </div>)}
              </div>
            </section>

            <div className="space-y-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-center justify-between"><div><h3 className="font-bold">Resumo do mês</h3><p className="mt-1 text-sm text-slate-500">Visão geral do mês atual</p></div><div className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><ChartNoAxesCombined size={20} /></div></div>
                <div className="mt-5 space-y-4">
                  <ProgressRow label="Entradas" value={monthIncome} max={Math.max(monthIncome, monthExpenses, 1)} color="bg-emerald-500" />
                  <ProgressRow label="Saídas" value={monthExpenses} max={Math.max(monthIncome, monthExpenses, 1)} color="bg-rose-500" />
                </div>
                <div className="mt-5 rounded-xl bg-slate-50 p-4"><p className="text-sm text-slate-500">Resultado do mês</p><p className={`mt-1 text-2xl font-bold ${monthIncome - monthExpenses >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{money(monthIncome - monthExpenses)}</p></div>
              </section>
              <section className="rounded-2xl bg-gradient-to-br from-blue-800 to-slate-900 p-5 text-white shadow-sm sm:p-6">
                <div className="flex items-center gap-2 text-blue-200"><CircleDollarSign size={20} /><span className="text-sm font-semibold">Meta de atendimento</span></div>
                <p className="mt-3 text-2xl font-bold">R$ 30,00 <span className="text-sm font-medium text-blue-200">/ corte</span></p>
                <p className="mt-1 text-sm text-blue-100">Preço padrão do corte.</p>
                <button onClick={() => openModal("entrada", true)} className="mt-4 w-full rounded-xl bg-white px-4 py-3 text-sm font-bold text-blue-900 hover:bg-blue-50"><Scissors size={16} className="mr-2 inline" /> Registrar um corte</button>
              </section>
            </div>
          </div>
          <p className="text-center text-xs text-slate-400">Gestão Financeira pra Mim · Feito para facilitar sua rotina na barbearia.</p>
        </div>
      </main>

      {modal && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
        <form onSubmit={saveMovement} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7">
          <div className="mb-6 flex items-start justify-between"><div><div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-2xl ${modal === "entrada" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{modal === "entrada" ? <ArrowDownLeft size={22} /> : <ArrowUpRight size={22} />}</div><h2 className="text-xl font-bold">{modal === "entrada" ? "Registrar entrada" : "Registrar saída"}</h2><p className="mt-1 text-sm text-slate-500">Preencha os dados da movimentação.</p></div><button type="button" onClick={() => setModal(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Fechar"><X size={20} /></button></div>
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-slate-700">Descrição<input required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Corte de cabelo" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-semibold text-slate-700">Valor (R$)<input required min="0.01" step="0.01" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="27,00" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>
              <label className="block text-sm font-semibold text-slate-700">Data<input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>
            </div>
            <label className="block text-sm font-semibold text-slate-700">Categoria<select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">{(modal === "entrada" ? ["Corte","Barba","Combo corte e barba","Sobrancelha","Gorjeta","Venda de produto","Outro serviço"] : ["Materiais","Aluguel","Água e energia","Internet","Manutenção","Transporte","Alimentação","Outras despesas"]).map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="block text-sm font-semibold text-slate-700">Forma de pagamento<select value={payment} onChange={(e) => setPayment(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">{["Pix","Dinheiro","Cartão de débito","Cartão de crédito","Transferência","Outro"].map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="block text-sm font-semibold text-slate-700">Observação (opcional)<textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Algum detalhe..." className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 px-3.5 py-3 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>
          </div>
          <div className="mt-6 flex gap-3"><button type="button" onClick={() => setModal(null)} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button><button type="submit" className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold text-white ${modal === "entrada" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"}`}><CheckCircle2 size={17} className="mr-2 inline" /> Salvar movimentação</button></div>
        </form>
      </div>}
    </div>
  );
}

function StatCard({ label, value, icon, tint, caption }: { label: string; value: string; icon: React.ReactNode; tint: string; caption: string }) {
  const colors: Record<string, string> = { blue: "bg-blue-50 text-blue-700", green: "bg-emerald-50 text-emerald-700", red: "bg-rose-50 text-rose-700", purple: "bg-violet-50 text-violet-700" };
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{label}</p><div className={`rounded-xl p-2.5 ${colors[tint]}`}>{icon}</div></div><p className="mt-4 text-2xl font-bold tracking-tight sm:text-[1.7rem]">{value}</p><p className="mt-1 text-xs text-slate-400">{caption}</p></div>;
}

function ProgressRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return <div><div className="mb-2 flex items-center justify-between text-sm"><span className="font-medium text-slate-600">{label}</span><span className="font-bold text-slate-800">{money(value)}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></div></div>;
}
