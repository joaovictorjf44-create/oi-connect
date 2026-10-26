import type { ReactNode } from "react";
import { Scissors } from "lucide-react";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top_right,_rgba(29,78,216,0.18),_transparent_45%),linear-gradient(135deg,#050914_0%,#080f1e_50%,#070b14_100%)] px-4 py-10 text-slate-100">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-[0_0_24px_rgba(37,99,235,0.35)]"><Scissors size={24} /></div>
          <div>
            <p className="bg-gradient-to-r from-white to-cyan-200 bg-clip-text text-lg font-bold tracking-tight text-transparent">Minha Gestão Pessoal</p>
            <p className="text-xs text-slate-400">Gestão financeira · barbearia</p>
          </div>
        </div>
        <div className="rounded-2xl border border-blue-400/20 bg-gradient-to-br from-[#111c30] to-[#0b1220] p-6 shadow-[0_0_40px_rgba(8,145,178,0.10)] sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

export const authInputClass =
  "mt-1 w-full rounded-xl border border-blue-400/20 bg-[#050914] px-3 py-3 text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400";
export const authPrimaryButtonClass =
  "w-full rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_0_22px_rgba(37,99,235,0.25)] transition hover:brightness-110 disabled:opacity-50";
