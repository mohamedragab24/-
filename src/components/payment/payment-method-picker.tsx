"use client";
import { useEffect, useMemo, useState } from "react";
import { Wallet, Smartphone, CreditCard, Landmark, ChevronDown, Check } from "lucide-react";
import { PAYMENT_GROUPS, gatewayGroup, type PaymentGroupKey } from "@/lib/payment-groups";

const ICONS: Record<PaymentGroupKey, { icon: any; cls: string }> = {
  wallet: { icon: Wallet, cls: "bg-gradient-to-br from-blue-500 to-indigo-600 text-white" },
  instapay: { icon: Smartphone, cls: "bg-gradient-to-br from-fuchsia-600 to-purple-700 text-white" },
  telda: { icon: CreditCard, cls: "bg-slate-900 text-white" },
  card: { icon: CreditCard, cls: "bg-gradient-to-br from-violet-200 to-fuchsia-200 text-slate-700" },
  bank: { icon: Landmark, cls: "bg-slate-200 text-slate-700" },
  other: { icon: Wallet, cls: "bg-zinc-200 text-zinc-700" },
};

/** شعار مزود الخدمة (المرفوع من لوحة التحكم) أو حرف أول عند عدم وجوده. */
export function GatewayLogo({ m, size = 40 }: { m: any; size?: number }) {
  const s = { width: size, height: size } as const;
  if (m?.logoUrl) return <img src={m.logoUrl} alt={m?.name || ""} style={s} className="rounded-xl object-contain bg-white border shrink-0" />;
  return <div style={s} className="rounded-xl bg-primary/10 text-primary font-black flex items-center justify-center shrink-0">{String(m?.name || "?").trim().charAt(0)}</div>;
}

const Radio = ({ on }: { on: boolean }) => (
  <span className={`h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 transition ${on ? "border-primary bg-primary" : "border-zinc-300 bg-white"}`}>{on && <Check className="h-3.5 w-3.5 text-white" />}</span>
);

/**
 * اختيار طريقة الدفع: مجموعات قابلة للطي (محفظة إلكترونية / إنستا باي / تيلدا / بطاقة / تحويل بنكي)
 * وتحت كل مجموعة خدماتها بشعار المزود. القيمة value = معرّف مستند البوابة (paymentMethods).
 */
export function PaymentMethodPicker({ methods, value, onChange }: { methods: any[]; value: string; onChange: (id: string) => void }) {
  const groups = useMemo(() => {
    const out: { key: PaymentGroupKey; title: string; items: any[] }[] = PAYMENT_GROUPS.map((g) => ({ key: g.key, title: g.title, items: methods.filter((m) => gatewayGroup(m) === g.key) }));
    const other = methods.filter((m) => gatewayGroup(m) === "other");
    if (other.length) out.push({ key: "other", title: "وسائل أخرى", items: other });
    return out.filter((g) => g.items.length > 0);
  }, [methods]);

  const selectedGroup = groups.find((g) => g.items.some((m) => m.id === value))?.key;
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { if (selectedGroup) setOpen(selectedGroup); }, [selectedGroup]);

  return (
    <div className="space-y-3">
      {groups.map((g) => {
        const { icon: Icon, cls } = ICONS[g.key];
        const expanded = open === g.key;
        const chosen = selectedGroup === g.key;
        return (
          <div key={g.key} className={`rounded-2xl border-2 bg-white overflow-hidden transition ${chosen ? "border-primary/60" : "border-zinc-200"}`}>
            <button type="button" onClick={() => setOpen(expanded ? null : g.key)} className="w-full flex items-center gap-3 p-3 text-right">
              <span className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${cls}`}><Icon className="h-6 w-6" /></span>
              <span className="flex-1 font-black text-base text-zinc-900">{g.title}</span>
              <ChevronDown className={`h-5 w-5 text-zinc-400 transition ${expanded ? "rotate-180" : ""}`} />
              <Radio on={!!chosen} />
            </button>
            {expanded && (
              <div className="px-3 pb-3 space-y-2 bg-zinc-50/70 pt-2">
                {g.items.map((m) => (
                  <button type="button" key={m.id} onClick={() => onChange(m.id)} className={`w-full flex items-center gap-3 p-2.5 rounded-xl border bg-white text-right transition ${value === m.id ? "border-primary shadow-sm" : "border-zinc-200 hover:border-zinc-300"}`}>
                    <GatewayLogo m={m} />
                    <span className="flex-1 font-bold text-sm text-zinc-800">{m.name}</span>
                    <Radio on={value === m.id} />
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
