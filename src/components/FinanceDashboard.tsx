import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft, ArrowUpRight, Wallet, Plus, Scissors, Trash2,
  CalendarDays, TrendingUp, TrendingDown, CircleDollarSign, X, Menu,
  LayoutDashboard, ReceiptText, ChartNoAxesCombined, CreditCard, Banknote,
  Smartphone, ChevronDown, CheckCircle2, BadgeDollarSign, CalendarClock, CircleAlert, Check, HandCoins,
  Target, PiggyBank, Repeat, Download, Upload, FileSpreadsheet, Building2, Cloud, ShieldCheck, PlusCircle, LogOut
} from "lucide-react";
import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

type Debt = {
  id: string;
  name: string;
  creditor: string;
  amount: number;
  dueDate: string;
  category: string;
  note?: string | undefined;
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
  account?: string;
  note?: string | undefined;
};

type SavingsGoal = {
  id: string;
  name: string;
  target: number;
  saved: number;
};

type RecurringBill = {
  id: string;
  name: string;
  amount: number;
  category: string;
  frequency?: "weekly" | "monthly";
  dueDay: number;
  dueWeekday?: number;
  lastPaidMonth?: string | undefined;
  lastPaidPeriod?: string;
};

type Budget = {
  id: string;
  category: string;
  limit: number;
};

const STORAGE_KEY = "gestao-financeira-pra-mim-movements";
const DEBTS_STORAGE_KEY = "gestao-financeira-pra-mim-debts";
const GOALS_STORAGE_KEY = "gestao-financeira-pra-mim-goals";
const BILLS_STORAGE_KEY = "gestao-financeira-pra-mim-recurring-bills";
const BUDGETS_STORAGE_KEY = "gestao-financeira-pra-mim-budgets";
const ACCOUNTS_STORAGE_KEY = "gestao-financeira-pra-mim-accounts";
const OPENING_BALANCES_STORAGE_KEY = "gestao-financeira-pra-mim-opening-balances";
const DEFAULT_ACCOUNTS = ["Conta principal", "Carteira", "Banco", "Poupança"];
// Legacy (pre-login) data lived in unscoped keys; it is handed to the first account that signs in on this browser.
const LEGACY_CLAIM_KEY = "gestao-financeira-pra-mim-legacy-claimed-by";
const userCacheKey = (userId: string) => "gestao-financeira-pra-mim-cache-" + userId;
type WeeklySavings = { weekStart: string; saved: number; workWeekdays?: number[] };
type MonthlySavings = { month: string; saved: number; workDays: number; workWeekdays?: number[] };
type DebtSavings = { month: string; saved: number; workWeekdays?: number[]; workDates?: string[] };
type FinanceData = { movements?: Movement[] | undefined; debts?: Debt[] | undefined; goals?: SavingsGoal[] | undefined; bills?: RecurringBill[] | undefined; budgets?: Budget[] | undefined; accounts?: string[] | undefined; openingBalances?: Record<string, number> | undefined; weeklySavings?: WeeklySavings | undefined; monthlySavings?: MonthlySavings | undefined; debtSavings?: DebtSavings | undefined };
export type DashboardUser = { id: string; email?: string | null };

function readLegacyLocalData(): FinanceData {
  const read = <T,>(key: string): T | undefined => {
    try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : undefined; } catch { return undefined; }
  };
  return {
    movements: read<Movement[]>(STORAGE_KEY),
    debts: read<Debt[]>(DEBTS_STORAGE_KEY),
    goals: read<SavingsGoal[]>(GOALS_STORAGE_KEY),
    bills: read<RecurringBill[]>(BILLS_STORAGE_KEY),
    budgets: read<Budget[]>(BUDGETS_STORAGE_KEY),
    accounts: read<string[]>(ACCOUNTS_STORAGE_KEY),
    openingBalances: read<Record<string, number>>(OPENING_BALANCES_STORAGE_KEY),
  };
}

function clearLegacyLocalData() {
  [STORAGE_KEY, DEBTS_STORAGE_KEY, GOALS_STORAGE_KEY, BILLS_STORAGE_KEY, BUDGETS_STORAGE_KEY, ACCOUNTS_STORAGE_KEY, OPENING_BALANCES_STORAGE_KEY, "gestao-financeira-pra-mim-cloud-session"]
    .forEach((key) => localStorage.removeItem(key));
}
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

