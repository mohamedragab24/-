/** حساب رصيد المحفظة من سجل المعاملات — نفس المنطق المستخدم في الخادم (functions/index.js). */
export function computeBalance(transactions: any[] | null | undefined): number {
  let balance = 0;
  for (const t of transactions || []) {
    if (["rejected", "pending", "cancelled"].includes(String(t?.status || ""))) {
      // طلب سحب معلّق يُحجز من الرصيد حتى لا يُصرف مرتين
      if (String(t?.type || "") === "withdrawal" && String(t?.status) === "pending") balance -= Number(t?.amount || 0);
      continue;
    }
    const n = Number(t?.amount || 0);
    if (["deposit", "earning", "refund"].includes(String(t?.type || ""))) balance += n;
    else balance -= n;
  }
  return Math.round(balance * 100) / 100;
}
