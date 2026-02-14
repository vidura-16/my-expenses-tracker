import { db } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  query,
  where,
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch
} from "firebase/firestore";

const EXPENSES = "expenses";
const CREDIT_CARDS = "creditCards";
const DAILY_TARGETS = "dailyTargets";
const INSTALLMENTS = "installments";

// Expense Functions
export const addExpense = async (uid, expenseData) => {
  try {
    const expense = {
      amount: parseFloat(expenseData.amount),
      category: expenseData.category || "other", // food | travel | utility | other
      type: expenseData.type || "daily", // daily | other
      paymentType: expenseData.paymentType || "cash", // cash | debit | credit
      date: expenseData.date || new Date().toISOString().split("T")[0], // YYYY-MM-DD string
      timestamp: serverTimestamp(),
      note: expenseData.note || ""
    };

    // Handle installment data for credit payments
    if (expenseData.paymentType === "credit" && expenseData.isInstallment) {
      console.log('Creating installment for credit payment:', expenseData);
      const monthlyAmount = parseFloat(expenseData.amount) / expenseData.installmentMonths;
      expense.creditData = {
        cardId: expenseData.cardId || "default_credit",
        totalInstallments: expenseData.installmentMonths,
        currentInstallment: 1,
        monthlyAmount: monthlyAmount,
        isInstallment: true
      };
      console.log('Credit data created:', expense.creditData);
    } else if (expenseData.paymentType === "credit" && expenseData.creditData) {
      expense.creditData = {
        cardId: expenseData.creditData.cardId,
        totalInstallments: expenseData.creditData.totalInstallments || 1,
        currentInstallment: expenseData.creditData.currentInstallment || 1,
        monthlyAmount: expenseData.creditData.monthlyAmount || parseFloat(expenseData.amount),
        isInstallment: expenseData.creditData.isInstallment || false
      };
    }

    // First add the expense
    const expenseRef = await addDoc(collection(db, "users", uid, EXPENSES), expense);

    // If it's a credit installment, create installment records
    if (expense.creditData && expense.creditData.isInstallment) {
      const batch = writeBatch(db);
      
      for (let i = 1; i <= expense.creditData.totalInstallments; i++) {
        // Schedule due dates to start one month after the purchase date (i months from purchase)
        const installmentDate = new Date(expenseData.date);
        installmentDate.setMonth(installmentDate.getMonth() + i);
        const installmentRef = doc(collection(db, "users", uid, INSTALLMENTS));
        batch.set(installmentRef, {
          expenseId: expenseRef.id,
          amount: expense.creditData.monthlyAmount,
          installmentNumber: i,
          totalInstallments: expense.creditData.totalInstallments,
          dueDate: installmentDate.toISOString().split("T")[0],
          cardId: expense.creditData.cardId,
          isPaid: false, // No installments are paid by default
          timestamp: serverTimestamp()
        });
      }
      
      await batch.commit();
    }

    return expenseRef.id;
  } catch (err) {
    console.error("Error adding expense:", err);
    throw err;
  }
};

export const getExpenses = async (uid, date = null, type = null) => {
  try {
    let q = collection(db, "users", uid, EXPENSES);
    
    if (date) {
      q = query(q, where("date", "==", date));
    }
    
    if (type) {
      q = query(q, where("type", "==", type));
    }
    
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Sort by timestamp (newest first)
    return data.sort((a, b) => {
      if (a.timestamp && b.timestamp) {
        return b.timestamp.toMillis() - a.timestamp.toMillis();
      }
      return 0;
    });
  } catch (err) {
    console.error("Error fetching expenses:", err);
    return [];
  }
};

export const getExpensesDateRange = async (uid, startDate, endDate, type = null) => {
  try {
    let q = query(
      collection(db, "users", uid, EXPENSES),
      where("date", ">=", startDate),
      where("date", "<=", endDate)
    );
    
    if (type) {
      q = query(q, where("type", "==", type));
    }
    
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Sort by date and timestamp
    return data.sort((a, b) => {
      if (a.date !== b.date) {
        return b.date.localeCompare(a.date);
      }
      if (a.timestamp && b.timestamp) {
        return b.timestamp.toMillis() - a.timestamp.toMillis();
      }
      return 0;
    });
  } catch (err) {
    console.error("Error fetching expenses in date range:", err);
    return [];
  }
};

