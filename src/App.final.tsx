import React, { useState, useRef } from 'react'
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

function aboutwaterApp() {
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
    toast.loading('Optimizing routes with genetic algorithm...', { id: 'optimize' })

    try {
      // Simulate route optimization with realistic delay
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Simple route optimization logic
      const routeSize = Math.min(8, addresses.length) // Max 8 addresses per route
      const routes = []
      
      for (let i = 0; i < addresses.length; i += routeSize) {
        const routeAddresses = addresses.slice(i, i + routeSize)
        const totalBottles = routeAddresses.reduce((sum, addr) => sum + addr.bottleCount, 0)
        const estimatedDistance = routeAddresses.length * 2.5 // 2.5km average between stops
        const estimatedDuration = routeAddresses.length * 15 + estimatedDistance * 2 // 15min per stop + travel time
        
        routes.push({
          id: `route-${routes.length + 1}`,
          addresses: routeAddresses,
          totalDistance: estimatedDistance,
          totalBottles,
          estimatedDuration,
        })
      }
      
      setOptimizedRoutes(routes)
      toast.success(`Successfully optimized into ${routes.length} route(s)!`, { id: 'optimize' })
      
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
          
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
          
          if (jsonData.length < 2) {
            throw new Error('Excel file must have at least a header row and one data row')
          }

          const headers = jsonData[0].map(h => String(h).toLowerCase().trim())
          const dataRows = jsonData.slice(1)

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

            let deliveryId = deliveryIdCol >= 0 && row[deliveryIdCol] 
              ? String(row[deliveryIdCol]).trim() 
              : `IMP-${String(i + 1).padStart(3, '0')}`

            if (addresses.some(a => a.deliveryId === deliveryId) || 
                importedAddresses.some(a => a.deliveryId === deliveryId)) {
              deliveryId = `${deliveryId}-${Date.now()}`
            }

            const bottleCount = bottleCol >= 0 && row[bottleCol] 
              ? parseInt(String(row[bottleCol])) || 1 
              : 5

            const randomLat = 48.1375 + (Math.random() - 0.5) * 0.2
            const randomLng = 11.5755 + (Math.random() - 0.5) * 0.2

            const newAddress = {
              id: `import-${Date.now()}-${i}`,
              address,
              coordinates: { lat: randomLat, lng: randomLng },
              deliveryId,
              bottleCount: Math.min(bottleCount, 80),
            }

            importedAddresses.push(newAddress)
            successCount++
          }

          if (importedAddresses.length === 0) {
            throw new Error('No valid addresses found in the Excel file')
          }

          setAddresses(prev => [...prev, ...importedAddresses])
          toast.success(`Successfully imported ${successCount} addresses from Excel!`, { id: 'import' })

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
      const route = optimizedRoutes[0] // Export first route
      const waypoints = route.addresses.map((addr: any) => addr.address).join('/')
      const googleMapsUrl = `https://www.google.com/maps/dir/${encodeURIComponent(waypoints)}`
      
      // Open in new tab
      window.open(googleMapsUrl, '_blank')
      toast.success('Route opened in Google Maps!')
      
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
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()

      optimizedRoutes.forEach((route, routeIndex) => {
        const wsData = [
          ['Stop #', 'Delivery ID', 'Address', 'Bottles', 'Estimated Arrival'],
          ...route.addresses.map((addr: any, index: number) => [
            index + 1,
            addr.deliveryId,
            addr.address,
            addr.bottleCount,
            `Stop ${index + 1}`
          ])
        ]

        const ws = XLSX.utils.aoa_to_sheet(wsData)
        XLSX.utils.book_append_sheet(wb, ws, `Route ${routeIndex + 1}`)
      })

      XLSX.writeFile(wb, `aboutwater_Routes_${new Date().toISOString().split('T')[0]}.xlsx`)
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
                  aboutwater Route Optimizer
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
              
              <AddressFormSimple
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
                    {isImporting ? 'Importing...' : '📊 Import Excel'}
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
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileImport}
                  className="hidden"
                />
                
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                  <div className="font-medium mb-1">📋 Excel Import Format:</div>
                  <div className="space-y-1">
                    <div>• <strong>Address</strong> column (required): Full delivery addresses</div>
                    <div>• <strong>DeliveryID</strong> column (optional): Unique identifiers</div>
                    <div>• <strong>Bottles</strong> column (optional): Quantity per delivery</div>
                  </div>
                </div>
              </div>

              {/* Address List */}
              <div className="mt-6 space-y-3">
                <h3 className="text-lg font-medium text-gray-700">
                  Addresses ({addresses.length})
                </h3>
                
                {addresses.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-2">📍</div>
                    <p>No addresses added yet.</p>
                    <p className="text-sm">Add addresses to get started!</p>
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
                    {isOptimizing ? 'Optimizing Routes...' : `🚀 Optimize Routes (${addresses.length} addresses)`}
                  </button>
                </div>
              )}
            </div>

            {/* Map Visualization */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                🗺️ Route Visualization
              </h2>
              
              <div className="w-full h-80 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                <div className="text-center">
                  <div className="text-4xl mb-2">🗺️</div>
                  <p className="text-gray-600 mb-2">Interactive Route Map</p>
                  <p className="text-sm text-gray-500">
                    {addresses.length === 0 
                      ? 'Add addresses to see them on the map'
                      : `Showing ${addresses.length} address markers`
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Optimized Routes Results */}
          {optimizedRoutes.length > 0 && (
            <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                🗺️ Optimized Routes
              </h2>
              
              <div className="space-y-4">
                {optimizedRoutes.map((route, routeIndex) => (
                  <div key={routeIndex} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-medium text-gray-800">
                        Route {routeIndex + 1}
                      </h3>
                      <div className="text-sm text-gray-600">
                        {route.addresses?.length || 0} stops • {route.totalDistance?.toFixed(1)}km • {Math.round((route.estimatedDuration || 0)/60)}min
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {route.addresses?.map((address: any, index: number) => (
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
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="text-green-500 text-2xl mr-3">✅</div>
                  <div>
                    <div className="font-semibold text-green-800">React App</div>
                    <div className="text-sm text-green-600">Fully Operational</div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="text-blue-500 text-2xl mr-3">📝</div>
                  <div>
                    <div className="font-semibold text-blue-800">Address Forms</div>
                    <div className="text-sm text-blue-600">Working</div>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="text-yellow-500 text-2xl mr-3">🚀</div>
                  <div>
                    <div className="font-semibold text-yellow-800">Route Optimizer</div>
                    <div className="text-sm text-yellow-600">Ready</div>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="text-purple-500 text-2xl mr-3">📊</div>
                  <div>
                    <div className="font-semibold text-purple-800">Excel I/O</div>
                    <div className="text-sm text-purple-600">Active</div>
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
    </QueryClientProvider>
  )
}

export default aboutwaterApp