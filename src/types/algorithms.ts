/**
 * Algorithm-specific types for route optimization
 * Comprehensive type definitions for all optimization algorithms
 */

import type {
  DeliveryAddress,
  Coordinates,
  VehicleConstraints,
  OptimizationObjective,
  OptimizationAlgorithm,
  Priority
} from './core'

// Base algorithm types
export interface AlgorithmConfig {
  readonly name: string
  readonly version: string
  readonly parameters: Record<string, unknown>
  readonly constraints: AlgorithmConstraints
  readonly objectives: readonly OptimizationObjective[]
}

export interface AlgorithmConstraints {
  readonly maxExecutionTime: number // milliseconds
  readonly maxIterations: number
  readonly maxMemoryUsage: number // MB
  readonly convergenceThreshold: number
  readonly minImprovement: number // percentage
}

export interface AlgorithmResult {
  readonly algorithm: OptimizationAlgorithm
  readonly tours: readonly OptimizedTourResult[]
  readonly metrics: AlgorithmMetrics
  readonly convergenceData: readonly ConvergencePoint[]
  readonly executionTime: number
  readonly memoryUsed: number
  readonly iterations: number
  readonly terminated: TerminationReason
}

export interface OptimizedTourResult {
  readonly id: string
  readonly sequence: readonly string[] // address IDs
  readonly metrics: TourMetrics
  readonly violations: readonly ConstraintViolation[]
  readonly score: number
}

export interface TourMetrics {
  readonly totalDistance: number
  readonly totalTime: number
  readonly totalBottles: number
  readonly utilizationRate: number
  readonly efficiency: number
  readonly priorityScore: number
  readonly timeWindowViolations: number
}

export interface ConvergencePoint {
  readonly iteration: number
  readonly bestScore: number
  readonly averageScore: number
  readonly diversity: number
  readonly timestamp: number
}

export enum TerminationReason {
  MAX_ITERATIONS = 'max_iterations',
  TIME_LIMIT = 'time_limit',
  CONVERGENCE = 'convergence',
  NO_IMPROVEMENT = 'no_improvement',
  MEMORY_LIMIT = 'memory_limit',
  USER_INTERRUPTED = 'user_interrupted',
  ERROR = 'error',
}

export interface AlgorithmMetrics {
  readonly totalScore: number
  readonly improvement: number
  readonly efficiency: number
  readonly feasibility: number
  readonly diversity: number
  readonly stability: number
}

// Genetic Algorithm types
export interface GeneticAlgorithmConfig extends AlgorithmConfig {
  readonly populationSize: number
  readonly eliteSize: number
  readonly mutationRate: number
  readonly crossoverRate: number
  readonly tournamentSize: number
  readonly crossoverType: CrossoverType
  readonly mutationType: MutationType
  readonly selectionType: SelectionType
  readonly diversityMaintenance: boolean
  readonly adaptiveRates: boolean
}

export enum CrossoverType {
  ORDER_CROSSOVER = 'order_crossover',
  PARTIALLY_MAPPED = 'partially_mapped',
  CYCLE_CROSSOVER = 'cycle_crossover',
  EDGE_RECOMBINATION = 'edge_recombination',
  TWO_POINT = 'two_point',
  UNIFORM = 'uniform',
}

export enum MutationType {
  SWAP_MUTATION = 'swap_mutation',
  INSERT_MUTATION = 'insert_mutation',
  INVERSION_MUTATION = 'inversion_mutation',
  SCRAMBLE_MUTATION = 'scramble_mutation',
  TWO_OPT = 'two_opt',
  THREE_OPT = 'three_opt',
}

export enum SelectionType {
  TOURNAMENT = 'tournament',
  ROULETTE_WHEEL = 'roulette_wheel',
  RANK_BASED = 'rank_based',
  ELITE = 'elite',
  RANDOM = 'random',
}

export interface Chromosome {
  genes: Gene[]
  fitness: number
  age: number
  violations: ConstraintViolation[]
}

export interface Gene {
  tourId: string
  sequence: string[]
  fitness: number
}

// Simulated Annealing types
export interface SimulatedAnnealingConfig extends AlgorithmConfig {
  readonly initialTemperature: number
  readonly finalTemperature: number
  readonly coolingRate: number
  readonly coolingSchedule: CoolingSchedule
  readonly maxIterationsAtTemperature: number
  readonly minAcceptanceRate: number
  readonly reheatThreshold: number
}

export enum CoolingSchedule {
  LINEAR = 'linear',
  EXPONENTIAL = 'exponential',
  LOGARITHMIC = 'logarithmic',
  ADAPTIVE = 'adaptive',
  CAUCHY = 'cauchy',
}

