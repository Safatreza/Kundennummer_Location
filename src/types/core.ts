/**
 * Core types for the AboutWater Route Optimization System
 * Enterprise-grade type definitions with comprehensive validation
 */

// Geographic types
export interface Coordinates {
  readonly lat: number
  readonly lng: number
}

export interface BoundingBox {
  readonly north: number
  readonly south: number
  readonly east: number
  readonly west: number
}

// Priority system
export enum Priority {
  CRITICAL = 1,
  HIGH = 2,
  MEDIUM = 3,
  LOW = 4,
  STANDARD = 5,
}

export const PRIORITY_LABELS = {
  [Priority.CRITICAL]: 'Critical',
  [Priority.HIGH]: 'High',
  [Priority.MEDIUM]: 'Medium',
  [Priority.LOW]: 'Low',
  [Priority.STANDARD]: 'Standard',
} as const

// Time window constraints
export interface TimeWindow {
  readonly start: Date
  readonly end: Date
  readonly isFlexible: boolean
  readonly notes?: string
}

// Vehicle constraints
export interface VehicleConstraints {
  readonly maxBottles: number
  readonly maxWeight: number
  readonly maxVolume: number
  readonly maxStops: number
  readonly maxDuration: number // in minutes
  readonly fuelEfficiency?: number
  readonly restrictions: readonly VehicleRestriction[]
}

export enum VehicleRestriction {
  NO_HIGHWAYS = 'no_highways',
  AVOID_TOLLS = 'avoid_tolls',
  TRUCK_ROUTE_ONLY = 'truck_route_only',
  HEIGHT_RESTRICTION = 'height_restriction',
  WEIGHT_RESTRICTION = 'weight_restriction',
  HAZMAT_PROHIBITED = 'hazmat_prohibited',
}

// Address and delivery types
export interface DeliveryAddress {
  readonly id: string
  readonly address: string
  readonly coordinates: Coordinates
  readonly deliveryId: string
  readonly bottleCount: number
  readonly weight?: number
  readonly priority: Priority
  readonly timeWindow?: TimeWindow
  readonly customerNotes?: string
  readonly accessInstructions?: string
  readonly contactInfo?: ContactInfo
  readonly addressType: AddressType
  readonly isValidated: boolean
  readonly validationTimestamp?: Date
  readonly geocodeAccuracy?: number
  readonly estimatedDuration: number // minutes
  readonly deliveryHistory: readonly DeliveryRecord[]
  readonly tags: readonly string[]
  readonly metadata: Record<string, unknown>
}

export enum AddressType {
  RESIDENTIAL = 'residential',
  COMMERCIAL = 'commercial',
  OFFICE = 'office',
  WAREHOUSE = 'warehouse',
  CONSTRUCTION = 'construction',
  MEDICAL = 'medical',
  EMERGENCY = 'emergency',
}

export interface ContactInfo {
  readonly name?: string
  readonly phone?: string
  readonly email?: string
  readonly alternateContact?: string
  readonly preferredContactMethod: ContactMethod
}

export enum ContactMethod {
  PHONE = 'phone',
  EMAIL = 'email',
  SMS = 'sms',
  WHATSAPP = 'whatsapp',
  NONE = 'none',
}

// Delivery history and tracking
export interface DeliveryRecord {
  readonly id: string
  readonly deliveryDate: Date
  readonly completedAt?: Date
  readonly driverId: string
  readonly vehicleId: string
  readonly status: DeliveryStatus
  readonly bottlesDelivered: number
  readonly notes?: string
  readonly signature?: string
  readonly photoUrl?: string
  readonly rating?: number
  readonly issues: readonly DeliveryIssue[]
}

export enum DeliveryStatus {
  PENDING = 'pending',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  RESCHEDULED = 'rescheduled',
}

export interface DeliveryIssue {
  readonly type: IssueType
  readonly description: string
  readonly severity: IssueSeverity
  readonly reportedAt: Date
  readonly resolvedAt?: Date
}

