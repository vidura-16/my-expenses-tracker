import React, { useState, useEffect } from "react";
import { addExpense } from "../utils/expenseUtils";
import "../styles/AddExpense.css";

const CATEGORIES = [
  "food",
  "travel", 
  "utility",
  "other"
];

function AddExpense({ uid, selectedDate, onNavigate, onDataChanged }) {
  const [formData, setFormData] = useState({
    amount: "",
    category: "food",
    type: "daily",
    paymentType: "cash",
    date: selectedDate || new Date().toISOString().split("T")[0],
    note: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Update form date when selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      setFormData(prev => ({ ...prev, date: selectedDate }));
    }
  }, [selectedDate]);

  const handleSave = async (goHome = false) => {
    try {
      setError("");
      if (!formData.amount || parseFloat(formData.amount) <= 0) {
        setError("Please enter a valid amount");
        return;
      }

      setLoading(true);
      const expenseData = {
        ...formData,
        amount: parseFloat(formData.amount)
      };

      await addExpense(uid, expenseData);

      if (onDataChanged) onDataChanged();

      if (goHome) {
        onNavigate("home");
      } else {
        // Reset form for another entry, keep the date
        setFormData({
          amount: "",
          category: "food",
          type: "daily",
          paymentType: "cash",
          date: selectedDate || new Date().toISOString().split("T")[0],
          note: ""
        });
      }
    } catch (err) {
      console.error("Error saving expense:", err);
      setError("Failed to save expense. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-expense-container">
      <div className="header">
        <h1>Add Expense</h1>
        <p className="selected-date">Date: {new Date(formData.date).toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
      </div>
      {error && <div className="error-message">{error}</div>}
      
      <div className="form-group">
        <label htmlFor="amount">Amount</label>
        <input
          id="amount"
          type="number"
          placeholder="Enter amount"
          value={formData.amount}
          onChange={(e) => setFormData({...formData, amount: e.target.value})}
          step="0.01"
          className="input-field"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="date">Date</label>
        <input
          id="date"
          type="date"
          value={formData.date}
          onChange={(e) => setFormData({...formData, date: e.target.value})}
          className="input-field"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="category">Category</label>
        <select
          id="category"
          value={formData.category}
          onChange={(e) => setFormData({...formData, category: e.target.value})}
          className="input-field"
        >
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="type">Type</label>
        <select
          id="type"
          value={formData.type}
          onChange={(e) => setFormData({...formData, type: e.target.value})}
          className="input-field"
        >
          <option value="daily">Daily</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="paymentType">Payment Type</label>
        <select
          id="paymentType"
          value={formData.paymentType}
          onChange={(e) => setFormData({...formData, paymentType: e.target.value})}
          className="input-field"
        >
          <option value="cash">Cash</option>
          <option value="debit">Debit</option>
          <option value="credit">Credit</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="note">Note (Optional)</label>
        <textarea
          id="note"
          placeholder="Add a note"
          value={formData.note}
          onChange={(e) => setFormData({...formData, note: e.target.value})}
          className="input-field textarea"
          rows="4"
        ></textarea>
      </div>

      <div className="button-group">
        <button
          onClick={() => handleSave(false)}
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? "Saving..." : "Save & Add Another"}
        </button>
        <button
          onClick={() => handleSave(true)}
          disabled={loading}
          className="btn btn-secondary"
        >
          {loading ? "Saving..." : "Save & Go Home"}
        </button>
        <button
          onClick={() => onNavigate("home")}
          className="btn btn-cancel"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default AddExpense;
