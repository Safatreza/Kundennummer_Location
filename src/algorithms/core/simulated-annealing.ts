/**
 * Advanced Simulated Annealing Algorithm for Vehicle Routing Problem
 * Implements multiple cooling schedules and neighborhood operators
 * Supports adaptive temperature control and reheating mechanisms
 */

import type {
  DeliveryAddress,
  Coordinates,
  VehicleConstraints,
  SimulatedAnnealingConfig,
  Solution,
  TourSolution,
  AlgorithmResult,
  TerminationReason,
  CoolingSchedule,
  AnnealingState,
  ConstraintViolation,
} from '@/types'

import { DistanceCalculator } from './distance-calculator'

export class SimulatedAnnealingAlgorithm {
  private config: SimulatedAnnealingConfig
  private distanceCalculator: DistanceCalculator
  private state: AnnealingState | null = null
  private isRunning = false
  private startTime = 0
  private iteration = 0
  private acceptanceHistory: number[] = []

  constructor(
    config: SimulatedAnnealingConfig,
    distanceCalculator: DistanceCalculator
  ) {
    this.config = config
    this.distanceCalculator = distanceCalculator
    this.validateConfig()
  }

  /**
   * Main optimization method
   */
  public async optimize(
    addresses: readonly DeliveryAddress[],
    depot: Coordinates,
    vehicleConstraints: VehicleConstraints
  ): Promise<AlgorithmResult> {
    this.startTime = performance.now()
    this.isRunning = true
    this.iteration = 0
    this.acceptanceHistory = []

    try {
      // Initialize with a greedy solution
      const initialSolution = this.createInitialSolution(addresses, depot, vehicleConstraints)
      
      this.state = {
        currentSolution: initialSolution,
        bestSolution: { ...initialSolution },
        temperature: this.config.initialTemperature,
        iteration: 0,
        acceptanceRate: 1.0,
        lastImprovementIteration: 0,
      }

      const convergenceData: number[] = []
      let iterationsAtTemperature = 0

      // Main annealing loop
      while (this.shouldContinue()) {
        // Generate neighbor solution
        const neighborSolution = this.generateNeighbor(this.state.currentSolution, addresses, depot, vehicleConstraints)
        
        // Calculate energy (cost) difference
        const currentEnergy = this.calculateEnergy(this.state.currentSolution)
        const neighborEnergy = this.calculateEnergy(neighborSolution)
        const deltaE = neighborEnergy - currentEnergy

        // Accept or reject the neighbor
        const accept = this.acceptanceCriteria(deltaE, this.state.temperature)
        
        if (accept) {
          this.state.currentSolution = neighborSolution
          this.acceptanceHistory.push(1)
          
          // Update best solution if improved
          if (neighborEnergy < this.calculateEnergy(this.state.bestSolution)) {
            this.state.bestSolution = { ...neighborSolution }
            this.state.lastImprovementIteration = this.iteration
          }
        } else {
          this.acceptanceHistory.push(0)
        }

        // Record convergence data
        convergenceData.push(this.calculateEnergy(this.state.bestSolution))

        // Update acceptance rate
        this.updateAcceptanceRate()

        // Cool down temperature
        iterationsAtTemperature++
        if (iterationsAtTemperature >= this.config.maxIterationsAtTemperature) {
          this.coolDown()
          iterationsAtTemperature = 0

          // Reheat if stuck in local minimum
          if (this.shouldReheat()) {
            this.reheat()
          }
        }

        this.iteration++
        this.state.iteration = this.iteration
      }

      const executionTime = performance.now() - this.startTime
      return this.createResult(addresses, depot, executionTime, convergenceData, TerminationReason.CONVERGENCE)

    } catch (error) {
      const executionTime = performance.now() - this.startTime
      console.error('Simulated annealing error:', error)
      return this.createResult(addresses, depot, executionTime, [], TerminationReason.ERROR)
    } finally {
      this.isRunning = false
    }
  }

