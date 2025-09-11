import React, { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'
import { AddressFormSimple } from './components/forms/AddressFormSimple'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 5 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
    },
  },
})

function ProgressiveApp() {
  const [addresses, setAddresses] = useState<any[]>([])

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center">
                <img 
                  src="/logo.png" 
                  alt="aboutwater" 
                  className="h-12 w-auto mr-3"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
                <h1 className="text-2xl font-bold text-gray-800">
                  aboutwater Route Optimizer - Progressive Test
                </h1>
              </div>
              <div className="text-sm text-gray-600">
                Testing AddressForm Component
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* AddressForm Test */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                📍 Testing AddressForm Component
              </h2>
              
              <AddressFormSimple
                onAddressAdded={(address) => {
                  console.log('Address added:', address)
                  setAddresses(prev => [...prev, address])
                  toast.success('AddressForm is working!')
                }}
                onError={(error) => {
                  console.error('AddressForm error:', error)
                  toast.error(`AddressForm error: ${error}`)
                }}
              />
            </div>

            {/* Results */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                📋 Added Addresses ({addresses.length})
              </h2>
              
              {addresses.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">📍</div>
                  <p>No addresses added yet.</p>
                  <p className="text-sm">Use the AddressForm to add some addresses.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {addresses.map((address, index) => (
                    <div 
                      key={address.id || index}
                      className="p-3 bg-gray-50 rounded border"
                    >
                      <div className="font-medium text-gray-800">
                        {address.deliveryId || `Address ${index + 1}`}
                      </div>
                      <div className="text-sm text-gray-600">
                        {address.address}
                      </div>
                      {address.bottleCount && (
                        <div className="text-xs text-blue-600">
                          {address.bottleCount} bottles
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              🔍 Component Test Status
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="text-green-500 text-2xl mr-3">✅</div>
                  <div>
                    <div className="font-semibold text-green-800">React Base</div>
                    <div className="text-sm text-green-600">Working</div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="text-blue-500 text-2xl mr-3">🔄</div>
                  <div>
                    <div className="font-semibold text-blue-800">AddressForm</div>
                    <div className="text-sm text-blue-600">Testing...</div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="text-gray-500 text-2xl mr-3">⏳</div>
                  <div>
                    <div className="font-semibold text-gray-800">Advanced Components</div>
                    <div className="text-sm text-gray-600">Pending</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#fff',
              color: '#333',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
            },
          }}
        />
      </div>
    </QueryClientProvider>
  )
}

export default ProgressiveApp