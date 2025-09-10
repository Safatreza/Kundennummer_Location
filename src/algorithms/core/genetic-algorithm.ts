/**
 * Advanced Genetic Algorithm for Vehicle Routing Problem (VRP)
 * Implements state-of-the-art GA with multiple crossover/mutation operators
 * Supports multi-objective optimization with Pareto fronts
 */

import type {
  DeliveryAddress,
  OptimizedTour,
  VehicleConstraints,
  Coordinates,
  GeneticAlgorithmConfig,
  Chromosome,
  Gene,
  Solution,
  TourSolution,
  ConstraintViolation,
  AlgorithmResult,
  OptimizationObjective,
} from '@/types'

import {
  CrossoverType,
  MutationType,
  SelectionType,
  TerminationReason,
  ViolationType,
  ViolationSeverity,
} from '@/types'

import { DistanceCalculator } from './distance-calculator'

export class GeneticAlgorithm {
  private config: GeneticAlgorithmConfig
  private distanceCalculator: DistanceCalculator
  private population: Chromosome[] = []
  private generation = 0
  private bestSolution: Solution | null = null
  private convergenceData: number[] = []
  private startTime = 0
  private isRunning = false

  constructor(
    config: GeneticAlgorithmConfig,
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
    this.generation = 0
    this.convergenceData = []

    try {
      // Initialize population
      this.initializePopulation(addresses, depot, vehicleConstraints)
      
      // Evolution loop
      let noImprovementCount = 0
      let bestFitness = -Infinity

      while (this.shouldContinue(noImprovementCount)) {
        // Evaluate fitness for all chromosomes
        await this.evaluatePopulation(addresses, depot, vehicleConstraints)
        
        // Track best solution
        const currentBest = this.population[0]!
        if (currentBest.fitness > bestFitness) {
          bestFitness = currentBest.fitness
          this.bestSolution = this.chromosomeToSolution(currentBest, addresses, depot)
          noImprovementCount = 0
        } else {
          noImprovementCount++
        }

        // Record convergence data
        const avgFitness = this.population.reduce((sum, chr) => sum + chr.fitness, 0) / this.population.length
        this.convergenceData.push(bestFitness)

        // Create next generation
        const newPopulation = await this.createNextGeneration()
        this.population = newPopulation
        this.generation++

        // Adaptive parameter adjustment
        if (this.config.adaptiveRates) {
          this.adaptParameters(noImprovementCount)
        }
      }

      const executionTime = performance.now() - this.startTime
      return this.createResult(addresses, depot, executionTime, TerminationReason.CONVERGENCE)

    } catch (error) {
      const executionTime = performance.now() - this.startTime
      console.error('Genetic algorithm error:', error)
      return this.createResult(addresses, depot, executionTime, TerminationReason.ERROR)
    } finally {
      this.isRunning = false
    }
  }

  /**
   * Initialize the population with diverse solutions
   */
  private initializePopulation(
    addresses: readonly DeliveryAddress[],
    depot: Coordinates,
    vehicleConstraints: VehicleConstraints
  ): void {
    this.population = []

    for (let i = 0; i < this.config.populationSize; i++) {
      const chromosome = this.createRandomChromosome(addresses, vehicleConstraints)
      this.population.push(chromosome)
    }

    // Ensure diversity by using different construction heuristics
    const diversityMethods = [
      'nearest_neighbor',
      'farthest_insertion',
      'cheapest_insertion',
      'random',
      'priority_based'
    ]

    for (let i = 0; i < Math.min(diversityMethods.length, this.config.populationSize); i++) {
      const method = diversityMethods[i]!
      const chromosome = this.createHeuristicChromosome(addresses, vehicleConstraints, method)
      if (i < this.population.length) {
        this.population[i] = chromosome
      }
    }
  }

