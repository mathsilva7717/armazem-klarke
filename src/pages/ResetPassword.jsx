import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Check, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleReset = async (e) => {
    e.preventDefault();
    
    if (newPassword.length < 6) {
      return toast.error('A senha deve ter pelo menos 6 caracteres.');
    }

    if (newPassword !== confirmPassword) {
      return toast.error('As senhas não coincidem.');
    }

    setLoading(true);

    try {
      await api.post('/change-password', { newPassword });
      
      // Update local storage status
      const user = JSON.parse(localStorage.getItem('armazem_user'));
      user.mustChangePassword = false;
      localStorage.setItem('armazem_user', JSON.stringify(user));
      
      toast.success('Senha atualizada com sucesso!');
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao atualizar senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'var(--bg-dark)'
    }}>
      <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ 
            width: '64px', 
            height: '64px', 
            background: 'var(--primary)', 
            borderRadius: '0', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Lock size={32} color="black" />
          </div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '2px' }}>Segurança da Conta</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px', textTransform: 'uppercase' }}>Defina uma senha pessoal para continuar</p>
        </div>

        <form onSubmit={handleReset}>
          <div className="input-group">
            <label><Lock size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Nova Senha</label>
            <input 
              type="password" 
              placeholder="Mínimo 6 caracteres" 
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          
          <div className="input-group" style={{ marginBottom: '24px' }}>
            <label><Check size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Confirmar Senha</label>
            <input 
              type="password" 
              placeholder="Repita a nova senha" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'SALVANDO...' : 'ATUALIZAR E ENTRAR'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
