import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Printer, Search, Users, LogOut, Box, ArrowRight, FileText, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('armazem_user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('armazem_auth');
    localStorage.removeItem('armazem_token');
    localStorage.removeItem('armazem_user');
    toast.success('Sessão encerrada.');
    navigate('/login');
  };

  const menuItems = [
    {
      title: 'Saída de Estoque',
      desc: 'Registrar saída de produtos para lojas',
      icon: <Package size={32} />,
      path: '/saidas',
      color: 'var(--primary)'
    },
    {
      title: 'Emissor de Etiquetas',
      desc: 'Gerar lotes de etiquetas térmicas',
      icon: <Printer size={32} />,
      path: '/labels',
      color: 'var(--primary)'
    },
    {
      title: 'Etiquetas de Defeito',
      desc: 'Emitir etiquetas de avaria para as lojas',
      icon: <AlertTriangle size={32} />,
      path: '/defect-labels',
      color: 'var(--primary)'
    },
    {
      title: 'Pedido de Compras',
      desc: 'Gerar solicitações de compra em PDF',
      icon: <FileText size={32} />,
      path: '/purchase-order',
      color: 'var(--primary)'
    },
    {
      title: 'Consulta Técnica',
      desc: 'Pesquisar NCM, CEST e dimensões',
      icon: <Search size={32} />,
      path: '/search',
      color: 'var(--primary)'
    },
    {
      title: 'Gestão de Usuários',
      desc: 'Cadastrar novos operadores',
      icon: <Users size={32} />,
      path: '/users',
      color: 'var(--primary)'
    }
  ];

  return (
    <div style={{ minHeight: '100vh', padding: '20px', display: 'flex', flexDirection: 'column' }}>
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        maxWidth: '1200px', 
        margin: '0 auto 48px',
        width: '100%',
        padding: '24px 0',
        borderBottom: '2px solid var(--primary)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ 
            width: '44px', 
            height: '44px', 
            background: 'var(--primary)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center'
          }}>
            <Box color="black" size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px' }}>ARMAZEM CONTROLE</h1>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Painel Administrativo</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800' }}>Logado como</p>
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
              padding: '10px 16px',
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
        width: '100%',
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
        gap: '24px' 
      }}>
        {menuItems.map((item, index) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="glass-card animate-fade-in"
            style={{ 
              padding: '40px 32px', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'flex-start',
              textAlign: 'left',
              gap: '20px',
              cursor: 'pointer',
              border: '1px solid var(--border)',
              transition: 'all 0.3s ease',
              animationDelay: `${index * 0.1}s`,
              background: 'var(--bg-card)',
              color: 'inherit'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary)';
              e.currentTarget.style.transform = 'translateY(-5px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ color: 'var(--primary)' }}>{item.icon}</div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '900', textTransform: 'uppercase', marginBottom: '8px' }}>{item.title}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>{item.desc}</p>
            </div>
            <div style={{ 
              marginTop: 'auto', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              fontSize: '0.75rem', 
              fontWeight: '900', 
              textTransform: 'uppercase',
              color: 'var(--primary)' 
            }}>
              Acessar Módulo <ArrowRight size={14} />
            </div>
          </button>
        ))}
      </main>

      <footer style={{ 
        marginTop: 'auto', 
        padding: '60px 0 32px', 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
          <Box size={18} />
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

export default Dashboard;
