import { db } from '../firebaseConfig';
import {
  doc,
  collection,
  runTransaction,
  serverTimestamp
} from 'firebase/firestore';

export async function addWalletBalanceAdmin(userId, amount) {
  if (!userId || amount <= 0) throw new Error('بيانات الشحن غير صحيحة');

  const userRef = doc(db, 'users', userId);

  return await runTransaction(db, async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists()) {
      throw new Error('حساب المستخدم غير موجود');
    }

    const currentBalance = Number(userDoc.data().walletBalance || 0);
    const updatedBalance = currentBalance + Number(amount);

    transaction.update(userRef, { walletBalance: updatedBalance });

    const topupRef = doc(collection(db, 'wallet_topups'));
    transaction.set(topupRef, {
      userId,
      amount: Number(amount),
      createdAt: serverTimestamp(),
      type: 'admin_deposit',
    });

    return updatedBalance;
  });
}

export async function executeCoursePurchase({
  userId,
  courseId,
  price,
  paymentMethod,
  accountName,
  email,
  phone,
}) {
  const userRef = doc(db, 'users', userId);
  const orderNumber = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;

  return await runTransaction(db, async (transaction) => {
    let userBalance = 0;

    if (paymentMethod === 'wallet') {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) throw new Error('المستخدم غير موجود');
      
      userBalance = Number(userDoc.data().walletBalance || 0);
      if (userBalance < price) {
        throw new Error('رصيد المحفظة غير كافٍ لإتمام عملية الشراء');
      }

      transaction.update(userRef, { walletBalance: userBalance - price });
    }

    const paymentRef = doc(collection(db, 'payments'));
    const paymentData = {
      orderId: orderNumber,
      userId,
      courseId,
      amount: price,
      paymentMethod,
      accountName,
      email,
      phone,
      status: 'completed',
      createdAt: serverTimestamp(),
    };

    transaction.set(paymentRef, paymentData);

    const enrollmentRef = doc(db, 'enrollments', `${userId}_${courseId}`);
    transaction.set(enrollmentRef, {
      userId,
      courseId,
      enrolledAt: serverTimestamp(),
    });

    return paymentData;
  });
}