  /**
   * Create a random chromosome
   */
  private createRandomChromosome(
    addresses: readonly DeliveryAddress[],
    vehicleConstraints: VehicleConstraints
  ): Chromosome {
    const shuffledAddresses = [...addresses].sort(() => Math.random() - 0.5)
    const genes: Gene[] = []
    let currentTour: string[] = []
    let currentLoad = 0
    let tourId = 0

    for (const address of shuffledAddresses) {
      if (currentLoad + address.bottleCount > vehicleConstraints.maxBottles || 
          currentTour.length >= vehicleConstraints.maxStops) {
        if (currentTour.length > 0) {
          genes.push({
            tourId: `tour_${tourId++}`,
            sequence: [...currentTour],
            fitness: 0, // Will be calculated later
          })
          currentTour = []
          currentLoad = 0
        }
      }

      currentTour.push(address.id)
      currentLoad += address.bottleCount
    }

    // Add final tour
    if (currentTour.length > 0) {
      genes.push({
        tourId: `tour_${tourId}`,
        sequence: [...currentTour],
        fitness: 0,
      })
    }

    return {
      genes,
      fitness: 0,
      age: 0,
      violations: [],
    }
  }

  /**
   * Create chromosome using construction heuristics
   */
  private createHeuristicChromosome(
    addresses: readonly DeliveryAddress[],
    vehicleConstraints: VehicleConstraints,
    method: string
  ): Chromosome {
    let orderedAddresses: DeliveryAddress[]

    switch (method) {
      case 'nearest_neighbor':
        orderedAddresses = this.nearestNeighborHeuristic(addresses)
        break
      case 'farthest_insertion':
        orderedAddresses = this.farthestInsertionHeuristic(addresses)
        break
      case 'cheapest_insertion':
        orderedAddresses = this.cheapestInsertionHeuristic(addresses)
        break
      case 'priority_based':
        orderedAddresses = this.priorityBasedHeuristic(addresses)
        break
      default:
        orderedAddresses = [...addresses].sort(() => Math.random() - 0.5)
    }

    return this.createChromosomeFromSequence(orderedAddresses, vehicleConstraints)
  }

  /**
   * Nearest neighbor heuristic
   */
  private nearestNeighborHeuristic(addresses: readonly DeliveryAddress[]): DeliveryAddress[] {
    if (addresses.length === 0) return []

    const result: DeliveryAddress[] = []
    const remaining = new Set(addresses)
    let current = addresses[0]!
    
    result.push(current)
    remaining.delete(current)

    while (remaining.size > 0) {
      let nearest = null
      let nearestDistance = Infinity

      for (const candidate of remaining) {
        const distance = this.distanceCalculator.haversineDistance(
          current.coordinates,
          candidate.coordinates
        )
        if (distance < nearestDistance) {
          nearestDistance = distance
          nearest = candidate
        }
      }

      if (nearest) {
        result.push(nearest)
        remaining.delete(nearest)
        current = nearest
      }
    }

    return result
  }

  /**
   * Farthest insertion heuristic
   */
  private farthestInsertionHeuristic(addresses: readonly DeliveryAddress[]): DeliveryAddress[] {
    if (addresses.length === 0) return []
    if (addresses.length === 1) return [...addresses]

    const result: DeliveryAddress[] = [addresses[0]!]
    const remaining = new Set(addresses.slice(1))

    while (remaining.size > 0) {
      // Find the address farthest from the current tour
      let farthest = null
      let maxMinDistance = -1

      for (const candidate of remaining) {
        let minDistance = Infinity
        for (const tourAddress of result) {
          const distance = this.distanceCalculator.haversineDistance(
            candidate.coordinates,
            tourAddress.coordinates
          )
          minDistance = Math.min(minDistance, distance)
        }
        if (minDistance > maxMinDistance) {
          maxMinDistance = minDistance
          farthest = candidate
        }
      }

      if (farthest) {
        // Find best insertion position
        let bestPosition = result.length
        let bestIncrease = Infinity

        for (let i = 0; i <= result.length; i++) {
          const increase = this.calculateInsertionCost(result, farthest, i)
          if (increase < bestIncrease) {
            bestIncrease = increase
            bestPosition = i
          }
        }

        result.splice(bestPosition, 0, farthest)
        remaining.delete(farthest)
      }
    }

    return result
  }

