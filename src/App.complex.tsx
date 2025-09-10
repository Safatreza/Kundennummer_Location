import React, { useState, useEffect, useCallback } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'

import Header from './components/layout/Header'
import AddressForm from './components/forms/AddressForm'
import RouteMap from './components/map/RouteMap'
import { Button } from './components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'

import { addressManager } from './services/address-manager'
import { tourOptimizer } from './algorithms/tour-optimizer'
import { exportService } from './services/export-service'
import { ErrorHandler, withErrorHandling } from './utils/error-handler'
import { performanceMonitor, monitorMemoryUsage } from './utils/performance'
import type { 
  DeliveryAddress, 
  OptimizedTour, 
  Coordinates, 
  VehicleConstraints,
  OptimizationParameters,
  TourOptimizationRequest,
  ExportFormat,
  ExportOptions 
} from './types'

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    },
  },
})

// Default HQ location (Munich, Germany)
const DEFAULT_HQ: Coordinates = {
  lat: 48.1375,
  lng: 11.5755,
}

// Default vehicle constraints
const DEFAULT_CONSTRAINTS: VehicleConstraints = {
  maxBottles: 80,
  maxWeight: 1600, // kg (80 bottles * 20kg each)
  maxVolume: 2000, // liters
  maxStops: 50,
  maxDuration: 480, // 8 hours in minutes
  fuelEfficiency: 8, // L/100km
  restrictions: [],
}