export interface AnnealingState {
  readonly currentSolution: Solution
  readonly bestSolution: Solution
  readonly temperature: number
  readonly iteration: number
  readonly acceptanceRate: number
  readonly lastImprovementIteration: number
}

// Ant Colony Optimization types
export interface AntColonyConfig extends AlgorithmConfig {
  readonly antCount: number
  readonly alpha: number // pheromone importance
  readonly beta: number // heuristic importance
  readonly rho: number // evaporation rate
  readonly q: number // pheromone deposit amount
  readonly pheromoneMin: number
  readonly pheromoneMax: number
  readonly elitistAnts: number
}

export interface PheromoneMatrix {
  readonly matrix: readonly (readonly number[])[]
  readonly size: number
  readonly lastUpdate: number
}

export interface Ant {
  readonly id: string
  readonly currentLocation: string
  readonly visitedLocations: readonly string[]
  readonly currentTour: readonly string[]
  readonly totalDistance: number
  readonly isComplete: boolean
}

// Particle Swarm Optimization types
export interface ParticleSwarmConfig extends AlgorithmConfig {
  readonly swarmSize: number
  readonly inertiaWeight: number
  readonly cognitiveWeight: number
  readonly socialWeight: number
  readonly maxVelocity: number
  readonly neighborhoodSize: number
  readonly topologyType: TopologyType
}

export enum TopologyType {
  GLOBAL = 'global',
  LOCAL = 'local',
  RING = 'ring',
  STAR = 'star',
  SMALL_WORLD = 'small_world',
}

export interface Particle {
  readonly id: string
  readonly position: Solution
  readonly velocity: readonly number[]
  readonly personalBest: Solution
  readonly fitness: number
  readonly personalBestFitness: number
}

// Clarke-Wright Algorithm types
export interface ClarkeWrightConfig extends AlgorithmConfig {
  readonly savingsType: SavingsType
  readonly routeShapeParameter: number
  readonly capacityPenalty: number
  readonly timePenalty: number
  readonly parallelConstruction: boolean
}

export enum SavingsType {
  STANDARD = 'standard',
  PARAMETRIC = 'parametric',
  GENERALIZED = 'generalized',
}

export interface SavingsPair {
  readonly fromAddress: string
  readonly toAddress: string
  readonly savings: number
  readonly feasible: boolean
  readonly violations: readonly string[]
}

// OR-Tools integration types
export interface OrToolsConfig extends AlgorithmConfig {
  readonly solverType: OrToolsSolver
  readonly timeLimit: number
  readonly solutionLimit: number
  readonly searchStrategy: SearchStrategy
  readonly improvementLimit: number
  readonly localSearchMetaheuristic: LocalSearchMetaheuristic
}

export enum OrToolsSolver {
  ROUTING = 'routing',
  CP_SAT = 'cp_sat',
  SCIP = 'scip',
  GUROBI = 'gurobi',
}

export enum SearchStrategy {
  AUTOMATIC = 'automatic',
  FIRST_UNBOUND_MIN_VALUE = 'first_unbound_min_value',
  PATH_CHEAPEST_ARC = 'path_cheapest_arc',
  PATH_MOST_CONSTRAINED_ARC = 'path_most_constrained_arc',
  EVALUATOR_STRATEGY = 'evaluator_strategy',
}

export enum LocalSearchMetaheuristic {
  GUIDED_LOCAL_SEARCH = 'guided_local_search',
  SIMULATED_ANNEALING = 'simulated_annealing',
  TABU_SEARCH = 'tabu_search',
  GENERIC_TABU_SEARCH = 'generic_tabu_search',
}

// Distance matrix and routing types
export interface DistanceMatrix {
  readonly origins: readonly Coordinates[]
  readonly destinations: readonly Coordinates[]
  readonly distances: readonly (readonly number[])[] // kilometers
  readonly durations: readonly (readonly number[])[] // minutes
  readonly provider: string
  readonly timestamp: Date
  readonly cached: boolean
}

export interface RouteSegment {
  readonly from: string
  readonly to: string
  readonly distance: number
  readonly duration: number
  readonly geometry?: readonly Coordinates[]
  readonly instructions?: readonly RouteInstruction[]
}

export interface RouteInstruction {
  readonly text: string
  readonly distance: number
  readonly duration: number
  readonly maneuver: string
  readonly direction?: number
}

// Solution representation types
export interface Solution {
  readonly tours: readonly TourSolution[]
  readonly unassigned: readonly string[]
  readonly objective: number
  readonly feasible: boolean
  readonly violations: readonly ConstraintViolation[]
  readonly timestamp: Date
}

export interface TourSolution {
  readonly vehicleId?: string
  readonly sequence: readonly string[]
  readonly load: number
  readonly duration: number
  readonly distance: number
  readonly startTime?: Date
  readonly endTime?: Date
  readonly violations: readonly ConstraintViolation[]
}

