import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Printer, Trash2, Box, Tag, ShoppingBag, Hash, Check, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';

const DefectLabels = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('armazem_user') || '{}');

  const [defectText, setDefectText] = useState('');
  const [storeName, setStoreName] = useState('');
  const [quantity, setQuantity] = useState(1);

  const stores = [
    'LOJA TUDO 10 OU 20 - PRAIA GRANDE',
    'LOJA TUDO 10 OU 20 - SÃO VICENTE'
  ];

  const commonDefects = [
    'TELA QUEBRADA',
    'NÃO LIGA',
    'BATERIA VICIADA',
    'PRODUTO RACHADO',
    'RUIDO NO MOTOR',
    'SINAL FRACO / WI-FI',
    'TECLADO SEM FUNCIONAR',
    'RISCADO / AMASSADO',
    'CARREGADOR COM MAL CONTATO',
    'DEVOLUÇÃO DE CLIENTE'
  ];

  const handleLogout = () => {
    localStorage.removeItem('armazem_auth');
    localStorage.removeItem('armazem_token');
    localStorage.removeItem('armazem_user');
    toast.success('Sessão encerrada.');
    navigate('/login');
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

  const handleGenerateDefectLabels = async (e) => {
    e.preventDefault();
    if (!defectText) {
      toast.error('Preencha a descrição do defeito.');
      return;
    }
    if (!storeName) {
      toast.error('Selecione ou informe a loja.');
      return;
    }
    if (quantity <= 0) {
      toast.error('Informe uma quantidade válida.');
      return;
    }

    const loadToast = toast.loading('Gerando etiquetas...');

    try {
      const logoBase64 = await getBase64ImageFromUrl('/loja.png');
      const doc = new jsPDF('l', 'mm', [82, 25]);
      const totalPages = Math.ceil(quantity / 2);

      for (let i = 0; i < totalPages; i++) {
        if (i > 0) doc.addPage([82, 25], 'l');

        // --- ETIQUETA 1 (ESQUERDA - Centro em X = 20.5) ---
        // 1. Marca d'água da loja (em preto sólido para imprimir em impressora térmica)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.5);
        doc.setTextColor(0, 0, 0); 
        let watermarkText = storeName.toUpperCase();
        watermarkText = watermarkText.replace("PRAIA GRANDE", "PG").replace("SÃO VICENTE", "SV");
        doc.text(watermarkText, 20.5, 21.5, { align: 'center' });

        // 2. Logo da loja
        if (logoBase64) {
          doc.addImage(logoBase64, 'PNG', 4, 2, 8, 4.5);
        } else {
          doc.setDrawColor(245, 158, 11);
          doc.rect(4, 2, 8, 4.5);
          doc.setFontSize(3.5);
          doc.setTextColor(245, 158, 11);
          doc.text("KLA", 8, 5.2, { align: 'center' });
        }

        // 3. Título Defeito
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.5);
        doc.setTextColor(0, 0, 0);
        doc.text("DEFEITO REGISTRADO", 20.5, 8.5, { align: 'center' });

        // 4. Descrição do Defeito (Autocentralizado e com quebra automática)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(239, 68, 68); // cor vermelha para defeito
        const cleanDefect = defectText.toUpperCase();
        const linesLeft = doc.splitTextToSize(cleanDefect, 34); // largura de 34mm max
        
        let startYLeft = 13.5;
        if (linesLeft.length === 2) {
          doc.setFontSize(11);
          startYLeft = 13;
        } else if (linesLeft.length > 2) {
          doc.setFontSize(8.5);
          startYLeft = 11.5;
        }

        linesLeft.forEach((line, index) => {
          doc.text(line, 20.5, startYLeft + (index * 4.5), { align: 'center' });
        });

        // --- ETIQUETA 2 (DIREITA - Centro em X = 61.5) ---
        if ((i * 2 + 1) < quantity) {
          // 1. Marca d'água da loja (em preto sólido)
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(5.5);
          doc.setTextColor(0, 0, 0);
          doc.text(watermarkText, 61.5, 21.5, { align: 'center' });

          // 2. Logo da loja
          if (logoBase64) {
            doc.addImage(logoBase64, 'PNG', 45, 2, 8, 4.5);
          } else {
            doc.setDrawColor(245, 158, 11);
            doc.rect(45, 2, 8, 4.5);
            doc.setFontSize(3.5);
            doc.setTextColor(245, 158, 11);
            doc.text("KLA", 49, 5.2, { align: 'center' });
          }

          // 3. Título Defeito
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(5.5);
          doc.setTextColor(0, 0, 0);
          doc.text("DEFEITO REGISTRADO", 61.5, 8.5, { align: 'center' });

          // 4. Descrição do Defeito
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(13);
          doc.setTextColor(239, 68, 68); // cor vermelha para defeito
          
          let startYRight = 13.5;
          const linesRight = doc.splitTextToSize(cleanDefect, 34);
          if (linesRight.length === 2) {
            doc.setFontSize(11);
            startYRight = 13;
          } else if (linesRight.length > 2) {
            doc.setFontSize(8.5);
            startYRight = 11.5;
          }

          linesRight.forEach((line, index) => {
            doc.text(line, 61.5, startYRight + (index * 4.5), { align: 'center' });
          });
        }
      }

      doc.output('dataurlnewwindow');
      toast.dismiss(loadToast);
      toast.success('Etiquetas de Defeito geradas!');
    } catch (err) {
      console.error(err);
      toast.dismiss(loadToast);
      toast.error('Erro ao gerar PDF.');
    }
  };

  const handleGenerateCalibrationLabel = async () => {
    if (!storeName) {
      toast.error('Selecione ou informe a loja.');
      return;
    }

    const loadToast = toast.loading('Gerando termo de conferência...');

    try {
      const logoBase64 = await getBase64ImageFromUrl('/loja.png');
      // Gerando etiqueta tamanho 10x15 (105mm x 150mm) em formato Retrato
      const doc = new jsPDF('p', 'mm', [105, 150]);

      // Borda superior decorativa em preto para impressora térmica
      doc.setFillColor(0, 0, 0);
      doc.rect(0, 0, 105, 4, 'F');

      // 1. Logo da loja centralizado
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', 32.5, 12, 40, 22);
      } else {
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
        doc.rect(32.5, 12, 40, 22);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text("LOGO LOJA", 52.5, 25, { align: 'center' });
      }

      // 2. Loja centralizado
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(0, 0, 0);
      let formattedStore = storeName.toUpperCase();
      formattedStore = formattedStore.replace("PRAIA GRANDE", "PG").replace("SÃO VICENTE", "SV");
      doc.text(formattedStore, 52.5, 42, { align: 'center' });

      // 3. Título Principal
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(0, 0, 0);
      doc.text("TERMO DE CONFERÊNCIA", 52.5, 58, { align: 'center' });

      // Linha separadora
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.line(15, 63, 90, 63);

      // 4. Data
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text("DATA: ____/____/______", 52.5, 78, { align: 'center' });

      // 5. Linha de Assinatura (Ampla)
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.line(15, 115, 90, 115);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);
      doc.text("ASSINATURA DO CONFERENTE", 52.5, 122, { align: 'center' });

      doc.output('dataurlnewwindow');
      toast.dismiss(loadToast);
      toast.success('Termo de Conferência (10x15) gerado!');
    } catch (err) {
      console.error(err);
      toast.dismiss(loadToast);
      toast.error('Erro ao gerar Termo de Conferência.');
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
          <h2 style={{ fontSize: '1.1rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px' }}>Etiquetas de Defeito</h2>
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
        {/* Left Column: Form to create Defect Label */}
        <section className="glass-card animate-fade-in" style={{ padding: '32px' }}>
          <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase', fontSize: '0.9rem', letterSpacing: '1px' }}>
            <AlertTriangle size={20} color="var(--primary)" /> Emissão de Etiquetas
          </h3>

          <form onSubmit={handleGenerateDefectLabels}>
            <div className="input-group">
              <label><ShoppingBag size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Nome da Loja Origem</label>
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
                <option value="" disabled>Selecione a loja origem</option>
                {stores.map(s => (
                  <option key={s} value={s} style={{ background: '#121212', color: 'white' }}>{s}</option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label><Tag size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Descrição do Defeito</label>
              <input 
                type="text" 
                placeholder="Ex: TELA QUEBRADA / NÃO LIGA" 
                value={defectText}
                onChange={(e) => setDefectText(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label><Hash size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Quantidade de Etiquetas</label>
              <input 
                type="number" 
                min="1"
                placeholder="Ex: 2" 
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
              <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                <Printer size={18} /> Imprimir Etiquetas de Defeito
              </button>
              
              <button 
                type="button" 
                onClick={handleGenerateCalibrationLabel}
                className="btn-primary" 
                style={{ width: '100%', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                disabled={!storeName}
              >
                <Check size={18} /> Imprimir Termo de Conferência
              </button>
            </div>
          </form>
        </section>

        {/* Right Column: Templates / Defect Shortcut Suggestions */}
        <section className="glass-card animate-fade-in" style={{ padding: '32px', height: 'fit-content' }}>
          <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase', fontSize: '0.9rem', letterSpacing: '1px' }}>
            <Box size={20} color="var(--primary)" /> Atalhos de Defeitos Comuns
          </h3>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Selecione uma das opções abaixo para preencher o campo do defeito de forma rápida:
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {commonDefects.map((defect) => (
              <button
                key={defect}
                type="button"
                onClick={() => setDefectText(defect)}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border)',
                  color: 'white',
                  padding: '8px 12px',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.background = 'rgba(245, 158, 11, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                }}
              >
                {defect}
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default DefectLabels;
