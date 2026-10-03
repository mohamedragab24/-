"use client";

import Link from "next/link";
import { BookOpen, ClipboardList, Users, Wallet, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useUser } from "@/firebase";

const features = [
  { icon: Search, title: "تصفح الطلبات", desc: "شوف طلبات الشرح المتاحة واختار اللي يناسبك.", href: "/browse" },
  { icon: BookOpen, title: "الكورسات", desc: "كورسات مسجلة ومباشرة من أفضل المفهمين.", href: "/courses" },
  { icon: Users, title: "المجموعات", desc: "انضم لمجموعات التعلم أو أنشئ مجموعتك.", href: "/groups" },
  { icon: Wallet, title: "المحفظة", desc: "إدارة رصيدك ومعاملاتك بسهولة.", href: "/wallet" },
];

export default function HomePage() {
  const { user, isUserLoading } = useUser();

  return (
    <div className="w-full px-4 py-10 md:py-16 space-y-12">
      <section className="text-center max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl md:text-5xl font-black leading-tight">
          فهمت — منصة التعلم الذكي والشرح الفوري
        </h1>
        <p className="text-muted-foreground text-base md:text-lg">
          اربط نفسك بأفضل المفهمين واحصل على شرح مباشر لأي معلومة تحتاجها بأمان وجودة عالية.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="font-bold">
            <Link href="/create-request">
              <ClipboardList className="ml-2 h-5 w-5" />
              طرح استفهام
            </Link>
          </Button>
          {!isUserLoading && !user && (
            <Button asChild size="lg" variant="outline" className="font-bold">
              <Link href="/login">تسجيل الدخول</Link>
            </Button>
          )}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
        {features.map(({ icon: Icon, title, desc, href }) => (
          <Link key={href} href={href}>
            <Card className="h-full hover:shadow-md transition-shadow">
              <CardContent className="p-6 space-y-3 text-center">
                <Icon className="h-8 w-8 mx-auto text-primary" />
                <h3 className="font-black text-lg">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
