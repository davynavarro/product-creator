'use client';

import { CartProvider } from "@/contexts/CartContext";
import Navigation from "@/components/Navigation";

interface ClientLayoutProps {
  children: React.ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <CartProvider>
      <Navigation />
      {children}
    </CartProvider>
  );
}