
"use client";

import { useState } from "react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, doc, setDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Edit3, Check, X, Layers, Filter, Settings2, PlusCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function AdminTeacherCategories() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [newVal, setNewVal] = useState("");
  const [editingId, setEditId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [parentForSub, setParentForSub] = useState<any>(null);

  // جلب كافة التصنيفات (نستخدم نفس مجموعة categories لتوحيد النظام)
  const categoriesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "categories"), orderBy("createdAt", "desc"));
  }, [firestore]);

  const { data: allCategories, isLoading } = useCollection(categoriesQuery);

  const handleAdd = async (type: 'main' | 'sub' | 'option', parentId: string | null = null) => {
    if (!firestore || !newVal.trim()) return;
    
    const id = doc(collection(firestore, "categories")).id;
    try {
      await setDoc(doc(firestore, "categories", id), {
        id,
        name: newVal.trim(),
        type: type,
        parentId: parentId,
        createdAt: new Date().toISOString()
      });
      setNewVal("");
      setParentForSub(null);
      toast({ title: "تمت إضافة القسم/التخصص بنجاح" });
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ في الإضافة" });
    }
  };

  const handleSaveEdit = async (id: string) => {
    if (!firestore || !editValue.trim()) return;
    try {
      await updateDoc(doc(firestore, "categories", id), { name: editValue.trim() });
      setEditId(null);
      setEditValue("");
      toast({ title: "تم التعديل بنجاح" });
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ في الحفظ" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, "categories", id));
      toast({ title: "تم الحذف بنجاح" });
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ في الحذف" });
    }
  };

  const mainCategories = allCategories?.filter(c => c.type === 'main' || !c.type) || [];

  return (
    <div className="p-6 md:p-10 space-y-10" dir="rtl">
      <div className="border-r-8 border-primary pr-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black font-headline text-zinc-900">أقسام المفهمين</h1>
          <p className="text-muted-foreground text-lg">بناء وتنظيم هيكل التخصصات التعليمية للمفهمين والطلاب.</p>
        </div>
        <div className="flex gap-4 w-full md:w-auto">
          <Input 
            placeholder="اسم قسم رئيسي جديد..." 
            className="h-14 md:w-64 rounded-xl border-2 font-bold"
            value={newVal}
            onChange={(e) => setNewVal(e.target.value)}
          />
          <Button onClick={() => handleAdd('main')} className="h-14 px-8 rounded-xl font-black shadow-lg">
            <Plus className="ml-2" /> إضافة قسم
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-10">
        {isLoading ? (
          <div className="py-20 text-center animate-pulse font-black text-2xl">جاري تحميل هيكل الأقسام...</div>
        ) : (
          mainCategories.map((main) => (
            <Card key={main.id} className="shadow-xl rounded-[2.5rem] border-2 border-primary/10 overflow-hidden bg-white hover:border-primary/20 transition-all">
              <CardHeader className="bg-primary/5 p-8 border-b flex flex-row justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="bg-primary p-3 rounded-2xl text-white shadow-lg">
                    <Layers size={24} />
                  </div>
                  {editingId === main.id ? (
                    <div className="flex gap-2">
                      <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="h-10 w-48 font-bold" />
                      <Button size="sm" onClick={() => handleSaveEdit(main.id)} className="bg-green-600"><Check size={16} /></Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditId(null); setEditValue(""); }}><X size={16} /></Button>
                    </div>
                  ) : (
                    <CardTitle className="text-2xl font-black text-primary">{main.name}</CardTitle>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setEditId(main.id); setEditValue(main.name); }} className="rounded-xl h-10 w-10 p-0"><Edit3 size={16} /></Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(main.id)} className="rounded-xl h-10 w-10 p-0"><Trash2 size={16} /></Button>
                  <Button variant="default" size="sm" onClick={() => setParentForSub(main)} className="bg-accent hover:bg-accent/90 rounded-xl font-black h-10 px-4">
                    <PlusCircle size={16} className="ml-2" /> إضافة تخصص
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {allCategories?.filter(sub => sub.type === 'sub' && sub.parentId === main.id).map((sub) => (
                    <div key={sub.id} className="p-6 bg-zinc-50 rounded-[2rem] border-2 border-dashed border-zinc-200 space-y-6 relative group hover:bg-white hover:border-accent/30 transition-all">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          {editingId === sub.id ? (
                            <div className="flex gap-2 mb-2">
                              <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="h-10 text-sm font-bold" />
                              <Button size="sm" onClick={() => handleSaveEdit(sub.id)} className="bg-green-600"><Check size={14} /></Button>
                              <Button size="sm" variant="ghost" onClick={() => { setEditId(null); setEditValue(""); }}><X size={14} /></Button>
                            </div>
                          ) : (
                            <span className="font-black text-xl flex items-center gap-2 text-zinc-800">
                              <Filter size={18} className="text-accent" /> {sub.name}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-blue-500" onClick={() => { setEditId(sub.id); setEditValue(sub.name); }}><Edit3 size={14} /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-red-500" onClick={() => handleDelete(sub.id)}><Trash2 size={14} /></Button>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        {allCategories?.filter(opt => opt.type === 'option' && opt.parentId === sub.id).map((opt) => (
                          <Badge key={opt.id} variant="secondary" className="bg-white border-2 px-3 py-1 rounded-lg flex items-center gap-2 font-bold">
                            {opt.name}
                            <button onClick={() => handleDelete(opt.id)} className="text-red-400 hover:text-red-600"><X size={10} /></button>
                          </Badge>
                        ))}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setParentForSub(sub)}
                          className="h-8 px-3 text-xs font-black border-2 border-dashed border-zinc-300 rounded-lg hover:border-primary hover:text-primary hover:bg-primary/5"
                        >
                          <Plus size={12} className="ml-1" /> مهارة
                        </Button>
                      </div>
                    </div>
                  ))}
                  {allCategories?.filter(sub => sub.type === 'sub' && sub.parentId === main.id).length === 0 && (
                    <div className="col-span-full py-10 text-center text-muted-foreground italic border-2 border-dashed rounded-3xl">
                      لا توجد تخصصات فرعية مضافة بعد.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {parentForSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <Card className="w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 space-y-6 bg-white border-4 border-primary/20">
            <div className="flex justify-between items-center border-b pb-4">
              <h3 className="text-xl font-black">إضافة {parentForSub.type === 'main' ? 'تخصص' : 'مهارة'} تحت <span className="text-primary">{parentForSub.name}</span></h3>
              <Button variant="ghost" onClick={() => { setParentForSub(null); setNewVal(""); }} className="rounded-full h-10 w-10 p-0"><X /></Button>
            </div>
            <div className="space-y-4">
              <Label className="font-black">الاسم الجديد</Label>
              <Input 
                autoFocus
                placeholder="اكتب هنا..." 
                className="h-14 rounded-xl border-2 text-lg font-bold text-right"
                value={newVal}
                onChange={(e) => setNewVal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd(parentForSub.type === 'main' ? 'sub' : 'option', parentForSub.id)}
              />
              <Button onClick={() => handleAdd(parentForSub.type === 'main' ? 'sub' : 'option', parentForSub.id)} className="w-full h-14 rounded-xl font-black text-lg shadow-xl">
                تأكيد الإضافة الآن
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
