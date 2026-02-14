// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock firebase modules to avoid initializing real Firebase in tests
jest.mock('./firebase', () => ({
  db: {},
  auth: {},
  firebaseApp: {}
}));

jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn(),
  getDocs: jest.fn(),
  getDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  doc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  collection: jest.fn(),
  writeBatch: jest.fn(),
  serverTimestamp: jest.fn()
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({})),
  onAuthStateChanged: jest.fn((auth, cb) => { cb(null); return () => {}; })
}));