export enum IssueType {
  ACCESS_DENIED = 'access_denied',
  CUSTOMER_NOT_AVAILABLE = 'customer_not_available',
  ADDRESS_NOT_FOUND = 'address_not_found',
  VEHICLE_BREAKDOWN = 'vehicle_breakdown',
  TRAFFIC_DELAY = 'traffic_delay',
  WEATHER = 'weather',
  SECURITY_CONCERN = 'security_concern',
  QUALITY_ISSUE = 'quality_issue',
  OTHER = 'other',
}

export enum IssueSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Tour and route optimization
export interface OptimizedTour {
  readonly id: string
  readonly name: string
  readonly addresses: readonly DeliveryAddress[]
  readonly sequence: readonly string[] // address IDs in order
  readonly totalBottles: number
  readonly totalWeight: number
  readonly estimatedDistance: number // kilometers
  readonly estimatedDuration: number // minutes
  readonly actualDistance?: number
  readonly actualDuration?: number
  readonly vehicleConstraints: VehicleConstraints
  readonly driver?: DriverInfo
  readonly vehicle?: VehicleInfo
  readonly status: TourStatus
  readonly createdAt: Date
  readonly optimizedAt: Date
  readonly metadata: TourMetadata
  readonly routeGeometry?: RouteGeometry
  readonly refillStops: readonly RefillStop[]
  readonly metrics: TourMetrics
}

