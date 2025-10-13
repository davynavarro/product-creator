import AdminPanel from '../../components/AdminPanel';

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
          <p className="mt-2 text-gray-600">
            Manage your blob storage and product data
          </p>
        </div>
        <AdminPanel />
      </div>
    </div>
  );
}