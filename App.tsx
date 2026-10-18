
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase, createAdminHelperClient, isSupabaseConfigured } from './supabase';
import { Display } from './components/Display';
import { CalculatorButton } from './components/CalculatorButton';
import { Sale, Operator, PaymentMethod, User } from './types';
import { Download, History, DollarSign, Trash2, ShoppingBag, User as UserIcon, Banknote, ArrowRightLeft, ShieldCheck, LogOut, ArrowLeft, LogIn, KeyRound, Users, CheckCircle2, AlertTriangle, UserPlus, X, Loader2, Pencil, Save, Mail, AlertCircle, Lock, CreditCard, Palette } from 'lucide-react';

type ThemeType = 'default' | 'synthwave' | 'retro';

const App: React.FC = () => {
  // --- Auth State ---
  const [user, setUser] = useState<User | null>(null);
  
  // Login/Register Form State
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [nameInput, setNameInput] = useState(''); // Only for register
  const [authError, setAuthError] = useState('');
  const [isConfigured] = useState(isSupabaseConfigured);

  // --- App Views ---
  const [view, setView] = useState<'login' | 'calculator' | 'sales_log' | 'seller_select'>('login');
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  
  // --- Admin Filter State ---
  const [selectedSellerFilter, setSelectedSellerFilter] = useState<string | null>(null); // This will now store the UID
  const [sellersList, setSellersList] = useState<User[]>([]); // List of users for Admin view

  // --- Create Seller State ---
  const [showCreateSellerModal, setShowCreateSellerModal] = useState(false);
  const [newSellerName, setNewSellerName] = useState('');
  const [newSellerEmail, setNewSellerEmail] = useState('');
  const [newSellerPassword, setNewSellerPassword] = useState('');
  const [isCreatingSeller, setIsCreatingSeller] = useState(false);
  const [createSellerError, setCreateSellerError] = useState('');

  // --- Edit Seller State ---
  const [showEditSellerModal, setShowEditSellerModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editNameInput, setEditNameInput] = useState('');
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);

  // --- Change Own Password State ---
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [newSelfPassword, setNewSelfPassword] = useState('');
  const [confirmSelfPassword, setConfirmSelfPassword] = useState('');
  const [changePasswordError, setChangePasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // --- Theme State ---
  const [theme, setTheme] = useState<ThemeType>('default');
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  // --- Calculator State ---
  const [currentInput, setCurrentInput] = useState<string>('0');
  const [previousInput, setPreviousInput] = useState<string>('');
  const [operator, setOperator] = useState<Operator>(Operator.NONE);
  const [shouldResetInput, setShouldResetInput] = useState<boolean>(false);
  
  // FIN Button Safety State
  const [finConfirmMode, setFinConfirmMode] = useState<boolean>(false);
  
  // --- Sales Data State ---
  const [sales, setSales] = useState<Sale[]>([]);

  // --- THEME LOGIC ---
  useEffect(() => {
      // Apply theme to document root
      if (theme === 'default') {
          document.documentElement.removeAttribute('data-theme');
      } else {
          document.documentElement.setAttribute('data-theme', theme);
      }
      // Optional: Save to local storage
      localStorage.setItem('comercicalc-theme', theme);
  }, [theme]);

  // Load theme from storage
  useEffect(() => {
      const savedTheme = localStorage.getItem('comercicalc-theme') as ThemeType;
      if (savedTheme) {
          setTheme(savedTheme);
      }
  }, []);

  // Close theme menu on click outside
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
              setShowThemeMenu(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  // --- USER PROFILE HELPER ---
  const loadUserProfile = useCallback(async (uid: string, fallbackEmail: string) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .maybeSingle();

      if (profile) {
        setUser({
          uid: profile.id,
          email: profile.email || fallbackEmail,
          username: profile.email || profile.name || fallbackEmail,
          role: profile.role,
          name: profile.name
        });
      } else {
        const isAdminEmail = fallbackEmail.toLowerCase().includes('admin');
        setUser({
          uid,
          email: fallbackEmail,
          username: fallbackEmail,
          role: isAdminEmail ? 'admin' : 'seller',
          name: fallbackEmail.split('@')[0] || 'Usuario'
        });
      }
      setView(currentView => currentView === 'login' ? 'calculator' : currentView);
      setAuthError('');
    } catch (err) {
      console.error('Error cargando perfil:', err);
    }
  }, []);

  // --- REAL-TIME DATA LISTENERS ---

  // 1. Auth & User Profile Listener
  useEffect(() => {
    let isMounted = true;

    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      if (session?.user) {
        loadUserProfile(session.user.id, session.user.email || '');
      } else {
        setUser(null);
        setView('login');
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await loadUserProfile(session.user.id, session.user.email || '');
      } else {
        setUser(null);
        setView('login');
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserProfile]);

  // 2. Sales Data Listener (Real-time with Supabase)
  const fetchSales = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('Error reading sales:', error);
        return;
      }

      if (data) {
        const mappedSales: Sale[] = data.map(s => ({
          id: s.id,
          amount: Number(s.amount),
          paymentMethod: s.payment_method as PaymentMethod,
          date: s.date,
          timestamp: Number(s.timestamp),
          userId: s.user_id,
          userName: s.user_name
        }));
        setSales(mappedSales);
      }
    } catch (err) {
      console.error('Error in fetchSales:', err);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    fetchSales();

    const channel = supabase
      .channel('sales_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales' },
        () => {
          fetchSales();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchSales]);

  // 3. Sellers List Listener (For Admin View)
  const fetchSellers = useCallback(async () => {
    if (user?.role !== 'admin') return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching sellers list:', error);
        setSellersList([]);
        return;
      }

      if (data) {
        const users: User[] = data.map(p => ({
          uid: p.id,
          username: p.email || p.id,
          email: p.email,
          role: p.role,
          name: p.name || 'Desconocido'
        }));
        setSellersList(users);
      }
    } catch (err) {
      console.error('Error in fetchSellers:', err);
    }
  }, [user?.role]);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchSellers();

      const channel = supabase
        .channel('profiles_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'profiles' },
          () => {
            fetchSellers();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user?.role, fetchSellers]);

  // --- Auth Logic ---
  
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfigured) return;
    setAuthError('');

    try {
        if (authMode === 'login') {
            const { error } = await supabase.auth.signInWithPassword({
                email: emailInput.trim(),
                password: passwordInput,
            });
            if (error) throw error;
        } else {
            // REGISTER NEW ADMIN
            if (!nameInput.trim()) {
                setAuthError("Por favor ingresa un nombre.");
                return;
            }
            const { data, error } = await supabase.auth.signUp({
                email: emailInput.trim(),
                password: passwordInput,
                options: {
                    data: {
                        name: nameInput.trim(),
                        role: 'admin'
                    }
                }
            });
            if (error) throw error;
            if (data.user) {
                await supabase.from('profiles').upsert({
                    id: data.user.id,
                    name: nameInput.trim(),
                    email: data.user.email,
                    role: 'admin'
                });

                if (data.session) {
                    await loadUserProfile(data.user.id, data.user.email || '');
                } else {
                    alert("¡Cuenta de Administrador creada exitosamente! Ya puedes iniciar sesión con tu correo y contraseña.");
                    setAuthMode('login');
                }
            }
        }
    } catch (error: any) {
        console.error("Auth error", error);
        if (error.message?.includes('Invalid login credentials')) {
            setAuthError('Credenciales incorrectas');
        } else if (error.message?.includes('User already registered')) {
            setAuthError('El email ya está registrado');
        } else if (error.message?.includes('Password should be')) {
            setAuthError('La contraseña debe tener al menos 6 caracteres');
        } else {
            setAuthError(error.message || 'Error de autenticación');
        }
    }
  };

  const handleCreateSeller = async (e: React.FormEvent) => {
      e.preventDefault();
      setCreateSellerError('');
      setIsCreatingSeller(true);

      try {
          const helperClient = createAdminHelperClient();
          const { data, error } = await helperClient.auth.signUp({
              email: newSellerEmail.trim(),
              password: newSellerPassword,
              options: {
                  data: {
                      name: newSellerName.trim(),
                      role: 'seller'
                  }
              }
          });

          if (error) throw error;

          if (data.user) {
              await supabase.from('profiles').upsert({
                  id: data.user.id,
                  name: newSellerName.trim(),
                  email: data.user.email,
                  role: 'seller'
              });
          }

          alert("Vendedor creado exitosamente.");
          setShowCreateSellerModal(false);
          setNewSellerName('');
          setNewSellerEmail('');
          setNewSellerPassword('');
          fetchSellers();

      } catch (error: any) {
          console.error("Error creating seller:", error);
          if (error.message?.includes('already registered')) {
              setCreateSellerError('El email ya está registrado.');
          } else if (error.message?.includes('Password should be')) {
              setCreateSellerError('La contraseña debe tener al menos 6 caracteres.');
          } else {
              setCreateSellerError(error.message || "Error al crear vendedor.");
          }
      } finally {
          setIsCreatingSeller(false);
      }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setEmailInput('');
    setPasswordInput('');
    setNameInput('');
    handleClear(); 
    setSelectedSellerFilter(null);
  };

  const handleProfileClick = () => {
      if (user?.role === 'admin') {
          setView('seller_select');
      } else {
          setView('sales_log');
      }
  };

  const handleSellerSelect = (uid: string | null) => {
      setSelectedSellerFilter(uid);
      setView('sales_log');
  };

  // --- CHANGE OWN PASSWORD LOGIC ---

  const handleOpenChangePassword = () => {
      setNewSelfPassword('');
      setConfirmSelfPassword('');
      setChangePasswordError('');
      setShowChangePasswordModal(true);
  };

  const handleChangeOwnPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setChangePasswordError('');
      
      if (newSelfPassword !== confirmSelfPassword) {
          setChangePasswordError("Las contraseñas no coinciden.");
          return;
      }

      if (newSelfPassword.length < 6) {
          setChangePasswordError("La contraseña debe tener al menos 6 caracteres.");
          return;
      }

      setIsChangingPassword(true);
      try {
          const { error } = await supabase.auth.updateUser({
              password: newSelfPassword
          });
          if (error) throw error;
          alert("Contraseña actualizada correctamente.");
          setShowChangePasswordModal(false);
      } catch (error: any) {
          console.error("Error changing password:", error);
          setChangePasswordError(error.message || "Error al cambiar contraseña.");
      } finally {
          setIsChangingPassword(false);
      }
  };

  // --- EDIT USER LOGIC (ADMIN) ---

  const handleOpenEditUser = (targetUser: User) => {
      setEditingUser(targetUser);
      setEditNameInput(targetUser.name);
      setShowEditSellerModal(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingUser) return;
      
      setIsUpdatingUser(true);
      try {
          const { error } = await supabase
              .from('profiles')
              .update({ name: editNameInput })
              .eq('id', editingUser.uid);

          if (error) throw error;
          alert("Usuario actualizado correctamente.");
          setShowEditSellerModal(false);
          fetchSellers();
      } catch (error) {
          console.error("Error updating user:", error);
          alert("Error al actualizar usuario.");
      } finally {
          setIsUpdatingUser(false);
      }
  };

  const handleDeleteUser = async () => {
      if (!editingUser) return;
      if (!confirm(`¿Estás seguro de que deseas ELIMINAR al usuario "${editingUser.name}"? \n\nEsta acción eliminará su registro y le impedirá acceder a la app.`)) return;

      setIsUpdatingUser(true);
      try {
          const { error } = await supabase
              .from('profiles')
              .delete()
              .eq('id', editingUser.uid);

          if (error) throw error;
          alert("Usuario eliminado correctamente.");
          setShowEditSellerModal(false);
          fetchSellers();
      } catch (error) {
          console.error("Error deleting user:", error);
          alert("Error al eliminar usuario.");
      } finally {
          setIsUpdatingUser(false);
      }
  };

  const handleSendResetPassword = async () => {
      if (!editingUser || !editingUser.email) return;
      if (!confirm(`¿Enviar correo de restablecimiento de contraseña a ${editingUser.email}?`)) return;

      try {
          const { error } = await supabase.auth.resetPasswordForEmail(editingUser.email);
          if (error) throw error;
          alert(`Correo enviado a ${editingUser.email}. El usuario podrá crear una nueva contraseña siguiendo el enlace.`);
      } catch (error: any) {
          console.error("Error sending reset email:", error);
          alert("Error al enviar el correo: " + error.message);
      }
  };


  // --- Calculator Logic ---

  const handleNumber = (num: string) => {
    setFinConfirmMode(false); // Reset confirmation if user types
    if (shouldResetInput) {
      setCurrentInput(num);
      setShouldResetInput(false);
      return;
    }
    
    if (currentInput === '0' && num !== '.') {
      setCurrentInput(num);
    } else {
      if (num === '.' && currentInput.includes('.')) return;
      if (currentInput.replace('.', '').length > 12) return;
      setCurrentInput(prev => prev + num);
    }
  };

  const calculate = useCallback((a: string, b: string, op: Operator): string => {
    const numA = parseFloat(a);
    const numB = parseFloat(b);
    if (isNaN(numA) || isNaN(numB)) return '0';

    let result = 0;
    switch (op) {
      case Operator.ADD: result = numA + numB; break;
      case Operator.SUBTRACT: result = numA - numB; break;
      case Operator.MULTIPLY: result = numA * numB; break;
      case Operator.DIVIDE: result = numB !== 0 ? numA / numB : 0; break;
      default: return b;
    }
    return String(Math.round(result * 100) / 100);
  }, []);

  const handleOperator = (op: Operator) => {
    setFinConfirmMode(false); // Reset confirmation
    if (operator !== Operator.NONE && !shouldResetInput) {
      const result = calculate(previousInput, currentInput, operator);
      setCurrentInput(result);
      setPreviousInput(result);
    } else {
      setPreviousInput(currentInput);
    }
    setOperator(op);
    setShouldResetInput(true);
  };

  const handleEquals = () => {
    // 1. If currently asking for confirmation, finalize the sale
    if (finConfirmMode) {
        initiateSale();
        setFinConfirmMode(false);
        return;
    }

    // 2. Perform calculation if pending
    if (operator !== Operator.NONE) {
        const result = calculate(previousInput, currentInput, operator);
        setCurrentInput(result);
        setPreviousInput('');
        setOperator(Operator.NONE);
        setShouldResetInput(true);
        setFinConfirmMode(true); // Switch to confirm mode
    } else {
        // 3. If no calculation pending, but we have a value, allow confirmation
        if (currentInput !== '0' && currentInput !== '') {
            setFinConfirmMode(true);
        }
    }
  };

  const handleClear = () => {
    setCurrentInput('0');
    setPreviousInput('');
    setOperator(Operator.NONE);
    setFinConfirmMode(false);
  };

  const handleBackspace = () => {
    setFinConfirmMode(false);
    if (shouldResetInput) {
        handleClear();
        return;
    }
    if (currentInput.length === 1) {
        setCurrentInput('0');
    } else {
        setCurrentInput(prev => prev.slice(0, -1));
    }
  };

  // --- Commercial Logic ---

  const initiateSale = () => {
    const amount = parseFloat(currentInput);
    if (amount <= 0) {
        alert("El monto debe ser mayor a 0 para cerrar una venta.");
        return;
    }
    setShowPaymentModal(true);
  };

  const finalizeSale = async (method: PaymentMethod) => {
    if (!user) return;

    const amount = parseFloat(currentInput);
    const timestamp = Date.now();
    
    try {
        const { error } = await supabase.from('sales').insert([{
            amount: amount,
            payment_method: method,
            date: new Date().toISOString(),
            timestamp: timestamp,
            user_id: user.uid,
            user_name: user.name
        }]);

        if (error) throw error;
        
        setShowPaymentModal(false);
        handleClear();
        fetchSales();
    } catch (e) {
        console.error("Error adding sale: ", e);
        alert("Error al guardar la venta. Verifique su conexión.");
    }
  };

  // --- Data Access Logic ---

  // Filter sales based on role and admin selection
  const getVisibleSales = () => {
    if (!user) return [];
    
    if (user.role === 'admin') {
      // If a filter is selected, show only that user. Otherwise show all.
      if (selectedSellerFilter) {
          // Compare UID stored in sales with selected UID
          return sales.filter(s => s.userId === selectedSellerFilter);
      }
      return sales; 
    }
    
    return sales.filter(s => s.userId === user.uid); // Seller sees only theirs by UID
  };

  const visibleSales = getVisibleSales();
  const totalSales = visibleSales.reduce((acc, curr) => acc + curr.amount, 0);

  const pushData = () => {
    if (visibleSales.length === 0) {
        alert("No hay ventas registradas para exportar.");
        return;
    }

    const doc = new jsPDF();

    // -- Header --
    doc.setFillColor(15, 23, 42); // brand-dark (slate-900)
    doc.rect(0, 0, doc.internal.pageSize.width, 25, 'F');
    
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text("ComerciCalc Pro - Reporte de Ventas", 14, 16);

    // -- Metadata --
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    
    const dateStr = new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString();
    let yPos = 35;
    
    doc.text(`Generado: ${dateStr}`, 14, yPos);
    yPos += 6;
    doc.text(`Solicitado por: ${user?.name} (${user?.role})`, 14, yPos);
    
    if (selectedSellerFilter) {
        yPos += 6;
        const sellerName = sellersList.find(u => u.uid === selectedSellerFilter)?.name || 'Vendedor';
        doc.setTextColor(16, 185, 129); // Accent color
        doc.text(`Filtro Activo: Ventas de '${sellerName}'`, 14, yPos);
        doc.setTextColor(80, 80, 80);
    }

    // -- Table Data --
    const tableColumn = ["Fecha", "Hora", "Vendedor", "Método", "Monto"];
    const tableRows = visibleSales.map(sale => {
      const dateObj = new Date(sale.date);
      return [
        dateObj.toLocaleDateString(),
        dateObj.toLocaleTimeString(),
        sale.userName || 'Desconocido',
        sale.paymentMethod,
        `$${sale.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      ];
    });

    // -- Generate Table --
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: yPos + 10,
      theme: 'grid',
      headStyles: { 
          fillColor: [16, 185, 129], // Emerald 500
          textColor: 255,
          fontStyle: 'bold'
      },
      alternateRowStyles: {
          fillColor: [241, 245, 249] // Slate 100
      },
      columnStyles: {
        4: { halign: 'right', fontStyle: 'bold' } // Align Amount to right
      },
      styles: {
          fontSize: 10,
          cellPadding: 4
      }
    });

    // -- Total Summary --
    const finalY = (doc as any).lastAutoTable.finalY || 50;
    
    doc.setFillColor(240, 253, 244); // Light green bg
    doc.setDrawColor(16, 185, 129);
    doc.roundedRect(14, finalY + 10, 100, 25, 3, 3, 'FD');

    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(`Total Ventas:`, 20, finalY + 20);
    
    doc.setFontSize(16);
    doc.setTextColor(16, 185, 129);
    doc.setFont("helvetica", "bold");
    doc.text(`$${totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 20, finalY + 28);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    doc.text(`Total Transacciones: ${visibleSales.length}`, 120, finalY + 20);

    // Save
    const suffix = selectedSellerFilter ? 'filtrado' : (user?.role === 'admin' ? 'reporte_general' : user?.name.replace(/\s+/g, '_'));
    doc.save(`ventas_${suffix}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const clearHistory = async () => {
    if (user?.role !== 'admin') {
      alert("Solo el administrador puede borrar el historial completo.");
      return;
    }
    
    const msg = selectedSellerFilter 
        ? `¿Estás seguro de que deseas borrar el historial de ventas de este usuario DE LA NUBE?`
        : "¿ATENCIÓN: Estás seguro de que deseas borrar TODO el historial de ventas de TODOS los usuarios DE LA NUBE?";

    if(confirm(msg)) {
        try {
            let error;
            if (selectedSellerFilter) {
                const res = await supabase.from('sales').delete().eq('user_id', selectedSellerFilter);
                error = res.error;
            } else {
                const res = await supabase.from('sales').delete().neq('date', '');
                error = res.error;
            }

            if (error) throw error;
            alert("Historial borrado correctamente.");
            fetchSales();
        } catch (e) {
            console.error("Error deleting docs", e);
            alert("Error al borrar. Verifique permisos o conexión.");
        }
    }
  };

  // --- RENDER: LOGIN / REGISTER VIEW ---
  if (view === 'login' || !user) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-brand-dark p-6 animate-fade-in relative overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-brand-push/20 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-brand-accent/10 blur-[100px] rounded-full pointer-events-none"></div>

        {!isConfigured && (
            <div className="absolute top-4 left-4 right-4 bg-yellow-500/90 text-black p-4 rounded-xl z-50 flex items-start gap-3 shadow-lg">
                <AlertTriangle className="shrink-0" />
                <div>
                    <h3 className="font-bold">Falta Configuración Supabase</h3>
                    <p className="text-sm">Configura las variables <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> en tu archivo <code>.env</code> con las credenciales de tu proyecto en Supabase.</p>
                </div>
            </div>
        )}

        <div className="w-full max-w-sm bg-brand-card border border-slate-700 p-8 rounded-3xl shadow-2xl relative z-10 transition-all">
          <div className="flex flex-col items-center mb-6">
            <div className="bg-slate-800 p-4 rounded-2xl mb-4 shadow-inner ring-1 ring-slate-700">
               {authMode === 'login' ? (
                   <ShoppingBag className="text-brand-accent w-10 h-10" />
               ) : (
                   <UserPlus className="text-brand-push w-10 h-10" />
               )}
            </div>
            <h1 className="text-2xl font-bold text-white">ComerciCalc Pro</h1>
            <p className="text-slate-400 text-sm">
                {authMode === 'login' ? 'Portal de Acceso (Nube)' : 'Crear Admin del Sistema'}
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            
            {/* Show Name input only in Register mode */}
            {authMode === 'register' && (
                <div className="space-y-2 animate-fade-in">
                    <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold ml-1">Tu Nombre</label>
                    <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                        <UserIcon size={18} />
                        </div>
                        <input 
                        type="text" 
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-push/50 transition-all"
                        placeholder="Ej. Juan Pérez"
                        required
                        />
                    </div>
                </div>
            )}

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold ml-1">Email</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                  <UserIcon size={18} />
                </div>
                <input 
                  type="email" 
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-push/50 transition-all"
                  placeholder="admin@ejemplo.com"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold ml-1">Contraseña</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                  <KeyRound size={18} />
                </div>
                <input 
                  type="password" 
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-push/50 transition-all"
                  placeholder="••••••"
                  required
                />
              </div>
            </div>

            {authError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
                {authError}
              </div>
            )}

            <button 
              type="submit"
              disabled={!isConfigured}
              className={`w-full font-bold py-3.5 rounded-xl transition-all shadow-lg mt-2 flex items-center justify-center gap-2
                  ${isConfigured 
                      ? (authMode === 'login' ? 'bg-brand-push hover:bg-indigo-500 text-white shadow-indigo-500/20' : 'bg-brand-accent hover:bg-emerald-500 text-brand-dark shadow-emerald-500/20')
                      : 'bg-slate-700 text-slate-400 cursor-not-allowed'}`}
            >
              {authMode === 'login' ? <LogIn size={20} /> : <UserPlus size={20} />}
              {authMode === 'login' ? 'Ingresar' : 'Crear Admin'}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === 'login' ? 'register' : 'login');
                  setAuthError('');
                }}
                className="text-xs text-brand-accent hover:underline transition-all"
              >
                {authMode === 'login' 
                  ? '¿Primer acceso? Crear cuenta de Administrador' 
                  : '¿Ya tienes cuenta? Iniciar Sesión'}
              </button>
            </div>
          </form>

          <div className="mt-4 pt-6 border-t border-slate-800 text-center">
             <p className="text-[10px] text-slate-600 uppercase tracking-widest font-bold">
               ComerciCalc Pro v1.2
             </p>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER: APP MAIN ---
  return (
    <div className="h-full w-full flex flex-col bg-brand-dark overflow-hidden relative transition-colors duration-300">
      
      {/* Top Navigation Bar */}
      <nav className="flex items-center justify-between p-3 bg-brand-card/80 backdrop-blur-md border-b border-brand-card z-10 shrink-0 shadow-sm transition-colors duration-300">
        <div className="flex items-center gap-3">
          <div className="bg-brand-accent p-2 rounded-lg shadow-lg shadow-brand-accent/20">
            <ShoppingBag className="text-brand-dark w-5 h-5" />
          </div>
          <div>
             <h1 className="text-lg font-bold text-white leading-none hidden md:block">ComerciCalc Pro</h1>
             <h1 className="text-lg font-bold text-white leading-none md:hidden">PV</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
            {/* Back Buttons Logic */}
            {view === 'sales_log' ? (
                <button 
                  onClick={() => {
                      if (user.role === 'admin') {
                          setView('seller_select');
                      } else {
                          setView('calculator');
                      }
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 hover:bg-slate-700 rounded-lg text-slate-200 transition-colors"
                >
                  <ArrowLeft size={18} />
                  <span className="hidden md:inline">Volver</span>
                </button>
            ) : view === 'seller_select' ? (
                <button 
                  onClick={() => setView('calculator')}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 hover:bg-slate-700 rounded-lg text-slate-200 transition-colors"
                >
                  <ArrowLeft size={18} />
                  <span className="hidden md:inline">Volver</span>
                </button>
            ) : (
                /* Profile Button - Only visible in Calculator view */
                <button 
                  onClick={handleProfileClick}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-slate-200 transition-colors border border-white/10 
                    ${user.role === 'admin' ? 'bg-brand-card hover:bg-slate-700' : 'bg-brand-card hover:bg-slate-700'}`}
                >
                  <UserIcon size={16} className={user.role === 'admin' ? 'text-brand-accent' : 'text-blue-400'} />
                  <span className="font-medium max-w-[100px] truncate">{user.name}</span>
                </button>
            )}
            
            {/* THEME SELECTOR BUTTON */}
            <div className="relative" ref={themeMenuRef}>
                <button 
                    onClick={() => setShowThemeMenu(!showThemeMenu)}
                    className="p-2.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-transparent hover:border-white/20"
                    title="Cambiar Tema"
                >
                    <Palette size={18} />
                </button>

                {showThemeMenu && (
                    <div className="absolute top-full right-0 mt-2 w-48 bg-brand-card border border-white/10 rounded-xl shadow-2xl p-2 z-50 animate-fade-in origin-top-right">
                        <div className="text-xs font-bold text-slate-400 px-3 py-2 uppercase tracking-wider">Apariencia</div>
                        
                        <button 
                            onClick={() => { setTheme('default'); setShowThemeMenu(false); }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-3 hover:bg-white/5 transition-colors ${theme === 'default' ? 'text-brand-accent bg-white/5' : 'text-slate-300'}`}
                        >
                            <div className="w-4 h-4 rounded-full bg-[#10b981] shadow-sm"></div>
                            <span>Original</span>
                        </button>

                        <button 
                            onClick={() => { setTheme('synthwave'); setShowThemeMenu(false); }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-3 hover:bg-white/5 transition-colors ${theme === 'synthwave' ? 'text-brand-accent bg-white/5' : 'text-slate-300'}`}
                        >
                            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#ec4899] to-[#a855f7] shadow-sm"></div>
                            <span>Synthwave</span>
                        </button>

                         <button 
                            onClick={() => { setTheme('retro'); setShowThemeMenu(false); }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-3 hover:bg-white/5 transition-colors ${theme === 'retro' ? 'text-brand-accent bg-white/5' : 'text-slate-300'}`}
                        >
                            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#458595] to-[#facc15] shadow-sm"></div>
                            <span>Retro</span>
                        </button>
                    </div>
                )}
            </div>

            <button 
                onClick={handleOpenChangePassword}
                className="p-2.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-transparent hover:border-white/20"
                title="Cambiar mi Contraseña"
            >
                <KeyRound size={18} />
            </button>

            <button 
              onClick={handleLogout}
              className="p-2.5 text-slate-400 hover:text-brand-danger hover:bg-brand-danger/10 rounded-lg transition-colors"
              title="Cerrar Sesión"
            >
              <LogOut size={18} />
            </button>
        </div>
      </nav>

      <div className="flex-1 overflow-hidden relative w-full h-full">
        {/* --- View: Calculator --- */}
        {view === 'calculator' && (
            <div className="h-full flex flex-col p-2 gap-2 max-w-3xl mx-auto w-full animate-fade-in">
                {/* Display Area */}
                <div className="shrink-0 mb-2">
                    <div className="w-full">
                        <Display value={currentInput} previousValue={previousInput} operator={operator} />
                    </div>
                </div>
                
                {/* Button Grid - Removed padding-bottom (pb-2) to fill space */}
                <div className="flex-1 grid grid-cols-4 grid-rows-5 gap-2 md:gap-3">
                    {/* Row 1 */}
                    <CalculatorButton label="AC" onClick={handleClear} variant="danger" />
                    <CalculatorButton label="CE" onClick={handleBackspace} variant="danger" />
                    <CalculatorButton label="%" onClick={() => {}} variant="action" disabled />
                    <CalculatorButton label={Operator.DIVIDE} onClick={() => handleOperator(Operator.DIVIDE)} variant="action" />

                    {/* Row 2 */}
                    <CalculatorButton label="7" onClick={() => handleNumber('7')} />
                    <CalculatorButton label="8" onClick={() => handleNumber('8')} />
                    <CalculatorButton label="9" onClick={() => handleNumber('9')} />
                    <CalculatorButton label={Operator.MULTIPLY} onClick={() => handleOperator(Operator.MULTIPLY)} variant="action" />

                    {/* Row 3 */}
                    <CalculatorButton label="4" onClick={() => handleNumber('4')} />
                    <CalculatorButton label="5" onClick={() => handleNumber('5')} />
                    <CalculatorButton label="6" onClick={() => handleNumber('6')} />
                    <CalculatorButton 
                        label={<span className="text-4xl">{Operator.ADD}</span>}
                        onClick={() => handleOperator(Operator.ADD)} 
                        variant="accent"
                        className="row-span-2"
                    />

                    {/* Row 4 */}
                    <CalculatorButton label="1" onClick={() => handleNumber('1')} />
                    <CalculatorButton label="2" onClick={() => handleNumber('2')} />
                    <CalculatorButton label="3" onClick={() => handleNumber('3')} />

                    {/* Row 5 */}
                    <CalculatorButton label="0" onClick={() => handleNumber('0')} className="col-span-2" />
                    <CalculatorButton label={Operator.SUBTRACT} onClick={() => handleOperator(Operator.SUBTRACT)} variant="action" />
                    <CalculatorButton 
                        label={
                            finConfirmMode ? (
                                <span className="text-lg md:text-xl font-bold animate-pulse tracking-tight whitespace-nowrap">FIN</span>
                            ) : (
                                "="
                            )
                        } 
                        onClick={handleEquals} 
                        variant={finConfirmMode ? "accent" : "action"} 
                        className={`text-4xl ${finConfirmMode ? "text-white" : "text-white"}`}
                    />
                </div>
            </div>
        )}

        {/* --- View: Seller Select (Admin Only) --- */}
        {view === 'seller_select' && (
            <div className="h-full p-6 md:p-8 overflow-y-auto max-w-4xl mx-auto animate-fade-in">
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-2 mb-2">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <Users className="text-brand-accent" />
                            Seleccionar Vendedor
                        </h2>
                        <p className="text-slate-400">Selecciona un vendedor para auditar su registro de ventas (Cloud) o gestionarlos.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Action: Add Seller */}
                        <button 
                            onClick={() => setShowCreateSellerModal(true)}
                            className="bg-brand-accent/10 hover:bg-brand-accent/20 border border-brand-accent/50 hover:border-brand-accent p-6 rounded-2xl flex flex-col items-center gap-4 transition-all group shadow-lg border-dashed"
                        >
                            <div className="w-16 h-16 rounded-full bg-brand-accent flex items-center justify-center text-brand-dark group-hover:scale-110 transition-transform shadow-lg shadow-brand-accent/30">
                                <UserPlus size={28} />
                            </div>
                            <div className="text-center">
                                <h3 className="text-lg font-bold text-white">Nuevo Vendedor</h3>
                                <p className="text-sm text-slate-400">Crear cuenta de acceso</p>
                            </div>
                        </button>

                        {/* Option: All Sales */}
                        <button 
                            onClick={() => handleSellerSelect(null)}
                            className="bg-brand-card hover:bg-white/5 border border-white/10 hover:border-brand-push p-6 rounded-2xl flex flex-col items-center gap-4 transition-all group shadow-lg"
                        >
                            <div className="w-16 h-16 rounded-full bg-brand-push/20 flex items-center justify-center text-brand-push group-hover:scale-110 transition-transform">
                                <History size={32} />
                            </div>
                            <div className="text-center">
                                <h3 className="text-lg font-bold text-white">Registro General</h3>
                                <p className="text-sm text-slate-400">Ver todas las ventas de la nube</p>
                            </div>
                        </button>

                        {/* User List from Firestore */}
                        {sellersList.filter(u => u.role === 'seller').map((seller) => (
                             <div 
                                key={seller.uid}
                                className="bg-brand-card border border-white/10 p-6 rounded-2xl flex flex-col items-center gap-4 transition-all shadow-lg relative group"
                            >
                                <button 
                                  onClick={() => handleSellerSelect(seller.uid)}
                                  className="absolute inset-0 w-full h-full z-0"
                                ></button>

                                <div className="absolute top-3 right-3 z-10">
                                   <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenEditUser(seller);
                                      }}
                                      className="p-2 bg-slate-700 hover:bg-brand-push text-slate-400 hover:text-white rounded-lg transition-colors"
                                      title="Editar Usuario"
                                   >
                                     <Pencil size={16} />
                                   </button>
                                </div>

                                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-slate-300 group-hover:text-brand-accent group-hover:bg-brand-accent/20 transition-colors pointer-events-none">
                                    <span className="text-2xl font-bold">{seller.name.charAt(0).toUpperCase()}</span>
                                </div>
                                <div className="text-center pointer-events-none">
                                    <h3 className="text-lg font-bold text-white">{seller.name}</h3>
                                    <p className="text-sm text-slate-400 truncate max-w-[150px]">{seller.email || seller.uid}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* --- View: Sales Log --- */}
        {view === 'sales_log' && (
            <div className="h-full p-4 md:p-8 overflow-y-auto max-w-5xl mx-auto animate-fade-in">
                <div className="bg-brand-card rounded-3xl shadow-xl flex flex-col border border-white/10 min-h-[500px]">
                    <div className="p-4 md:p-6 border-b border-white/10 bg-black/20 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-2 text-slate-200 self-start md:self-center">
                            <History size={20} className={user.role === 'admin' ? "text-brand-accent" : "text-blue-400"} />
                            <h2 className="font-semibold text-lg">
                              {user.role === 'admin' 
                                ? (selectedSellerFilter 
                                    ? `Ventas filtradas` 
                                    : 'Registro General (Cloud)')
                                : `Mis Ventas (${user.name})`
                              }
                            </h2>
                            {selectedSellerFilter && (
                                <span className="ml-2 px-2 py-0.5 rounded-full bg-brand-accent/20 text-brand-accent text-xs font-bold uppercase">
                                    {sellersList.find(u => u.uid === selectedSellerFilter)?.name || 'Usuario'}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <button 
                                onClick={pushData}
                                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-brand-push hover:bg-brand-push/80 text-white rounded-lg transition-colors font-medium shadow-lg shadow-brand-push/20"
                            >
                                <Download size={18} />
                                <span>PUSH (PDF)</span>
                            </button>
                            {user.role === 'admin' && (
                              <button 
                                  onClick={clearHistory}
                                  className="flex items-center justify-center gap-2 px-3 py-2 bg-brand-danger/10 hover:bg-brand-danger/20 text-brand-danger rounded-lg transition-colors text-sm font-medium border border-brand-danger/20"
                                  title="Borrar Todo de la Nube"
                              >
                                  <Trash2 size={18} />
                              </button>
                            )}
                        </div>
                    </div>
                    
                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 border-b border-white/10">
                         <div className="p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-white/10">
                            <span className="text-slate-400 text-sm font-medium uppercase tracking-widest mb-1">Total {user.role === 'admin' && !selectedSellerFilter ? 'General' : 'Personal'}</span>
                            <div className={`flex items-start ${user.role === 'admin' ? 'text-brand-accent' : 'text-blue-400'}`}>
                                <DollarSign size={24} className="mt-2" />
                                <span className="text-4xl md:text-5xl font-bold font-mono">{totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                        <div className="p-6 flex flex-col items-center justify-center">
                            <span className="text-slate-400 text-sm font-medium uppercase tracking-widest mb-1">Transacciones</span>
                            <span className="text-4xl md:text-5xl font-bold text-white">{visibleSales.length}</span>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="flex-1 p-0 overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead>
                                <tr className="text-slate-400 text-xs uppercase border-b border-white/10 bg-black/20">
                                    <th className="p-4 font-medium">Hora / Fecha</th>
                                    {/* Only show "Vendedor" column if Admin is viewing ALL sales */}
                                    {user.role === 'admin' && !selectedSellerFilter && <th className="p-4 font-medium">Vendedor</th>}
                                    <th className="p-4 font-medium">Método Pago</th>
                                    <th className="p-4 font-medium text-right">Monto</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                                {visibleSales.map((sale) => (
                                    <tr key={sale.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4 text-slate-300 font-mono">
                                            <div className="flex flex-col">
                                              <span>{new Date(sale.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                              <span className="text-xs text-slate-500">{new Date(sale.date).toLocaleDateString()}</span>
                                            </div>
                                        </td>
                                        {user.role === 'admin' && !selectedSellerFilter && (
                                          <td className="p-4">
                                            <div className="flex items-center gap-2">
                                              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs text-slate-300 border border-white/10">
                                                {(sale.userName?.[0] || '?').toUpperCase()}
                                              </div>
                                              <span className="text-sm text-slate-200">{sale.userName || 'N/A'}</span>
                                            </div>
                                          </td>
                                        )}
                                        <td className="p-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border
                                                ${sale.paymentMethod === 'Tarjeta Débito/Crédito' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                                                  sale.paymentMethod === 'Efectivo' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                                                  'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}
                                            >
                                                {sale.paymentMethod === 'Tarjeta Débito/Crédito' && <CreditCard size={12} />}
                                                {sale.paymentMethod === 'Efectivo' && <Banknote size={12} />}
                                                {sale.paymentMethod === 'Transferencia' && <ArrowRightLeft size={12} />}
                                                {sale.paymentMethod}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right text-white font-mono font-bold">
                                            ${sale.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))}
                                {visibleSales.length === 0 && (
                                    <tr>
                                        <td colSpan={user.role === 'admin' && !selectedSellerFilter ? 4 : 3} className="p-12 text-center text-slate-500">
                                            No hay registros de ventas para mostrar.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {/* --- Payment Modal --- */}
        {showPaymentModal && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                <div className="bg-brand-card w-full max-w-sm rounded-2xl shadow-2xl border border-white/20 overflow-hidden transform transition-all scale-100">
                    <div className="bg-brand-accent p-6 text-brand-dark flex flex-col items-center">
                        <ShieldCheck size={48} className="mb-2 opacity-80" />
                        <h3 className="text-2xl font-bold uppercase tracking-tight">Cerrar Venta</h3>
                        <div className="text-3xl font-mono font-bold mt-2">
                            ${parseFloat(currentInput).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>
                    
                    <div className="p-6 space-y-3">
                        <p className="text-slate-400 text-sm text-center mb-4 uppercase tracking-wide font-semibold">Seleccione método de pago</p>
                        
                        <button 
                            onClick={() => finalizeSale('Tarjeta Débito/Crédito')}
                            className="w-full p-4 bg-black/20 hover:bg-blue-600/20 border border-white/10 hover:border-blue-500 rounded-xl flex items-center justify-between group transition-all"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400 group-hover:text-blue-300">
                                    <CreditCard size={24} />
                                </div>
                                <span className="text-lg font-medium text-slate-200 group-hover:text-white">Tarjeta Débito/Crédito</span>
                            </div>
                        </button>

                        <button 
                            onClick={() => finalizeSale('Transferencia')}
                            className="w-full p-4 bg-black/20 hover:bg-purple-600/20 border border-white/10 hover:border-purple-500 rounded-xl flex items-center justify-between group transition-all"
                        >
                             <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400 group-hover:text-purple-300">
                                    <ArrowRightLeft size={24} />
                                </div>
                                <span className="text-lg font-medium text-slate-200 group-hover:text-white">Transferencia</span>
                            </div>
                        </button>

                        <button 
                            onClick={() => finalizeSale('Efectivo')}
                            className="w-full p-4 bg-black/20 hover:bg-green-600/20 border border-white/10 hover:border-green-500 rounded-xl flex items-center justify-between group transition-all"
                        >
                             <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-500/20 rounded-lg text-green-400 group-hover:text-green-300">
                                    <Banknote size={24} />
                                </div>
                                <span className="text-lg font-medium text-slate-200 group-hover:text-white">Efectivo</span>
                            </div>
                        </button>
                    </div>

                    <div className="p-4 bg-black/30 border-t border-white/10">
                        <button 
                            onClick={() => setShowPaymentModal(false)}
                            className="w-full py-3 text-slate-400 hover:text-white font-medium flex items-center justify-center gap-2 transition-colors"
                        >
                            <LogOut size={18} />
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* --- Create Seller Modal --- */}
        {showCreateSellerModal && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                <div className="bg-brand-card w-full max-w-sm rounded-2xl shadow-2xl border border-white/20 overflow-hidden transform transition-all scale-100">
                    <div className="bg-brand-card p-6 flex flex-col items-center relative border-b border-white/10">
                        <button 
                            onClick={() => setShowCreateSellerModal(false)}
                            className="absolute right-4 top-4 text-slate-400 hover:text-white"
                        >
                            <X size={20} />
                        </button>
                        <div className="bg-brand-accent p-3 rounded-full mb-3 text-brand-dark">
                            <UserPlus size={28} />
                        </div>
                        <h3 className="text-xl font-bold text-white">Nuevo Vendedor</h3>
                        <p className="text-slate-400 text-sm">Crear cuenta de acceso para empleado</p>
                    </div>
                    
                    <form onSubmit={handleCreateSeller} className="p-6 space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold ml-1">Nombre</label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                    <UserIcon size={18} />
                                </div>
                                <input 
                                    type="text" 
                                    value={newSellerName}
                                    onChange={(e) => setNewSellerName(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 transition-all"
                                    placeholder="Nombre del Vendedor"
                                    required
                                    disabled={isCreatingSeller}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold ml-1">Email (Acceso)</label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                    <UserIcon size={18} />
                                </div>
                                <input 
                                    type="email" 
                                    value={newSellerEmail}
                                    onChange={(e) => setNewSellerEmail(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 transition-all"
                                    placeholder="vendedor@empresa.com"
                                    required
                                    disabled={isCreatingSeller}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold ml-1">Contraseña</label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                    <KeyRound size={18} />
                                </div>
                                <input 
                                    type="text" 
                                    value={newSellerPassword}
                                    onChange={(e) => setNewSellerPassword(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 transition-all"
                                    placeholder="Contraseña inicial"
                                    required
                                    disabled={isCreatingSeller}
                                    minLength={6}
                                />
                            </div>
                        </div>

                        {createSellerError && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
                                {createSellerError}
                            </div>
                        )}

                        <button 
                            type="submit"
                            disabled={isCreatingSeller}
                            className={`w-full font-bold py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 mt-4
                                ${isCreatingSeller 
                                    ? 'bg-slate-700 text-slate-400 cursor-wait' 
                                    : 'bg-brand-accent hover:bg-emerald-500 text-brand-dark shadow-emerald-500/20'}`}
                        >
                            {isCreatingSeller ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    Creando...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={20} />
                                    Crear Vendedor
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        )}

        {/* --- Edit Seller Modal --- */}
        {showEditSellerModal && editingUser && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                <div className="bg-brand-card w-full max-w-sm rounded-2xl shadow-2xl border border-white/20 overflow-hidden transform transition-all scale-100">
                    <div className="bg-brand-card p-6 flex flex-col items-center relative border-b border-white/10">
                        <button 
                            onClick={() => setShowEditSellerModal(false)}
                            className="absolute right-4 top-4 text-slate-400 hover:text-white"
                        >
                            <X size={20} />
                        </button>
                        <div className="bg-brand-push p-3 rounded-full mb-3 text-white">
                            <Pencil size={28} />
                        </div>
                        <h3 className="text-xl font-bold text-white">Editar Vendedor</h3>
                        <p className="text-slate-400 text-sm">Gestionar cuenta de {editingUser.email}</p>
                    </div>
                    
                    <div className="p-6 space-y-5">
                        <form onSubmit={handleUpdateUser} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold ml-1">Nombre</label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                        <UserIcon size={18} />
                                    </div>
                                    <input 
                                        type="text" 
                                        value={editNameInput}
                                        onChange={(e) => setEditNameInput(e.target.value)}
                                        className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-push/50 transition-all"
                                        placeholder="Nombre del Vendedor"
                                        required
                                        disabled={isUpdatingUser}
                                    />
                                </div>
                            </div>
                            
                            <button 
                                type="submit"
                                disabled={isUpdatingUser}
                                className="w-full py-2.5 bg-brand-push/20 hover:bg-brand-push/30 text-brand-push hover:text-white border border-brand-push/50 rounded-lg transition-all flex items-center justify-center gap-2 text-sm font-medium"
                            >
                                <Save size={16} />
                                Guardar Nombre
                            </button>
                        </form>

                        <div className="border-t border-white/10 pt-4 space-y-3">
                             <div className="bg-black/20 p-3 rounded-lg border border-white/10 flex items-start gap-3">
                                <AlertCircle className="text-yellow-500 shrink-0 mt-0.5" size={16} />
                                <p className="text-xs text-slate-400">
                                    Para cambiar el <strong>Email</strong>, elimine el usuario y créelo nuevamente.
                                </p>
                             </div>

                             <button 
                                onClick={handleSendResetPassword}
                                className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-all flex items-center justify-center gap-2 text-sm"
                            >
                                <Mail size={16} />
                                Enviar Correo de Restablecimiento
                            </button>

                             <button 
                                onClick={handleDeleteUser}
                                className="w-full py-2.5 bg-brand-danger/10 hover:bg-brand-danger/20 text-brand-danger border border-brand-danger/20 rounded-lg transition-all flex items-center justify-center gap-2 text-sm font-medium mt-2"
                            >
                                <Trash2 size={16} />
                                Eliminar Usuario
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* --- Change Own Password Modal --- */}
        {showChangePasswordModal && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                <div className="bg-brand-card w-full max-w-sm rounded-2xl shadow-2xl border border-white/20 overflow-hidden transform transition-all scale-100">
                    <div className="bg-brand-card p-6 flex flex-col items-center relative border-b border-white/10">
                        <button 
                            onClick={() => setShowChangePasswordModal(false)}
                            className="absolute right-4 top-4 text-slate-400 hover:text-white"
                        >
                            <X size={20} />
                        </button>
                        <div className="bg-brand-push p-3 rounded-full mb-3 text-white">
                            <Lock size={28} />
                        </div>
                        <h3 className="text-xl font-bold text-white">Cambiar Contraseña</h3>
                        <p className="text-slate-400 text-sm">Actualiza tu clave de acceso</p>
                    </div>
                    
                    <form onSubmit={handleChangeOwnPassword} className="p-6 space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold ml-1">Nueva Contraseña</label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                    <KeyRound size={18} />
                                </div>
                                <input 
                                    type="password" 
                                    value={newSelfPassword}
                                    onChange={(e) => setNewSelfPassword(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-push/50 transition-all"
                                    placeholder="Nueva clave"
                                    required
                                    minLength={6}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold ml-1">Confirmar Contraseña</label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                    <KeyRound size={18} />
                                </div>
                                <input 
                                    type="password" 
                                    value={confirmSelfPassword}
                                    onChange={(e) => setConfirmSelfPassword(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-push/50 transition-all"
                                    placeholder="Repetir nueva clave"
                                    required
                                    minLength={6}
                                />
                            </div>
                        </div>

                        {changePasswordError && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
                                {changePasswordError}
                            </div>
                        )}

                        <button 
                            type="submit"
                            disabled={isChangingPassword}
                            className={`w-full font-bold py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 mt-2
                                ${isChangingPassword 
                                    ? 'bg-slate-700 text-slate-400 cursor-wait' 
                                    : 'bg-brand-push hover:bg-brand-push/80 text-white shadow-brand-push/20'}`}
                        >
                            {isChangingPassword ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    Actualizando...
                                </>
                            ) : (
                                <>
                                    <Save size={20} />
                                    Actualizar Contraseña
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default App;