  /**
   * Create initial solution using nearest neighbor heuristic
   */
  private createInitialSolution(
    addresses: readonly DeliveryAddress[],
    depot: Coordinates,
    vehicleConstraints: VehicleConstraints
  ): Solution {
    const tours: TourSolution[] = []
    const unassigned: string[] = []
    const remaining = [...addresses]

    while (remaining.length > 0) {
      const tour = this.constructTour(remaining, depot, vehicleConstraints)
      if (tour.sequence.length > 0) {
        tours.push(tour)
        // Remove assigned addresses
        const assigned = new Set(tour.sequence)
        remaining.splice(0, remaining.length, ...remaining.filter(addr => !assigned.has(addr.id)))
      } else {
        // Can't create valid tour with remaining addresses
        unassigned.push(...remaining.map(addr => addr.id))
        break
      }
    }

    return {
      tours,
      unassigned,
      objective: this.calculateSolutionObjective(tours),
      feasible: unassigned.length === 0 && this.validateSolution(tours, vehicleConstraints),
      violations: this.findViolations(tours, vehicleConstraints),
      timestamp: new Date(),
    }
  }

  /**
   * Construct a single tour using nearest neighbor
   */
  private constructTour(
    addresses: readonly DeliveryAddress[],
    depot: Coordinates,
    vehicleConstraints: VehicleConstraints
  ): TourSolution {
    if (addresses.length === 0) {
      return {
        sequence: [],
        load: 0,
        distance: 0,
        duration: 0,
        violations: [],
      }
    }

    const sequence: string[] = []
    const available = [...addresses]
    let currentLoad = 0
    let currentCoord = depot
    let totalDistance = 0

    // Start with highest priority address or closest
    let startIndex = 0
    let bestScore = -Infinity

    for (let i = 0; i < available.length; i++) {
      const addr = available[i]!
      const distance = this.distanceCalculator.haversineDistance(depot, addr.coordinates)
      const priorityWeight = (6 - addr.priority) * 20 // Higher priority = higher weight
      const score = priorityWeight - distance
      
      if (score > bestScore && currentLoad + addr.bottleCount <= vehicleConstraints.maxBottles) {
        bestScore = score
        startIndex = i
      }
    }

    // Add starting address
    const startAddr = available.splice(startIndex, 1)[0]!
    sequence.push(startAddr.id)
    currentLoad += startAddr.bottleCount
    totalDistance += this.distanceCalculator.haversineDistance(currentCoord, startAddr.coordinates)
    currentCoord = startAddr.coordinates

    // Add remaining addresses using nearest neighbor with constraints
    while (available.length > 0 && sequence.length < vehicleConstraints.maxStops) {
      let nearestIndex = -1
      let nearestDistance = Infinity
      let nearestScore = -Infinity

      for (let i = 0; i < available.length; i++) {
        const addr = available[i]!
        
        // Check capacity constraint
        if (currentLoad + addr.bottleCount > vehicleConstraints.maxBottles) continue

        const distance = this.distanceCalculator.haversineDistance(currentCoord, addr.coordinates)
        const priorityWeight = (6 - addr.priority) * 10
        const score = priorityWeight - distance * 0.1

        if (score > nearestScore || (Math.abs(score - nearestScore) < 1 && distance < nearestDistance)) {
          nearestScore = score
          nearestDistance = distance
          nearestIndex = i
        }
      }

      if (nearestIndex >= 0) {
        const nearestAddr = available.splice(nearestIndex, 1)[0]!
        sequence.push(nearestAddr.id)
        currentLoad += nearestAddr.bottleCount
        totalDistance += nearestDistance
        currentCoord = nearestAddr.coordinates
      } else {
        break // No feasible address to add
      }
    }

    // Return to depot
    totalDistance += this.distanceCalculator.haversineDistance(currentCoord, depot)

    // Estimate duration
    const serviceTime = sequence.length * 5 // 5 minutes per stop
    const travelTime = (totalDistance / 30) * 60 // 30 km/h average speed
    const duration = travelTime + serviceTime

    return {
      sequence,
      load: currentLoad,
      distance: totalDistance,
      duration,
      violations: this.validateTour(sequence, currentLoad, duration, vehicleConstraints),
    }
  }

