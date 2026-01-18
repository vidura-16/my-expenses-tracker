import { db } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
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
    const batch = writeBatch(db);
    
    const expense = {
      amount: parseFloat(expenseData.amount),
      category: expenseData.category || "other", // food | travel | utility | other
      type: expenseData.type || "daily", // daily | other
      paymentType: expenseData.paymentType || "cash", // cash | debit | credit
      date: expenseData.date || new Date().toISOString().split("T")[0], // YYYY-MM-DD string
      timestamp: serverTimestamp(),
      note: expenseData.note || ""
    };

    // Add credit card data if payment is credit
    if (expenseData.paymentType === "credit" && expenseData.creditData) {
      expense.creditData = {
        cardId: expenseData.creditData.cardId,
        totalInstallments: expenseData.creditData.totalInstallments || 1,
        currentInstallment: expenseData.creditData.currentInstallment || 1,
        monthlyAmount: expenseData.creditData.monthlyAmount || parseFloat(expenseData.amount),
        isInstallment: expenseData.creditData.isInstallment || false
      };
    }

    const expenseRef = doc(collection(db, "users", uid, EXPENSES));
    batch.set(expenseRef, expense);

    // If it's a credit installment, create installment records
    if (expense.creditData && expense.creditData.isInstallment) {
      for (let i = 1; i <= expense.creditData.totalInstallments; i++) {
        const installmentDate = new Date(expenseData.date);
        installmentDate.setMonth(installmentDate.getMonth() + (i - 1));
        
        const installmentRef = doc(collection(db, "users", uid, INSTALLMENTS));
        batch.set(installmentRef, {
          expenseId: expenseRef.id,
          amount: expense.creditData.monthlyAmount,
          installmentNumber: i,
          totalInstallments: expense.creditData.totalInstallments,
          dueDate: installmentDate.toISOString().split("T")[0],
          cardId: expense.creditData.cardId,
          isPaid: i === 1, // First installment is considered paid when purchase is made
          timestamp: serverTimestamp()
        });
      }
    }

    await batch.commit();
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

export const deleteExpense = async (uid, expenseId) => {
  try {
    const batch = writeBatch(db);
    
    // Delete the expense
    batch.delete(doc(db, "users", uid, EXPENSES, expenseId));
    
    // Delete related installments
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

export const updateExpense = async (uid, expenseId, data) => {
  try {
    await updateDoc(
      doc(db, "users", uid, EXPENSES, expenseId),
      {
        amount: parseFloat(data.amount),
        category: data.category || "other",
        note: data.note || "",
        timestamp: serverTimestamp()
      }
    );
  } catch (err) {
    console.error("Error updating expense:", err);
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

// Installments Functions
export const getInstallments = async (uid, dueDate = null) => {
  try {
    let q = collection(db, "users", uid, INSTALLMENTS);
    
    if (dueDate) {
      q = query(q, where("dueDate", "==", dueDate));
    }
    
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    return data.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  } catch (err) {
    console.error("Error fetching installments:", err);
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
  
  const dailyTotal = expenses
    .filter(exp => exp.type === "daily")
    .reduce((sum, exp) => sum + (exp.amount || 0), 0);
    
  const otherTotal = expenses
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
  const total = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  
  // Group by category
  const byCategory = {};
  expenses.forEach(exp => {
    byCategory[exp.category] = (byCategory[exp.category] || 0) + exp.amount;
  });
  
  // Group by type
  const byType = { daily: 0, other: 0 };
  expenses.forEach(exp => {
    byType[exp.type] = (byType[exp.type] || 0) + exp.amount;
  });
  
  return { total, byCategory, byType, expenses };
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
