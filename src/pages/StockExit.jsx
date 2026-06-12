import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Package, Hash, ShoppingBag, Calendar, Download, Plus, Trash2, Users, Printer, Search, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';

const StockExit = () => {
  const navigate = useNavigate();
  const [exits, setExits] = useState([]);
  const [filterDates, setFilterDates] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [filterStore, setFilterStore] = useState('');
  const [formData, setFormData] = useState({
    sku: '',
    quantity: '',
    unit_price: '',
    store: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [showHistory, setShowHistory] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const stores = [
    'LOJA TUDO 10 OU 20 - PRAIA GRANDE',
    'LOJA TUDO 10 OU 20 - SÃO VICENTE'
  ];

  const user = JSON.parse(localStorage.getItem('armazem_user') || '{}');

  useEffect(() => {
    fetchExits();
  }, []);

  const fetchExits = async () => {
    try {
      const response = await api.get('/exits');
      setExits(response.data);
    } catch (error) {
      toast.error('Erro ao carregar histórico.');
    }
  };

  const filteredExits = exits.filter(e => {
    const exitDate = e.exit_date;
    const matchDate = exitDate >= filterDates.start && exitDate <= filterDates.end;
    const matchStore = filterStore === '' || e.store === filterStore;
    return matchDate && matchStore;
  });

  // Paginação
  const totalPages = Math.ceil(filteredExits.length / itemsPerPage);
  const paginatedExits = filteredExits.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleLogout = () => {
    localStorage.removeItem('armazem_auth');
    localStorage.removeItem('armazem_token');
    localStorage.removeItem('armazem_user');
    toast.success('Sessão encerrada.');
    navigate('/login');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/exits', formData);
      const newEntry = {
        ...response.data,
        operator_name: user.name || user.username
      };
      setExits([newEntry, ...exits]);
      setFormData({
        sku: '',
        quantity: '',
        unit_price: '',
        store: formData.store,
        date: formData.date
      });
      
      // Haptic feedback for mobile
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
      
      toast.success('Saída registrada com sucesso!');
      fetchExits();
    } catch (error) {
      toast.error('Erro ao registrar saída.');
    }
  };

  const removeExit = (id) => {
    setExits(exits.filter(e => e.id !== id));
    toast.error('Registro removido.');
  };

  const exportToCSV = () => {
    if (filteredExits.length === 0) {
      toast.error('Não há dados filtrados para exportar.');
      return;
    }

    // Ordenar por loja e depois por data para facilitar a leitura
    const sortedExits = [...filteredExits].sort((a, b) => {
      if (a.store !== b.store) {
        return a.store.localeCompare(b.store);
      }
      return new Date(b.exit_date) - new Date(a.exit_date);
    });

    const headers = ['ID', 'Loja', 'SKU', 'Quantidade', 'Valor Unit.', 'Valor Total', 'Data', 'Operador'];
    // BOM para o Excel reconhecer acentos e caracteres especiais (UTF-8)
    const BOM = '\uFEFF';
    const csvContent = BOM + [
      headers.join(';'),
      ...sortedExits.map(e => [
        e.id, 
        `"${e.store}"`,
        e.sku, 
        e.quantity, 
        (e.unit_price || 0).toFixed(2).replace('.', ','),
        ((e.quantity || 0) * (e.unit_price || 0)).toFixed(2).replace('.', ','),
        e.exit_date, 
        `"${e.operator_name || 'Admin'}"`
      ].join(';'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_saidas_por_loja_${filterDates.start}_ate_${filterDates.end}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success('Planilha organizada por loja baixada!');
  };

  return (
    <div style={{ minHeight: '100vh', padding: '20px' }}>
      {/* Header */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        maxWidth: '1200px', 
        margin: '0 auto 16px',
        padding: '16px 0',
        borderBottom: '2px solid var(--primary)',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={() => navigate('/')}
            style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <ArrowLeft size={24} />
          </button>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px' }}>Saída de Estoque</h2>
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
        gridTemplateColumns: showHistory ? 'repeat(auto-fit, minmax(320px, 1fr))' : '1fr', 
        gap: '24px',
        justifyItems: 'center'
      }}>
        {/* Form Column */}
        <section className="glass-card animate-fade-in" style={{ padding: '32px', height: 'fit-content', width: '100%', maxWidth: '500px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Plus size={20} color="var(--primary)" /> Nova Saída
            </h3>
            <button 
              onClick={() => setShowHistory(!showHistory)}
              style={{ 
                background: 'transparent', 
                border: '1px solid var(--border)', 
                color: 'var(--text-muted)', 
                padding: '6px 12px', 
                fontSize: '0.7rem', 
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Package size={14} /> {showHistory ? 'Ocultar Histórico' : 'Ver Histórico'}
            </button>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label><Hash size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> SKU do Produto</label>
              <input 
                name="sku"
                type="text" 
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Ex: 123456" 
                value={formData.sku}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="input-group">
              <label><Package size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Quantidade</label>
              <input 
                name="quantity"
                type="number" 
                inputMode="numeric"
                placeholder="0" 
                value={formData.quantity}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="input-group">
              <label><Plus size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Valor Unitário (R$)</label>
              <input 
                name="unit_price"
                type="number" 
                step="0.01"
                inputMode="decimal"
                placeholder="0,00" 
                value={formData.unit_price}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="input-group">
              <label><ShoppingBag size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Loja de Destino</label>
              <select name="store" value={formData.store} onChange={handleInputChange} required>
                <option value="">Selecione a loja</option>
                {stores.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="input-group">
              <label><Calendar size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Data</label>
              <input 
                name="date"
                type="date" 
                value={formData.date}
                onChange={handleInputChange}
                onClick={(e) => { try { e.target.showPicker(); } catch (err) {} }}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="submit" className="btn-primary" style={{ flex: 2 }}>
                <Plus size={18} /> Registrar
              </button>
              <button 
                type="button" 
                onClick={() => setFormData({ sku: '', quantity: '', unit_price: '', store: '', date: new Date().toISOString().split('T')[0] })}
                className="btn-primary" 
                style={{ flex: 1, background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              >
                Limpar
              </button>
            </div>
          </form>
        </section>

        {/* Table Column */}
        {showHistory && (
          <section className="glass-card animate-fade-in" style={{ padding: '32px', animationDelay: '0.1s', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Package size={20} color="var(--primary)" /> Histórico de Saídas
              </h3>
              <button onClick={exportToCSV} className="btn-primary" style={{ background: 'transparent', color: 'var(--primary)', border: '1px solid var(--primary)', padding: '8px 16px', fontSize: '0.8rem' }}>
                <Download size={16} /> Exportar Planilha
              </button>
            </div>

            {/* FILTRO DE DATAS E LOJA */}
            <div style={{ 
              display: 'flex', 
              gap: '12px', 
              marginBottom: '24px', 
              padding: '16px', 
              background: 'rgba(255,255,255,0.03)', 
              border: '1px solid var(--border)',
              borderRadius: '4px',
              alignItems: 'flex-end',
              flexWrap: 'wrap'
            }}>
              <div style={{ flex: 1, minWidth: '140px' }}>
                <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: '800' }}>DE:</label>
                <input 
                  type="date" 
                  value={filterDates.start}
                  onChange={(e) => setFilterDates({...filterDates, start: e.target.value})}
                  onClick={(e) => { try { e.target.showPicker(); } catch (err) {} }}
                  style={{ background: '#111', border: '1px solid var(--border)', color: '#fff', padding: '8px', width: '100%', fontSize: '0.8rem' }}
                />
              </div>
              <div style={{ flex: 1, minWidth: '140px' }}>
                <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: '800' }}>ATÉ:</label>
                <input 
                  type="date" 
                  value={filterDates.end}
                  onChange={(e) => setFilterDates({...filterDates, end: e.target.value})}
                  onClick={(e) => { try { e.target.showPicker(); } catch (err) {} }}
                  style={{ background: '#111', border: '1px solid var(--border)', color: '#fff', padding: '8px', width: '100%', fontSize: '0.8rem' }}
                />
              </div>
              <div style={{ flex: 1, minWidth: '180px' }}>
                <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: '800' }}>FILTRAR POR LOJA:</label>
                <select 
                  value={filterStore}
                  onChange={(e) => setFilterStore(e.target.value)}
                  style={{ background: '#111', border: '1px solid var(--border)', color: '#fff', padding: '8px', width: '100%', fontSize: '0.8rem' }}
                >
                  <option value="">TODAS AS LOJAS</option>
                  {stores.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <button 
                onClick={fetchExits}
                style={{ background: 'var(--border)', color: '#fff', border: 'none', padding: '9px 12px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '700' }}
              >
                ATUALIZAR
              </button>
            </div>

            <div className="hide-scrollbar" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '12px', color: 'var(--text-muted)' }}>SKU</th>
                    <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Qtd</th>
                    <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Valor Total</th>
                    <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Loja</th>
                    <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Operador</th>
                    <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Data</th>
                    <th style={{ padding: '12px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedExits.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Nenhuma saída encontrada para este período.
                      </td>
                    </tr>
                  ) : (
                    paginatedExits.map(e => (
                      <tr key={e.id} style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.5)' }}>
                        <td data-label="SKU" style={{ padding: '12px', fontWeight: '600' }}>{e.sku}</td>
                        <td data-label="Qtd" style={{ padding: '12px' }}>{e.quantity}</td>
                        <td data-label="Valor" style={{ padding: '12px', fontWeight: '700', color: 'var(--primary)' }}>
                          {((e.quantity || 0) * (e.unit_price || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td data-label="Loja" style={{ padding: '12px' }}>{e.store}</td>
                        <td data-label="Operador" style={{ padding: '12px', color: 'var(--primary)' }}>{e.operator_name || 'Admin'}</td>
                        <td data-label="Data" style={{ padding: '12px', color: 'var(--text-muted)' }}>{e.exit_date}</td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <button 
                            onClick={() => removeExit(e.id)} 
                            style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* CONTROLES DE PAGINAÇÃO */}
            {filteredExits.length > itemsPerPage && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginTop: '24px',
                paddingTop: '16px',
                borderTop: '1px solid var(--border)'
              }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                  MOSTRANDO {paginatedExits.length} DE {filteredExits.length} REGISTROS
                </p>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => prev - 1)}
                    style={{ 
                      background: 'transparent', 
                      border: '1px solid var(--border)', 
                      color: currentPage === 1 ? '#333' : '#fff',
                      padding: '6px 12px',
                      cursor: currentPage === 1 ? 'default' : 'pointer',
                      fontSize: '0.7rem',
                      fontWeight: '800'
                    }}
                  >
                    ANTERIOR
                  </button>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', padding: '0 8px' }}>
                    {currentPage} / {totalPages}
                  </span>
                  <button 
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    style={{ 
                      background: 'transparent', 
                      border: '1px solid var(--border)', 
                      color: currentPage === totalPages ? '#333' : '#fff',
                      padding: '6px 12px',
                      cursor: currentPage === totalPages ? 'default' : 'pointer',
                      fontSize: '0.7rem',
                      fontWeight: '800'
                    }}
                  >
                    PRÓXIMO
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      <footer style={{ 
        marginTop: '80px', 
        padding: '32px 0', 
        borderTop: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
          <Package size={18} />
          <div style={{ height: '14px', width: '1px', background: 'var(--border)' }}></div>
          <span style={{ fontSize: '0.8rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '2px' }}>
            Klarke Solutions
          </span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Matheus Silva
        </p>
      </footer>
    </div>
  );
};

export default StockExit;