  /**
   * Generate neighbor solution using various operators
   */
  private generateNeighbor(
    solution: Solution,
    addresses: readonly DeliveryAddress[],
    depot: Coordinates,
    vehicleConstraints: VehicleConstraints
  ): Solution {
    const newSolution: Solution = {
      ...solution,
      tours: solution.tours.map(tour => ({ ...tour, sequence: [...tour.sequence] })),
      timestamp: new Date(),
    }

    // Randomly choose neighborhood operator
    const operators = [
      'swap_within_tour',
      'insert_within_tour',
      'two_opt',
      'relocate_between_tours',
      'exchange_between_tours',
      'or_opt',
    ]

    const operator = operators[Math.floor(Math.random() * operators.length)]!

    switch (operator) {
      case 'swap_within_tour':
        this.swapWithinTour(newSolution)
        break
      case 'insert_within_tour':
        this.insertWithinTour(newSolution)
        break
      case 'two_opt':
        this.twoOptImprovement(newSolution, depot)
        break
      case 'relocate_between_tours':
        this.relocateBetweenTours(newSolution, addresses, vehicleConstraints)
        break
      case 'exchange_between_tours':
        this.exchangeBetweenTours(newSolution, addresses, vehicleConstraints)
        break
      case 'or_opt':
        this.orOptImprovement(newSolution, depot)
        break
    }

    // Recalculate solution metrics
    this.updateSolutionMetrics(newSolution, addresses, depot)
    
    return newSolution
  }

  /**
   * Swap two random customers within a tour
   */
  private swapWithinTour(solution: Solution): void {
    if (solution.tours.length === 0) return

    const tourIndex = Math.floor(Math.random() * solution.tours.length)
    const tour = solution.tours[tourIndex]!
    
    if (tour.sequence.length < 2) return

    const i = Math.floor(Math.random() * tour.sequence.length)
    const j = Math.floor(Math.random() * tour.sequence.length)

    if (i !== j) {
      [tour.sequence[i], tour.sequence[j]] = [tour.sequence[j]!, tour.sequence[i]!]
    }
  }

  /**
   * Remove and reinsert a customer at different position within tour
   */
  private insertWithinTour(solution: Solution): void {
    if (solution.tours.length === 0) return

    const tourIndex = Math.floor(Math.random() * solution.tours.length)
    const tour = solution.tours[tourIndex]!
    
    if (tour.sequence.length < 2) return

    const removeIndex = Math.floor(Math.random() * tour.sequence.length)
    const insertIndex = Math.floor(Math.random() * tour.sequence.length)

    if (removeIndex !== insertIndex) {
      const customer = tour.sequence.splice(removeIndex, 1)[0]!
      tour.sequence.splice(insertIndex, 0, customer)
    }
  }

  /**
   * 2-opt improvement within a tour
   */
  private twoOptImprovement(solution: Solution, depot: Coordinates): void {
    if (solution.tours.length === 0) return

    const tourIndex = Math.floor(Math.random() * solution.tours.length)
    const tour = solution.tours[tourIndex]!
    
    if (tour.sequence.length < 4) return

    const i = Math.floor(Math.random() * (tour.sequence.length - 1))
    const j = Math.floor(Math.random() * (tour.sequence.length - i - 1)) + i + 1

    // Reverse the segment between i and j
    const newSequence = [...tour.sequence]
    const segment = newSequence.slice(i, j + 1).reverse()
    newSequence.splice(i, j - i + 1, ...segment)
    
    tour.sequence = newSequence
  }

  /**
   * Relocate a customer from one tour to another
   */
  private relocateBetweenTours(
    solution: Solution,
    addresses: readonly DeliveryAddress[],
    vehicleConstraints: VehicleConstraints
  ): void {
    if (solution.tours.length < 2) return

    const addressMap = new Map(addresses.map(addr => [addr.id, addr]))
    
    const fromTourIndex = Math.floor(Math.random() * solution.tours.length)
    const toTourIndex = Math.floor(Math.random() * solution.tours.length)
    
    if (fromTourIndex === toTourIndex) return

    const fromTour = solution.tours[fromTourIndex]!
    const toTour = solution.tours[toTourIndex]!

    if (fromTour.sequence.length === 0) return

    const customerIndex = Math.floor(Math.random() * fromTour.sequence.length)
    const customerId = fromTour.sequence[customerIndex]!
    const customer = addressMap.get(customerId)

    if (!customer) return

    // Check if move is feasible
    if (toTour.load + customer.bottleCount > vehicleConstraints.maxBottles) return
    if (toTour.sequence.length >= vehicleConstraints.maxStops) return

    // Perform the move
    fromTour.sequence.splice(customerIndex, 1)
    fromTour.load -= customer.bottleCount

    const insertIndex = Math.floor(Math.random() * (toTour.sequence.length + 1))
    toTour.sequence.splice(insertIndex, 0, customerId)
    toTour.load += customer.bottleCount
  }