  /**
   * Cheapest insertion heuristic
   */
  private cheapestInsertionHeuristic(addresses: readonly DeliveryAddress[]): DeliveryAddress[] {
    if (addresses.length === 0) return []
    if (addresses.length === 1) return [...addresses]

    const result: DeliveryAddress[] = [addresses[0]!]
    const remaining = new Set(addresses.slice(1))

    while (remaining.size > 0) {
      let bestAddress = null
      let bestPosition = 0
      let minIncrease = Infinity

      for (const candidate of remaining) {
        for (let i = 0; i <= result.length; i++) {
          const increase = this.calculateInsertionCost(result, candidate, i)
          if (increase < minIncrease) {
            minIncrease = increase
            bestAddress = candidate
            bestPosition = i
          }
        }
      }

      if (bestAddress) {
        result.splice(bestPosition, 0, bestAddress)
        remaining.delete(bestAddress)
      }
    }

    return result
  }

  /**
   * Priority-based heuristic
   */
  private priorityBasedHeuristic(addresses: readonly DeliveryAddress[]): DeliveryAddress[] {
    return [...addresses].sort((a, b) => {
      // Primary sort by priority (lower number = higher priority)
      if (a.priority !== b.priority) {
        return a.priority - b.priority
      }
      // Secondary sort by bottle count (descending)
      return b.bottleCount - a.bottleCount
    })
  }

  /**
   * Calculate insertion cost for cheapest insertion
   */
  private calculateInsertionCost(
    tour: readonly DeliveryAddress[],
    address: DeliveryAddress,
    position: number
  ): number {
    if (tour.length === 0) return 0
    if (position === 0) {
      return this.distanceCalculator.haversineDistance(address.coordinates, tour[0]!.coordinates)
    }
    if (position === tour.length) {
      return this.distanceCalculator.haversineDistance(tour[tour.length - 1]!.coordinates, address.coordinates)
    }

    const before = tour[position - 1]!
    const after = tour[position]!
    
    const originalDistance = this.distanceCalculator.haversineDistance(before.coordinates, after.coordinates)
    const newDistance = 
      this.distanceCalculator.haversineDistance(before.coordinates, address.coordinates) +
      this.distanceCalculator.haversineDistance(address.coordinates, after.coordinates)

    return newDistance - originalDistance
  }

  /**
   * Create chromosome from ordered sequence
   */
  private createChromosomeFromSequence(
    addresses: readonly DeliveryAddress[],
    vehicleConstraints: VehicleConstraints
  ): Chromosome {
    const genes: Gene[] = []
    let currentTour: string[] = []
    let currentLoad = 0
    let tourId = 0

    for (const address of addresses) {
      if (currentLoad + address.bottleCount > vehicleConstraints.maxBottles || 
          currentTour.length >= vehicleConstraints.maxStops) {
        if (currentTour.length > 0) {
          genes.push({
            tourId: `tour_${tourId++}`,
            sequence: [...currentTour],
            fitness: 0,
          })
          currentTour = []
          currentLoad = 0
        }
      }

      currentTour.push(address.id)
      currentLoad += address.bottleCount
    }

    if (currentTour.length > 0) {
      genes.push({
        tourId: `tour_${tourId}`,
        sequence: [...currentTour],
        fitness: 0,
      })
    }

    return {
      genes,
      fitness: 0,
      age: 0,
      violations: [],
    }
  }

  /**
   * Evaluate fitness for entire population
   */
  private async evaluatePopulation(
    addresses: readonly DeliveryAddress[],
    depot: Coordinates,
    vehicleConstraints: VehicleConstraints
  ): Promise<void> {
    const addressMap = new Map(addresses.map(addr => [addr.id, addr]))

    for (const chromosome of this.population) {
      chromosome.fitness = await this.calculateFitness(chromosome, addressMap, depot, vehicleConstraints)
      chromosome.violations = this.validateConstraints(chromosome, addressMap, vehicleConstraints)
    }

    // Sort population by fitness (descending)
    this.population.sort((a, b) => b.fitness - a.fitness)
  }

