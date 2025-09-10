import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { AddressForm } from './components/forms/AddressForm'

const queryClient = new QueryClient()

function TestApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">
              AboutWater Route Optimizer - Debug Test
            </h1>
            
            <div className="space-y-4">
              <Button
                onClick={() => toast.success('UI Button working!')}
              >
                Test UI Button Component
              </Button>
              
              <div className="p-4 bg-green-50 border border-green-200 rounded">
                <p className="text-green-800">✅ React + Vite: Working</p>
                <p className="text-green-800">✅ Tailwind CSS: Working</p>
                <p className="text-green-800">✅ React Query: Working</p>
                <p className="text-green-800">✅ Hot Toast: Working</p>
                <p className="text-green-800">✅ UI Button: Working</p>
              </div>
              
              <div className="mt-6">
                <h2 className="text-lg font-semibold mb-3">Testing AddressForm Component:</h2>
                <AddressForm
                  onAddressAdded={(address) => {
                    console.log('Address added:', address)
                    toast.success('AddressForm working!')
                  }}
                  onError={(error) => {
                    console.error('AddressForm error:', error)
                    toast.error(error)
                  }}
                />
              </div>
              
              <div className="text-sm text-gray-600">
                <p>If you can see this page, the basic setup is working correctly.</p>
                <p>The issue must be with one of the advanced component imports.</p>
              </div>
            </div>
          </div>
        </div>
        
        <Toaster position="top-right" />
      </div>
    </QueryClientProvider>
  )
}

export default TestApp