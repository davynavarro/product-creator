'use client';

import { CartProvider } from "@/contexts/CartContext";
import AuthProvider from "@/components/AuthProvider";
import Navigation from "@/components/Navigation";

interface ClientLayoutProps {
  children: React.ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <AuthProvider>
      <CartProvider>
        <Navigation />
        {children}
      </CartProvider>
    </AuthProvider>
  );
}