export const getMonthlyExpenses = async (uid, year = null, month = null) => {
  try {
    const now = new Date();
    const targetYear = year || now.getFullYear();
    // Treat `month` as 0-based (consistent with Date API and getMonthlyTotal)
    const targetMonthIndex = month !== null ? month : now.getMonth();

    // Create date range for the month
    const firstDay = new Date(targetYear, targetMonthIndex, 1);
    const lastDay = new Date(targetYear, targetMonthIndex + 1, 0).getDate();
    const startDate = firstDay.toISOString().split('T')[0];
    const endDate = `${targetYear}-${String(targetMonthIndex + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    const q = query(
      collection(db, "users", uid, EXPENSES),
      where("date", ">=", startDate),
      where("date", "<=", endDate)
    );
    
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Sort by date and timestamp
    return data.sort((a, b) => {
      if (a.date !== b.date) {
        return b.date.localeCompare(a.date);
      }
      if (a.timestamp && b.timestamp) {
        return b.timestamp.toMillis() - a.timestamp.toMillis();
      }
      return 0;
    });
  } catch (err) {
    console.error("Error fetching monthly expenses:", err);
    return [];
  }
};

export const deleteExpense = async (uid, expenseId) => {
  try {
    // Check if this expense is a payment for an installment plan
    const expenseRef = doc(db, "users", uid, EXPENSES, expenseId);
    const expenseSnap = await getDoc(expenseRef);
    let expenseData = null;
    if (expenseSnap && expenseSnap.exists && expenseSnap.data) {
      expenseData = expenseSnap.data();
    }

    // If this expense is a payment tied to a plan, try to revert the installment marked by paidByExpenseId first
    if (expenseData && expenseData.paymentForExpenseId) {
      const planId = expenseData.paymentForExpenseId;

      // 1) Try to find installments explicitly marked with this payment id
      const paidByQuery = query(collection(db, "users", uid, INSTALLMENTS), where('paidByExpenseId', '==', expenseId));
      const paidBySnap = await getDocs(paidByQuery);
      if (!paidBySnap.empty) {
        // Revert any matching installments
        for (const d of paidBySnap.docs) {
          try {
            await updateDoc(d.ref, { isPaid: false, paidAt: null, paidByExpenseId: null });
          } catch (err) {
            console.error('Failed to revert installment paid state by paidByExpenseId:', err);
          }
        }
      } else {
        // 2) Fallback: query all installments for the plan and revert by appliedInstallmentNumber or most recent paid
        const instQ = query(collection(db, "users", uid, INSTALLMENTS), where("expenseId", "==", planId));
        const instSnap = await getDocs(instQ);
        const insts = instSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));

        // If the payment stored an appliedInstallmentNumber, revert that exact installment
        if (expenseData.appliedInstallmentNumber) {
          const target = insts.find(i => i.installmentNumber === expenseData.appliedInstallmentNumber);
          if (target && target.isPaid) {
            try {
              await updateDoc(target.ref, { isPaid: false, paidAt: null, paidByExpenseId: null });
            } catch (err) {
              console.error('Failed to revert installment paid state for appliedInstallmentNumber:', err);
            }
          }
        } else {
          // Fallback: revert the most recently paid installment
          insts.sort((a, b) => (b.installmentNumber || 0) - (a.installmentNumber || 0));
          const paidInst = insts.find(i => i.isPaid);
          if (paidInst) {
            try {
              await updateDoc(paidInst.ref, { isPaid: false, paidAt: null, paidByExpenseId: null });
            } catch (err) {
              console.error('Failed to revert installment paid state:', err);
            }
          }
        }
      }
    }

    const batch = writeBatch(db);

    // Delete the expense
    batch.delete(doc(db, "users", uid, EXPENSES, expenseId));

    // Delete related installments that belong to this expense (only for original plan deletions)
    const installmentsQuery = query(
      collection(db, "users", uid, INSTALLMENTS),
      where("expenseId", "==", expenseId)
    );
    const installmentsSnapshot = await getDocs(installmentsQuery);

    installmentsSnapshot.docs.forEach(installmentDoc => {
      batch.delete(installmentDoc.ref);
    });

    await batch.commit();
  } catch (err) {
    console.error("Error deleting expense:", err);
    throw err;
  }
};

// Credit Card Functions
export const addCreditCard = async (uid, cardData) => {
  try {
    const docRef = await addDoc(
      collection(db, "users", uid, CREDIT_CARDS),
      {
        name: cardData.name,
        bank: cardData.bank,
        cardId: cardData.cardId,
        limit: parseFloat(cardData.limit || 0),
        timestamp: serverTimestamp()
      }
    );
    return docRef.id;
  } catch (err) {
    console.error("Error adding credit card:", err);
    throw err;
  }
};

export const getCreditCards = async (uid) => {
  try {
    const snapshot = await getDocs(collection(db, "users", uid, CREDIT_CARDS));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error("Error fetching credit cards:", err);
    return [];
  }
};

export const deleteCreditCard = async (uid, cardDocId) => {
  try {
    if (!cardDocId) throw new Error('Missing card id');

    // Fetch the card doc to read its external cardId (if any)
    const cardRef = doc(db, "users", uid, CREDIT_CARDS, cardDocId);
    const cardSnap = await getDocs(query(collection(db, "users", uid, CREDIT_CARDS), where("__name__", "==", cardDocId)));
    let externalCardId = null;
    if (!cardSnap.empty) {
      const cd = cardSnap.docs[0].data();
      externalCardId = cd.cardId;
    }

    const batch = writeBatch(db);

    // Delete the card doc
    batch.delete(cardRef);

    // Delete installments that reference this card id (either by doc id or external cardId)
    const installmentsCol = collection(db, 'users', uid, INSTALLMENTS);
    const q1 = query(installmentsCol, where('cardId', '==', cardDocId));
    const q2 = externalCardId ? query(installmentsCol, where('cardId', '==', externalCardId)) : null;
    const instSnap1 = await getDocs(q1);
    instSnap1.docs.forEach(d => batch.delete(d.ref));
    if (q2) {
      const instSnap2 = await getDocs(q2);
      instSnap2.docs.forEach(d => batch.delete(d.ref));
    }

    // Clear creditData from expenses that reference this card
    const expensesCol = collection(db, 'users', uid, EXPENSES);
    const eq1 = query(expensesCol, where('creditData.cardId', '==', cardDocId));
    const eq2 = externalCardId ? query(expensesCol, where('creditData.cardId', '==', externalCardId)) : null;
    const expSnap1 = await getDocs(eq1);
    expSnap1.docs.forEach(d => batch.update(d.ref, { creditData: null }));
    if (eq2) {
      const expSnap2 = await getDocs(eq2);
      expSnap2.docs.forEach(d => batch.update(d.ref, { creditData: null }));
    }

    await batch.commit();
    return true;
  } catch (err) {
    console.error("Error deleting credit card:", err);
    throw err;
  }
};

// Pay the next unpaid installment for a given expense (installment plan)
export const payInstallment = async (uid, expenseId, paymentData = {}) => {
  try {
    if (!expenseId) throw new Error('Missing expenseId');

    // Create an expense record to represent the payment
    const expense = {
      amount: parseFloat(paymentData.amount),
      category: paymentData.category || 'installment',
      type: paymentData.type || 'other',
      paymentType: 'credit',
      date: paymentData.date || new Date().toISOString().split('T')[0],
      note: paymentData.note || '',
      paymentForExpenseId: expenseId,
      appliedInstallmentNumber: paymentData.installmentNumber || null,
      timestamp: serverTimestamp()
    };

    const expenseRef = await addDoc(collection(db, 'users', uid, EXPENSES), expense);

    // Find next unpaid installment for this expense
    // Query by expenseId only and sort client-side to avoid requiring a composite index
    const installmentsQuery = query(
      collection(db, 'users', uid, INSTALLMENTS),
      where('expenseId', '==', expenseId)
    );

    const snapshot = await getDocs(installmentsQuery);
    const installments = snapshot.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
    // Prefer to sort by installmentNumber so "next unpaid" follows sequence order
    installments.sort((a, b) => {
      const na = a.installmentNumber || 0;
      const nb = b.installmentNumber || 0;
      if (na !== nb) return na - nb;
      const da = a.dueDate || '';
      const db = b.dueDate || '';
      return da.localeCompare(db);
    });

    let next = null;
    if (paymentData && paymentData.installmentNumber) {
      next = installments.find(i => i.installmentNumber === paymentData.installmentNumber);
    } else {
      next = installments.find(i => !i.isPaid);
    }

    if (next) {
      await updateDoc(next.ref, {
        isPaid: true,
        paidAt: serverTimestamp(),
        paidByExpenseId: expenseRef.id
      });
    }

    return expenseRef.id;
  } catch (err) {
    console.error('Error paying installment:', err);
    throw err;
  }
};

// Installments Functions
export const getInstallments = async (uid, dueDate = null) => {
  try {
    let q = collection(db, "users", uid, INSTALLMENTS);
    
    if (dueDate) {
      q = query(q, where("dueDate", "==", dueDate));
    }
    
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Safely sort by dueDate; handle missing or malformed dueDate values
    return data.sort((a, b) => {
      const da = a && a.dueDate ? String(a.dueDate) : '';
      const db = b && b.dueDate ? String(b.dueDate) : '';

      // Push items with missing dueDate to the end
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;

      return da.localeCompare(db);
    });
  } catch (err) {
    console.error("Error fetching installments:", err);
    return [];
  }
};

export const getInstallmentsForExpense = async (uid, expenseId) => {
  try {
    if (!expenseId) return [];
    const q = query(
      collection(db, "users", uid, INSTALLMENTS),
      where('expenseId', '==', expenseId)
    );
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }));
    // Sort by installmentNumber then dueDate
    data.sort((a, b) => {
      const na = a.installmentNumber || 0;
      const nb = b.installmentNumber || 0;
      if (na !== nb) return na - nb;
      const da = a.dueDate || '';
      const db = b.dueDate || '';
      return da.localeCompare(db);
    });
    return data;
  } catch (err) {
    console.error('Error fetching installments for expense:', err);
    return [];
  }
};

export const markInstallmentPaid = async (uid, installmentId, isPaid = true) => {
  try {
    await updateDoc(
      doc(db, "users", uid, INSTALLMENTS, installmentId),
      {
        isPaid: isPaid,
        paidAt: isPaid ? serverTimestamp() : null
      }
    );
  } catch (err) {
    console.error("Error updating installment:", err);
    throw err;
  }
};

// Daily Targets Functions
export const setDailyTarget = async (uid, targetData) => {
  try {
    const docRef = await addDoc(
      collection(db, "users", uid, DAILY_TARGETS),
      {
        amount: parseFloat(targetData.amount),
        date: targetData.date || new Date().toISOString().split("T")[0],
        timestamp: serverTimestamp()
      }
    );
    return docRef.id;
  } catch (err) {
    console.error("Error setting daily target:", err);
    throw err;
  }
};

export const getDailyTarget = async (uid, date = null) => {
  try {
    const targetDate = date || new Date().toISOString().split("T")[0];
    const q = query(
      collection(db, "users", uid, DAILY_TARGETS),
      where("date", "==", targetDate)
    );
    const snapshot = await getDocs(q);
    const targets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return targets.length > 0 ? targets[0] : null;
  } catch (err) {
    console.error("Error fetching daily target:", err);
    return null;
  }
};

// Helper Functions
export const getTodayTotal = async (uid, date = null) => {
  const targetDate = date || new Date().toISOString().split("T")[0];
  const expenses = await getExpenses(uid, targetDate);
  
  // Filter out original installment plan purchases - only count installment payments
  const filteredExpenses = expenses.filter(exp => !(exp.creditData && exp.creditData.isInstallment));
  
  const dailyTotal = filteredExpenses
    .filter(exp => exp.type === "daily")
    .reduce((sum, exp) => sum + (exp.amount || 0), 0);
    
  const otherTotal = filteredExpenses
    .filter(exp => exp.type === "other")
    .reduce((sum, exp) => sum + (exp.amount || 0), 0);
    
  return { dailyTotal, otherTotal, total: dailyTotal + otherTotal };
};

export const getWeeklyTotal = async (uid) => {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startDate = weekAgo.toISOString().split("T")[0];
  const endDate = today.toISOString().split("T")[0];

  const expenses = await getExpensesDateRange(uid, startDate, endDate);
  return expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
};

export const getMonthlyTotal = async (uid, year = null, month = null) => {
  const today = new Date();
  const targetYear = year || today.getFullYear();
  const targetMonth = month !== null ? month : today.getMonth();
  
  const firstDay = new Date(targetYear, targetMonth, 1);
  const lastDay = new Date(targetYear, targetMonth + 1, 0);
  
  const startDate = firstDay.toISOString().split("T")[0];
  const endDate = lastDay.toISOString().split("T")[0];

  const expenses = await getExpensesDateRange(uid, startDate, endDate);
  
  // Filter out original installment plan purchases - only count installment payments
  const filteredExpenses = expenses.filter(exp => !(exp.creditData && exp.creditData.isInstallment));
  
  const total = filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  
  // Group by category
  const byCategory = {};
  filteredExpenses.forEach(exp => {
    byCategory[exp.category] = (byCategory[exp.category] || 0) + exp.amount;
  });
  
  // Group by type
  const byType = { daily: 0, other: 0 };
  filteredExpenses.forEach(exp => {
    byType[exp.type] = (byType[exp.type] || 0) + exp.amount;
  });
  
  return { total, byCategory, byType, expenses: filteredExpenses };
};

export const getInstallmentsSummary = async (uid) => {
  const installments = await getInstallments(uid);
  const today = new Date().toISOString().split("T")[0];
  
  const pending = installments.filter(inst => !inst.isPaid && inst.dueDate >= today);
  const overdue = installments.filter(inst => !inst.isPaid && inst.dueDate < today);
  const paid = installments.filter(inst => inst.isPaid);
  
  const totalPending = pending.reduce((sum, inst) => sum + (inst.amount || 0), 0);
  const totalOverdue = overdue.reduce((sum, inst) => sum + (inst.amount || 0), 0);
  
  return { pending, overdue, paid, totalPending, totalOverdue };
};

export const deleteInstallmentsByExpense = async (uid, expenseId) => {
  try {
    const q = query(collection(db, "users", uid, INSTALLMENTS), where("expenseId", "==", expenseId));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach(d => batch.delete(doc(db, "users", uid, INSTALLMENTS, d.id)));
    await batch.commit();
  } catch (err) {
    console.error("Error deleting installments:", err);
    throw err;
  }
};

export const updateExpense = async (uid, expenseId, expenseData) => {
  try {
    const expenseRef = doc(db, "users", uid, EXPENSES, expenseId);

    const updated = {
      amount: parseFloat(expenseData.amount),
      category: expenseData.category || "other",
      type: expenseData.type || "daily",
      paymentType: expenseData.paymentType || "cash",
      date: expenseData.date || new Date().toISOString().split("T")[0],
      note: expenseData.note || "",
      timestamp: serverTimestamp()
    };

    // Update creditData if applicable
    if (expenseData.paymentType === "credit" && expenseData.isInstallment) {
      const monthlyAmount = parseFloat(expenseData.amount) / expenseData.installmentMonths;
      updated.creditData = {
        cardId: expenseData.cardId || "default_credit",
        totalInstallments: expenseData.installmentMonths,
        currentInstallment: expenseData.currentInstallment || 1,
        monthlyAmount: monthlyAmount,
        isInstallment: true
      };
    } else if (expenseData.paymentType === "credit" && expenseData.creditData) {
      updated.creditData = {
        cardId: expenseData.creditData.cardId,
        totalInstallments: expenseData.creditData.totalInstallments || 1,
        currentInstallment: expenseData.creditData.currentInstallment || 1,
        monthlyAmount: expenseData.creditData.monthlyAmount || parseFloat(expenseData.amount),
        isInstallment: expenseData.creditData.isInstallment || false
      };
    } else {
      updated.creditData = null;
    }

    await updateDoc(expenseRef, updated);

    // Recreate installments: delete old ones first
    await deleteInstallmentsByExpense(uid, expenseId);

    if (updated.creditData && updated.creditData.isInstallment) {
      const batch = writeBatch(db);
      for (let i = 1; i <= updated.creditData.totalInstallments; i++) {
        // Schedule due dates to start one month after the purchase date
        const installmentDate = new Date(updated.date || expenseData.date);
        installmentDate.setMonth(installmentDate.getMonth() + i);
        const installmentRef = doc(collection(db, "users", uid, INSTALLMENTS));
        batch.set(installmentRef, {
          expenseId: expenseId,
          amount: updated.creditData.monthlyAmount,
          installmentNumber: i,
          totalInstallments: updated.creditData.totalInstallments,
          dueDate: installmentDate.toISOString().split("T")[0],
          cardId: updated.creditData.cardId,
          isPaid: false, // No installments are paid by default
          timestamp: serverTimestamp()
        });
      }
      await batch.commit();
    }

    return expenseId;
  } catch (err) {
    console.error("Error updating expense:", err);
    throw err;
  }
};

export const getCurrentDate = () => {
  return new Date().toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric"
  });
};

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2
  }).format(amount).replace('LKR', 'Rs.');
};
