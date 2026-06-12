import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Users as UsersIcon, ArrowLeft, Trash2, User, Lock, Tag, LogOut, KeyRound, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';

const Users = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    role: 'operator'
  });

  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null
  });

  const showConfirm = (title, message, onConfirm) => {
    setConfirmConfig({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const user = JSON.parse(localStorage.getItem('armazem_user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('armazem_auth');
    localStorage.removeItem('armazem_token');
    localStorage.removeItem('armazem_user');
    toast.success('Sessão encerrada.');
    navigate('/login');
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar usuários.');
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEditClick = (u) => {
    setEditingUserId(u.id);
    setFormData({
      username: u.username,
      name: u.name,
      password: '',
      role: u.role || 'operator'
    });
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setFormData({ username: '', password: '', name: '', role: 'operator' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingUserId) {
        await api.put(`/users/${editingUserId}`, {
          username: formData.username,
          name: formData.name
        });
        toast.success('Usuário atualizado com sucesso!');
        setEditingUserId(null);
      } else {
        await api.post('/users', formData);
        toast.success('Usuário cadastrado com sucesso!');
      }
      setFormData({ username: '', password: '', name: '', role: 'operator' });
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.error || `Erro ao ${editingUserId ? 'atualizar' : 'cadastrar'} usuário.`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id) => {
    const targetUser = users.find(u => u.id === id);
    showConfirm(
      'Confirmar Exclusão',
      `Tem certeza que deseja excluir o operador "${targetUser?.name || targetUser?.username}"? Esta ação não pode ser desfeita.`,
      async () => {
        try {
          await api.delete(`/users/${id}`);
          toast.success('Usuário excluído!');
          fetchUsers();
        } catch (error) {
          toast.error(error.response?.data?.error || 'Erro ao excluir usuário.');
        }
      }
    );
  };

  const handleResetPassword = (id) => {
    const targetUser = users.find(u => u.id === id);
    showConfirm(
      'Resetar Senha',
      `Tem certeza que deseja resetar a senha do operador "${targetUser?.name || targetUser?.username}" para o padrão "123456"? Ele precisará alterá-la no próximo login.`,
      async () => {
        try {
          await api.post(`/users/${id}/reset-password`);
          toast.success('Senha resetada para 123456!');
          fetchUsers();
        } catch (error) {
          toast.error(error.response?.data?.error || 'Erro ao resetar senha.');
        }
      }
    );
  };

  const handleCycleRole = (id, currentRole) => {
    const targetUser = users.find(u => u.id === id);
    if (targetUser && targetUser.username === 'admin') {
      toast.error('O cargo do administrador principal não pode ser alterado.');
      return;
    }

    let newRole = 'operator';
    if (currentRole === 'operator') newRole = 'expedicao';
    else if (currentRole === 'expedicao') newRole = 'estoque';
    else if (currentRole === 'estoque') newRole = 'gerencia';
    else if (currentRole === 'gerencia') newRole = 'admin';
    else if (currentRole === 'admin') newRole = 'operator';

    const roleNames = {
      operator: 'Operador',
      expedicao: 'Expedição',
      estoque: 'Estoque',
      gerencia: 'Gerência',
      admin: 'Administrador'
    };

    showConfirm(
      'Alterar Cargo',
      `Deseja alterar o cargo de "${targetUser?.name || targetUser?.username}" para "${roleNames[newRole]}"?`,
      async () => {
        try {
          await api.put(`/users/${id}/role`, { role: newRole });
          toast.success('Cargo atualizado com sucesso!');
          fetchUsers();
        } catch (error) {
          toast.error(error.response?.data?.error || 'Erro ao atualizar cargo.');
        }
      }
    );
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
            {editingUserId ? <Pencil size={20} color="var(--primary)" /> : <UserPlus size={20} color="var(--primary)" />}
            {editingUserId ? 'Editar Operador' : 'Novo Operador'}
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
                disabled={editingUserId && formData.username === 'admin'}
              />
            </div>

            {!editingUserId && (
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
            )}

            {!editingUserId && (
              <div className="input-group" style={{ margin: '16px 0 24px' }}>
                <label><User size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Cargo</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#000',
                    border: '1px solid var(--border)',
                    color: '#fff',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="operator">Operador (Padrão)</option>
                  <option value="expedicao">Expedição (Visualização + Aceitar Pedidos)</option>
                  <option value="estoque">Estoque (Visualização + Finalizar Pedidos)</option>
                  <option value="gerencia">Gerência (Criar Pedidos de Compra)</option>
                  <option value="admin">Administrador (Controle Total)</option>
                </select>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: editingUserId ? '24px' : '0' }}>
              <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? (editingUserId ? 'Salvando...' : 'Cadastrando...') : (
                  editingUserId ? <><Pencil size={18} /> Salvar Alterações</> : <><UserPlus size={18} /> Cadastrar Operador</>
                )}
              </button>

              {editingUserId && (
                <button 
                  type="button" 
                  onClick={handleCancelEdit}
                  style={{
                    width: '100%',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)',
                    padding: '12px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    letterSpacing: '1px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="glass-card animate-fade-in" style={{ padding: '32px' }}>
          <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase', fontSize: '0.9rem', letterSpacing: '1px' }}>
            <UsersIcon size={20} color="var(--primary)" /> Operadores Ativos
          </h3>

          <div className="hide-scrollbar" style={{ overflowX: 'auto' }}>
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
                        onClick={() => u.username !== 'admin' && handleCycleRole(u.id, u.role || (u.is_admin ? 'admin' : 'operator'))}
                        title={u.username === 'admin' ? '' : 'Clique para alterar o cargo deste usuário'}
                        style={{ 
                          fontSize: '0.75rem', 
                          padding: '4px 8px', 
                          fontWeight: '700', 
                          textTransform: 'uppercase',
                          background: (u.role === 'admin' || (!u.role && u.is_admin))
                            ? 'rgba(245, 158, 11, 0.15)'
                            : u.role === 'expedicao'
                              ? 'rgba(59, 130, 246, 0.15)'
                              : u.role === 'estoque'
                                ? 'rgba(34, 197, 94, 0.15)'
                                : u.role === 'gerencia'
                                  ? 'rgba(168, 85, 247, 0.15)'
                                  : 'rgba(255, 255, 255, 0.05)',
                          color: (u.role === 'admin' || (!u.role && u.is_admin))
                            ? 'var(--primary)'
                            : u.role === 'expedicao'
                              ? '#3b82f6'
                              : u.role === 'estoque'
                                ? '#22c55e'
                                : u.role === 'gerencia'
                                  ? '#a855f7'
                                  : 'var(--text-muted)',
                          border: (u.role === 'admin' || (!u.role && u.is_admin))
                            ? '1px solid var(--primary)'
                            : u.role === 'expedicao'
                              ? '1px solid #3b82f6'
                              : u.role === 'estoque'
                                ? '1px solid #22c55e'
                                : u.role === 'gerencia'
                                  ? '1px solid #a855f7'
                                  : '1px solid var(--border)',
                          cursor: u.username === 'admin' ? 'default' : 'pointer',
                          userSelect: 'none',
                          transition: 'all 0.2s ease',
                          display: 'inline-block'
                        }}
                        onMouseEnter={(e) => {
                          if (u.username !== 'admin') {
                            const r = u.role || (u.is_admin ? 'admin' : 'operator');
                            e.currentTarget.style.background = r === 'admin'
                              ? 'rgba(245, 158, 11, 0.3)'
                              : r === 'expedicao'
                                ? 'rgba(59, 130, 246, 0.3)'
                                : r === 'estoque'
                                  ? 'rgba(34, 197, 94, 0.3)'
                                  : r === 'gerencia'
                                    ? 'rgba(168, 85, 247, 0.3)'
                                    : 'rgba(255, 255, 255, 0.15)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (u.username !== 'admin') {
                            const r = u.role || (u.is_admin ? 'admin' : 'operator');
                            e.currentTarget.style.background = r === 'admin'
                              ? 'rgba(245, 158, 11, 0.15)'
                              : r === 'expedicao'
                                ? 'rgba(59, 130, 246, 0.15)'
                                : r === 'estoque'
                                  ? 'rgba(34, 197, 94, 0.15)'
                                  : r === 'gerencia'
                                    ? 'rgba(168, 85, 247, 0.15)'
                                    : 'rgba(255, 255, 255, 0.05)';
                          }
                        }}
                      >
                        {u.role === 'admin' || (!u.role && u.is_admin) 
                          ? 'Administrador' 
                          : u.role === 'expedicao' 
                            ? 'Expedição' 
                            : u.role === 'estoque' 
                              ? 'Estoque' 
                              : u.role === 'gerencia' 
                                ? 'Gerência' 
                                : 'Operador'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', display: 'flex', gap: '16px', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <button 
                        onClick={() => handleEditClick(u)}
                        style={{ 
                          background: 'transparent', 
                          border: 'none', 
                          color: 'var(--primary)', 
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title="Editar Operador"
                      >
                        <Pencil size={16} />
                      </button>

                      {u.username !== 'admin' && (
                        <>
                          <button 
                            onClick={() => handleResetPassword(u.id)}
                            style={{ 
                              background: 'transparent', 
                              border: 'none', 
                              color: 'var(--primary)', 
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            title="Resetar Senha para 123456"
                          >
                            <KeyRound size={16} />
                          </button>
                          
                          <button 
                            onClick={() => handleDelete(u.id)}
                            style={{ 
                              background: 'transparent', 
                              border: 'none', 
                              color: '#ef4444', 
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            title="Excluir Operador"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      {confirmConfig.isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="glass-card animate-fade-in" style={{
            maxWidth: '400px',
            width: '100%',
            padding: '32px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            boxShadow: '10px 10px 0px rgba(0, 0, 0, 1)'
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '900', textTransform: 'uppercase', marginBottom: '16px', color: 'var(--primary)', letterSpacing: '1px' }}>
              {confirmConfig.title}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '28px', lineHeight: '1.5' }}>
              {confirmConfig.message}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                style={{
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                  padding: '10px 20px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  letterSpacing: '1px'
                }}
              >
                Cancelar
              </button>
              <button 
                onClick={confirmConfig.onConfirm}
                className="btn-primary"
                style={{
                  padding: '10px 20px',
                  fontSize: '0.75rem',
                  letterSpacing: '1px'
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
