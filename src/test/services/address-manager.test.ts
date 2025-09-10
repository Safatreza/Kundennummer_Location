import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AddressManager } from '../../services/address-manager'
import { createMockAddress } from '../utils/test-utils'
import type { CreateAddressRequest, UpdateAddressRequest } from '../../services/address-manager'

// Mock geocoding service
const mockGeocodingService = {
  geocode: vi.fn().mockResolvedValue({
    coordinates: { lat: 48.1375, lng: 11.5755 },
    formattedAddress: '123 Test Street, Test City',
    accuracy: 'ROOFTOP',
    confidence: 0.95,
    provider: 'test',
  }),
  batchGeocode: vi.fn(),
  reverseGeocode: vi.fn(),
}

vi.mock('../../services/geocoding-service', () => ({
  geocodingService: mockGeocodingService,
}))

describe('AddressManager', () => {
  let addressManager: AddressManager

  beforeEach(() => {
    vi.clearAllMocks()
    addressManager = new AddressManager()
  })

  describe('addAddress', () => {
    it('adds a valid address successfully', async () => {
      const request: CreateAddressRequest = {
        address: '123 Test Street',
        deliveryId: 'DEL-001',
        bottleCount: 5,
        priority: 'MEDIUM',
        timeWindow: {
          start: '09:00',
          end: '17:00',
        },
        customerNotes: 'Test notes',
        accessInstructions: 'Ring doorbell',
        addressType: 'RESIDENTIAL',
        tags: ['test'],
      }

      const result = await addressManager.addAddress(request)

      expect(result).toBeDefined()
      expect(result.id).toBeDefined()
      expect(result.address).toBe('123 Test Street, Test City')
      expect(result.deliveryId).toBe('DEL-001')
      expect(result.bottleCount).toBe(5)
      expect(result.priority).toBe('MEDIUM')
      expect(result.timeWindow).toEqual(request.timeWindow)
      expect(result.isValidated).toBe(true)
      expect(result.validationTimestamp).toBeInstanceOf(Date)
    })

    it('throws error for invalid address', async () => {
      mockGeocodingService.geocode.mockResolvedValueOnce(null)

      const request: CreateAddressRequest = {
        address: 'Invalid Address',
        deliveryId: 'DEL-001',
        bottleCount: 5,
        priority: 'MEDIUM',
      }

      await expect(addressManager.addAddress(request)).rejects.toThrow('Unable to geocode address')
    })

    it('validates required fields', async () => {
      const invalidRequest = {
        address: '',
        deliveryId: '',
        bottleCount: 0,
        priority: 'MEDIUM' as const,
      }

      await expect(addressManager.addAddress(invalidRequest)).rejects.toThrow('validation failed')
    })

    it('generates auto delivery ID when not provided', async () => {
      const request: CreateAddressRequest = {
        address: '123 Test Street',
        bottleCount: 5,
        priority: 'MEDIUM',
      }

      const result = await addressManager.addAddress(request)

      expect(result.deliveryId).toBeDefined()
      expect(result.deliveryId).toMatch(/^DEL-\d+$/)
    })
  })

  describe('updateAddress', () => {
    it('updates existing address successfully', async () => {
      // First add an address
      const createRequest: CreateAddressRequest = {
        address: '123 Test Street',
        deliveryId: 'DEL-001',
        bottleCount: 5,
        priority: 'MEDIUM',
      }

      const createdAddress = await addressManager.addAddress(createRequest)

      // Now update it
      const updateRequest: UpdateAddressRequest = {
        id: createdAddress.id,
        bottleCount: 10,
        priority: 'HIGH',
        customerNotes: 'Updated notes',
      }

      const result = await addressManager.updateAddress(updateRequest)

      expect(result.id).toBe(createdAddress.id)
      expect(result.bottleCount).toBe(10)
      expect(result.priority).toBe('HIGH')
      expect(result.customerNotes).toBe('Updated notes')
      expect(result.address).toBe(createdAddress.address) // Address unchanged
    })

    it('throws error for non-existent address', async () => {
      const updateRequest: UpdateAddressRequest = {
        id: 'non-existent-id',
        bottleCount: 10,
      }

      await expect(addressManager.updateAddress(updateRequest)).rejects.toThrow('Address not found')
    })

    it('re-geocodes when address is updated', async () => {
      const createRequest: CreateAddressRequest = {
        address: '123 Test Street',
        deliveryId: 'DEL-001',
        bottleCount: 5,
        priority: 'MEDIUM',
      }

      const createdAddress = await addressManager.addAddress(createRequest)

      // Mock new geocoding result
      mockGeocodingService.geocode.mockResolvedValueOnce({
        coordinates: { lat: 48.2000, lng: 11.6000 },
        formattedAddress: '456 New Street, New City',
        accuracy: 'ROOFTOP',
        confidence: 0.95,
        provider: 'test',
      })

      const updateRequest: UpdateAddressRequest = {
        id: createdAddress.id,
        address: '456 New Street',
      }

      const result = await addressManager.updateAddress(updateRequest)

      expect(result.address).toBe('456 New Street, New City')
      expect(result.coordinates).toEqual({ lat: 48.2000, lng: 11.6000 })
    })
  })

  describe('deleteAddress', () => {
    it('deletes existing address successfully', async () => {
      const createRequest: CreateAddressRequest = {
        address: '123 Test Street',
        deliveryId: 'DEL-001',
        bottleCount: 5,
        priority: 'MEDIUM',
      }

      const createdAddress = await addressManager.addAddress(createRequest)
      const result = await addressManager.deleteAddress(createdAddress.id)

      expect(result).toBe(true)
      expect(addressManager.getAddressById(createdAddress.id)).toBeNull()
    })

    it('returns false for non-existent address', async () => {
      const result = await addressManager.deleteAddress('non-existent-id')
      expect(result).toBe(false)
    })
  })

  describe('getAllAddresses', () => {
    it('returns all addresses', async () => {
      const request1: CreateAddressRequest = {
        address: '123 Test Street',
        deliveryId: 'DEL-001',
        bottleCount: 5,
        priority: 'MEDIUM',
      }

      const request2: CreateAddressRequest = {
        address: '456 Another Street',
        deliveryId: 'DEL-002',
        bottleCount: 10,
        priority: 'HIGH',
      }

      await addressManager.addAddress(request1)
      await addressManager.addAddress(request2)

      const addresses = addressManager.getAllAddresses()

      expect(addresses).toHaveLength(2)
      expect(addresses[0]!.deliveryId).toBe('DEL-001')
      expect(addresses[1]!.deliveryId).toBe('DEL-002')
    })

    it('returns empty array when no addresses exist', () => {
      const addresses = addressManager.getAllAddresses()
      expect(addresses).toHaveLength(0)
    })
  })

  describe('searchAddresses', () => {
    beforeEach(async () => {
      // Add some test addresses
      const addresses = [
        {
          address: '123 Main Street',
          deliveryId: 'DEL-001',
          bottleCount: 5,
          priority: 'HIGH' as const,
          addressType: 'RESIDENTIAL' as const,
          tags: ['urgent'],
        },
        {
          address: '456 Commercial Ave',
          deliveryId: 'DEL-002',
          bottleCount: 20,
          priority: 'MEDIUM' as const,
          addressType: 'COMMERCIAL' as const,
          tags: ['bulk'],
        },
        {
          address: '789 Industrial Blvd',
          deliveryId: 'DEL-003',
          bottleCount: 50,
          priority: 'LOW' as const,
          addressType: 'INDUSTRIAL' as const,
          tags: ['weekly'],
        },
      ]

      for (const addr of addresses) {
        await addressManager.addAddress(addr)
      }
    })

    it('searches by query string', () => {
      const results = addressManager.searchAddresses({ query: 'Main' })
      expect(results).toHaveLength(1)
      expect(results[0]!.address).toContain('Main Street')
    })

    it('filters by priority', () => {
      const results = addressManager.searchAddresses({ priority: 'HIGH' })
      expect(results).toHaveLength(1)
      expect(results[0]!.priority).toBe('HIGH')
    })

    it('filters by address type', () => {
      const results = addressManager.searchAddresses({ addressType: 'COMMERCIAL' })
      expect(results).toHaveLength(1)
      expect(results[0]!.addressType).toBe('COMMERCIAL')
    })

    it('filters by bottle count range', () => {
      const results = addressManager.searchAddresses({ 
        minBottles: 10, 
        maxBottles: 30 
      })
      expect(results).toHaveLength(1)
      expect(results[0]!.bottleCount).toBe(20)
    })

    it('filters by tags', () => {
      const results = addressManager.searchAddresses({ tags: ['urgent'] })
      expect(results).toHaveLength(1)
      expect(results[0]!.tags).toContain('urgent')
    })

    it('combines multiple filters', () => {
      const results = addressManager.searchAddresses({ 
        priority: 'MEDIUM',
        addressType: 'COMMERCIAL',
        minBottles: 15
      })
      expect(results).toHaveLength(1)
      expect(results[0]!.deliveryId).toBe('DEL-002')
    })
  })

  describe('getStatistics', () => {
    beforeEach(async () => {
      const addresses = [
        {
          address: '123 Street',
          deliveryId: 'DEL-001',
          bottleCount: 5,
          priority: 'HIGH' as const,
          addressType: 'RESIDENTIAL' as const,
        },
        {
          address: '456 Street',
          deliveryId: 'DEL-002',
          bottleCount: 10,
          priority: 'MEDIUM' as const,
          addressType: 'COMMERCIAL' as const,
        },
        {
          address: '789 Street',
          deliveryId: 'DEL-003',
          bottleCount: 15,
          priority: 'LOW' as const,
          addressType: 'RESIDENTIAL' as const,
        },
      ]

      for (const addr of addresses) {
        await addressManager.addAddress(addr)
      }
    })

    it('calculates correct statistics', () => {
      const stats = addressManager.getStatistics()

      expect(stats.totalAddresses).toBe(3)
      expect(stats.totalBottles).toBe(30)
      expect(stats.averageBottlesPerAddress).toBe(10)
      expect(stats.priorityDistribution).toEqual({
        HIGH: 1,
        MEDIUM: 1,
        LOW: 1,
      })
      expect(stats.addressTypeDistribution).toEqual({
        RESIDENTIAL: 2,
        COMMERCIAL: 1,
        INDUSTRIAL: 0,
      })
    })
  })

  describe('clearAll', () => {
    it('removes all addresses', async () => {
      const request: CreateAddressRequest = {
        address: '123 Test Street',
        deliveryId: 'DEL-001',
        bottleCount: 5,
        priority: 'MEDIUM',
      }

      await addressManager.addAddress(request)
      expect(addressManager.getAllAddresses()).toHaveLength(1)

      addressManager.clearAll()
      expect(addressManager.getAllAddresses()).toHaveLength(0)
    })
  })
})