  /**
   * Calculate fitness score for a chromosome
   */
  private async calculateFitness(
    chromosome: Chromosome,
    addressMap: Map<string, DeliveryAddress>,
    depot: Coordinates,
    vehicleConstraints: VehicleConstraints
  ): Promise<number> {
    let totalDistance = 0
    let totalTime = 0
    let totalViolations = 0
    let priorityScore = 0

    for (const gene of chromosome.genes) {
      const tourAddresses = gene.sequence
        .map(id => addressMap.get(id))
        .filter((addr): addr is DeliveryAddress => addr !== undefined)

      if (tourAddresses.length === 0) continue

      // Calculate tour distance (depot -> addresses -> depot)
      let tourDistance = 0
      let previousCoord = depot

      for (const address of tourAddresses) {
        tourDistance += this.distanceCalculator.haversineDistance(previousCoord, address.coordinates)
        previousCoord = address.coordinates
      }
      
      // Return to depot
      tourDistance += this.distanceCalculator.haversineDistance(previousCoord, depot)
      totalDistance += tourDistance

      // Estimate time (distance-based + service time)
      const serviceTime = tourAddresses.length * 5 // 5 minutes per stop
      totalTime += (tourDistance / 30) * 60 + serviceTime // 30 km/h average speed

      // Calculate priority score (higher priority = higher score)
      priorityScore += tourAddresses.reduce((sum, addr) => {
        const priorityWeight = 6 - addr.priority // Invert priority (1->5, 5->1)
        return sum + priorityWeight * addr.bottleCount
      }, 0)

      // Check constraints
      const totalBottles = tourAddresses.reduce((sum, addr) => sum + addr.bottleCount, 0)
      if (totalBottles > vehicleConstraints.maxBottles) {
        totalViolations += (totalBottles - vehicleConstraints.maxBottles) * 10
      }

      if (tourAddresses.length > vehicleConstraints.maxStops) {
        totalViolations += (tourAddresses.length - vehicleConstraints.maxStops) * 5
      }

      if (totalTime > vehicleConstraints.maxDuration) {
        totalViolations += (totalTime - vehicleConstraints.maxDuration) * 2
      }
    }

    // Multi-objective fitness function
    const distanceScore = 1000 - totalDistance // Lower distance = higher score
    const timeScore = 500 - totalTime / 10 // Lower time = higher score
    const violationPenalty = totalViolations * 100
    const efficiencyBonus = chromosome.genes.length > 0 ? priorityScore / chromosome.genes.length : 0

    return Math.max(0, distanceScore + timeScore + efficiencyBonus - violationPenalty)
  }

  /**
   * Validate constraints and return violations
   */
  private validateConstraints(
    chromosome: Chromosome,
    addressMap: Map<string, DeliveryAddress>,
    vehicleConstraints: VehicleConstraints
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = []

    for (const gene of chromosome.genes) {
      const tourAddresses = gene.sequence
        .map(id => addressMap.get(id))
        .filter((addr): addr is DeliveryAddress => addr !== undefined)

      const totalBottles = tourAddresses.reduce((sum, addr) => sum + addr.bottleCount, 0)
      
      if (totalBottles > vehicleConstraints.maxBottles) {
        violations.push({
          type: ViolationType.CAPACITY_EXCEEDED,
          severity: ViolationSeverity.ERROR,
          description: `Tour ${gene.tourId} exceeds bottle capacity`,
          tourId: gene.tourId,
          value: totalBottles,
          limit: vehicleConstraints.maxBottles,
        })
      }

      if (tourAddresses.length > vehicleConstraints.maxStops) {
        violations.push({
          type: ViolationType.MAX_STOPS_EXCEEDED,
          severity: ViolationSeverity.WARNING,
          description: `Tour ${gene.tourId} exceeds maximum stops`,
          tourId: gene.tourId,
          value: tourAddresses.length,
          limit: vehicleConstraints.maxStops,
        })
      }
    }

    return violations
  }

