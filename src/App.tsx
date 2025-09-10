import React, { useState, useRef } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'
import { AddressForm } from './components/forms/AddressForm'
import { RouteMap } from './components/map/RouteMap'
import { TourOptimizer } from './algorithms/tour-optimizer'
import { exportService } from './services/export-service'

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 5 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
    },
  },
})

function App() {
  const [addresses, setAddresses] = useState<any[]>([])
  const [optimizedRoutes, setOptimizedRoutes] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleOptimizeRoutes = async () => {
    if (addresses.length < 2) {
      toast.error('Need at least 2 addresses to optimize routes')
      return
    }

    setIsOptimizing(true)
    toast.loading('Optimizing routes...', { id: 'optimize' })

    try {
      const optimizer = new TourOptimizer({
        maxVehicleCapacity: 80,
        maxRouteDistance: 150,
        maxRouteTime: 8 * 60,
        vehicleSpeed: 30,
      })

      const optimizedTours = await optimizer.optimizeRoutes(addresses)
      
      setOptimizedRoutes(optimizedTours)
      toast.success(`Successfully optimized into ${optimizedTours.length} route(s)!`, { id: 'optimize' })
    } catch (error) {
      console.error('Route optimization error:', error)
      toast.error('Failed to optimize routes. Please try again.', { id: 'optimize' })
    } finally {
      setIsOptimizing(false)
    }
  }

  const handleExcelImport = () => {
    fileInputRef.current?.click()
  }

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Please select an Excel file (.xlsx or .xls)')
      return
    }

    setIsImporting(true)
    toast.loading('Importing addresses from Excel...', { id: 'import' })

    try {
      // Dynamic import for xlsx
      const XLSX = await import('xlsx')
      
      const fileReader = new FileReader()
      fileReader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: 'array' })
          
          // Get the first worksheet
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          
          // Convert to JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
          
          if (jsonData.length < 2) {
            throw new Error('Excel file must have at least a header row and one data row')
          }

          // Parse headers and data
          const headers = jsonData[0].map(h => String(h).toLowerCase().trim())
          const dataRows = jsonData.slice(1)

          // Find column indices (flexible column mapping)
          const addressCol = headers.findIndex(h => 
            h.includes('address') || h.includes('location') || h.includes('street')
          )
          const deliveryIdCol = headers.findIndex(h => 
            h.includes('delivery') && h.includes('id') || h.includes('deliveryid') || h.includes('id')
          )
          const bottleCol = headers.findIndex(h => 
            h.includes('bottle') || h.includes('qty') || h.includes('quantity') || h.includes('amount')
          )

          if (addressCol === -1) {
            throw new Error('Could not find address column. Please ensure your Excel file has a column named "Address", "Location", or "Street"')
          }

          const importedAddresses: any[] = []
          let successCount = 0

          for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i]
            if (!row || !row[addressCol]) continue

            const address = String(row[addressCol]).trim()
            if (!address) continue

            // Generate delivery ID if not provided
            let deliveryId = deliveryIdCol >= 0 && row[deliveryIdCol] 
              ? String(row[deliveryIdCol]).trim() 
              : `IMP-${String(i + 1).padStart(3, '0')}`

            // Check for duplicate delivery IDs
            if (addresses.some(a => a.deliveryId === deliveryId) || 
                importedAddresses.some(a => a.deliveryId === deliveryId)) {
              deliveryId = `${deliveryId}-${Date.now()}`
            }

            const bottleCount = bottleCol >= 0 && row[bottleCol] 
              ? parseInt(String(row[bottleCol])) || 1 
              : 5

            // Simulate geocoding with coordinates near Munich
            const randomLat = 48.1375 + (Math.random() - 0.5) * 0.2
            const randomLng = 11.5755 + (Math.random() - 0.5) * 0.2

            const newAddress = {
              id: `import-${Date.now()}-${i}`,
              address,
              coordinates: { lat: randomLat, lng: randomLng },
              deliveryId,
              bottleCount: Math.min(bottleCount, 80), // Cap at 80
            }

            importedAddresses.push(newAddress)
            successCount++
          }

          if (importedAddresses.length === 0) {
            throw new Error('No valid addresses found in the Excel file')
          }

          // Add imported addresses to the list
          setAddresses(prev => [...prev, ...importedAddresses])
          toast.success(`Successfully imported ${successCount} addresses from Excel!`, { id: 'import' })

          // Clear the file input
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }

        } catch (parseError) {
          console.error('Excel parsing error:', parseError)
          toast.error(parseError instanceof Error ? parseError.message : 'Failed to parse Excel file', { id: 'import' })
        } finally {
          setIsImporting(false)
        }
      }

      fileReader.readAsArrayBuffer(file)

    } catch (error) {
      console.error('Excel import error:', error)
      toast.error('Failed to import Excel file. Please try again.', { id: 'import' })
      setIsImporting(false)
    }
  }

  const handleExportToGoogleMaps = async () => {
    if (optimizedRoutes.length === 0) {
      toast.error('No optimized routes to export. Please optimize routes first.')
      return
    }

    try {
      await exportService.exportToGoogleMaps(optimizedRoutes)
      toast.success('Routes exported to Google Maps successfully!')
    } catch (error) {
      console.error('Google Maps export error:', error)
      toast.error('Failed to export to Google Maps. Please try again.')
    }
  }

  const handleExportToExcel = async () => {
    if (optimizedRoutes.length === 0) {
      toast.error('No optimized routes to export. Please optimize routes first.')
      return
    }

    try {
      await exportService.exportToExcel(optimizedRoutes)
      toast.success('Routes exported to Excel successfully!')
    } catch (error) {
      console.error('Excel export error:', error)
      toast.error('Failed to export to Excel. Please try again.')
    }
  }

  const handleAddSampleAddress = () => {
    setIsLoading(true)
    setTimeout(() => {
      const sampleAddresses = [
        'Marienplatz 1, Munich, Germany',
        'Odeonsplatz 2, Munich, Germany', 
        'Leopoldstraße 50, Munich, Germany',
        'Maximilianstraße 25, Munich, Germany',
        'Sendlinger Straße 10, Munich, Germany',
        'Karlsplatz 1, Munich, Germany',
        'Viktualienmarkt 3, Munich, Germany',
      ]
      
      const randomAddress = sampleAddresses[Math.floor(Math.random() * sampleAddresses.length)]
      const randomLat = 48.1375 + (Math.random() - 0.5) * 0.1
      const randomLng = 11.5755 + (Math.random() - 0.5) * 0.1
      
      const sampleAddress = {
        id: Date.now().toString(),
        address: randomAddress,
        coordinates: { lat: randomLat, lng: randomLng },
        deliveryId: `DEL-${String(addresses.length + 1).padStart(3, '0')}`,
        bottleCount: Math.floor(Math.random() * 20) + 1,
      }
      setAddresses(prev => [...prev, sampleAddress])
      setIsLoading(false)
      toast.success('Sample address added successfully!')
    }, 1000)
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-50 relative">
        {/* Subtle overlay for better contrast */}
        <div className="absolute inset-0 bg-white/5"></div>
        
        {/* Main content */}
        <div className="relative z-10">
        {/* Header */}
        <header className="bg-white shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center">
                <img 
                  src="/logo.png" 
                  alt="AboutWater" 
                  className="h-12 w-auto mr-3"
                  onError={(e) => {
                    // Fallback to text logo if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = document.createElement('div');
                    fallback.className = 'h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center mr-3';
                    fallback.innerHTML = '<span class="text-white font-bold text-lg">AW</span>';
                    target.parentNode?.insertBefore(fallback, target);
                  }}
                />
                <h1 className="text-2xl font-bold text-gray-800">
                  AboutWater Route Optimizer
                </h1>
              </div>
              <div className="text-sm text-gray-600">
                v4.0.0 - Enterprise Edition
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Control Panel */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                📍 Address Management
              </h2>
              
              <AddressForm
                onAddressAdded={(address) => {
                  setAddresses(prev => [...prev, address])
                  toast.success('Address added successfully!')
                }}
                onError={(error) => {
                  toast.error(error)
                }}
              />
              
              <div className="mt-6 space-y-3">
                <div className="text-center">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500">or</span>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleExcelImport}
                    disabled={isImporting || isLoading}
                    className={`py-2 px-4 rounded-lg font-medium transition-colors duration-300 text-sm ${
                      isImporting || isLoading 
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                        : 'bg-green-100 hover:bg-green-200 text-green-700'
                    }`}
                  >
                    {isImporting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Importing...
                      </>
                    ) : (
                      '📊 Import Excel'
                    )}
                  </button>
                  
                  <button
                    onClick={handleAddSampleAddress}
                    disabled={isLoading || isImporting}
                    className={`py-2 px-4 rounded-lg font-medium transition-colors duration-300 text-sm ${
                      isLoading || isImporting 
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    + Sample Data
                  </button>
                </div>
                
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileImport}
                  className="hidden"
                />
                
                {/* Excel Import Instructions */}
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                  <div className="font-medium mb-1">📋 Excel Import Format:</div>
                  <div className="space-y-1">
                    <div>• <strong>Address</strong> column (required): Full delivery addresses</div>
                    <div>• <strong>DeliveryID</strong> column (optional): Unique identifiers</div>
                    <div>• <strong>Bottles</strong> column (optional): Quantity per delivery</div>
                    <div>• Column names are flexible (e.g., "Location", "Street", "Qty", "Amount")</div>
                  </div>
                </div>
              </div>

              {/* Address List */}
              <div className="space-y-3">
                <h3 className="text-lg font-medium text-gray-700">
                  Addresses ({addresses.length})
                </h3>
                
                {addresses.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-2">📍</div>
                    <p>No addresses added yet.</p>
                    <p className="text-sm">Click "Add Sample Address" to get started!</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {addresses.map((address, index) => (
                      <div 
                        key={address.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-gray-800">
                            {address.deliveryId}
                          </div>
                          <div className="text-sm text-gray-600">
                            {address.address}
                          </div>
                          <div className="text-xs text-blue-600">
                            {address.bottleCount} bottles
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setAddresses(prev => prev.filter(a => a.id !== address.id))
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

              {addresses.length > 0 && (
                <div className="mt-6 pt-4 border-t">
                  <button
                    onClick={handleOptimizeRoutes}
                    disabled={isOptimizing}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-colors duration-300 ${
                      isOptimizing 
                        ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {isOptimizing ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Optimizing Routes...
                      </>
                    ) : (
                      `🚀 Optimize Routes (${addresses.length} addresses)`
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Interactive Map */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                🗺️ Route Visualization
              </h2>
              
              <RouteMap 
                addresses={addresses}
                routes={optimizedRoutes}
                className="w-full h-80"
              />
            </div>
          </div>

          {/* Optimized Routes Results */}
          {optimizedRoutes.length > 0 && (
            <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                🗺️ Optimized Routes
              </h2>
              
              <div className="space-y-4">
                {optimizedRoutes.map((tour, tourIndex) => (
                  <div key={tourIndex} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-medium text-gray-800">
                        Route {tourIndex + 1}
                      </h3>
                      <div className="text-sm text-gray-600">
                        {tour.addresses?.length || 0} stops • {tour.totalDistance?.toFixed(2) || 0}km • {Math.round((tour.estimatedDuration || 0)/60)}min
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {tour.addresses?.map((address: any, index: number) => (
                        <div key={address.id} className="flex items-center space-x-3 p-2 bg-gray-50 rounded">
                          <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-gray-800">{address.deliveryId}</div>
                            <div className="text-sm text-gray-600">{address.address}</div>
                          </div>
                          <div className="text-sm text-blue-600">{address.bottleCount} bottles</div>
                        </div>
                      )) || []}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Export Actions */}
              <div className="mt-6 pt-4 border-t">
                <h3 className="text-lg font-medium text-gray-800 mb-3">Export Optimized Routes</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={handleExportToGoogleMaps}
                    className="flex items-center justify-center py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-300"
                  >
                    <span className="mr-2">🗺️</span>
                    Export to Google Maps
                  </button>
                  
                  <button
                    onClick={handleExportToExcel}
                    className="flex items-center justify-center py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors duration-300"
                  >
                    <span className="mr-2">📊</span>
                    Export to Excel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* System Status */}
          <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              ⚡ System Status
            </h2>
            
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
                    <div className="font-semibold text-blue-800">Query Client</div>
                    <div className="text-sm text-blue-600">Ready for API calls</div>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="text-yellow-500 text-2xl mr-3">⚠️</div>
                  <div>
                    <div className="font-semibold text-yellow-800">Advanced Features</div>
                    <div className="text-sm text-yellow-600">Loading...</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Toast Notifications */}
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
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
        </div>
      </div>
    </QueryClientProvider>
  )
}

export default App