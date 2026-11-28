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

export type MenuItem = { id: string; title: string; description: string; answer: string; imageUrl: string; enabled: boolean };

/** خيارات القائمة الافتراضية (نفس الموجودة في الكود). الرد الفاضي = الرد الجاهز من "نصوص البوت" */
export const DEFAULT_MENU: MenuItem[] = [
  { id: "courses", title: "الكورسات والأسعار", description: "الكورسات المتاحة وطريقة الشراء", answer: "", imageUrl: "", enabled: true },
  { id: "booking", title: "حجز محاضرة", description: "محاضرة فردية مع مُفَهِّم خطوة بخطوة", answer: "", imageUrl: "", enabled: true },
  { id: "payment", title: "الدفع والمحفظة", description: "الشحن، الإيصال، والخصم المعلّق", answer: "", imageUrl: "", enabled: true },
  { id: "session", title: "مشكلة في محاضرة", description: "الصوت، الصورة، أو التسجيل", answer: "", imageUrl: "", enabled: true },
  { id: "account", title: "حسابي", description: "الدخول، كلمة السر، البيانات", answer: "", imageUrl: "", enabled: true },
  { id: "human", title: "التحدث مع موظف", description: "تحويل المحادثة لفريق الدعم", answer: "", imageUrl: "", enabled: true },
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
      <p className="text-xs text-muted-foreground">أقصى ١٠ خيارات بتظهر للعميل. الخيار الجاهز لو سبت رده فاضي بيرد بالنص الجاهز من «نصوص البوت». خيار «التحدث مع موظف» بيحوّل المحادثة دايمًا.</p>
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
              <Textarea value={m.answer} onChange={(e) => upd(i, { answer: e.target.value })} rows={3}
                placeholder={builtIn(m.id) ? "الرد (سيبه فاضي لاستخدام الرد الجاهز)" : "الرد اللي يوصل للعميل لما يختار الخيار ده"} className="rounded-lg" />
              <ImageField value={m.imageUrl} onChange={(url) => upd(i, { imageUrl: url })} />
            </>
          )}
        </div>
      ))}
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="gap-2" disabled={items.length >= 10}
          onClick={() => setItems((l) => [...l, { id: `custom_${Date.now()}`, title: "", description: "", answer: "", imageUrl: "", enabled: true }])}>
          <Plus size={16} /> إضافة خيار
        </Button>
        <Button type="button" variant="ghost" onClick={() => setItems(() => DEFAULT_MENU.map((x) => ({ ...x })))}>رجوع للافتراضي</Button>
      </div>
    </div>
  );
}
