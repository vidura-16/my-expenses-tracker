import React, { useState, useEffect, useCallback } from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { 
  getTodayTotal, 
  getMonthlyTotal, 
  getInstallmentsSummary,
  addExpense,
  getExpenses,
  deleteExpense,
  formatCurrency,
  getCreditCards,
  addCreditCard,
  getDailyTarget,
  setDailyTarget
} from "../utils/expenseUtils";
import AddExpense from "../screens/AddExpense";
import "./ExpenseTracker.css";

ChartJS.register(ArcElement, Tooltip, Legend);

const ExpenseTracker = ({ uid }) => {
  const [activeView, setActiveView] = useState("home");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]); // Track selected date
  const [currentMonth, setCurrentMonth] = useState(new Date()); // For calendar navigation
  const [calendarOpen, setCalendarOpen] = useState(true); // Show calendar by default
  const [todayData, setTodayData] = useState({ dailyTotal: 0, otherTotal: 0, total: 0 });
  const [monthlyData, setMonthlyData] = useState({ total: 0, byCategory: {}, byType: {} });
  const [installmentsData, setInstallmentsData] = useState({ pending: [], overdue: [], totalPending: 0, totalOverdue: 0 });
  const [todayExpenses, setTodayExpenses] = useState([]);
  const [creditCards, setCreditCards] = useState([]);
  const [dailyTarget, setDailyTargetState] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [today, monthly, installments, expenses, cards, target] = await Promise.all([
        getTodayTotal(uid, selectedDate),
        getMonthlyTotal(uid),
        getInstallmentsSummary(uid),
        getExpenses(uid, selectedDate),
        getCreditCards(uid),
        getDailyTarget(uid, selectedDate)
      ]);

      setTodayData(today);
      setMonthlyData(monthly);
      setInstallmentsData(installments);
      setTodayExpenses(expenses);
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
    try {
      await deleteExpense(uid, expenseId);
      await loadData();
    } catch (error) {
      console.error("Error deleting expense:", error);
    }
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
    setSelectedDate(dateStr);
    setActiveView("addExpense"); // Navigate to add expense screen
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
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isSelected = dateStr === selectedDate;
      days.push(
        <button
          key={day}
          className={`calendar-day ${isSelected ? 'selected' : ''}`}
          onClick={() => handleDateSelect(day)}
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
        <h3>Selected Date: {new Date(selectedDate).toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h3>
      </div>

      {/* Today's Summary */}
      <div className="today-section">
        <div className="section-header">
          <h2>Overview</h2>
          <div className="action-buttons">
            <button onClick={() => setActiveView("addExpense")} className="btn-primary">Add Expense</button>
            <button onClick={handleSetDailyTarget} className="btn-secondary">Set Target</button>
          </div>
        </div>
        
        <div className="daily-stats">
          {dailyTarget && (
            <div className="target-info">
              <span>Target: {formatCurrency(dailyTarget.amount)}</span>
              <span className={todayData.total > dailyTarget.amount ? "over-target" : "under-target"}>
                {todayData.total > dailyTarget.amount ? "Over" : "Under"} by {formatCurrency(Math.abs(todayData.total - dailyTarget.amount))}
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
              {todayExpenses.filter(exp => exp.type === "daily").length > 0 && (
                <>
                  <div className="expense-type-header">Daily</div>
                  {todayExpenses.filter(exp => exp.type === "daily").slice(0, 5).map(expense => (
                    <div key={expense.id} className="expense-item-compact">
                      <div className="expense-details-compact">
                        <span className="amount">{formatCurrency(expense.amount)}</span>
                        <span className="category">{expense.category}</span>
                        <span className="payment">{expense.paymentType}</span>
                        {expense.note && <span className="note">{expense.note}</span>}
                      </div>
                      <button 
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="btn-delete-small"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {todayExpenses.filter(exp => exp.type === "daily").length > 5 && (
                    <p className="more-expenses">+{todayExpenses.filter(exp => exp.type === "daily").length - 5} more daily expenses</p>
                  )}
                </>
              )}
              
              {/* Other Expenses */}
              {todayExpenses.filter(exp => exp.type === "other").length > 0 && (
                <>
                  <div className="expense-type-header">Other</div>
                  {todayExpenses.filter(exp => exp.type === "other").slice(0, 5).map(expense => (
                    <div key={expense.id} className="expense-item-compact">
                      <div className="expense-details-compact">
                        <span className="amount">{formatCurrency(expense.amount)}</span>
                        <span className="category">{expense.category}</span>
                        <span className="payment">{expense.paymentType}</span>
                        {expense.note && <span className="note">{expense.note}</span>}
                      </div>
                      <button 
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="btn-delete-small"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {todayExpenses.filter(exp => exp.type === "other").length > 5 && (
                    <p className="more-expenses">+{todayExpenses.filter(exp => exp.type === "other").length - 5} more other expenses</p>
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
      </div>
    </div>
  );




  // Group installments by payment (using note field from related expense)
  const groupInstallmentsByPayment = (installments, allExpenses) => {
    const expenseMap = {};
    allExpenses.forEach(exp => {
      expenseMap[exp.id] = exp;
    });
    const grouped = {};
    installments.forEach(inst => {
      const exp = expenseMap[inst.expenseId];
      const paymentFor = exp && exp.note ? exp.note : "Other";
      if (!grouped[paymentFor]) grouped[paymentFor] = [];
      grouped[paymentFor].push({ ...inst, expense: exp });
    });
    return grouped;
  };

  const renderInstallmentsView = () => {
    // Use all monthlyData.expenses to get notes for grouping
    const allExpenses = monthlyData.expenses || [];
    const groupedPending = groupInstallmentsByPayment(installmentsData.pending, allExpenses);
    const groupedOverdue = groupInstallmentsByPayment(installmentsData.overdue, allExpenses);

    return (
      <div className="installments-view">
        <h2>Credit Installments</h2>
        <div className="installments-header">
          <button onClick={handleAddCreditCard} className="btn-secondary">Add Credit Card</button>
          <div className="installments-summary">
            <span>Pending: {formatCurrency(installmentsData.totalPending)}</span>
            <span className="overdue">Overdue: {formatCurrency(installmentsData.totalOverdue)}</span>
          </div>
        </div>

        {/* Overdue Installments Grouped by Payment */}
        {Object.keys(groupedOverdue).length > 0 && (
          <div className="overdue-section">
            <h3>Overdue Installments</h3>
            {Object.entries(groupedOverdue).map(([paymentFor, rows]) => (
              <div key={paymentFor} className="installment-group">
                <h4>{paymentFor}</h4>
                {rows.map(installment => (
                  <div key={installment.id} className="installment-item overdue">
                    <span className="amount">{formatCurrency(installment.amount)}</span>
                    <span className="due-date">Due: {installment.dueDate}</span>
                    <span className="installment-info">
                      {installment.installmentNumber}/{installment.totalInstallments}
                    </span>
                    <span className="card-id">Card: {installment.cardId}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Pending Installments Grouped by Payment */}
        {Object.keys(groupedPending).length > 0 && (
          <div className="pending-section">
            <h3>Upcoming Installments</h3>
            {Object.entries(groupedPending).map(([paymentFor, rows]) => (
              <div key={paymentFor} className="installment-group">
                <h4>{paymentFor}</h4>
                {rows.map(installment => (
                  <div key={installment.id} className="installment-item">
                    <span className="amount">{formatCurrency(installment.amount)}</span>
                    <span className="due-date">Due: {installment.dueDate}</span>
                    <span className="installment-info">
                      {installment.installmentNumber}/{installment.totalInstallments}
                    </span>
                    <span className="card-id">Card: {installment.cardId}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const handleNavigate = (view) => {
    setActiveView(view);
  };

  const handleDataChanged = () => {
    loadData();
  };

  const renderAddExpenseView = () => (
    <AddExpense 
      uid={uid} 
      selectedDate={selectedDate}
      onNavigate={handleNavigate}
      onDataChanged={handleDataChanged}
    />
  );

  const renderSidebar = () => (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3>Select Date to Add Expense</h3>
        <button
          className="calendar-toggle-btn"
          onClick={() => setCalendarOpen(!calendarOpen)}
          aria-label={calendarOpen ? 'Hide calendar' : 'Show calendar'}
        >
          {calendarOpen ? '−' : '+'}
        </button>
      </div>
      {calendarOpen && (
        <div className="calendar-section sidebar-calendar">
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
          <div className="calendar-days">
            {renderCalendar()}
          </div>
        </div>
      )}
    </div>
  );

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="expense-tracker with-sidebar">
      {/* Left Sidebar with Calendar */}
      {renderSidebar()}
      
      {/* Main Content Area */}
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
            className={activeView === "addExpense" ? "tab active" : "tab"}
            onClick={() => setActiveView("addExpense")}
          >
            Add Expense
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
          {activeView === "addExpense" && renderAddExpenseView()}
          {activeView === "installments" && renderInstallmentsView()}
        </div>
      </div>
    </div>
  );
};

export default ExpenseTracker;