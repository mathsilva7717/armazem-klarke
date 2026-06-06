import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Users as UsersIcon, ArrowLeft, Trash2, User, Lock, Tag, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';

const Users = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    is_admin: false
  });

  const user = JSON.parse(localStorage.getItem('armazem_user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('armazem_auth');
    localStorage.removeItem('armazem_token');
    localStorage.removeItem('armazem_user');
    toast.success('Sessão encerrada.');
    navigate('/login');
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (error) {
      toast.error('Erro ao carregar usuários.');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/users', formData);
      toast.success('Usuário cadastrado com sucesso!');
      setFormData({ username: '', password: '', name: '', is_admin: false });
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao cadastrar usuário.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir este operador?')) {
      try {
        await api.delete(`/users/${id}`);
        toast.success('Usuário excluído!');
        fetchUsers();
      } catch (error) {
        toast.error(error.response?.data?.error || 'Erro ao excluir usuário.');
      }
    }
  };

  const handleToggleRole = async (id, currentIsAdmin) => {
    const targetUser = users.find(u => u.id === id);
    if (targetUser && targetUser.username === 'admin') {
      toast.error('O cargo do administrador principal não pode ser alterado.');
      return;
    }

    const newIsAdmin = !currentIsAdmin;
    const confirmMsg = newIsAdmin 
      ? `Deseja promover o usuário "${targetUser?.name || targetUser?.username}" para Administrador?` 
      : `Deseja alterar o cargo de "${targetUser?.name || targetUser?.username}" para Operador?`;

    if (window.confirm(confirmMsg)) {
      try {
        await api.put(`/users/${id}/role`, { is_admin: newIsAdmin });
        toast.success('Cargo atualizado com sucesso!');
        fetchUsers();
      } catch (error) {
        toast.error(error.response?.data?.error || 'Erro ao atualizar cargo.');
      }
    }
  };

  return (
    <div style={{ minHeight: '100vh', padding: '20px' }}>
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        maxWidth: '1200px', 
        margin: '0 auto 16px',
        padding: '16px 0',
        borderBottom: '2px solid var(--primary)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={() => navigate('/')}
            style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <ArrowLeft size={24} />
          </button>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px' }}>Gestão de Usuários</h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ textAlign: 'right', display: 'block' }}>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800' }}>Operador</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: '700' }}>{user.name || user.username}</p>
          </div>

          <button 
            onClick={handleLogout} 
            style={{ 
              background: 'transparent', 
              color: 'var(--text-muted)', 
              border: '1px solid var(--border)', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.8rem',
              padding: '8px 12px',
              fontWeight: '600'
            }}
          >
            Sair <LogOut size={16} />
          </button>
        </div>
      </header>

      <main style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
        gap: '24px' 
      }}>
        <section className="glass-card animate-fade-in" style={{ padding: '32px', height: 'fit-content' }}>
          <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase', fontSize: '0.9rem', letterSpacing: '1px' }}>
            <UserPlus size={20} color="var(--primary)" /> Novo Operador
          </h3>
          
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label><Tag size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Nome Completo</label>
              <input 
                name="name"
                type="text" 
                placeholder="Ex: Matheus Silva" 
                value={formData.name}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="input-group">
              <label><User size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Usuário (Login)</label>
              <input 
                name="username"
                type="text" 
                placeholder="Ex: matheus.silva" 
                value={formData.username}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="input-group">
              <label><Lock size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Senha Inicial</label>
              <input 
                name="password"
                type="password" 
                placeholder="••••••••" 
                value={formData.password}
                onChange={handleInputChange}
                required
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '16px 0 24px' }}>
              <input 
                name="is_admin"
                type="checkbox" 
                id="is_admin"
                checked={formData.is_admin}
                onChange={(e) => setFormData(prev => ({ ...prev, is_admin: e.target.checked }))}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
              />
              <label htmlFor="is_admin" style={{ cursor: 'pointer', userSelect: 'none', margin: 0, fontWeight: '600', fontSize: '0.85rem', display: 'inline-block', color: 'var(--text-main)' }}>
                Tornar este usuário Administrador
              </label>
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Cadastrando...' : <><UserPlus size={18} /> Cadastrar Operador</>}
            </button>
          </form>
        </section>

        <section className="glass-card animate-fade-in" style={{ padding: '32px' }}>
          <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase', fontSize: '0.9rem', letterSpacing: '1px' }}>
            <UsersIcon size={20} color="var(--primary)" /> Operadores Ativos
          </h3>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Nome</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Usuário</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Cargo</th>
                  <th style={{ padding: '12px' }}></th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.5)' }}>
                    <td data-label="Nome" style={{ padding: '12px', fontWeight: '600' }}>{u.name}</td>
                    <td data-label="Usuário" style={{ padding: '12px' }}>{u.username}</td>
                    <td data-label="Cargo" style={{ padding: '12px' }}>
                      <span 
                        onClick={() => u.username !== 'admin' && handleToggleRole(u.id, u.is_admin)}
                        title={u.username === 'admin' ? '' : 'Clique para alterar o cargo deste usuário'}
                        style={{ 
                          fontSize: '0.75rem', 
                          padding: '4px 8px', 
                          fontWeight: '700', 
                          textTransform: 'uppercase',
                          background: u.is_admin ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                          color: u.is_admin ? 'var(--primary)' : 'var(--text-muted)',
                          border: u.is_admin ? '1px solid var(--primary)' : '1px solid var(--border)',
                          cursor: u.username === 'admin' ? 'default' : 'pointer',
                          userSelect: 'none',
                          transition: 'all 0.2s ease',
                          display: 'inline-block'
                        }}
                        onMouseEnter={(e) => {
                          if (u.username !== 'admin') {
                            e.currentTarget.style.background = u.is_admin ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255, 255, 255, 0.15)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (u.username !== 'admin') {
                            e.currentTarget.style.background = u.is_admin ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.05)';
                          }
                        }}
                      >
                        {u.is_admin ? 'Administrador' : 'Operador'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      {u.username !== 'admin' && (
                        <button 
                          onClick={() => handleDelete(u.id)}
                          style={{ 
                            background: 'transparent', 
                            border: 'none', 
                            color: '#ef4444', 
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            width: '100%'
                          }}
                          title="Excluir Operador"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Users;
