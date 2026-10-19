export type PaymentMethod = 'Tarjeta Débito/Crédito' | 'Transferencia' | 'Efectivo';

export type UserRole = 'superadmin' | 'business_admin' | 'seller';

export type BusinessPlan = 'basico' | 'estandar' | 'pro' | 'custom';

export interface Business {
  id: string;
  code: string; // ej: 'dontito', 'panaderia'
  name: string; // ej: 'Panadería San Cayetano'
  plan: BusinessPlan;
  maxSellers: number;
  isActive: boolean;
  createdAt?: string;
  // Campos calculados
  sellerCount?: number;
  totalSales?: number;
}

export interface User {
  uid: string;
  businessId?: string | null;
  businessCode?: string | null;
  businessName?: string | null;
  username: string; // ej: 'jose', 'caja1', 'admin'
  name: string;     // ej: 'José Pérez'
  email?: string;
  role: UserRole;
}

export interface Sale {
  id: string;
  businessId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  date: string; // ISO string
  timestamp: number;
  userId: string; // UID of the seller
  userName: string; // Display name of the seller
}

export enum Operator {
  ADD = '+',
  SUBTRACT = '-',
  MULTIPLY = '×',
  DIVIDE = '÷',
  NONE = ''
}

export type ButtonVariant = 'default' | 'action' | 'accent' | 'push' | 'danger';