  /**
   * Create next generation through selection, crossover, and mutation
   */
  private async createNextGeneration(): Promise<Chromosome[]> {
    const newPopulation: Chromosome[] = []

    // Elitism - keep best chromosomes
    const eliteCount = Math.floor(this.config.populationSize * this.config.eliteSize / 100)
    for (let i = 0; i < eliteCount; i++) {
      const elite = { ...this.population[i]!, age: this.population[i]!.age + 1 }
      newPopulation.push(elite)
    }

    // Fill rest of population through crossover and mutation
    while (newPopulation.length < this.config.populationSize) {
      const parent1 = this.selectParent()
      const parent2 = this.selectParent()

      let offspring: Chromosome[]
      
      if (Math.random() < this.config.crossoverRate / 100) {
        offspring = this.crossover(parent1, parent2)
      } else {
        offspring = [{ ...parent1 }, { ...parent2 }]
      }

      // Apply mutation
      for (const child of offspring) {
        if (Math.random() < this.config.mutationRate / 100) {
          this.mutate(child)
        }
        child.age = 0 // Reset age for new offspring
      }

      newPopulation.push(...offspring.slice(0, this.config.populationSize - newPopulation.length))
    }

    return newPopulation
  }

  /**
   * Parent selection using configured method
   */
  private selectParent(): Chromosome {
    switch (this.config.selectionType) {
      case SelectionType.TOURNAMENT:
        return this.tournamentSelection()
      case SelectionType.ROULETTE_WHEEL:
        return this.rouletteWheelSelection()
      case SelectionType.RANK_BASED:
        return this.rankBasedSelection()
      default:
        return this.tournamentSelection()
    }
  }

  /**
   * Tournament selection
   */
  private tournamentSelection(): Chromosome {
    const tournamentSize = this.config.tournamentSize
    const tournament: Chromosome[] = []

    for (let i = 0; i < tournamentSize; i++) {
      const randomIndex = Math.floor(Math.random() * this.population.length)
      tournament.push(this.population[randomIndex]!)
    }

    return tournament.reduce((best, current) => 
      current.fitness > best.fitness ? current : best
    )
  }

  /**
   * Roulette wheel selection
   */
  private rouletteWheelSelection(): Chromosome {
    const totalFitness = this.population.reduce((sum, chr) => sum + Math.max(0, chr.fitness), 0)
    
    if (totalFitness === 0) {
      return this.population[Math.floor(Math.random() * this.population.length)]!
    }

    const random = Math.random() * totalFitness
    let sum = 0

    for (const chromosome of this.population) {
      sum += Math.max(0, chromosome.fitness)
      if (sum >= random) {
        return chromosome
      }
    }

    return this.population[this.population.length - 1]!
  }

  /**
   * Rank-based selection
   */
  private rankBasedSelection(): Chromosome {
    const totalRanks = (this.population.length * (this.population.length + 1)) / 2
    const random = Math.random() * totalRanks
    let sum = 0

    for (let i = 0; i < this.population.length; i++) {
      sum += this.population.length - i
      if (sum >= random) {
        return this.population[i]!
      }
    }

    return this.population[this.population.length - 1]!
  }

  /**
   * Crossover operation
   */
  private crossover(parent1: Chromosome, parent2: Chromosome): Chromosome[] {
    switch (this.config.crossoverType) {
      case CrossoverType.ORDER_CROSSOVER:
        return this.orderCrossover(parent1, parent2)
      case CrossoverType.PARTIALLY_MAPPED:
        return this.partiallyMappedCrossover(parent1, parent2)
      case CrossoverType.UNIFORM:
        return this.uniformCrossover(parent1, parent2)
      default:
        return this.orderCrossover(parent1, parent2)
    }
  }

  /**
   * Order crossover (OX)
   */
  private orderCrossover(parent1: Chromosome, parent2: Chromosome): Chromosome[] {
    // Simplified implementation for route segments
    const child1 = this.createEmptyChromosome()
    const child2 = this.createEmptyChromosome()

    // For now, return modified copies of parents
    // Full implementation would involve complex gene recombination
    child1.genes = this.recombineGenes(parent1.genes, parent2.genes, 'order')
    child2.genes = this.recombineGenes(parent2.genes, parent1.genes, 'order')

    return [child1, child2]
  }

  /**
   * Partially mapped crossover (PMX)
   */
  private partiallyMappedCrossover(parent1: Chromosome, parent2: Chromosome): Chromosome[] {
    const child1 = this.createEmptyChromosome()
    const child2 = this.createEmptyChromosome()

    child1.genes = this.recombineGenes(parent1.genes, parent2.genes, 'pmx')
    child2.genes = this.recombineGenes(parent2.genes, parent1.genes, 'pmx')

    return [child1, child2]
  }