  /**
   * Exchange customers between two tours
   */
  private exchangeBetweenTours(
    solution: Solution,
    addresses: readonly DeliveryAddress[],
    vehicleConstraints: VehicleConstraints
  ): void {
    if (solution.tours.length < 2) return

    const addressMap = new Map(addresses.map(addr => [addr.id, addr]))
    
    const tour1Index = Math.floor(Math.random() * solution.tours.length)
    let tour2Index = Math.floor(Math.random() * solution.tours.length)
    
    while (tour2Index === tour1Index && solution.tours.length > 1) {
      tour2Index = Math.floor(Math.random() * solution.tours.length)
    }

    const tour1 = solution.tours[tour1Index]!
    const tour2 = solution.tours[tour2Index]!

    if (tour1.sequence.length === 0 || tour2.sequence.length === 0) return

    const customer1Index = Math.floor(Math.random() * tour1.sequence.length)
    const customer2Index = Math.floor(Math.random() * tour2.sequence.length)
    
    const customer1Id = tour1.sequence[customer1Index]!
    const customer2Id = tour2.sequence[customer2Index]!
    
    const customer1 = addressMap.get(customer1Id)
    const customer2 = addressMap.get(customer2Id)

    if (!customer1 || !customer2) return

    // Check feasibility
    const tour1NewLoad = tour1.load - customer1.bottleCount + customer2.bottleCount
    const tour2NewLoad = tour2.load - customer2.bottleCount + customer1.bottleCount

    if (tour1NewLoad > vehicleConstraints.maxBottles || tour2NewLoad > vehicleConstraints.maxBottles) {
      return
    }

    // Perform the exchange
    tour1.sequence[customer1Index] = customer2Id
    tour2.sequence[customer2Index] = customer1Id
    
    tour1.load = tour1NewLoad
    tour2.load = tour2NewLoad
  }

  /**
   * Or-opt improvement (relocate sequence of customers)
   */
  private orOptImprovement(solution: Solution, depot: Coordinates): void {
    if (solution.tours.length === 0) return

    const tourIndex = Math.floor(Math.random() * solution.tours.length)
    const tour = solution.tours[tourIndex]!
    
    if (tour.sequence.length < 3) return

    const sequenceLength = Math.min(3, Math.floor(Math.random() * 3) + 1)
    const startIndex = Math.floor(Math.random() * (tour.sequence.length - sequenceLength + 1))
    const insertIndex = Math.floor(Math.random() * (tour.sequence.length - sequenceLength + 1))

    if (startIndex === insertIndex) return

    // Extract sequence
    const sequence = tour.sequence.splice(startIndex, sequenceLength)
    
    // Adjust insert index if necessary
    const adjustedInsertIndex = insertIndex > startIndex ? insertIndex - sequenceLength : insertIndex

    // Insert at new position
    tour.sequence.splice(adjustedInsertIndex, 0, ...sequence)
  }

  /**
   * Update solution metrics after modification
   */
  private updateSolutionMetrics(
    solution: Solution,
    addresses: readonly DeliveryAddress[],
    depot: Coordinates
  ): void {
    const addressMap = new Map(addresses.map(addr => [addr.id, addr]))

    for (const tour of solution.tours) {
      let distance = 0
      let load = 0
      let previousCoord = depot

      for (const addressId of tour.sequence) {
        const address = addressMap.get(addressId)
        if (address) {
          distance += this.distanceCalculator.haversineDistance(previousCoord, address.coordinates)
          load += address.bottleCount
          previousCoord = address.coordinates
        }
      }

      // Return to depot
      distance += this.distanceCalculator.haversineDistance(previousCoord, depot)

      tour.distance = distance
      tour.load = load
      tour.duration = (distance / 30) * 60 + tour.sequence.length * 5 // Travel time + service time
    }

    solution.objective = this.calculateSolutionObjective(solution.tours)
  }

