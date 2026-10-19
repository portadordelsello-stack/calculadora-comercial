import React, { useState } from 'react';
import { Customer, Sale } from '../types';
import { 
  BookOpen, Plus, Search, Phone, FileText, 
  Trash2, X, CheckCircle2, Loader2, ArrowLeft,
  DollarSign, Calendar
} from 'lucide-react';
import { supabase } from '../supabase';

interface CustomersManagementProps {
  businessId: string;
  customers: Customer[];
  sales: Sale[];
  onRefreshCustomers: () => void;
  onBack: () => void;
}

export const CustomersManagement: React.FC<CustomersManagementProps> = ({
  businessId,
  customers,
  sales,
  onRefreshCustomers,
  onBack
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Modal Nuevo Cliente
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Modal Registrar Pago / Abono
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Filtrar clientes por búsqueda
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone && c.phone.includes(searchTerm))
  );

  // Crear Cliente
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setErrorMsg('El nombre es obligatorio.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const { error } = await supabase.from('customers').insert([{
        business_id: businessId,
        name: newName.trim(),
        phone: newPhone.trim() || null,
        notes: newNotes.trim() || null,
        balance: 0.00
      }]);

      if (error) throw error;

      setShowCreateModal(false);
      setNewName('');
      setNewPhone('');
      setNewNotes('');
      onRefreshCustomers();
    } catch (err: any) {
      console.error('Error creando cliente:', err);
      setErrorMsg(err.message || 'Error al guardar cliente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Registrar Pago / Cancelación de Deuda
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const amountNum = parseFloat(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Ingresa un monto válido mayor a 0');
      return;
    }

    setIsProcessingPayment(true);
    try {
      const newBalance = Math.max(0, Number(selectedCustomer.balance) - amountNum);
      const { error } = await supabase
        .from('customers')
        .update({ balance: newBalance })
        .eq('id', selectedCustomer.id);

      if (error) throw error;

      alert(`Pago de $${amountNum.toLocaleString('en-US', { minimumFractionDigits: 2 })} registrado con éxito.`);
      setSelectedCustomer(prev => prev ? { ...prev, balance: newBalance } : null);
      setShowPaymentModal(false);
      setPaymentAmount('');
      onRefreshCustomers();
    } catch (err: any) {
      console.error('Error registrando pago:', err);
      alert('Error al registrar el pago: ' + err.message);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Eliminar Cliente
  const handleDeleteCustomer = async (cust: Customer) => {
    if (!confirm(`¿Eliminar al cliente "${cust.name}" de la libreta?`)) return;

    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', cust.id);

      if (error) throw error;
      if (selectedCustomer?.id === cust.id) {
        setSelectedCustomer(null);
      }
      onRefreshCustomers();
    } catch (err: any) {
      alert('Error eliminando cliente: ' + err.message);
    }
  };

  // Ventas fiadas históricas del cliente seleccionado
  const customerSales = selectedCustomer 
    ? sales.filter(s => s.paymentMethod === 'Libreta' && (s.customerId === selectedCustomer.id || s.customerName?.toLowerCase() === selectedCustomer.name.toLowerCase()))
    : [];

  return (
    <div className="h-full w-full flex flex-col p-4 md:p-6 overflow-hidden max-w-6xl mx-auto animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2.5 bg-brand-card hover:opacity-90 rounded-xl text-brand-text-main border border-black/10 transition-all"
            title="Volver"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-brand-text-main flex items-center gap-2">
                <BookOpen className="text-amber-500" />
                Libreta de Clientes
              </h1>
              <span className="text-xs bg-amber-500/10 text-amber-500 font-bold px-2.5 py-0.5 rounded-full border border-amber-500/20">
                Fiados y Cuentas Corrientes
              </span>
            </div>
            <p className="text-xs text-brand-text-muted mt-0.5">
              Administración de clientes y saldo deudor acumulado
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all text-sm"
          >
            <Plus size={18} />
            <span>Nuevo Cliente</span>
          </button>
        </div>
      </div>

      {/* Main Layout: Lista de clientes a la izquierda, detalle a la derecha */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 min-h-0 overflow-hidden">
        
        {/* Columna Izquierda: Buscador y Lista de Clientes */}
        <div className="md:col-span-5 flex flex-col bg-brand-card border border-white/10 rounded-2xl overflow-hidden shadow-xl min-h-0">
          {/* Input Buscador */}
          <div className="p-4 border-b border-white/10">
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-muted">
                <Search size={18} />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar cliente por nombre o teléfono..."
                className="w-full bg-brand-display-bg border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-brand-text-main placeholder-brand-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
          </div>

          {/* Lista scrollable */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/5 p-2 space-y-1">
            {filteredCustomers.map(cust => {
              const isSelected = selectedCustomer?.id === cust.id;
              const hasDebt = Number(cust.balance) > 0;

              return (
                <div
                  key={cust.id}
                  onClick={() => setSelectedCustomer(cust)}
                  className={`p-3.5 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-3 ${
                    isSelected 
                      ? 'bg-amber-500/15 border border-amber-500/30' 
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                      hasDebt ? 'bg-amber-500/20 text-amber-500' : 'bg-white/10 text-brand-text-muted'
                    }`}>
                      {cust.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-brand-text-main text-sm truncate">{cust.name}</h4>
                      {cust.phone && (
                        <p className="text-xs text-brand-text-muted flex items-center gap-1">
                          <Phone size={11} /> {cust.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] uppercase font-bold text-brand-text-muted block">Deuda</span>
                    <span className={`font-mono font-bold text-sm ${hasDebt ? 'text-amber-400' : 'text-emerald-400'}`}>
                      ${Number(cust.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              );
            })}

            {filteredCustomers.length === 0 && (
              <div className="p-8 text-center text-brand-text-muted text-sm">
                No se encontraron clientes. Presiona <strong>"+ Nuevo Cliente"</strong> para agregar uno.
              </div>
            )}
          </div>
        </div>

        {/* Columna Derecha: Detalle del Cliente y Compras Fiadas */}
        <div className="md:col-span-7 flex flex-col bg-brand-card border border-white/10 rounded-2xl overflow-hidden shadow-xl min-h-0">
          {selectedCustomer ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Header Ficha Cliente */}
              <div className="p-5 border-b border-white/10 bg-black/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-brand-text-main">{selectedCustomer.name}</h3>
                  <div className="flex items-center gap-3 text-xs text-brand-text-muted mt-1">
                    {selectedCustomer.phone && (
                      <span className="flex items-center gap-1"><Phone size={12} /> {selectedCustomer.phone}</span>
                    )}
                    {selectedCustomer.notes && (
                      <span className="flex items-center gap-1"><FileText size={12} /> {selectedCustomer.notes}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowPaymentModal(true)}
                    className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all"
                  >
                    <DollarSign size={14} />
                    <span>Cobrar / Abonar</span>
                  </button>

                  <button
                    onClick={() => handleDeleteCustomer(selectedCustomer)}
                    className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-all border border-red-500/20"
                    title="Eliminar cliente"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Saldo Badge */}
              <div className="p-4 bg-amber-500/5 border-b border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase font-bold text-amber-500 tracking-wider">Saldo Total Adeudado</span>
                  <p className="text-xs text-brand-text-muted">Compras en libreta pendientes de saldar</p>
                </div>
                <div className="text-2xl md:text-3xl font-mono font-bold text-amber-400">
                  ${Number(selectedCustomer.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>

              {/* Historial de Compras Fiadas */}
              <div className="flex-1 overflow-y-auto p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-brand-text-muted mb-3 flex items-center gap-1.5">
                  <Calendar size={13} />
                  Historial de Compras en Libreta
                </h4>

                {customerSales.length > 0 ? (
                  <div className="space-y-2">
                    {customerSales.map(sale => (
                      <div 
                        key={sale.id}
                        className="p-3 bg-brand-display-bg border border-white/5 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5">
                          <span className="font-semibold text-brand-text-main text-sm">
                            ${sale.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                          <p className="text-brand-text-muted">
                            {new Date(sale.date).toLocaleDateString()} • {new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Atendió: {sale.userName}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md font-bold">
                          Libreta
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-brand-text-muted text-xs">
                    No hay compras recientes registradas a nombre de este cliente.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-brand-text-muted">
              <BookOpen size={48} className="mb-3 opacity-30 text-amber-500" />
              <h4 className="font-bold text-brand-text-main text-base">Selecciona un Cliente</h4>
              <p className="text-xs max-w-xs mt-1">
                Elige un cliente de la lista de la izquierda para ver su saldo adeudado y registrar abonos.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Nuevo Cliente */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-brand-card w-full max-w-sm rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
                  <Plus size={18} />
                </div>
                <h3 className="font-bold text-white text-base">Nuevo Cliente</h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="p-5 space-y-4">
              <div>
                <label className="text-xs uppercase font-semibold text-brand-text-muted block mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="ej: Doña Rosa, Carlos Gómez"
                  className="w-full bg-brand-display-bg border border-white/10 rounded-xl p-3 text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  required
                />
              </div>

              <div>
                <label className="text-xs uppercase font-semibold text-brand-text-muted block mb-1">Teléfono / WhatsApp</label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="ej: 11 2345-6789"
                  className="w-full bg-brand-display-bg border border-white/10 rounded-xl p-3 text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <div>
                <label className="text-xs uppercase font-semibold text-brand-text-muted block mb-1">Notas / Referencia</label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="ej: Casa esquina, vecina de enfrente"
                  className="w-full bg-brand-display-bg border border-white/10 rounded-xl p-3 text-sm text-brand-text-main focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition-all"
              >
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                <span>Guardar Cliente</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Registrar Cobro / Abono */}
      {showPaymentModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-brand-card w-full max-w-sm rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
                  <DollarSign size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Registrar Cobro</h3>
                  <p className="text-xs text-brand-text-muted">Abono a {selectedCustomer.name}</p>
                </div>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-5 space-y-4">
              <div className="p-3 bg-white/5 rounded-xl text-center">
                <span className="text-xs text-brand-text-muted block">Deuda Actual</span>
                <span className="text-xl font-bold font-mono text-amber-400">
                  ${Number(selectedCustomer.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div>
                <label className="text-xs uppercase font-semibold text-brand-text-muted block mb-1">Monto que entrega el cliente ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedCustomer.balance}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-brand-display-bg border border-white/10 rounded-xl p-3 text-lg font-mono text-brand-text-main focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={isProcessingPayment}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition-all"
              >
                {isProcessingPayment ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                <span>Confirmar Cobro</span>
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