export function FinanceDashboard({ user }: { user: DashboardUser }) {
  const [, setClockTick] = useState(0);
  useEffect(() => {
    const refreshDateDerivedViews = () => setClockTick((tick) => tick + 1);
    const timer = window.setInterval(refreshDateDerivedViews, 60_000);
    const handleVisibility = () => { if (document.visibilityState === "visible") refreshDateDerivedViews(); };
    window.addEventListener("focus", refreshDateDerivedViews);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshDateDerivedViews);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const [movements, setMovements] = useState<Movement[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [period, setPeriod] = useState<"today" | "week" | "month" | "all">("today");
  const [movementTypeFilter, setMovementTypeFilter] = useState<"all" | "entrada" | "saida">("all");
  const [modal, setModal] = useState<"entrada" | "saida" | null>(null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("30");
  const [category, setCategory] = useState("Outro serviço");
  const [payment, setPayment] = useState("Pix");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [activePage, setActivePage] = useState("inicio");
  const [debts, setDebts] = useState<Debt[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalSaved, setGoalSaved] = useState("0");
  const [bills, setBills] = useState<RecurringBill[]>([]);
  const [weeklySavings, setWeeklySavings] = useState<WeeklySavings>({ weekStart: weekStartISO(), saved: 0, workWeekdays: [1, 3, 4, 5, 6] });
  const [dailyDeposit, setDailyDeposit] = useState("");
  const [monthlySavings, setMonthlySavings] = useState<MonthlySavings>({ month: todayISO().slice(0, 7), saved: 0, workDays: 22 });
  const [debtSavings, setDebtSavings] = useState<DebtSavings>({ month: todayISO().slice(0, 7), saved: 0, workWeekdays: [1, 3, 4, 5, 6] });
  const [debtDeposit, setDebtDeposit] = useState("");
  const [monthlyDeposit, setMonthlyDeposit] = useState("");
  const [billName, setBillName] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billCategory, setBillCategory] = useState("Internet");
  const [billFrequency, setBillFrequency] = useState<"weekly" | "monthly">("weekly");
  const [billDueDay, setBillDueDay] = useState("10");
  const [billDueWeekday, setBillDueWeekday] = useState("1");
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [budgetCategory, setBudgetCategory] = useState("Alimentação");
  const [budgetLimit, setBudgetLimit] = useState("");
  const [accounts, setAccounts] = useState<string[]>(DEFAULT_ACCOUNTS);
  const [openingBalances, setOpeningBalances] = useState<Record<string, number>>({});
  const [openingAccount, setOpeningAccount] = useState("Conta principal");
  const [openingAmount, setOpeningAmount] = useState("0");
  const [newAccount, setNewAccount] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("Conta principal");
  const [backupMessage, setBackupMessage] = useState("");
  const [cloudMessage, setCloudMessage] = useState("");
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudSyncedUser, setCloudSyncedUser] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [debtName, setDebtName] = useState("");
  const [debtCreditor, setDebtCreditor] = useState("");
  const [debtAmount, setDebtAmount] = useState("");
  const [debtDueDate, setDebtDueDate] = useState("");
  const [debtCategory, setDebtCategory] = useState("Cartão de crédito");
  const [debtNote, setDebtNote] = useState("");

  // Load this user's data from their account. On the very first login on this browser,
  // the data that was saved here before login is moved into the account.
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setCloudSyncedUser(null);
    void (async () => {
      const { data: row, error } = await supabase
        .from("finance_snapshots").select("data").eq("user_id", user.id).maybeSingle();
      if (cancelled) return;
      if (error) {
        try {
          const cached = localStorage.getItem(userCacheKey(user.id));
          if (cached) applyData(JSON.parse(cached) as FinanceData);
        } catch { /* sem cópia local */ }
        setCloudMessage("Não foi possível carregar seus dados da nuvem agora. Clique em “Sincronizar / recuperar” para tentar de novo.");
        setLoaded(true);
        return;
      }
      const legacyOwner = localStorage.getItem(LEGACY_CLAIM_KEY);
      if (row?.data) {
        applyData(row.data as unknown as FinanceData);
        if (!legacyOwner) localStorage.setItem(LEGACY_CLAIM_KEY, user.id);
        setCloudSyncedUser(user.id);
        setLoaded(true);
        return;
      }
      let initial: FinanceData = {};
      const legacy = readLegacyLocalData();
      const hasLegacy = Object.values(legacy).some((value) => value !== undefined);
      if (!legacyOwner && hasLegacy) {
        initial = legacy;
      }
      applyData(initial);
      try {
        const { error: saveError } = await supabase
          .from("finance_snapshots")
          .upsert({ user_id: user.id, data: initial as unknown as Json }, { onConflict: "user_id" });
        if (saveError) throw saveError;
        if (!legacyOwner) {
          localStorage.setItem(LEGACY_CLAIM_KEY, user.id);
          if (hasLegacy) {
            clearLegacyLocalData();
            setCloudMessage("Os dados que estavam neste navegador foram salvos na sua conta.");
          }
        }
        if (!cancelled) setCloudSyncedUser(user.id);
      } catch {
        if (!cancelled) setCloudMessage("Não foi possível criar seu espaço na nuvem agora. Clique em “Sincronizar / recuperar” para tentar de novo.");
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [user.id]);

  // Per-user cache on this device, used only if the cloud is temporarily unreachable.
  useEffect(() => {
    if (!loaded || cloudSyncedUser !== user.id) return;
    try {
      localStorage.setItem(userCacheKey(user.id), JSON.stringify({ movements, debts, goals, bills, budgets, accounts, openingBalances, weeklySavings, monthlySavings, debtSavings }));
    } catch { /* armazenamento cheio ou bloqueado */ }
  }, [movements, debts, goals, bills, budgets, accounts, openingBalances, weeklySavings, monthlySavings, debtSavings, loaded, cloudSyncedUser, user.id]);

  const filtered = useMemo(() => movements.filter((item) => {
    const matchesPeriod = period === "today" ? item.date === todayISO()
      : period === "week" ? item.date >= weekStartISO() && item.date <= weekEndISO()
      : period === "month" ? item.date.slice(0, 7) === todayISO().slice(0, 7)
      : true;
    const matchesType = movementTypeFilter === "all" || item.type === movementTypeFilter;
    return matchesPeriod && matchesType;
  }), [movements, period, movementTypeFilter]);

  const income = filtered.filter((m) => m.type === "entrada").reduce((sum, m) => sum + m.amount, 0);
  const expenses = filtered.filter((m) => m.type === "saida").reduce((sum, m) => sum + m.amount, 0);
  const balance = income - expenses;
  const expenseBreakdown = useMemo(() => {
    const totals = filtered.filter((m) => m.type === "saida").reduce<Record<string, number>>((acc, m) => {
      const key = m.category || "Outros";
      acc[key] = (acc[key] || 0) + m.amount;
      return acc;
    }, {});
    return Object.entries(totals).map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);
  const incomeBreakdown = useMemo(() => {
    const totals = filtered.filter((m) => m.type === "entrada").reduce<Record<string, number>>((acc, m) => {
      const key = m.category || "Outros";
      acc[key] = (acc[key] || 0) + m.amount;
      return acc;
    }, {});
    return Object.entries(totals).map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const unpaidDebts = debts.filter((debt) => !debt.paid);
  const debtTotal = unpaidDebts.reduce((sum, debt) => sum + debt.amount, 0);
  const paidDebtTotal = debts.filter((debt) => debt.paid).reduce((sum, debt) => sum + debt.amount, 0);
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
  const currentMonth = todayISO().slice(0, 7);
  const currentMonthExpenses = movements.filter((m) => m.type === "saida" && m.date.slice(0, 7) === currentMonth);
  const accountBalances = accounts.map((account) => ({
    name: account,
    balance: (openingBalances[account] || 0) + movements.filter((m) => (m.account || "Conta principal") === account)
      .reduce((sum, m) => sum + (m.type === "entrada" ? m.amount : -m.amount), 0),
  }));
  const reportMovements = movements.slice().sort((a, b) => b.date.localeCompare(a.date));

  function applyData(data: FinanceData) {
    setMovements(Array.isArray(data.movements) ? data.movements : []);
    setDebts(Array.isArray(data.debts) ? data.debts : []);
    setGoals(Array.isArray(data.goals) ? data.goals : []);
    setBills(Array.isArray(data.bills) ? data.bills : []);
    setBudgets(Array.isArray(data.budgets) ? data.budgets : []);
    setAccounts(Array.isArray(data.accounts) && data.accounts.length ? data.accounts : DEFAULT_ACCOUNTS);
    setOpeningBalances(data.openingBalances && typeof data.openingBalances === "object" ? data.openingBalances : {});
      setWeeklySavings({ weekStart: weekStartISO(), saved: data.weeklySavings?.weekStart === weekStartISO() ? data.weeklySavings.saved : 0, workWeekdays: data.weeklySavings?.workWeekdays?.length ? data.weeklySavings.workWeekdays : [1, 3, 4, 5, 6] });
    setMonthlySavings(data.monthlySavings ? { ...data.monthlySavings, workWeekdays: data.monthlySavings.workWeekdays?.length ? data.monthlySavings.workWeekdays : [1, 3, 4, 5, 6], ...(data.monthlySavings.month === todayISO().slice(0, 7) ? {} : { month: todayISO().slice(0, 7), saved: 0 }) } : { month: todayISO().slice(0, 7), saved: 0, workDays: 22, workWeekdays: [1, 3, 4, 5, 6] });
    setDebtSavings(data.debtSavings ? { ...data.debtSavings, workWeekdays: data.debtSavings.workWeekdays?.length ? data.debtSavings.workWeekdays : [1, 3, 4, 5, 6], ...(data.debtSavings.month === todayISO().slice(0, 7) ? {} : { month: todayISO().slice(0, 7), saved: 0 }) } : { month: todayISO().slice(0, 7), saved: 0, workWeekdays: [1, 3, 4, 5, 6] });
  }

  async function saveToCloud(data: FinanceData) {
    const { error } = await supabase
      .from("finance_snapshots")
      .upsert({ user_id: user.id, data: data as unknown as Json }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
  }

  async function syncCloud() {
    setCloudBusy(true); setCloudMessage("");
    try {
      const { data: row, error } = await supabase
        .from("finance_snapshots").select("data").eq("user_id", user.id).maybeSingle();
      if (error) throw new Error(error.message);
      if (row?.data) {
        applyData(row.data as unknown as FinanceData);
        setCloudMessage("Dados recuperados da sua conta.");
      } else {
        await saveToCloud({ movements, debts, goals, bills, budgets, accounts, openingBalances, weeklySavings, monthlySavings, debtSavings });
        setCloudMessage("Seus dados atuais foram salvos na sua conta.");
      }
      setCloudSyncedUser(user.id);
    } catch (error) {
      setCloudMessage(error instanceof Error ? "Falha ao sincronizar: " + error.message : "Falha ao sincronizar.");
    } finally { setCloudBusy(false); }
  }

  async function pushCloudChanges(silent = false) {
    if (!silent) { setCloudBusy(true); setCloudMessage(""); }
    try {
      await saveToCloud({ movements, debts, goals, bills, budgets, accounts, openingBalances, weeklySavings, monthlySavings, debtSavings });
      setLastSavedAt(new Date());
      if (!silent) setCloudMessage("Tudo salvo na sua conta.");
    } catch (error) {
      setCloudMessage(error instanceof Error ? "Não foi possível salvar na nuvem: " + error.message : "Não foi possível salvar na nuvem.");
    } finally { if (!silent) setCloudBusy(false); }
  }

  useEffect(() => {
    if (!loaded || cloudSyncedUser !== user.id) return;
    const timer = window.setTimeout(() => { void pushCloudChanges(true); }, 1200);
    return () => window.clearTimeout(timer);
  }, [loaded, cloudSyncedUser, user.id, movements, debts, goals, bills, budgets, accounts, openingBalances, weeklySavings, monthlySavings, debtSavings]);

  async function logoutCloud() {
    if (cloudSyncedUser === user.id) {
      try { await saveToCloud({ movements, debts, goals, bills, budgets, accounts, openingBalances, weeklySavings, monthlySavings, debtSavings }); } catch { /* cache local mantém os dados */ }
    }
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  function downloadFile(filename: string, content: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    setBackupMessage("Arquivo preparado para salvar.");
  }

  function exportBackup() {
    const backup = { app: "Gestão Financeira pra Mim", version: 1, exportedAt: new Date().toISOString(), movements, debts, goals, bills, budgets, accounts, openingBalances, weeklySavings, monthlySavings, debtSavings };
    downloadFile("backup-gestao-financeira.json", JSON.stringify(backup, null, 2), "application/json");
  }

  async function importBackup(file?: File) {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as Partial<{ movements: Movement[]; debts: Debt[]; goals: SavingsGoal[]; bills: RecurringBill[]; budgets: Budget[]; accounts: string[]; openingBalances: Record<string, number>; weeklySavings: WeeklySavings; monthlySavings: MonthlySavings; debtSavings: DebtSavings }>;
      if (!Array.isArray(data.movements) || !Array.isArray(data.debts)) throw new Error("Arquivo inválido");
      setMovements(data.movements);
      setDebts(data.debts);
      setGoals(Array.isArray(data.goals) ? data.goals : []);
      setBills(Array.isArray(data.bills) ? data.bills : []);
      setBudgets(Array.isArray(data.budgets) ? data.budgets : []);
      setAccounts(Array.isArray(data.accounts) && data.accounts.length ? data.accounts : DEFAULT_ACCOUNTS);
      setOpeningBalances(data.openingBalances && typeof data.openingBalances === "object" ? data.openingBalances : {});
      setWeeklySavings(data.weeklySavings && data.weeklySavings.weekStart === weekStartISO() ? data.weeklySavings : { weekStart: weekStartISO(), saved: 0, workWeekdays: [1, 3, 4, 5, 6] });
      setDebtSavings(data.debtSavings && data.debtSavings.month === todayISO().slice(0, 7) ? data.debtSavings : { month: todayISO().slice(0, 7), saved: 0, workWeekdays: data.debtSavings?.workWeekdays?.length ? data.debtSavings.workWeekdays : [1, 3, 4, 5, 6] });
      setBackupMessage("Backup restaurado com sucesso.");
    } catch {
      setBackupMessage("Não foi possível restaurar. Escolha um backup JSON válido deste aplicativo.");
    }
  }

  function exportCsv() {
    const rows = [["Data", "Tipo", "Descrição", "Categoria", "Conta", "Pagamento", "Valor", "Observação"],
      ...reportMovements.map((m) => [m.date, m.type, m.description, m.category, m.account || "Conta principal", m.payment, m.amount.toFixed(2).replace(".", ","), m.note || ""])];
    const csv = "\uFEFF" + rows.map((row) => row.map((cell) => '"' + String(cell).replace(/"/g, '""') + '"').join(";")).join("\r\n");
    downloadFile("relatorio-financeiro.csv", csv, "text/csv;charset=utf-8");
  }

  function saveGoal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = Number(goalTarget.replace(",", "."));
    const saved = Number(goalSaved.replace(",", "."));
    if (!goalName.trim() || !Number.isFinite(target) || target <= 0 || !Number.isFinite(saved) || saved < 0) return;
    setGoals((current) => [{ id: crypto.randomUUID(), name: goalName.trim(), target, saved }, ...current]);
    setGoalName(""); setGoalTarget(""); setGoalSaved("0");
  }

  const weeklyBillsTotal = bills.filter((bill) => (bill.frequency || "monthly") === "weekly" && bill.lastPaidPeriod !== "weekly:" + weekStartISO()).reduce((sum, bill) => sum + bill.amount, 0);
  const weeklySavingsCurrent = weeklySavings.weekStart === weekStartISO() ? weeklySavings.saved : 0;
  const weeklyWorkdaysSelected = weeklySavings.workWeekdays?.length ? weeklySavings.workWeekdays : [1, 3, 4, 5, 6];
  const weeklyDailyTarget = weeklyBillsTotal / Math.max(1, weeklyWorkdaysSelected.length);
  const weeklySavingsRemaining = Math.max(0, weeklyBillsTotal - weeklySavingsCurrent);

  function addWeeklySavings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(dailyDeposit.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return;
    setWeeklySavings({ weekStart: weekStartISO(), saved: weeklySavingsCurrent + value, workWeekdays: weeklyWorkdaysSelected });
    setDailyDeposit("");
  }

  const monthlyBillsTotal = bills.filter((bill) => { const periodKey = "monthly:" + currentMonth; const paidThisMonth = bill.lastPaidPeriod ? bill.lastPaidPeriod === periodKey : bill.lastPaidMonth === currentMonth; return (bill.frequency || "monthly") === "monthly" && !paidThisMonth; }).reduce((sum, bill) => sum + bill.amount, 0);
  const monthlySavingsCurrent = monthlySavings.month === todayISO().slice(0, 7) ? monthlySavings.saved : 0;
  const monthlyWorkWeekdays = monthlySavings.workWeekdays?.length ? monthlySavings.workWeekdays : [1, 3, 4, 5, 6];
  const monthlyWorkDays = (() => {
    const [year, month] = todayISO().slice(0, 7).split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    let count = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      if (monthlyWorkWeekdays.includes(new Date(year, month - 1, day).getDay())) count++;
    }
    return count;
  })();
  const monthlyDailyTarget = monthlyBillsTotal / Math.max(1, monthlyWorkDays);
  const monthlySavingsRemaining = Math.max(0, monthlyBillsTotal - monthlySavingsCurrent);
  const debtSavingsCurrent = debtSavings.month === todayISO().slice(0, 7) ? debtSavings.saved : 0;
  const debtWorkWeekdays = debtSavings.workWeekdays?.length ? debtSavings.workWeekdays : [1, 3, 4, 5, 6];
  const debtSavingsRemaining = Math.max(0, debtTotal - debtSavingsCurrent);
  const debtCalendarDates = (() => {
    const [year, month] = todayISO().slice(0, 7).split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const iso = String(year) + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
      return { iso, day, weekday: new Date(year, month - 1, day).getDay() };
    });
  })();
  const debtWorkDates = debtSavings.month === todayISO().slice(0, 7) && debtSavings.workDates?.length
    ? debtSavings.workDates
    : debtCalendarDates.filter((date) => date.weekday !== 2 && date.weekday !== 0).map((date) => date.iso);
  const debtWorkdaysLeft = debtWorkDates.filter((date) => date >= todayISO()).length;
  const debtDailyTarget = debtSavingsRemaining / Math.max(1, debtWorkdaysLeft);

  function addDebtSavings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(debtDeposit.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return;
    setDebtSavings({ month: todayISO().slice(0, 7), saved: debtSavingsCurrent + value, workWeekdays: debtWorkWeekdays, workDates: debtWorkDates });
    setDebtDeposit("");
  }

  function toggleDebtWorkDate(date: string) {
    setDebtSavings((current) => {
      const month = todayISO().slice(0, 7);
      const [year, monthNumber] = month.split("-").map(Number);
      const daysInMonth = new Date(year, monthNumber, 0).getDate();
      const defaults = Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1;
        return { iso: month + "-" + String(day).padStart(2, "0"), weekday: new Date(year, monthNumber - 1, day).getDay() };
      }).filter((item) => item.weekday !== 2 && item.weekday !== 0).map((item) => item.iso);
      const selected = current.month === month && current.workDates?.length ? current.workDates : defaults;
      const next = selected.includes(date) ? selected.filter((item) => item !== date) : [...selected, date].sort();
      return { month, saved: current.month === month ? current.saved : 0, workWeekdays: current.workWeekdays || [1, 3, 4, 5, 6], workDates: next };
    });
  }

  function toggleMonthlyWorkday(day: number) {
    setMonthlySavings((current) => {
      const selected = current.workWeekdays?.length ? current.workWeekdays : [1, 3, 4, 5, 6];
      const next = selected.includes(day) ? selected.filter((item) => item !== day) : [...selected, day].sort((a, b) => a - b);
      if (next.length === 0) return current;
      return { month: todayISO().slice(0, 7), saved: current.month === todayISO().slice(0, 7) ? current.saved : 0, workDays: current.workDays || 22, workWeekdays: next };
    });
  }

  function addMonthlySavings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(monthlyDeposit.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return;
    setMonthlySavings((current) => ({ month: todayISO().slice(0, 7), saved: monthlySavingsCurrent + value, workDays: current.workDays || 22, workWeekdays: monthlyWorkWeekdays }));
    setMonthlyDeposit("");
  }

  function saveBill(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(billAmount.replace(",", "."));
    const due = Number(billDueDay);
    const weekday = Number(billDueWeekday);
    if (!billName.trim() || !Number.isFinite(value) || value <= 0) return;
    if (billFrequency === "monthly" && (due < 1 || due > 31)) return;
    if (billFrequency === "weekly" && (weekday < 0 || weekday > 6)) return;
    setBills((current) => [{ id: crypto.randomUUID(), name: billName.trim(), amount: value, category: billCategory, frequency: billFrequency, dueDay: due, dueWeekday: weekday }, ...current]);
    setBillName(""); setBillAmount("");
  }

  function payBill(bill: RecurringBill) {
    const frequency = bill.frequency || "monthly";
    const periodKey = frequency === "weekly" ? "weekly:" + weekStartISO() : "monthly:" + currentMonth;
    const alreadyPaid = bill.lastPaidPeriod ? bill.lastPaidPeriod === periodKey : frequency === "monthly" && bill.lastPaidMonth === currentMonth;
    if (alreadyPaid) return;
    const item: Movement = { id: crypto.randomUUID(), type: "saida", description: bill.name, category: bill.category, amount: bill.amount, payment: "Pix", date: todayISO(), account: selectedAccount, note: frequency === "weekly" ? "Conta recorrente semanal" : "Conta recorrente mensal" };
    setMovements((current) => [item, ...current]);
    setBills((current) => current.map((entry) => entry.id === bill.id ? { ...entry, lastPaidMonth: frequency === "monthly" ? currentMonth : entry.lastPaidMonth, lastPaidPeriod: periodKey } : entry));
  }

  function reopenBillAsPending(bill: RecurringBill) {
    const frequency = bill.frequency || "monthly";
    const periodStart = frequency === "weekly" ? weekStartISO() : currentMonth + "-01";
    const periodEnd = frequency === "weekly" ? weekEndISO() : currentMonth + "-31";
    const paymentNote = frequency === "weekly" ? "Conta recorrente semanal" : "Conta recorrente mensal";
    setMovements((current) => {
      const paymentIndex = current.findIndex((movement) =>
        movement.type === "saida" &&
        movement.description === bill.name &&
        movement.amount === bill.amount &&
        movement.note === paymentNote &&
        movement.date >= periodStart &&
        movement.date <= periodEnd
      );
      return paymentIndex < 0 ? current : current.filter((_, index) => index !== paymentIndex);
    });
    setBills((current) => current.map((entry) => entry.id === bill.id
      ? { ...entry, lastPaidMonth: undefined, lastPaidPeriod: undefined }
      : entry));
  }

  function saveBudget(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const limit = Number(budgetLimit.replace(",", "."));
    if (!Number.isFinite(limit) || limit <= 0) return;
    setBudgets((current) => [{ id: crypto.randomUUID(), category: budgetCategory, limit }, ...current.filter((item) => item.category !== budgetCategory)]);
    setBudgetLimit("");
  }

  function openModal(type: "entrada" | "saida") {
    setModal(type);
    setDescription("");
    setAmount("");
    setCategory(type === "entrada" ? "Outro serviço" : "Materiais");
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
    if (!description.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0 || (modal === "entrada" && category === "Corte" && numericAmount < 10)) return;
    const item: Movement = {
      id: crypto.randomUUID(),
      type: modal ?? "entrada",
      description: description.trim(),
      category,
      amount: numericAmount,
      payment,
      date,
      account: selectedAccount,
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

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050914] text-slate-300">
        <div className="flex items-center gap-3"><span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" /> Carregando seus dados...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_rgba(29,78,216,0.16),_transparent_40%),linear-gradient(135deg,#050914_0%,#080f1e_50%,#070b14_100%)] text-slate-100">
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 border-r border-slate-800 bg-[#080d18] p-5 text-slate-100 transition-transform lg:translate-x-0 ${mobileMenu ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white"><Scissors size={22} /></div>
          <div><p className="bg-gradient-to-r from-white to-cyan-200 bg-clip-text font-bold tracking-tight text-transparent">Gestão Financeira</p><p className="text-xs text-slate-400">pra mim · barbearia</p></div>
          <button className="ml-auto lg:hidden" onClick={() => setMobileMenu(false)} aria-label="Fechar menu"><X size={20} /></button>
        </div>
        <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[.16em] text-slate-400">ÁREAS DO APLICATIVO</p>
        <nav className="space-y-1">
          <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[.15em] text-cyan-400">Negócio</p>
          <button onClick={() => { setActivePage("barbearia"); setMobileMenu(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-slate-200 hover:bg-slate-800"><Scissors size={19} /> Área da Barbearia</button>
          <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[.15em] text-cyan-400">Finanças pessoais</p>
          <button onClick={() => { setActivePage("inicio"); setPeriod("all"); setMovementTypeFilter("all"); setMobileMenu(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-slate-200 hover:bg-slate-800"><LayoutDashboard size={19} /> Painel inicial</button>
          <button onClick={() => { setActivePage("entradas"); setMovementTypeFilter("entrada"); setPeriod("all"); setMobileMenu(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-emerald-300 hover:bg-slate-800"><ArrowDownLeft size={19} /> Entradas</button>
          <button onClick={() => { setActivePage("saidas"); setMovementTypeFilter("saida"); setPeriod("all"); setMobileMenu(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-rose-300 hover:bg-slate-800"><ArrowUpRight size={19} /> Saídas</button>
          <button onClick={() => { setActivePage("movimentacoes"); setMovementTypeFilter("all"); setPeriod("all"); setMobileMenu(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-slate-300 hover:bg-slate-800"><ReceiptText size={19} /> Movimentações</button>
          <button onClick={() => { setActivePage("relatorios"); setMobileMenu(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-slate-300 hover:bg-slate-800"><ChartNoAxesCombined size={19} /> Relatórios</button>
          <button onClick={() => { setActivePage("contas"); setMobileMenu(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-slate-300 hover:bg-slate-800"><Building2 size={19} /> Contas e saldos</button>
          <button onClick={() => { setActivePage("metas"); setMobileMenu(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-slate-300 hover:bg-slate-800"><Target size={19} /> Metas e orçamento</button>
          <button onClick={() => { setActivePage("recorrentes"); setMobileMenu(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-slate-300 hover:bg-slate-800"><Repeat size={19} /> Contas recorrentes</button>
          <button onClick={() => { setActivePage("dividas"); setMobileMenu(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-slate-300 hover:bg-slate-800"><BadgeDollarSign size={19} /> Minhas dívidas <span className="ml-auto rounded-full bg-blue-500/15 px-2 py-0.5 text-xs text-cyan-300">{unpaidDebts.length}</span></button>
          <button onClick={() => { setActivePage("configuracoes"); setMobileMenu(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-slate-300 hover:bg-slate-800"><ShieldCheck size={19} /> Configurações e backup</button>
        </nav>
      </aside>
      {mobileMenu && <button className="fixed inset-0 z-20 bg-slate-950/30 lg:hidden" onClick={() => setMobileMenu(false)} aria-label="Fechar menu" />}
      <main id="visao-geral" className="min-w-0 lg:ml-64">
        <header className="flex items-center justify-between border-b border-blue-400/15 bg-[#080f1e]/90 backdrop-blur-xl px-4 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-2 hover:bg-[#182235] lg:hidden" onClick={() => setMobileMenu(true)} aria-label="Abrir menu"><Menu size={21} /></button>
            <div><p className="text-sm font-semibold tracking-[0.18em] text-cyan-300">✦ SUA VIDA FINANCEIRA, SOB CONTROLE</p><h1 className="text-xl font-bold tracking-tight sm:text-2xl">{({ inicio: "Painel inicial", barbearia: "Minha Barbearia", movimentacoes: "Movimentações", entradas: "Entradas", saidas: "Saídas", relatorios: "Relatórios", contas: "Contas e saldos", metas: "Metas e planejamento", recorrentes: "Contas recorrentes", dividas: "Minhas dívidas", configuracoes: "Configurações e backup" } as Record<string, string>)[activePage] || "Painel inicial"}</h1></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-xl border border-blue-400/20 bg-[#0b1220]/70 px-3 py-2 text-sm text-slate-300 md:flex"><CalendarDays size={16} /> {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</div>
            <span className="hidden max-w-[180px] truncate text-sm text-slate-400 lg:inline" title={user.email || undefined}>{user.email}</span>
            <button onClick={() => void logoutCloud()} className="inline-flex items-center gap-2 rounded-xl border border-blue-400/20 bg-[#0b1220]/70 px-3 py-2 text-sm text-slate-300 hover:bg-[#182235]" aria-label="Sair da conta"><LogOut size={16} /> <span className="hidden sm:inline">Sair</span></button>
          </div>
        </header>
        <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
          <section id="inicio-resumo" className={activePage === "inicio" ? "space-y-6" : "hidden"}><div className="rounded-2xl border border-blue-400/20 bg-gradient-to-br from-[#111c30] to-[#0b1220] p-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Painel financeiro</p><h2 className="mt-2 text-2xl font-bold">Seu dinheiro em um só lugar</h2><p className="mt-2 text-sm text-slate-400">Acompanhe o mês e registre suas movimentações.</p><div className="mt-5 flex flex-wrap gap-3"><button onClick={() => openModal("entrada")} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white"><ArrowDownLeft size={17} className="mr-2 inline"/>Nova entrada</button><button onClick={() => openModal("saida")} className="rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white"><ArrowUpRight size={17} className="mr-2 inline"/>Nova saída</button></div></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Entradas do mês" value={money(monthIncome)} icon={<ArrowDownLeft size={20}/>} tint="green" caption="Total recebido"/><StatCard label="Saídas do mês" value={money(monthExpenses)} icon={<ArrowUpRight size={20}/>} tint="red" caption="Total gasto"/><StatCard label="Resultado do mês" value={money(monthIncome-monthExpenses)} icon={<Wallet size={20}/>} tint="blue" caption="Entradas menos saídas"/><StatCard label="Dívidas em aberto" value={money(debtTotal)} icon={<CreditCard size={20}/>} tint="purple" caption={unpaidDebts.length+" pendentes"}/></div></section>
          <section id="area-barbearia" className={activePage === "barbearia" ? "scroll-mt-6 rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-[#111c30] to-[#0b1220] p-5 sm:p-6" : "hidden"}>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2 text-cyan-300"><Scissors size={21} /><span className="text-xs font-bold uppercase tracking-[0.18em]">Área do negócio</span></div>
                <h2 className="mt-2 text-2xl font-bold">Minha Barbearia</h2>
                <p className="mt-1 text-sm text-slate-400">Acompanhe as entradas e despesas do negócio separadamente das suas finanças pessoais.</p>
              </div>
              <button onClick={() => { setModal("entrada"); setDescription(""); setAmount(""); setCategory("Corte"); setDate(todayISO()); setNote(""); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 text-sm font-bold text-white"><Plus size={17} /> Registrar receita da barbearia</button>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-blue-400/15 bg-[#080f1e] p-4"><p className="text-sm text-slate-400">Receitas da barbearia</p><p className="mt-2 text-2xl font-bold text-emerald-300">{money(movements.filter((m) => m.type === "entrada" && ["Corte","Barba","Combo corte e barba","Sobrancelha","Gorjeta","Outro serviço"].includes(m.category)).reduce((sum,m) => sum + m.amount, 0))}</p></div>
              <div className="rounded-xl border border-blue-400/15 bg-[#080f1e] p-4"><p className="text-sm text-slate-400">Serviços registrados</p><p className="mt-2 text-2xl font-bold">{movements.filter((m) => m.type === "entrada" && ["Corte","Barba","Combo corte e barba","Sobrancelha","Outro serviço"].includes(m.category)).length}</p></div>
              <div className="rounded-xl border border-blue-400/15 bg-[#080f1e] p-4"><p className="text-sm text-slate-400">Despesas do negócio</p><p className="mt-2 text-2xl font-bold text-rose-300">{money(movements.filter((m) => m.type === "saida" && ["Materiais","Aluguel","Água e energia","Internet","Manutenção"].includes(m.category)).reduce((sum,m) => sum + m.amount, 0))}</p></div>
            </div>
            <p className="mt-3 text-xs text-slate-500">Os totais acima usam as categorias de barbearia registradas nas movimentações. Para ver ou editar todos os lançamentos, abra Movimentações.</p>
          </section>
          <div className={activePage === "inicio" ? "space-y-6" : "hidden"}>

          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><p className="text-sm font-semibold tracking-[0.18em] text-cyan-300">SEU FINANCEIRO EM UM SÓ LUGAR</p><h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Controle seu dinheiro.</h2><p className="mt-1 text-slate-400">Veja quanto entrou, quanto saiu e quanto sobrou.</p></div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => openModal("saida")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-[#101827] px-4 py-3 text-sm font-semibold text-slate-200 shadow-sm hover:bg-[#0b1220]"><ArrowUpRight size={17} className="text-rose-600" /> Registrar saída</button>
              <button onClick={() => openModal("entrada")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_0_22px_rgba(37,99,235,0.25)] transition hover:brightness-110"><Plus size={18} /> Registrar entrada</button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Saldo do período" value={money(balance)} icon={<Wallet size={20} />} tint="blue" caption="Entradas menos saídas" />
            <StatCard label="Total de entradas" value={money(income)} icon={<ArrowDownLeft size={20} />} tint="green" caption={period === "today" ? "Recebido hoje" : "Receitas registradas"} />
            <StatCard label="Total de saídas" value={money(expenses)} icon={<ArrowUpRight size={20} />} tint="red" caption={period === "today" ? "Despesas de hoje" : "Despesas registradas"} />
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
            <div className="mt-7 grid gap-5 lg:grid-cols-2">
              {([
                { title: "Despesas por categoria", subtitle: "Veja para onde seu dinheiro está indo.", items: expenseBreakdown, empty: "Nenhuma despesa neste período.", total: expenses },
                { title: "Entradas por categoria", subtitle: "Veja de onde vem seu dinheiro.", items: incomeBreakdown, empty: "Nenhuma entrada neste período.", total: income },
              ]).map((chart) => {
                const palette = ["#22d3ee", "#3b82f6", "#8b5cf6", "#f59e0b", "#34d399", "#fb7185", "#a3e635", "#c084fc", "#64748b"];
                let cursor = 0;
                const gradient = chart.items.map((item, index) => {
                  const start = cursor;
                  cursor += chart.total > 0 ? item.value / chart.total * 100 : 0;
                  return `${palette[index % palette.length]} ${start}% ${cursor}%`;
                }).join(", ");
                return (
                  <div key={chart.title} className="rounded-2xl border border-cyan-400/15 bg-[#080f1e]/80 p-4 sm:p-5">
                    <h4 className="font-bold text-white">{chart.title}</h4>
                    <p className="mt-1 text-xs text-slate-400">{chart.subtitle}</p>
                    {chart.items.length === 0 ? (
                      <div className="flex min-h-40 items-center justify-center text-center text-sm text-slate-500">{chart.empty}</div>
                    ) : (
                      <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:items-center">
                        <div className="relative h-36 w-36 shrink-0 rounded-full shadow-[0_0_28px_rgba(34,211,238,0.10)]" style={{ background: `conic-gradient(${gradient})` }} role="img" aria-label={chart.title}>
                          <div className="absolute inset-[27%] flex flex-col items-center justify-center rounded-full bg-[#080f1e]">
                            <span className="text-[10px] text-slate-400">TOTAL</span>
                            <span className="max-w-full px-1 text-center text-xs font-bold text-white">{money(chart.total)}</span>
                          </div>
                        </div>
                        <div className="w-full min-w-0 space-y-2">
                          {chart.items.map((item, index) => (
                            <div key={item.label} className="flex items-center gap-2 text-xs">
                              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: palette[index % palette.length] }} />
                              <span className="min-w-0 flex-1 truncate text-slate-300" title={item.label}>{item.label}</span>
                              <span className="shrink-0 font-semibold text-white">{money(item.value)}</span>
                              <span className="w-10 shrink-0 text-right text-slate-500">{chart.total > 0 ? (item.value / chart.total * 100).toFixed(0) : 0}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          </div>
          <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
            <section id="movimentacoes" className={["movimentacoes","entradas","saidas"].includes(activePage) ? "scroll-mt-6 rounded-2xl border border-blue-400/15 bg-gradient-to-br from-[#111c30] to-[#0b1220] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.25)] transition duration-300 hover:border-blue-400/40 hover:shadow-[0_0_28px_rgba(37,99,235,0.10)] sm:p-6" : "hidden"}>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h3 className="font-bold">Movimentações</h3><p className="mt-1 text-sm text-slate-400">Acompanhe seu dinheiro por período.</p></div>
                <div className="flex items-center gap-1 rounded-xl bg-[#182235] p-1">
                  {([{key:"today",label:"Hoje"},{key:"week",label:"Semana"},{key:"month",label:"Este mês"},{key:"all",label:"Tudo"}] as const).map((item) => <button key={item.key} onClick={() => setPeriod(item.key)} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${period === item.key ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_0_18px_rgba(37,99,235,0.22)]" : "text-slate-400 hover:text-slate-100"}`}>{item.label}</button>)}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar por tipo de movimentação">
                {([{ key: "all", label: "Todas" }, { key: "entrada", label: "Entradas" }, { key: "saida", label: "Saídas" }] as const).map((item) => <button key={item.key} type="button" onClick={() => setMovementTypeFilter(item.key)} className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${movementTypeFilter === item.key ? item.key === "entrada" ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300" : item.key === "saida" ? "border-rose-400/40 bg-rose-500/15 text-rose-300" : "border-cyan-400/40 bg-cyan-500/15 text-cyan-200" : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"}`}>{item.label}</button>)}
              </div>
              <div className="mt-3 space-y-1">
                {filtered.length === 0 ? <div className="flex flex-col items-center py-12 text-center"><div className="mb-3 rounded-2xl bg-blue-950/50 p-4 text-blue-400"><ReceiptText size={25} /></div><p className="font-semibold">Nenhuma movimentação por aqui</p><p className="mt-1 max-w-xs text-sm text-slate-400">Registre sua primeira entrada ou saída para começar a acompanhar seu financeiro.</p><button onClick={() => openModal("entrada")} className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"><Plus size={16} className="mr-1 inline" /> Registrar primeira entrada</button></div> :
                  filtered.slice(0, 12).map((m) => <div key={m.id} className="group flex items-center gap-3 border-b border-slate-800 py-3 last:border-0">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${m.type === "entrada" ? "bg-emerald-950/50 text-emerald-400" : "bg-rose-950/50 text-rose-400"}`}>{m.type === "entrada" ? <ArrowDownLeft size={19} /> : <ArrowUpRight size={19} />}</div>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{m.description}</p><p className="mt-0.5 text-xs text-slate-400">{m.category} · {new Date(m.date + "T12:00:00").toLocaleDateString("pt-BR")} · {m.payment} · {m.account || "Conta principal"}</p></div>
                    <div className="text-right"><p className={`text-sm font-bold ${m.type === "entrada" ? "text-emerald-400" : "text-rose-400"}`}>{m.type === "entrada" ? "+" : "−"}{money(m.amount)}</p><button type="button" aria-label={`Excluir lançamento ${m.description}`} title="Apagar lançamento" onClick={() => { if (window.confirm(`Tem certeza que deseja apagar o lançamento “${m.description}” de ${money(m.amount)}?`)) setMovements((current) => current.filter((x) => x.id !== m.id)); }} className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-semibold text-rose-300 transition hover:border-rose-400/60 hover:bg-rose-500/20 hover:text-rose-200"><Trash2 size={14} /> Apagar</button></div>
                  </div>)}
              </div>
            </section>

            <div className="space-y-6">
              <section id="resumo-mensal" className={activePage === "relatorios" ? "scroll-mt-6 rounded-2xl border border-blue-400/15 bg-gradient-to-br from-[#111c30] to-[#0b1220] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.25)] transition duration-300 hover:border-blue-400/40 hover:shadow-[0_0_28px_rgba(37,99,235,0.10)] sm:p-6" : "hidden"}>
                <div className="flex items-center justify-between"><div><h3 className="font-bold">Resumo do mês</h3><p className="mt-1 text-sm text-slate-400">Visão geral do mês atual</p></div><div className="rounded-xl bg-blue-950/50 p-2.5 text-blue-400"><ChartNoAxesCombined size={20} /></div></div>
                <div className="mt-5 space-y-4">
                  <ProgressRow label="Entradas" value={monthIncome} max={Math.max(monthIncome, monthExpenses, 1)} color="bg-emerald-500" />
                  <ProgressRow label="Saídas" value={monthExpenses} max={Math.max(monthIncome, monthExpenses, 1)} color="bg-rose-500" />
                </div>
                <div className="mt-5 rounded-xl bg-[#0b1220] p-4"><p className="text-sm text-slate-400">Resultado do mês</p><p className={`mt-1 text-2xl font-bold ${monthIncome - monthExpenses >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{money(monthIncome - monthExpenses)}</p></div>
              </section>
            </div>
          </div>

          <section id="contas-e-saldos" className={activePage === "contas" ? "scroll-mt-6 rounded-2xl border border-blue-400/20 bg-gradient-to-br from-[#111c30] to-[#0b1220] p-5 sm:p-6" : "hidden"}>
            <div className="flex items-center gap-2 text-cyan-300"><Building2 size={21} /><span className="text-xs font-bold uppercase tracking-[0.18em]">Contas e saldos</span></div>
            <h3 className="mt-2 text-xl font-bold">Onde está seu dinheiro?</h3>
            <p className="mt-1 text-sm text-slate-400">Cada movimentação pode ser associada a uma conta ou carteira.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{accountBalances.map((account) => <div key={account.name} className="rounded-xl border border-blue-400/15 bg-[#080f1e] p-4"><p className="text-sm text-slate-400">{account.name}</p><p className={"mt-2 text-xl font-bold " + (account.balance >= 0 ? "text-cyan-300" : "text-rose-300")}>{money(account.balance)}</p></div>)}</div>
            <form onSubmit={(e) => { e.preventDefault(); const name = newAccount.trim(); if (name && !accounts.some((a) => a.toLowerCase() === name.toLowerCase())) { setAccounts((current) => [...current, name]); setSelectedAccount(name); setOpeningAccount(name); setNewAccount(""); } }} className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input value={newAccount} onChange={(e) => setNewAccount(e.target.value)} placeholder="Nome de uma nova conta (ex.: Banco Inter)" className="min-w-0 flex-1 rounded-xl border border-blue-400/20 bg-[#050914] px-3 py-3 text-sm outline-none focus:border-cyan-400" />
              <button className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500"><Plus size={16} className="mr-1 inline" /> Adicionar conta</button>
            </form>
            <form onSubmit={(e) => { e.preventDefault(); const value = Number(openingAmount.replace(",", ".")); if (Number.isFinite(value)) { setOpeningBalances((current) => ({ ...current, [openingAccount]: value })); setOpeningAmount(String(value)); } }} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <label className="text-sm text-slate-300">Conta para definir saldo inicial<select value={openingAccount} onChange={(e) => { setOpeningAccount(e.target.value); setOpeningAmount(String(openingBalances[e.target.value] || 0)); }} className="mt-1 w-full rounded-xl border border-blue-400/20 bg-[#050914] px-3 py-3 outline-none focus:border-cyan-400">{accounts.map((account) => <option key={account}>{account}</option>)}</select></label>
              <label className="text-sm text-slate-300">Saldo que já existe (R$)<input type="number" step="0.01" value={openingAmount} onChange={(e) => setOpeningAmount(e.target.value)} className="mt-1 w-full rounded-xl border border-blue-400/20 bg-[#050914] px-3 py-3 outline-none focus:border-cyan-400" /></label>
              <button className="self-end rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-200">Salvar saldo inicial</button>
            </form>
          </section>

          <section id="planejamento" className={activePage === "metas" ? "scroll-mt-6 grid gap-6 xl:grid-cols-2" : "hidden"}>
            <div className="rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-[#111c30] to-[#0b1220] p-5 sm:p-6">
              <div className="flex items-center gap-2 text-cyan-300"><Target size={21} /><span className="text-xs font-bold uppercase tracking-[0.18em]">Objetivos financeiros</span></div>
              <h3 className="mt-2 text-xl font-bold">Metas para juntar dinheiro</h3>
              <form onSubmit={saveGoal} className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-slate-300 sm:col-span-2">Nome da meta<input required value={goalName} onChange={(e) => setGoalName(e.target.value)} placeholder="Ex.: Reserva de emergência" className="mt-1 w-full rounded-xl border border-blue-400/20 bg-[#050914] px-3 py-3 outline-none focus:border-cyan-400" /></label>
                <label className="text-sm text-slate-300">Objetivo (R$)<input required type="number" min="0.01" step="0.01" value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} placeholder="1000,00" className="mt-1 w-full rounded-xl border border-blue-400/20 bg-[#050914] px-3 py-3 outline-none focus:border-cyan-400" /></label>
                <label className="text-sm text-slate-300">Já guardado (R$)<input type="number" min="0" step="0.01" value={goalSaved} onChange={(e) => setGoalSaved(e.target.value)} className="mt-1 w-full rounded-xl border border-blue-400/20 bg-[#050914] px-3 py-3 outline-none focus:border-cyan-400" /></label>
                <button className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 text-sm font-bold text-white sm:col-span-2"><Plus size={16} className="mr-1 inline" /> Criar meta</button>
              </form>
              <div className="mt-5 space-y-3">{goals.length === 0 ? <p className="rounded-xl border border-dashed border-blue-400/20 p-5 text-center text-sm text-slate-400">Suas metas aparecerão aqui.</p> : goals.map((goal) => <div key={goal.id} className="rounded-xl border border-blue-400/15 bg-[#080f1e] p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{goal.name}</p><p className="mt-1 text-xs text-slate-400">{money(goal.saved)} de {money(goal.target)}</p></div><button aria-label="Excluir meta" onClick={() => setGoals((current) => current.filter((g) => g.id !== goal.id))} className="text-slate-500 hover:text-rose-300"><Trash2 size={16} /></button></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[#182235]"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-300" style={{ width: Math.min(100, goal.saved / goal.target * 100) + "%" }} /></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs"><span className="text-cyan-300">{Math.min(100, Math.round(goal.saved / goal.target * 100))}% concluído</span><span className="text-slate-400">Faltam {money(Math.max(0, goal.target - goal.saved))}</span></div><form onSubmit={(e) => { e.preventDefault(); const raw = (e.currentTarget.elements.namedItem("contribution") as HTMLInputElement).value; const value = Number(raw.replace(",", ".")); if (Number.isFinite(value) && value > 0) setGoals((current) => current.map((g) => g.id === goal.id ? { ...g, saved: g.saved + value } : g)); e.currentTarget.reset(); }} className="mt-3 flex gap-2"><input name="contribution" type="number" min="0.01" step="0.01" required placeholder="Adicionar valor R$" className="min-w-0 flex-1 rounded-lg border border-blue-400/20 bg-[#050914] px-3 py-2 text-sm outline-none focus:border-cyan-400" /><button className="rounded-lg bg-emerald-600/20 px-3 py-2 text-xs font-semibold text-emerald-300">Guardar</button></form></div>)}</div>
            </div>
            <div className="rounded-2xl border border-blue-400/20 bg-gradient-to-br from-[#111c30] to-[#0b1220] p-5 sm:p-6">
              <div className="flex items-center gap-2 text-blue-300"><PiggyBank size={21} /><span className="text-xs font-bold uppercase tracking-[0.18em]">Planejamento do mês</span></div>
              <h3 className="mt-2 text-xl font-bold">Limites de gastos por categoria</h3>
              <form onSubmit={saveBudget} className="mt-4 flex flex-col gap-3">
                <label className="text-sm text-slate-300">Categoria<select value={budgetCategory} onChange={(e) => setBudgetCategory(e.target.value)} className="mt-1 w-full rounded-xl border border-blue-400/20 bg-[#050914] px-3 py-3 outline-none focus:border-cyan-400">{["Materiais","Aluguel","Água e energia","Internet","Manutenção","Transporte","Alimentação","Outras despesas"].map((c) => <option key={c}>{c}</option>)}</select></label>
                <label className="text-sm text-slate-300">Limite mensal (R$)<input required type="number" min="0.01" step="0.01" value={budgetLimit} onChange={(e) => setBudgetLimit(e.target.value)} placeholder="300,00" className="mt-1 w-full rounded-xl border border-blue-400/20 bg-[#050914] px-3 py-3 outline-none focus:border-cyan-400" /></label>
                <button className="rounded-xl border border-blue-400/25 bg-blue-500/15 px-4 py-3 text-sm font-semibold text-blue-200"><Plus size={16} className="mr-1 inline" /> Salvar limite</button>
              </form>
              <div className="mt-5 space-y-3">{budgets.length === 0 ? <p className="rounded-xl border border-dashed border-blue-400/20 p-5 text-center text-sm text-slate-400">Cadastre um limite para acompanhar seus gastos.</p> : budgets.map((budget) => { const spent = currentMonthExpenses.filter((m) => m.category === budget.category).reduce((sum, m) => sum + m.amount, 0); const percent = spent / budget.limit * 100; return <div key={budget.id} className="rounded-xl border border-blue-400/15 bg-[#080f1e] p-4"><div className="flex items-center justify-between gap-3"><p className="font-semibold">{budget.category}</p><button aria-label="Excluir limite" onClick={() => setBudgets((current) => current.filter((b) => b.id !== budget.id))} className="text-slate-500 hover:text-rose-300"><Trash2 size={15} /></button></div><div className="mt-2 flex justify-between gap-2 text-xs"><span className={percent >= 100 ? "text-rose-300" : "text-slate-400"}>{money(spent)} gastos</span><span className="text-slate-300">Limite {money(budget.limit)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#182235]"><div className={"h-full rounded-full " + (percent >= 100 ? "bg-rose-500" : percent >= 80 ? "bg-amber-400" : "bg-cyan-400")} style={{ width: Math.min(100, percent) + "%" }} /></div>{percent >= 80 && <p className={"mt-2 text-xs " + (percent >= 100 ? "text-rose-300" : "text-amber-300")}>{percent >= 100 ? "Limite ultrapassado!" : "Atenção: você está perto do limite."}</p>}</div> })}</div>
            </div>
          </section>

          <section id="juntar-contas-mensais" className={activePage === "metas" ? "scroll-mt-6 rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-[#101d30] to-[#0b1220] p-5 sm:p-6" : "hidden"}>
            <div className="flex items-center gap-2 text-cyan-300"><CalendarDays size={21} /><span className="text-xs font-bold uppercase tracking-[0.18em]">Planejamento mensal</span></div>
            <h3 className="mt-2 text-xl font-bold">Quanto juntar por mês e por dia trabalhado</h3>
            <p className="mt-1 text-sm text-slate-400">Somamos as contas cadastradas como mensais e dividimos pelos dias que você trabalha no mês. Você pode ajustar a quantidade de dias conforme sua rotina.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-cyan-400/15 bg-[#080f1e] p-4"><p className="text-xs text-slate-400">Total das contas mensais</p><p className="mt-2 text-xl font-bold text-white">{money(monthlyBillsTotal)}</p></div>
              <div className="rounded-xl border border-cyan-400/15 bg-[#080f1e] p-4"><p className="text-xs text-slate-400">Separar por dia trabalhado</p><p className="mt-2 text-xl font-bold text-cyan-300">{money(monthlyDailyTarget)}</p></div>
              <div className="rounded-xl border border-cyan-400/15 bg-[#080f1e] p-4"><p className="text-xs text-slate-400">Já juntado neste mês</p><p className="mt-2 text-xl font-bold text-emerald-300">{money(monthlySavingsCurrent)}</p></div>
              <div className="rounded-xl border border-cyan-400/15 bg-[#080f1e] p-4"><p className="text-xs text-slate-400">Ainda falta juntar</p><p className="mt-2 text-xl font-bold text-amber-300">{money(monthlySavingsRemaining)}</p></div>
            </div>
            <div className="mt-4 rounded-xl border border-cyan-400/15 bg-[#080f1e] p-4">
              <p className="text-sm font-semibold text-slate-200">Selecione os dias em que você trabalha</p>
              <p className="mt-1 text-xs text-slate-400">Terça-feira e domingo ficam desmarcados por padrão. A meta diária é calculada pelos dias selecionados que existem neste mês.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[{ day: 1, label: "Segunda" }, { day: 2, label: "Terça" }, { day: 3, label: "Quarta" }, { day: 4, label: "Quinta" }, { day: 5, label: "Sexta" }, { day: 6, label: "Sábado" }, { day: 0, label: "Domingo" }].map(({ day, label }) => {
                  const selected = monthlyWorkWeekdays.includes(day);
                  return <button key={day} type="button" aria-pressed={selected} onClick={() => toggleMonthlyWorkday(day)} className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${selected ? "border-cyan-400 bg-cyan-500/15 text-cyan-200" : "border-slate-700 bg-[#050914] text-slate-400 hover:border-cyan-400/40"}`}>{selected ? "✓ " : ""}{label}</button>;
                })}
              </div>
              <p className="mt-3 text-xs text-slate-400">Dias de trabalho neste mês: <span className="font-semibold text-cyan-200">{monthlyWorkDays}</span></p>
            </div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#182235]"><div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${monthlyBillsTotal > 0 ? Math.min(100, (monthlySavingsCurrent / monthlyBillsTotal) * 100) : 0}%` }} /></div>
            <form onSubmit={addMonthlySavings} className="mt-4 flex flex-col gap-3 sm:flex-row">
              <label className="flex-1 text-sm text-slate-300">Quanto você separou hoje para as contas mensais? (R$)
                <input required min="0.01" step="0.01" type="number" value={monthlyDeposit} onChange={(e) => setMonthlyDeposit(e.target.value)} placeholder="Ex.: 35,00" className="mt-1 w-full rounded-xl border border-cyan-400/20 bg-[#050914] px-3 py-3 outline-none focus:border-cyan-400" />
              </label>
              <button type="submit" className="self-end rounded-xl bg-cyan-600 px-5 py-3 text-sm font-bold text-white hover:bg-cyan-500"><Plus size={16} className="mr-1 inline" /> Somar valor guardado</button>
            </form>
            {monthlyBillsTotal === 0 && <p className="mt-3 text-xs text-amber-200">Cadastre suas contas na seção “Contas recorrentes” e escolha a frequência “Mensal” para calcular sua meta.</p>}
            {monthlySavingsCurrent >= monthlyBillsTotal && monthlyBillsTotal > 0 && <p className="mt-3 text-sm font-semibold text-emerald-300">Meta mensal alcançada! Você já juntou o suficiente para as contas cadastradas.</p>}
          </section>

          <section id="juntar-contas-semanais" className={activePage === "metas" ? "scroll-mt-6 rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-[#10251f] to-[#0b1220] p-5 sm:p-6" : "hidden"}>
            <div className="flex items-center gap-2 text-emerald-300"><PiggyBank size={21} /><span className="text-xs font-bold uppercase tracking-[0.18em]">Planejamento semanal</span></div>
            <h3 className="mt-2 text-xl font-bold">Juntar dinheiro para as contas da semana</h3>
            <p className="mt-1 text-sm text-slate-400">O sistema soma suas contas cadastradas como semanais e calcula quanto separar por dia para cobrir esse total em 7 dias.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-emerald-400/15 bg-[#080f1e] p-4"><p className="text-xs text-slate-400">Total das contas semanais</p><p className="mt-2 text-xl font-bold text-white">{money(weeklyBillsTotal)}</p></div>
              <div className="rounded-xl border border-emerald-400/15 bg-[#080f1e] p-4"><p className="text-xs text-slate-400">Guardar por dia</p><p className="mt-2 text-xl font-bold text-emerald-300">{money(weeklyDailyTarget)}</p></div>
              <div className="rounded-xl border border-emerald-400/15 bg-[#080f1e] p-4"><p className="text-xs text-slate-400">Já juntado nesta semana</p><p className="mt-2 text-xl font-bold text-cyan-300">{money(weeklySavingsCurrent)}</p></div>
              <div className="rounded-xl border border-emerald-400/15 bg-[#080f1e] p-4"><p className="text-xs text-slate-400">Ainda falta juntar</p><p className="mt-2 text-xl font-bold text-amber-300">{money(weeklySavingsRemaining)}</p></div>
            </div>
            <div className="mt-4 rounded-xl border border-emerald-400/15 bg-[#080f1e] p-4"><p className="mb-3 text-sm font-semibold text-slate-200">Selecione os dias em que você trabalha nesta semana</p><div className="flex flex-wrap gap-2">{[{value:1,label:"Segunda"},{value:2,label:"Terça"},{value:3,label:"Quarta"},{value:4,label:"Quinta"},{value:5,label:"Sexta"},{value:6,label:"Sábado"},{value:0,label:"Domingo"}].map((day) => { const selected = weeklyWorkdaysSelected.includes(day.value); return <button key={day.value} type="button" aria-pressed={selected} onClick={() => setWeeklySavings((current) => { const selectedDays = current.workWeekdays?.length ? current.workWeekdays : [1, 3, 4, 5, 6]; const next = selectedDays.includes(day.value) ? selectedDays.filter((item) => item !== day.value) : [...selectedDays, day.value].sort((a, b) => a - b); if (!next.length) return current; return { weekStart: weekStartISO(), saved: weeklySavingsCurrent, workWeekdays: next }; })} className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${selected ? "border-emerald-400 bg-emerald-400/20 text-emerald-200" : "border-slate-700 bg-[#050914] text-slate-400 hover:border-emerald-400/40"}`}>{day.label}{selected ? " ✓" : ""}</button>; })}</div><p className="mt-2 text-xs text-slate-500">Terça-feira e domingo ficam desmarcados por padrão. O valor diário é dividido pelos dias selecionados.</p></div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#182235]"><div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${weeklyBillsTotal > 0 ? Math.min(100, (weeklySavingsCurrent / weeklyBillsTotal) * 100) : 0}%` }} /></div>
            <form onSubmit={addWeeklySavings} className="mt-4 flex flex-col gap-3 sm:flex-row">
              <label className="flex-1 text-sm text-slate-300">Quanto você guardou hoje? (R$)<input required min="0.01" step="0.01" type="number" value={dailyDeposit} onChange={(e) => setDailyDeposit(e.target.value)} placeholder="Ex.: 20,00" className="mt-1 w-full rounded-xl border border-emerald-400/20 bg-[#050914] px-3 py-3 outline-none focus:border-emerald-400" /></label>
              <button type="submit" className="self-end rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-500"><Plus size={16} className="mr-1 inline" /> Somar valor guardado</button>
            </form>
            {weeklyBillsTotal === 0 && <p className="mt-3 text-xs text-amber-200">Cadastre primeiro suas contas na seção “Contas recorrentes” e escolha a frequência “Semanal” para o cálculo automático funcionar.</p>}
            {weeklySavingsCurrent >= weeklyBillsTotal && weeklyBillsTotal > 0 && <p className="mt-3 text-sm font-semibold text-emerald-300">Meta semanal alcançada! Você já juntou o suficiente para as contas cadastradas.</p>}
          </section>

          <section id="contas-recorrentes" className={activePage === "recorrentes" ? "scroll-mt-6 rounded-2xl border border-blue-400/20 bg-gradient-to-br from-[#111c30] to-[#0b1220] p-5 sm:p-6" : "hidden"}>
            <div className="flex items-center gap-2 text-cyan-300"><Repeat size={21} /><span className="text-xs font-bold uppercase tracking-[0.18em]">Contas recorrentes</span></div>
            <h3 className="mt-2 text-xl font-bold">Não esqueça seus vencimentos</h3>
            <p className="mt-1 text-sm text-slate-400">Cadastre contas semanais ou mensais. Ao registrar o pagamento, a despesa é lançada automaticamente.</p>
            <form onSubmit={saveBill} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm text-slate-300">Nome da conta<input required value={billName} onChange={(e) => setBillName(e.target.value)} placeholder="Ex.: Internet" className="mt-1 w-full rounded-xl border border-blue-400/20 bg-[#050914] px-3 py-3 outline-none focus:border-cyan-400" /></label>
              <label className="text-sm text-slate-300">Frequência<select value={billFrequency} onChange={(e) => setBillFrequency(e.target.value as "weekly" | "monthly")} className="mt-1 w-full rounded-xl border border-blue-400/20 bg-[#050914] px-3 py-3 outline-none focus:border-cyan-400"><option value="weekly">Semanal</option><option value="monthly">Mensal</option></select></label>
              <label className="text-sm text-slate-300">Valor {billFrequency === "weekly" ? "semanal" : "mensal"} (R$)<input required type="number" min="0.01" step="0.01" value={billAmount} onChange={(e) => setBillAmount(e.target.value)} placeholder="99,90" className="mt-1 w-full rounded-xl border border-blue-400/20 bg-[#050914] px-3 py-3 outline-none focus:border-cyan-400" /></label>
              <label className="text-sm text-slate-300">Categoria<select value={billCategory} onChange={(e) => setBillCategory(e.target.value)} className="mt-1 w-full rounded-xl border border-blue-400/20 bg-[#050914] px-3 py-3 outline-none focus:border-cyan-400">{["Aluguel","Água e energia","Internet","Materiais","Transporte","Assinaturas","Impostos","Outras despesas"].map((c) => <option key={c}>{c}</option>)}</select></label>
              {billFrequency === "weekly" ? <label className="text-sm text-slate-300">Dia da semana<select value={billDueWeekday} onChange={(e) => setBillDueWeekday(e.target.value)} className="mt-1 w-full rounded-xl border border-blue-400/20 bg-[#050914] px-3 py-3 outline-none focus:border-cyan-400">{[{value:"1",label:"Segunda-feira"},{value:"2",label:"Terça-feira"},{value:"3",label:"Quarta-feira"},{value:"4",label:"Quinta-feira"},{value:"5",label:"Sexta-feira"},{value:"6",label:"Sábado"},{value:"0",label:"Domingo"}].map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</select></label> : <label className="text-sm text-slate-300">Dia do vencimento<input required type="number" min="1" max="31" value={billDueDay} onChange={(e) => setBillDueDay(e.target.value)} className="mt-1 w-full rounded-xl border border-blue-400/20 bg-[#050914] px-3 py-3 outline-none focus:border-cyan-400" /></label>}
              <button className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 text-sm font-bold text-white sm:col-span-2 lg:col-span-4"><Plus size={16} className="mr-1 inline" /> Cadastrar conta recorrente</button>
            </form>
            <div className="mt-5 space-y-3">{bills.length === 0 ? <p className="rounded-xl border border-dashed border-blue-400/20 p-5 text-center text-sm text-slate-400">Nenhuma conta recorrente cadastrada.</p> : bills.map((bill) => { const frequency = bill.frequency || "monthly"; const weekday = bill.dueWeekday ?? 1; const paidThisPeriod = bill.lastPaidPeriod ? bill.lastPaidPeriod === (frequency === "weekly" ? "weekly:" + weekStartISO() : "monthly:" + currentMonth) : frequency === "monthly" && bill.lastPaidMonth === currentMonth; const currentWeekday = new Date(todayISO() + "T12:00:00").getDay(); const overdue = !paidThisPeriod && (frequency === "weekly" ? currentWeekday > weekday : Number(todayISO().slice(8, 10)) > bill.dueDay); const weekdays: Record<number, string> = {0:"domingo",1:"segunda-feira",2:"terça-feira",3:"quarta-feira",4:"quinta-feira",5:"sexta-feira",6:"sábado"}; return <div key={bill.id} className="flex flex-col gap-3 rounded-xl border border-blue-400/15 bg-[#080f1e] p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-semibold">{bill.name}</p><p className="mt-1 text-xs text-slate-400">{bill.category} · {frequency === "weekly" ? "Toda " + weekdays[weekday] : "Todo dia " + bill.dueDay + " de cada mês"}</p><p className={"mt-1 text-xs " + (paidThisPeriod ? "text-emerald-300" : overdue ? "text-rose-300" : "text-amber-300")}>{paidThisPeriod ? (frequency === "weekly" ? "Pago nesta semana" : "Pago neste mês") : overdue ? "Vencimento passou — confira" : (frequency === "weekly" ? "Pendente nesta semana" : "Pendente neste mês")}</p></div><p className="text-lg font-bold">{money(bill.amount)}</p><div className="flex gap-2"><button disabled={paidThisPeriod} onClick={() => payBill(bill)} className="rounded-lg bg-emerald-600/15 px-3 py-2 text-xs font-semibold text-emerald-300 disabled:opacity-40">{paidThisPeriod ? "Já pago" : "Registrar pagamento"}</button>{paidThisPeriod && <button type="button" onClick={() => reopenBillAsPending(bill)} className="rounded-lg border border-amber-400/30 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-400/10">Voltar para pendente</button>}<button aria-label="Excluir conta recorrente" onClick={() => setBills((current) => current.filter((b) => b.id !== bill.id))} className="rounded-lg border border-rose-500/20 px-3 py-2 text-xs text-rose-300"><Trash2 size={14} /></button></div></div> })}</div>
          </section>

          <section id="backup-relatorios" className={activePage === "configuracoes" ? "scroll-mt-6 rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-[#111c30] to-[#0b1220] p-5 sm:p-6" : "hidden"}>
            <div className="flex items-center gap-2 text-cyan-300"><ShieldCheck size={21} /><span className="text-xs font-bold uppercase tracking-[0.18em]">Proteção dos seus dados</span></div>
            <h3 className="mt-2 text-xl font-bold">Backup e relatórios</h3>
            <p className="mt-1 text-sm text-slate-400">Guarde uma cópia dos seus dados ou exporte suas movimentações para abrir em uma planilha.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={exportBackup} className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 text-sm font-semibold text-white"><Download size={16} className="mr-1 inline" /> Baixar backup completo</button>
              <label className="cursor-pointer rounded-xl border border-blue-400/25 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-200 hover:bg-blue-500/20"><Upload size={16} className="mr-1 inline" /> Restaurar backup JSON<input type="file" accept="application/json,.json" className="hidden" onChange={(e) => { void importBackup(e.target.files?.[0]); e.currentTarget.value = ""; }} /></label>
              <button onClick={exportCsv} className="rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-200"><FileSpreadsheet size={16} className="mr-1 inline" /> Exportar relatório CSV</button>
            </div>
            {backupMessage && <p className="mt-3 text-sm text-cyan-300" role="status">{backupMessage}</p>}
            <div className="mt-5 rounded-xl border border-blue-400/20 bg-[#080f1e] p-4 sm:p-5">
              <p className="flex items-center gap-2 font-semibold text-cyan-200"><Cloud size={18} /> Sua conta e sincronização</p>
              <p className="mt-1 text-sm text-slate-400">Seus dados financeiros ficam guardados na sua conta. Só você consegue vê-los, em qualquer aparelho em que entrar.</p>
              <div className="mt-4">
                <p className="text-sm text-emerald-300">Conectado como {user.email || "sua conta"}</p>
                <p className="mt-1 text-xs text-slate-500">{cloudSyncedUser === user.id ? (lastSavedAt ? "Salvo automaticamente às " + lastSavedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "Salvamento automático ativado") : "Salvamento automático pausado até a próxima sincronização"}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button disabled={cloudBusy} onClick={() => void syncCloud()} className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"><Cloud size={16} className="mr-1 inline" /> {cloudBusy ? "Sincronizando..." : "Sincronizar / recuperar"}</button>
                  <button disabled={cloudBusy || cloudSyncedUser !== user.id} onClick={() => void pushCloudChanges()} className="rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-200 disabled:opacity-50">Salvar agora</button>
                  <button disabled={cloudBusy} onClick={() => void logoutCloud()} className="rounded-xl border border-slate-700 px-4 py-3 text-sm text-slate-300"><LogOut size={16} className="mr-1 inline" /> Sair</button>
                </div>
              </div>
              {cloudMessage && <p className="mt-3 text-sm text-cyan-300" role="status">{cloudMessage}</p>}
              <p className="mt-3 text-xs text-slate-500">“Sincronizar / recuperar” carrega a versão salva na sua conta. Evite editar ao mesmo tempo em dois aparelhos. Faça backup antes de restaurar um arquivo.</p>
            </div>
          </section>

          <section id="minhas-dividas" className={activePage === "dividas" ? "scroll-mt-6 rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-[#111c30] to-[#0b1220] p-5 shadow-[0_0_32px_rgba(8,145,178,0.08)] sm:p-6" : "hidden"}>
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

            <div className="mt-5 rounded-2xl border border-blue-400/15 bg-[#080f1e] p-4 sm:p-5">
              <div className="flex items-center gap-2 text-cyan-300"><ChartNoAxesCombined size={20} /><span className="text-xs font-bold uppercase tracking-[0.18em]">Visão das dívidas</span></div>
              <h4 className="mt-2 text-lg font-bold text-white">Dívidas pagas x em aberto</h4>
              <p className="mt-1 text-sm text-slate-400">Veja como o total das suas dívidas está dividido.</p>
              {debtTotal + paidDebtTotal === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-blue-400/20 p-5 text-center text-sm text-slate-400">Cadastre suas dívidas para visualizar o gráfico.</p>
              ) : (
                <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:justify-center sm:gap-10">
                  <div role="img" aria-label={"Gráfico de dívidas: " + money(debtTotal) + " em aberto e " + money(paidDebtTotal) + " já quitadas"} className="relative h-44 w-44 shrink-0 rounded-full" style={{ background: "conic-gradient(#fb7185 0% " + (debtTotal / (debtTotal + paidDebtTotal) * 100) + "%, #34d399 " + (debtTotal / (debtTotal + paidDebtTotal) * 100) + "% 100%)" }}>
                    <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-[#080f1e] text-center">
                      <span className="text-xs text-slate-400">Total</span>
                      <span className="mt-1 text-base font-bold text-white">{money(debtTotal + paidDebtTotal)}</span>
                    </div>
                  </div>
                  <div className="w-full max-w-xs space-y-4">
                    <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-sm text-slate-300"><span className="h-3 w-3 rounded-sm bg-rose-400" />Em aberto</span><span className="text-right text-sm font-bold text-rose-300">{money(debtTotal)} <span className="text-xs font-normal text-slate-500">({Math.round(debtTotal / (debtTotal + paidDebtTotal) * 100)}%)</span></span></div>
                    <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-sm text-slate-300"><span className="h-3 w-3 rounded-sm bg-emerald-400" />Já quitadas</span><span className="text-right text-sm font-bold text-emerald-300">{money(paidDebtTotal)} <span className="text-xs font-normal text-slate-500">({Math.round(paidDebtTotal / (debtTotal + paidDebtTotal) * 100)}%)</span></span></div>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-5 rounded-2xl border border-amber-400/20 bg-gradient-to-br from-[#241c10] to-[#0b1220] p-4 sm:p-5">
              <div className="flex items-center gap-2 text-amber-300"><PiggyBank size={21} /><span className="text-xs font-bold uppercase tracking-[0.18em]">Plano para quitar as dívidas</span></div>
              <h4 className="mt-2 text-lg font-bold text-white">Quanto separar por dia para pagar suas dívidas</h4>
              <p className="mt-1 text-sm text-slate-400">A meta usa o total das dívidas em aberto e divide o que falta juntar pelos dias de trabalho selecionados que restam neste mês.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-amber-400/15 bg-[#080f1e] p-3"><p className="text-xs text-slate-400">Dívidas em aberto</p><p className="mt-1 text-lg font-bold text-white">{money(debtTotal)}</p></div>
                <div className="rounded-xl border border-amber-400/15 bg-[#080f1e] p-3"><p className="text-xs text-slate-400">Separar por dia trabalhado</p><p className="mt-1 text-lg font-bold text-amber-300">{money(debtDailyTarget)}</p></div>
                <div className="rounded-xl border border-amber-400/15 bg-[#080f1e] p-3"><p className="text-xs text-slate-400">Já separado neste mês</p><p className="mt-1 text-lg font-bold text-emerald-300">{money(debtSavingsCurrent)}</p></div>
                <div className="rounded-xl border border-amber-400/15 bg-[#080f1e] p-3"><p className="text-xs text-slate-400">Ainda falta separar</p><p className="mt-1 text-lg font-bold text-rose-300">{money(debtSavingsRemaining)}</p></div>
              </div>
              <div className="mt-4 rounded-xl border border-amber-400/15 bg-[#080f1e] p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-200">Calendário dos seus dias de trabalho</p><span className="text-xs text-slate-400">{new Date(todayISO() + "T12:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</span></div>
                <p className="mt-1 text-xs text-slate-500">Toque nos dias para marcar ou desmarcar. Terças e domingos começam desmarcados.</p>
                <div className="mt-3 grid grid-cols-7 gap-1 text-center">
                  {["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map((label) => <span key={label} className="py-1 text-[11px] font-semibold text-slate-500">{label}</span>)}
                  {Array.from({ length: (new Date(Number(todayISO().slice(0,4)), Number(todayISO().slice(5,7))-1, 1).getDay()+6)%7 }, (_, i) => <span key={"blank-"+i} />)}
                  {debtCalendarDates.map(({iso,day}) => { const selected = debtWorkDates.includes(iso); const past = iso < todayISO(); return <button key={iso} type="button" aria-pressed={selected} onClick={() => toggleDebtWorkDate(iso)} className={`min-h-9 rounded-lg border text-xs font-bold transition ${selected ? "border-amber-400 bg-amber-400/20 text-amber-200" : "border-slate-700 bg-[#050914] text-slate-500 hover:border-amber-400/40"} ${past ? "opacity-50" : ""}`}>{day}{selected ? " ✓" : ""}</button>; })}
                </div>
                <p className="mt-3 text-xs text-slate-400">Dias de trabalho selecionados restantes neste mês: <strong className="text-amber-300">{debtWorkdaysLeft}</strong> (contando hoje). O valor diário é recalculado automaticamente.</p>
              </div>
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#182235]"><div className="h-full rounded-full bg-amber-400 transition-all" style={{width: `${debtTotal > 0 ? Math.min(100, debtSavingsCurrent / debtTotal * 100) : 0}%`}} /></div>
              <form onSubmit={addDebtSavings} className="mt-4 flex flex-col gap-3 sm:flex-row">
                <label className="flex-1 text-sm text-slate-300">Quanto você separou hoje para as dívidas? (R$)
                  <input required min="0.01" step="0.01" type="number" value={debtDeposit} onChange={(e) => setDebtDeposit(e.target.value)} placeholder="Ex.: 25,00" className="mt-1 w-full rounded-xl border border-amber-400/20 bg-[#050914] px-3 py-3 outline-none focus:border-amber-400" />
                </label>
                <button type="submit" className="self-end rounded-xl bg-amber-600 px-5 py-3 text-sm font-bold text-white hover:bg-amber-500"><Plus size={16} className="mr-1 inline" /> Somar valor separado</button>
              </form>
              {debtSavingsRemaining === 0 && debtTotal > 0 && <p className="mt-3 text-sm font-semibold text-emerald-300">Você já separou o suficiente para cobrir as dívidas em aberto!</p>}
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

          <p className="text-center text-xs text-slate-400">Gestão Financeira pra Mim · Seu dinheiro, organizado com segurança.</p>
        </div>
      </main>

      {modal && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
        <form onSubmit={saveMovement} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-[#101827] p-5 shadow-2xl sm:rounded-3xl sm:p-7">
          <div className="mb-6 flex items-start justify-between"><div><div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-2xl ${modal === "entrada" ? "bg-emerald-950/50 text-emerald-400" : "bg-rose-950/50 text-rose-400"}`}>{modal === "entrada" ? <ArrowDownLeft size={22} /> : <ArrowUpRight size={22} />}</div><h2 className="text-xl font-bold">{modal === "entrada" ? "Registrar entrada" : "Registrar saída"}</h2><p className="mt-1 text-sm text-slate-400">Preencha os dados da movimentação.</p></div><button type="button" onClick={() => setModal(null)} className="rounded-lg p-2 text-slate-400 hover:bg-[#182235]" aria-label="Fechar"><X size={20} /></button></div>
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-slate-200">Descrição<input required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: salário, venda ou serviço" className="mt-1.5 w-full rounded-xl border border-blue-400/20 bg-[#080f1e] px-3.5 py-3 font-normal outline-none focus:border-cyan-400 focus:ring-4 focus:ring-blue-500/20" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-semibold text-slate-200">Valor (R$)<input required min={modal === "entrada" && category === "Corte" ? "10" : "0.01"} step="0.01" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={modal === "entrada" && category === "Corte" ? "Mínimo 10,00" : "30,00"} className="mt-1.5 w-full rounded-xl border border-blue-400/20 bg-[#080f1e] px-3.5 py-3 font-normal outline-none focus:border-cyan-400 focus:ring-4 focus:ring-blue-500/20" /></label>
              <label className="block text-sm font-semibold text-slate-200">Data<input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5 w-full rounded-xl border border-blue-400/20 bg-[#080f1e] px-3 py-3 font-normal outline-none focus:border-cyan-400 focus:ring-4 focus:ring-blue-500/20" /></label>
            </div>
            <label className="block text-sm font-semibold text-slate-200">Categoria<select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1.5 w-full rounded-xl border border-blue-400/20 bg-[#080f1e] px-3.5 py-3 font-normal outline-none focus:border-cyan-400 focus:ring-4 focus:ring-blue-500/20">{(modal === "entrada" ? ["Corte","Barba","Combo corte e barba","Sobrancelha","Gorjeta","Venda de produto","Outro serviço"] : ["Materiais","Aluguel","Água e energia","Internet","Manutenção","Transporte","Alimentação","Outras despesas"]).map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="block text-sm font-semibold text-slate-200">Conta / onde entrou ou saiu<select value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)} className="mt-1.5 w-full rounded-xl border border-blue-400/20 bg-[#080f1e] px-3.5 py-3 font-normal outline-none focus:border-cyan-400 focus:ring-4 focus:ring-blue-500/20">{accounts.map((item) => <option key={item}>{item}</option>)}</select></label>
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