  /**
   * Calculate energy (cost) of a solution
   */
  private calculateEnergy(solution: Solution): number {
    let totalCost = 0

    // Distance cost
    const totalDistance = solution.tours.reduce((sum, tour) => sum + tour.distance, 0)
    totalCost += totalDistance * 1.0 // Distance weight

    // Time cost
    const totalTime = solution.tours.reduce((sum, tour) => sum + tour.duration, 0)
    totalCost += totalTime * 0.1 // Time weight

    // Vehicle cost (number of tours)
    totalCost += solution.tours.length * 100 // Vehicle fixed cost

    // Penalty for unassigned addresses
    totalCost += solution.unassigned.length * 1000

    // Penalty for constraint violations
    for (const tour of solution.tours) {
      totalCost += tour.violations.length * 500
    }

    return totalCost
  }

  /**
   * Acceptance criteria (Metropolis criterion)
   */
  private acceptanceCriteria(deltaE: number, temperature: number): boolean {
    if (deltaE <= 0) {
      return true // Always accept improvements
    }

    if (temperature <= 0) {
      return false // No randomization at zero temperature
    }

    const probability = Math.exp(-deltaE / temperature)
    return Math.random() < probability
  }

  /**
   * Update acceptance rate
   */
  private updateAcceptanceRate(): void {
    if (!this.state || this.acceptanceHistory.length === 0) return

    const windowSize = Math.min(100, this.acceptanceHistory.length)
    const recentHistory = this.acceptanceHistory.slice(-windowSize)
    this.state.acceptanceRate = recentHistory.reduce((sum, val) => sum + val, 0) / recentHistory.length
  }

  /**
   * Cool down temperature based on cooling schedule
   */
  private coolDown(): void {
    if (!this.state) return

    switch (this.config.coolingSchedule) {
      case CoolingSchedule.LINEAR:
        this.state.temperature = Math.max(
          this.config.finalTemperature,
          this.state.temperature - this.config.coolingRate
        )
        break

      case CoolingSchedule.EXPONENTIAL:
        this.state.temperature = Math.max(
          this.config.finalTemperature,
          this.state.temperature * this.config.coolingRate
        )
        break

      case CoolingSchedule.LOGARITHMIC:
        this.state.temperature = Math.max(
          this.config.finalTemperature,
          this.config.initialTemperature / Math.log(1 + this.iteration)
        )
        break

      case CoolingSchedule.ADAPTIVE:
        // Adapt cooling rate based on acceptance rate
        const adaptiveRate = this.state.acceptanceRate > 0.6 ? this.config.coolingRate * 1.2 : this.config.coolingRate * 0.8
        this.state.temperature = Math.max(
          this.config.finalTemperature,
          this.state.temperature * adaptiveRate
        )
        break

      case CoolingSchedule.CAUCHY:
        this.state.temperature = Math.max(
          this.config.finalTemperature,
          this.config.initialTemperature / (1 + this.iteration)
        )
        break

      default:
        this.state.temperature = Math.max(
          this.config.finalTemperature,
          this.state.temperature * this.config.coolingRate
        )
    }
  }

  /**
   * Check if reheating is needed
   */
  private shouldReheat(): boolean {
    if (!this.state) return false

    const stagnationPeriod = this.iteration - this.state.lastImprovementIteration
    const minAcceptance = this.config.minAcceptanceRate || 0.01

    return (
      stagnationPeriod > 100 &&
      this.state.acceptanceRate < minAcceptance &&
      this.state.temperature < this.config.initialTemperature * 0.1
    )
  }

  /**
   * Reheat the system
   */
  private reheat(): void {
    if (!this.state) return

    this.state.temperature = Math.min(
      this.config.initialTemperature * this.config.reheatThreshold,
      this.state.temperature * 10
    )
  }

