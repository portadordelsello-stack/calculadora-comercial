import React, { useState } from 'react';
import { Business, BusinessPlan } from '../types';
import { 
  Building2, Plus, Edit, Power, Shield, Users, 
  Search, AlertCircle, X, KeyRound, 
  Loader2, Sparkles, LogOut, Trash2
} from 'lucide-react';
import { supabase, createAdminHelperClient, buildVirtualEmail } from '../supabase';

interface SuperAdminDashboardProps {
  onLogout: () => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ onLogout }) => {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal Crear Comercio
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBizName, setNewBizName] = useState('');
  const [newBizCode, setNewBizCode] = useState('');
  const [newBizPlan, setNewBizPlan] = useState<BusinessPlan>('estandar');
  const [newBizMaxSellers, setNewBizMaxSellers] = useState(5);
  const [newAdminUsername, setNewAdminUsername] = useState('admin');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Modal Editar Comercio
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBiz, setEditingBiz] = useState<Business | null>(null);
  const [editName, setEditName] = useState('');
  const [editPlan, setEditPlan] = useState<BusinessPlan>('estandar');
  const [editMaxSellers, setEditMaxSellers] = useState(5);
  const [editAdminPassword, setEditAdminPassword] = useState('');

  // Modal Eliminar Comercio
  const [businessToDelete, setBusinessToDelete] = useState<Business | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Cargar lista de comercios
  const fetchBusinesses = React.useCallback(async () => {
    try {
      setLoading(true);
      const { data: bizData, error: bizError } = await supabase
        .from('businesses')
        .select('*')
        .order('created_at', { ascending: false });

      if (bizError) throw bizError;

      // Obtener conteo de cajeros por comercio
      const { data: profData } = await supabase
        .from('profiles')
        .select('business_id, role');

      const mapped: Business[] = (bizData || []).map(b => {
        const count = (profData || []).filter(p => p.business_id === b.id && p.role === 'seller').length;
        return {
          id: b.id,
          code: b.code,
          name: b.name,
          plan: b.plan,
          maxSellers: b.max_sellers,
          isActive: b.is_active,
          createdAt: b.created_at,
          sellerCount: count
        };
      });

      setBusinesses(mapped);
    } catch (err: any) {
      console.error('Error cargando comercios:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchBusinesses();

    const channel = supabase
      .channel('superadmin_businesses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'businesses' }, () => {
        fetchBusinesses();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBusinesses]);

  // Actualizar límite automático al cambiar plan
  const handlePlanChange = (plan: BusinessPlan) => {
    setNewBizPlan(plan);
    if (plan === 'basico') setNewBizMaxSellers(2);
    else if (plan === 'estandar') setNewBizMaxSellers(5);
    else if (plan === 'pro') setNewBizMaxSellers(15);
  };

  const handleEditPlanChange = (plan: BusinessPlan) => {
    setEditPlan(plan);
    if (plan === 'basico') setEditMaxSellers(2);
    else if (plan === 'estandar') setEditMaxSellers(5);
    else if (plan === 'pro') setEditMaxSellers(15);
  };

  // Switch de suspensión / reactivación
  const toggleBusinessStatus = async (biz: Business) => {
    try {
      const { error } = await supabase
        .from('businesses')
        .update({ is_active: !biz.isActive })
        .eq('id', biz.id);

      if (error) throw error;
      fetchBusinesses();
    } catch (err: any) {
      alert('Error cambiando estado del comercio: ' + err.message);
    }
  };

  // Crear Comercio + Admin inicial
  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setIsSubmitting(true);

    try {
      const cleanCode = newBizCode.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      const cleanAdminUser = newAdminUsername.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

      if (!cleanCode || !newBizName.trim()) {
        throw new Error('El código y el nombre del comercio son obligatorios.');
      }
      if (newAdminPassword.length < 6) {
        throw new Error('La contraseña del administrador debe tener al menos 6 caracteres.');
      }

      // 1. Insertar el comercio en businesses
      const { data: newBiz, error: bizError } = await supabase
        .from('businesses')
        .insert([{
          code: cleanCode,
          name: newBizName.trim(),
          plan: newBizPlan,
          max_sellers: newBizMaxSellers,
          is_active: true
        }])
        .select()
        .single();

      if (bizError) {
        if (bizError.message.includes('unique') || bizError.code === '23505') {
          throw new Error(`El código de comercio '${cleanCode}' ya existe. Elige otro.`);
        }
        throw bizError;
      }

      // 2. Crear el usuario Administrador del Comercio en auth.users
      const helperClient = createAdminHelperClient();
      const virtualEmail = buildVirtualEmail(cleanAdminUser, cleanCode);

      const { data: authData, error: authError } = await helperClient.auth.signUp({
        email: virtualEmail,
        password: newAdminPassword,
        options: {
          data: {
            username: cleanAdminUser,
            name: newAdminName.trim() || `Admin ${newBizName.trim()}`,
            business_id: newBiz.id,
            business_code: cleanCode,
            role: 'business_admin'
          }
        }
      });

      if (authError) throw authError;

      // 3. Crear el perfil en profiles
      if (authData.user) {
        const { error: profError } = await supabase
          .from('profiles')
          .upsert({
            id: authData.user.id,
            business_id: newBiz.id,
            business_code: cleanCode,
            username: cleanAdminUser,
            name: newAdminName.trim() || `Admin ${newBizName.trim()}`,
            email: virtualEmail,
            role: 'business_admin'
          });

        if (profError) console.error('Error insertando perfil admin:', profError);
      }

      alert(`¡Comercio "${newBizName}" creado con éxito!\nCódigo: ${cleanCode}\nUsuario Admin: ${cleanAdminUser}`);
      setShowCreateModal(false);
      setNewBizName('');
      setNewBizCode('');
      setNewAdminName('');
      setNewAdminPassword('');
      fetchBusinesses();
    } catch (err: any) {
      setModalError(err.message || 'Error al crear el comercio.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Abrir modal de edición
  const openEditModal = (biz: Business) => {
    setEditingBiz(biz);
    setEditName(biz.name);
    setEditPlan(biz.plan);
    setEditMaxSellers(biz.maxSellers);
    setEditAdminPassword('');
    setModalError('');
    setShowEditModal(true);
  };

  // Guardar cambios de edición
  const handleUpdateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBiz) return;
    setIsSubmitting(true);
    setModalError('');

    try {
      // 1. Actualizar datos en businesses
      const { error: updateError } = await supabase
        .from('businesses')
        .update({
          name: editName.trim(),
          plan: editPlan,
          max_sellers: editMaxSellers
        })
        .eq('id', editingBiz.id);

      if (updateError) throw updateError;

      // 2. Si se ingresó una nueva contraseña para el admin del negocio:
      if (editAdminPassword.trim()) {
        if (editAdminPassword.length < 6) {
          throw new Error('La nueva contraseña debe tener al menos 6 caracteres.');
        }
        // Buscar el UID del admin del negocio
        const { data: adminProf } = await supabase
          .from('profiles')
          .select('id, email')
          .eq('business_id', editingBiz.id)
          .eq('role', 'business_admin')
          .maybeSingle();

        if (adminProf) {
          // Usar la función de admin de Supabase o informar
          alert(`Para cambiar la clave del admin (${adminProf.email}), indícale al usuario ingresar con clave provisoria o reseteo.`);
        }
      }

      alert('Comercio actualizado correctamente.');
      setShowEditModal(false);
      fetchBusinesses();
    } catch (err: any) {
      setModalError(err.message || 'Error al actualizar comercio.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Abrir modal de confirmación de eliminación
  const openDeleteModal = (biz: Business) => {
    setBusinessToDelete(biz);
    setDeleteConfirmInput('');
    setDeleteError('');
  };

  // Ejecutar eliminación definitiva del comercio
  const handleDeleteBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessToDelete) return;

    if (deleteConfirmInput.trim().toLowerCase() !== businessToDelete.code.toLowerCase()) {
      setDeleteError(`Debes ingresar exactamente "${businessToDelete.code}" para confirmar.`);
      return;
    }

    setIsDeleting(true);
    setDeleteError('');

    try {
      // 1. Intentar llamar al RPC delete_business (limpia auth.users y borra el comercio en cascada)
      const { error: rpcError } = await supabase.rpc('delete_business', {
        p_business_id: businessToDelete.id
      });

      if (rpcError) {
        console.warn('RPC delete_business no disponible o falló, recurriendo a eliminación directa:', rpcError);
        // Fallback: eliminar directamente de la tabla businesses
        const { error: directError } = await supabase
          .from('businesses')
          .delete()
          .eq('id', businessToDelete.id);

        if (directError) throw directError;
      }

      setBusinessToDelete(null);
      setDeleteConfirmInput('');
      setShowEditModal(false);
      setEditingBiz(null);
      fetchBusinesses();
    } catch (err: any) {
      console.error('Error eliminando comercio:', err);
      setDeleteError(err.message || 'Error al eliminar el comercio. Verifica tus permisos de superadmin.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtrar lista
  const filteredBusinesses = businesses.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full w-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Navbar Superadmin */}
      <header className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg shadow-orange-500/20 text-slate-950 font-black">
            <Shield size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-tight">ComerciCalc Platform</h1>
              <span className="text-[11px] font-extrabold uppercase px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full">
                Superadmin
              </span>
            </div>
            <p className="text-xs text-slate-400">Panel Maestro de Control Multi-Comercio</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800/80 hover:bg-red-500/10 hover:text-red-400 border border-slate-700/60 rounded-xl text-xs font-semibold transition-all"
          >
            <LogOut size={15} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Métricas Rápidas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
              <Building2 size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Comercios Activos</p>
              <h3 className="text-2xl font-bold text-white">
                {businesses.filter(b => b.isActive).length} / {businesses.length}
              </h3>
            </div>
          </div>

          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <Users size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Cajeros Totales en Red</p>
              <h3 className="text-2xl font-bold text-white">
                {businesses.reduce((acc, curr) => acc + (curr.sellerCount || 0), 0)}
              </h3>
            </div>
          </div>

          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl flex items-center gap-4">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
              <Sparkles size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Planes en Operación</p>
              <h3 className="text-2xl font-bold text-white">
                {new Set(businesses.map(b => b.plan)).size} Planes
              </h3>
            </div>
          </div>
        </div>

        {/* Barra de Acciones y Búsqueda */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Buscar por nombre o código de comercio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold rounded-xl shadow-lg shadow-orange-500/20 text-sm transition-all"
          >
            <Plus size={18} />
            <span>Nuevo Comercio</span>
          </button>
        </div>

        {/* Tabla de Comercios */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="py-3.5 px-4 font-semibold">Comercio</th>
                  <th className="py-3.5 px-4 font-semibold">Código</th>
                  <th className="py-3.5 px-4 font-semibold">Plan</th>
                  <th className="py-3.5 px-4 font-semibold">Cajeros</th>
                  <th className="py-3.5 px-4 font-semibold">Estado</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      <Loader2 className="animate-spin mx-auto mb-2 text-amber-500" size={24} />
                      Cargando comercios...
                    </td>
                  </tr>
                ) : filteredBusinesses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      No se encontraron comercios registrados.
                    </td>
                  </tr>
                ) : (
                  filteredBusinesses.map((biz) => (
                    <tr key={biz.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400">
                          <Building2 size={16} />
                        </div>
                        {biz.name}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-xs px-2 py-1 bg-slate-800 rounded border border-slate-700 text-slate-300">
                          {biz.code}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`text-[11px] font-bold uppercase px-2.5 py-1 rounded-full border ${
                          biz.plan === 'pro' 
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                            : biz.plan === 'estandar'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                            : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                        }`}>
                          {biz.plan}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white">{biz.sellerCount || 0}</span>
                          <span className="text-slate-500">/ {biz.maxSellers} cupos</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => toggleBusinessStatus(biz)}
                          className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-all border ${
                            biz.isActive
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
                          }`}
                          title={biz.isActive ? 'Clic para suspender' : 'Clic para reactivar'}
                        >
                          <Power size={12} />
                          {biz.isActive ? 'Activo' : 'Suspendido'}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(biz)}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            title="Editar Comercio"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => openDeleteModal(biz)}
                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Eliminar Comercio"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* MODAL: CREAR COMERCIO */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <Building2 size={20} />
                <span>Alta de Nuevo Comercio</span>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateBusiness} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Nombre del Negocio</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Panadería San José"
                    value={newBizName}
                    onChange={(e) => {
                      setNewBizName(e.target.value);
                      if (!newBizCode) {
                        setNewBizCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''));
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Código Único (Slug)</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. panaderia"
                    value={newBizCode}
                    onChange={(e) => setNewBizCode(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-amber-400 font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500"
                  />
                  <p className="text-[10px] text-slate-500">Usado para el login del local</p>
                </div>
              </div>

              {/* Planes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Plan de Suscripción</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['basico', 'estandar', 'pro'] as BusinessPlan[]).map((plan) => (
                    <button
                      key={plan}
                      type="button"
                      onClick={() => handlePlanChange(plan)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold capitalize transition-all ${
                        newBizPlan === plan
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/50 shadow-md'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {plan}
                      <span className="block text-[10px] font-normal text-slate-500">
                        {plan === 'basico' ? 'Hasta 2 cajeros' : plan === 'estandar' ? 'Hasta 5 cajeros' : 'Hasta 15 cajeros'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cupo Máximo de Cajeros</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={newBizMaxSellers}
                  onChange={(e) => setNewBizMaxSellers(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Cuenta Dueño Inicial */}
              <div className="border-t border-slate-800 pt-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <KeyRound size={14} className="text-amber-500" />
                  Cuenta de Acceso para el Dueño
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-500 font-medium">Usuario del Dueño</label>
                    <input
                      type="text"
                      required
                      placeholder="admin"
                      value={newAdminUsername}
                      onChange={(e) => setNewAdminUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-500 font-medium">Nombre del Dueño</label>
                    <input
                      type="text"
                      placeholder="Ej. Juan Pérez"
                      value={newAdminName}
                      onChange={(e) => setNewAdminName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-500 font-medium">Contraseña Inicial</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2"
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  <span>Registrar Comercio</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR COMERCIO */}
      {showEditModal && editingBiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <span className="text-white font-bold">Editar: {editingBiz.name}</span>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateBusiness} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
                  {modalError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase">Nombre Comercial</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase">Plan</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['basico', 'estandar', 'pro'] as BusinessPlan[]).map((plan) => (
                    <button
                      key={plan}
                      type="button"
                      onClick={() => handleEditPlanChange(plan)}
                      className={`py-2 px-2 rounded-xl border text-xs font-bold capitalize ${
                        editPlan === plan
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/50'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      {plan}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase">Límite de Cajeros</label>
                <input
                  type="number"
                  min={1}
                  value={editMaxSellers}
                  onChange={(e) => setEditMaxSellers(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    const target = editingBiz;
                    setShowEditModal(false);
                    openDeleteModal(target);
                  }}
                  className="px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 size={14} />
                  <span>Eliminar Comercio</span>
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 bg-slate-800 rounded-xl text-xs font-semibold text-slate-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2"
                  >
                    {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                    <span>Guardar Cambios</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR ELIMINACIÓN DE COMERCIO */}
      {businessToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-red-500/30 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-red-950/40 border-b border-red-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-400 font-bold">
                <div className="p-1.5 bg-red-500/20 rounded-lg">
                  <Trash2 size={18} />
                </div>
                <span>Eliminar Comercio</span>
              </div>
              <button 
                onClick={() => setBusinessToDelete(null)} 
                disabled={isDeleting}
                className="text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleDeleteBusiness} className="p-6 space-y-4">
              {deleteError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}

              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <p className="text-xs text-slate-400 font-medium">Comercio a eliminar:</p>
                <h4 className="text-base font-bold text-white">{businessToDelete.name}</h4>
                <p className="text-xs font-mono text-amber-400">Código: #{businessToDelete.code}</p>
              </div>

              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300 space-y-1.5">
                <p className="font-bold flex items-center gap-1.5 text-red-400">
                  <AlertCircle size={15} className="shrink-0" />
                  Esta acción es irreversible y permanente:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-300 pl-1 text-[11px] leading-relaxed">
                  <li>Se borrarán los cajeros y la cuenta del dueño.</li>
                  <li>Se eliminarán todas las ventas y registros históricos.</li>
                  <li>Se eliminarán los clientes y saldos de la libreta.</li>
                </ul>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">
                  Para confirmar, escribe el código <strong className="text-amber-400 font-mono">{businessToDelete.code}</strong>:
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder={businessToDelete.code}
                  value={deleteConfirmInput}
                  onChange={(e) => setDeleteConfirmInput(e.target.value)}
                  disabled={isDeleting}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setBusinessToDelete(null)}
                  disabled={isDeleting}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isDeleting || deleteConfirmInput.trim().toLowerCase() !== businessToDelete.code.toLowerCase()}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-red-600/30 transition-all"
                >
                  {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  <span>Eliminar Definitivamente</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
