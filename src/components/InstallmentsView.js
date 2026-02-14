import React from 'react';
import { formatCurrency } from '../utils/expenseUtils';
import './InstallmentsView.css';

const InstallmentsView = ({ 
  creditCards = [], 
  allExpenses = [], 
  installmentsData = { pending: [], overdue: [], totalPending: 0, totalOverdue: 0 },
  onAddCreditCard,
  onAddCardPayment,
  onDeleteCreditCard,
  onMarkInstallmentPaid,
  onDeleteInstallmentPlan
}) => {
  // Group installments by credit card and then by expense (plan)
  const groupInstallmentsByCard = () => {
    const cardGroups = {};

    // Initialize groups for all credit cards
    creditCards.forEach(card => {
      cardGroups[card.id] = {
        card,
        installments: [], // raw installments
        plans: [], // grouped by expense
        totalOriginal: 0,
        totalPaid: 0,
        totalRemaining: 0
      };
    });

    // Combine pending, overdue and paid installments for accurate grouping and totals
    const allInstallments = [
      ...(installmentsData.pending || []),
      ...(installmentsData.overdue || []),
      ...(installmentsData.paid || [])
    ];

    // Attach expense to each installment and group into card buckets
    allInstallments.forEach(installment => {
      const expense = allExpenses.find(exp => exp.id === installment.expenseId);
      if (expense && expense.creditData && expense.creditData.cardId) {
        const matchingCard = creditCards.find(card => 
          card.id === expense.creditData.cardId || 
          card.cardId === expense.creditData.cardId
        );

        if (matchingCard && cardGroups[matchingCard.id]) {
          const group = cardGroups[matchingCard.id];
          group.installments.push({
            ...installment,
            expense,
            nextDueDate: getNextDueDate(installment),
            isOverdue: isInstallmentOverdue(installment)
          });
        }
      }
    });

    // Now group installments into plans by expenseId and compute totals
    Object.values(cardGroups).forEach(group => {
      const plansMap = {};
      group.installments.forEach(inst => {
        const key = inst.expenseId || (inst.expense && inst.expense.id);
        if (!plansMap[key]) {
          plansMap[key] = {
            expense: inst.expense,
            installments: [],
            monthlyAmount: inst.amount || 0,
            totalInstallments: inst.totalInstallments || (inst.expense?.creditData?.totalInstallments || 0),
            paidAmount: 0,
            paidCount: 0,
            nextDueDate: null,
            remainingMonths: 0
          };
        }

        plansMap[key].installments.push(inst);
        if (inst.isPaid) {
          plansMap[key].paidAmount += inst.amount || 0;
          plansMap[key].paidCount += 1;
        }
      });

      // Compute plan-level metadata
      group.plans = Object.values(plansMap).map(plan => {
        // sort installments by dueDate
        plan.installments.sort((a, b) => (a.nextDueDate || '') > (b.nextDueDate || '') ? 1 : -1);
        const nextUnpaid = plan.installments.find(i => !i.isPaid);
        plan.nextDueDate = nextUnpaid ? nextUnpaid.nextDueDate : (plan.installments[plan.installments.length - 1]?.nextDueDate || null);
        plan.remainingMonths = plan.installments.filter(i => !i.isPaid).length;
        plan.totalAmount = plan.expense?.amount || (plan.monthlyAmount * plan.totalInstallments);
        plan.remainingAmount = plan.totalAmount - plan.paidAmount;
        return plan;
      });

      // Compute card totals from plans
      group.totalOriginal = group.plans.reduce((s, p) => s + (p.totalAmount || 0), 0);
      group.totalPaid = group.plans.reduce((s, p) => s + (p.paidAmount || 0), 0);
      group.totalRemaining = group.totalOriginal - group.totalPaid;

      // Sort plans by next due date (soonest first)
      group.plans.sort((a, b) => {
        const da = a.nextDueDate || '';
        const db = b.nextDueDate || '';
        return da.localeCompare(db);
      });
    });

    return cardGroups;
  };

  const getNextDueDate = (installment) => {
    // Use the installment's dueDate directly
    return installment.dueDate;
  };

  const isInstallmentOverdue = (installment) => {
    const dueDate = new Date(installment.dueDate);
    const today = new Date();
    return dueDate < today && !installment.isPaid;
  };
  
  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getProgressPercentage = (paid, total) => {
    return total > 0 ? Math.round((paid / total) * 100) : 0;
  };

  const cardGroups = groupInstallmentsByCard();

  return (
    <div className="installments-container">
      <div className="installments-header">
        <h2>Credit Card Installments</h2>
        <div className="installments-header-actions">
          <button className="btn btn-primary" onClick={onAddCreditCard}>
            Add Credit Card
          </button>
        </div>
      </div>

      {creditCards.length === 0 ? (
        <div className="no-cards-message">
          <p>No credit cards added yet. Add a credit card to track installment payments.</p>
        </div>
      ) : (
        <div className="cards-list">
          {creditCards.map(card => {
            const cardData = cardGroups[card.id] || { plans: [] };
            const hasInstallments = cardData && cardData.plans && cardData.plans.length > 0;
            
            return (
              <div key={card.id} className="card-section">
                <div className="card-header">
                  <div className="card-info">
                    <h3>{card.name} {card.limit ? `- ${formatCurrency(card.limit)}` : ''}</h3>
                    <p className="card-details">
                      {card.cardId ? card.cardId : '•••• •••• ••••'} {card.bank ? `| ${card.bank}` : ''}
                    </p>
                  </div>
                  <div className="card-actions">
                    {onDeleteCreditCard && (
                      <button 
                        className="btn btn-danger btn-small"
                        onClick={() => onDeleteCreditCard(card.id)}
                      >
                        Delete Card
                      </button>
                    )}
                  </div>
                </div>

                {hasInstallments ? (
                  <div className="card-summary">
                    <div className="summary-stats">
                      <div className="stat-item">
                        <span className="stat-label">Total Amount</span>
                        <span className="stat-value">{formatCurrency(cardData.totalOriginal)}</span>
                      </div>
                      <div className="stat-item paid">
                        <span className="stat-label">Paid</span>
                        <span className="stat-value paid">{formatCurrency(cardData.totalPaid)}</span>
                      </div>
                      <div className="stat-item remaining">
                        <span className="stat-label">Remaining</span>
                        <span className="stat-value remaining">{formatCurrency(cardData.totalRemaining)}</span>
                      </div>
                    </div>
                    
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${getProgressPercentage(cardData.totalPaid, cardData.totalOriginal)}%` }}
                      />
                    </div>
                    <p className="progress-text">
                      {getProgressPercentage(cardData.totalPaid, cardData.totalOriginal)}% completed
                    </p>

                    <div className="installments-list">
                      <h4>Active Installments</h4>
                      {cardData.plans.map((plan, idx) => {
                        const pct = getProgressPercentage(plan.paidAmount, plan.totalAmount);
                        return (
                          <div key={idx} className={`installment-plan ${plan.nextDueDate && new Date(plan.nextDueDate) < new Date() ? 'overdue' : ''}`}>
                            <div className="plan-header">
                              <div className="plan-info">
                                <h5>{plan.expense?.note || 'Installment Plan'}</h5>
                                <p className="plan-meta">{plan.expense?.category} • {formatDate(plan.expense?.date)}</p>
                              </div>
                              <div className="plan-actions-header">
                                <div className="plan-amount">
                                  <span className="monthly-amount">{formatCurrency(plan.monthlyAmount)}/month</span>
                                </div>
                                <div className="plan-actions">
                                  {onDeleteInstallmentPlan && (
                                    <button 
                                      type="button"
                                      className="btn-delete-small"
                                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDeleteInstallmentPlan(plan.expense); }}
                                      title="Delete installment plan"
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="plan-progress">
                              <div className="progress-info">
                                <span>Paid: {plan.paidCount}/{plan.totalInstallments} installments</span>
                                <span className={plan.nextDueDate && new Date(plan.nextDueDate) < new Date() ? 'overdue-text' : ''}>
                                  Next due: {plan.nextDueDate ? formatDate(plan.nextDueDate) : '—'}{plan.nextDueDate && new Date(plan.nextDueDate) < new Date() ? ' (Overdue)' : ''}
                                </span>
                              </div>

  

                              <div className="mini-progress-bar">
                                <div className="mini-progress-fill" style={{ width: `${pct}%` }} />
                              </div>

                              <div className="remaining-info">
                                <span>Remaining: {plan.remainingMonths} months</span>
                                <span>{formatCurrency(plan.remainingAmount)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="no-installments">
                    <p>No installment payments for this card yet.</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default InstallmentsView;