  /**
   * Check termination conditions
   */
  private shouldContinue(): boolean {
    if (!this.isRunning || !this.state) return false

    // Temperature threshold
    if (this.state.temperature < this.config.finalTemperature) return false

    // Maximum iterations
    if (this.iteration >= this.config.maxIterations) return false

    // Time limit
    if (performance.now() - this.startTime >= this.config.constraints.maxExecutionTime) return false

    // Convergence (no improvement for long time)
    if (this.iteration - this.state.lastImprovementIteration > 500) return false

    return true
  }

  /**
   * Calculate solution objective
   */
  private calculateSolutionObjective(tours: readonly TourSolution[]): number {
    return tours.reduce((sum, tour) => sum + tour.distance, 0)
  }

  /**
   * Validate solution
   */
  private validateSolution(tours: readonly TourSolution[], vehicleConstraints: VehicleConstraints): boolean {
    return tours.every(tour => 
      tour.load <= vehicleConstraints.maxBottles &&
      tour.sequence.length <= vehicleConstraints.maxStops &&
      tour.duration <= vehicleConstraints.maxDuration
    )
  }

  /**
   * Find constraint violations
   */
  private findViolations(tours: readonly TourSolution[], vehicleConstraints: VehicleConstraints): ConstraintViolation[] {
    const violations: ConstraintViolation[] = []

    tours.forEach((tour, index) => {
      if (tour.load > vehicleConstraints.maxBottles) {
        violations.push({
          type: 'CAPACITY_EXCEEDED' as const,
          severity: 'ERROR' as const,
          description: `Tour ${index} exceeds capacity`,
          tourId: `tour_${index}`,
          value: tour.load,
          limit: vehicleConstraints.maxBottles,
        })
      }

      if (tour.sequence.length > vehicleConstraints.maxStops) {
        violations.push({
          type: 'MAX_DISTANCE_EXCEEDED' as const,
          severity: 'WARNING' as const,
          description: `Tour ${index} exceeds max stops`,
          tourId: `tour_${index}`,
          value: tour.sequence.length,
          limit: vehicleConstraints.maxStops,
        })
      }

      if (tour.duration > vehicleConstraints.maxDuration) {
        violations.push({
          type: 'MAX_DURATION_EXCEEDED' as const,
          severity: 'WARNING' as const,
          description: `Tour ${index} exceeds max duration`,
          tourId: `tour_${index}`,
          value: tour.duration,
          limit: vehicleConstraints.maxDuration,
        })
      }
    })

    return violations
  }

  /**
   * Validate tour constraints
   */
  private validateTour(
    sequence: readonly string[],
    load: number,
    duration: number,
    vehicleConstraints: VehicleConstraints
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = []

    if (load > vehicleConstraints.maxBottles) {
      violations.push({
        type: 'CAPACITY_EXCEEDED' as const,
        severity: 'ERROR' as const,
        description: 'Tour exceeds bottle capacity',
        value: load,
        limit: vehicleConstraints.maxBottles,
      })
    }

    if (sequence.length > vehicleConstraints.maxStops) {
      violations.push({
        type: 'MAX_DISTANCE_EXCEEDED' as const,
        severity: 'WARNING' as const,
        description: 'Tour exceeds maximum stops',
        value: sequence.length,
        limit: vehicleConstraints.maxStops,
      })
    }

    if (duration > vehicleConstraints.maxDuration) {
      violations.push({
        type: 'MAX_DURATION_EXCEEDED' as const,
        severity: 'WARNING' as const,
        description: 'Tour exceeds maximum duration',
        value: duration,
        limit: vehicleConstraints.maxDuration,
      })
    }

    return violations
  }