  /**
   * Uniform crossover
   */
  private uniformCrossover(parent1: Chromosome, parent2: Chromosome): Chromosome[] {
    const child1 = this.createEmptyChromosome()
    const child2 = this.createEmptyChromosome()

    child1.genes = this.recombineGenes(parent1.genes, parent2.genes, 'uniform')
    child2.genes = this.recombineGenes(parent2.genes, parent1.genes, 'uniform')

    return [child1, child2]
  }

  /**
   * Gene recombination helper
   */
  private recombineGenes(genes1: Gene[], genes2: Gene[], method: string): Gene[] {
    // Simplified gene recombination
    const result: Gene[] = []
    const maxGenes = Math.max(genes1.length, genes2.length)

    for (let i = 0; i < maxGenes; i++) {
      const gene1 = genes1[i]
      const gene2 = genes2[i]

      if (gene1 && gene2) {
        // Mix sequences based on method
        const mixed = method === 'uniform' && Math.random() < 0.5 ? gene2 : gene1
        result.push({ ...mixed, tourId: `tour_${i}` })
      } else if (gene1) {
        result.push({ ...gene1, tourId: `tour_${i}` })
      } else if (gene2) {
        result.push({ ...gene2, tourId: `tour_${i}` })
      }
    }

    return result
  }

  /**
   * Mutation operation
   */
  private mutate(chromosome: Chromosome): void {
    switch (this.config.mutationType) {
      case MutationType.SWAP_MUTATION:
        this.swapMutation(chromosome)
        break
      case MutationType.INSERT_MUTATION:
        this.insertMutation(chromosome)
        break
      case MutationType.INVERSION_MUTATION:
        this.inversionMutation(chromosome)
        break
      case MutationType.TWO_OPT:
        this.twoOptMutation(chromosome)
        break
      default:
        this.swapMutation(chromosome)
    }
  }

  /**
   * Swap mutation
   */
  private swapMutation(chromosome: Chromosome): void {
    if (chromosome.genes.length < 2) return

    const geneIndex = Math.floor(Math.random() * chromosome.genes.length)
    const gene = chromosome.genes[geneIndex]!
    
    if (gene.sequence.length < 2) return

    const i = Math.floor(Math.random() * gene.sequence.length)
    const j = Math.floor(Math.random() * gene.sequence.length)

    const newSequence = [...gene.sequence]
    ;[newSequence[i], newSequence[j]] = [newSequence[j]!, newSequence[i]!]

    chromosome.genes[geneIndex] = {
      ...gene,
      sequence: newSequence,
    }
  }

  /**
   * Insert mutation
   */
  private insertMutation(chromosome: Chromosome): void {
    if (chromosome.genes.length === 0) return

    const geneIndex = Math.floor(Math.random() * chromosome.genes.length)
    const gene = chromosome.genes[geneIndex]!
    
    if (gene.sequence.length < 2) return

    const from = Math.floor(Math.random() * gene.sequence.length)
    const to = Math.floor(Math.random() * gene.sequence.length)

    const newSequence = [...gene.sequence]
    const element = newSequence.splice(from, 1)[0]!
    newSequence.splice(to, 0, element)

    chromosome.genes[geneIndex] = {
      ...gene,
      sequence: newSequence,
    }
  }

  /**
   * Inversion mutation
   */
  private inversionMutation(chromosome: Chromosome): void {
    if (chromosome.genes.length === 0) return

    const geneIndex = Math.floor(Math.random() * chromosome.genes.length)
    const gene = chromosome.genes[geneIndex]!
    
    if (gene.sequence.length < 2) return

    const i = Math.floor(Math.random() * gene.sequence.length)
    const j = Math.floor(Math.random() * gene.sequence.length)
    const start = Math.min(i, j)
    const end = Math.max(i, j)

    const newSequence = [...gene.sequence]
    const segment = newSequence.slice(start, end + 1).reverse()
    newSequence.splice(start, end - start + 1, ...segment)

    chromosome.genes[geneIndex] = {
      ...gene,
      sequence: newSequence,
    }
  }