export enum TourStatus {
  PLANNED = 'planned',
  OPTIMIZING = 'optimizing',
  OPTIMIZED = 'optimized',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export interface TourMetadata {
  readonly optimizationAlgorithm: string
  readonly optimizationTime: number // milliseconds
  readonly iterationsPerformed: number
  readonly improvementPercentage: number
  readonly constraints: readonly string[]
  readonly warnings: readonly string[]
  readonly version: string
}

export interface RouteGeometry {
  readonly coordinates: readonly Coordinates[]
  readonly encodedPolyline?: string
  readonly bounds: BoundingBox
}

export interface RefillStop {
  readonly id: string
  readonly location: Coordinates
  readonly address: string
  readonly capacity: number
  readonly estimatedTime: number
  readonly sequence: number
}

export interface TourMetrics {
  readonly efficiency: number // 0-100
  readonly loadUtilization: number // 0-100
  readonly timeUtilization: number // 0-100
  readonly fuelEstimate?: number
  readonly carbonFootprint?: number
  readonly cost?: number
}

// Driver and vehicle management
export interface DriverInfo {
  readonly id: string
  readonly name: string
  readonly licenseNumber: string
  readonly phone: string
  readonly email?: string
  readonly experience: number // years
  readonly rating: number // 0-5
  readonly availability: DriverAvailability
  readonly skills: readonly DriverSkill[]
  readonly workingHours: WorkingHours
  readonly currentLocation?: Coordinates
}

export interface DriverAvailability {
  readonly isAvailable: boolean
  readonly availableFrom?: Date
  readonly availableUntil?: Date
  readonly timeZone: string
}

export enum DriverSkill {
  COMMERCIAL_LICENSE = 'commercial_license',
  HAZMAT = 'hazmat',
  FORKLIFT = 'forklift',
  MULTILINGUAL = 'multilingual',
  CUSTOMER_SERVICE = 'customer_service',
  HEAVY_LIFTING = 'heavy_lifting',
  NAVIGATION = 'navigation',
}

export interface WorkingHours {
  readonly monday?: TimeSlot
  readonly tuesday?: TimeSlot
  readonly wednesday?: TimeSlot
  readonly thursday?: TimeSlot
  readonly friday?: TimeSlot
  readonly saturday?: TimeSlot
  readonly sunday?: TimeSlot
  readonly breakDuration: number // minutes
  readonly maxDailyHours: number
  readonly maxWeeklyHours: number
}

export interface TimeSlot {
  readonly start: string // HH:MM format
  readonly end: string // HH:MM format
}

export interface VehicleInfo {
  readonly id: string
  readonly make: string
  readonly model: string
  readonly year: number
  readonly licensePlate: string
  readonly vin?: string
  readonly type: VehicleType
  readonly capacity: VehicleConstraints
  readonly fuelType: FuelType
  readonly status: VehicleStatus
  readonly location?: Coordinates
  readonly lastMaintenance?: Date
  readonly nextMaintenance?: Date
  readonly insurance?: InsuranceInfo
}

export enum VehicleType {
  VAN = 'van',
  TRUCK = 'truck',
  PICKUP = 'pickup',
  SEMI = 'semi',
  MOTORCYCLE = 'motorcycle',
  BICYCLE = 'bicycle',
  ELECTRIC = 'electric',
}

export enum FuelType {
  GASOLINE = 'gasoline',
  DIESEL = 'diesel',
  ELECTRIC = 'electric',
  HYBRID = 'hybrid',
  CNG = 'cng',
  LPG = 'lpg',
}

export enum VehicleStatus {
  AVAILABLE = 'available',
  IN_USE = 'in_use',
  MAINTENANCE = 'maintenance',
  OUT_OF_SERVICE = 'out_of_service',
  FUELING = 'fueling',
}

export interface InsuranceInfo {
  readonly provider: string
  readonly policyNumber: string
  readonly expirationDate: Date
  readonly coverage: readonly string[]
}

// Optimization parameters and results
export interface OptimizationParameters {
  readonly algorithm: OptimizationAlgorithm
  readonly objectives: readonly OptimizationObjective[]
  readonly constraints: OptimizationConstraints
  readonly maxIterations: number
  readonly timeLimit: number // seconds
  readonly populationSize?: number
  readonly mutationRate?: number
  readonly crossoverRate?: number
  readonly elitismRate?: number
  readonly convergenceThreshold: number
  readonly parallelization: boolean
}

export enum OptimizationAlgorithm {
  GENETIC_ALGORITHM = 'genetic_algorithm',
  SIMULATED_ANNEALING = 'simulated_annealing',
  ANT_COLONY = 'ant_colony',
  PARTICLE_SWARM = 'particle_swarm',
  GREEDY_NEAREST = 'greedy_nearest',
  CLARKE_WRIGHT = 'clarke_wright',
  OR_TOOLS = 'or_tools',
  HYBRID = 'hybrid',
}

export enum OptimizationObjective {
  MINIMIZE_DISTANCE = 'minimize_distance',
  MINIMIZE_TIME = 'minimize_time',
  MINIMIZE_FUEL = 'minimize_fuel',
  MINIMIZE_COST = 'minimize_cost',
  MAXIMIZE_EFFICIENCY = 'maximize_efficiency',
  MINIMIZE_VEHICLES = 'minimize_vehicles',
  MAXIMIZE_CUSTOMER_SATISFACTION = 'maximize_satisfaction',
  BALANCE_WORKLOAD = 'balance_workload',
}

export interface OptimizationConstraints {
  readonly maxVehicles: number
  readonly maxToursPerVehicle: number
  readonly respectTimeWindows: boolean
  readonly respectPriorities: boolean
  readonly balanceWorkload: boolean
  readonly minimumStopsPerTour: number
  readonly maximumStopsPerTour: number
  readonly startLocation: Coordinates
  readonly endLocation?: Coordinates
  readonly allowSplitDeliveries: boolean
}

export interface OptimizationResult {
  readonly tours: readonly OptimizedTour[]
  readonly metrics: OptimizationMetrics
  readonly algorithm: OptimizationAlgorithm
  readonly parameters: OptimizationParameters
  readonly executionTime: number
  readonly iterations: number
  readonly bestScore: number
  readonly convergenceData: readonly number[]
  readonly warnings: readonly string[]
  readonly errors: readonly string[]
  readonly version: string
  readonly timestamp: Date
}

export interface OptimizationMetrics {
  readonly totalDistance: number
  readonly totalTime: number
  readonly totalCost?: number
  readonly totalFuel?: number
  readonly vehicleUtilization: number
  readonly customerSatisfaction?: number
  readonly efficiency: number
  readonly improvement: number
  readonly unassignedAddresses: readonly string[]
}

// System and state management
export interface SystemState {
  readonly addresses: readonly DeliveryAddress[]
  readonly tours: readonly OptimizedTour[]
  readonly drivers: readonly DriverInfo[]
  readonly vehicles: readonly VehicleInfo[]
  readonly isOptimizing: boolean
  readonly lastOptimization?: Date
  readonly settings: SystemSettings
  readonly performance: PerformanceMetrics
}

export interface SystemSettings {
  readonly defaultVehicleConstraints: VehicleConstraints
  readonly defaultOptimizationParameters: OptimizationParameters
  readonly mapProvider: MapProvider
  readonly geocodingProvider: GeocodingProvider
  readonly routingProvider: RoutingProvider
  readonly theme: ThemeMode
  readonly language: string
  readonly timezone: string
  readonly units: UnitSystem
  readonly notifications: NotificationSettings
  readonly integrations: IntegrationSettings
}

export enum MapProvider {
  OPENSTREETMAP = 'openstreetmap',
  GOOGLE_MAPS = 'google_maps',
  MAPBOX = 'mapbox',
  HERE = 'here',
}

export enum GeocodingProvider {
  NOMINATIM = 'nominatim',
  GOOGLE = 'google',
  MAPBOX = 'mapbox',
  HERE = 'here',
}

export enum RoutingProvider {
  OSRM = 'osrm',
  GOOGLE = 'google',
  MAPBOX = 'mapbox',
  HERE = 'here',
}

export enum ThemeMode {
  LIGHT = 'light',
  DARK = 'dark',
  AUTO = 'auto',
}

export enum UnitSystem {
  METRIC = 'metric',
  IMPERIAL = 'imperial',
}

export interface NotificationSettings {
  readonly email: boolean
  readonly push: boolean
  readonly sms: boolean
  readonly inApp: boolean
  readonly optimizationComplete: boolean
  readonly deliveryUpdates: boolean
  readonly systemAlerts: boolean
}

export interface IntegrationSettings {
  readonly apiKeys: Record<string, string>
  readonly webhooks: readonly WebhookConfig[]
  readonly exports: ExportSettings
}

export interface WebhookConfig {
  readonly url: string
  readonly events: readonly string[]
  readonly secret?: string
  readonly enabled: boolean
}

export interface ExportSettings {
  readonly formats: readonly ExportFormat[]
  readonly autoExport: boolean
  readonly schedule?: string
  readonly destination?: string
}

export enum ExportFormat {
  GOOGLE_MAPS = 'google_maps',
  APPLE_MAPS = 'apple_maps',
  WAZE = 'waze',
  CSV = 'csv',
  EXCEL = 'excel',
  PDF = 'pdf',
  JSON = 'json',
  GPX = 'gpx',
  KML = 'kml',
}

export interface PerformanceMetrics {
  readonly lastOptimizationTime: number
  readonly averageOptimizationTime: number
  readonly memoryUsage: number
  readonly cacheHitRate: number
  readonly apiCallsPerHour: number
  readonly errorRate: number
  readonly uptime: number
}

// Error handling and validation
export interface ValidationResult {
  readonly isValid: boolean
  readonly errors: readonly ValidationError[]
  readonly warnings: readonly ValidationWarning[]
}

export interface ValidationError {
  readonly field: string
  readonly message: string
  readonly code: string
  readonly severity: 'error' | 'warning'
}

export interface ValidationWarning {
  readonly field: string
  readonly message: string
  readonly code: string
  readonly suggestion?: string
}

// API and service types
export interface ApiResponse<T> {
  readonly data: T
  readonly success: boolean
  readonly message?: string
  readonly errors?: readonly string[]
  readonly metadata?: Record<string, unknown>
  readonly timestamp: Date
}

export interface PaginatedResponse<T> extends ApiResponse<readonly T[]> {
  readonly pagination: PaginationInfo
}

export interface PaginationInfo {
  readonly page: number
  readonly pageSize: number
  readonly totalPages: number
  readonly totalItems: number
  readonly hasNext: boolean
  readonly hasPrevious: boolean
}

// Utility types
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P]
}

export type PartialExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>

export type OptionalExcept<T, K extends keyof T> = Partial<T> & Required<Pick<T, K>>

export type NonEmptyArray<T> = [T, ...T[]]

export type Brand<T, B> = T & { readonly __brand: B }

export type UUID = Brand<string, 'UUID'>
export type PositiveNumber = Brand<number, 'PositiveNumber'>
export type NonNegativeNumber = Brand<number, 'NonNegativeNumber'>
export type Percentage = Brand<number, 'Percentage'> // 0-100
export type Latitude = Brand<number, 'Latitude'> // -90 to 90
export type Longitude = Brand<number, 'Longitude'> // -180 to 180