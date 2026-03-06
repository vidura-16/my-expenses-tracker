import {
  db,
} from "../firebase";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  increment,
} from "firebase/firestore";

/**
 * Get or create budget planner document for a specific month
 */
export const getBudgetPlannerDoc = async (uid, monthYear) => {
  try {
    const docRef = doc(db, "users", uid, "budgetPlanner", monthYear);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: monthYear, ...docSnap.data() };
    }
    
    // If document doesn't exist, create it
    await setDoc(docRef, {
      income: 0,
      createdAt: serverTimestamp(),
    });
    
    return {
      id: monthYear,
      income: 0,
      createdAt: new Date(),
    };
  } catch (error) {
    console.error("Error getting budget planner doc:", error);
    throw error;
  }
};

/**
 * Set monthly income
 */
export const setMonthlyIncome = async (uid, monthYear, income) => {
  try {
    const docRef = doc(db, "users", uid, "budgetPlanner", monthYear);
    await updateDoc(docRef, {
      income: parseFloat(income),
    });
    return true;
  } catch (error) {
    console.error("Error setting monthly income:", error);
    throw error;
  }
};

/**
 * Get all portions for a month
 */
export const getPortions = async (uid, monthYear) => {
  try {
    const portionsRef = collection(
      db,
      "users",
      uid,
      "budgetPlanner",
      monthYear,
      "portions"
    );
    const snapshot = await getDocs(portionsRef);
    
    const portions = [];
    snapshot.forEach((doc) => {
      portions.push({
        id: doc.id,
        ...doc.data(),
      });
    });
    
    return portions;
  } catch (error) {
    console.error("Error getting portions:", error);
    throw error;
  }
};

/**
 * Add a new portion
 */
export const addPortion = async (uid, monthYear, portionData) => {
  try {
    const portionsRef = collection(
      db,
      "users",
      uid,
      "budgetPlanner",
      monthYear,
      "portions"
    );
    
    const docRef = doc(portionsRef);
    await setDoc(docRef, {
      name: portionData.name,
      allocated: parseFloat(portionData.allocated),
      spent: 0,
      createdAt: serverTimestamp(),
    });
    
    return {
      id: docRef.id,
      name: portionData.name,
      allocated: parseFloat(portionData.allocated),
      spent: 0,
      createdAt: new Date(),
    };
  } catch (error) {
    console.error("Error adding portion:", error);
    throw error;
  }
};

/**
 * Update a portion
 */
export const updatePortion = async (uid, monthYear, portionId, updates) => {
  try {
    const portionRef = doc(
      db,
      "users",
      uid,
      "budgetPlanner",
      monthYear,
      "portions",
      portionId
    );
    
    const updateData = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.allocated !== undefined) updateData.allocated = parseFloat(updates.allocated);
    
    await updateDoc(portionRef, updateData);
    return true;
  } catch (error) {
    console.error("Error updating portion:", error);
    throw error;
  }
};

/**
 * Delete a portion
 */
export const deletePortion = async (uid, monthYear, portionId) => {
  try {
    const portionRef = doc(
      db,
      "users",
      uid,
      "budgetPlanner",
      monthYear,
      "portions",
      portionId
    );
    await deleteDoc(portionRef);
    return true;
  } catch (error) {
    console.error("Error deleting portion:", error);
    throw error;
  }
};

/**
 * Update a portion's spent amount (increment or decrement)
 */
export const updatePortionSpent = async (uid, monthYear, portionId, amount) => {
  try {
    const portionRef = doc(
      db,
      "users",
      uid,
      "budgetPlanner",
      monthYear,
      "portions",
      portionId
    );
    
    // Check if portion exists first
    const portionSnap = await getDoc(portionRef);
    if (!portionSnap.exists()) {
      console.warn("Portion not found:", portionId);
      return false;
    }
    
    await updateDoc(portionRef, {
      spent: increment(parseFloat(amount)),
    });
    return true;
  } catch (error) {
    console.error("Error updating portion spent:", error);
    throw error;
  }
};

