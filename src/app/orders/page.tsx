'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Package, Calendar, CreditCard, Truck } from 'lucide-react';
import Link from 'next/link';

interface Order {
  orderId: string;
  customerEmail: string;
  customerName: string;
  total: number;
  currency: string;
  status: string;
  createdAt: string;
}

export default function OrdersPage() {
  const { data: session } = useSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserOrders = async () => {
      try {
        const response = await fetch('/api/orders');
        
        if (response.ok) {
          const userOrders = await response.json();
          setOrders(userOrders);
        } else {
          console.error('Failed to fetch orders:', response.statusText);
          setOrders([]);
        }
      } catch (error) {
        console.error('Error fetching orders:', error);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    if (session?.user?.email) {
      fetchUserOrders();
    } else {
      setLoading(false);
    }
  }, [session]);

  // This function is defined inside useEffect and used immediately

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Package className="h-4 w-4 text-blue-500" />;
      case 'processing':
        return <Package className="h-4 w-4 text-yellow-500" />;
      case 'shipped':
        return <Truck className="h-4 w-4 text-orange-500" />;
      case 'delivered':
        return <Package className="h-4 w-4 text-green-500" />;
      default:
        return <Package className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      case 'shipped':
        return 'bg-orange-100 text-orange-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatPrice = (price: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (!session?.user) return null;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
            <p className="mt-2 text-gray-600">
              Track and manage your order history
            </p>
          </div>

          {loading ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading your orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No orders yet
              </h3>
              <p className="text-gray-600 mb-4">
                When you place orders, they&apos;ll appear here.
              </p>
              <Link
                href="/products"
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Browse Products
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div key={order.orderId} className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(order.status)}
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          Order {order.orderId}
                        </h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            {formatDate(order.createdAt)}
                          </div>
                          <div className="flex items-center">
                            <CreditCard className="h-4 w-4 mr-1" />
                            {formatPrice(order.total, order.currency)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(
                        order.status
                      )}`}
                    >
                      {order.status}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-600">
                      <p>Shipped to: {order.customerName}</p>
                    </div>
                    <div className="space-x-3">
                      <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                        View Details
                      </button>
                      <button className="text-gray-600 hover:text-gray-700 text-sm font-medium">
                        Track Order
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}