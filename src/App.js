import React, { useState, useEffect } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import Login from "./components/Login";
import ExpenseTracker from "./components/ExpenseTracker";
import "./App.css";

function App() {
  const [uid, setUid] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUid(user.uid);
      } else {
        setUid(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUid(null);
    } catch (err) {
      console.error("Error logging out:", err);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: "center" }}>
        <h2>Loading...</h2>
      </div>
    );
  }

  // Show login page if not signed in
  if (!uid) {
    return <Login onLoginSuccess={setUid} />;
  }

  return (
    <div className="app-container">
      <div className="app-header">
        <h1 className="app-title">My Expense Tracker</h1>
        <button onClick={handleLogout} className="btn-logout">
          Logout
        </button>
      </div>
      <div className="app-content">
        <ExpenseTracker uid={uid} />
      </div>
    </div>
  );
}

export default App;