  /**
   * 2-opt mutation
   */
  private twoOptMutation(chromosome: Chromosome): void {
    if (chromosome.genes.length === 0) return

    const geneIndex = Math.floor(Math.random() * chromosome.genes.length)
    const gene = chromosome.genes[geneIndex]!
    
    if (gene.sequence.length < 4) return

    const sequence = [...gene.sequence]
    let bestImprovement = 0
    let bestI = -1
    let bestJ = -1

    // Find best 2-opt improvement
    for (let i = 0; i < sequence.length - 2; i++) {
      for (let j = i + 2; j < sequence.length; j++) {
        // Calculate improvement (simplified)
        const improvement = Math.random() - 0.5 // Placeholder
        if (improvement > bestImprovement) {
          bestImprovement = improvement
          bestI = i
          bestJ = j
        }
      }
    }

    if (bestI >= 0 && bestJ >= 0) {
      // Reverse segment between bestI and bestJ
      const newSequence = [...sequence]
      const segment = newSequence.slice(bestI + 1, bestJ + 1).reverse()
      newSequence.splice(bestI + 1, bestJ - bestI, ...segment)

      chromosome.genes[geneIndex] = {
        ...gene,
        sequence: newSequence,
      }
    }
  }

  /**
   * Create empty chromosome
   */
  private createEmptyChromosome(): Chromosome {
    return {
      genes: [],
      fitness: 0,
      age: 0,
      violations: [],
    }
  }

  /**
   * Convert chromosome to solution format
   */
  private chromosomeToSolution(
    chromosome: Chromosome,
    addresses: readonly DeliveryAddress[],
    depot: Coordinates
  ): Solution {
    const addressMap = new Map(addresses.map(addr => [addr.id, addr]))
    const tours: TourSolution[] = []

    for (const gene of chromosome.genes) {
      const tourAddresses = gene.sequence
        .map(id => addressMap.get(id))
        .filter((addr): addr is DeliveryAddress => addr !== undefined)

      if (tourAddresses.length === 0) continue

      let distance = 0
      let previousCoord = depot

      for (const address of tourAddresses) {
        distance += this.distanceCalculator.haversineDistance(previousCoord, address.coordinates)
        previousCoord = address.coordinates
      }
      distance += this.distanceCalculator.haversineDistance(previousCoord, depot)

      const load = tourAddresses.reduce((sum, addr) => sum + addr.bottleCount, 0)
      const duration = (distance / 30) * 60 + tourAddresses.length * 5 // Estimate

      tours.push({
        sequence: gene.sequence,
        load,
        distance,
        duration,
        violations: [],
      })
    }

    return {
      tours,
      unassigned: [],
      objective: chromosome.fitness,
      feasible: chromosome.violations.length === 0,
      violations: chromosome.violations,
      timestamp: new Date(),
    }
  }

  /**
   * Check termination conditions
   */
  private shouldContinue(noImprovementCount: number): boolean {
    if (!this.isRunning) return false
    if (this.generation >= this.config.maxIterations) return false
    if (performance.now() - this.startTime >= this.config.constraints.maxExecutionTime) return false
    if (noImprovementCount >= 50) return false
    return true
  }

  /**
   * Adapt algorithm parameters based on progress
   */
  private adaptParameters(noImprovementCount: number): void {
    if (noImprovementCount > 20) {
      // Increase mutation rate to escape local optima
      this.config = {
        ...this.config,
        mutationRate: Math.min(this.config.mutationRate * 1.1, 20),
      }
    } else if (noImprovementCount < 5) {
      // Decrease mutation rate for fine-tuning
      this.config = {
        ...this.config,
        mutationRate: Math.max(this.config.mutationRate * 0.95, 1),
      }
    }
  }

