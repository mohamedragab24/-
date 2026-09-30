'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';

export default function OrderSuccessPage() {
  const searchParams = useSearchParams();

  const orderId = searchParams.get('orderId') || '---';
  const accountName = searchParams.get('accountName') || '---';
  const email = searchParams.get('email') || '---';
  const phone = searchParams.get('phone') || '---';
  const method = searchParams.get('method') || 'wallet';
  const amount = searchParams.get('amount') || '0';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 dir-rtl" dir="rtl">
      <div className="bg-white max-w-md w-full rounded-2xl shadow-xl p-6 text-center border border-gray-100">
        <div className="flex justify-center mb-4">
          <img src="/logo.png" alt="لوجو فهمني" className="h-14 object-contain" />
        </div>

        <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold mb-3">
          ✓
        </div>
        <h1 className="text-xl font-bold text-gray-800 mb-1">تم إتمام الطلب بنجاح</h1>
        <p className="text-xs text-gray-500 mb-6">شكراً لثقتك بمنصة فهمني</p>

        <div className="bg-gray-50 rounded-xl p-4 text-right text-sm space-y-3 mb-6">
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-500">رقم الطلب:</span>
            <span className="font-semibold text-gray-800">{orderId}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-500">اسم الحساب:</span>
            <span className="font-semibold text-gray-800">{accountName}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-500">البريد الإلكتروني:</span>
            <span className="font-semibold text-gray-800">{email}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-500">رقم الهاتف:</span>
            <span className="font-semibold text-gray-800">{phone}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-500">طريقة الدفع:</span>
            <span className="font-semibold text-gray-800">
              {method === 'wallet' ? 'خصم من المحفظة' : 'دفع عبر رقم الهاتف'}
            </span>
          </div>
          <div className="flex justify-between pt-1">
            <span className="text-gray-500">المبلغ الإجمالي:</span>
            <span className="font-bold text-green-600 text-base">{amount} ج.م</span>
          </div>
        </div>

        <a
          href={`fahemny://course-view?orderId=${orderId}`}
          className="block w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold shadow-md transition"
        >
          المشاهدة في التطبيق
        </a>
      </div>
    </div>
  );
}
