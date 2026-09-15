
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Mail, Phone, Clock, MessageSquare, Send, Youtube, Facebook } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ContactUsPage() {
  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-16 mb-20" dir="rtl">
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-7xl font-black font-headline tracking-tight text-zinc-900">اتصل بنا</h1>
        <p className="text-muted-foreground text-xl md:text-2xl font-bold">نحن دائماً بالقرب منك، يسعدنا تواصلك معنا.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* العناوين والاتصال */}
        <div className="space-y-8">
          <h2 className="text-3xl font-black text-zinc-800 border-r-8 border-primary pr-4">مقراتنا الرسمية</h2>
          <div className="grid gap-6">
            <AddressCard 
              city="الجيزة" 
              address="15 شارع التحرير، الدقي، مصر" 
            />
            <AddressCard 
              city="القاهرة" 
              address="22 شارع 9، المعادي، مصر" 
            />
          </div>

          <div className="space-y-6 pt-6">
            <h2 className="text-3xl font-black text-zinc-800 border-r-8 border-accent pr-4">بيانات التواصل</h2>
            <div className="space-y-4">
              <ContactItem icon={Mail} label="البريد الإلكتروني" value="support@fahimt.com" />
              <ContactItem icon={Phone} label="الهاتف الموحد" value="+20 10 1234 5678" />
              <ContactItem icon={Clock} label="مواعيد العمل" value="الأحد - الخميس (10 ص - 6 م)" />
            </div>
          </div>
        </div>

        {/* نموذج التواصل السريع */}
        <Card className="rounded-[3rem] shadow-2xl border-none overflow-hidden bg-white">
          <div className="bg-primary p-10 text-white text-center">
            <MessageSquare size={48} className="mx-auto mb-4" />
            <h3 className="text-2xl font-black">أرسل لنا رسالة</h3>
            <p className="text-primary-foreground/80 font-bold">سنقوم بالرد عليك خلال ساعات العمل.</p>
          </div>
          <CardContent className="p-10 space-y-6">
            <div className="space-y-4">
              <input placeholder="الاسم الكامل" className="w-full h-14 rounded-2xl border-2 px-6 font-bold text-right" />
              <input placeholder="البريد الإلكتروني" type="email" className="w-full h-14 rounded-2xl border-2 px-6 font-bold text-right" />
              <textarea placeholder="كيف نساعدك؟" className="w-full h-40 rounded-2xl border-2 p-6 font-bold text-right" />
              <Button className="w-full h-16 rounded-2xl font-black text-xl bg-primary shadow-xl hover:scale-[1.02] transition-all">
                إرسال الآن <Send size={20} className="mr-2 rotate-180" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AddressCard({ city, address }: any) {
  return (
    <Card className="rounded-2xl border-2 p-6 hover:border-primary transition-all group">
      <div className="flex items-start gap-4">
        <div className="bg-primary/10 p-3 rounded-xl text-primary group-hover:bg-primary group-hover:text-white transition-all">
          <MapPin size={24} />
        </div>
        <div className="text-right">
          <h4 className="font-black text-xl text-zinc-800">{city}</h4>
          <p className="text-zinc-500 font-bold mt-1">{address}</p>
        </div>
      </div>
    </Card>
  );
}

function ContactItem({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-center gap-4 p-4 bg-zinc-50 rounded-2xl border border-zinc-100 flex-row-reverse">
      <div className="bg-white p-2 rounded-lg shadow-sm text-accent"><Icon size={20} /></div>
      <div className="text-right">
        <p className="text-[10px] font-black text-zinc-400 uppercase">{label}</p>
        <p className="font-black text-zinc-800">{value}</p>
      </div>
    </div>
  );
}
