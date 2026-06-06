import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import StockExit from './pages/StockExit';
import Users from './pages/Users';
import Labels from './pages/Labels';
import ProductSearch from './pages/ProductSearch';
import ResetPassword from './pages/ResetPassword';
import PurchaseOrder from './pages/PurchaseOrder';
import DefectLabels from './pages/DefectLabels';

function App() {
  // Simple auth check mock
  const isAuthenticated = () => {
    return localStorage.getItem('armazem_auth') === 'true';
  };

  const ProtectedRoute = ({ children, allowReset = false, requireAdmin = false }) => {
    if (!isAuthenticated()) {
      return <Navigate to="/login" replace />;
    }
    const user = JSON.parse(localStorage.getItem('armazem_user') || '{}');
    if (user.mustChangePassword && !allowReset) {
      return <Navigate to="/reset-password" replace />;
    }
    if (!user.mustChangePassword && allowReset) {
      return <Navigate to="/" replace />;
    }
    if (requireAdmin && !user.isAdmin) {
      return <Navigate to="/" replace />;
    }
    return children;
  };

  return (
    <Router>
      <Toaster position="top-right" toastOptions={{
        style: {
          background: '#1e293b',
          color: '#fff',
          border: '1px solid #334155',
        }
      }} />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route 
          path="/reset-password" 
          element={
            <ProtectedRoute allowReset={true}>
              <ResetPassword />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/saidas" 
          element={
            <ProtectedRoute>
              <StockExit />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/users" 
          element={
            <ProtectedRoute requireAdmin={true}>
              <Users />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/labels" 
          element={
            <ProtectedRoute>
              <Labels />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/search" 
          element={
            <ProtectedRoute>
              <ProductSearch />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/purchase-order" 
          element={
            <ProtectedRoute>
              <PurchaseOrder />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/defect-labels" 
          element={
            <ProtectedRoute>
              <DefectLabels />
            </ProtectedRoute>
          } 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
