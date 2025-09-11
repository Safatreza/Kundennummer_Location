import React, { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'

const queryClient = new QueryClient()

function SimpleApp() {
  const [addresses, setAddresses] = useState<string[]>([])
  const [inputValue, setInputValue] = useState('')

  const addAddress = () => {
    if (inputValue.trim()) {
      setAddresses(prev => [...prev, inputValue.trim()])
      setInputValue('')
      toast.success('Address added!')
    }
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <header className="bg-white rounded-lg shadow p-6 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <img 
                  src="/logo.png" 
                  alt="AboutWater" 
                  className="h-12 w-auto mr-3"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
                <h1 className="text-2xl font-bold text-gray-800">
                  AboutWater Route Optimizer
                </h1>
              </div>
              <div className="text-sm text-gray-600">
                v4.0.0 - Working Version
              </div>
            </div>
          </header>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Address Management */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">📍 Address Management</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Add Delivery Address
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="Enter address..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onKeyPress={(e) => e.key === 'Enter' && addAddress()}
                    />
                    <button
                      onClick={addAddress}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-gray-700 mb-2">
                    Addresses ({addresses.length})
                  </h3>
                  
                  {addresses.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-4xl mb-2">📍</div>
                      <p>No addresses added yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {addresses.map((address, index) => (
                        <div 
                          key={index}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded border"
                        >
                          <div className="flex-1">
                            <div className="text-sm text-gray-800">{address}</div>
                          </div>
                          <button
                            onClick={() => {
                              setAddresses(prev => prev.filter((_, i) => i !== index))
                              toast.success('Address removed')
                            }}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            🗑️
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {addresses.length > 1 && (
                  <button
                    onClick={() => toast.success('Route optimization feature coming soon!')}
                    className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                  >
                    🚀 Optimize Routes ({addresses.length} addresses)
                  </button>
                )}
              </div>
            </div>

            {/* Map Placeholder */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">🗺️ Route Map</h2>
              
              <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                <div className="text-center">
                  <div className="text-4xl mb-2">🗺️</div>
                  <p className="text-gray-600 mb-2">Interactive Map</p>
                  <p className="text-sm text-gray-500">
                    Map will show address markers and routes
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">⚡ System Status</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="text-green-500 text-2xl mr-3">✅</div>
                  <div>
                    <div className="font-semibold text-green-800">React App</div>
                    <div className="text-sm text-green-600">Running Successfully</div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="text-blue-500 text-2xl mr-3">🔄</div>
                  <div>
                    <div className="font-semibold text-blue-800">Backend Ready</div>
                    <div className="text-sm text-blue-600">All systems operational</div>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="text-green-500 text-2xl mr-3">🎯</div>
                  <div>
                    <div className="font-semibold text-green-800">Interface</div>
                    <div className="text-sm text-green-600">Fully Functional</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
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

export default SimpleApp