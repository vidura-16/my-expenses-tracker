import React, { useState, useEffect } from "react";
import { addExpense, updateExpense, payInstallment, getInstallmentsForExpense } from "../utils/expenseUtils";
import "../styles/AddExpense.css";

const CATEGORIES = [
  "food",
  "travel", 
  "utility",
  "other"
];

function AddExpense({ uid, selectedDate, onNavigate, onDataChanged, creditCards = [], installmentPlans = [], expenseToEdit = null, prefillPayment = null }) {
  const [formData, setFormData] = useState({
    amount: "",
    category: "food",
    type: "daily",
    paymentType: "cash",
    date: selectedDate || new Date().toISOString().split("T")[0],
    note: "",
    isInstallment: false,
    installmentMonths: 3,
    cardId: "",
    applyToExpenseId: ""
  });
  const [installmentNumber, setInstallmentNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAmountChange = (val) => {
    // allow empty or numeric input; store as string
    setFormData(prev => ({ ...prev, amount: val }));
  };

  const handleAmountBlur = () => {
    const v = formData.amount;
    if (!v) return;
    const n = parseFloat(v);
    if (isNaN(n)) return;
    setFormData(prev => ({ ...prev, amount: n.toFixed(2) }));
  };

  // Update form date when selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      setFormData(prev => ({ ...prev, date: selectedDate }));
    }
  }, [selectedDate]);

  // Prefill form when editing an existing expense
  useEffect(() => {
    if (expenseToEdit) {
      setFormData({
        amount: expenseToEdit.amount ? String(expenseToEdit.amount) : "",
        category: expenseToEdit.category || "food",
        type: expenseToEdit.type || "daily",
        paymentType: expenseToEdit.paymentType || "cash",
        date: expenseToEdit.date || selectedDate || new Date().toISOString().split("T")[0],
        note: expenseToEdit.note || "",
        isInstallment: !!(expenseToEdit.creditData && expenseToEdit.creditData.isInstallment),
        installmentMonths: expenseToEdit.creditData ? expenseToEdit.creditData.totalInstallments || 3 : 3,
        cardId: expenseToEdit.creditData ? (expenseToEdit.creditData.cardId || "") : ""
      });
    }
  }, [expenseToEdit, selectedDate]);

  // Prefill when opened for card payment
  useEffect(() => {
    if (prefillPayment && !expenseToEdit) {
      setFormData(prev => ({
        ...prev,
        paymentType: 'credit',
        cardId: prefillPayment.cardId || prev.cardId
      }));
    }
  }, [prefillPayment, expenseToEdit]);

  const availablePlansForPrefill = installmentPlans && installmentPlans.filter(p => p.creditData && p.creditData.isInstallment);

  // Auto-fill amount when a plan is selected
  useEffect(() => {
    if (formData.applyToExpenseId) {
      const plan = installmentPlans.find(p => p.id === formData.applyToExpenseId);
        if (plan) {
        const monthly = plan.creditData?.monthlyAmount || (plan.amount && plan.creditData?.totalInstallments ? (plan.amount / plan.creditData.totalInstallments) : null);
        setFormData(prev => ({
          ...prev,
          amount: (monthly !== null && monthly !== undefined) ? Number(monthly).toFixed(2) : prev.amount,
          cardId: plan.creditData?.cardId || prev.cardId
        }));
      }
    }
  }, [formData.applyToExpenseId, installmentPlans]);

  // Auto-fill installment number (next unpaid) when a plan is selected
  useEffect(() => {
    let mounted = true;
    const fetchNext = async () => {
      if (!formData.applyToExpenseId) return;
      try {
        const insts = await getInstallmentsForExpense(uid, formData.applyToExpenseId);
        if (!mounted) return;
        const next = insts.find(i => !i.isPaid) || null;
        if (next) {
          setInstallmentNumber(String(next.installmentNumber || ''));
        } else {
          // No unpaid installments - clear selection to avoid accidental duplicate payment
          setInstallmentNumber('');
        }
      } catch (err) {
        console.error('Failed to fetch installments for auto-fill:', err);
      }
    };
    fetchNext();
    return () => { mounted = false; };
  }, [formData.applyToExpenseId, uid]);

  const handleSave = async (goHome = false) => {
    try {
      setError("");
      if (!formData.amount || parseFloat(formData.amount) <= 0) {
        setError("Please enter a valid amount");
        return;
      }

      // If opened as Add Card Payment, require selecting an existing installment plan
      if (prefillPayment && !expenseToEdit && !formData.applyToExpenseId) {
        setError("Select an existing installment plan to apply this payment.");
        return;
      }

      if (formData.paymentType === 'credit' && !formData.cardId && !formData.applyToExpenseId) {
        setError("Please select a credit card");
        return;
      }

      setLoading(true);
      const expenseData = {
        ...formData,
        amount: parseFloat(formData.amount)
      };

      if (formData.applyToExpenseId) {
        // Paying an existing installment plan: create payment expense and mark specified or next unpaid installment paid
        // Force this payment to be recorded as an 'other' expense in category 'installment' so it doesn't affect daily target
        await payInstallment(uid, formData.applyToExpenseId, {
          amount: expenseData.amount,
          category: 'installment',
          type: 'other',
          date: expenseData.date,
          note: expenseData.note,
          installmentNumber: installmentNumber ? parseInt(installmentNumber) : undefined
        });
      } else if (expenseToEdit && expenseToEdit.id) {
        // Check if expense still exists before updating
        try {
          await updateExpense(uid, expenseToEdit.id, expenseData);
        } catch (updateError) {
          if (updateError.message && updateError.message.includes('No document to update')) {
            // Expense was deleted, create as new expense instead
            await addExpense(uid, expenseData);
          } else {
            throw updateError;
          }
        }
      } else {
        // Regular add expense (may create installments if isInstallment)
        await addExpense(uid, expenseData);
      }

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
          note: "",
          isInstallment: false,
          installmentMonths: 3,
          cardId: "",
          applyToExpenseId: ""
        });
      }
    } catch (err) {
      console.error("Error saving expense:", err);
      setError(err && err.message ? err.message : "Failed to save expense. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-expense-container">
      <div className="header">
        <h1>{prefillPayment && !expenseToEdit ? 'Add Card Payment' : 'Add Expense'}</h1>
        <p className="selected-date">Date: {new Date(formData.date).toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
      </div>
      {error && <div className="error-message">{error}</div>}
      {/* If opened specifically for Add Card Payment, render a simplified form */}
      {prefillPayment && !expenseToEdit ? (
        <>
          <div className="form-group">
            <label htmlFor="applyToExpenseId">Select Installment Plan</label>
            <select
              id="applyToExpenseId"
              value={formData.applyToExpenseId}
              onChange={(e) => setFormData({...formData, applyToExpenseId: e.target.value})}
              className="input-field"
            >
              <option value="">-- Select existing plan --</option>
              {installmentPlans && installmentPlans
                .filter(p => p.creditData && p.creditData.isInstallment)
                .map(p => (
                  <option key={p.id} value={p.id}>{p.note || 'Installment'} • {p.category} • {p.date}</option>
                ))}
            </select>
            {(!installmentPlans || installmentPlans.filter(p => p.creditData && p.creditData.isInstallment).length === 0) && (
              <p className="help-text">No existing installment plans found. Add a plan first.</p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="amount">Amount</label>
            <input
              id="amount"
              type="number"
              placeholder="Enter amount"
              value={formData.amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              onBlur={handleAmountBlur}
              step="0.01"
              className="input-field"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="date">Payment Date</label>
            <input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({...formData, date: e.target.value})}
              className="input-field"
            />
          </div>

          <div className="form-group">
            <label htmlFor="installmentNumber">Installment Number (optional)</label>
            <input
              id="installmentNumber"
              type="number"
              min="1"
              placeholder="e.g., 2"
              value={installmentNumber}
              onChange={(e) => setInstallmentNumber(e.target.value)}
              className="input-field"
            />
            <p className="help-text">If left empty, the next unpaid installment will be marked paid.</p>
          </div>

          {/* card summary removed — plan selection is sufficient */}
        </>
      ) : (
        <>
      
      <div className="form-group">
        <label htmlFor="amount">Amount</label>
        <input
          id="amount"
          type="number"
          placeholder="Enter amount"
          value={formData.amount}
          onChange={(e) => handleAmountChange(e.target.value)}
          onBlur={handleAmountBlur}
          step="0.01"
          className="input-field"
          required
        />
      </div>

      </>
      )}


      {!(prefillPayment && !expenseToEdit) && (
        <>
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

          {/* Installment options for credit payments */}
          {formData.paymentType === 'credit' && (
            <>
              <div className="form-group">
                <label htmlFor="cardId">Credit Card</label>
                <select
                  id="cardId"
                  value={formData.cardId}
                  onChange={(e) => setFormData({...formData, cardId: e.target.value})}
                  className="input-field"
                  required
                >
                  <option value="">Select Credit Card</option>
                  {creditCards.length === 0 ? (
                    <option value="" disabled>No credit cards available</option>
                  ) : (
                    creditCards.map(card => (
                      <option key={card.id} value={card.id}>
                        {card.name} {card.bank && `(${card.bank})`}
                      </option>
                    ))
                  )}
                </select>
                {creditCards.length === 0 && (
                  <p className="help-text">Please add a credit card first by going to Installments → Add Credit Card</p>
                )}
              </div>

              <div className="form-group">
                <div className="checkbox-group">
                  <input
                    id="isInstallment"
                    type="checkbox"
                    checked={formData.isInstallment}
                    onChange={(e) => setFormData({...formData, isInstallment: e.target.checked})}
                  />
                  <label htmlFor="isInstallment" className="checkbox-label">This is an installment payment</label>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="applyToExpenseId">Apply to existing installment plan (optional)</label>
                <select
                  id="applyToExpenseId"
                  value={formData.applyToExpenseId}
                  onChange={(e) => setFormData({...formData, applyToExpenseId: e.target.value})}
                  className="input-field"
                >
                  <option value="">-- New expense / new plan --</option>
                  {installmentPlans && installmentPlans
                    .filter(p => p.creditData && p.creditData.cardId === formData.cardId)
                    .map(p => (
                      <option key={p.id} value={p.id}>{p.note || 'Installment'} • {p.category} • {p.date}</option>
                    ))}
                </select>
                <p className="help-text">Select an existing plan to record a monthly payment against it.</p>
              </div>

              {formData.applyToExpenseId && (
                <div className="form-group">
                  <label htmlFor="installmentNumber">Installment Number (optional)</label>
                  <input
                    id="installmentNumber"
                    type="number"
                    min="1"
                    placeholder="e.g., 2"
                    value={installmentNumber}
                    onChange={(e) => setInstallmentNumber(e.target.value)}
                    className="input-field"
                  />
                  <p className="help-text">If left empty, the next unpaid installment will be marked paid.</p>
                </div>
              )}
              
              {formData.isInstallment && (
                <div className="form-group">
                  <label htmlFor="installmentMonths">Number of Months</label>
                  <select
                    id="installmentMonths"
                    value={formData.installmentMonths}
                    onChange={(e) => setFormData({...formData, installmentMonths: parseInt(e.target.value)})}
                    className="input-field"
                  >
                    <option value={3}>3 Months</option>
                    <option value={6}>6 Months</option>
                    <option value={12}>12 Months</option>
                    <option value={18}>18 Months</option>
                    <option value={24}>24 Months</option>
                    <option value={36}>36 Months</option>
                  </select>
                </div>
              )}
            </>
          )}
        </>
      )}

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
          disabled={loading || (prefillPayment && !expenseToEdit && (availablePlansForPrefill.length === 0 || !formData.applyToExpenseId))}
          className="btn btn-primary"
        >
          {loading ? "Saving..." : "Save & Add Another"}
        </button>
        <button
          onClick={() => handleSave(true)}
          disabled={loading || (prefillPayment && !expenseToEdit && (availablePlansForPrefill.length === 0 || !formData.applyToExpenseId))}
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
