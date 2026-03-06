import React, { useState, useEffect, useCallback } from "react";
import { jsPDF } from "jspdf";
import {
  setMonthlyIncome,
  addPortion,
  updatePortion,
  deletePortion,
  addBudgetExpense,
  deleteBudgetExpense,
  markExpenseAsPaid,
  getBudgetSummary,
  formatCurrency,
} from "../utils/budgetUtils";
import { getMonthlyExpenses } from "../utils/expenseUtils";
import "./BudgetPlanner.css";

const BudgetPlanner = ({ uid }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthYear, setMonthYear] = useState("");
  const [income, setIncome] = useState("");
  const [portions, setPortions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [homeExpenses, setHomeExpenses] = useState([]);
  const [expandedPortions, setExpandedPortions] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Portion form
  const [showPortionForm, setShowPortionForm] = useState(false);
  const [portionForm, setPortionForm] = useState({ name: "", allocated: "" });
  const [editingPortionId, setEditingPortionId] = useState(null);

  // Expense form
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    description: "",
    amount: "",
    portionId: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [editingExpenseId, setEditingExpenseId] = useState(null);

  const getMonthYearString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  };

  const loadData = useCallback(async () => {
    if (!uid) return;
    try {
      setLoading(true);
      setError("");
      const myStr = getMonthYearString(currentMonth);
      setMonthYear(myStr);
      const summary = await getBudgetSummary(uid, myStr);
      setIncome(summary.income || "");
      setPortions(summary.portions);
      setExpenses(summary.expenses);
      
      // Fetch home expenses for this month to show in portion breakdown
      const year = currentMonth.getFullYear();
      const monthIndex = currentMonth.getMonth();
      const homeExp = await getMonthlyExpenses(uid, year, monthIndex);
      setHomeExpenses(homeExp || []);
    } catch (err) {
      console.error("Error loading budget data:", err);
      setError("Failed to load budget data");
    } finally {
      setLoading(false);
    }
  }, [uid, currentMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Income
  const handleSaveIncome = async () => {
    if (!income || isNaN(income)) {
      setError("Please enter a valid income amount");
      return;
    }
    try {
      setLoading(true);
      await setMonthlyIncome(uid, monthYear, income);
      setError("");
      await loadData();
    } catch (err) {
      setError("Failed to save income");
    } finally {
      setLoading(false);
    }
  };

  // Portions
  const handleAddPortion = async (e) => {
    e.preventDefault();
    if (!portionForm.name || !portionForm.allocated) {
      setError("Please fill in all portion fields");
      return;
    }
    try {
      setLoading(true);
      if (editingPortionId) {
        await updatePortion(uid, monthYear, editingPortionId, portionForm);
        setEditingPortionId(null);
      } else {
        await addPortion(uid, monthYear, portionForm);
      }
      setPortionForm({ name: "", allocated: "" });
      setShowPortionForm(false);
      setError("");
      await loadData();
    } catch (err) {
      setError("Failed to save portion");
    } finally {
      setLoading(false);
    }
  };

  const handleEditPortion = (portion) => {
    setPortionForm({ name: portion.name, allocated: portion.allocated });
    setEditingPortionId(portion.id);
    setShowPortionForm(true);
  };

  const handleDeletePortion = async (portionId) => {
    if (!window.confirm("Delete this portion?")) return;
    try {
      setLoading(true);
      await deletePortion(uid, monthYear, portionId);
      setError("");
      await loadData();
    } catch (err) {
      setError("Failed to delete portion");
    } finally {
      setLoading(false);
    }
  };

  // Expenses
  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.description || !expenseForm.amount || !expenseForm.portionId) {
      setError("Please fill in all expense fields");
      return;
    }
    try {
      setLoading(true);
      if (editingExpenseId) {
        // Delete old and re-add with new data (preserving isPaid: false on edit)
        const oldExpense = expenses.find((ex) => ex.id === editingExpenseId);
        await deleteBudgetExpense(uid, monthYear, editingExpenseId, oldExpense.amount, oldExpense.portionId, oldExpense.isPaid);
        await addBudgetExpense(uid, monthYear, expenseForm);
        setEditingExpenseId(null);
      } else {
        await addBudgetExpense(uid, monthYear, expenseForm);
      }
      setExpenseForm({
        description: "",
        amount: "",
        portionId: "",
        date: new Date().toISOString().split("T")[0],
      });
      setShowExpenseForm(false);
      setError("");
      await loadData();
    } catch (err) {
      setError("Failed to save expense");
    } finally {
      setLoading(false);
    }
  };

  const handleEditExpense = (expense) => {
    setExpenseForm({
      description: expense.description,
      amount: String(expense.amount),
      portionId: expense.portionId,
      date: expense.date,
    });
    setEditingExpenseId(expense.id);
    setShowExpenseForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm("Delete this expense?")) return;
    try {
      setLoading(true);
      const expense = expenses.find((e) => e.id === expenseId);
      await deleteBudgetExpense(uid, monthYear, expenseId, expense.amount, expense.portionId, expense.isPaid);
      setError("");
      await loadData();
    } catch (err) {
      setError("Failed to delete expense");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkExpenseAsPaid = async (expenseId) => {
    try {
      setLoading(true);
      const expense = expenses.find((e) => e.id === expenseId);
      await markExpenseAsPaid(uid, monthYear, expenseId, expense.amount, expense.portionId);
      setError("");
      await loadData();
    } catch (err) {
      setError("Failed to mark expense as paid");
    } finally {
      setLoading(false);
    }
  };

  const resetExpenseForm = () => {
    setShowExpenseForm(false);
    setEditingExpenseId(null);
    setExpenseForm({
      description: "",
      amount: "",
      portionId: "",
      date: new Date().toISOString().split("T")[0],
    });
  };

  // Computed totals
  const totalAllocated = portions.reduce((sum, p) => sum + (p.allocated || 0), 0);
  const budgetExpensesSpent = expenses.filter((e) => e.isPaid).reduce((sum, e) => sum + (e.amount || 0), 0);
  const homeExpensesSpent = portions.reduce((sum, p) => sum + (p.spent || 0), 0);
  const totalSpent = budgetExpensesSpent + homeExpensesSpent;
  const totalRemaining = (parseFloat(income) || 0) - totalSpent;
  const unallocated = (parseFloat(income) || 0) - totalAllocated;

  const getPortionById = (portionId) => portions.find((p) => p.id === portionId);
  const getPortionExpenses = (portionId) => expenses.filter((e) => e.portionId === portionId);
  
  // Get home expenses linked to a portion
  const getHomeExpensesForPortion = (portionId) => homeExpenses.filter((e) => e.budgetPortionId === portionId);
  
  // Toggle expanded state for a portion
  const togglePortionExpand = (portionId) => {
    setExpandedPortions(prev => ({
      ...prev,
      [portionId]: !prev[portionId]
    }));
  };

  // Generate PDF Report
  const generatePDFReport = () => {
    const doc = new jsPDF();
    const monthName = currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    
    // Title
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Budget Report", 105, 20, { align: "center" });
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text(monthName, 105, 30, { align: "center" });
    
    // Summary Section
    let y = 50;
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", 20, y);
    
    y += 10;
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    
    const incomeNum = parseFloat(income) || 0;
    const saved = incomeNum - totalSpent;
    
    doc.text(`Monthly Income:`, 20, y);
    doc.text(`Rs. ${incomeNum.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 120, y);
    
    y += 8;
    doc.text(`Total Allocated:`, 20, y);
    doc.text(`Rs. ${totalAllocated.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 120, y);
    
    y += 8;
    doc.text(`Total Spent:`, 20, y);
    doc.setTextColor(220, 53, 69);
    doc.text(`Rs. ${totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 120, y);
    doc.setTextColor(0, 0, 0);
    
    y += 8;
    doc.text(`Total Saved:`, 20, y);
    doc.setTextColor(saved >= 0 ? 40 : 220, saved >= 0 ? 167 : 53, saved >= 0 ? 69 : 69);
    doc.text(`Rs. ${saved.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 120, y);
    doc.setTextColor(0, 0, 0);
    
    // Portions Breakdown
    y += 20;
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Budget Portions Breakdown", 20, y);
    
    y += 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Portion", 20, y);
    doc.text("Allocated", 80, y);
    doc.text("Spent", 120, y);
    doc.text("Remaining", 160, y);
    
    doc.setFont("helvetica", "normal");
    y += 2;
    doc.line(20, y, 190, y);
    
    y += 6;
    portions.forEach((portion) => {
      const portionBudgetExpenses = getPortionExpenses(portion.id).filter((e) => e.isPaid);
      const budgetSpent = portionBudgetExpenses.reduce((sum, e) => sum + e.amount, 0);
      const portionHomeExpenses = getHomeExpensesForPortion(portion.id);
      const homeSpent = portionHomeExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const spent = budgetSpent + homeSpent;
      const remaining = portion.allocated - spent;
      
      doc.text(portion.name.substring(0, 20), 20, y);
      doc.text(`Rs. ${portion.allocated.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 80, y);
      doc.text(`Rs. ${spent.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 120, y);
      
      if (remaining < 0) {
        doc.setTextColor(220, 53, 69);
      } else {
        doc.setTextColor(40, 167, 69);
      }
      doc.text(`Rs. ${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 160, y);
      doc.setTextColor(0, 0, 0);
      
      y += 7;
      
      // Check if we need a new page
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });
    
    // Footer
    y += 10;
    doc.line(20, y, 190, y);
    y += 8;
    doc.setFontSize(10);
    doc.setTextColor(128, 128, 128);
    doc.text(`Generated on ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 105, y, { align: "center" });
    
    // Save the PDF
    doc.save(`Budget_Report_${monthYear}.pdf`);
  };

  if (loading && !monthYear) {
    return <div className="budget-planner">Loading...</div>;
  }

  return (
    <div className="budget-planner">
      {error && <div className="budget-error">{error}</div>}

      {/* Month Navigation */}
      <div className="budget-month-nav">
        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}>
          ← Previous
        </button>
        <div className="month-display">
          {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </div>
        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}>
          Next →
        </button>
        <button onClick={() => setCurrentMonth(new Date())}>Today</button>
      </div>

      {/* Top Row: Income + Split Portions side by side */}
      <div className="budget-top-row">
        {/* Income Section */}
        <div className="budget-section">
          <h2>Your Primary Salary</h2>
          <div className="income-input-group">
            <input
              type="number"
              placeholder="Enter your monthly salary"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
              disabled={loading}
            />
            <button onClick={handleSaveIncome} disabled={loading}>
              Save
            </button>
          </div>
          {income && (
            <p>Monthly Income: <strong>{formatCurrency(parseFloat(income))}</strong></p>
          )}
        </div>

        {/* Split Portions Section */}
        <div className="budget-section">
        <h2>Split Portions</h2>
        <button onClick={() => {
          setShowPortionForm(!showPortionForm);
          setEditingPortionId(null);
          setPortionForm({ name: "", allocated: "" });
        }}>
          + Add Portion
        </button>

        {showPortionForm && (
          <form onSubmit={handleAddPortion} className="simple-form">
            <input
              type="text"
              placeholder="e.g., Groceries, Bills"
              value={portionForm.name}
              onChange={(e) => setPortionForm({ ...portionForm, name: e.target.value })}
            />
            <input
              type="number"
              placeholder="Allocated amount"
              value={portionForm.allocated}
              onChange={(e) => setPortionForm({ ...portionForm, allocated: e.target.value })}
            />
            <div className="form-actions">
              <button type="submit" disabled={loading}>
                {editingPortionId ? "Update" : "Add"} Portion
              </button>
              <button type="button" onClick={() => { setShowPortionForm(false); setEditingPortionId(null); }}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {portions.length === 0 ? (
          <p>No portions created yet</p>
        ) : (
          <table className="simple-table">
            <thead>
              <tr>
                <th>Portion</th>
                <th>Allocated</th>
                <th>Spent</th>
                <th>Remaining</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {portions.map((portion) => {
                // Get spent from budget expenses AND the portion's spent field (from Home expenses)
                const portionBudgetExpenses = getPortionExpenses(portion.id).filter((e) => e.isPaid);
                const budgetExpensesSpent = portionBudgetExpenses.reduce((sum, e) => sum + e.amount, 0);
                const portionHomeExpenses = getHomeExpensesForPortion(portion.id);
                const homeExpensesSpentCalc = portionHomeExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
                const spent = budgetExpensesSpent + homeExpensesSpentCalc;
                const remaining = portion.allocated - spent;
                const isExpanded = expandedPortions[portion.id];
                const hasExpenses = portionBudgetExpenses.length > 0 || portionHomeExpenses.length > 0;
                return (
                  <React.Fragment key={portion.id}>
                    <tr>
                      <td data-label="Portion">{portion.name}</td>
                      <td data-label="Allocated">{formatCurrency(portion.allocated)}</td>
                      <td data-label="Spent" className="spent-cell">
                        {formatCurrency(spent)}
                        {hasExpenses && (
                          <span 
                            className={`dropdown-toggle ${isExpanded ? 'expanded' : ''}`}
                            onClick={() => togglePortionExpand(portion.id)}
                            title="View expense breakdown"
                          >
                            ▼
                          </span>
                        )}
                      </td>
                      <td data-label="Remaining" style={{ color: remaining < 0 ? "#e53935" : "#2e7d32" }}>{formatCurrency(remaining)}</td>
                      <td data-label="">
                        <button onClick={() => handleEditPortion(portion)}>Edit</button>
                        <button onClick={() => handleDeletePortion(portion.id)}>Delete</button>
                      </td>
                    </tr>
                    {isExpanded && hasExpenses && (
                      <tr className="expense-breakdown-row">
                        <td colSpan="5">
                          <div className="expense-breakdown">
                            <strong>Expense Breakdown:</strong>
                            <ul className="expense-breakdown-list">
                              {portionHomeExpenses.map((exp) => (
                                <li key={exp.id}>
                                  <span className="exp-date">{exp.date}</span>
                                  <span className="exp-category">{exp.category}</span>
                                  <span className="exp-note">{exp.note || '-'}</span>
                                  <span className="exp-amount">{formatCurrency(exp.amount)}</span>
                                </li>
                              ))}
                              {portionBudgetExpenses.map((exp) => (
                                <li key={exp.id}>
                                  <span className="exp-date">{exp.date}</span>
                                  <span className="exp-category">[Budget] {exp.description}</span>
                                  <span className="exp-note">Paid</span>
                                  <span className="exp-amount">{formatCurrency(exp.amount)}</span>
                                </li>
                              ))}
                            </ul>
                            <div className="expense-breakdown-total">
                              Total: {formatCurrency(spent)}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}

        {portions.length > 0 && (
          <div className="summary-box">
            <p>Total Allocated: <strong>{formatCurrency(totalAllocated)}</strong></p>
            <p>Unallocated: <strong style={{ color: unallocated < 0 ? "#e53935" : "#a855f7" }}>{formatCurrency(unallocated)}</strong></p>
          </div>
        )}
      </div>
      </div>

      {/* Plan Expenses Section - Full Width */}
      <div className="budget-full-row">
      <div className="budget-section">
        <h2>Plan Expenses</h2>
        <button onClick={() => {
          resetExpenseForm();
          setShowExpenseForm(true);
        }}>
          + Add 
        </button>

        {showExpenseForm && (
          <form onSubmit={handleAddExpense} className="simple-form">
            <label>Description</label>
            <input
              type="text"
              placeholder="e.g., Buy T-shirt"
              value={expenseForm.description}
              onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
            />
            <label>Amount</label>
            <input
              type="number"
              placeholder="Amount"
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
            />
            <label>Portion</label>
            <select
              value={expenseForm.portionId}
              onChange={(e) => setExpenseForm({ ...expenseForm, portionId: e.target.value })}
            >
              <option value="">Select portion</option>
              {portions.map((portion) => (
                <option key={portion.id} value={portion.id}>
                  {portion.name}
                </option>
              ))}
            </select>
            <label>Date</label>
            <input
              type="date"
              value={expenseForm.date}
              onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
            />
            <div className="form-actions">
              <button type="submit" disabled={loading}>
                {editingExpenseId ? "Update Expense" : "Add Expense"}
              </button>
              <button type="button" onClick={resetExpenseForm}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {expenses.length === 0 ? (
          <p>No expenses added yet</p>
        ) : (
          <div className="expenses-by-portion">
            {/* Show orphaned expenses (expenses without a valid portion) */}
            {(() => {
              const orphanedExpenses = expenses.filter(e => !portions.find(p => p.id === e.portionId));
              if (orphanedExpenses.length === 0) return null;
              return (
                <div className="portion-expenses-group orphaned">
                  <h3>⚠️ Unassigned Expenses</h3>
                  <p style={{ fontSize: '0.85rem', color: '#888' }}>These expenses have no associated portion. You may want to delete them.</p>
                  <table className="simple-table">
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orphanedExpenses.map((exp) => (
                        <tr key={exp.id} className={exp.isPaid ? "paid" : "unpaid"}>
                          <td data-label="Description">{exp.description}</td>
                          <td data-label="Amount">{formatCurrency(exp.amount)}</td>
                          <td data-label="Date">{exp.date}</td>
                          <td data-label="Status">{exp.isPaid ? "✓ Paid" : "⏳ Pending"}</td>
                          <td data-label="">
                            <button onClick={() => handleDeleteExpense(exp.id)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
            {portions.map((portion) => {
              const portionExpenses = getPortionExpenses(portion.id);
              if (portionExpenses.length === 0) return null;
              return (
                <div key={portion.id} className="portion-expenses-group">
                  <h3>{portion.name}</h3>
                  <table className="simple-table">
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portionExpenses.map((exp) => (
                        <tr key={exp.id} className={exp.isPaid ? "paid" : "unpaid"}>
                          <td data-label="Description">{exp.description}</td>
                          <td data-label="Amount">{formatCurrency(exp.amount)}</td>
                          <td data-label="Date">{exp.date}</td>
                          <td data-label="Status">{exp.isPaid ? "✓ Paid" : "⏳ Pending"}</td>
                          <td data-label="">
                            {!exp.isPaid && (
                              <>
                                <button onClick={() => handleEditExpense(exp)}>Edit</button>
                                <button onClick={() => handleMarkExpenseAsPaid(exp.id)}>Mark Paid</button>
                              </>
                            )}
                            <button onClick={() => handleDeleteExpense(exp.id)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}

        {expenses.length > 0 && (
          <div className="summary-box">
            <p>Total Spent: <strong>{formatCurrency(totalSpent)}</strong></p>
            <p>Remaining from Salary: <strong style={{ color: totalRemaining < 0 ? "#e53935" : "#a855f7" }}>{formatCurrency(totalRemaining)}</strong></p>
          </div>
        )}
      </div>
      </div>

      {/* Generate PDF Report Button */}
      <div className="pdf-report-section">
        <button 
          className="btn-generate-pdf"
          onClick={generatePDFReport}
          disabled={!income && portions.length === 0}
        >
          📄 Generate PDF Report
        </button>
        <p className="pdf-help-text">Download a summary report of your budget for {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
      </div>
    </div>
  );
};

export default BudgetPlanner;
