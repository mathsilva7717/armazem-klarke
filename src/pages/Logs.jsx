import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Search, Calendar, User, Terminal, LogOut, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';

const Logs = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const user = JSON.parse(localStorage.getItem('armazem_user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('armazem_auth');
    localStorage.removeItem('armazem_token');
    localStorage.removeItem('armazem_user');
    toast.success('Sessão encerrada.');
    navigate('/login');
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    filterLogs();
  }, [logs, searchTerm, actionFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await api.get('/logs');
      setLogs(response.data);
    } catch (error) {
      toast.error('Erro ao carregar logs do sistema.');
    } finally {
      setLoading(false);
    }
  };

  const filterLogs = () => {
    let tempLogs = [...logs];

    // Filter by action
    if (actionFilter !== 'ALL') {
      tempLogs = tempLogs.filter(log => log.action === actionFilter);
    }

    // Filter by search term
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      tempLogs = tempLogs.filter(log => 
        (log.username && log.username.toLowerCase().includes(search)) ||
        (log.details && log.details.toLowerCase().includes(search)) ||
        (log.action && log.action.toLowerCase().includes(search))
      );
    }

    setFilteredLogs(tempLogs);
  };

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    } catch (e) {
      return dateStr;
    }
  };

  const getActionBadgeStyle = (action) => {
    switch (action) {
      case 'EXCLUIR_USUARIO':
        return {
          background: 'rgba(239, 68, 68, 0.15)',
          color: '#ef4444',
          border: '1px solid #ef4444'
        };
      case 'ALTERAR_CARGO':
      case 'CADASTRAR_USUARIO':
        return {
          background: 'rgba(245, 158, 11, 0.15)',
          color: 'var(--primary)',
          border: '1px solid var(--primary)'
        };
      case 'LOGIN':
      case 'TROCA_SENHA':
        return {
          background: 'rgba(34, 197, 94, 0.15)',
          color: '#22c55e',
          border: '1px solid #22c55e'
        };
      case 'REGISTRO_SAIDA':
        return {
          background: 'rgba(59, 130, 246, 0.15)',
          color: '#3b82f6',
          border: '1px solid #3b82f6'
        };
      case 'SALVAR_PRODUTO':
        return {
          background: 'rgba(168, 85, 247, 0.15)',
          color: '#a855f7',
          border: '1px solid #a855f7'
        };
      default:
        return {
          background: 'rgba(255, 255, 255, 0.05)',
          color: 'var(--text-muted)',
          border: '1px solid var(--border)'
        };
    }
  };

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      toast.error('Nenhum log para exportar.');
      return;
    }

    const headers = ['ID', 'Data/Hora', 'Usuário', 'Ação', 'Detalhes'];
    const rows = filteredLogs.map(log => [
      log.id,
      formatDate(log.created_at),
      log.username || 'Sistema',
      log.action,
      log.details || ''
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(';'), ...rows.map(e => e.map(val => `"${val}"`).join(';'))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `logs_sistema_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Logs exportados com sucesso!');
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
          <h2 style={{ fontSize: '1.1rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px' }}>Logs do Sistema</h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ textAlign: 'right', display: 'block' }}>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800' }}>Administrador</p>
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

      <main style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Filters Panel */}
        <section className="glass-card animate-fade-in" style={{ padding: '20px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', flex: '1', minWidth: '280px' }}>
              <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  placeholder="Pesquisar por usuário ou detalhe..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    background: '#000',
                    border: '1px solid var(--border)',
                    color: '#fff',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <select 
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  style={{
                    padding: '10px 16px',
                    background: '#000',
                    border: '1px solid var(--border)',
                    color: '#fff',
                    outline: 'none',
                    height: '100%',
                    cursor: 'pointer'
                  }}
                >
                  <option value="ALL">Todas as Ações</option>
                  <option value="LOGIN">Logins</option>
                  <option value="TROCA_SENHA">Trocas de Senha</option>
                  <option value="REGISTRO_SAIDA">Saídas de Estoque</option>
                  <option value="CADASTRAR_USUARIO">Cadastros de Usuários</option>
                  <option value="EXCLUIR_USUARIO">Exclusões de Usuários</option>
                  <option value="ALTERAR_CARGO">Alterações de Cargo</option>
                  <option value="SALVAR_PRODUTO">Cadastro de Produtos</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={fetchLogs} 
                disabled={loading}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'white',
                  padding: '10px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.85rem'
                }}
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> {loading ? 'Atualizando...' : 'Atualizar'}
              </button>

              <button 
                onClick={handleExportCSV}
                className="btn-primary"
                style={{
                  padding: '10px 16px',
                  fontSize: '0.85rem'
                }}
              >
                <FileSpreadsheet size={14} /> Exportar CSV
              </button>
            </div>
          </div>
        </section>

        {/* Logs Table */}
        <section className="glass-card animate-fade-in" style={{ padding: '32px' }}>
          <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase', fontSize: '0.9rem', letterSpacing: '1px' }}>
            <Terminal size={20} color="var(--primary)" /> Histórico de Auditoria ({filteredLogs.length})
          </h3>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', fontFamily: 'monospace' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px', color: 'var(--text-muted)', width: '180px' }}><Calendar size={12} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Data/Hora</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)', width: '150px' }}><User size={12} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Operador</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)', width: '180px' }}>Ação</th>
                  <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Carregando logs do sistema...</td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Nenhum log encontrado para os filtros selecionados.</td>
                  </tr>
                ) : (
                  filteredLogs.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.3)', hover: { background: 'rgba(255,255,255,0.01)' } }}>
                      <td data-label="Data/Hora" style={{ padding: '12px', color: 'var(--text-muted)' }}>{formatDate(log.created_at)}</td>
                      <td data-label="Operador" style={{ padding: '12px', fontWeight: '600' }}>{log.username || 'Sistema'}</td>
                      <td data-label="Ação" style={{ padding: '12px' }}>
                        <span style={{ 
                          fontSize: '0.7rem', 
                          padding: '3px 6px', 
                          fontWeight: '700', 
                          textTransform: 'uppercase',
                          ...getActionBadgeStyle(log.action)
                        }}>
                          {log.action}
                        </span>
                      </td>
                      <td data-label="Detalhes" style={{ padding: '12px', color: 'var(--text-main)' }}>{log.details}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Logs;