/**
 * Get all budget expenses for a month
 */
export const getBudgetExpenses = async (uid, monthYear) => {
  try {
    const expensesRef = collection(
      db,
      "users",
      uid,
      "budgetPlanner",
      monthYear,
      "expenses"
    );
    const snapshot = await getDocs(expensesRef);
    
    const expenses = [];
    snapshot.forEach((doc) => {
      expenses.push({
        id: doc.id,
        ...doc.data(),
      });
    });
    
    return expenses;
  } catch (error) {
    console.error("Error getting budget expenses:", error);
    throw error;
  }
};

/**
 * Add a budget expense
 */
export const addBudgetExpense = async (uid, monthYear, expenseData) => {
  try {
    const expensesRef = collection(
      db,
      "users",
      uid,
      "budgetPlanner",
      monthYear,
      "expenses"
    );
    
    const docRef = doc(expensesRef);
    await setDoc(docRef, {
      description: expenseData.description,
      amount: parseFloat(expenseData.amount),
      portionId: expenseData.portionId,
      date: expenseData.date,
      isPaid: false, // New field - tracks if expense has been paid
      createdAt: serverTimestamp(),
    });
    
    return {
      id: docRef.id,
      ...expenseData,
      isPaid: false,
      createdAt: new Date(),
    };
  } catch (error) {
    console.error("Error adding budget expense:", error);
    throw error;
  }
};

/**
 * Delete a budget expense
 */
export const deleteBudgetExpense = async (uid, monthYear, expenseId, amount, portionId, isPaid) => {
  try {
    const expenseRef = doc(
      db,
      "users",
      uid,
      "budgetPlanner",
      monthYear,
      "expenses",
      expenseId
    );
    
    await deleteDoc(expenseRef);
    
    // Only reduce the portion's spent amount if it was paid and portion exists
    if (portionId && isPaid) {
      const portionRef = doc(
        db,
        "users",
        uid,
        "budgetPlanner",
        monthYear,
        "portions",
        portionId
      );
      // Check if portion still exists before updating
      const portionSnap = await getDoc(portionRef);
      if (portionSnap.exists()) {
        await updateDoc(portionRef, {
          spent: increment(-parseFloat(amount)),
        });
      }
    }
    
    return true;
  } catch (error) {
    console.error("Error deleting budget expense:", error);
    throw error;
  }
};

/**
 * Mark a budget expense as paid
 */
export const markExpenseAsPaid = async (uid, monthYear, expenseId, amount, portionId) => {
  try {
    const expenseRef = doc(
      db,
      "users",
      uid,
      "budgetPlanner",
      monthYear,
      "expenses",
      expenseId
    );
    
    await updateDoc(expenseRef, {
      isPaid: true,
    });
    
    // Note: We don't update portion.spent here because budget expenses 
    // have their own isPaid field which is used for calculating spent.
    // portion.spent is only used for Home screen expenses.
    
    return true;
  } catch (error) {
    console.error("Error marking expense as paid:", error);
    throw error;
  }
};

/**
 * Get summary for a month's budget
 */
export const getBudgetSummary = async (uid, monthYear) => {
  try {
    const [budgetDoc, portions, expenses] = await Promise.all([
      getBudgetPlannerDoc(uid, monthYear),
      getPortions(uid, monthYear),
      getBudgetExpenses(uid, monthYear),
    ]);
    
    const totalSpent = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const totalAllocated = portions.reduce((sum, p) => sum + (p.allocated || 0), 0);
    const remaining = (budgetDoc.income || 0) - totalSpent;
    
    return {
      income: budgetDoc.income || 0,
      totalAllocated,
      totalSpent,
      remaining,
      portions,
      expenses,
    };
  } catch (error) {
    console.error("Error getting budget summary:", error);
    throw error;
  }
};

/**
 * Format currency
 */
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2
  }).format(amount).replace('LKR', 'Rs.');
};
