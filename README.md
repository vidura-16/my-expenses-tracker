# My Expense Tracker

A personal expense tracking application built with React and Firebase. Track daily expenses, manage credit card installments, and plan your monthly budget.

## Features

### 📊 Home Dashboard
- **Daily Expense Tracking**: Add and track daily expenses with categories
- **Monthly Summary**: View total spending for the current month
- **Expenses by Category**: Visual pie chart breakdown of spending
- **Daily Target**: Set and monitor daily spending limits
- **Weekly Summary**: View expenses organized by week

### 💳 Credit Card Installments
- **Multiple Credit Cards**: Add and manage multiple credit cards
- **Installment Plans**: Create installment payment plans for purchases
- **Payment Tracking**: Track paid and pending installments
- **Add Card Payments**: Record installment payments with budget portion linking
- **Orphaned Plans Detection**: Identify installment plans without matching cards

### 📋 Plan Budget
- **Monthly Income**: Set your monthly income/salary
- **Budget Portions**: Split income into customizable budget portions (e.g., Savings, Living Expenses, Installments)
- **Expense Tracking per Portion**: Link expenses to specific budget portions
- **Visual Progress**: See spent vs remaining for each portion
- **Expense Breakdown**: Expandable dropdown to view expenses under each portion
- **PDF Reports**: Generate monthly budget summary reports

### 💰 Expense Management
- **Multiple Payment Types**: Cash, Debit, Credit
- **Expense Categories**: Food, Travel, Utility, Groceries, Petrol, Clothes, Health, Home, and more
- **Budget Portion Linking**: Associate expenses with budget portions
- **Edit & Delete**: Modify or remove existing expenses
- **Installment Payments**: Special handling for credit card installment payments

## Tech Stack

- **Frontend**: React 19
- **Backend**: Firebase (Firestore Database)
- **Authentication**: Firebase Auth (Google Sign-in)
- **Hosting**: Firebase Hosting
- **Charts**: Chart.js with react-chartjs-2
- **PDF Generation**: jsPDF

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Firebase account

### Installation

1. Clone the repository:
```bash
git clone https://github.com/vidura-16/my-expenses-tracker.git
cd my-expenses-tracker
```

2. Install dependencies:
```bash
npm install
```

3. Set up Firebase:
   - Create a Firebase project
   - Enable Firestore Database
   - Enable Google Authentication
   - Copy your Firebase config to `src/firebase.js`

4. Start the development server:
```bash
npm start
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Deployment

Build and deploy to Firebase:
```bash
npm run build
firebase deploy
```

## Project Structure

```
src/
├── components/
│   ├── BudgetPlanner.js      # Plan Budget screen
│   ├── BudgetPlanner.css
│   ├── ExpenseTracker.js     # Main app container
│   ├── ExpenseTracker.css
│   ├── InstallmentsView.js   # Credit card installments
│   ├── InstallmentsView.css
│   ├── Login.js              # Google sign-in
│   └── WeeklySummary.js      # Weekly expense view
├── screens/
│   └── AddExpense.js         # Add/Edit expense form
├── styles/
│   ├── AddExpense.css
│   └── Home.css
├── utils/
│   ├── budgetUtils.js        # Budget planner Firebase functions
│   └── expenseUtils.js       # Expense Firebase functions
├── App.js
├── firebase.js               # Firebase configuration
└── index.js
```

## License

This project is for personal use.

## Author

Vidura