function App() {
  // State management
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([])
  const [tours, setTours] = useState<OptimizedTour[]>([])
  const [selectedAddresses, setSelectedAddresses] = useState<string[]>([])
  const [selectedTour, setSelectedTour] = useState<string | null>(null)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Load initial data
  useEffect(() => {
    loadAddresses()
    
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'dark') {
      setIsDarkMode(true)
      document.documentElement.classList.add('dark')
    }

    // Initialize performance monitoring
    performanceMonitor.startTiming('app-initialization')
    
    // Start memory monitoring in development
    const memoryMonitorCleanup = monitorMemoryUsage()
    
    performanceMonitor.endTiming('app-initialization')

    return () => {
      if (memoryMonitorCleanup) {
        memoryMonitorCleanup()
      }
    }
  }, [])

  // Load addresses from storage
  const loadAddresses = useCallback(async () => {
    await withErrorHandling(
      async () => {
        const loadedAddresses = addressManager.getAllAddresses()
        setAddresses(loadedAddresses)
      },
      'loading_addresses',
      { showToast: true }
    )
  }, [])

  // Handle address addition
  const handleAddressAdded = useCallback((newAddress: DeliveryAddress) => {
    setAddresses(prev => [...prev, newAddress])
    toast.success(`Address added: ${newAddress.deliveryId}`)
  }, [])

  // Handle address click on map
  const handleAddressClick = useCallback((address: DeliveryAddress) => {
    setSelectedAddresses(prev => {
      const isSelected = prev.includes(address.id)
      return isSelected 
        ? prev.filter(id => id !== address.id)
        : [...prev, address.id]
    })
  }, [])

  // Handle tour click on map
  const handleTourClick = useCallback((tour: OptimizedTour) => {
    setSelectedTour(prev => prev === tour.id ? null : tour.id)
  }, [])

  // Optimize routes
  const handleOptimizeRoutes = useCallback(async () => {
    if (addresses.length === 0) {
      toast.error('Please add addresses before optimizing')
      return
    }

    setIsOptimizing(true)
    
    const result = await withErrorHandling(
      async () => {
        const request: TourOptimizationRequest = {
          addresses,
          depot: DEFAULT_HQ,
          vehicleConstraints: [DEFAULT_CONSTRAINTS],
          drivers: [], // Would be populated from driver management
          vehicles: [], // Would be populated from vehicle management
          parameters: {
            algorithm: 'GENETIC_ALGORITHM',
            objectives: ['MINIMIZE_DISTANCE', 'MINIMIZE_TIME'],
            constraints: {
              maxVehicles: 10,
              maxToursPerVehicle: 1,
              respectTimeWindows: true,
              respectPriorities: true,
              balanceWorkload: true,
              minimumStopsPerTour: 1,
              maximumStopsPerTour: 50,
              startLocation: DEFAULT_HQ,
              allowSplitDeliveries: false,
            },
            maxIterations: 500,
            timeLimit: 120, // 2 minutes
            populationSize: 100,
            mutationRate: 0.05,
            crossoverRate: 0.8,
            elitismRate: 0.1,
            convergenceThreshold: 0.01,
            parallelization: true,
          } as OptimizationParameters,
        }

        return await tourOptimizer.optimizeTours(request)
      },
      'route_optimization',
      { showToast: true, retry: true }
    )

    if (result) {
      setTours(result.tours)
      setSelectedTour(null)
      setSelectedAddresses([])
      
      toast.success(`Routes optimized! Created ${result.tours.length} tours`)
      
      // Show optimization statistics
      const totalDistance = result.tours.reduce((sum, tour) => sum + tour.estimatedDistance, 0)
      const totalTime = result.tours.reduce((sum, tour) => sum + tour.estimatedDuration, 0)
      
      setTimeout(() => {
        toast.success(
          `Total distance: ${totalDistance.toFixed(1)}km | Total time: ${(totalTime / 60).toFixed(1)}h`,
          { duration: 5000 }
        )
      }, 1000)
    }

    setIsOptimizing(false)
  }, [addresses])

  // Clear all addresses
  const handleClearAll = useCallback(() => {
    if (window.confirm('Are you sure you want to clear all addresses?')) {
      addressManager.clearAll()
      setAddresses([])
      setTours([])
      setSelectedAddresses([])
      setSelectedTour(null)
      toast.success('All addresses cleared')
    }
  }, [])

  // Theme toggle
  const handleThemeToggle = useCallback(() => {
    setIsDarkMode(prev => {
      const newDarkMode = !prev
      
      if (newDarkMode) {
        document.documentElement.classList.add('dark')
        localStorage.setItem('theme', 'dark')
      } else {
        document.documentElement.classList.remove('dark')
        localStorage.setItem('theme', 'light')
      }
      
      return newDarkMode
    })
  }, [])

  // Export tours to various formats
  const handleExportTours = useCallback(async (format: ExportFormat) => {
    if (tours.length === 0) {
      toast.error('No optimized tours to export')
      return
    }

    setIsExporting(true)
    
    try {
      const exportOptions: ExportOptions = {
        includeTourDetails: true,
        includeAddressDetails: true,
        includeMapLinks: format === 'google_maps' || format === 'apple_maps',
        includeStatistics: true,
        groupByTour: true,
        sortBy: 'tour_sequence',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '24h',
        metadata: {
          title: 'AboutWater Optimized Tours',
          description: 'Route optimization results for delivery tours',
          company: 'AboutWater GmbH',
          createdBy: 'AboutWater Route Optimizer',
          exportDate: new Date().toISOString(),
          version: '2.0.0',
          totalTours: tours.length,
          totalAddresses: tours.reduce((sum, tour) => sum + tour.addresses.length, 0),
          totalDistance: tours.reduce((sum, tour) => sum + tour.estimatedDistance, 0),
          totalDuration: tours.reduce((sum, tour) => sum + tour.estimatedDuration, 0),
        },
      }

      let successMessage = ''
      
      switch (format) {
        case 'google_maps':
          await exportService.exportToGoogleMaps(tours, exportOptions)
          successMessage = 'Opening Google Maps with optimized routes'
          break
        case 'apple_maps':
          await exportService.exportToAppleMaps(tours, exportOptions)
          successMessage = 'Opening Apple Maps with optimized routes'
          break
        case 'csv':
          await exportService.exportToCSV(tours, exportOptions)
          successMessage = 'CSV file downloaded successfully'
          break
        case 'excel':
          await exportService.exportToExcel(tours, exportOptions)
          successMessage = 'Excel file downloaded successfully'
          break
        case 'pdf':
          await exportService.exportToPDF(tours, exportOptions)
          successMessage = 'PDF report generated successfully'
          break
        case 'json':
          await exportService.exportToJSON(tours, exportOptions)
          successMessage = 'JSON data exported successfully'
          break
        default:
          throw new Error(`Unsupported export format: ${format}`)
      }
      
      toast.success(successMessage)
      
    } catch (error) {
      console.error('Export failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Export operation failed'
      toast.error(`Export failed: ${errorMessage}`)
    } finally {
      setIsExporting(false)
    }
  }, [tours])

  // Error handler
  const handleError = useCallback((error: string) => {
    toast.error(error)
  }, [])

  // Get statistics
  const stats = addressManager.getStatistics()

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen aboutwater-water-bg">
        {/* Header */}
        <Header
          onMenuToggle={() => setSidebarOpen(prev => !prev)}
          isDarkMode={isDarkMode}
          onThemeToggle={handleThemeToggle}
          notificationCount={0}
        />

        {/* Main Content */}
        <div className="flex h-[calc(100vh-80px)]">
          {/* Sidebar */}
          <div className={`
            transition-all duration-300 ease-in-out
            ${sidebarOpen ? 'w-96' : 'w-0'}
            overflow-hidden flex-shrink-0
          `}>
            <div className="h-full overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {/* Add Address Form */}
              <AddressForm 
                onAddressAdded={handleAddressAdded}
                onError={handleError}
              />

              {/* Statistics Card */}
              {addresses.length > 0 && (
                <Card className="glass-morphism">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Statistics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">
                          {stats.totalAddresses}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Total Addresses
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">
                          {stats.totalBottles}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Total Bottles
                        </div>
                      </div>
                    </div>
                    
                    {tours.length > 0 && (
                      <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {tours.length}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Optimized Tours
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {tours.reduce((sum, tour) => sum + tour.estimatedDistance, 0).toFixed(0)}km
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Total Distance
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button
                  onClick={handleOptimizeRoutes}
                  disabled={addresses.length === 0 || isOptimizing}
                  loading={isOptimizing}
                  className="w-full"
                  size="lg"
                  variant="aboutwater"
                >
                  {isOptimizing ? 'Optimizing Routes...' : 'Optimize Routes'}
                </Button>

                {tours.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground mb-2">
                      Export Tours
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={() => handleExportTours('google_maps')}
                        disabled={isExporting}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                      >
                        Google Maps
                      </Button>
                      <Button
                        onClick={() => handleExportTours('apple_maps')}
                        disabled={isExporting}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                      >
                        Apple Maps
                      </Button>
                      <Button
                        onClick={() => handleExportTours('excel')}
                        disabled={isExporting}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                      >
                        Excel
                      </Button>
                      <Button
                        onClick={() => handleExportTours('pdf')}
                        disabled={isExporting}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                      >
                        PDF Report
                      </Button>
                      <Button
                        onClick={() => handleExportTours('csv')}
                        disabled={isExporting}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                      >
                        CSV
                      </Button>
                      <Button
                        onClick={() => handleExportTours('json')}
                        disabled={isExporting}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                      >
                        JSON
                      </Button>
                    </div>
                  </div>
                )}

                {addresses.length > 0 && (
                  <Button
                    onClick={handleClearAll}
                    variant="outline"
                    className="w-full text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    Clear All Addresses
                  </Button>
                )}
              </div>

              {/* Tour List */}
              {tours.length > 0 && (
                <Card className="glass-morphism">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Optimized Tours</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {tours.map((tour, index) => (
                        <div
                          key={tour.id}
                          className={`
                            p-3 rounded-lg border-2 cursor-pointer transition-all
                            ${selectedTour === tour.id 
                              ? 'border-primary bg-primary/10' 
                              : 'border-border hover:border-primary/50 hover:bg-accent/50'
                            }
                          `}
                          onClick={() => handleTourClick(tour)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold">Tour {index + 1}</span>
                            <div className="flex items-center space-x-2">
                              <div 
                                className="w-3 h-3 rounded-full border-2 border-white"
                                style={{ backgroundColor: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b'][index % 8] }}
                              />
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div>Stops: {tour.addresses.length}</div>
                            <div>Bottles: {tour.totalBottles}</div>
                            <div>Distance: {tour.estimatedDistance.toFixed(1)}km</div>
                            <div>Time: {(tour.estimatedDuration / 60).toFixed(1)}h</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Map Section */}
          <div className="flex-1 p-4">
            <RouteMap
              addresses={addresses}
              tours={tours}
              hqLocation={DEFAULT_HQ}
              onAddressClick={handleAddressClick}
              onTourClick={handleTourClick}
              selectedAddresses={selectedAddresses}
              selectedTour={selectedTour}
              showRoutes={tours.length > 0}
              className="h-full"
            />
          </div>
        </div>

        {/* Toast Notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'hsl(var(--card))',
              color: 'hsl(var(--card-foreground))',
              border: '1px solid hsl(var(--border))',
            },
            success: {
              iconTheme: {
                primary: 'hsl(var(--primary))',
                secondary: 'white',
              },
            },
            error: {
              iconTheme: {
                primary: 'hsl(var(--destructive))',
                secondary: 'white',
              },
            },
          }}
        />
      </div>
    </QueryClientProvider>
  )
}

export default App