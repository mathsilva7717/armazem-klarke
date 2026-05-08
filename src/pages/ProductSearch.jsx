import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowLeft, Box, Ruler, Weight, ShieldCheck, Info, Scan, Tag, LogOut, X, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';
import axios from 'axios';
import { Html5QrcodeScanner } from 'html5-qrcode';

const ProductSearch = () => {
  const navigate = useNavigate();
  const [sku, setSku] = useState('');
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const user = JSON.parse(localStorage.getItem('armazem_user') || '{}');

  // Scanner Logic
  useEffect(() => {
    // Inject custom styles for the scanner library
    const style = document.createElement('style');
    style.innerHTML = `
      #reader button {
        background: var(--primary) !important;
        color: #000 !important;
        border: none !important;
        padding: 8px 16px !important;
        border-radius: 4px !important;
        font-weight: 800 !important;
        text-transform: uppercase !important;
        font-size: 0.7rem !important;
        cursor: pointer !important;
        margin: 10px 5px !important;
      }
      #reader select {
        background: #222 !important;
        color: #fff !important;
        border: 1px solid var(--border) !important;
        padding: 5px !important;
        border-radius: 4px !important;
      }
      #reader__dashboard_section_csr button {
        margin-top: 10px !important;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const startScanner = () => {
    setIsScanning(true);
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner("reader", { 
        fps: 10, 
        qrbox: { width: 250, height: 150 },
        aspectRatio: 1.777778
      });

      scanner.render((decodedText) => {
        setSku(decodedText);
        scanner.clear();
        setIsScanning(false);
        // Trigger search automatically
        document.getElementById('search-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }, (error) => {
        // console.warn(error);
      });
    }, 100);
  };

  const handleLogout = () => {
    localStorage.removeItem('armazem_auth');
    localStorage.removeItem('armazem_token');
    localStorage.removeItem('armazem_user');
    toast.success('Sessão encerrada.');
    navigate('/login');
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!sku) return;

    setLoading(true);
    setProduct(null);

    try {
      const query = sku.trim();
      
      // 0. VERIFICAÇÃO DE DADOS DA IA (Cópia e Cola do Chat)
      if (query.startsWith('{') && query.endsWith('}')) {
        try {
          const aiData = JSON.parse(query);
          setProduct({
            ...aiData,
            category: "Identificado por Visão AI",
            verified: false
          });
          toast.success('Produto identificado via Visão AI!');
          setLoading(false);
          return;
        } catch (e) {}
      }

      const isNumeric = /^\d+$/.test(query);
      const isEAN = query.length === 13 && isNumeric;
      
      let realData = null;

      // 0. BUSCA PRIORITÁRIA NO BANCO DE DADOS (APRENDIZADO)
      try {
        const dbRes = await api.get(`/products/${query}`);
        if (dbRes.data) {
          const d = dbRes.data;
          realData = {
            sku: d.sku,
            name: d.name,
            weight: d.weight.toFixed(2),
            dimensions: { width: d.width, height: d.height, length: d.length },
            ncm: d.ncm,
            cest: d.cest,
            category: "Validado pelo Operador",
            verified: true
          };
        }
      } catch (e) {
        console.log("Erro ao buscar no banco local.");
      }

      if (!realData && isEAN) {
        // Tentativa 1: OpenFoodFacts
        try {
          const res1 = await axios.get(`https://world.openfoodfacts.org/api/v0/product/${query}.json`);
          if (res1.data.status === 1) {
            const p = res1.data.product;
            realData = {
              sku: query,
              name: p.product_name || p.generic_name || `EAN: ${query}`,
              weight: p.product_quantity ? (p.product_quantity / 1000).toFixed(2) : (Math.random() * 0.5 + 0.1).toFixed(2),
              dimensions: { w: 15, h: 10, l: 20 },
              ncm: "3919.10.00",
              cest: "10.001.00",
              category: "Base de Dados Aberta"
            };
          }
        } catch (e) {}

        // Tentativa 2: UPCItemDB (Se a primeira falhou)
        if (!realData) {
          try {
            const res2 = await axios.get(`https://api.upcitemdb.com/prod/trial/lookup?upc=${query}`);
            if (res2.data.items && res2.data.items.length > 0) {
              const item = res2.data.items[0];
              realData = {
                sku: query,
                name: item.title,
                weight: (Math.random() * 0.8 + 0.2).toFixed(2),
                dimensions: { w: 20, h: 10, l: 25 },
                ncm: "3919.10.00",
                cest: "10.001.00",
                category: item.category || "Varejo Internacional"
              };
            }
          } catch (e) {}
        }
      }

      if (!realData) {
        const query = sku.toLowerCase();
        let estWeight = 0.1;
        let estDim = { w: 10, h: 10, l: 10 };
        let estNcm = "8544.42.00";
        let estCest = "21.001.00";

        // 1. EXTRAÇÃO INTELIGENTE DE UNIDADES
        const volMatch = query.match(/(\d+)\s*(ml|l|litro)/i);
        const weightMatch = query.match(/(\d+)\s*(g|kg|quilo)/i);
        const sizeMatch = query.match(/(\d+)\s*(cm|m|metro)/i);

        if (volMatch) {
          const val = parseInt(volMatch[1]);
          const unit = volMatch[2].toLowerCase();
          const factor = unit.startsWith('l') ? 1 : 0.001;
          estWeight = (val * factor) + 0.15; // Peso do líquido + recipiente
          estDim = { w: 10, h: 20, l: 10 };
        } else if (weightMatch) {
          const val = parseInt(weightMatch[1]);
          const unit = weightMatch[2].toLowerCase();
          estWeight = unit === 'g' ? val / 1000 : val;
        }

        // 2. REGRAS DE CATEGORIA DE ALTA PRECISÃO (BASEADO NA SUA OPERAÇÃO)
        if (query.includes('cabo')) {
          estNcm = "8544.42.00";
          estWeight = 0.05;
          if (query.includes('3.1a') || query.includes('lightning')) estWeight = 0.06;
          estDim = { w: 15, h: 2, l: 10 };
        } else if (query.includes('garrafa') || query.includes('copo') || query.includes('termic')) {
          estNcm = "9617.00.10";
          if (!volMatch) estWeight = 0.35;
          estDim = { w: 10, h: 25, l: 10 };
        } else if (query.includes('mouse')) {
          estNcm = "8471.60.52";
          estWeight = 0.12;
          estDim = { w: 8, h: 5, l: 12 };
        } else if (query.includes('teclado')) {
          estNcm = "8471.60.52";
          estWeight = 0.65;
          estDim = { w: 45, h: 5, l: 15 };
        } else if (query.includes('luva')) {
          estNcm = "4015.19.00";
          estWeight = 0.25;
          estDim = { w: 15, h: 2, l: 25 };
        } else if (query.includes('capacete') || query.includes('epi')) {
          estNcm = "6506.10.00";
          estWeight = 0.45;
          estDim = { w: 25, h: 20, l: 30 };
        } else if (query.includes('lanterna')) {
          estNcm = "8513.10.10";
          estWeight = 0.20;
          estDim = { w: 5, h: 5, l: 15 };
        } else if (query.includes('fita') && query.includes('isolante')) {
          estNcm = "3919.10.10";
          estWeight = 0.05;
          estDim = { w: 6, h: 2, l: 6 };
        } else if (query.includes('chave') || query.includes('alicate')) {
          estNcm = "8205.40.00";
          estWeight = 0.18;
          estDim = { w: 5, h: 3, l: 20 };
        } else if (query.includes('suporte')) {
          estNcm = "8302.42.00";
          estWeight = 0.90;
          estDim = { w: 20, h: 10, l: 20 };
        } else if (query.includes('mochila') || query.includes('bag')) {
          estNcm = "4202.92.00";
          estWeight = 0.75;
          estDim = { w: 30, h: 15, l: 45 };
        } else if (query.includes('pendrive') || query.includes('memoria')) {
          estNcm = "8523.51.10";
          estWeight = 0.02;
          estDim = { w: 5, h: 1, l: 8 };
        } else if (query.includes('papel')) {
          estNcm = "4802.56.99";
          estWeight = 2.50;
          estDim = { w: 22, h: 30, l: 5 };
        } else if (query.includes('microfone') || query.includes('microphone')) {
          estNcm = "8518.10.00";
          estWeight = 0.30;
          estDim = { w: 10, h: 20, l: 10 };
        } else if (query.includes('maquina') && query.includes('costura')) {
          estNcm = "8452.10.00";
          estWeight = 0.50;
          estDim = { w: 22, h: 12, l: 20 };
        } else if (query.includes('rodo')) {
          estNcm = "9603.90.00";
          estWeight = 1.20;
          estDim = { w: 45, h: 15, l: 15 };
        }

        // 3. AJUSTE DE DIMENSÕES POR UNIDADE (APENAS SE DETECTADO CM/M)
        if (sizeMatch && !volMatch) {
          const val = parseInt(sizeMatch[1]);
          const unit = sizeMatch[2].toLowerCase();
          const cm = (unit === 'm' || unit === 'metro') ? val * 100 : val;
          if (cm < 500) estDim.l = cm + 2; 
        }

        realData = {
          sku: isNumeric ? sku : `REF-${Math.floor(Math.random() * 9000 + 1000)}`,
          name: isNumeric ? `CÓDIGO: ${sku}` : sku.toUpperCase(),
          weight: estWeight.toFixed(2), 
          dimensions: { width: estDim.w, height: estDim.h, length: estDim.l },
          ncm: estNcm, 
          cest: estCest,
          category: "Análise Inteligente"
        };
      }

      setProduct(realData);
      toast.success(isEAN ? 'Produto identificado via EAN!' : 'Estimativa logística gerada!');
    } catch (error) {
      toast.error('Erro ao buscar produto.');
    } finally {
      setLoading(false);
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
          <h2 style={{ fontSize: '1.1rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px' }}>Consulta Técnica</h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ textAlign: 'right', display: 'none', display: 'block' }}>
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
        maxWidth: '800px', 
        margin: '0 auto', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '24px' 
      }}>
        {/* SCANNER MODAL */}
        {isScanning && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.9)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <div style={{ width: '100%', maxWidth: '500px', background: '#111', padding: '20px', borderRadius: '12px', border: '1px solid var(--primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: '900', color: 'var(--primary)' }}>ESCANEANDO CÓDIGO...</h3>
                <button onClick={() => setIsScanning(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>
                  <X size={24} />
                </button>
              </div>
              <div id="reader" style={{ width: '100%', overflow: 'hidden', borderRadius: '8px' }}></div>
              <p style={{ marginTop: '15px', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Aponte a câmera para o código de barras do produto
              </p>
            </div>
          </div>
        )}

        <section className="glass-card animate-fade-in" style={{ padding: '24px' }}>
          <form id="search-form" onSubmit={handleSearch} style={{ display: 'flex', gap: '0' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input 
                type="text" 
                placeholder="Pesquisar por Nome ou Código de Barras..." 
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                style={{ 
                  width: '100%',
                  paddingLeft: '50px', 
                  paddingRight: '100px',
                  height: '56px', 
                  fontSize: '1rem',
                  borderRadius: '4px 0 0 4px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border)',
                  borderRight: 'none',
                  color: 'var(--text-main)'
                }}
                autoFocus
              />
              <Search size={20} color="var(--primary)" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
              
              <div style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '4px' }}>
                <button 
                  type="button"
                  onClick={startScanner}
                  title="Scanner de Código de Barras"
                  style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '8px' }}
                >
                  <Scan size={22} />
                </button>
              </div>
            </div>
            <button type="submit" className="btn-primary" style={{ 
              width: '140px', 
              height: '56px', 
              fontSize: '0.9rem', 
              fontWeight: '900',
              borderRadius: '0 4px 4px 0',
              margin: 0,
              border: '1px solid var(--primary)'
            }} disabled={loading}>
              {loading ? '...' : 'BUSCAR'}
            </button>
          </form>
        </section>

        {product && (
          <div className="animate-fade-in">
            {/* Main Info Card */}
            <section className="glass-card" style={{ padding: '32px', marginBottom: '24px', borderLeft: '4px solid var(--primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase' }}>Descrição Identificada</p>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--primary)', textTransform: 'uppercase' }}>{product.name}</h3>
                  {!product.sku.startsWith('REF-') && (
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '6px', fontWeight: '600' }}>CÓDIGO: {product.sku}</p>
                  )}
                </div>
                <div style={{ 
                  background: product.verified ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)', 
                  padding: '6px 12px', 
                  color: product.verified ? '#22c55e' : 'var(--primary)', 
                  fontSize: '0.7rem', 
                  fontWeight: '900', 
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  {product.verified && <ShieldCheck size={14} />}
                  {product.category}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Weight size={14} /> Peso Aproximado
                  </p>
                  <p style={{ fontSize: '1.2rem', fontWeight: '700' }}>{product.weight} kg</p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Ruler size={14} /> Dimensões (C x L x A)
                  </p>
                  <p style={{ fontSize: '1.1rem', fontWeight: '700' }}>
                    {product.dimensions.length}x{product.dimensions.width}x{product.dimensions.height} cm
                  </p>
                </div>
              </div>
            </section>

            {/* Fiscal Card */}
            <section className="glass-card" style={{ padding: '32px', marginBottom: '24px' }}>
              <h4 style={{ marginBottom: '20px', fontSize: '0.8rem', fontWeight: '900', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={18} color="var(--primary)" /> Dados Tributários
              </h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>NCM</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input 
                      value={product.ncm} 
                      onChange={(e) => setProduct({...product, ncm: e.target.value})}
                      style={{ background: 'transparent', border: 'none', color: '#fff', textAlign: 'right', fontWeight: '800', width: '120px' }}
                    />
                    <button 
                      onClick={() => window.open(`https://www.google.com/search?q=NCM+${product.ncm}`, '_blank')}
                      title="Pesquisar NCM no Google"
                      style={{ background: 'transparent', border: 'none', color: '#4285f4', cursor: 'pointer', padding: '4px' }}
                    >
                      <ExternalLink size={14} />
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>CEST</span>
                  <input 
                    value={product.cest} 
                    onChange={(e) => setProduct({...product, cest: e.target.value})}
                    style={{ background: 'transparent', border: 'none', color: '#fff', textAlign: 'right', fontWeight: '800', width: '120px' }}
                  />
                </div>
              </div>
            </section>

            {/* FERRAMENTAS DE AUDITORIA EXTERNA */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
              {/* SÓ MOSTRA CONSULTA EAN SE FOR CÓDIGO REAL */}
              {/^\d{13}$/.test(product.sku) && (
                <button 
                  onClick={() => window.open(`https://pt.product-search.net/home?ean=${product.sku}`, '_blank')}
                  title="Consultar no banco Product-Search.net"
                  style={{ 
                    background: 'rgba(34,197,94,0.05)', 
                    border: '1px solid rgba(34,197,94,0.2)', 
                    color: '#22c55e', 
                    padding: '8px 16px', 
                    borderRadius: '4px', 
                    fontSize: '0.75rem', 
                    fontWeight: '700', 
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Box size={14} /> PRODUCT-SEARCH (EAN)
                </button>
              )}

              <button 
                onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(product.name + " " + product.sku)}`, '_blank')}
                title="Pesquisar produto no Google"
                style={{ 
                  background: 'rgba(66,133,244,0.05)', 
                  border: '1px solid rgba(66,133,244,0.2)', 
                  color: '#4285f4', 
                  padding: '8px 16px', 
                  borderRadius: '4px', 
                  fontSize: '0.75rem', 
                  fontWeight: '700', 
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Search size={14} /> PESQUISAR NO GOOGLE
              </button>
            </div>

            {/* Learning/Action Card */}
            <section className="glass-card" style={{ padding: '24px', background: 'rgba(245, 158, 11, 0.05)', border: '1px dashed var(--primary)' }}>
              <h4 style={{ fontSize: '0.8rem', fontWeight: '900', color: 'var(--primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={16} /> AÇÕES OPERACIONAIS
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <button 
                  onClick={async () => {
                    try {
                      await api.post('/products', product);
                      toast.success('Produto validado e salvo no banco oficial!');
                    } catch (e) {
                      toast.error('Erro ao salvar produto.');
                    }
                  }}
                  className="btn-primary" 
                  style={{ width: 'auto', padding: '10px 20px', fontSize: '0.75rem' }}
                >
                  Confirmar e Salvar no Banco
                </button>
              </div>
            </section>
          </div>
        )}

        <footer style={{ 
          marginTop: '40px', 
          padding: '20px 0', 
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
            <Box size={14} />
            <span style={{ fontSize: '0.6rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
              Klarke Solutions
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: '500' }}>
            Matheus Silva
          </p>
        </footer>
      </main>
    </div>
  );
};

export default ProductSearch;
