
"use client";

import { useState } from "react";
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Facebook, 
  Youtube, 
  Send, 
  MessageSquare, 
  Instagram, 
  Twitter, 
  Linkedin, 
  Globe,
  Share2,
  ExternalLink
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const ICON_MAP: Record<string, any> = {
  Facebook,
  Youtube,
  Send,
  MessageSquare,
  Instagram,
  Twitter,
  Linkedin,
  Globe
};

export default function AdminSocialManagement() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [newLink, setNewLink] = useState({
    label: "",
    url: "",
    icon: "Globe",
    color: "#29B6F6"
  });

  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, "settings", "general");
  }, [firestore]);

  const { data: settings, isLoading } = useDoc(settingsRef);
  const socialLinks = settings?.socialLinks || [];

  const handleOpenAdd = () => {
    setEditingId(null);
    setNewLink({ label: "", url: "", icon: "Globe", color: "#29B6F6" });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (link: any) => {
    setEditingId(link.id);
    setNewLink({ ...link });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!firestore || !settingsRef) return;
    if (!newLink.label || !newLink.url) {
      toast({ variant: "destructive", title: "بيانات ناقصة" });
      return;
    }

    let updatedLinks = [...socialLinks];
    if (editingId) {
      updatedLinks = updatedLinks.map(l => l.id === editingId ? { ...newLink, id: editingId } : l);
    } else {
      updatedLinks.push({ ...newLink, id: Date.now().toString() });
    }

    try {
      await updateDoc(settingsRef, { socialLinks: updatedLinks });
      toast({ title: "تم الحفظ بنجاح", description: "تحديث قائمة تابعنا سيظهر للجميع الآن." });
      setIsModalOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ في الحفظ" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!firestore || !settingsRef) return;
    const updatedLinks = socialLinks.filter((l: any) => l.id !== id);
    try {
      await updateDoc(settingsRef, { socialLinks: updatedLinks });
      toast({ title: "تم الحذف بنجاح" });
    } catch (e) {
      toast({ variant: "destructive", title: "خطأ في الحذف" });
    }
  };

  if (isLoading) return <div className="p-10 text-center font-bold animate-pulse text-2xl">جاري تحميل إدارة القائمة...</div>;

  return (
    <div className="p-6 md:p-10 space-y-10" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-r-8 border-primary pr-6">
        <div>
          <h1 className="text-4xl font-black font-headline text-zinc-900">إدارة قائمة "تابعنا"</h1>
          <p className="text-muted-foreground text-lg">تحكم كامل في الروابط والأيقونات التي تظهر في تذييل الموقع.</p>
        </div>
        <Button onClick={handleOpenAdd} className="h-16 px-10 rounded-2xl font-black text-xl shadow-xl hover:scale-105 transition-transform">
          <Plus className="ml-2 h-6 w-6" /> إضافة رابط جديد
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {socialLinks.map((link: any) => {
          const Icon = ICON_MAP[link.icon] || Globe;
          return (
            <Card key={link.id} className="rounded-[2.5rem] border-2 shadow-lg overflow-hidden bg-white hover:border-primary transition-all group">
              <CardContent className="p-8 space-y-6">
                <div className="flex justify-between items-start">
                  <div 
                    style={{ backgroundColor: link.color + '20', color: link.color }} 
                    className="p-4 rounded-2xl shadow-inner"
                  >
                    <Icon size={32} />
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(link)} className="rounded-xl hover:bg-zinc-100"><Edit3 size={18} /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(link.id)} className="rounded-xl hover:bg-red-50 text-red-500"><Trash2 size={18} /></Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-zinc-800">{link.label}</h3>
                  <p className="text-xs text-muted-foreground font-mono truncate">{link.url}</p>
                </div>

                <div className="pt-4 border-t border-dashed flex justify-between items-center">
                  <Badge variant="secondary" className="bg-zinc-100 text-zinc-500 font-bold border-none px-3 py-1">
                    {link.icon}
                  </Badge>
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-black text-xs flex items-center gap-1">
                    معاينة الرابط <ExternalLink size={12} />
                  </a>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {socialLinks.length === 0 && (
          <div className="col-span-full py-32 text-center bg-zinc-50 rounded-[4rem] border-4 border-dashed border-zinc-100 flex flex-col items-center gap-6">
            <Share2 size={64} className="text-zinc-200" />
            <p className="text-2xl font-black text-zinc-300">لا توجد روابط مضافة حالياً في قائمة "تابعنا".</p>
          </div>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-[3rem]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right text-3xl font-black">{editingId ? 'تعديل الرابط' : 'إضافة رابط جديد'}</DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-6">
            <div className="space-y-2">
              <Label className="font-black">اسم المنصة (مثال: تليجرام)</Label>
              <Input 
                value={newLink.label} 
                onChange={(e) => setNewLink({...newLink, label: e.target.value})} 
                className="h-14 rounded-xl border-2 font-bold"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-black">رابط الصفحة (URL)</Label>
              <Input 
                value={newLink.url} 
                onChange={(e) => setNewLink({...newLink, url: e.target.value})} 
                placeholder="https://..."
                className="h-14 rounded-xl border-2 font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-black">الأيقونة</Label>
                <Select value={newLink.icon} onValueChange={(v) => setNewLink({...newLink, icon: v})}>
                  <SelectTrigger className="h-14 rounded-xl border-2 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(ICON_MAP).map(key => (
                      <SelectItem key={key} value={key} className="font-bold">{key}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-black">لون الأيقونة</Label>
                <div className="flex gap-2">
                  <Input 
                    type="color" 
                    value={newLink.color} 
                    onChange={(e) => setNewLink({...newLink, color: e.target.value})} 
                    className="h-14 w-14 p-1 rounded-xl cursor-pointer"
                  />
                  <Input 
                    value={newLink.color} 
                    onChange={(e) => setNewLink({...newLink, color: e.target.value})} 
                    className="h-14 flex-1 rounded-xl border-2 font-mono uppercase"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} className="w-full h-16 rounded-2xl font-black text-xl shadow-xl">
              {editingId ? 'حفظ التعديلات' : 'إضافة الآن'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