export interface ConstraintViolation {
  readonly type: ViolationType
  readonly severity: ViolationSeverity
  readonly description: string
  readonly addressId?: string
  readonly tourId?: string
  readonly value?: number
  readonly limit?: number
}

export enum ViolationType {
  CAPACITY_EXCEEDED = 'capacity_exceeded',
  TIME_WINDOW_VIOLATED = 'time_window_violated',
  MAX_DURATION_EXCEEDED = 'max_duration_exceeded',
  MAX_DISTANCE_EXCEEDED = 'max_distance_exceeded',
  MAX_STOPS_EXCEEDED = 'max_stops_exceeded',
  DRIVER_HOURS_EXCEEDED = 'driver_hours_exceeded',
  VEHICLE_RESTRICTION = 'vehicle_restriction',
  PRIORITY_VIOLATION = 'priority_violation',
  ACCESS_RESTRICTION = 'access_restriction',
}

export enum ViolationSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

// Neighborhood search and improvement types
export interface NeighborhoodOperator {
  readonly name: string
  readonly apply: (solution: Solution) => Solution[]
  readonly complexity: OperatorComplexity
  readonly effectiveness: number
}

export enum OperatorComplexity {
  O_1 = 'O(1)',
  O_N = 'O(n)',
  O_N2 = 'O(n²)',
  O_N3 = 'O(n³)',
  O_NlogN = 'O(n log n)',
}

export interface TwoOptMove {
  readonly tourIndex: number
  readonly i: number
  readonly j: number
  readonly improvement: number
}

export interface ThreeOptMove {
  readonly tourIndex: number
  readonly i: number
  readonly j: number
  readonly k: number
  readonly improvement: number
  readonly type: ThreeOptType
}

export enum ThreeOptType {
  CASE_1 = 'case_1', // ABC -> ACB
  CASE_2 = 'case_2', // ABC -> BAC
  CASE_3 = 'case_3', // ABC -> BCA
  CASE_4 = 'case_4', // ABC -> CAB
  CASE_5 = 'case_5', // ABC -> CBA
  CASE_6 = 'case_6', // ABC -> ACB
  CASE_7 = 'case_7', // ABC -> BAC (reversed)
}

export interface OrOptMove {
  readonly sourceTour: number
  readonly targetTour: number
  readonly sequenceStart: number
  readonly sequenceLength: number
  readonly insertPosition: number
  readonly improvement: number
}

export interface CrossExchangeMove {
  readonly tour1: number
  readonly tour2: number
  readonly segment1Start: number
  readonly segment1Length: number
  readonly segment2Start: number
  readonly segment2Length: number
  readonly improvement: number
}

// Multi-objective optimization types
export interface MultiObjectiveConfig extends AlgorithmConfig {
  readonly objectives: readonly ObjectiveFunction[]
  readonly weights: readonly number[]
  readonly method: MultiObjectiveMethod
  readonly paretoFrontSize: number
  readonly diversityMaintenance: boolean
}

export enum MultiObjectiveMethod {
  WEIGHTED_SUM = 'weighted_sum',
  PARETO_DOMINANCE = 'pareto_dominance',
  EPSILON_CONSTRAINT = 'epsilon_constraint',
  NSGA_II = 'nsga_ii',
  SPEA2 = 'spea2',
}

export interface ObjectiveFunction {
  readonly name: string
  readonly weight: number
  readonly minimize: boolean
  readonly evaluate: (solution: Solution) => number
  readonly normalize: boolean
  readonly range?: [number, number]
}

export interface ParetoSolution {
  readonly solution: Solution
  readonly objectives: readonly number[]
  readonly rank: number
  readonly crowdingDistance: number
  readonly dominates: readonly string[]
  readonly dominatedBy: readonly string[]
}

// Heuristic and meta-heuristic types
export interface ConstructiveHeuristic {
  readonly name: string
  readonly construct: (addresses: readonly DeliveryAddress[]) => Solution
  readonly timeComplexity: OperatorComplexity
  readonly spaceComplexity: OperatorComplexity
}

export interface ImprovementHeuristic {
  readonly name: string
  readonly improve: (solution: Solution) => Solution
  readonly operators: readonly NeighborhoodOperator[]
  readonly stopCriteria: readonly StopCriterion[]
}

export interface StopCriterion {
  readonly name: string
  readonly check: (state: SearchState) => boolean
  readonly description: string
}

export interface SearchState {
  readonly currentSolution: Solution
  readonly bestSolution: Solution
  readonly iteration: number
  readonly startTime: number
  readonly lastImprovement: number
  readonly noImprovementCount: number
  readonly temperature?: number
  readonly diversity?: number
}

