import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'

// Mock components for testing
const MockedQueryClient = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
    logger: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
  })
  
  return queryClient
}

// Test providers wrapper
interface AllTheProvidersProps {
  children: React.ReactNode
}

const AllTheProviders: React.FC<AllTheProvidersProps> = ({ children }) => {
  const queryClient = MockedQueryClient()
  
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  )
}

// Custom render function
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

// Test data factories
export const createMockAddress = (overrides = {}) => ({
  id: 'test-id-1',
  address: '123 Test Street, Test City',
  coordinates: { lat: 48.1375, lng: 11.5755 },
  deliveryId: 'DEL-001',
  bottleCount: 5,
  priority: 'MEDIUM' as const,
  timeWindow: {
    start: '09:00',
    end: '17:00',
  },
  customerNotes: 'Test notes',
  accessInstructions: 'Ring doorbell',
  contactInfo: {
    name: 'John Doe',
    phone: '+49 123 456789',
    email: 'john@example.com',
  },
  addressType: 'RESIDENTIAL' as const,
  isValidated: true,
  validationTimestamp: new Date(),
  geocodeAccuracy: 'ROOFTOP' as const,
  estimatedDuration: 15,
  deliveryHistory: [],
  tags: ['test'],
  metadata: {
    geocodingProvider: 'test',
    geocodingConfidence: 0.95,
    createdAt: new Date().toISOString(),
    createdBy: 'test',
  },
  ...overrides,
})

export const createMockTour = (overrides = {}) => ({
  id: 'tour-1',
  vehicleId: 'vehicle-1',
  driverId: 'driver-1',
  addresses: [createMockAddress()],
  routeSequence: [0],
  estimatedDistance: 10.5,
  estimatedDuration: 45,
  estimatedFuelCost: 8.5,
  totalBottles: 5,
  startTime: new Date(),
  endTime: new Date(),
  optimizationScore: 0.85,
  constraints: {
    maxBottles: 80,
    maxWeight: 1600,
    maxVolume: 2000,
    maxStops: 50,
    maxDuration: 480,
    fuelEfficiency: 8,
    restrictions: [],
  },
  route: {
    coordinates: [
      { lat: 48.1375, lng: 11.5755 },
      { lat: 48.1385, lng: 11.5765 },
    ],
    instructions: ['Start at depot', 'Turn right'],
    segments: [],
  },
  statistics: {
    totalDistance: 10.5,
    totalDuration: 45,
    averageStopDuration: 15,
    fuelConsumption: 0.84,
    co2Emissions: 2.1,
    estimatedCost: 25.5,
  },
  metadata: {
    algorithm: 'GENETIC_ALGORITHM',
    optimizationTime: 1.2,
    iterations: 150,
    createdAt: new Date().toISOString(),
    version: '1.0.0',
  },
  ...overrides,
})

export const createMockOptimizationResult = (overrides = {}) => ({
  tours: [createMockTour()],
  unassignedAddresses: [],
  statistics: {
    totalTours: 1,
    totalDistance: 10.5,
    totalDuration: 45,
    averageToursPerVehicle: 1,
    utilizationRate: 0.85,
    optimizationScore: 0.85,
    algorithmUsed: 'GENETIC_ALGORITHM' as const,
    optimizationTime: 1.2,
    iterations: 150,
  },
  metadata: {
    requestId: 'req-123',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    parameters: {
      algorithm: 'GENETIC_ALGORITHM' as const,
      objectives: ['MINIMIZE_DISTANCE' as const, 'MINIMIZE_TIME' as const],
      constraints: {
        maxVehicles: 10,
        maxToursPerVehicle: 1,
        respectTimeWindows: true,
        respectPriorities: true,
        balanceWorkload: true,
        minimumStopsPerTour: 1,
        maximumStopsPerTour: 50,
        startLocation: { lat: 48.1375, lng: 11.5755 },
        allowSplitDeliveries: false,
      },
      maxIterations: 500,
      timeLimit: 120,
      populationSize: 100,
      mutationRate: 0.05,
      crossoverRate: 0.8,
      elitismRate: 0.1,
      convergenceThreshold: 0.01,
      parallelization: true,
    },
  },
  ...overrides,
})

// Mock implementations for services
export const createMockGeocodingService = () => ({
  geocode: vi.fn().mockResolvedValue({
    coordinates: { lat: 48.1375, lng: 11.5755 },
    formattedAddress: '123 Test Street, Test City',
    accuracy: 'ROOFTOP',
    confidence: 0.95,
    provider: 'test',
  }),
  batchGeocode: vi.fn().mockResolvedValue([]),
  reverseGeocode: vi.fn().mockResolvedValue({
    address: '123 Test Street, Test City',
    coordinates: { lat: 48.1375, lng: 11.5755 },
  }),
})

export const createMockAddressManager = () => ({
  addAddress: vi.fn().mockResolvedValue(createMockAddress()),
  updateAddress: vi.fn().mockResolvedValue(createMockAddress()),
  deleteAddress: vi.fn().mockResolvedValue(true),
  getAllAddresses: vi.fn().mockReturnValue([createMockAddress()]),
  getAddressById: vi.fn().mockReturnValue(createMockAddress()),
  searchAddresses: vi.fn().mockReturnValue([createMockAddress()]),
  importFromCSV: vi.fn().mockResolvedValue({
    imported: 1,
    skipped: 0,
    errors: 0,
    warnings: [],
  }),
  exportToCSV: vi.fn().mockResolvedValue('csv,data'),
  clearAll: vi.fn(),
  getStatistics: vi.fn().mockReturnValue({
    totalAddresses: 1,
    totalBottles: 5,
    averageBottlesPerAddress: 5,
    priorityDistribution: { HIGH: 0, MEDIUM: 1, LOW: 0 },
    addressTypeDistribution: { RESIDENTIAL: 1, COMMERCIAL: 0, INDUSTRIAL: 0 },
  }),
})

export const createMockTourOptimizer = () => ({
  optimizeTours: vi.fn().mockResolvedValue(createMockOptimizationResult()),
  validateTour: vi.fn().mockReturnValue({ isValid: true, errors: [] }),
  calculateTourStatistics: vi.fn().mockReturnValue({
    totalDistance: 10.5,
    totalDuration: 45,
    averageStopDuration: 15,
    fuelConsumption: 0.84,
    co2Emissions: 2.1,
    estimatedCost: 25.5,
  }),
})

// Utility functions for testing
export const waitForLoadingToFinish = () =>
  screen.findByText(/loading/i, undefined, { timeout: 3000 })

export const mockLocalStorage = () => {
  const storage: Record<string, string> = {}
  
  return {
    getItem: vi.fn((key: string) => storage[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      storage[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete storage[key]
    }),
    clear: vi.fn(() => {
      Object.keys(storage).forEach(key => delete storage[key])
    }),
  }
}

// Re-export everything from testing-library
export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'

// Override render method
export { customRender as render }