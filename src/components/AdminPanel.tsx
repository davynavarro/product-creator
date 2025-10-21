'use client';

import { useState } from 'react';
import { Trash2, Database, AlertTriangle, Eye, Loader2, Folder } from 'lucide-react';
import CategoryManagement from './CategoryManagement';

interface BlobInfo {
  pathname: string;
  size: number;
  uploadedAt: string;
}

interface StorageStats {
  totalBlobs: number;
  totalSize: number;
  blobs: BlobInfo[];
}

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('storage');
  const [isClearing, setIsClearing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const tabs = [
    { id: 'storage', name: 'Storage Management', icon: Database },
    { id: 'categories', name: 'Category Management', icon: Folder },
  ];

  const loadStorageStats = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/clear-all', {
        method: 'GET',
      });
      
      if (response.ok) {
        const data = await response.json();
        setStorageStats(data);
      } else {
        setMessage('Failed to load storage stats');
      }
    } catch (error) {
      console.error('Error loading storage stats:', error);
      setMessage('Error loading storage stats');
    } finally {
      setIsLoading(false);
    }
  };

  const clearAllStorage = async () => {
    setIsClearing(true);
    setMessage(null);
    
    try {
      const response = await fetch('/api/clear-all', {
        method: 'DELETE',
      });

      if (response.ok) {
        const result = await response.json();
        setMessage(result.message);
        setStorageStats(null); // Reset stats since everything is cleared
        setShowConfirm(false);
      } else {
        const error = await response.json();
        setMessage(`Failed to clear storage: ${error.error}`);
      }
    } catch (error) {
      console.error('Error clearing storage:', error);
      setMessage('Error clearing storage');
    } finally {
      setIsClearing(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'categories' && <CategoryManagement />}
      
      {activeTab === 'storage' && (
        <>
          {/* Storage Stats Section */}
          <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Database className="h-5 w-5 mr-2" />
            Storage Overview
          </h2>
          <button
            onClick={loadStorageStats}
            disabled={isLoading}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Eye className="h-4 w-4 mr-2" />
            )}
            {isLoading ? 'Loading...' : 'Load Stats'}
          </button>
        </div>

        {storageStats && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm text-blue-600">Total Files</div>
                <div className="text-2xl font-bold text-blue-900">
                  {storageStats.totalBlobs}
                </div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-green-600">Total Size</div>
                <div className="text-2xl font-bold text-green-900">
                  {formatBytes(storageStats.totalSize)}
                </div>
              </div>
            </div>

            {storageStats.blobs.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Files in Storage</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Path
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Size
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Uploaded
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {storageStats.blobs.map((blob, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {blob.pathname}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatBytes(blob.size)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(blob.uploadedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {!storageStats && !isLoading && (
          <div className="text-center py-8 text-gray-500">
            Click &quot;Load Stats&quot; to view storage information
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
        <h2 className="text-xl font-semibold text-red-900 flex items-center mb-4">
          <AlertTriangle className="h-5 w-5 mr-2" />
          Danger Zone
        </h2>
        
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Clear All Blob Storage
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>
                  This will permanently delete ALL files from your Vercel Blob storage including:
                </p>
                <ul className="list-disc list-inside mt-1">
                  <li>All product images</li>
                  <li>Products index file</li>
                  <li>Individual product data files</li>
                </ul>
                <p className="mt-2 font-medium">
                  This action cannot be undone!
                </p>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowConfirm(true)}
          disabled={isClearing}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          {isClearing ? 'Clearing...' : 'Clear All Storage'}
        </button>
      </div>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mt-3">
                Confirm Deletion
              </h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">
                  Are you absolutely sure you want to delete ALL blob storage data? 
                  This will remove all products, images, and cannot be undone.
                </p>
              </div>
              <div className="items-center px-4 py-3">
                <button
                  onClick={clearAllStorage}
                  disabled={isClearing}
                  className="px-4 py-2 bg-red-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300 disabled:opacity-50 mr-2"
                >
                  {isClearing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 inline animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Yes, Delete Everything'
                  )}
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={isClearing}
                  className="px-4 py-2 bg-gray-300 text-gray-700 text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 mt-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

          {/* Status Message */}
          {message && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-blue-700">
                    {message}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}