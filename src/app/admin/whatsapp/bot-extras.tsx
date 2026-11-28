"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { uploadWaImage } from "./wa-upload";
import { ImagePlus, Trash2, Plus, ArrowUp, ArrowDown } from "lucide-react";

/** زرار رفع صورة (بيرجّع الرابط) + معاينة وإزالة */
export function ImageField({ value, onChange, label = "صورة" }: { value: string; onChange: (url: string) => void; label?: string }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const pick = async (file: File) => {
    setUploading(true);
    try {
      onChange(await uploadWaImage(file));
    } catch (e: any) {
      toast({ variant: "destructive", title: "فشل رفع الصورة", description: e?.message || "" });
    } finally { setUploading(false); }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="inline-flex items-center gap-2 cursor-pointer rounded-md border px-3 h-9 text-xs font-bold bg-white">
        <ImagePlus size={14} /> {value ? `تغيير ${label}` : `إضافة ${label}`}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ""; }} />
      </label>
      {uploading && <span className="text-xs font-bold">جارٍ الرفع...</span>}
      {value && <img src={value} alt="" className="h-12 rounded border" />}
      {value && <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>إزالة</Button>}
    </div>
  );
}

export type Step = { text: string; imageUrl: string };
export const MAX_STEPS = 8;

/** يحوّل الشكل القديم (نص + صورة واحدة) لسلسلة رسايل */
export function legacyToSteps(answer?: string, imageUrl?: string): Step[] {
  const t = String(answer || "").trim();
  const u = String(imageUrl || "");
  return t || u ? [{ text: t, imageUrl: u }] : [];
}

/** محرر سلسلة الردود: كل رد رسالة منفصلة (نص و/أو صورة) بتتبعت ورا بعض بالترتيب */
export function SequenceEditor({ steps, onChange, placeholder = "نص الرسالة" }: { steps: Step[]; onChange: (s: Step[]) => void; placeholder?: string }) {
  const upd = (i: number, patch: Partial<Step>) => onChange(steps.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= steps.length) return;
    const c = [...steps]; [c[i], c[j]] = [c[j], c[i]]; onChange(c);
  };
  return (
    <div className="space-y-2">
      {steps.map((s, i) => (
        <div key={i} className="rounded-xl border bg-muted/30 p-2 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black text-muted-foreground shrink-0">رسالة {i + 1}</span>
            <div className="flex-1" />
            <Button type="button" variant="ghost" size="icon" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={14} /></Button>
            <Button type="button" variant="ghost" size="icon" disabled={i === steps.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14} /></Button>
            <Button type="button" variant="ghost" size="icon" title="حذف الرسالة" onClick={() => onChange(steps.filter((_, idx) => idx !== i))}>
              <Trash2 size={14} className="text-red-500" />
            </Button>
          </div>
          <Textarea value={s.text} onChange={(e) => upd(i, { text: e.target.value })} rows={2} placeholder={placeholder} className="rounded-lg text-sm" />
          <ImageField value={s.imageUrl} onChange={(url) => upd(i, { imageUrl: url })} />
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="rounded-lg gap-1" disabled={steps.length >= MAX_STEPS}
        onClick={() => onChange([...steps, { text: "", imageUrl: "" }])}>
        <Plus size={14} /> إضافة رسالة {steps.length >= MAX_STEPS ? `(الحد الأقصى ${MAX_STEPS})` : ""}
      </Button>
    </div>
  );
}

export type MenuItem = { id: string; title: string; description: string; messages: Step[]; enabled: boolean };

/** خيارات القائمة الافتراضية (نفس الموجودة في الكود). الرد الفاضي = الرد الجاهز من "نصوص البوت" */
export const DEFAULT_MENU: MenuItem[] = [
  { id: "courses", title: "الكورسات والأسعار", description: "الكورسات المتاحة وطريقة الشراء", messages: [], enabled: true },
  { id: "booking", title: "حجز محاضرة", description: "محاضرة فردية مع مُفَهِّم خطوة بخطوة", messages: [], enabled: true },
  { id: "payment", title: "الدفع والمحفظة", description: "الشحن، الإيصال، والخصم المعلّق", messages: [], enabled: true },
  { id: "session", title: "مشكلة في محاضرة", description: "الصوت، الصورة، أو التسجيل", messages: [], enabled: true },
  { id: "account", title: "حسابي", description: "الدخول، كلمة السر، البيانات", messages: [], enabled: true },
  { id: "human", title: "التحدث مع موظف", description: "تحويل المحادثة لفريق الدعم", messages: [], enabled: true },
];

export function MenuEditor({ items, setItems }: { items: MenuItem[]; setItems: (f: (l: MenuItem[]) => MenuItem[]) => void }) {
  const upd = (i: number, patch: Partial<MenuItem>) => setItems((l) => l.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: number) => setItems((l) => {
    const j = i + d;
    if (j < 0 || j >= l.length) return l;
    const c = [...l]; [c[i], c[j]] = [c[j], c[i]]; return c;
  });
  const builtIn = (id: string) => DEFAULT_MENU.some((m) => m.id === id);
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">أقصى ١٠ خيارات بتظهر للعميل. كل خيار ممكن له أكتر من رسالة (نص و/أو صورة) بتتبعت ورا بعض بالترتيب وبفاصل قصير (حد أقصى ٨ رسايل). خيار «التحدث مع موظف» بيحوّل المحادثة دايمًا.</p>
      {items.map((m, i) => (
        <div key={m.id} className="border-2 rounded-2xl p-3 space-y-2 bg-white">
          <div className="flex gap-2 items-center">
            <Input value={m.title} maxLength={24} onChange={(e) => upd(i, { title: e.target.value })} placeholder="عنوان الخيار (حتى ٢٤ حرف)" className="rounded-lg font-bold" />
            <Switch checked={m.enabled} onCheckedChange={(v) => upd(i, { enabled: v })} />
            <Button type="button" variant="ghost" size="icon" onClick={() => move(i, -1)}><ArrowUp size={16} /></Button>
            <Button type="button" variant="ghost" size="icon" onClick={() => move(i, 1)}><ArrowDown size={16} /></Button>
            {m.id !== "human" && (
              <Button type="button" variant="ghost" size="icon" title="حذف الخيار" onClick={() => setItems((l) => l.filter((_, idx) => idx !== i))}>
                <Trash2 size={16} className="text-red-500" />
              </Button>
            )}
          </div>
          <Input value={m.description} maxLength={72} onChange={(e) => upd(i, { description: e.target.value })} placeholder="وصف قصير (اختياري)" className="rounded-lg text-sm" />
          {m.id !== "human" && (
            <>
              {builtIn(m.id) && m.messages.length === 0 && <p className="text-xs text-muted-foreground">من غير رسايل هنا بيرد بالنص الجاهز من «نصوص البوت».</p>}
              <SequenceEditor steps={m.messages} onChange={(messages) => upd(i, { messages })}
                placeholder={builtIn(m.id) ? "نص الرسالة (سيبه فاضي لاستخدام الرد الجاهز)" : "نص الرسالة اللي توصل للعميل لما يختار الخيار ده"} />
            </>
          )}
        </div>
      ))}
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="gap-2" disabled={items.length >= 10}
          onClick={() => setItems((l) => [...l, { id: `custom_${Date.now()}`, title: "", description: "", messages: [], enabled: true }])}>
          <Plus size={16} /> إضافة خيار
        </Button>
        <Button type="button" variant="ghost" onClick={() => setItems(() => DEFAULT_MENU.map((x) => ({ ...x })))}>رجوع للافتراضي</Button>
      </div>
    </div>
  );
}
