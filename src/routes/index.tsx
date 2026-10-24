import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft, ArrowUpRight, Wallet, Plus, Scissors, Trash2,
  CalendarDays, TrendingUp, TrendingDown, CircleDollarSign, X, Menu,
  LayoutDashboard, ReceiptText, ChartNoAxesCombined, CreditCard, Banknote,
  Smartphone, ChevronDown, CheckCircle2, BadgeDollarSign, CalendarClock, CircleAlert, Check, HandCoins
} from "lucide-react";

export const Route = createFileRoute("/")({ component: FinanceDashboard });

type Debt = {
  id: string;
  name: string;
  creditor: string;
  amount: number;
  dueDate: string;
  category: string;
  note?: string;
  paid: boolean;
};

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
const DEBTS_STORAGE_KEY = "gestao-financeira-pra-mim-debts";
const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const todayISO = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const shiftISODate = (iso: string, days: number) => {
  const date = new Date(iso + "T12:00:00");
  date.setDate(date.getDate() + days);
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
};
const weekStartISO = () => {
  const today = todayISO();
  const day = new Date(today + "T12:00:00").getDay();
  return shiftISODate(today, -((day + 6) % 7));
};
const weekEndISO = () => shiftISODate(weekStartISO(), 6);

function FinanceDashboard() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [period, setPeriod] = useState<"today" | "week" | "month" | "all">("today");
  const [modal, setModal] = useState<"entrada" | "saida" | null>(null);
  const [description, setDescription] = useState("Corte de cabelo");
  const [amount, setAmount] = useState("30");
  const [category, setCategory] = useState("Corte");
  const [payment, setPayment] = useState("Pix");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [debtName, setDebtName] = useState("");
  const [debtCreditor, setDebtCreditor] = useState("");
  const [debtAmount, setDebtAmount] = useState("");
  const [debtDueDate, setDebtDueDate] = useState("");
  const [debtCategory, setDebtCategory] = useState("Cartão de crédito");
  const [debtNote, setDebtNote] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setMovements(JSON.parse(saved) as Movement[]);
    } catch {
      setMovements([]);
    }
    try {
      const savedDebts = localStorage.getItem(DEBTS_STORAGE_KEY);
      if (savedDebts) setDebts(JSON.parse(savedDebts) as Debt[]);
    } catch {
      setDebts([]);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(movements));
      localStorage.setItem(DEBTS_STORAGE_KEY, JSON.stringify(debts));
    }
  }, [movements, debts, loaded]);

  const filtered = useMemo(() => movements.filter((item) => {
    if (period === "today") return item.date === todayISO();
    if (period === "week") return item.date >= weekStartISO() && item.date <= weekEndISO();
    if (period === "month") return item.date.slice(0, 7) === todayISO().slice(0, 7);
    return true;
  }), [movements, period]);

  const income = filtered.filter((m) => m.type === "entrada").reduce((sum, m) => sum + m.amount, 0);
  const expenses = filtered.filter((m) => m.type === "saida").reduce((sum, m) => sum + m.amount, 0);
  const balance = income - expenses;
  const unpaidDebts = debts.filter((debt) => !debt.paid);
  const debtTotal = unpaidDebts.reduce((sum, debt) => sum + debt.amount, 0);
  const paidDebtTotal = debts.filter((debt) => debt.paid).reduce((sum, debt) => sum + debt.amount, 0);
  const cuts = filtered.filter((m) => m.type === "entrada" && m.category === "Corte").length;
  const avg = cuts ? filtered.filter((m) => m.type === "entrada" && m.category === "Corte").reduce((sum, m) => sum + m.amount, 0) / cuts : 0;
  const monthIncome = movements.filter((m) => m.type === "entrada" && m.date.slice(0, 7) === todayISO().slice(0, 7)).reduce((sum, m) => sum + m.amount, 0);
  const monthExpenses = movements.filter((m) => m.type === "saida" && m.date.slice(0, 7) === todayISO().slice(0, 7)).reduce((sum, m) => sum + m.amount, 0);
  const weeklyMovements = movements.filter((m) => m.date >= weekStartISO() && m.date <= weekEndISO());
  const weeklyIncome = weeklyMovements.filter((m) => m.type === "entrada").reduce((sum, m) => sum + m.amount, 0);
  const weeklyExpenses = weeklyMovements.filter((m) => m.type === "saida").reduce((sum, m) => sum + m.amount, 0);
  const weeklyBalance = weeklyIncome - weeklyExpenses;
  const weeklyDays = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const dayDate = shiftISODate(weekStartISO(), index);
    const dayMovements = movements.filter((m) => m.date === dayDate);
    return {
      date: dayDate,
      label: new Date(dayDate + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
      income: dayMovements.filter((m) => m.type === "entrada").reduce((sum, m) => sum + m.amount, 0),
      expenses: dayMovements.filter((m) => m.type === "saida").reduce((sum, m) => sum + m.amount, 0),
      count: dayMovements.length,
    };
  }), [movements]);
  const weeklyMax = Math.max(1, ...weeklyDays.flatMap((day) => [day.income, day.expenses]));

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

  function saveDebt(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericAmount = Number(debtAmount.replace(",", "."));
    if (!debtName.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) return;
    const debt: Debt = {
      id: crypto.randomUUID(),
      name: debtName.trim(),
      creditor: debtCreditor.trim() || "Não informado",
      amount: numericAmount,
      dueDate: debtDueDate,
      category: debtCategory,
      note: debtNote.trim() || undefined,
      paid: false,
    };
    setDebts((current) => [debt, ...current]);
    setDebtName("");
    setDebtCreditor("");
    setDebtAmount("");
    setDebtDueDate("");
    setDebtCategory("Cartão de crédito");
    setDebtNote("");
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
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_rgba(29,78,216,0.16),_transparent_40%),linear-gradient(135deg,#050914_0%,#080f1e_50%,#070b14_100%)] text-slate-100">
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 border-r border-slate-800 bg-[#080d18] p-5 text-slate-100 transition-transform lg:translate-x-0 ${mobileMenu ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white"><Scissors size={22} /></div>
          <div><p className="bg-gradient-to-r from-white to-cyan-200 bg-clip-text font-bold tracking-tight text-transparent">Gestão Financeira</p><p className="text-xs text-slate-400">pra mim · barbearia</p></div>
          <button className="ml-auto lg:hidden" onClick={() => setMobileMenu(false)} aria-label="Fechar menu"><X size={20} /></button>
        </div>
        <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[.16em] text-slate-400">Menu principal</p>
        <div className="flex items-center gap-3 rounded-xl border border-blue-400/30 bg-blue-500/10 shadow-[0_0_18px_rgba(37,99,235,0.08)] px-3 py-3 font-semibold text-blue-300"><LayoutDashboard size={19} /> Visão geral</div>
        <button onClick={() => { setPeriod("all"); setMobileMenu(false); }} className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-slate-300 hover:bg-slate-800"><ReceiptText size={19} /> Movimentações</button>
        <button onClick={() => { setPeriod("month"); setMobileMenu(false); }} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-slate-300 hover:bg-slate-800"><ChartNoAxesCombined size={19} /> Resumo mensal</button>
        <button onClick={() => { setMobileMenu(false); document.getElementById("minhas-dividas")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-slate-300 hover:bg-slate-800"><BadgeDollarSign size={19} /> Minhas dívidas <span className="ml-auto rounded-full bg-blue-500/15 px-2 py-0.5 text-xs text-cyan-300">{unpaidDebts.length}</span></button>
        <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-slate-800 bg-[#050914] p-4 text-white">
          <div className="mb-2 flex items-center gap-2 text-cyan-200"><Scissors size={16} /><span className="text-xs font-semibold">Seu negócio, organizado</span></div>
          <p className="text-sm text-zinc-400">Registre cada entrada e despesa para acompanhar seu dinheiro.</p>
        </div>
      </aside>
      {mobileMenu && <button className="fixed inset-0 z-20 bg-slate-950/30 lg:hidden" onClick={() => setMobileMenu(false)} aria-label="Fechar menu" />}
      <main className="min-w-0 lg:ml-64">
        <header className="flex items-center justify-between border-b border-blue-400/15 bg-[#080f1e]/90 backdrop-blur-xl px-4 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-2 hover:bg-[#182235] lg:hidden" onClick={() => setMobileMenu(true)} aria-label="Abrir menu"><Menu size={21} /></button>
            <div><p className="text-sm font-semibold tracking-[0.18em] text-cyan-300">✦ SUA BARBEARIA, SOB CONTROLE</p><h1 className="text-xl font-bold tracking-tight sm:text-2xl">Visão geral</h1></div>
          </div>
          <div className="hidden items-center gap-2 rounded-xl border border-blue-400/20 bg-[#0b1220]/70 px-3 py-2 text-sm text-slate-300 sm:flex"><CalendarDays size={16} /> {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</div>
        </header>
        <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><p className="text-sm font-semibold tracking-[0.18em] text-cyan-300">SEU FINANCEIRO EM UM SÓ LUGAR</p><h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Controle seu dinheiro.</h2><p className="mt-1 text-slate-400">Veja quanto entrou, quanto saiu e quanto sobrou.</p></div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => openModal("saida")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-[#101827] px-4 py-3 text-sm font-semibold text-slate-200 shadow-sm hover:bg-[#0b1220]"><ArrowUpRight size={17} className="text-rose-600" /> Registrar saída</button>
              <button onClick={() => openModal("entrada", true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_0_22px_rgba(37,99,235,0.25)] transition hover:brightness-110"><Plus size={18} /> Registrar entrada</button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Saldo do período" value={money(balance)} icon={<Wallet size={20} />} tint="blue" caption="Entradas menos saídas" />
            <StatCard label="Total de entradas" value={money(income)} icon={<ArrowDownLeft size={20} />} tint="green" caption={period === "today" ? "Recebido hoje" : "Receitas registradas"} />
            <StatCard label="Total de saídas" value={money(expenses)} icon={<ArrowUpRight size={20} />} tint="red" caption={period === "today" ? "Despesas de hoje" : "Despesas registradas"} />
            <StatCard label="Cortes registrados" value={String(cuts)} icon={<Scissors size={20} />} tint="purple" caption={cuts ? `Média por corte: ${money(avg)}` : "Comece registrando um corte"} />
          </div>

          <section className="rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-[#111c30] to-[#0b1220] p-5 shadow-[0_0_32px_rgba(8,145,178,0.08)] sm:p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div><div className="flex items-center gap-2 text-cyan-300"><CalendarClock size={21} /><span className="text-xs font-bold uppercase tracking-[0.18em]">Fechamento semanal</span></div><h3 className="mt-2 text-xl font-bold">Total de lançamentos da semana</h3><p className="mt-1 text-sm text-slate-400">{new Date(weekStartISO() + "T12:00:00").toLocaleDateString("pt-BR")} até {new Date(weekEndISO() + "T12:00:00").toLocaleDateString("pt-BR")} · de segunda a domingo</p></div>
              <button onClick={() => setPeriod("week")} className="rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-200 hover:bg-cyan-400/15">Ver lançamentos da semana</button>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-blue-400/15 bg-[#080f1e] p-4"><p className="text-xs text-slate-400">Entradas da semana</p><p className="mt-1 text-xl font-bold text-emerald-300">{money(weeklyIncome)}</p></div>
              <div className="rounded-xl border border-blue-400/15 bg-[#080f1e] p-4"><p className="text-xs text-slate-400">Saídas da semana</p><p className="mt-1 text-xl font-bold text-rose-300">{money(weeklyExpenses)}</p></div>
              <div className="rounded-xl border border-blue-400/15 bg-[#080f1e] p-4"><p className="text-xs text-slate-400">Resultado semanal</p><p className={"mt-1 text-xl font-bold " + (weeklyBalance >= 0 ? "text-cyan-300" : "text-rose-300")}>{money(weeklyBalance)}</p></div>
              <div className="rounded-xl border border-blue-400/15 bg-[#080f1e] p-4"><p className="text-xs text-slate-400">Lançamentos registrados</p><p className="mt-1 text-xl font-bold text-white">{weeklyMovements.length}</p><p className="mt-1 text-xs text-slate-500">{weeklyMovements.filter((m) => m.type === "entrada").length} entradas · {weeklyMovements.filter((m) => m.type === "saida").length} saídas</p></div>
            </div>
            <div className="mt-6"><div className="mb-3 flex items-center justify-between"><h4 className="font-semibold">Movimento por dia</h4><div className="flex gap-3 text-xs text-slate-400"><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Entradas</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400" /> Saídas</span></div></div>
              <div className="grid grid-cols-7 gap-2 sm:gap-3">{weeklyDays.map((day) => <div key={day.date} className="min-w-0 rounded-xl bg-[#080f1e]/80 p-2 text-center sm:p-3"><p className="text-[10px] font-semibold uppercase text-slate-400 sm:text-xs">{day.label}</p><p className="mt-1 text-[10px] text-slate-500">{new Date(day.date + "T12:00:00").getDate()}</p><div className="mt-3 flex h-20 items-end justify-center gap-1 border-b border-slate-800 pb-1"><div title={"Entradas: " + money(day.income)} className="w-2/5 rounded-t bg-emerald-400 transition-all" style={{ height: (day.income / weeklyMax * 100) + "%", minHeight: day.income > 0 ? "4px" : "0" }} /><div title={"Saídas: " + money(day.expenses)} className="w-2/5 rounded-t bg-rose-400 transition-all" style={{ height: (day.expenses / weeklyMax * 100) + "%", minHeight: day.expenses > 0 ? "4px" : "0" }} /></div><p className="mt-2 text-[10px] font-semibold text-slate-300 sm:text-xs">{day.count} {day.count === 1 ? "item" : "itens"}</p></div>)}</div>
            </div>
          </section>
          <section className="rounded-2xl border border-blue-400/20 bg-gradient-to-br from-[#111c30] to-[#0b1220] p-5 shadow-[0_0_32px_rgba(37,99,235,0.08)] sm:p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div><div className="flex items-center gap-2 text-blue-300"><ChartNoAxesCombined size={21} /><span className="text-xs font-bold uppercase tracking-[0.18em]">Fechamento mensal</span></div><h3 className="mt-2 text-xl font-bold">Total de lançamentos do mês</h3><p className="mt-1 text-sm text-slate-400">{new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p></div>
              <button onClick={() => setPeriod("month")} className="rounded-xl border border-blue-400/25 bg-blue-400/10 px-4 py-2.5 text-sm font-semibold text-blue-200 hover:bg-blue-400/15">Ver lançamentos do mês</button>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-blue-400/15 bg-[#080f1e] p-4"><p className="text-xs text-slate-400">Entradas do mês</p><p className="mt-1 text-xl font-bold text-emerald-300">{money(monthIncome)}</p></div>
              <div className="rounded-xl border border-blue-400/15 bg-[#080f1e] p-4"><p className="text-xs text-slate-400">Saídas do mês</p><p className="mt-1 text-xl font-bold text-rose-300">{money(monthExpenses)}</p></div>
              <div className="rounded-xl border border-blue-400/15 bg-[#080f1e] p-4"><p className="text-xs text-slate-400">Resultado mensal</p><p className={"mt-1 text-xl font-bold " + (monthIncome - monthExpenses >= 0 ? "text-cyan-300" : "text-rose-300")}>{money(monthIncome - monthExpenses)}</p></div>
              <div className="rounded-xl border border-blue-400/15 bg-[#080f1e] p-4"><p className="text-xs text-slate-400">Lançamentos no mês</p><p className="mt-1 text-xl font-bold text-white">{movements.filter((m) => m.date.slice(0, 7) === todayISO().slice(0, 7)).length}</p><p className="mt-1 text-xs text-slate-500">{movements.filter((m) => m.type === "entrada" && m.date.slice(0, 7) === todayISO().slice(0, 7)).length} entradas · {movements.filter((m) => m.type === "saida" && m.date.slice(0, 7) === todayISO().slice(0, 7)).length} saídas</p></div>
            </div>
            <div className="mt-5 rounded-xl border border-blue-400/10 bg-[#080f1e]/70 p-4">
              <div className="mb-2 flex items-center justify-between gap-3"><p className="text-sm font-semibold">Entradas versus saídas</p><p className="text-xs text-slate-500">Mês atual</p></div>
              <div className="space-y-4">
                <div><div className="mb-1.5 flex justify-between text-xs"><span className="text-emerald-300">Entradas</span><span className="text-slate-300">{money(monthIncome)}</span></div><div className="h-3 overflow-hidden rounded-full bg-[#182235]"><div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-300" style={{ width: (monthIncome / Math.max(monthIncome, monthExpenses, 1) * 100) + "%" }} /></div></div>
                <div><div className="mb-1.5 flex justify-between text-xs"><span className="text-rose-300">Saídas</span><span className="text-slate-300">{money(monthExpenses)}</span></div><div className="h-3 overflow-hidden rounded-full bg-[#182235]"><div className="h-full rounded-full bg-gradient-to-r from-rose-600 to-rose-300" style={{ width: (monthExpenses / Math.max(monthIncome, monthExpenses, 1) * 100) + "%" }} /></div></div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-blue-400/15 bg-gradient-to-br from-[#111c30] to-[#0b1220] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.25)] transition duration-300 hover:border-blue-400/40 hover:shadow-[0_0_28px_rgba(37,99,235,0.10)] sm:p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <h3 className="font-bold">Gráficos financeiros</h3>
                <p className="mt-1 text-sm text-slate-400">Compare entradas, despesas e lucro dos últimos 6 meses.</p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs font-medium text-slate-300">
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.45)]" /> Entradas</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.45)]" /> Despesas</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-600" /> Lucro</span>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
              {monthlyTrend.map((month) => (
                <div key={month.key} className="min-w-0">
                  <div className="flex h-36 items-end justify-center gap-2 border-b border-slate-800 px-1">
                    <div className="flex h-full w-1/3 flex-col justify-end" title={`Entradas: ${money(month.income)}`}>
                      <div className="w-full rounded-t-md bg-gradient-to-t from-emerald-600 to-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.2)] transition-all" style={{ height: `${(month.income / trendMax) * 100}%`, minHeight: month.income > 0 ? "4px" : "0" }} />
                    </div>
                    <div className="flex h-full w-1/3 flex-col justify-end" title={`Despesas: ${money(month.expenses)}`}>
                      <div className="w-full rounded-t-md bg-gradient-to-t from-rose-600 to-rose-300 shadow-[0_0_12px_rgba(251,113,133,0.2)] transition-all" style={{ height: `${(month.expenses / trendMax) * 100}%`, minHeight: month.expenses > 0 ? "4px" : "0" }} />
                    </div>
                  </div>
                  <p className="mt-2 text-center text-xs font-semibold capitalize text-slate-300">{month.label}</p>
                  <p className={`mt-1 truncate text-center text-xs font-bold ${month.profit >= 0 ? "text-blue-400" : "text-rose-400"}`} title={`Lucro: ${money(month.profit)}`}>{money(month.profit)}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#182235]" title={`Resultado: ${money(month.profit)}`}>
                    <div className={`h-full rounded-full ${month.profit >= 0 ? "bg-blue-600" : "bg-rose-500"}`} style={{ width: `${(Math.abs(month.profit) / profitMax) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-400">O lucro mostrado é calculado como entradas menos despesas registradas. Meses sem lançamentos aparecem zerados.</p>
          </section>

          <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
            <section className="rounded-2xl border border-blue-400/15 bg-gradient-to-br from-[#111c30] to-[#0b1220] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.25)] transition duration-300 hover:border-blue-400/40 hover:shadow-[0_0_28px_rgba(37,99,235,0.10)] sm:p-6">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h3 className="font-bold">Movimentações</h3><p className="mt-1 text-sm text-slate-400">Acompanhe seu dinheiro por período.</p></div>
                <div className="flex items-center gap-1 rounded-xl bg-[#182235] p-1">
                  {([{key:"today",label:"Hoje"},{key:"week",label:"Semana"},{key:"month",label:"Este mês"},{key:"all",label:"Tudo"}] as const).map((item) => <button key={item.key} onClick={() => setPeriod(item.key)} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${period === item.key ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_0_18px_rgba(37,99,235,0.22)]" : "text-slate-400 hover:text-slate-100"}`}>{item.label}</button>)}
                </div>
              </div>
              <div className="mt-5 space-y-1">
                {filtered.length === 0 ? <div className="flex flex-col items-center py-12 text-center"><div className="mb-3 rounded-2xl bg-blue-950/50 p-4 text-blue-400"><ReceiptText size={25} /></div><p className="font-semibold">Nenhuma movimentação por aqui</p><p className="mt-1 max-w-xs text-sm text-slate-400">Registre seu primeiro corte ou uma despesa para começar a acompanhar seu financeiro.</p><button onClick={() => openModal("entrada", true)} className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"><Plus size={16} className="mr-1 inline" /> Registrar primeiro corte</button></div> :
                  filtered.slice(0, 12).map((m) => <div key={m.id} className="group flex items-center gap-3 border-b border-slate-800 py-3 last:border-0">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${m.type === "entrada" ? "bg-emerald-950/50 text-emerald-400" : "bg-rose-950/50 text-rose-400"}`}>{m.type === "entrada" ? <ArrowDownLeft size={19} /> : <ArrowUpRight size={19} />}</div>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{m.description}</p><p className="mt-0.5 text-xs text-slate-400">{m.category} · {new Date(m.date + "T12:00:00").toLocaleDateString("pt-BR")} · {m.payment}</p></div>
                    <div className="text-right"><p className={`text-sm font-bold ${m.type === "entrada" ? "text-emerald-400" : "text-rose-400"}`}>{m.type === "entrada" ? "+" : "−"}{money(m.amount)}</p><button onClick={() => setMovements((current) => current.filter((x) => x.id !== m.id))} className="mt-1 text-xs text-slate-400 opacity-100 hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100"><Trash2 size={13} className="inline" /> Excluir</button></div>
                  </div>)}
              </div>
            </section>

            <div className="space-y-6">
              <section className="rounded-2xl border border-blue-400/15 bg-gradient-to-br from-[#111c30] to-[#0b1220] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.25)] transition duration-300 hover:border-blue-400/40 hover:shadow-[0_0_28px_rgba(37,99,235,0.10)] sm:p-6">
                <div className="flex items-center justify-between"><div><h3 className="font-bold">Resumo do mês</h3><p className="mt-1 text-sm text-slate-400">Visão geral do mês atual</p></div><div className="rounded-xl bg-blue-950/50 p-2.5 text-blue-400"><ChartNoAxesCombined size={20} /></div></div>
                <div className="mt-5 space-y-4">
                  <ProgressRow label="Entradas" value={monthIncome} max={Math.max(monthIncome, monthExpenses, 1)} color="bg-emerald-500" />
                  <ProgressRow label="Saídas" value={monthExpenses} max={Math.max(monthIncome, monthExpenses, 1)} color="bg-rose-500" />
                </div>
                <div className="mt-5 rounded-xl bg-[#0b1220] p-4"><p className="text-sm text-slate-400">Resultado do mês</p><p className={`mt-1 text-2xl font-bold ${monthIncome - monthExpenses >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{money(monthIncome - monthExpenses)}</p></div>
              </section>
              <section className="rounded-2xl bg-gradient-to-br from-blue-950 via-[#0b1a35] to-[#050914] ring-1 ring-blue-400/20 shadow-[0_0_35px_rgba(37,99,235,0.12)] p-5 text-white shadow-sm sm:p-6">
                <div className="flex items-center gap-2 text-cyan-200"><CircleDollarSign size={20} /><span className="text-sm font-semibold">Meta de atendimento</span></div>
                <p className="mt-3 text-2xl font-bold">R$ 30,00 <span className="text-sm font-medium text-cyan-200">/ corte</span></p>
                <p className="mt-1 text-sm text-cyan-200">Preço padrão do corte.</p>
                <button onClick={() => openModal("entrada", true)} className="mt-4 w-full rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 text-sm font-bold text-white shadow-[0_0_20px_rgba(37,99,235,0.2)] hover:brightness-110"><Scissors size={16} className="mr-2 inline" /> Registrar um corte</button>
              </section>
            </div>
          </div>

          <section id="minhas-dividas" className="scroll-mt-6 rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-[#111c30] to-[#0b1220] p-5 shadow-[0_0_32px_rgba(8,145,178,0.08)] sm:p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <div className="flex items-center gap-2 text-cyan-300"><BadgeDollarSign size={22} /><span className="text-xs font-bold uppercase tracking-[0.18em]">Organização pessoal</span></div>
                <h3 className="mt-2 text-2xl font-bold">Minhas dívidas</h3>
                <p className="mt-1 text-sm text-slate-400">Cadastre suas contas, acompanhe os vencimentos e marque o que já pagou.</p>
              </div>
              <div className="rounded-xl border border-cyan-400/20 bg-[#081525] px-4 py-3">
                <p className="text-xs text-slate-400">Total em aberto</p>
                <p className="mt-1 text-2xl font-bold text-cyan-300">{money(debtTotal)}</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-blue-400/15 bg-[#080f1e] p-4">
                <p className="text-xs text-slate-400">Dívidas pendentes</p>
                <p className="mt-1 text-xl font-bold text-white">{unpaidDebts.length}</p>
              </div>
              <div className="rounded-xl border border-blue-400/15 bg-[#080f1e] p-4">
                <p className="text-xs text-slate-400">Valor em aberto</p>
                <p className="mt-1 text-xl font-bold text-rose-300">{money(debtTotal)}</p>
              </div>
              <div className="rounded-xl border border-blue-400/15 bg-[#080f1e] p-4">
                <p className="text-xs text-slate-400">Total já quitado</p>
                <p className="mt-1 text-xl font-bold text-emerald-300">{money(paidDebtTotal)}</p>
              </div>
            </div>

            <form onSubmit={saveDebt} className="mt-5 rounded-xl border border-blue-400/15 bg-[#080f1e]/80 p-4 sm:p-5">
              <h4 className="mb-4 flex items-center gap-2 font-semibold text-white"><Plus size={18} className="text-cyan-300" /> Adicionar uma dívida</h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="block text-sm font-medium text-slate-300">Nome da dívida *
                  <input required value={debtName} onChange={(e) => setDebtName(e.target.value)} placeholder="Ex.: Fatura do cartão" className="mt-1.5 w-full rounded-xl border border-blue-400/20 bg-[#050914] px-3 py-3 text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400 focus:ring-4 focus:ring-blue-500/20" />
                </label>
                <label className="block text-sm font-medium text-slate-300">Credor / para quem devo
                  <input value={debtCreditor} onChange={(e) => setDebtCreditor(e.target.value)} placeholder="Ex.: Banco, loja, pessoa" className="mt-1.5 w-full rounded-xl border border-blue-400/20 bg-[#050914] px-3 py-3 text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400 focus:ring-4 focus:ring-blue-500/20" />
                </label>
                <label className="block text-sm font-medium text-slate-300">Valor total (R$) *
                  <input required min="0.01" step="0.01" type="number" value={debtAmount} onChange={(e) => setDebtAmount(e.target.value)} placeholder="0,00" className="mt-1.5 w-full rounded-xl border border-blue-400/20 bg-[#050914] px-3 py-3 text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400 focus:ring-4 focus:ring-blue-500/20" />
                </label>
                <label className="block text-sm font-medium text-slate-300">Vencimento
                  <input type="date" value={debtDueDate} onChange={(e) => setDebtDueDate(e.target.value)} className="mt-1.5 w-full rounded-xl border border-blue-400/20 bg-[#050914] px-3 py-3 text-slate-100 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-blue-500/20" />
                </label>
                <label className="block text-sm font-medium text-slate-300">Tipo de dívida
                  <select value={debtCategory} onChange={(e) => setDebtCategory(e.target.value)} className="mt-1.5 w-full rounded-xl border border-blue-400/20 bg-[#050914] px-3 py-3 text-slate-100 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-blue-500/20">
                    {["Cartão de crédito","Empréstimo","Conta de casa","Financiamento","Compra parcelada","Dinheiro emprestado","Imposto","Outra"].map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-300">Observações
                  <input value={debtNote} onChange={(e) => setDebtNote(e.target.value)} placeholder="Ex.: parcela 2 de 5" className="mt-1.5 w-full rounded-xl border border-blue-400/20 bg-[#050914] px-3 py-3 text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400 focus:ring-4 focus:ring-blue-500/20" />
                </label>
              </div>
              <button type="submit" className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 text-sm font-bold text-white shadow-[0_0_20px_rgba(37,99,235,0.2)] transition hover:brightness-110"><Plus size={17} /> Salvar dívida</button>
            </form>

            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="font-bold text-white">Lista de dívidas</h4>
                <span className="text-xs text-slate-400">{debts.length} cadastrada(s)</span>
              </div>
              {debts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-blue-400/20 bg-[#080f1e]/60 px-4 py-9 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-cyan-300"><HandCoins size={24} /></div>
                  <p className="font-semibold text-slate-200">Você ainda não cadastrou dívidas</p>
                  <p className="mt-1 text-sm text-slate-500">Use o formulário acima para começar sua lista.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {debts.map((debt) => {
                    const overdue = !debt.paid && debt.dueDate && debt.dueDate < todayISO();
                    return (
                      <div key={debt.id} className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center ${debt.paid ? "border-emerald-500/20 bg-emerald-950/10" : overdue ? "border-rose-400/30 bg-rose-950/10" : "border-blue-400/15 bg-[#080f1e]/80"}`}>
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${debt.paid ? "bg-emerald-500/10 text-emerald-300" : overdue ? "bg-rose-500/10 text-rose-300" : "bg-blue-500/10 text-cyan-300"}`}>
                          {debt.paid ? <Check size={20} /> : overdue ? <CircleAlert size={20} /> : <CalendarClock size={20} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className={`font-semibold ${debt.paid ? "text-slate-400 line-through" : "text-white"}`}>{debt.name}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${debt.paid ? "bg-emerald-500/10 text-emerald-300" : overdue ? "bg-rose-500/10 text-rose-300" : "bg-blue-500/10 text-blue-300"}`}>{debt.paid ? "Quitada" : overdue ? "Vencida" : "Em aberto"}</span>
                          </div>
                          <p className="mt-1 text-xs text-slate-400">{debt.creditor} · {debt.category}{debt.dueDate ? ` · Vencimento: ${new Date(debt.dueDate + "T12:00:00").toLocaleDateString("pt-BR")}` : ""}</p>
                          {debt.note && <p className="mt-1 text-xs text-slate-500">{debt.note}</p>}
                        </div>
                        <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                          <p className={`text-lg font-bold ${debt.paid ? "text-emerald-300" : "text-white"}`}>{money(debt.amount)}</p>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => setDebts((current) => current.map((item) => item.id === debt.id ? { ...item, paid: !item.paid } : item))} className={`rounded-lg px-3 py-2 text-xs font-semibold ${debt.paid ? "border border-slate-700 text-slate-300 hover:bg-slate-800" : "bg-emerald-600/15 text-emerald-300 hover:bg-emerald-600/25"}`}>{debt.paid ? "Reabrir" : "Marcar paga"}</button>
                            <button type="button" aria-label={`Excluir dívida ${debt.name}`} onClick={() => setDebts((current) => current.filter((item) => item.id !== debt.id))} className="rounded-lg border border-rose-500/20 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/10"><Trash2 size={14} /></button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <p className="text-center text-xs text-slate-400">Gestão Financeira pra Mim · Feito para facilitar sua rotina na barbearia.</p>
        </div>
      </main>

      {modal && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
        <form onSubmit={saveMovement} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-[#101827] p-5 shadow-2xl sm:rounded-3xl sm:p-7">
          <div className="mb-6 flex items-start justify-between"><div><div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-2xl ${modal === "entrada" ? "bg-emerald-950/50 text-emerald-400" : "bg-rose-950/50 text-rose-400"}`}>{modal === "entrada" ? <ArrowDownLeft size={22} /> : <ArrowUpRight size={22} />}</div><h2 className="text-xl font-bold">{modal === "entrada" ? "Registrar entrada" : "Registrar saída"}</h2><p className="mt-1 text-sm text-slate-400">Preencha os dados da movimentação.</p></div><button type="button" onClick={() => setModal(null)} className="rounded-lg p-2 text-slate-400 hover:bg-[#182235]" aria-label="Fechar"><X size={20} /></button></div>
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-slate-200">Descrição<input required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Corte de cabelo" className="mt-1.5 w-full rounded-xl border border-blue-400/20 bg-[#080f1e] px-3.5 py-3 font-normal outline-none focus:border-cyan-400 focus:ring-4 focus:ring-blue-500/20" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-semibold text-slate-200">Valor (R$)<input required min="0.01" step="0.01" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="30,00" className="mt-1.5 w-full rounded-xl border border-blue-400/20 bg-[#080f1e] px-3.5 py-3 font-normal outline-none focus:border-cyan-400 focus:ring-4 focus:ring-blue-500/20" /></label>
              <label className="block text-sm font-semibold text-slate-200">Data<input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5 w-full rounded-xl border border-blue-400/20 bg-[#080f1e] px-3 py-3 font-normal outline-none focus:border-cyan-400 focus:ring-4 focus:ring-blue-500/20" /></label>
            </div>
            <label className="block text-sm font-semibold text-slate-200">Categoria<select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1.5 w-full rounded-xl border border-blue-400/20 bg-[#080f1e] px-3.5 py-3 font-normal outline-none focus:border-cyan-400 focus:ring-4 focus:ring-blue-500/20">{(modal === "entrada" ? ["Corte","Barba","Combo corte e barba","Sobrancelha","Gorjeta","Venda de produto","Outro serviço"] : ["Materiais","Aluguel","Água e energia","Internet","Manutenção","Transporte","Alimentação","Outras despesas"]).map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="block text-sm font-semibold text-slate-200">Forma de pagamento<select value={payment} onChange={(e) => setPayment(e.target.value)} className="mt-1.5 w-full rounded-xl border border-blue-400/20 bg-[#080f1e] px-3.5 py-3 font-normal outline-none focus:border-cyan-400 focus:ring-4 focus:ring-blue-500/20">{["Pix","Dinheiro","Cartão de débito","Cartão de crédito","Transferência","Outro"].map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="block text-sm font-semibold text-slate-200">Observação (opcional)<textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Algum detalhe..." className="mt-1.5 w-full resize-none rounded-xl border border-blue-400/20 bg-[#080f1e] px-3.5 py-3 font-normal outline-none focus:border-cyan-400 focus:ring-4 focus:ring-blue-500/20" /></label>
          </div>
          <div className="mt-6 flex gap-3"><button type="button" onClick={() => setModal(null)} className="flex-1 rounded-xl border border-blue-400/20 px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-[#0b1220]">Cancelar</button><button type="submit" className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold text-white ${modal === "entrada" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"}`}><CheckCircle2 size={17} className="mr-2 inline" /> Salvar movimentação</button></div>
        </form>
      </div>}
    </div>
  );
}

function StatCard({ label, value, icon, tint, caption }: { label: string; value: string; icon: React.ReactNode; tint: string; caption: string }) {
  const colors: Record<string, string> = { blue: "bg-blue-950/50 text-blue-400", green: "bg-emerald-950/50 text-emerald-400", red: "bg-rose-950/50 text-rose-400", purple: "bg-violet-950/50 text-violet-400" };
  return <div className="rounded-2xl border border-blue-400/15 bg-gradient-to-br from-[#111c30] to-[#0b1220] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.25)] transition duration-300 hover:border-blue-400/40 hover:shadow-[0_0_28px_rgba(37,99,235,0.10)]"><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-400">{label}</p><div className={`rounded-xl p-2.5 ${colors[tint]}`}>{icon}</div></div><p className="mt-4 text-2xl font-bold tracking-tight sm:text-[1.7rem]">{value}</p><p className="mt-1 text-xs text-slate-400">{caption}</p></div>;
}

function ProgressRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return <div><div className="mb-2 flex items-center justify-between text-sm"><span className="font-medium text-slate-300">{label}</span><span className="font-bold text-slate-100">{money(value)}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-[#182235]"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></div></div>;
}
