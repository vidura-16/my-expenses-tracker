import React, { useState } from 'react';
import { formatCurrency } from '../utils/expenseUtils';
import './WeeklySummary.css';

const WeeklySummary = ({ weeklyData, onDeleteExpense, onEditExpense }) => {
  const [expandedWeeks, setExpandedWeeks] = useState(new Set());

  const getCategoryColor = (category) => {
    const colors = {
      food: '#FF6384',
      travel: '#36A2EB', 
      utility: '#FFCE56',
      other: '#4BC0C0'
    };
    return colors[category] || '#007bff';
  };

  const toggleWeek = (weekKey) => {
    const newExpanded = new Set(expandedWeeks);
    if (newExpanded.has(weekKey)) {
      newExpanded.delete(weekKey);
    } else {
      newExpanded.add(weekKey);
    }
    setExpandedWeeks(newExpanded);
  };

  const formatDateLabel = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('default', { 
      weekday: 'long', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  if (!weeklyData || weeklyData.length === 0) {
    return (
      <div className="weekly-summary">
        <h3>Weekly Breakdown</h3>
        <p className="no-data">No expenses found for this month</p>
      </div>
    );
  }

  return (
    <div className="weekly-summary">
      <h3>Weekly Breakdown</h3>
      
      {weeklyData.map((week) => (
        <div key={week.key} className="week-item">
          <div 
            className="week-header"
            onClick={() => toggleWeek(week.key)}
          >
            <div className="week-info">
              <span className="week-range">{week.label}</span>
              <span className="week-total">{formatCurrency(week.total)}</span>
            </div>
            <div className={`expand-icon ${expandedWeeks.has(week.key) ? 'expanded' : ''}`}>
              ▼
            </div>
          </div>

          {expandedWeeks.has(week.key) && (
            <div className="week-details">
              {week.days.length === 0 ? (
                <p className="no-expenses">No expenses this week</p>
              ) : (
                week.days.map((day) => (
                  <div key={day.date} className="day-item">
                    <div className="day-header">
                      <span className="day-date">{formatDateLabel(day.date)}</span>
                      <span className="day-total">{formatCurrency(day.total)}</span>
                    </div>
                    
                    <div className="day-expenses">
                      {day.expenses.map((expense) => (
                        <div key={expense.id} className="expense-item">
                          <div className="expense-details">
                            <span 
                              className="expense-category"
                              style={{ backgroundColor: getCategoryColor(expense.category) }}
                            >
                              {expense.category}
                            </span>
                            <span className="expense-amount">{formatCurrency(expense.amount)}</span>
                            <span className="expense-payment">{expense.paymentType}</span>
                            {expense.note && (
                              <span className="expense-note">{expense.note}</span>
                            )}
                          </div>
                          <div className="expense-actions">
                            {onEditExpense && (
                              <button
                                onClick={() => onEditExpense(expense)}
                                className="edit-btn"
                                title="Edit expense"
                              >
                                ✎
                              </button>
                            )}
                            {onDeleteExpense && (
                              <button 
                                onClick={() => onDeleteExpense(expense)}
                                className="delete-btn"
                                title="Delete expense"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default WeeklySummary;