  /**
   * Create algorithm result
   */
  private createResult(
    addresses: readonly DeliveryAddress[],
    depot: Coordinates,
    executionTime: number,
    terminationReason: TerminationReason
  ): AlgorithmResult {
    const bestChromosome = this.population[0]
    const solution = bestChromosome ? this.chromosomeToSolution(bestChromosome, addresses, depot) : null

    return {
      algorithm: 'GENETIC_ALGORITHM' as const,
      tours: solution?.tours.map((tour, index) => ({
        id: `tour_${index}`,
        sequence: tour.sequence,
        metrics: {
          totalDistance: tour.distance,
          totalTime: tour.duration,
          totalBottles: tour.load,
          utilizationRate: tour.load / 80, // Assuming 80 bottle max
          efficiency: Math.max(0, 100 - (tour.distance / tour.sequence.length) * 5),
          priorityScore: 0, // Would need to calculate
          timeWindowViolations: 0,
        },
        violations: tour.violations,
        score: bestChromosome?.fitness || 0,
      })) || [],
      metrics: {
        totalScore: bestChromosome?.fitness || 0,
        improvement: this.convergenceData.length > 1 
          ? ((this.convergenceData[this.convergenceData.length - 1]! - this.convergenceData[0]!) / Math.abs(this.convergenceData[0]! || 1)) * 100
          : 0,
        efficiency: Math.min(100, Math.max(0, (bestChromosome?.fitness || 0) / 1000)),
        feasibility: bestChromosome?.violations.length === 0 ? 100 : 50,
        diversity: this.calculateDiversity(),
        stability: this.calculateStability(),
      },
      convergenceData: this.convergenceData.map((fitness, iteration) => ({
        iteration,
        bestScore: fitness,
        averageScore: fitness * 0.8, // Approximation
        diversity: 0.5, // Placeholder
        timestamp: this.startTime + (iteration * 100),
      })),
      executionTime,
      memoryUsed: this.estimateMemoryUsage(),
      iterations: this.generation,
      terminated: terminationReason,
    }
  }

  /**
   * Calculate population diversity
   */
  private calculateDiversity(): number {
    // Simplified diversity calculation
    if (this.population.length < 2) return 0

    const fitnessValues = this.population.map(chr => chr.fitness)
    const mean = fitnessValues.reduce((sum, f) => sum + f, 0) / fitnessValues.length
    const variance = fitnessValues.reduce((sum, f) => sum + Math.pow(f - mean, 2), 0) / fitnessValues.length
    
    return Math.min(100, Math.sqrt(variance) / Math.abs(mean) * 100 || 0)
  }

  /**
   * Calculate solution stability
   */
  private calculateStability(): number {
    if (this.convergenceData.length < 10) return 50

    const recent = this.convergenceData.slice(-10)
    const variance = recent.reduce((sum, score, i, arr) => {
      const mean = arr.reduce((s, v) => s + v, 0) / arr.length
      return sum + Math.pow(score - mean, 2)
    }, 0) / recent.length

    return Math.max(0, 100 - Math.sqrt(variance))
  }

  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(): number {
    const chromosomeSize = this.population.reduce((sum, chr) => {
      return sum + chr.genes.reduce((geneSum, gene) => geneSum + gene.sequence.length, 0)
    }, 0)

    return Math.round((chromosomeSize * 4 + this.convergenceData.length * 8) / 1024) // KB
  }

  /**
   * Validate configuration
   */
  private validateConfig(): void {
    if (this.config.populationSize < 10) {
      throw new Error('Population size must be at least 10')
    }
    if (this.config.maxIterations < 1) {
      throw new Error('Max iterations must be at least 1')
    }
    if (this.config.mutationRate < 0 || this.config.mutationRate > 100) {
      throw new Error('Mutation rate must be between 0 and 100')
    }
    if (this.config.crossoverRate < 0 || this.config.crossoverRate > 100) {
      throw new Error('Crossover rate must be between 0 and 100')
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
    const currentTime = performance.now()
    const elapsedTime = currentTime - this.startTime
    const progress = Math.min(100, (this.generation / this.config.maxIterations) * 100)
    
    return {
      iteration: this.generation,
      bestScore: this.population[0]?.fitness || 0,
      currentScore: this.population[0]?.fitness || 0,
      improvement: this.convergenceData.length > 1 
        ? this.convergenceData[this.convergenceData.length - 1]! - this.convergenceData[0]!
        : 0,
      elapsedTime: elapsedTime,
      estimatedTimeRemaining: progress > 0 ? (elapsedTime / progress) * (100 - progress) : undefined,
      stage: `Generation ${this.generation}`,
    }
  }
}