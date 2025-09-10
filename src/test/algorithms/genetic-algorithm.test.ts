import { describe, it, expect, beforeEach } from 'vitest'
import { GeneticAlgorithm } from '../../algorithms/core/genetic-algorithm'
import { createMockAddress } from '../utils/test-utils'
import type { VehicleConstraints, Coordinates } from '../../types'

describe('GeneticAlgorithm', () => {
  let algorithm: GeneticAlgorithm
  let addresses: any[]
  let depot: Coordinates
  let constraints: VehicleConstraints

  beforeEach(() => {
    algorithm = new GeneticAlgorithm()
    
    addresses = [
      createMockAddress({ 
        id: '1', 
        coordinates: { lat: 48.1375, lng: 11.5755 },
        bottleCount: 10 
      }),
      createMockAddress({ 
        id: '2', 
        coordinates: { lat: 48.1385, lng: 11.5765 },
        bottleCount: 15 
      }),
      createMockAddress({ 
        id: '3', 
        coordinates: { lat: 48.1395, lng: 11.5775 },
        bottleCount: 8 
      }),
      createMockAddress({ 
        id: '4', 
        coordinates: { lat: 48.1405, lng: 11.5785 },
        bottleCount: 12 
      }),
      createMockAddress({ 
        id: '5', 
        coordinates: { lat: 48.1415, lng: 11.5795 },
        bottleCount: 20 
      }),
    ]

    depot = { lat: 48.1375, lng: 11.5755 }
    
    constraints = {
      maxBottles: 80,
      maxWeight: 1600,
      maxVolume: 2000,
      maxStops: 50,
      maxDuration: 480,
      fuelEfficiency: 8,
      restrictions: [],
    }
  })

  it('creates a genetic algorithm instance', () => {
    expect(algorithm).toBeInstanceOf(GeneticAlgorithm)
  })

  it('optimizes routes for small address set', async () => {
    const result = await algorithm.optimize(addresses, depot, constraints)

    expect(result).toBeDefined()
    expect(result.tours).toBeDefined()
    expect(result.tours.length).toBeGreaterThan(0)
    expect(result.statistics).toBeDefined()
    expect(result.metadata).toBeDefined()
  })

  it('respects bottle count constraints', async () => {
    const result = await algorithm.optimize(addresses, depot, constraints)

    for (const tour of result.tours) {
      expect(tour.totalBottles).toBeLessThanOrEqual(constraints.maxBottles)
    }
  })

  it('includes all addresses in the solution', async () => {
    const result = await algorithm.optimize(addresses, depot, constraints)

    const assignedAddressIds = new Set()
    for (const tour of result.tours) {
      for (const address of tour.addresses) {
        assignedAddressIds.add(address.id)
      }
    }

    for (const address of addresses) {
      expect(assignedAddressIds.has(address.id)).toBe(true)
    }
  })

  it('handles single address optimization', async () => {
    const singleAddress = [addresses[0]!]
    const result = await algorithm.optimize(singleAddress, depot, constraints)

    expect(result.tours).toHaveLength(1)
    expect(result.tours[0]!.addresses).toHaveLength(1)
    expect(result.tours[0]!.addresses[0]!.id).toBe(singleAddress[0]!.id)
  })

  it('handles empty address list', async () => {
    const result = await algorithm.optimize([], depot, constraints)

    expect(result.tours).toHaveLength(0)
    expect(result.statistics.totalTours).toBe(0)
    expect(result.statistics.totalDistance).toBe(0)
  })

  it('generates valid tour statistics', async () => {
    const result = await algorithm.optimize(addresses, depot, constraints)

    expect(result.statistics.totalTours).toBe(result.tours.length)
    expect(result.statistics.totalDistance).toBeGreaterThan(0)
    expect(result.statistics.totalDuration).toBeGreaterThan(0)
    expect(result.statistics.optimizationScore).toBeGreaterThan(0)
    expect(result.statistics.optimizationScore).toBeLessThanOrEqual(1)
  })

  it('generates proper metadata', async () => {
    const result = await algorithm.optimize(addresses, depot, constraints)

    expect(result.metadata.algorithm).toBe('GENETIC_ALGORITHM')
    expect(result.metadata.optimizationTime).toBeGreaterThan(0)
    expect(result.metadata.iterations).toBeGreaterThan(0)
    expect(result.metadata.timestamp).toBeDefined()
    expect(result.metadata.version).toBeDefined()
  })

  it('handles tight bottle constraints by creating multiple tours', async () => {
    // Set very low bottle constraint
    const tightConstraints = { ...constraints, maxBottles: 20 }
    const result = await algorithm.optimize(addresses, depot, tightConstraints)

    // Should create multiple tours due to bottle constraint
    expect(result.tours.length).toBeGreaterThan(1)
    
    // Each tour should respect the constraint
    for (const tour of result.tours) {
      expect(tour.totalBottles).toBeLessThanOrEqual(tightConstraints.maxBottles)
    }
  })

  it('optimizes for distance minimization', async () => {
    const result = await algorithm.optimize(addresses, depot, constraints)

    // All tours should have reasonable distances (not astronomical)
    for (const tour of result.tours) {
      expect(tour.estimatedDistance).toBeGreaterThan(0)
      expect(tour.estimatedDistance).toBeLessThan(1000) // Reasonable upper bound
    }

    // Total distance should be the sum of individual tour distances
    const calculatedTotal = result.tours.reduce((sum, tour) => sum + tour.estimatedDistance, 0)
    expect(Math.abs(result.statistics.totalDistance - calculatedTotal)).toBeLessThan(0.1)
  })

  it('creates tours with proper route sequences', async () => {
    const result = await algorithm.optimize(addresses, depot, constraints)

    for (const tour of result.tours) {
      expect(tour.routeSequence).toHaveLength(tour.addresses.length)
      
      // Route sequence should contain valid indices
      for (const index of tour.routeSequence) {
        expect(index).toBeGreaterThanOrEqual(0)
        expect(index).toBeLessThan(tour.addresses.length)
      }

      // Should not have duplicate indices in route sequence
      const uniqueIndices = new Set(tour.routeSequence)
      expect(uniqueIndices.size).toBe(tour.routeSequence.length)
    }
  })

  it('calculates tour durations based on distance and stops', async () => {
    const result = await algorithm.optimize(addresses, depot, constraints)

    for (const tour of result.tours) {
      expect(tour.estimatedDuration).toBeGreaterThan(0)
      
      // Duration should account for travel time + stop time
      // At minimum, should include stop time for each address
      const minDurationFromStops = tour.addresses.length * 10 // Assume 10 min per stop
      expect(tour.estimatedDuration).toBeGreaterThan(minDurationFromStops)
    }
  })

  it('handles addresses with different priorities', async () => {
    const priorityAddresses = addresses.map((addr, index) => ({
      ...addr,
      priority: index < 2 ? 'HIGH' as const : 'LOW' as const
    }))

    const result = await algorithm.optimize(priorityAddresses, depot, constraints)

    expect(result.tours.length).toBeGreaterThan(0)
    // High priority addresses should be handled appropriately
    // (specific priority handling logic would depend on implementation)
  })

  it('respects maximum stops per tour constraint', async () => {
    const limitedStopsConstraints = { ...constraints, maxStops: 2 }
    const result = await algorithm.optimize(addresses, depot, limitedStopsConstraints)

    for (const tour of result.tours) {
      expect(tour.addresses.length).toBeLessThanOrEqual(limitedStopsConstraints.maxStops)
    }
  })
})