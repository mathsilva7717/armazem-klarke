import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Truck, Package, Clock, CheckCircle, AlertTriangle, Download, RefreshCw, Search, LogOut, Trash2, Upload, FileText, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import api from '../api';

const Deliveries = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderHistory, setOrderHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showItems, setShowItems] = useState(false);
  const [isEditingNfe, setIsEditingNfe] = useState(false);
  const [editingNfeKey, setEditingNfeKey] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
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
  const userRole = (user.role === 'admin' || user.isAdmin === true || user.is_admin === 1 || user.is_admin === true) ? 'admin' : (user.role || 'operator');
  const canManageDeliveries = userRole === 'admin' || userRole === 'expedicao' || userRole === 'estoque' || userRole === 'gerencia' || userRole === 'lider_estoque';

  const handleLogout = () => {
    localStorage.removeItem('armazem_auth');
    localStorage.removeItem('armazem_token');
    localStorage.removeItem('armazem_user');
    toast.success('Sessão encerrada.');
    navigate('/login');
  };

  useEffect(() => {
    const userRole = (user.role === 'admin' || user.isAdmin === true || user.is_admin === 1 || user.is_admin === true) ? 'admin' : (user.role || 'operator');
    if (userRole !== 'admin' && userRole !== 'expedicao' && userRole !== 'estoque' && userRole !== 'gerencia' && userRole !== 'lider_estoque') {
      toast.error('Acesso negado. Você não tem permissão para acessar a tela de expedição.');
      navigate('/');
    }
    fetchOrders();
  }, []);

  useEffect(() => {
    filterOrders();
    setCurrentPage(1);
  }, [orders, searchTerm, statusFilter]);

  useEffect(() => {
    if (selectedOrder) {
      fetchOrderHistory(selectedOrder.id);
      setShowItems(false);
      setIsEditingNfe(false);
      setEditingNfeKey('');
    } else {
      setOrderHistory([]);
    }
  }, [selectedOrder]);

  const fetchOrderHistory = async (orderId) => {
    setLoadingHistory(true);
    try {
      const response = await api.get(`/orders/${orderId}/history`);
      setOrderHistory(response.data);
    } catch (error) {
      console.error('Erro ao buscar histórico do pedido:', error);
      toast.error('Erro ao carregar o histórico de movimentação.');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSaveNfeKey = async () => {
    if (editingNfeKey && editingNfeKey.length !== 44) {
      toast.error('A chave de acesso da NF-e deve conter exatamente 44 números.');
      return;
    }

    try {
      const response = await api.put(`/orders/${selectedOrder.id}/nfe-key`, { nfeKey: editingNfeKey || null });
      toast.success(response.data.message);
      setSelectedOrder(prev => ({ ...prev, nfe_key: editingNfeKey || null }));
      setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, nfe_key: editingNfeKey || null } : o));
      setIsEditingNfe(false);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao salvar chave de acesso.');
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await api.get('/orders');
      setOrders(response.data);
    } catch (error) {
      toast.error('Erro ao carregar os pedidos de expedição.');
    } finally {
      setLoading(false);
    }
  };

  const STATUS_PRIORITY = { 'PENDENTE': 0, 'PREPARANDO': 1, 'EM_ROTA': 2, 'ERRO': 3, 'FINALIZADO': 4 };

  const filterOrders = () => {
    let tempOrders = [...orders];

    if (statusFilter !== 'ALL') {
      tempOrders = tempOrders.filter(o => o.status === statusFilter);
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      tempOrders = tempOrders.filter(o =>
        o.store_name.toLowerCase().includes(search) ||
        o.id.toString().includes(search) ||
        (o.emitter_name && o.emitter_name.toLowerCase().includes(search))
      );
    }

    tempOrders.sort((a, b) => {
      const pa = STATUS_PRIORITY[a.status] ?? 5;
      const pb = STATUS_PRIORITY[b.status] ?? 5;
      if (pa !== pb) return pa - pb;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    setFilteredOrders(tempOrders);
  };

  const handleUpdateStatus = async (id, newStatus) => {
    const userRole = (user.role === 'admin' || user.isAdmin === true || user.is_admin === 1 || user.is_admin === true) ? 'admin' : (user.role || 'operator');
    const allowedRolesForFinishing = ['admin', 'estoque', 'expedicao', 'gerencia', 'lider_estoque'];
    if ((newStatus === 'FINALIZADO' || newStatus === 'ERRO') && !allowedRolesForFinishing.includes(userRole)) {
      toast.error('Acesso negado. Apenas usuários dos cargos de estoque, expedição, gerência ou administradores podem finalizar pedidos.');
      return;
    }

    try {
      await api.put(`/orders/${id}/status`, { status: newStatus });
      toast.success(`Status atualizado para: ${newStatus}`);
      fetchOrders();
      if (selectedOrder && selectedOrder.id === id) {
        fetchOrderHistory(id);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao atualizar status.');
    }
  };

  const handleDeleteOrder = (id) => {
    showConfirm(
      'Confirmar Exclusão',
      `Tem certeza que deseja excluir o pedido #${id} definitivamente da fila de expedição?`,
      async () => {
        try {
          await api.delete(`/orders/${id}`);
          toast.success('Pedido excluído com sucesso.');
          fetchOrders();
        } catch (error) {
          toast.error(error.response?.data?.error || 'Erro ao excluir o pedido.');
        }
      }
    );
  };

  const handleFileUpload = async (e, orderId, type) => {
    const file = e.target.files[0];
    if (!file) return;

    // Reset the input value so the change event triggers again for the same file
    e.target.value = '';

    if (file.size > 100 * 1024 * 1024) {
      toast.error('O arquivo deve ter no máximo 100MB.');
      return;
    }

    const loadToast = toast.loading(`Enviando ${type === 'invoice' ? 'Nota Fiscal' : 'Romaneio'}...`);

    try {
      const formData = new FormData();
      formData.append('type', type);
      formData.append('file', file);
      await api.put(`/orders/${orderId}/upload`, formData);
      toast.dismiss(loadToast);
      toast.success(`${type === 'invoice' ? 'Nota Fiscal' : 'Romaneio'} enviada com sucesso!`);
      fetchOrders();
    } catch (err) {
      toast.dismiss(loadToast);
      toast.error(err.response?.data?.error || 'Erro ao enviar arquivo.');
    }
  };

  const handleDeleteFile = (orderId, type) => {
    const typeLabel = type === 'invoice' ? 'Nota Fiscal' : 'Romaneio';
    showConfirm(
      'Confirmar Exclusão',
      `Tem certeza que deseja excluir o documento de ${typeLabel} do pedido #${orderId}?`,
      async () => {
        try {
          await api.delete(`/orders/${orderId}/upload/${type}`);
          toast.success(`${typeLabel} excluído com sucesso.`);
          fetchOrders();
        } catch (error) {
          toast.error(error.response?.data?.error || 'Erro ao excluir o documento.');
        }
      }
    );
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDENTE':
        return (
          <span style={{ 
            fontSize: '0.75rem', padding: '6px 10px', fontWeight: '700', textTransform: 'uppercase',
            background: 'rgba(115, 115, 115, 0.15)', color: 'var(--text-muted)', border: '1px solid var(--border)',
            display: 'inline-flex', alignItems: 'center', gap: '6px'
          }}>
            <Clock size={12} /> Pendente
          </span>
        );
      case 'PREPARANDO':
        return (
          <span style={{ 
            fontSize: '0.75rem', padding: '6px 10px', fontWeight: '700', textTransform: 'uppercase',
            background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid #3b82f6',
            display: 'inline-flex', alignItems: 'center', gap: '6px'
          }}>
            <Package size={12} /> Preparando
          </span>
        );
      case 'EM_ROTA':
        return (
          <span style={{ 
            fontSize: '0.75rem', padding: '6px 10px', fontWeight: '700', textTransform: 'uppercase',
            background: 'rgba(245, 158, 11, 0.15)', color: 'var(--primary)', border: '1px solid var(--primary)',
            display: 'inline-flex', alignItems: 'center', gap: '6px'
          }}>
            <Truck size={12} /> Em Rota
          </span>
        );
      case 'FINALIZADO':
        return (
          <span style={{ 
            fontSize: '0.75rem', padding: '6px 10px', fontWeight: '700', textTransform: 'uppercase',
            background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', border: '1px solid #22c55e',
            display: 'inline-flex', alignItems: 'center', gap: '6px'
          }}>
            <CheckCircle size={12} /> Entregue
          </span>
        );
      case 'ERRO':
        return (
          <span style={{ 
            fontSize: '0.75rem', padding: '6px 10px', fontWeight: '700', textTransform: 'uppercase',
            background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid #ef4444',
            display: 'inline-flex', alignItems: 'center', gap: '6px'
          }}>
            <AlertTriangle size={12} /> Com Erros
          </span>
        );
      default:
        return null;
    }
  };

  const getStatusName = (status) => {
    if (!status) return 'PEDIDO CRIADO';
    switch (status) {
      case 'PENDENTE': return 'Pendente';
      case 'PREPARANDO': return 'Preparando';
      case 'EM_ROTA': return 'Em Rota';
      case 'FINALIZADO': return 'Entregue';
      case 'ERRO': return 'Com Erros';
      default: return status;
    }
  };

  const generateSignatureImage = (name) => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 120;
    const ctx = canvas.getContext('2d');
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const angle = ((hash % 10) - 5) * (Math.PI / 180);
    const scale = 1 + ((hash % 20) - 10) / 100;
    const color = Math.abs(hash % 2) === 0 ? '#1e3a8a' : '#0f172a';
    
    ctx.translate(200, 60);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    
    ctx.font = 'italic 46px "Brush Script MT", "Lucida Handwriting", "Bradley Hand", cursive';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    ctx.fillText(name, 0, 0);
    
    return canvas.toDataURL('image/png');
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
      return null;
    }
  };

  const handleDownloadPDF = async (order) => {
    const loadToast = toast.loading('Gerando PDF do Pedido...');
    try {
      const logoBase64 = await getBase64ImageFromUrl('/loja.png');
      const doc = new jsPDF('p', 'mm', 'a4');

      const colorAmber = [245, 158, 11];
      const colorDark = [38, 38, 38];

      const parsedCreated = (typeof order.created_at === 'string' && !order.created_at.endsWith('Z') && !order.created_at.includes('T'))
        ? order.created_at.replace(' ', 'T') + 'Z'
        : order.created_at;
      const orderDate = new Date(parsedCreated).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Header drawing
      const drawHeader = (pageNumber) => {
        doc.setFillColor(colorAmber[0], colorAmber[1], colorAmber[2]);
        doc.rect(0, 0, 210, 5, 'F');

        if (pageNumber === 1) {
          let textXOffset = 20;
          if (logoBase64) {
            doc.addImage(logoBase64, 'PNG', 20, 15, 35, 18);
            textXOffset = 62;
          } else {
            doc.setDrawColor(colorAmber[0], colorAmber[1], colorAmber[2]);
            doc.setLineWidth(0.8);
            doc.rect(20, 15, 35, 18);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(colorAmber[0], colorAmber[1], colorAmber[2]);
            doc.text("KLA LOGÍSTICA", 37.5, 25, { align: 'center' });
            textXOffset = 62;
          }

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(14);
          doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
          doc.text(order.store_name.toUpperCase(), textXOffset, 22);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(120, 120, 120);
          doc.text("SOLICITAÇÃO INTERNA DE PEDIDO DE COMPRA", textXOffset, 27);

          doc.line(20, 38, 190, 38);

          doc.setFillColor(250, 250, 250);
          doc.rect(20, 42, 170, 20, 'F');
          doc.setDrawColor(230, 230, 230);
          doc.rect(20, 42, 170, 20);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(80, 80, 80);
          doc.text("Responsável Emissor:", 25, 49);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          doc.text(order.emitter_name || 'Administrador', 25, 54);

          doc.setFont('helvetica', 'bold');
          doc.setTextColor(80, 80, 80);
          doc.text("Número do Pedido:", 95, 49);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(245, 158, 11);
          doc.text(`#${order.id}`, 95, 54);

          doc.setFont('helvetica', 'bold');
          doc.setTextColor(80, 80, 80);
          doc.text("Data de Emissão:", 145, 49);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          doc.text(orderDate, 145, 54);
        } else {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
          doc.text(`SOLICITAÇÃO DE PEDIDO DE COMPRA - ${order.store_name.toUpperCase()} (Pág. ${pageNumber})`, 20, 15);
          doc.line(20, 18, 190, 18);
        }
      };

      const drawTableHeader = (y) => {
        doc.setFillColor(colorDark[0], colorDark[1], colorDark[2]);
        doc.rect(20, y, 170, 8, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text("SKU", 22, y + 5.5);
        doc.text("NOME DO PRODUTO", 45, y + 5.5);
        doc.text("QUANTIDADE", 145, y + 5.5);
        doc.text("UNIDADE", 172, y + 5.5);
      };

      let pageNum = 1;
      let pageTableStartY = 74;
      let currentY = pageTableStartY;

      drawHeader(pageNum);
      drawTableHeader(currentY);
      currentY += 8;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);

      order.items.forEach((item, index) => {
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
        doc.text(item.sku, 22, currentY + 6);

        doc.setFont('helvetica', 'normal');
        const itemDesc = item.name.length > 50 ? item.name.substring(0, 47) + '...' : item.name;
        doc.text(itemDesc.toUpperCase(), 45, currentY + 6);

        doc.setFont('helvetica', 'bold');
        doc.text(item.quantity.toString(), 145, currentY + 6);
        
        let finalUnit = (item.unit || 'UN').toUpperCase();
        if (item.name && /\(CX\)/i.test(item.name)) {
          finalUnit = 'CX';
        }
        doc.text(finalUnit, 172, currentY + 6);

        currentY += 9;
      });

      doc.setDrawColor(200, 200, 200);
      doc.line(20, currentY, 190, currentY);
      doc.line(20, pageTableStartY, 20, currentY);
      doc.line(190, pageTableStartY, 190, currentY);

      const signatureY = Math.max(240, currentY + 15);
      
      const emitterName = order.emitter_name || 'Operador do Armazém';
      const signatureImage = generateSignatureImage(emitterName);
      if (signatureImage) {
        doc.addImage(signatureImage, 'PNG', 65, signatureY - 22, 80, 24);
      }

      doc.setDrawColor(180, 180, 180);
      doc.line(60, signatureY, 150, signatureY);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text("ASSINATURA DO RESPONSÁVEL", 105, signatureY + 5, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.text(emitterName, 105, signatureY + 10, { align: 'center' });

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.5);
      doc.setTextColor(160, 160, 160);
      doc.text("Assinatura gerada digitalmente", 105, signatureY + 14, { align: 'center' });

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
      toast.success('Pedido gerado com sucesso!');
    } catch (err) {
      toast.dismiss(loadToast);
      toast.error('Erro ao re-gerar o PDF.');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const parsedStr = (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('T')) 
        ? dateStr.replace(' ', 'T') + 'Z' 
        : dateStr;
      const date = new Date(parsedStr);
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  };

  const ITEMS_PER_PAGE = 15;
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ITEMS_PER_PAGE));
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentOrders = filteredOrders.slice(indexOfFirstItem, indexOfLastItem);

  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = [];
    const left = Math.max(2, currentPage - 1);
    const right = Math.min(totalPages - 1, currentPage + 1);
    pages.push(1);
    if (left > 2) pages.push('...');
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < totalPages - 1) pages.push('...');
    pages.push(totalPages);
    return pages;
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
          <h2 style={{ fontSize: '1.1rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px' }}>Expedição & Entregas</h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ textAlign: 'right' }}>
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

      <main style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <section className="glass-card animate-fade-in" style={{ padding: '20px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', flex: '1', minWidth: '280px' }}>
              <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  placeholder="Pesquisar por loja ou ID..."
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
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
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
                  <option value="ALL">Todos os Status</option>
                  <option value="PENDENTE">Pendentes</option>
                  <option value="PREPARANDO">Preparando</option>
                  <option value="EM_ROTA">Em Rota</option>
                  <option value="FINALIZADO">Entregues</option>
                  <option value="ERRO">Com Erros</option>
                </select>
              </div>
            </div>

            <div>
              <button 
                onClick={fetchOrders} 
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
            </div>
          </div>
        </section>

        <section className="glass-card animate-fade-in" style={{ padding: '28px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase', fontSize: '0.9rem', letterSpacing: '1px' }}>
              <Truck size={20} color="var(--primary)" /> Fila de Expedição
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>
              {filteredOrders.length === 0
                ? 'Nenhum pedido'
                : `Exibindo ${indexOfFirstItem + 1}–${Math.min(indexOfLastItem, filteredOrders.length)} de ${filteredOrders.length} pedido${filteredOrders.length !== 1 ? 's' : ''}`}
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>Pedido</th>
                  <th style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>Loja</th>
                  <th style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>Status</th>
                  <th style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>Equipe</th>
                  <th style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center' }}>Itens</th>
                  <th style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>Documentos</th>
                  <th style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>Carregando pedidos...</td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>Nenhum pedido encontrado.</td>
                  </tr>
                ) : (
                  currentOrders.map(order => (
                    <tr key={order.id} style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.3)', transition: 'background 0.15s' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Pedido: ID + data */}
                      <td data-label="Pedido" style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: '800', color: 'var(--primary)', fontSize: '0.9rem' }}>#{order.id}</span>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{formatDate(order.created_at)}</div>
                      </td>

                      {/* Loja */}
                      <td data-label="Loja" style={{ padding: '12px', fontWeight: '600', maxWidth: '200px' }}>
                        {order.store_name}
                      </td>

                      {/* Status */}
                      <td data-label="Status" style={{ padding: '12px' }}>{getStatusBadge(order.status)}</td>

                      {/* Equipe */}
                      <td data-label="Equipe" style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            <strong>Emissor:</strong> {order.emitter_name || 'Sistema'}
                          </span>
                          {order.acceptor_name && (
                            <span style={{ fontSize: '0.78rem', color: '#3b82f6' }}>
                              <strong>Aceito:</strong> {order.acceptor_name}
                            </span>
                          )}
                          {order.finalizer_name && (
                            <span style={{ fontSize: '0.78rem', color: order.status === 'FINALIZADO' ? '#22c55e' : '#ef4444' }}>
                              <strong>{order.status === 'FINALIZADO' ? 'Conferido:' : 'Divergido:'}</strong> {order.finalizer_name}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Itens */}
                      <td data-label="Itens" style={{ padding: '12px', textAlign: 'center' }}>
                        <button
                          onClick={() => setSelectedOrder(order)}
                          style={{
                            background: 'rgba(245, 158, 11, 0.08)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            color: 'var(--primary)',
                            padding: '5px 10px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            transition: 'all 0.15s'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(245,158,11,0.18)'; e.currentTarget.style.borderColor = 'var(--primary)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(245,158,11,0.08)'; e.currentTarget.style.borderColor = 'rgba(245,158,11,0.3)'; }}
                          title="Ver itens do pedido"
                        >
                          <Package size={13} /> {order.items?.length || 0}
                        </button>
                      </td>

                      {/* Documentos */}
                      <td data-label="Documentos" style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {order.invoice_path ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <a href={`/api/uploads/${order.invoice_path}`} target="_blank" rel="noopener noreferrer"
                                style={{ color: 'var(--primary)', fontSize: '0.75rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: '700' }}
                                onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                                onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                              >
                                <FileText size={12} /> NF-e
                              </a>
                              <button onClick={() => handleDeleteFile(order.id, 'invoice')}
                                style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px', display: 'inline-flex' }}
                                title="Excluir Nota Fiscal"
                              ><Trash2 size={11} /></button>
                            </div>
                          ) : (
                            <label style={{ color: 'var(--text-muted)', fontSize: '0.72rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', transition: 'color 0.2s' }}
                              onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                            >
                              <Upload size={11} /> NF-e
                              <input type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, order.id, 'invoice')} />
                            </label>
                          )}
                          {order.packing_slip_path ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <a href={`/api/uploads/${order.packing_slip_path}`} target="_blank" rel="noopener noreferrer"
                                style={{ color: 'var(--primary)', fontSize: '0.75rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: '700' }}
                                onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                                onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                              >
                                <FileText size={12} /> Romaneio
                              </a>
                              <button onClick={() => handleDeleteFile(order.id, 'packing_slip')}
                                style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px', display: 'inline-flex' }}
                                title="Excluir Romaneio"
                              ><Trash2 size={11} /></button>
                            </div>
                          ) : (
                            <label style={{ color: 'var(--text-muted)', fontSize: '0.72rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', transition: 'color 0.2s' }}
                              onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                            >
                              <Upload size={11} /> Romaneio
                              <input type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, order.id, 'packing_slip')} />
                            </label>
                          )}
                        </div>
                      </td>

                      {/* Ações */}
                      <td data-label="Ações" style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                          <button onClick={() => handleDownloadPDF(order)}
                            style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)', padding: '5px 9px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase' }}
                            title="Baixar PDF"
                          ><Download size={11} /> PDF</button>

                          {order.status === 'PENDENTE' && canManageDeliveries && (
                            <button onClick={() => handleUpdateStatus(order.id, 'PREPARANDO')}
                              style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid #3b82f6', color: '#3b82f6', padding: '5px 9px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase' }}
                            >Aceitar</button>
                          )}
                          {order.status === 'PREPARANDO' && canManageDeliveries && (
                            <button onClick={() => handleUpdateStatus(order.id, 'EM_ROTA')}
                              style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid var(--primary)', color: 'var(--primary)', padding: '5px 9px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase' }}
                            ><Truck size={11} /> Despachar</button>
                          )}
                          {order.status === 'EM_ROTA' && canManageDeliveries && (
                            <>
                              <button onClick={() => handleUpdateStatus(order.id, 'FINALIZADO')}
                                style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid #22c55e', color: '#22c55e', padding: '5px 9px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase' }}
                              >Finalizar</button>
                              <button onClick={() => handleUpdateStatus(order.id, 'ERRO')}
                                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid #ef4444', color: '#ef4444', padding: '5px 9px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase' }}
                              >Divergência</button>
                            </>
                          )}
                          {user.isAdmin && (
                            <button onClick={() => handleDeleteOrder(order.id)}
                              style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '5px 7px', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '0.72rem' }}
                              title="Excluir da Fila"
                            ><Trash2 size={12} /></button>
                          )}
                          <button onClick={() => setSelectedOrder(order)}
                            style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--primary)', padding: '5px 7px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            title="Ver Detalhes"
                          ><Info size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação — sempre visível */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border)'
          }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
              Página {currentPage} de {totalPages}
            </span>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                style={{
                  background: 'transparent', border: '1px solid var(--border)',
                  color: currentPage === 1 ? 'var(--text-muted)' : 'var(--primary)',
                  padding: '6px 14px', fontWeight: '700', cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  fontSize: '0.75rem', textTransform: 'uppercase', opacity: currentPage === 1 ? 0.4 : 1
                }}
              >← Anterior</button>

              {getPageNumbers().map((p, idx) =>
                p === '...' ? (
                  <span key={`ellipsis-${idx}`} style={{ color: 'var(--text-muted)', padding: '0 4px', fontSize: '0.8rem' }}>…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    style={{
                      background: p === currentPage ? 'var(--primary)' : 'transparent',
                      border: '1px solid var(--border)',
                      color: p === currentPage ? '#000' : '#fff',
                      width: '32px', height: '32px',
                      fontWeight: '700', cursor: 'pointer', fontSize: '0.75rem'
                    }}
                  >{p}</button>
                )
              )}

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                style={{
                  background: 'transparent', border: '1px solid var(--border)',
                  color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--primary)',
                  padding: '6px 14px', fontWeight: '700', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '0.75rem', textTransform: 'uppercase', opacity: currentPage === totalPages ? 0.4 : 1
                }}
              >Próximo →</button>
            </div>
          </div>
        </section>
      </main>

      {/* Modal de Detalhes dos Produtos */}
      {selectedOrder && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="glass-card animate-fade-in" style={{
            width: '100%',
            maxWidth: '650px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            padding: '28px',
            border: '1px solid var(--border)',
            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5), 0 8px 10px -6px rgb(0 0 0 / 0.5)',
            background: '#121212',
            borderRadius: '0px'
          }}>
            {/* Modal Header */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '20px', 
              borderBottom: '2px solid var(--primary)', 
              paddingBottom: '12px' 
            }}>
              <h3 style={{ textTransform: 'uppercase', fontSize: '1.05rem', fontWeight: '900', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={18} color="var(--primary)" /> Produtos do Pedido #{selectedOrder.id}
              </h3>
              <button 
                onClick={() => setSelectedOrder(null)} 
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: 'var(--text-muted)', 
                  fontSize: '1.5rem', 
                  cursor: 'pointer', 
                  lineHeight: 1,
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => e.target.style.color = '#fff'}
                onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
              >
                &times;
              </button>
            </div>
            {/* Modal Body */}
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '8px', marginBottom: '20px' }}>
              {/* NF-e Section */}
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border)',
                padding: '16px',
                marginBottom: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Chave de Acesso NF-e (44 dígitos)
                  </span>
                  {selectedOrder.nfe_key && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedOrder.nfe_key);
                        toast.success('Chave de acesso copiada!');
                      }}
                      style={{
                        background: 'var(--primary)',
                        border: 'none',
                        color: '#000',
                        padding: '4px 10px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        fontSize: '0.7rem',
                        textTransform: 'uppercase',
                        borderRadius: '0px'
                      }}
                    >
                      Copiar Chave
                    </button>
                  )}
                </div>

                {selectedOrder.nfe_key ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#fff', letterSpacing: '0.5px', wordBreak: 'break-all' }}>
                      {selectedOrder.nfe_key}
                    </span>
                    {userRole === 'admin' && (
                      <button
                        onClick={() => {
                          setEditingNfeKey(selectedOrder.nfe_key);
                          setIsEditingNfe(true);
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--primary)',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          textDecoration: 'underline'
                        }}
                      >
                        Editar
                      </button>
                    )}
                  </div>
                ) : (
                  <div>
                    {isEditingNfe && userRole === 'admin' ? (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          maxLength={44}
                          placeholder="Cole a chave de 44 dígitos aqui..."
                          value={editingNfeKey}
                          onChange={(e) => setEditingNfeKey(e.target.value.replace(/\D/g, ''))}
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            background: '#000',
                            border: '1px solid var(--border)',
                            color: '#fff',
                            fontSize: '0.8rem',
                            outline: 'none',
                            fontFamily: 'monospace'
                          }}
                        />
                        <button
                          onClick={handleSaveNfeKey}
                          style={{
                            background: 'var(--primary)',
                            border: 'none',
                            color: '#000',
                            padding: '8px 14px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            fontSize: '0.75rem'
                          }}
                        >
                          Salvar
                        </button>
                        <button
                          onClick={() => setIsEditingNfe(false)}
                          style={{
                            background: 'transparent',
                            border: '1px solid var(--border)',
                            color: '#fff',
                            padding: '8px 14px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            fontSize: '0.75rem'
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Nenhuma chave de acesso vinculada.
                        </span>
                        {userRole === 'admin' && (
                          <button
                            onClick={() => {
                              setEditingNfeKey('');
                              setIsEditingNfe(true);
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--primary)',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              textDecoration: 'underline'
                            }}
                          >
                            Vincular Chave
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Loja & Produtos Header */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '16px', 
                fontSize: '0.85rem', 
                background: 'rgba(255,255,255,0.03)',
                padding: '12px',
                border: '1px solid var(--border)'
              }}>
                <div>Loja: <strong style={{ color: 'var(--primary)' }}>{selectedOrder.store_name}</strong></div>
                <button
                  onClick={() => setShowItems(!showItems)}
                  style={{
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    color: 'var(--primary)',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    borderRadius: '0px'
                  }}
                >
                  {showItems ? 'Minimizar Itens' : `Ver Itens (${selectedOrder.items?.reduce((sum, item) => sum + item.quantity, 0)} un)`}
                </button>
              </div>

              {showItems && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: '20px' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', textTransform: 'uppercase' }}>
                      <th style={{ padding: '10px 8px', color: 'var(--text-muted)', width: '20%' }}>SKU</th>
                      <th style={{ padding: '10px 8px', color: 'var(--text-muted)', width: '50%' }}>Nome do Produto</th>
                      <th style={{ padding: '10px 8px', color: 'var(--text-muted)', textAlign: 'right', width: '15%' }}>Qtd</th>
                      <th style={{ padding: '10px 8px', color: 'var(--text-muted)', textAlign: 'center', width: '15%' }}>Unid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items?.map((it, idx) => (
                      <tr key={it.id} style={{ 
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        background: idx % 2 === 1 ? 'rgba(255,255,255,0.01)' : 'transparent'
                      }}>
                        <td style={{ padding: '10px 8px', fontWeight: 'bold', color: 'var(--primary)' }}>{it.sku}</td>
                        <td style={{ padding: '10px 8px', textTransform: 'uppercase' }}>{it.name}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 'bold' }}>{it.quantity}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 'bold' }}>{(it.unit || 'UN').toUpperCase()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <h4 style={{ 
                textTransform: 'uppercase', 
                fontSize: '0.8rem', 
                fontWeight: '900', 
                letterSpacing: '1px', 
                marginTop: '30px', 
                marginBottom: '16px', 
                color: 'var(--primary)',
                borderBottom: '1px solid var(--border)',
                paddingBottom: '8px'
              }}>
                Histórico de Movimentação
              </h4>

              {loadingHistory ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '12px' }}>
                  Carregando histórico...
                </div>
              ) : (
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '20px', 
                  position: 'relative', 
                  paddingLeft: '24px', 
                  marginLeft: '8px', 
                  borderLeft: '1px solid var(--border)',
                  marginTop: '16px'
                }}>
                  {/* Virtual creation event */}
                  {(() => {
                    const parsedTime = (typeof selectedOrder.created_at === 'string' && !selectedOrder.created_at.endsWith('Z') && !selectedOrder.created_at.includes('T'))
                      ? selectedOrder.created_at.replace(' ', 'T') + 'Z'
                      : selectedOrder.created_at;
                    const date = new Date(parsedTime);
                    const formattedCreatedDate = date.toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    });
                    return (
                      <div style={{ position: 'relative' }}>
                        <div style={{
                          position: 'absolute',
                          left: '-31px',
                          top: '2px',
                          width: '12px',
                          height: '12px',
                          borderRadius: '0%',
                          background: 'var(--primary)',
                          border: '2px solid #121212',
                          boxShadow: '0 0 0 2px var(--border)'
                        }} />
                        <div style={{ fontSize: '0.8rem', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontWeight: 'bold', color: '#fff' }}>
                            Pedido Criado
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            ({formattedCreatedDate})
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Emissor: <strong style={{ color: '#fff' }}>{selectedOrder.emitter_name || 'Sistema'}</strong>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Other transitions from database */}
                  {orderHistory
                    .filter(hist => hist.old_status !== null && hist.old_status !== undefined && hist.old_status !== '')
                    .map((hist) => {
                      const parsedTime = (typeof hist.created_at === 'string' && !hist.created_at.endsWith('Z') && !hist.created_at.includes('T'))
                        ? hist.created_at.replace(' ', 'T') + 'Z'
                        : hist.created_at;
                      const date = new Date(parsedTime);
                      const formattedDate = date.toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      });
                      
                      return (
                        <div key={hist.id} style={{ position: 'relative' }}>
                          {/* Timeline dot */}
                          <div style={{
                            position: 'absolute',
                            left: '-31px',
                            top: '2px',
                            width: '12px',
                            height: '12px',
                            borderRadius: '0%',
                            background: hist.new_status === 'FINALIZADO' ? '#22c55e' : hist.new_status === 'ERRO' ? '#ef4444' : 'var(--primary)',
                            border: '2px solid #121212',
                            boxShadow: '0 0 0 2px var(--border)'
                          }} />
                          <div style={{ fontSize: '0.8rem', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontWeight: 'bold', color: '#fff' }}>
                              {getStatusName(hist.old_status)} ➔ {getStatusName(hist.new_status)}
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                              ({formattedDate})
                            </span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Operador: <strong style={{ color: '#fff' }}>{hist.user_full_name || hist.username || 'Sistema'}</strong>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <button 
                onClick={() => setSelectedOrder(null)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: '#fff',
                  padding: '8px 20px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#fff';
                  e.target.style.color = '#000';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                  e.target.style.color = '#fff';
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Confirmação Customizado */}
      {confirmConfig.isOpen && (
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
            maxWidth: '400px',
            width: '100%',
            padding: '32px',
            background: '#121212',
            border: '1px solid var(--border)',
            borderRadius: '0px',
            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5), 0 8px 10px -6px rgb(0 0 0 / 0.5)'
          }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '900', textTransform: 'uppercase', marginBottom: '16px', color: 'var(--primary)', letterSpacing: '1px' }}>
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
                  letterSpacing: '1px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.color = '#fff'}
                onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
              >
                Cancelar
              </button>
              <button 
                onClick={confirmConfig.onConfirm}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #ef4444',
                  color: '#ef4444',
                  padding: '10px 20px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  letterSpacing: '1px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#ef4444';
                  e.target.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(239, 68, 68, 0.15)';
                  e.target.style.color = '#ef4444';
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

export default Deliveries;
