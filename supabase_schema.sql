-- ==============================================================================
-- COMERCICALC PRO - SUPABASE DATABASE SCHEMA
-- ==============================================================================
-- Ejecuta este script en el "SQL Editor" de tu panel de Supabase.
-- ==============================================================================

-- 1. TABLA: PROFILES (Roles y nombres de empleados / admins)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'seller' CHECK (role IN ('admin', 'seller')),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- 2. TABLA: SALES (Historial de ventas de la calculadora)
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC(12, 2) NOT NULL,
  payment_method TEXT NOT NULL,
  date TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_sales_timestamp ON public.sales(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON public.sales(user_id);

-- 3. FUNCIÓN Y TRIGGER: CREAR PERFIL AUTOMÁTICAMENTE AL REGISTRAR USUARIO
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), 'Usuario'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'seller')
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. FUNCIÓN AUXILIAR: VERIFICAR SI EL USUARIO ES ADMIN
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 5. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS RLS: PROFILES
DROP POLICY IF EXISTS "Ver perfiles" ON public.profiles;
CREATE POLICY "Ver perfiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Actualizar perfil propio o admin" ON public.profiles;
CREATE POLICY "Actualizar perfil propio o admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Eliminar perfil solo admin" ON public.profiles;
CREATE POLICY "Eliminar perfil solo admin" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Insertar perfiles admin o trigger" ON public.profiles;
CREATE POLICY "Insertar perfiles admin o trigger" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- POLÍTICAS RLS: SALES
DROP POLICY IF EXISTS "Ver ventas propias o admin" ON public.sales;
CREATE POLICY "Ver ventas propias o admin" ON public.sales
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Registrar ventas" ON public.sales;
CREATE POLICY "Registrar ventas" ON public.sales
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Borrar ventas solo admin" ON public.sales;
CREATE POLICY "Borrar ventas solo admin" ON public.sales
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- 6. HABILITAR PUBLICACIÓN EN TIEMPO REAL (REALTIME)
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
