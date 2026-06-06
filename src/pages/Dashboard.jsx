import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Printer, Search, Users, LogOut, Box, ArrowRight, FileText, AlertTriangle, Terminal, Headset, MessageSquare, Mail, Globe } from 'lucide-react';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const navigate = useNavigate();
  const [isSupportOpen, setIsSupportOpen] = useState(false);
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
    },
    {
      title: 'Logs do Sistema',
      desc: 'Histórico de auditoria de ações',
      icon: <Terminal size={32} />,
      path: '/logs',
      color: 'var(--primary)'
    },
    {
      title: 'Suporte Técnico',
      desc: 'Fale com o suporte da Klarke',
      icon: <Headset size={32} />,
      path: 'support',
      color: 'var(--primary)'
    }
  ];

  const handleItemClick = (item) => {
    if (item.path === 'support') {
      setIsSupportOpen(true);
      return;
    }

    if ((item.path === '/users' || item.path === '/logs') && !user.isAdmin) {
      toast.error('Somente usuários administradores têm acesso.');
      return;
    }

    navigate(item.path);
  };

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
          <img 
            src="/logok.png" 
            alt="Logo" 
            style={{ 
              height: '44px', 
              objectFit: 'contain',
              display: 'block'
            }} 
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const fb = document.getElementById('dash-logo-fb');
              if (fb) fb.style.display = 'flex';
            }}
          />
          <div id="dash-logo-fb" style={{ 
            width: '44px', 
            height: '44px', 
            background: 'var(--primary)', 
            display: 'none', 
            alignItems: 'center', 
            justifyContent: 'center'
          }}>
            <Box color="black" size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px' }}>Klarke Stock</h1>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Sistema Integrado de Armazém</p>
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
            onClick={() => handleItemClick(item)}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
          <img 
            src="/empresa.png" 
            alt="Klarke Logo" 
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
            style={{ height: '24px', objectFit: 'contain' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '2px' }}>
            Powered by Klarke Solutions
          </span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Matheus Silva
        </p>
      </footer>
      {isSupportOpen && (
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
            maxWidth: '450px',
            width: '100%',
            padding: '40px 32px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            boxShadow: '10px 10px 0px rgba(0, 0, 0, 1)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', textAlign: 'center' }}>
              <img 
                src="/empresa.png" 
                alt="Klarke Logo" 
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
                style={{ maxHeight: '60px', objectFit: 'contain' }}
              />
              
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '900', textTransform: 'uppercase', marginBottom: '8px', color: 'var(--primary)', letterSpacing: '1px' }}>
                  Suporte Técnico
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Precisa de ajuda com o sistema? Entre em contato conosco.
                </p>
              </div>

              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px', margin: '16px 0' }}>
                <a 
                  href="https://wa.me/5513989330765?text=Olá,%20preciso%20de%20suporte%20no%20sistema%20de%20Armazém."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                  style={{ textDecoration: 'none', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}
                >
                  <MessageSquare size={18} /> WhatsApp: (13) 98933-0765
                </a>

                <a 
                  href="mailto:contato@klarke.com.br"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    border: '1px solid var(--border)',
                    color: 'var(--text-main)',
                    textDecoration: 'none',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    transition: 'all 0.2s ease',
                    background: '#000'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <Mail size={16} color="var(--primary)" /> contato@klarke.com.br
                </a>

                <a 
                  href="https://klarke.com.br"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    border: '1px solid var(--border)',
                    color: 'var(--text-main)',
                    textDecoration: 'none',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    transition: 'all 0.2s ease',
                    background: '#000'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <Globe size={16} color="var(--primary)" /> klarke.com.br
                </a>
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '16px', width: '100%' }}>
                <p style={{ fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Powered by Klarke Solutions</p>
                <p>Matheus Silva</p>
              </div>

              <button 
                onClick={() => setIsSupportOpen(false)}
                style={{
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                  padding: '10px 24px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  letterSpacing: '1px',
                  marginTop: '8px'
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