  /**
   * Create algorithm result
   */
  private createResult(
    addresses: readonly DeliveryAddress[],
    depot: Coordinates,
    executionTime: number,
    convergenceData: readonly number[],
    terminationReason: TerminationReason
  ): AlgorithmResult {
    const bestSolution = this.state?.bestSolution

    return {
      algorithm: 'SIMULATED_ANNEALING' as const,
      tours: bestSolution?.tours.map((tour, index) => ({
        id: `tour_${index}`,
        sequence: tour.sequence,
        metrics: {
          totalDistance: tour.distance,
          totalTime: tour.duration,
          totalBottles: tour.load,
          utilizationRate: tour.load / 80, // Assuming 80 bottle max
          efficiency: Math.max(0, 100 - (tour.distance / Math.max(tour.sequence.length, 1)) * 5),
          priorityScore: 0, // Would need to calculate based on priorities
          timeWindowViolations: 0,
        },
        violations: tour.violations,
        score: bestSolution ? this.calculateEnergy(bestSolution) : 0,
      })) || [],
      metrics: {
        totalScore: bestSolution ? this.calculateEnergy(bestSolution) : 0,
        improvement: convergenceData.length > 1 
          ? ((convergenceData[0]! - convergenceData[convergenceData.length - 1]!) / Math.abs(convergenceData[0]! || 1)) * 100
          : 0,
        efficiency: bestSolution ? Math.min(100, Math.max(0, 100 - (this.calculateEnergy(bestSolution) / 1000))) : 0,
        feasibility: bestSolution?.feasible ? 100 : 50,
        diversity: 0, // Not applicable for SA
        stability: this.calculateStability(convergenceData),
      },
      convergenceData: convergenceData.map((energy, iteration) => ({
        iteration,
        bestScore: energy,
        averageScore: energy,
        diversity: 0,
        timestamp: this.startTime + (iteration * 100),
      })),
      executionTime,
      memoryUsed: this.estimateMemoryUsage(),
      iterations: this.iteration,
      terminated: terminationReason,
    }
  }

  /**
   * Calculate solution stability from convergence data
   */
  private calculateStability(convergenceData: readonly number[]): number {
    if (convergenceData.length < 10) return 50

    const recent = convergenceData.slice(-10)
    const mean = recent.reduce((sum, val) => sum + val, 0) / recent.length
    const variance = recent.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recent.length

    return Math.max(0, 100 - Math.sqrt(variance) / Math.abs(mean) * 100)
  }

  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(): number {
    const solutionSize = this.state?.bestSolution.tours.reduce((sum, tour) => sum + tour.sequence.length, 0) || 0
    const historySize = this.acceptanceHistory.length

    return Math.round((solutionSize * 4 + historySize * 1) / 1024) // KB
  }

  /**
   * Validate configuration
   */
  private validateConfig(): void {
    if (this.config.initialTemperature <= 0) {
      throw new Error('Initial temperature must be positive')
    }
    if (this.config.finalTemperature < 0) {
      throw new Error('Final temperature must be non-negative')
    }
    if (this.config.coolingRate <= 0 || this.config.coolingRate >= 1) {
      throw new Error('Cooling rate must be between 0 and 1')
    }
    if (this.config.maxIterationsAtTemperature <= 0) {
      throw new Error('Max iterations at temperature must be positive')
    }
  }

  /**
   * Stop the algorithm
   */
  public stop(): void {
    this.isRunning = false
  }

  /**
   * Get current progress
   */
  public getProgress() {
    if (!this.state) {
      return {
        iteration: 0,
        bestScore: 0,
        currentScore: 0,
        improvement: 0,
        elapsedTime: 0,
        stage: 'Initializing',
      }
    }

    const currentTime = performance.now()
    const elapsedTime = currentTime - this.startTime
    const tempProgress = Math.min(100, Math.max(0, 
      (this.config.initialTemperature - this.state.temperature) / 
      (this.config.initialTemperature - this.config.finalTemperature) * 100
    ))

    return {
      iteration: this.iteration,
      bestScore: this.calculateEnergy(this.state.bestSolution),
      currentScore: this.calculateEnergy(this.state.currentSolution),
      improvement: this.iteration - this.state.lastImprovementIteration,
      elapsedTime: elapsedTime,
      estimatedTimeRemaining: tempProgress > 0 ? (elapsedTime / tempProgress) * (100 - tempProgress) : undefined,
      stage: `Temperature: ${this.state.temperature.toFixed(2)}, Acceptance: ${(this.state.acceptanceRate * 100).toFixed(1)}%`,
    }
  }
}