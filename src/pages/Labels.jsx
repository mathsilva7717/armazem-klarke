import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Printer, ArrowLeft, Hash, Package, History, Trash2, Box, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import JsBarcode from 'jsbarcode';
import jsPDF from 'jspdf';

const Labels = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  
  const [code, setCode] = useState(queryParams.get('code') || '');
  const [name, setName] = useState(queryParams.get('name') || '');
  const [quantity, setQuantity] = useState(1);
  const [history, setHistory] = useState([]);
  const barcodeRef = useRef(null);
  const canvasRef = useRef(null);

  const user = JSON.parse(localStorage.getItem('armazem_user') || '{}');

  useEffect(() => {
    const savedHistory = JSON.parse(localStorage.getItem('armazem_label_history') || '[]');
    setHistory(savedHistory);
  }, []);

  useEffect(() => {
    if (barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, code || 'KLARKE', {
          format: 'CODE128',
          width: 2,
          height: 40,
          displayValue: true,
          fontSize: 14,
          margin: 10,
          background: '#fff',
          lineColor: '#000'
        });
      } catch (e) {
        console.error("Barcode error:", e);
      }
    }
  }, [code]);

  const addToHistory = (newCode, newName) => {
    const entry = { code: newCode, name: newName, date: new Date().toISOString() };
    const filtered = history.filter(h => h.code !== newCode);
    const updatedHistory = [entry, ...filtered.slice(0, 9)];
    setHistory(updatedHistory);
    localStorage.setItem('armazem_label_history', JSON.stringify(updatedHistory));
  };

  const deleteFromHistory = (e, codeToDelete) => {
    e.stopPropagation();
    const updatedHistory = history.filter(h => h.code !== codeToDelete);
    setHistory(updatedHistory);
    localStorage.setItem('armazem_label_history', JSON.stringify(updatedHistory));
    toast.success('Etiqueta removida do histórico!');
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('armazem_label_history');
    toast.success('Histórico de etiquetas limpo!');
  };

  const handlePrint = () => {
    if (!code) {
      toast.error('Informe um código para gerar.');
      return;
    }

    try {
      console.log("Gerando etiqueta para:", code);
      const canvas = canvasRef.current;
      
      // Gera o código de barras no canvas oculto
      JsBarcode(canvas, code, {
        format: 'CODE128',
        width: 2,
        height: 100,
        displayValue: true,
        fontSize: 20,
        margin: 0
      });

      const imgData = canvas.toDataURL('image/png');
      
      // Construtor compatível com todas as versões do jsPDF
      const doc = new jsPDF('l', 'mm', [82, 25]);
      const totalRows = Math.ceil(quantity / 2);

      for (let i = 0; i < totalRows; i++) {
        if (i > 0) doc.addPage([82, 25], 'l');
        
        const displayName = name ? (name.length > 22 ? name.substring(0, 22) + '...' : name) : 'PRODUTO';

        // Etiqueta 1 (Esquerda)
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.text(displayName.toUpperCase(), 18.2, 4.5, { align: 'center' });
        doc.addImage(imgData, 'PNG', 6.2, 6.5, 24, 14);                
        
        // Etiqueta 2 (Direita) - se houver saldo
        if ((i * 2 + 1) < quantity) {
          doc.text(displayName.toUpperCase(), 58.2, 4.5, { align: 'center' });
          doc.addImage(imgData, 'PNG', 46.2, 6.5, 24, 14);
        }
      }

      // Abre o PDF em uma nova aba para visualização e impressão direta
      const pdfData = doc.output('dataurlnewwindow');

      addToHistory(code, name);
      toast.success('Etiqueta aberta em nova aba!');
    } catch (err) {
      console.error("Erro na geração do PDF:", err);
      toast.error('Erro ao gerar visualização do PDF.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('armazem_auth');
    localStorage.removeItem('armazem_token');
    localStorage.removeItem('armazem_user');
    navigate('/login');
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
          <h2 style={{ fontSize: '1.1rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px' }}>Emissor de Etiquetas</h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800' }}>Operador</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: '700' }}>{user.name || user.username}</p>
          </div>
          <button onClick={handleLogout} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '8px', cursor: 'pointer' }}>Sair</button>
        </div>
      </header>

      <main style={{ 
        maxWidth: '500px', 
        margin: '0 auto', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '24px' 
      }}>
        <form 
          onSubmit={(e) => { e.preventDefault(); handlePrint(); }}
          className="glass-card animate-fade-in" 
          style={{ padding: '32px' }}
        >
          <div style={{ 
            background: '#fff', 
            padding: '10px', 
            marginBottom: '32px', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            border: '2px dashed var(--border)',
            borderRadius: '4px'
          }}>
            <p style={{ fontSize: '0.5rem', color: '#000', fontWeight: '900', marginBottom: '5px', textTransform: 'uppercase' }}>
              {name || 'PRÉ-VISUALIZAÇÃO'}
            </p>
            <svg ref={barcodeRef} style={{ maxWidth: '100%', height: '60px' }}></svg>
          </div>
          
          <div className="input-group">
            <label><Tag size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Descrição do Item</label>
            <input 
              type="text" 
              placeholder="Ex: MOUSE SEM FIO M25" 
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="input-group">
              <label><Hash size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Código (SKU/EAN)</label>
              <input 
                type="text" 
                placeholder="Ex: 7890..." 
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label><Package size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Quantidade</label>
              <input 
                type="number" 
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '10px' }}>
            <Printer size={18} /> Gerar Lote PDF
          </button>

          {history.length > 0 && (
            <div style={{ marginTop: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                  <History size={14} /> Recentes
                </p>
                <button 
                  type="button" 
                  onClick={clearHistory}
                  style={{ 
                    background: 'transparent', 
                    border: 'none', 
                    color: 'var(--error)', 
                    fontSize: '0.65rem', 
                    fontWeight: '800', 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '4px',
                    textTransform: 'uppercase'
                  }}
                >
                  <Trash2 size={12} /> Limpar Tudo
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {history.map(h => (
                  <div 
                    key={h.code}
                    style={{ 
                      background: 'rgba(255,255,255,0.03)', 
                      border: '1px solid var(--border)', 
                      borderRadius: '4px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div 
                      onClick={() => { setCode(h.code); setName(h.name); }}
                      style={{ 
                        flex: 1,
                        padding: '10px', 
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: '800', color: 'var(--primary)', fontSize: '0.8rem' }}>{h.code}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>{h.name || 'Sem nome'}</span>
                      </div>
                      <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{new Date(h.date).toLocaleDateString()}</span>
                    </div>
                    
                    <button
                      type="button"
                      onClick={(e) => deleteFromHistory(e, h.code)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        padding: '10px 16px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'color 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--error)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                      title="Excluir do histórico"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>

        <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
        
        <footer style={{ 
          marginTop: '20px', 
          padding: '20px 0', 
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
            <Box size={14} />
            <span style={{ fontSize: '0.6rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
              Klarke Logistics
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default Labels;
