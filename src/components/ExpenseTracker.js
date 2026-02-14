import React, { useState, useEffect, useCallback } from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { 
  getTodayTotal, 
  getMonthlyTotal, 
  getInstallmentsSummary,
  getExpenses,
  getMonthlyExpenses,
  deleteExpense,
  deleteCreditCard,
  payInstallment,
  formatCurrency,
  getCreditCards,
  addCreditCard,
  getDailyTarget,
  setDailyTarget
} from "../utils/expenseUtils";
import AddExpense from "../screens/AddExpense";
import WeeklySummary from "./WeeklySummary";
import InstallmentsView from "./InstallmentsView";
import "./ExpenseTracker.css";

ChartJS.register(ArcElement, Tooltip, Legend);

const ExpenseTracker = ({ uid }) => {
  const [activeView, setActiveView] = useState("home");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]); // Track selected date
  const [currentMonth, setCurrentMonth] = useState(new Date()); // For calendar navigation
  const [inlineCalendarOpen, setInlineCalendarOpen] = useState(false); // Inline popup near header
  const [expenseFormOpen, setExpenseFormOpen] = useState(false); // Inline expense form popup
  const [editingExpense, setEditingExpense] = useState(null);
  const [prefillPayment, setPrefillPayment] = useState(null);
  const [pendingDeleteExpense, setPendingDeleteExpense] = useState(null);
  const [todayData, setTodayData] = useState({ dailyTotal: 0, otherTotal: 0, total: 0 });
  const [monthlyData, setMonthlyData] = useState({ total: 0, byCategory: {}, byType: {} });
  const [installmentsData, setInstallmentsData] = useState({ pending: [], overdue: [], totalPending: 0, totalOverdue: 0 });
  const [todayExpenses, setTodayExpenses] = useState([]);
  const [monthlyExpenses, setMonthlyExpenses] = useState([]);
  const [allExpenses, setAllExpenses] = useState([]);
  const [creditCards, setCreditCards] = useState([]);
  const [dailyTarget, setDailyTargetState] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      // Derive year and monthIndex from the selected date so monthly queries reflect selection
      const [selYearStr, selMonthStr] = (selectedDate || new Date().toISOString().split('T')[0]).split('-');
      const selYear = parseInt(selYearStr, 10);
      const selMonthIndex = parseInt(selMonthStr, 10) - 1; // 0-based month index

      const [today, monthly, installments, expenses, monthlyExpensesData, allExpensesData, cards, target] = await Promise.all([
        getTodayTotal(uid, selectedDate),
        getMonthlyTotal(uid, selYear, selMonthIndex),
        getInstallmentsSummary(uid),
        getExpenses(uid, selectedDate),
        getMonthlyExpenses(uid, selYear, selMonthIndex),
        getExpenses(uid), // fetch all expenses, no date filter
        getCreditCards(uid),
        getDailyTarget(uid, selectedDate)
      ]);

      setTodayData(today);
      setMonthlyData(monthly);
      setInstallmentsData(installments);
      setTodayExpenses(expenses);
      setMonthlyExpenses(monthlyExpensesData);
      setAllExpenses(allExpensesData);
      setCreditCards(cards);
      setDailyTargetState(target);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }, [uid, selectedDate]);

  useEffect(() => {
    if (uid) {
      loadData();
    }
  }, [uid, loadData]);

  const handleDeleteExpense = async (expenseId) => {
    if (!expenseId) {
      alert('Unable to delete: missing expense id');
      setPendingDeleteExpense(null);
      return;
    }

    try {
      await deleteExpense(uid, expenseId);
      setPendingDeleteExpense(null);
      setEditingExpense(null); // Clear editing state
      setExpenseFormOpen(false); // Close form if open
      await loadData();
    } catch (error) {
      console.error("Error deleting expense:", error);
      alert('Failed to delete expense: ' + (error.message || error));
    }
  };

  const requestDeleteExpense = (expense) => {
    if (!expense) {
      setPendingDeleteExpense(null);
      return;
    }
    setPendingDeleteExpense(expense);
  };

  const cancelDelete = () => setPendingDeleteExpense(null);

  const handleEditExpense = (expense) => {
    setEditingExpense(expense);
    setExpenseFormOpen(true);
  };

  const handleSetDailyTarget = async () => {
    const amount = prompt("Enter daily target amount:");
    if (amount && !isNaN(parseFloat(amount))) {
      try {
        await setDailyTarget(uid, { amount: parseFloat(amount), date: selectedDate });
        await loadData();
      } catch (error) {
        console.error("Error setting daily target:", error);
      }
    }
  };

  const handleMarkInstallmentPaid = async (expenseId, amount) => {
    if (!expenseId) return;
    const ok = window.confirm('Mark next installment as paid for this plan?');
    if (!ok) return;
    try {
      await payInstallment(uid, expenseId, { amount, date: new Date().toISOString().split('T')[0], note: 'Installment payment' });
      await loadData();
    } catch (err) {
      console.error('Error marking installment paid:', err);
      alert('Failed to mark installment paid: ' + (err.message || err));
    }
  };

  const handleAddCreditCard = async () => {
    const name = prompt("Enter card name (e.g., HNB Visa):");
    if (name) {
      const bank = prompt("Enter bank name:");
      const cardId = prompt("Enter card ID (e.g., hnb_visa):");
      const limit = prompt("Enter credit limit (optional):");
      
      try {
        await addCreditCard(uid, {
          name,
          bank: bank || "",
          cardId: cardId || name.toLowerCase().replace(/\s+/g, '_'),
          limit: limit ? parseFloat(limit) : 0
        });
        await loadData();
      } catch (error) {
        console.error("Error adding credit card:", error);
      }
    }
  };

  const openAddCardPayment = async (cardId = null) => {
    // Refresh data to ensure installmentPlans are up-to-date before opening the payment form
    try {
      await loadData();
    } catch (err) {
      console.error('Failed to refresh data before opening Add Card Payment', err);
    }
    setPrefillPayment({ cardId: cardId || '' });
    setEditingExpense(null);
    setExpenseFormOpen(true);
  };

  const handleDeleteCreditCard = async (cardDocId) => {
    if (!cardDocId) return;
    const ok = window.confirm('Delete this credit card? This will not delete existing installments.');
    if (!ok) return;
    try {
      await deleteCreditCard(uid, cardDocId);
      await loadData();
    } catch (err) {
      console.error('Failed to delete credit card', err);
      alert('Failed to delete credit card: ' + (err.message || err));
    }
  };

  // Prepare pie chart data
  const getPieChartData = () => {
    const categories = Object.keys(monthlyData.byCategory || {});
    if (categories.length === 0) {
      return {
        labels: ['No Data'],
        datasets: [{
          data: [1],
          backgroundColor: ['#e0e0e0'],
          borderWidth: 0
        }]
      };
    }

    const colors = {
      food: '#FF6384',
      travel: '#36A2EB', 
      utility: '#FFCE56',
      other: '#4BC0C0',
      default: '#9966FF'
    };

    return {
      labels: categories.map(cat => cat.charAt(0).toUpperCase() + cat.slice(1)),
      datasets: [{
        data: categories.map(cat => monthlyData.byCategory[cat]),
        backgroundColor: categories.map(cat => colors[cat] || colors.default),
        borderWidth: 2,
        borderColor: '#fff'
      }]
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 20,
          usePointStyle: true
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const value = context.parsed;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${context.label}: ${formatCurrency(value)} (${percentage}%)`;
          }
        }
      }
    }
  };

  // Weekly data grouping functions
  const getWeekKey = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const monday = new Date(d.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    return {
      key: monday.toISOString().split('T')[0],
      start: monday.toISOString().split('T')[0],
      end: sunday.toISOString().split('T')[0],
      label: `${monday.toLocaleDateString('default', { month: 'short', day: 'numeric' })} – ${sunday.toLocaleDateString('default', { month: 'short', day: 'numeric' })}`
    };
  };

  const groupExpensesByWeek = (expenses) => {
    const weeks = {};
    
    expenses.forEach(expense => {
      const weekInfo = getWeekKey(expense.date);
      const weekKey = weekInfo.key;
      
      if (!weeks[weekKey]) {
        weeks[weekKey] = {
          ...weekInfo,
          total: 0,
          days: {}
        };
      }
      
      weeks[weekKey].total += expense.amount;
      
      // Group by day within the week
      const dayKey = expense.date;
      if (!weeks[weekKey].days[dayKey]) {
        weeks[weekKey].days[dayKey] = {
          date: expense.date,
          total: 0,
          expenses: []
        };
      }
      
      weeks[weekKey].days[dayKey].total += expense.amount;
      weeks[weekKey].days[dayKey].expenses.push(expense);
    });
    
    // Sort weeks by date (newest first) and days within weeks
    return Object.keys(weeks)
      .sort((a, b) => new Date(b) - new Date(a))
      .map(weekKey => ({
        ...weeks[weekKey],
        days: Object.keys(weeks[weekKey].days)
          .sort((a, b) => new Date(b) - new Date(a))
          .map(dayKey => weeks[weekKey].days[dayKey])
      }));
  };


  // Calendar helper function
  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const handleDateSelect = (day) => {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const today = new Date().toISOString().split("T")[0];
    
    // Prevent selecting future dates
    if (dateStr > today) {
      return;
    }
    
    setSelectedDate(dateStr);
    setInlineCalendarOpen(false); // Close calendar after selection
    // Stay on home screen to view expenses for selected date
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const days = [];
    
    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }
    
    // Days of the month
    const today = new Date().toISOString().split("T")[0];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isSelected = dateStr === selectedDate;
      const isFuture = dateStr > today;
      days.push(
        <button
          key={day}
          className={`calendar-day ${isSelected ? 'selected' : ''} ${isFuture ? 'future' : ''}`}
          onClick={() => handleDateSelect(day)}
          disabled={isFuture}
        >
          {day}
        </button>
      );
    }
    
    return days;
  };

  const renderHomeView = () => (
    <div className="home-view">
      {/* Selected Date Info */}
      <div className="selected-date-banner">
        <div className="selected-date-content">
          <h3>Selected Date: {new Date(selectedDate).toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h3>
          <div className="selected-date-actions">
            <button
              className="calendar-icon-btn"
              onClick={() => { setInlineCalendarOpen(!inlineCalendarOpen); }}
              aria-label={inlineCalendarOpen ? 'Hide calendar' : 'Show calendar'}
              title={inlineCalendarOpen ? 'Hide calendar' : 'Show calendar'}
            >
              📅
            </button>
            {inlineCalendarOpen && (
              <>
                <div className="calendar-overlay" onClick={() => setInlineCalendarOpen(false)}></div>
                <div className="inline-calendar-popup">
                  <div className="calendar-header">
                    <button onClick={handlePrevMonth} className="calendar-nav">←</button>
                    <h3>{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
                    <button onClick={handleNextMonth} className="calendar-nav">→</button>
                  </div>
                  <div className="calendar-weekdays">
                    <div>Sun</div>
                    <div>Mon</div>
                    <div>Tue</div>
                    <div>Wed</div>
                    <div>Thu</div>
                    <div>Fri</div>
                    <div>Sat</div>
                  </div>
                  <div className="calendar-days inline-days">
                    {renderCalendar()}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Today's Summary */}
      <div className="today-section">
        <div className="section-header">
          <h2>Overview</h2>
          <div className="action-buttons">
            <button onClick={() => setExpenseFormOpen(true)} className="btn-primary">Add Expense</button>
            <button onClick={() => openAddCardPayment()} className="btn-secondary">Add Card Payment</button>
            <button onClick={handleSetDailyTarget} className="btn-secondary">Set Target</button>
          </div>
        </div>
        
        <div className="daily-stats">
          {dailyTarget && (
            <div className="target-info">
              <span>Target: {formatCurrency(dailyTarget.amount)}</span>
              <span className={todayData.dailyTotal > dailyTarget.amount ? "over-target" : "under-target"}>
                {todayData.dailyTotal > dailyTarget.amount ? "Over" : "Under"} by {formatCurrency(Math.abs(todayData.dailyTotal - dailyTarget.amount))}
              </span>
            </div>
          )}
          <div className="totals">
            <span>Daily: {formatCurrency(todayData.dailyTotal)}</span>
            <span>Other: {formatCurrency(todayData.otherTotal)}</span>
            <span className="total">Total: {formatCurrency(todayData.total)}</span>
          </div>
        </div>

        <div className="today-expenses">
          <h3>Today's Expenses</h3>
          {todayExpenses.length === 0 ? (
            <p className="no-expenses">No expenses for today</p>
          ) : (
            <div className="expenses-list-compact">
              {/* Daily Expenses */}
              {todayExpenses.filter(exp => exp.type === "daily" && !(exp.creditData && exp.creditData.isInstallment)).length > 0 && (
                <>
                  <div className="expense-type-header">Daily</div>
                  {todayExpenses.filter(exp => exp.type === "daily" && !(exp.creditData && exp.creditData.isInstallment)).slice(0, 5).map(expense => (
                    <div key={expense.id} className="expense-item-compact">
                      <div className="expense-details-compact">
                        <span className="amount">{formatCurrency(expense.amount)}</span>
                        <span className="category">{expense.category}</span>
                        <span className="payment">{expense.paymentType}</span>
                        {expense.note && <span className="note">{expense.note}</span>}
                      </div>
                      <div className="expense-actions">
                        <button 
                          onClick={() => handleEditExpense(expense)}
                          className="btn-edit-small"
                          title="Edit"
                        >
                          ✎
                        </button>
                        <button 
                          onClick={() => requestDeleteExpense(expense)}
                          className="btn-delete-small"
                          title="Delete"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                  {todayExpenses.filter(exp => exp.type === "daily" && !(exp.creditData && exp.creditData.isInstallment)).length > 5 && (
                    <p className="more-expenses">+{todayExpenses.filter(exp => exp.type === "daily" && !(exp.creditData && exp.creditData.isInstallment)).length - 5} more daily expenses</p>
                  )}
                </>
              )}
              
              {/* Other Expenses */}
              {todayExpenses.filter(exp => exp.type === "other" && !(exp.creditData && exp.creditData.isInstallment)).length > 0 && (
                <>
                  <div className="expense-type-header">Other</div>
                  {todayExpenses.filter(exp => exp.type === "other" && !(exp.creditData && exp.creditData.isInstallment)).slice(0, 5).map(expense => (
                    <div key={expense.id} className="expense-item-compact">
                      <div className="expense-details-compact">
                        <span className="amount">{formatCurrency(expense.amount)}</span>
                        <span className="category">{expense.category}</span>
                        <span className="payment">{expense.paymentType}</span>
                        {expense.note && <span className="note">{expense.note}</span>}
                      </div>
                      <div className="expense-actions">
                        <button 
                          onClick={() => handleEditExpense(expense)}
                          className="btn-edit-small"
                          title="Edit"
                        >
                          ✎
                        </button>
                        <button 
                          onClick={() => requestDeleteExpense(expense)}
                          className="btn-delete-small"
                          title="Delete"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                  {todayExpenses.filter(exp => exp.type === "other" && !(exp.creditData && exp.creditData.isInstallment)).length > 5 && (
                    <p className="more-expenses">+{todayExpenses.filter(exp => exp.type === "other" && !(exp.creditData && exp.creditData.isInstallment)).length - 5} more other expenses</p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Monthly Summary with Pie Chart */}
      <div className="monthly-section">
        <h2>This Month's Summary</h2>
        <div className="monthly-content">
          <div className="monthly-stats">
            <div className="total-card">
              <h3>Total Spent</h3>
              <span className="amount">{formatCurrency(monthlyData.total)}</span>
            </div>
            
            <div className="breakdown-section">
              <div className="type-breakdown">
                <h4>By Type</h4>
                <div className="breakdown-item">
                  <span className="label">Daily</span>
                  <span className="amount">{formatCurrency(monthlyData.byType?.daily || 0)}</span>
                </div>
                <div className="breakdown-item">
                  <span className="label">Other</span>
                  <span className="amount">{formatCurrency(monthlyData.byType?.other || 0)}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="chart-section">
            <h4>Expenses by Category</h4>
            <div className="chart-container">
              <Pie data={getPieChartData()} options={chartOptions} />
            </div>
          </div>
        </div>

        {/* Weekly Summary with Expandable Daily Details */}
        <WeeklySummary 
          weeklyData={groupExpensesByWeek(monthlyExpenses.filter(exp => !(exp.creditData && exp.creditData.isInstallment)))} 
          onDeleteExpense={requestDeleteExpense}
          onEditExpense={handleEditExpense}
        />
      </div>
      
      {/* Inline Expense Form Popup */}
      {expenseFormOpen && (
        <div className="expense-form-overlay" onClick={(e) => {
          if (e.target.className === 'expense-form-overlay') {
            setExpenseFormOpen(false);
          }
        }}>
          <div className="expense-form-popup">
            <button 
              className="close-btn"
              onClick={() => setExpenseFormOpen(false)}
            >
              ×
            </button>
            <AddExpense 
              uid={uid} 
              selectedDate={selectedDate}
              creditCards={creditCards}
              installmentPlans={allExpenses.filter(e => e.creditData && e.creditData.isInstallment)}
              expenseToEdit={editingExpense}
              prefillPayment={prefillPayment}
              onNavigate={() => { setExpenseFormOpen(false); setEditingExpense(null); setPrefillPayment(null); }}
              onDataChanged={() => {
                loadData();
                setExpenseFormOpen(false);
                setEditingExpense(null);
                setPrefillPayment(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );






  const renderInstallmentsView = () => {
    return (
      <InstallmentsView 
        creditCards={creditCards}
        allExpenses={allExpenses}
        installmentsData={installmentsData}
        onAddCreditCard={handleAddCreditCard}
        onDeleteCreditCard={handleDeleteCreditCard}
        onMarkInstallmentPaid={handleMarkInstallmentPaid}
        onAddCardPayment={openAddCardPayment}
        onDeleteInstallmentPlan={requestDeleteExpense}
      />
    );
  };

  // Removed unused functions handleNavigate and renderAddExpenseView

  // Sidebar removed — inline calendar used in header

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="expense-tracker">
      <div className="main-content">
        {/* View Tabs */}
        <div className="view-tabs">
          <button 
            className={activeView === "home" ? "tab active" : "tab"}
            onClick={() => setActiveView("home")}
          >
            Home
          </button>
          <button 
            className={activeView === "installments" ? "tab active" : "tab"}
            onClick={() => setActiveView("installments")}
          >
            Installments
          </button>
        </div>

        <div className="view-content">
          {activeView === "home" && renderHomeView()}
          {activeView === "installments" && renderInstallmentsView()}
        </div>

        {/* Delete confirmation modal - outside view content so it shows on any tab */}
        {pendingDeleteExpense && (
          <div className="confirm-overlay" onClick={(e) => { if (e.target.className === 'confirm-overlay') cancelDelete(); }}>
                <div className="confirm-popup">
                  <h3>Confirm Delete</h3>
                  <p>
                    Delete expense <strong>{pendingDeleteExpense.note || pendingDeleteExpense.category || 'this expense'}</strong>
                    {pendingDeleteExpense.amount ? ` of ${formatCurrency(pendingDeleteExpense.amount)}` : ''}?
                    This will also remove related installments.
                  </p>
                  <div className="confirm-actions">
                    <button className="btn btn-danger" onClick={() => handleDeleteExpense(pendingDeleteExpense.id)}>
                      Delete
                    </button>
                    <button className="btn btn-secondary" onClick={cancelDelete}>Cancel</button>
                  </div>
                </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpenseTracker;