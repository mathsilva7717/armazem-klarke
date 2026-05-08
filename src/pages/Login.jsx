import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, User, Lock, Box } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/login', { username, password });
      localStorage.setItem('armazem_token', response.data.token);
      localStorage.setItem('armazem_user', JSON.stringify(response.data.user));
      localStorage.setItem('armazem_auth', 'true');
      toast.success(`Bem-vindo, ${response.data.user.name}!`);
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao conectar ao servidor.');
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
            <Box size={32} color="black" />
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '2px' }}>ARMAZEM CONTROLE</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px', textTransform: 'uppercase' }}>Sistema de Gestão de Saídas</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label><User size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Usuário</label>
            <input 
              type="text" 
              placeholder="Digite seu usuário" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          
          <div className="input-group">
            <label><Lock size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Senha</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '8px' }} disabled={loading}>
            {loading ? 'Entrando...' : <><LogIn size={18} /> Entrar no Sistema</>}
          </button>
        </form>

        <div style={{ 
          marginTop: '40px', 
          paddingTop: '20px', 
          borderTop: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
            <Box size={14} />
            <span style={{ fontSize: '0.7rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
              Klarke Solutions
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: '500' }}>
            Matheus Silva
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
