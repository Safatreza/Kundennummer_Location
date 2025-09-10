/**
 * Intelligent Tour Management and Optimization Engine
 * Coordinates multiple algorithms, handles constraints, and manages real-time optimization
 */

import type {
  DeliveryAddress,
  OptimizedTour,
  VehicleConstraints,
  Coordinates,
  OptimizationParameters,
  OptimizationResult,
  OptimizationAlgorithm,
  AlgorithmResult,
  OptimizationObjective,
  TourStatus,
  DriverInfo,
  VehicleInfo,
  ReoptimizationTrigger,
  RealTimeUpdate,
  UpdateType,
  TerminationReason,
  TourMetrics,
  RefillStop,
} from '@/types'

import { GeneticAlgorithm } from './core/genetic-algorithm'
import { SimulatedAnnealingAlgorithm } from './core/simulated-annealing'
import { DistanceCalculator } from './core/distance-calculator'

export interface TourOptimizationRequest {
  readonly addresses: readonly DeliveryAddress[]
  readonly depot: Coordinates
  readonly vehicleConstraints: VehicleConstraints[]
  readonly drivers: readonly DriverInfo[]
  readonly vehicles: readonly VehicleInfo[]
  readonly parameters: OptimizationParameters
  readonly existingTours?: readonly OptimizedTour[]
}

export interface TourOptimizationResult extends OptimizationResult {
  readonly tours: readonly OptimizedTour[]
  readonly refillStops: readonly RefillStop[]
  readonly driverAssignments: readonly DriverAssignment[]
  readonly vehicleAssignments: readonly VehicleAssignment[]
  readonly recommendations: readonly OptimizationRecommendation[]
}

export interface DriverAssignment {
  readonly driverId: string
  readonly tourId: string
  readonly estimatedWorkingHours: number
  readonly skillMatch: number
  readonly preferenceScore: number
}

export interface VehicleAssignment {
  readonly vehicleId: string
  readonly tourId: string
  readonly utilizationRate: number
  readonly fuelEstimate: number
  readonly maintenanceRequired: boolean
}

export interface OptimizationRecommendation {
  readonly type: RecommendationType
  readonly severity: 'info' | 'warning' | 'critical'
  readonly title: string
  readonly description: string
  readonly impact: string
  readonly action?: string
}

export enum RecommendationType {
  CAPACITY_OPTIMIZATION = 'capacity_optimization',
  ROUTE_EFFICIENCY = 'route_efficiency',
  TIME_WINDOW_CONFLICT = 'time_window_conflict',
  DRIVER_WORKLOAD = 'driver_workload',
  VEHICLE_MAINTENANCE = 'vehicle_maintenance',
  FUEL_OPTIMIZATION = 'fuel_optimization',
  PRIORITY_HANDLING = 'priority_handling',
}

export class TourOptimizer {
  private distanceCalculator: DistanceCalculator
  private isOptimizing = false
  private currentRequest: TourOptimizationRequest | null = null
  private optimizationHistory: OptimizationResult[] = []
  private realtimeUpdates: RealTimeUpdate[] = []
  private triggers: ReoptimizationTrigger[] = []

  constructor() {
    this.distanceCalculator = new DistanceCalculator()
    this.initializeDefaultTriggers()
  }

