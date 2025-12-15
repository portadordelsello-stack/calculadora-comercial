export type PaymentMethod = 'Tarjeta Débito/Crédito' | 'Transferencia' | 'Efectivo';

export type UserRole = 'admin' | 'seller';

export interface User {
  uid: string;      // Firebase Auth UID
  email?: string;   // Optional email
  username: string; // Display identifier (fallback)
  role: UserRole;
  name: string;
}

export interface Sale {
  id: string;
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