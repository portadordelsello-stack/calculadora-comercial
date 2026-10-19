-- ==============================================================================
-- COMERCICALC PRO - SUPABASE SAAS MULTI-TENANT SCHEMA (v3)
-- ==============================================================================
-- Ejecuta este script en el "SQL Editor" de tu panel de Supabase.
-- ==============================================================================

-- 1. EXTENSIÓN PARA UUIDS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Eliminar trigger antiguo si existía en la base de datos
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. TABLA: BUSINESSES (Comercios registrados)
CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- Código único del comercio (ej. 'panaderia', 'dontito')
  name TEXT NOT NULL,         -- Nombre público del negocio (ej. 'Panadería San Cayetano')
  plan TEXT NOT NULL DEFAULT 'estandar' CHECK (plan IN ('basico', 'estandar', 'pro', 'custom')),
  max_sellers INT NOT NULL DEFAULT 5, -- Límite de cajeros permitidos
  is_active BOOLEAN NOT NULL DEFAULT true, -- Interruptor activo / suspendido
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_businesses_code ON public.businesses(code);

-- 3. TABLA: PROFILES (Superadmins, Dueños de comercio y Cajeros)
-- Si la tabla profiles ya existía con restricciones viejas, actualizamos la restricción del rol:
DO $$ 
BEGIN
  -- Eliminar constraint viejo si existe
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_check') THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE, -- NULL si es superadmin
  business_code TEXT, -- Código redundante para búsquedas rápidas
  username TEXT, -- Nombre de usuario visible (ej: 'jose', 'caja1', 'admin')
  name TEXT NOT NULL,     -- Nombre completo para mostrar
  email TEXT,             -- Email interno o real
  role TEXT NOT NULL DEFAULT 'seller',
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- Asegurar columnas si la tabla ya existía
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;

-- Aplicar restricción de roles permitidos (incluyendo 'admin' para retrocompatibilidad)
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('superadmin', 'business_admin', 'seller', 'admin'));

-- Índices
CREATE INDEX IF NOT EXISTS idx_profiles_business_id ON public.profiles(business_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 4. TABLA: SALES (Historial de ventas de la calculadora)
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  payment_method TEXT NOT NULL,
  date TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_sales_business_id ON public.sales(business_id);
CREATE INDEX IF NOT EXISTS idx_sales_timestamp ON public.sales(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON public.sales(user_id);

-- ==============================================================================
-- 5. FUNCIONES AUXILIARES DE SEGURIDAD (RLS HELPERS)
-- ==============================================================================

-- Función para auto-confirmar emails creados internamente
CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email_confirmed_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_auto_confirm ON auth.users;
CREATE TRIGGER on_auth_user_auto_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_user();

-- Confirmar usuarios existentes pendientes
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email_confirmed_at IS NULL;

-- Función para verificar si el usuario conectado es SUPERADMIN
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'superadmin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Función para verificar si el usuario conectado es ADMIN DE SU NEGOCIO
CREATE OR REPLACE FUNCTION public.is_business_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'business_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Función para obtener el business_id del usuario conectado
CREATE OR REPLACE FUNCTION public.current_business_id()
RETURNS UUID AS $$
  SELECT business_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ==============================================================================
-- 6. HABILITAR ROW LEVEL SECURITY (RLS)
-- ==============================================================================
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- POLÍTICAS RLS: BUSINESSES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Superadmin control total comercios" ON public.businesses;
CREATE POLICY "Superadmin control total comercios" ON public.businesses
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "Comercio puede leer su propio negocio" ON public.businesses;
CREATE POLICY "Comercio puede leer su propio negocio" ON public.businesses
  FOR SELECT TO authenticated
  USING (id = public.current_business_id());

DROP POLICY IF EXISTS "Lectura anonima de negocios activos para login" ON public.businesses;
CREATE POLICY "Lectura anonima de negocios activos para login" ON public.businesses
  FOR SELECT TO anon
  USING (is_active = true);

-- ------------------------------------------------------------------------------
-- POLÍTICAS RLS: PROFILES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Superadmin control total perfiles" ON public.profiles;
CREATE POLICY "Superadmin control total perfiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "Ver perfiles del mismo comercio" ON public.profiles;
CREATE POLICY "Ver perfiles del mismo comercio" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    business_id = public.current_business_id()
    OR id = auth.uid()
  );

DROP POLICY IF EXISTS "Admin comercio gestiona perfiles de su negocio" ON public.profiles;
CREATE POLICY "Admin comercio gestiona perfiles de su negocio" ON public.profiles
  FOR ALL TO authenticated
  USING (
    public.is_business_admin() AND business_id = public.current_business_id()
  )
  WITH CHECK (
    public.is_business_admin() AND business_id = public.current_business_id()
  );

DROP POLICY IF EXISTS "Usuario actualiza su propio perfil" ON public.profiles;
CREATE POLICY "Usuario actualiza su propio perfil" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ------------------------------------------------------------------------------
-- POLÍTICAS RLS: SALES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Superadmin control total ventas" ON public.sales;
CREATE POLICY "Superadmin control total ventas" ON public.sales
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "Ver ventas de su propio negocio" ON public.sales;
CREATE POLICY "Ver ventas de su propio negocio" ON public.sales
  FOR SELECT TO authenticated
  USING (
    business_id = public.current_business_id()
    AND (
      public.is_business_admin() 
      OR user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Insertar ventas con business_id propio" ON public.sales;
CREATE POLICY "Insertar ventas con business_id propio" ON public.sales
  FOR INSERT TO authenticated
  WITH CHECK (
    business_id = public.current_business_id()
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Admin borra ventas de su propio negocio" ON public.sales;
CREATE POLICY "Admin borra ventas de su propio negocio" ON public.sales
  FOR DELETE TO authenticated
  USING (
    public.is_business_admin() 
    AND business_id = public.current_business_id()
  );

-- ==============================================================================
-- 7. HABILITAR PUBLICACIÓN EN TIEMPO REAL (REALTIME)
-- ==============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.businesses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