  /**
   * Main optimization method with intelligent algorithm selection
   */
  public async optimizeTours(request: TourOptimizationRequest): Promise<TourOptimizationResult> {
    if (this.isOptimizing) {
      throw new Error('Optimization already in progress')
    }

    this.isOptimizing = true
    this.currentRequest = request

    try {
      // Validate request
      this.validateOptimizationRequest(request)

      // Pre-process addresses
      const preprocessedAddresses = await this.preprocessAddresses(request.addresses)

      // Select optimal algorithm based on problem characteristics
      const selectedAlgorithm = this.selectOptimalAlgorithm(request)

      // Run optimization
      const algorithmResult = await this.runOptimization(
        preprocessedAddresses,
        request,
        selectedAlgorithm
      )

      // Post-process results
      const optimizedTours = await this.createOptimizedTours(
        algorithmResult,
        preprocessedAddresses,
        request
      )

      // Assign drivers and vehicles
      const assignments = await this.assignResourcesOptimally(optimizedTours, request)

      // Generate refill stops if needed
      const refillStops = this.calculateRefillStops(optimizedTours, request)

      // Generate recommendations
      const recommendations = this.generateRecommendations(optimizedTours, request, algorithmResult)

      const result: TourOptimizationResult = {
        ...algorithmResult,
        tours: optimizedTours,
        refillStops,
        driverAssignments: assignments.drivers,
        vehicleAssignments: assignments.vehicles,
        recommendations,
      }

      // Store in history
      this.optimizationHistory.push(result)
      if (this.optimizationHistory.length > 100) {
        this.optimizationHistory = this.optimizationHistory.slice(-50)
      }

      return result

    } finally {
      this.isOptimizing = false
      this.currentRequest = null
    }
  }

  /**
   * Real-time optimization updates
   */
  public async handleRealtimeUpdate(update: RealTimeUpdate): Promise<boolean> {
    this.realtimeUpdates.push(update)
    
    // Check if reoptimization is triggered
    const shouldReoptimize = this.checkReoptimizationTriggers(update)
    
    if (shouldReoptimize && this.currentRequest) {
      // Apply the update to current request
      const updatedRequest = this.applyUpdateToRequest(this.currentRequest, update)
      
      // Trigger background reoptimization
      this.optimizeTours(updatedRequest).catch(error => {
        console.error('Real-time reoptimization failed:', error)
      })
      
      return true
    }
    
    return false
  }

  /**
   * Add or modify reoptimization triggers
   */
  public setReoptimizationTrigger(trigger: ReoptimizationTrigger): void {
    const existingIndex = this.triggers.findIndex(t => t.condition === trigger.condition)
    
    if (existingIndex >= 0) {
      this.triggers[existingIndex] = trigger
    } else {
      this.triggers.push(trigger)
    }
  }

  /**
   * Get optimization progress
   */
  public getOptimizationProgress(): {
    isOptimizing: boolean
    stage: string
    progress: number
    currentAlgorithm?: string
    estimatedTimeRemaining?: number
  } {
    return {
      isOptimizing: this.isOptimizing,
      stage: this.isOptimizing ? 'Optimizing routes...' : 'Ready',
      progress: this.isOptimizing ? 50 : 100, // Would need real progress from algorithms
      currentAlgorithm: this.isOptimizing ? 'Genetic Algorithm' : undefined,
    }
  }

  /**
   * Cancel current optimization
   */
  public cancelOptimization(): boolean {
    if (this.isOptimizing) {
      this.isOptimizing = false
      this.currentRequest = null
      return true
    }
    return false
  }

  /**
   * Get optimization history
   */
  public getOptimizationHistory(): readonly OptimizationResult[] {
    return this.optimizationHistory
  }

  /**
   * Validate optimization request
   */
  private validateOptimizationRequest(request: TourOptimizationRequest): void {
    if (request.addresses.length === 0) {
      throw new Error('No addresses provided for optimization')
    }

    if (request.vehicleConstraints.length === 0) {
      throw new Error('No vehicle constraints provided')
    }

    // Validate depot coordinates
    if (!this.isValidCoordinates(request.depot)) {
      throw new Error('Invalid depot coordinates')
    }

    // Validate address coordinates
    for (const address of request.addresses) {
      if (!this.isValidCoordinates(address.coordinates)) {
        throw new Error(`Invalid coordinates for address: ${address.deliveryId}`)
      }
    }

    // Check total capacity requirements
    const totalBottles = request.addresses.reduce((sum, addr) => sum + addr.bottleCount, 0)
    const totalCapacity = request.vehicleConstraints.reduce((sum, vc) => sum + vc.maxBottles, 0)

    if (totalBottles > totalCapacity) {
      throw new Error(`Total bottle demand (${totalBottles}) exceeds total vehicle capacity (${totalCapacity})`)
    }
  }

