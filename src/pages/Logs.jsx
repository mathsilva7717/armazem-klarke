import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Search, Calendar, User, Terminal, LogOut, FileSpreadsheet, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
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
    if (!dateStr) return '';
    try {
      const parsedStr = (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('T')) 
        ? dateStr.replace(' ', 'T') + 'Z' 
        : dateStr;
      const date = new Date(parsedStr);
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
      case 'GERAR_PEDIDO':
        return {
          background: 'rgba(34, 197, 94, 0.15)',
          color: '#22c55e',
          border: '1px solid #22c55e'
        };
      case 'UPLOAD_DOC':
        return {
          background: 'rgba(6, 182, 212, 0.15)',
          color: '#06b6d4',
          border: '1px solid #06b6d4'
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

  const getBase64ImageFromUrl = async (url) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => resolve(reader.result), false);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn("Could not load image as base64:", e);
      return null;
    }
  };

  const handleRedownloadOrder = async (detailsJson, originalUsername) => {
    let data;
    try {
      data = JSON.parse(detailsJson);
    } catch (e) {
      toast.error('Erro ao processar dados do pedido.');
      return;
    }

    const { storeName, items } = data;
    if (!storeName || !items || !Array.isArray(items)) {
      toast.error('Dados do pedido incompletos.');
      return;
    }

    const loadToast = toast.loading('Re-gerando PDF do Pedido...');

    let emitterName = originalUsername || data.emittedByUsername || 'Administrador';
    try {
      const uRes = await api.get(`/users/by-username/${emitterName}`);
      if (uRes.data && uRes.data.name) {
        emitterName = uRes.data.name;
      }
    } catch (e) {
      console.warn('Could not fetch original emitter name:', e);
    }

    try {
      const logoBase64 = await getBase64ImageFromUrl('/loja.png');
      const doc = new jsPDF('p', 'mm', 'a4');

      const colorAmber = [245, 158, 11]; // #f59e0b
      const colorDark = [38, 38, 38]; // #262626

      const currentDate = new Date().toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Função para desenhar o cabeçalho da página
      const drawHeader = (pageNumber) => {
        // Top Border
        doc.setFillColor(colorAmber[0], colorAmber[1], colorAmber[2]);
        doc.rect(0, 0, 210, 5, 'F');

        if (pageNumber === 1) {
          // Logo e Cabeçalho
          let textXOffset = 20;
          if (logoBase64) {
            doc.addImage(logoBase64, 'PNG', 20, 15, 35, 18);
            textXOffset = 62;
          } else {
            // Fallback visualmente limpo caso não encontre loja.png
            doc.setDrawColor(colorAmber[0], colorAmber[1], colorAmber[2]);
            doc.setLineWidth(0.8);
            doc.rect(20, 15, 35, 18);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(colorAmber[0], colorAmber[1], colorAmber[2]);
            doc.text("KLA LOGÍSTICA", 37.5, 25, { align: 'center' });
            textXOffset = 62;
          }

          // Nome da Loja ao lado do Logo
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(14);
          doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
          doc.text(storeName.toUpperCase(), textXOffset, 22);

          // Título do Documento
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(120, 120, 120);
          doc.text("SOLICITAÇÃO INTERNA DE PEDIDO DE COMPRA", textXOffset, 27);

          // Linha Divisória do Topo
          doc.setDrawColor(220, 220, 220);
          doc.setLineWidth(0.2);
          doc.line(20, 38, 190, 38);

          // Seção de Informações / Metadados (Cards organizados)
          doc.setFillColor(250, 250, 250);
          doc.rect(20, 42, 170, 20, 'F');
          doc.setDrawColor(230, 230, 230);
          doc.rect(20, 42, 170, 20);

          // Info esquerda
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(80, 80, 80);
          doc.text("Responsável Emissor (Cópia):", 25, 49);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          doc.text(emitterName, 25, 54);

          // Info centro (Order ID!)
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(80, 80, 80);
          doc.text("Número do Pedido:", 95, 49);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(245, 158, 11);
          doc.text(data.orderId ? `#${data.orderId}` : 'CÓPIA', 95, 54);

          // Info direita
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(80, 80, 80);
          doc.text("Data de Re-emissão:", 145, 49);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          doc.text(currentDate, 145, 54);
        } else {
          // Cabeçalho simplificado nas páginas seguintes
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
          doc.text(`SOLICITAÇÃO DE PEDIDO DE COMPRA - ${storeName.toUpperCase()} (Pág. ${pageNumber})`, 20, 15);
          
          doc.setDrawColor(220, 220, 220);
          doc.setLineWidth(0.2);
          doc.line(20, 18, 190, 18);
        }
      };

      // Função para desenhar o cabeçalho da tabela
      const drawTableHeader = (y) => {
        doc.setFillColor(colorDark[0], colorDark[1], colorDark[2]);
        doc.rect(20, y, 170, 8, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text("SKU", 25, y + 5.5);
        doc.text("NOME DO PRODUTO", 65, y + 5.5);
        doc.text("QUANTIDADE", 145, y + 5.5);
        doc.text("UNIDADE", 172, y + 5.5);
      };

      let pageNum = 1;
      let pageTableStartY = 74;
      let currentY = pageTableStartY;

      drawHeader(pageNum);
      drawTableHeader(currentY);
      currentY += 8;

      // Linhas da Tabela
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);

      items.forEach((item, index) => {
        // Cada linha tem 9mm. Se estourar o limite da página (240mm), quebra de página.
        if (currentY + 9 > 240) {
          // Desenha bordas da tabela na página atual antes de mudar
          doc.setDrawColor(200, 200, 200);
          doc.line(20, currentY, 190, currentY); // Linha inferior
          doc.line(20, pageTableStartY, 20, currentY); // Linha lateral esquerda
          doc.line(190, pageTableStartY, 190, currentY); // Linha lateral direita

          // Adiciona nova página
          doc.addPage();
          pageNum++;
          drawHeader(pageNum);

          pageTableStartY = 25;
          currentY = pageTableStartY;
          drawTableHeader(currentY);
          currentY += 8;
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
        }

        // Cor de fundo alternada (efeito zebra)
        if (index % 2 === 1) {
          doc.setFillColor(248, 248, 248);
          doc.rect(20, currentY, 170, 9, 'F');
        }
        
        // Borda inferior discreta
        doc.setDrawColor(240, 240, 240);
        doc.line(20, currentY + 9, 190, currentY + 9);

        // Conteúdos
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.text(item.sku, 25, currentY + 6);

        doc.setFont('helvetica', 'normal');
        const itemDesc = item.name.length > 50 ? item.name.substring(0, 47) + '...' : item.name;
        doc.text(itemDesc.toUpperCase(), 65, currentY + 6);

        doc.setFont('helvetica', 'bold');
        doc.text(item.quantity.toString(), 145, currentY + 6);
        doc.text((item.unit || 'UN').toUpperCase(), 172, currentY + 6);

        currentY += 9;
      });

      // Desenha bordas finais da tabela no final da listagem
      doc.setDrawColor(200, 200, 200);
      doc.line(20, currentY, 190, currentY); // Linha inferior
      doc.line(20, pageTableStartY, 20, currentY); // Linha lateral esquerda
      doc.line(190, pageTableStartY, 190, currentY); // Linha lateral direita

      // 6. Campo de Assinatura
      const signatureY = Math.max(240, currentY + 15);
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.4);
      doc.line(60, signatureY, 150, signatureY);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text("ASSINATURA DE RE-EMISSÃO (CÓPIA)", 105, signatureY + 5, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(emitterName, 105, signatureY + 10, { align: 'center' });

      // 7. Rodapé Administrativo e Paginação (passado em todas as páginas)
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(`Documento emitido eletronicamente via Sistema Klarke. Página ${i} de ${totalPages}`, 105, 285, { align: 'center' });
      }

      doc.output('dataurlnewwindow');
      toast.dismiss(loadToast);
      toast.success('Pedido re-gerado com sucesso!');
    } catch (err) {
      console.error(err);
      toast.dismiss(loadToast);
      toast.error('Erro ao re-gerar o PDF.');
    }
  };

  const handleRepeatOrder = (detailsJson, originalUsername) => {
    try {
      const data = JSON.parse(detailsJson);
      if (data && data.storeName && Array.isArray(data.items)) {
        localStorage.setItem('armazem_repeat_order', JSON.stringify({
          storeName: data.storeName,
          items: data.items,
          emittedByUsername: originalUsername || data.emittedByUsername
        }));
        toast.success('Pedido copiado! Redirecionando para preenchimento...');
        navigate('/purchase-order');
      } else {
        toast.error('Dados do pedido inválidos para repetição.');
      }
    } catch (e) {
      toast.error('Erro ao processar dados do pedido.');
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
                  <option value="GERAR_PEDIDO">Pedidos de Compra</option>
                  <option value="UPLOAD_DOC">Uploads de Documentos</option>
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

          <div className="hide-scrollbar" style={{ overflowX: 'auto' }}>
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
                      <td data-label="Detalhes" style={{ padding: '12px', color: 'var(--text-main)' }}>
                        {log.action === 'GERAR_PEDIDO' ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                            <span>
                              {(() => {
                                try {
                                  const data = JSON.parse(log.details);
                                  const totalQty = data.items?.reduce((sum, it) => sum + parseInt(it.quantity || 0), 0) || 0;
                                  return `Pedido gerado para: ${data.storeName} (${totalQty} itens)`;
                                } catch (e) {
                                  return log.details;
                                }
                              })()}
                            </span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={() => handleRedownloadOrder(log.details, log.username)}
                                style={{
                                  background: 'rgba(245, 158, 11, 0.15)',
                                  border: '1px solid var(--primary)',
                                  color: 'var(--primary)',
                                  padding: '4px 8px',
                                  fontSize: '0.75rem',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  textTransform: 'uppercase',
                                  fontFamily: 'sans-serif'
                                }}
                                title="Rebaixar PDF do Pedido"
                              >
                                <Download size={12} /> PDF
                              </button>
                              <button
                                onClick={() => handleRepeatOrder(log.details, log.username)}
                                style={{
                                  background: 'rgba(59, 130, 246, 0.15)',
                                  border: '1px solid #3b82f6',
                                  color: '#3b82f6',
                                  padding: '4px 8px',
                                  fontSize: '0.75rem',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  textTransform: 'uppercase',
                                  fontFamily: 'sans-serif'
                                }}
                                title="Repetir este Pedido"
                              >
                                <RefreshCw size={12} /> Repetir
                              </button>
                            </div>
                          </div>
                        ) : (
                          log.details
                        )}
                      </td>
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
