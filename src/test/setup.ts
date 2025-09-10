import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'
import 'whatwg-fetch'

// Extend Vitest's expect with testing-library matchers
expect.extend(matchers)

// Clean up DOM after each test
afterEach(() => {
  cleanup()
})

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock Leaflet for map testing
vi.mock('leaflet', () => ({
  map: vi.fn(() => ({
    setView: vi.fn(),
    remove: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    invalidateSize: vi.fn(),
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
    eachLayer: vi.fn(),
    hasLayer: vi.fn(),
  })),
  tileLayer: vi.fn(() => ({
    addTo: vi.fn(),
  })),
  marker: vi.fn(() => ({
    addTo: vi.fn(),
    bindPopup: vi.fn(),
    setLatLng: vi.fn(),
    remove: vi.fn(),
  })),
  icon: vi.fn(),
  divIcon: vi.fn(),
  latLng: vi.fn((lat, lng) => ({ lat, lng })),
  latLngBounds: vi.fn(),
  control: {
    layers: vi.fn(),
    zoom: vi.fn(),
    attribution: vi.fn(),
  },
}))

// Mock react-leaflet
vi.mock('react-leaflet', () => ({
  MapContainer: vi.fn(({ children, ...props }) => 
    vi.fn().mockImplementation(() => children)()
  ),
  TileLayer: vi.fn(() => null),
  Marker: vi.fn(() => null),
  Popup: vi.fn(() => null),
  Polyline: vi.fn(() => null),
  useMap: vi.fn(() => ({
    setView: vi.fn(),
    invalidateSize: vi.fn(),
  })),
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = String(value)
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    get length() {
      return Object.keys(store).length
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Mock sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: localStorageMock,
})

// Mock console methods for cleaner test output
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

beforeEach(() => {
  console.error = vi.fn()
  console.warn = vi.fn()
})

afterEach(() => {
  console.error = originalConsoleError
  console.warn = originalConsoleWarn
})

// Mock fetch for API calls
global.fetch = vi.fn()

// Mock window.URL.createObjectURL
Object.defineProperty(window.URL, 'createObjectURL', {
  value: vi.fn(() => 'mocked-url'),
})

Object.defineProperty(window.URL, 'revokeObjectURL', {
  value: vi.fn(),
})

// Mock navigator for geolocation and clipboard
Object.defineProperty(navigator, 'geolocation', {
  value: {
    getCurrentPosition: vi.fn(),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  },
})

Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn(() => Promise.resolve()),
    readText: vi.fn(() => Promise.resolve('')),
  },
})

// Mock HTMLCanvasElement methods for PDF generation testing
HTMLCanvasElement.prototype.getContext = vi.fn()
HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,mock')

// Set up console.log suppression for noisy libraries
const originalConsoleLog = console.log
beforeEach(() => {
  console.log = vi.fn()
})

afterEach(() => {
  console.log = originalConsoleLog
})