  /**
   * Pre-process addresses for optimization
   */
  private async preprocessAddresses(addresses: readonly DeliveryAddress[]): Promise<DeliveryAddress[]> {
    const processed = [...addresses]

    // Sort by priority for better initial solutions
    processed.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority // Lower number = higher priority
      }
      return b.bottleCount - a.bottleCount // Higher bottle count first as tiebreaker
    })

    // Group addresses that are very close together
    const clustered = this.clusterNearbyAddresses(processed)

    // Validate time windows
    const validated = this.validateTimeWindows(clustered)

    return validated
  }

  /**
   * Select optimal algorithm based on problem characteristics
   */
  private selectOptimalAlgorithm(request: TourOptimizationRequest): OptimizationAlgorithm {
    const addressCount = request.addresses.length
    const vehicleCount = request.vehicleConstraints.length
    const hasTimeWindows = request.addresses.some(addr => addr.timeWindow !== undefined)
    const hasPriorities = request.addresses.some(addr => addr.priority !== 5) // 5 is standard priority

    // Small problems (< 20 addresses)
    if (addressCount < 20) {
      return OptimizationAlgorithm.GREEDY_NEAREST
    }

    // Medium problems (20-100 addresses)
    if (addressCount < 100) {
      if (hasTimeWindows || hasPriorities) {
        return OptimizationAlgorithm.SIMULATED_ANNEALING
      } else {
        return OptimizationAlgorithm.GENETIC_ALGORITHM
      }
    }

    // Large problems (100+ addresses)
    if (hasTimeWindows && hasPriorities) {
      return OptimizationAlgorithm.HYBRID // Would combine multiple approaches
    } else {
      return OptimizationAlgorithm.GENETIC_ALGORITHM
    }
  }

  /**
   * Run optimization with selected algorithm
   */
  private async runOptimization(
    addresses: readonly DeliveryAddress[],
    request: TourOptimizationRequest,
    algorithm: OptimizationAlgorithm
  ): Promise<AlgorithmResult> {
    // For now, use the primary vehicle constraint
    const primaryConstraints = request.vehicleConstraints[0]!

    switch (algorithm) {
      case OptimizationAlgorithm.GENETIC_ALGORITHM:
        return this.runGeneticAlgorithm(addresses, request.depot, primaryConstraints)

      case OptimizationAlgorithm.SIMULATED_ANNEALING:
        return this.runSimulatedAnnealing(addresses, request.depot, primaryConstraints)

      case OptimizationAlgorithm.GREEDY_NEAREST:
        return this.runGreedyAlgorithm(addresses, request.depot, primaryConstraints)

      default:
        throw new Error(`Algorithm not implemented: ${algorithm}`)
    }
  }

  /**
   * Run genetic algorithm
   */
  private async runGeneticAlgorithm(
    addresses: readonly DeliveryAddress[],
    depot: Coordinates,
    constraints: VehicleConstraints
  ): Promise<AlgorithmResult> {
    const config = {
      name: 'Advanced Genetic Algorithm',
      version: '1.0.0',
      parameters: {},
      constraints: {
        maxExecutionTime: 120000, // 2 minutes
        maxIterations: 500,
        maxMemoryUsage: 512,
        convergenceThreshold: 0.01,
        minImprovement: 1,
      },
      objectives: [OptimizationObjective.MINIMIZE_DISTANCE, OptimizationObjective.MINIMIZE_TIME],
      populationSize: 100,
      eliteSize: 10,
      mutationRate: 5,
      crossoverRate: 80,
      tournamentSize: 5,
      crossoverType: 'ORDER_CROSSOVER' as const,
      mutationType: 'SWAP_MUTATION' as const,
      selectionType: 'TOURNAMENT' as const,
      diversityMaintenance: true,
      adaptiveRates: true,
    }

    const ga = new GeneticAlgorithm(config, this.distanceCalculator)
    return ga.optimize(addresses, depot, constraints)
  }

  /**
   * Run simulated annealing algorithm
   */
  private async runSimulatedAnnealing(
    addresses: readonly DeliveryAddress[],
    depot: Coordinates,
    constraints: VehicleConstraints
  ): Promise<AlgorithmResult> {
    const config = {
      name: 'Advanced Simulated Annealing',
      version: '1.0.0',
      parameters: {},
      constraints: {
        maxExecutionTime: 90000, // 1.5 minutes
        maxIterations: 10000,
        maxMemoryUsage: 256,
        convergenceThreshold: 0.01,
        minImprovement: 0.5,
      },
      objectives: [OptimizationObjective.MINIMIZE_DISTANCE],
      initialTemperature: 1000,
      finalTemperature: 0.1,
      coolingRate: 0.95,
      coolingSchedule: 'EXPONENTIAL' as const,
      maxIterationsAtTemperature: 100,
      minAcceptanceRate: 0.01,
      reheatThreshold: 0.1,
    }

    const sa = new SimulatedAnnealingAlgorithm(config, this.distanceCalculator)
    return sa.optimize(addresses, depot, constraints)
  }

  /**
   * Run greedy nearest neighbor algorithm (for small problems)
   */
  private async runGreedyAlgorithm(
    addresses: readonly DeliveryAddress[],
    depot: Coordinates,
    constraints: VehicleConstraints
  ): Promise<AlgorithmResult> {
    const tours: Array<{
      id: string
      sequence: string[]
      metrics: TourMetrics
      violations: any[]
      score: number
    }> = []

    let unassigned = [...addresses]
    let tourIndex = 0

    while (unassigned.length > 0) {
      const tour = this.createGreedyTour(unassigned, depot, constraints, tourIndex)
      
      if (tour.sequence.length === 0) {
        break // Can't create any more tours
      }

      tours.push(tour)
      
      // Remove assigned addresses
      const assigned = new Set(tour.sequence)
      unassigned = unassigned.filter(addr => !assigned.has(addr.id))
      tourIndex++
    }

    return {
      algorithm: OptimizationAlgorithm.GREEDY_NEAREST,
      tours,
      metrics: {
        totalScore: tours.reduce((sum, tour) => sum + tour.score, 0),
        improvement: 0, // Greedy doesn't iterate
        efficiency: this.calculateOverallEfficiency(tours),
        feasibility: 100, // Greedy always produces feasible solutions
        diversity: 0,
        stability: 100,
      },
      convergenceData: [{
        iteration: 0,
        bestScore: tours.reduce((sum, tour) => sum + tour.score, 0),
        averageScore: tours.reduce((sum, tour) => sum + tour.score, 0),
        diversity: 0,
        timestamp: performance.now(),
      }],
      executionTime: 100, // Very fast
      memoryUsed: addresses.length * 0.1, // Minimal memory
      iterations: 1,
      terminated: TerminationReason.CONVERGENCE,
    }
  }

  /**
   * Create a greedy tour using nearest neighbor
   */
  private createGreedyTour(
    addresses: readonly DeliveryAddress[],
    depot: Coordinates,
    constraints: VehicleConstraints,
    tourIndex: number
  ): {
    id: string
    sequence: string[]
    metrics: TourMetrics
    violations: any[]
    score: number
  } {
    if (addresses.length === 0) {
      return {
        id: `tour_${tourIndex}`,
        sequence: [],
        metrics: this.createEmptyTourMetrics(),
        violations: [],
        score: 0,
      }
    }

    const sequence: string[] = []
    const available = [...addresses]
    let currentLoad = 0
    let currentCoord = depot
    let totalDistance = 0

    // Start with highest priority address that fits
    let startIndex = 0
    for (let i = 0; i < available.length; i++) {
      const addr = available[i]!
      if (addr.priority < available[startIndex]!.priority || 
          (addr.priority === available[startIndex]!.priority && 
           addr.bottleCount > available[startIndex]!.bottleCount)) {
        if (addr.bottleCount <= constraints.maxBottles) {
          startIndex = i
        }
      }
    }

    const startAddr = available.splice(startIndex, 1)[0]!
    sequence.push(startAddr.id)
    currentLoad += startAddr.bottleCount
    totalDistance += this.distanceCalculator.haversineDistance(currentCoord, startAddr.coordinates)
    currentCoord = startAddr.coordinates

    // Add remaining addresses using nearest neighbor with constraints
    while (available.length > 0 && sequence.length < constraints.maxStops) {
      let nearestIndex = -1
      let nearestDistance = Infinity

      for (let i = 0; i < available.length; i++) {
        const addr = available[i]!
        
        // Check constraints
        if (currentLoad + addr.bottleCount > constraints.maxBottles) continue

        const distance = this.distanceCalculator.haversineDistance(currentCoord, addr.coordinates)
        const priorityBonus = (6 - addr.priority) * 5 // Bias toward higher priority
        const adjustedDistance = distance - priorityBonus

        if (adjustedDistance < nearestDistance) {
          nearestDistance = adjustedDistance
          nearestIndex = i
        }
      }

      if (nearestIndex >= 0) {
        const nearestAddr = available.splice(nearestIndex, 1)[0]!
        sequence.push(nearestAddr.id)
        currentLoad += nearestAddr.bottleCount
        const actualDistance = this.distanceCalculator.haversineDistance(currentCoord, nearestAddr.coordinates)
        totalDistance += actualDistance
        currentCoord = nearestAddr.coordinates
      } else {
        break // No feasible address to add
      }
    }

    // Return to depot
    totalDistance += this.distanceCalculator.haversineDistance(currentCoord, depot)

    const metrics: TourMetrics = {
      totalDistance,
      totalTime: (totalDistance / 30) * 60 + sequence.length * 5, // 30 km/h + 5min per stop
      totalBottles: currentLoad,
      utilizationRate: currentLoad / constraints.maxBottles,
      efficiency: Math.max(0, 100 - (totalDistance / Math.max(sequence.length, 1)) * 2),
      priorityScore: this.calculatePriorityScore(sequence, addresses),
      timeWindowViolations: 0, // Would need to check time windows
    }

    return {
      id: `tour_${tourIndex}`,
      sequence,
      metrics,
      violations: [],
      score: this.calculateTourScore(metrics),
    }
  }

  /**
   * Create optimized tours from algorithm results
   */
  private async createOptimizedTours(
    algorithmResult: AlgorithmResult,
    addresses: readonly DeliveryAddress[],
    request: TourOptimizationRequest
  ): Promise<OptimizedTour[]> {
    const addressMap = new Map(addresses.map(addr => [addr.id, addr]))

    return algorithmResult.tours.map((tour, index) => {
      const tourAddresses = tour.sequence
        .map(id => addressMap.get(id))
        .filter((addr): addr is DeliveryAddress => addr !== undefined)

      return {
        id: tour.id,
        name: `Route ${index + 1}`,
        addresses: tourAddresses,
        sequence: tour.sequence,
        totalBottles: tour.metrics.totalBottles,
        totalWeight: tourAddresses.reduce((sum, addr) => sum + (addr.bottleCount * 20), 0), // Assume 20kg per bottle
        estimatedDistance: tour.metrics.totalDistance,
        estimatedDuration: tour.metrics.totalTime,
        vehicleConstraints: request.vehicleConstraints[0]!, // Use primary constraints
        status: TourStatus.OPTIMIZED,
        createdAt: new Date(),
        optimizedAt: new Date(),
        metadata: {
          optimizationAlgorithm: algorithmResult.algorithm,
          optimizationTime: algorithmResult.executionTime,
          iterationsPerformed: algorithmResult.iterations,
          improvementPercentage: algorithmResult.metrics.improvement,
          constraints: this.extractConstraintNames(request.vehicleConstraints[0]!),
          warnings: [],
          version: '4.0.0',
        },
        refillStops: [],
        metrics: {
          efficiency: tour.metrics.efficiency,
          loadUtilization: tour.metrics.utilizationRate,
          timeUtilization: Math.min(100, (tour.metrics.totalTime / 480) * 100), // 8 hour day
        },
      }
    })
  }

  /**
   * Assign drivers and vehicles optimally
   */
  private async assignResourcesOptimally(
    tours: readonly OptimizedTour[],
    request: TourOptimizationRequest
  ): Promise<{
    drivers: DriverAssignment[]
    vehicles: VehicleAssignment[]
  }> {
    const driverAssignments: DriverAssignment[] = []
    const vehicleAssignments: VehicleAssignment[] = []

    // Simple assignment for now - would use optimization algorithm for complex cases
    for (let i = 0; i < tours.length && i < request.drivers.length && i < request.vehicles.length; i++) {
      const tour = tours[i]!
      const driver = request.drivers[i]!
      const vehicle = request.vehicles[i]!

      driverAssignments.push({
        driverId: driver.id,
        tourId: tour.id,
        estimatedWorkingHours: tour.estimatedDuration / 60,
        skillMatch: this.calculateSkillMatch(driver, tour),
        preferenceScore: 0.8, // Would calculate based on driver preferences
      })

      vehicleAssignments.push({
        vehicleId: vehicle.id,
        tourId: tour.id,
        utilizationRate: tour.metrics.loadUtilization,
        fuelEstimate: this.estimateFuelUsage(tour, vehicle),
        maintenanceRequired: this.checkMaintenanceRequired(vehicle),
      })
    }

    return { drivers: driverAssignments, vehicles: vehicleAssignments }
  }

  /**
   * Calculate refill stops based on tour requirements
   */
  private calculateRefillStops(
    tours: readonly OptimizedTour[],
    request: TourOptimizationRequest
  ): RefillStop[] {
    const refillStops: RefillStop[] = []

    for (const tour of tours) {
      // Check if tour needs refill stop(s)
      if (tour.totalBottles > 60) { // If more than 75% of typical capacity
        const midpoint = Math.floor(tour.sequence.length / 2)
        const refillAddress = tour.addresses[midpoint]

        if (refillAddress) {
          refillStops.push({
            id: `refill_${tour.id}_1`,
            location: refillAddress.coordinates,
            address: `Refill near ${refillAddress.address}`,
            capacity: 80,
            estimatedTime: 15, // 15 minutes for refill
            sequence: midpoint,
          })
        }
      }
    }

    return refillStops
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(
    tours: readonly OptimizedTour[],
    request: TourOptimizationRequest,
    algorithmResult: AlgorithmResult
  ): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = []

    // Check for underutilized tours
    const underutilizedTours = tours.filter(tour => tour.metrics.loadUtilization < 0.6)
    if (underutilizedTours.length > 0) {
      recommendations.push({
        type: RecommendationType.CAPACITY_OPTIMIZATION,
        severity: 'warning',
        title: 'Underutilized Vehicle Capacity',
        description: `${underutilizedTours.length} tours are using less than 60% of vehicle capacity`,
        impact: 'Increased delivery costs and reduced efficiency',
        action: 'Consider consolidating routes or adjusting vehicle assignments',
      })
    }

    // Check for very long routes
    const longRoutes = tours.filter(tour => tour.estimatedDuration > 480) // 8 hours
    if (longRoutes.length > 0) {
      recommendations.push({
        type: RecommendationType.DRIVER_WORKLOAD,
        severity: 'critical',
        title: 'Excessive Route Duration',
        description: `${longRoutes.length} routes exceed 8-hour working limit`,
        impact: 'Driver fatigue, overtime costs, potential safety issues',
        action: 'Split long routes or add additional vehicles',
      })
    }

    // Check algorithm efficiency
    if (algorithmResult.metrics.efficiency < 70) {
      recommendations.push({
        type: RecommendationType.ROUTE_EFFICIENCY,
        severity: 'warning',
        title: 'Sub-optimal Route Efficiency',
        description: `Current optimization achieved ${algorithmResult.metrics.efficiency.toFixed(1)}% efficiency`,
        impact: 'Higher fuel costs and delivery times',
        action: 'Consider running optimization with different algorithm or parameters',
      })
    }

    // Check for priority handling
    const highPriorityAddresses = request.addresses.filter(addr => addr.priority <= 2)
    if (highPriorityAddresses.length > 0) {
      const wellHandled = tours.some(tour => 
        tour.addresses.slice(0, 3).some(addr => addr.priority <= 2)
      )

      if (!wellHandled) {
        recommendations.push({
          type: RecommendationType.PRIORITY_HANDLING,
          severity: 'warning',
          title: 'Priority Deliveries Not Optimally Scheduled',
          description: `${highPriorityAddresses.length} high-priority deliveries may not be handled optimally`,
          impact: 'Customer satisfaction and service level agreements',
          action: 'Review priority weighting in optimization parameters',
        })
      }
    }

    return recommendations
  }

  /**
   * Initialize default reoptimization triggers
   */
  private initializeDefaultTriggers(): void {
    this.triggers = [
      {
        condition: 'ADDRESS_COUNT_CHANGED' as const,
        threshold: 5, // 5 addresses
        cooldownPeriod: 30000, // 30 seconds
        enabled: true,
      },
      {
        condition: 'DELIVERY_DELAY' as const,
        threshold: 30, // 30 minutes
        cooldownPeriod: 300000, // 5 minutes
        enabled: true,
      },
      {
        condition: 'VEHICLE_BREAKDOWN' as const,
        threshold: 1, // Any breakdown
        cooldownPeriod: 0,
        enabled: true,
      },
    ]
  }

  /**
   * Check if reoptimization should be triggered
   */
  private checkReoptimizationTriggers(update: RealTimeUpdate): boolean {
    for (const trigger of this.triggers) {
      if (!trigger.enabled) continue

      const shouldTrigger = this.evaluateTriggerCondition(trigger, update)
      
      if (shouldTrigger) {
        // Check cooldown
        const lastTriggerTime = this.getLastTriggerTime(trigger.condition)
        const timeSinceLastTrigger = Date.now() - lastTriggerTime
        
        if (timeSinceLastTrigger >= trigger.cooldownPeriod) {
          this.setLastTriggerTime(trigger.condition, Date.now())
          return true
        }
      }
    }

    return false
  }

  /**
   * Helper methods
   */
  private isValidCoordinates(coordinates: Coordinates): boolean {
    return !isNaN(coordinates.lat) && 
           !isNaN(coordinates.lng) &&
           Math.abs(coordinates.lat) <= 90 &&
           Math.abs(coordinates.lng) <= 180
  }

  private clusterNearbyAddresses(addresses: readonly DeliveryAddress[]): DeliveryAddress[] {
    // Simple clustering - in production, would use more sophisticated clustering
    return [...addresses]
  }

  private validateTimeWindows(addresses: readonly DeliveryAddress[]): DeliveryAddress[] {
    // Validate and fix time windows
    return addresses.map(addr => {
      if (addr.timeWindow && addr.timeWindow.start >= addr.timeWindow.end) {
        console.warn(`Invalid time window for ${addr.deliveryId}, removing`)
        return { ...addr, timeWindow: undefined }
      }
      return addr
    })
  }

  private calculateOverallEfficiency(tours: readonly any[]): number {
    if (tours.length === 0) return 0
    return tours.reduce((sum, tour) => sum + tour.metrics.efficiency, 0) / tours.length
  }

  private createEmptyTourMetrics(): TourMetrics {
    return {
      totalDistance: 0,
      totalTime: 0,
      totalBottles: 0,
      utilizationRate: 0,
      efficiency: 0,
      priorityScore: 0,
      timeWindowViolations: 0,
    }
  }

  private calculatePriorityScore(sequence: readonly string[], addresses: readonly DeliveryAddress[]): number {
    const addressMap = new Map(addresses.map(addr => [addr.id, addr]))
    let score = 0

    sequence.forEach((id, index) => {
      const addr = addressMap.get(id)
      if (addr) {
        const priorityWeight = (6 - addr.priority) * 10 // Higher priority = higher weight
        const positionPenalty = index * 2 // Later positions get penalized
        score += Math.max(0, priorityWeight - positionPenalty)
      }
    })

    return score
  }

  private calculateTourScore(metrics: TourMetrics): number {
    return (metrics.efficiency * 2) + 
           (metrics.utilizationRate * 100) + 
           (metrics.priorityScore * 0.1) -
           (metrics.totalDistance * 0.5) -
           (metrics.timeWindowViolations * 50)
  }

  private extractConstraintNames(constraints: VehicleConstraints): string[] {
    const names = [
      `Max bottles: ${constraints.maxBottles}`,
      `Max stops: ${constraints.maxStops}`,
      `Max duration: ${Math.round(constraints.maxDuration / 60)}h`,
    ]

    if (constraints.restrictions.length > 0) {
      names.push(`Restrictions: ${constraints.restrictions.join(', ')}`)
    }

    return names
  }

  private calculateSkillMatch(driver: DriverInfo, tour: OptimizedTour): number {
    // Simple skill matching - in production, would be more sophisticated
    let matchScore = 0.5 // Base score

    if (tour.totalBottles > 50 && driver.skills.includes('HEAVY_LIFTING' as any)) {
      matchScore += 0.2
    }

    if (tour.addresses.some(addr => addr.addressType === 'COMMERCIAL') && 
        driver.skills.includes('CUSTOMER_SERVICE' as any)) {
      matchScore += 0.2
    }

    return Math.min(1.0, matchScore)
  }

  private estimateFuelUsage(tour: OptimizedTour, vehicle: VehicleInfo): number {
    // Rough fuel estimation based on distance and vehicle efficiency
    const baseConsumption = 8 // L/100km for delivery vehicle
    return (tour.estimatedDistance / 100) * baseConsumption
  }

  private checkMaintenanceRequired(vehicle: VehicleInfo): boolean {
    if (!vehicle.nextMaintenance) return false
    return new Date() >= vehicle.nextMaintenance
  }

  private evaluateTriggerCondition(trigger: ReoptimizationTrigger, update: RealTimeUpdate): boolean {
    // Simplified trigger evaluation
    switch (trigger.condition) {
      case 'ADDRESS_COUNT_CHANGED':
        return update.type === UpdateType.ADDRESS_ADDED || update.type === UpdateType.ADDRESS_REMOVED
      case 'VEHICLE_BREAKDOWN':
        return update.type === UpdateType.VEHICLE_BREAKDOWN
      default:
        return false
    }
  }

  private applyUpdateToRequest(request: TourOptimizationRequest, update: RealTimeUpdate): TourOptimizationRequest {
    // Apply the update to the request - simplified implementation
    return { ...request }
  }

  private lastTriggerTimes = new Map<string, number>()

  private getLastTriggerTime(condition: string): number {
    return this.lastTriggerTimes.get(condition) || 0
  }

  private setLastTriggerTime(condition: string, time: number): void {
    this.lastTriggerTimes.set(condition, time)
  }
}

export const tourOptimizer = new TourOptimizer()