// Performance and benchmarking types
export interface BenchmarkResult {
  readonly algorithm: OptimizationAlgorithm
  readonly instanceName: string
  readonly bestKnownSolution?: number
  readonly foundSolution: number
  readonly gap: number // percentage
  readonly executionTime: number
  readonly iterations: number
  readonly memoryUsage: number
  readonly convergenceRate: number
}

export interface AlgorithmComparison {
  readonly instances: readonly BenchmarkInstance[]
  readonly results: readonly BenchmarkResult[]
  readonly statistics: ComparisonStatistics
}

export interface BenchmarkInstance {
  readonly name: string
  readonly addressCount: number
  readonly vehicleCount: number
  readonly constraints: readonly string[]
  readonly difficulty: InstanceDifficulty
  readonly bestKnownSolution?: number
}

export enum InstanceDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
  VERY_HARD = 'very_hard',
}

export interface ComparisonStatistics {
  readonly averageGap: number
  readonly averageTime: number
  readonly winRate: number
  readonly reliability: number
  readonly scalability: number
}

// Real-time optimization types
export interface RealTimeUpdate {
  readonly type: UpdateType
  readonly addressId?: string
  readonly tourId?: string
  readonly data: unknown
  readonly timestamp: Date
  readonly priority: Priority
}

export enum UpdateType {
  ADDRESS_ADDED = 'address_added',
  ADDRESS_REMOVED = 'address_removed',
  ADDRESS_MODIFIED = 'address_modified',
  DELIVERY_COMPLETED = 'delivery_completed',
  TRAFFIC_UPDATE = 'traffic_update',
  VEHICLE_BREAKDOWN = 'vehicle_breakdown',
  DRIVER_UNAVAILABLE = 'driver_unavailable',
  EMERGENCY_DELIVERY = 'emergency_delivery',
}

export interface ReoptimizationTrigger {
  readonly condition: TriggerCondition
  readonly threshold: number
  readonly cooldownPeriod: number
  readonly enabled: boolean
}

export enum TriggerCondition {
  ADDRESS_COUNT_CHANGED = 'address_count_changed',
  DELIVERY_DELAY = 'delivery_delay',
  TRAFFIC_CONGESTION = 'traffic_congestion',
  VEHICLE_BREAKDOWN = 'vehicle_breakdown',
  TIME_THRESHOLD = 'time_threshold',
  EFFICIENCY_DROP = 'efficiency_drop',
}

// Machine learning and prediction types
export interface MLModel {
  readonly name: string
  readonly version: string
  readonly type: MLModelType
  readonly features: readonly string[]
  readonly accuracy: number
  readonly trainedAt: Date
  readonly parameters: Record<string, unknown>
}

export enum MLModelType {
  REGRESSION = 'regression',
  CLASSIFICATION = 'classification',
  TIME_SERIES = 'time_series',
  REINFORCEMENT = 'reinforcement',
  NEURAL_NETWORK = 'neural_network',
}

export interface DeliveryTimePrediction {
  readonly addressId: string
  readonly predictedDuration: number
  readonly confidence: number
  readonly factors: readonly PredictionFactor[]
  readonly historicalAverage?: number
}

export interface PredictionFactor {
  readonly name: string
  readonly impact: number
  readonly confidence: number
  readonly description: string
}

export interface TrafficPrediction {
  readonly segment: RouteSegment
  readonly predictedDelay: number
  readonly confidence: number
  readonly timeHorizon: number
  readonly conditions: readonly string[]
}

// Algorithm factory and registry types
export interface AlgorithmFactory {
  readonly create: (config: AlgorithmConfig) => OptimizationAlgorithmInstance
  readonly supports: (config: AlgorithmConfig) => boolean
  readonly defaultConfig: AlgorithmConfig
  readonly description: string
  readonly complexity: OperatorComplexity
}

export interface OptimizationAlgorithmInstance {
  readonly solve: (problem: OptimizationProblem) => Promise<AlgorithmResult>
  readonly interrupt: () => void
  readonly getProgress: () => OptimizationProgress
  readonly getName: () => string
  readonly getConfig: () => AlgorithmConfig
}

export interface OptimizationProblem {
  readonly addresses: readonly DeliveryAddress[]
  readonly depot: Coordinates
  readonly constraints: VehicleConstraints
  readonly objectives: readonly OptimizationObjective[]
  readonly distanceMatrix?: DistanceMatrix
  readonly timeMatrix?: DistanceMatrix
}

export interface OptimizationProgress {
  readonly iteration: number
  readonly bestScore: number
  readonly currentScore: number
  readonly improvement: number
  readonly elapsedTime: number
  readonly estimatedTimeRemaining?: number
  readonly stage: string
}