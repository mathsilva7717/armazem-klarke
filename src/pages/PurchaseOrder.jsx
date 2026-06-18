import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, FileText, ShoppingBag, Hash, Tag, Package, LogOut, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import api from '../api';

const PurchaseOrder = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('armazem_user') || '{}');
  
  const [storeName, setStoreName] = useState('');
  const [items, setItems] = useState([]);
  const [orderEmitter, setOrderEmitter] = useState(null);
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    quantity: '',
    unit: 'UN'
  });
  const [successModal, setSuccessModal] = useState({
    isOpen: false,
    orderId: '',
    storeName: ''
  });

  useEffect(() => {
    const repeatData = localStorage.getItem('armazem_repeat_order');
    if (repeatData) {
      try {
        const parsed = JSON.parse(repeatData);
        if (parsed.storeName) {
          let normalizedStore = parsed.storeName;
          if (normalizedStore === 'LOJA TUDO POR 10 OU 20 - PRAIA GRANDE') {
            normalizedStore = 'LOJA TUDO 10 OU 20 - PRAIA GRANDE';
          } else if (normalizedStore === 'LOJA TUDO POR 10 OU 20 - SÃO VICENTE') {
            normalizedStore = 'LOJA TUDO 10 OU 20 - SÃO VICENTE';
          }
          setStoreName(normalizedStore);
        }
        if (Array.isArray(parsed.items)) {
          const formattedItems = parsed.items.map((it, idx) => ({
            id: `${Date.now()}-${idx}`,
            sku: it.sku,
            name: it.name,
            quantity: parseInt(it.quantity) || 1,
            unit: it.unit || 'UN'
          }));
          setItems(formattedItems);
          toast.success('Pedido anterior carregado com sucesso!');
        }
        if (parsed.emittedByUsername) {
          api.get(`/users/by-username/${parsed.emittedByUsername}`)
            .then(res => {
              if (res.data) {
                setOrderEmitter(res.data);
              }
            })
            .catch(err => {
              console.warn('Could not fetch original emitter details:', err);
              setOrderEmitter({ username: parsed.emittedByUsername, name: parsed.emittedByUsername });
            });
        }
      } catch (e) {
        console.error('Erro ao carregar pedido repetido:', e);
      } finally {
        localStorage.removeItem('armazem_repeat_order');
      }
    }
  }, []);

  useEffect(() => {
    const userRole = (user.role === 'admin' || user.isAdmin === true || user.is_admin === 1 || user.is_admin === true) ? 'admin' : (user.role || 'operator');
    if (userRole !== 'admin' && userRole !== 'gerencia') {
      toast.error('Acesso negado. Você não tem permissão para criar pedidos de compra.');
      navigate('/');
    }
  }, [user, navigate]);

  const stores = [
    'LOJA TUDO 10 OU 20 - PRAIA GRANDE',
    'LOJA TUDO 10 OU 20 - SÃO VICENTE'
  ];

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

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!formData.sku || !formData.name || !formData.quantity) {
      toast.error('Preencha todos os campos do produto.');
      return;
    }

    const qty = parseInt(formData.quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error('A quantidade deve ser maior que zero.');
      return;
    }

    const newItem = {
      id: Date.now().toString(),
      sku: formData.sku,
      name: formData.name,
      quantity: qty,
      unit: formData.unit || 'UN'
    };

    setItems(prev => [...prev, newItem]);
    setFormData({ sku: '', name: '', quantity: '', unit: 'UN' });
    toast.success('Produto adicionado ao pedido!');
  };

  const handleRemoveItem = (id) => {
    setItems(prev => prev.filter(item => item.id !== id));
    toast.success('Produto removido do pedido.');
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

  const handleGeneratePDF = async () => {
    if (!storeName) {
      toast.error('Por favor, informe o nome da loja.');
      return;
    }

    if (items.length === 0) {
      toast.error('Adicione pelo menos um item ao pedido.');
      return;
    }

    const loadToast = toast.loading('Registrando pedido e gerando PDF...');

    try {
      // 1. Salvar primeiro no banco de dados para obter o ID do pedido
      const response = await api.post('/orders', { 
        storeName, 
        items: items.map(it => ({ sku: it.sku, name: it.name, quantity: it.quantity, unit: it.unit || 'UN' })),
        emittedByUsername: orderEmitter ? orderEmitter.username : user.username
      });
      const orderId = response.data.id;

      // 2. Tentar carregar loja.png
      const logoBase64 = await getBase64ImageFromUrl('/loja.png');

      // 3. Inicializar jsPDF (A4, Retrato)
      const doc = new jsPDF('p', 'mm', 'a4');

      // Cores do Tema Industrial (Klarke Amber / Slate)
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
          doc.text("Responsável Emissor:", 25, 49);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          doc.text(orderEmitter ? (orderEmitter.name || orderEmitter.username) : (user.name || user.username || 'Administrador'), 25, 54);

          // Info centro (Order ID!)
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(80, 80, 80);
          doc.text("Número do Pedido:", 95, 49);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(245, 158, 11);
          doc.text(`#${orderId}`, 95, 54);

          // Info direita
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(80, 80, 80);
          doc.text("Data de Emissão:", 145, 49);
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
        if (currentY + 9 > 240) {
          doc.setDrawColor(200, 200, 200);
          doc.line(20, currentY, 190, currentY);
          doc.line(20, pageTableStartY, 20, currentY);
          doc.line(190, pageTableStartY, 190, currentY);

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

        if (index % 2 === 1) {
          doc.setFillColor(248, 248, 248);
          doc.rect(20, currentY, 170, 9, 'F');
        }
        
        doc.setDrawColor(240, 240, 240);
        doc.line(20, currentY + 9, 190, currentY + 9);

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

      doc.setDrawColor(200, 200, 200);
      doc.line(20, currentY, 190, currentY);
      doc.line(20, pageTableStartY, 20, currentY);
      doc.line(190, pageTableStartY, 190, currentY);

      const signatureY = Math.max(240, currentY + 15);
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.4);
      doc.line(60, signatureY, 150, signatureY);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text("ASSINATURA DO RESPONSÁVEL", 105, signatureY + 5, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(orderEmitter ? (orderEmitter.name || orderEmitter.username) : (user.name || user.username || 'Operador do Armazém'), 105, signatureY + 10, { align: 'center' });

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text("Documento emitido eletronicamente via Sistema Klarke Logistics. Todos os direitos reservados.", 105, 285, { align: 'center' });

      // Abrir PDF em uma nova aba
      doc.output('dataurlnewwindow');

      toast.dismiss(loadToast);
      setSuccessModal({
        isOpen: true,
        orderId,
        storeName
      });
    } catch (err) {
      console.error(err);
      toast.dismiss(loadToast);
      toast.error(err.response?.data?.error || 'Erro ao processar e salvar o pedido.');
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
          <h2 style={{ fontSize: '1.1rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px' }}>Pedido de Compras</h2>
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
        {/* Left Column: Form to add items */}
        <section className="glass-card animate-fade-in" style={{ padding: '32px', height: 'fit-content' }}>
          <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase', fontSize: '0.9rem', letterSpacing: '1px' }}>
            <Plus size={20} color="var(--primary)" /> Adicionar Produto
          </h3>
          
          <form onSubmit={handleAddItem}>
            <div className="input-group">
              <label><Hash size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> SKU / Código</label>
              <input 
                name="sku"
                type="text" 
                placeholder="Ex: 7890123" 
                value={formData.sku}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="input-group">
              <label><Tag size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Nome do Produto</label>
              <input 
                name="name"
                type="text" 
                placeholder="Ex: Teclado Mecânico RGB" 
                value={formData.name}
                onChange={handleInputChange}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="input-group">
                <label><Package size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Quantidade</label>
                <input 
                  name="quantity"
                  type="number" 
                  placeholder="Ex: 5" 
                  value={formData.quantity}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="input-group">
                <label><Tag size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Unidade</label>
                <select
                  name="unit"
                  value={formData.unit || 'UN'}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#000',
                    border: '1px solid var(--border)',
                    color: 'white',
                    outline: 'none',
                    transition: 'border-color 0.2s ease',
                    cursor: 'pointer'
                  }}
                >
                  <option value="UN">UN (Unidade)</option>
                  <option value="CX">CX (Caixa)</option>
                </select>
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%' }}>
              <Plus size={18} /> Adicionar ao Pedido
            </button>
          </form>
        </section>

        {/* Right Column: Order Details */}
        <section className="glass-card animate-fade-in" style={{ padding: '32px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase', fontSize: '0.9rem', letterSpacing: '1px' }}>
            <FileText size={20} color="var(--primary)" /> Detalhes do Pedido
          </h3>

          <div className="input-group" style={{ marginBottom: '24px' }}>
            <label><ShoppingBag size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Nome da Loja Destinatária</label>
            <select
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                background: '#000',
                border: '1px solid var(--border)',
                color: 'white',
                outline: 'none',
                transition: 'border-color 0.2s ease',
                cursor: 'pointer'
              }}
            >
              <option value="" disabled>Selecione a loja destinatária</option>
              {stores.map(s => (
                <option key={s} value={s} style={{ background: '#121212', color: 'white' }}>{s}</option>
              ))}
            </select>
            {orderEmitter && (
              <p style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '8px', fontWeight: 'bold' }}>
                Repetindo pedido emitido originalmente por: {orderEmitter.name || orderEmitter.username}
              </p>
            )}
          </div>

          <div style={{ flex: 1, minHeight: '200px', marginBottom: '24px' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', marginBottom: '12px' }}>
              Itens Incluídos ({items.length})
            </p>
            
            {items.length === 0 ? (
              <div style={{
                height: '80%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px dashed var(--border)',
                color: 'var(--text-muted)',
                fontSize: '0.85rem'
              }}>
                Nenhum produto adicionado ainda.
              </div>
            ) : (
              <div className="hide-scrollbar" style={{ overflowX: 'auto', border: '1px solid var(--border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                      <th style={{ padding: '10px', color: 'var(--text-muted)' }}>SKU</th>
                      <th style={{ padding: '10px', color: 'var(--text-muted)' }}>Produto</th>
                      <th style={{ padding: '10px', color: 'var(--text-muted)', textAlign: 'right' }}>Qtd</th>
                      <th style={{ padding: '10px', color: 'var(--text-muted)', textAlign: 'center' }}>Unid</th>
                      <th style={{ padding: '10px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <tr key={item.id} style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.3)' }}>
                        <td style={{ padding: '10px', fontWeight: '700' }}>{item.sku}</td>
                        <td style={{ padding: '10px' }}>{item.name.toUpperCase()}</td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: '700', color: 'var(--primary)' }}>{item.quantity}</td>
                        <td style={{ padding: '10px', textAlign: 'center', fontWeight: '600' }}>{(item.unit || 'UN').toUpperCase()}</td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>
                          <button 
                            onClick={() => handleRemoveItem(item.id)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer' }}
                            title="Remover Item"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <button 
            onClick={handleGeneratePDF}
            className="btn-primary" 
            style={{ width: '100%', marginTop: 'auto' }}
            disabled={items.length === 0}
          >
            <Download size={18} /> Gerar PDF do Pedido
          </button>
        </section>
      </main>
      {/* Modal de Sucesso Customizado */}
      {successModal.isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div className="glass-card animate-fade-in" style={{
            maxWidth: '450px',
            width: '100%',
            padding: '32px',
            background: '#121212',
            border: '1px solid var(--border)',
            borderRadius: '0px',
            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5), 0 8px 10px -6px rgb(0 0 0 / 0.5)'
          }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '900', textTransform: 'uppercase', marginBottom: '16px', color: 'var(--primary)', letterSpacing: '1px' }}>
              Pedido Emitido com Sucesso
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '28px', lineHeight: '1.5' }}>
              O Pedido de Compra <strong style={{ color: 'var(--primary)' }}>#{successModal.orderId}</strong> para a loja <strong style={{ color: '#fff' }}>{successModal.storeName}</strong> foi registrado no sistema e o PDF foi gerado em uma nova aba.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => {
                  setItems([]);
                  setStoreName('');
                  setSuccessModal({ isOpen: false, orderId: '', storeName: '' });
                }}
                className="btn-primary"
                style={{
                  padding: '10px 24px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
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

export default PurchaseOrder;
