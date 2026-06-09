import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import StockExit from './pages/StockExit';
import Users from './pages/Users';
import Labels from './pages/Labels';
import ProductSearch from './pages/ProductSearch';
import ResetPassword from './pages/ResetPassword';
import PurchaseOrder from './pages/PurchaseOrder';
import DefectLabels from './pages/DefectLabels';
import Logs from './pages/Logs';

function App() {
  useEffect(() => {
    const checkTokenExpiration = () => {
      const token = localStorage.getItem('armazem_token');
      if (!token) return;

      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        const exp = JSON.parse(jsonPayload).exp;
        
        if (Date.now() >= exp * 1000) {
          localStorage.removeItem('armazem_auth');
          localStorage.removeItem('armazem_token');
          localStorage.removeItem('armazem_user');
          window.location.href = '/login?inactive=true';
        }
      } catch (err) {
        console.error('Erro de decodificação do token:', err);
      }
    };

    checkTokenExpiration();
    const interval = setInterval(checkTokenExpiration, 5000);
    return () => clearInterval(interval);
  }, []);

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
      setTimeout(() => {
        toast.error('Somente usuários administradores têm acesso.');
      }, 0);
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
          path="/logs" 
          element={
            <ProtectedRoute requireAdmin={true}>
              <Logs />
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
