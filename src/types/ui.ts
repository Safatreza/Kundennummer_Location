/**
 * UI and component-specific types for the aboutwater Route Optimizer
 * Interface definitions for React components and user interactions
 */

import type { DeliveryAddress, OptimizedTour, SystemState, ValidationResult } from './core'

// Component props and state types
export interface ComponentWithChildren {
  readonly children: React.ReactNode
}

export interface ComponentWithClassName {
  readonly className?: string
}

export interface ComponentWithTestId {
  readonly 'data-testid'?: string
}

export type BaseComponentProps = ComponentWithChildren & ComponentWithClassName & ComponentWithTestId

// Form and input types
export interface FormFieldProps {
  readonly id: string
  readonly label: string
  readonly required?: boolean
  readonly disabled?: boolean
  readonly error?: string
  readonly helperText?: string
  readonly placeholder?: string
}

export interface AddressFormData {
  readonly address: string
  readonly deliveryId?: string
  readonly bottleCount: number
  readonly priority?: number
  readonly timeWindowStart?: string
  readonly timeWindowEnd?: string
  readonly customerNotes?: string
  readonly accessInstructions?: string
  readonly tags?: readonly string[]
}

export interface ImportFormData {
  readonly file: File
  readonly mapping: ColumnMapping
  readonly skipHeaders: boolean
  readonly validateAddresses: boolean
  readonly overwriteExisting: boolean
}

export interface ColumnMapping {
  readonly address: string
  readonly deliveryId?: string
  readonly bottleCount?: string
  readonly priority?: string
  readonly notes?: string
}

// Map and visualization types
export interface MapViewState {
  readonly center: [number, number]
  readonly zoom: number
  readonly bounds?: [[number, number], [number, number]]
}

export interface MarkerData {
  readonly id: string
  readonly position: [number, number]
  readonly type: MarkerType
  readonly data: DeliveryAddress | HQMarkerData
  readonly visible: boolean
  readonly clustered?: boolean
}

export enum MarkerType {
  HQ = 'hq',
  ADDRESS = 'address',
  OPTIMIZED = 'optimized',
  REFILL = 'refill',
  CLUSTER = 'cluster',
}

export interface HQMarkerData {
  readonly name: string
  readonly address: string
  readonly type: 'hq'
}

export interface RouteVisualization {
  readonly tourId: string
  readonly coordinates: readonly [number, number][]
  readonly color: string
  readonly weight: number
  readonly opacity: number
  readonly visible: boolean
}

export interface ClusterData {
  readonly id: string
  readonly count: number
  readonly position: [number, number]
  readonly bounds: [[number, number], [number, number]]
  readonly addresses: readonly string[] // address IDs
}

// List and table types
export interface SortConfig {
  readonly key: string
  readonly direction: SortDirection
}

export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export interface FilterConfig {
  readonly priority?: readonly number[]
  readonly status?: readonly string[]
  readonly addressType?: readonly string[]
  readonly hasNotes: boolean | null
  readonly bottleRange?: [number, number]
  readonly searchQuery: string
}

export interface VirtualListProps {
  readonly items: readonly unknown[]
  readonly height: number
  readonly itemHeight: number
  readonly renderItem: (index: number, item: unknown) => React.ReactNode
  readonly onLoadMore?: () => void
  readonly hasNextPage?: boolean
  readonly isLoading?: boolean
}

// Dialog and modal types
export interface DialogProps extends BaseComponentProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly title: string
  readonly description?: string
  readonly size?: DialogSize
}

export enum DialogSize {
  SM = 'sm',
  MD = 'md',
  LG = 'lg',
  XL = 'xl',
  FULL = 'full',
}

export interface ConfirmDialogProps extends Omit<DialogProps, 'children'> {
  readonly message: string
  readonly confirmText?: string
  readonly cancelText?: string
  readonly variant?: 'default' | 'destructive'
  readonly onConfirm: () => void
  readonly onCancel?: () => void
}

// Toast and notification types
export interface ToastData {
  readonly id: string
  readonly title: string
  readonly description?: string
  readonly type: ToastType
  readonly duration?: number
  readonly action?: ToastAction
  readonly timestamp: Date
}

export enum ToastType {
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
}

export interface ToastAction {
  readonly label: string
  readonly action: () => void
}

// Loading and progress types
export interface LoadingState {
  readonly isLoading: boolean
  readonly message?: string
  readonly progress?: number
  readonly stage?: string
}

export interface ProgressData {
  readonly current: number
  readonly total: number
  readonly percentage: number
  readonly stage: string
  readonly estimated?: Date
  readonly speed?: number
}

// Export and sharing types
export interface ExportOptions {
  readonly format: ExportFormatUI
  readonly includeMetadata: boolean
  readonly includeTours?: readonly string[]
  readonly filename?: string
  readonly destination?: ExportDestination
}

export enum ExportFormatUI {
  GOOGLE_MAPS = 'google_maps',
  APPLE_MAPS = 'apple_maps',
  CSV = 'csv',
  EXCEL = 'excel',
  PDF = 'pdf',
  JSON = 'json',
}

export enum ExportDestination {
  DOWNLOAD = 'download',
  CLIPBOARD = 'clipboard',
  EMAIL = 'email',
  CLOUD = 'cloud',
}

// Search and autocomplete types
export interface SearchResult {
  readonly id: string
  readonly title: string
  readonly subtitle?: string
  readonly type: SearchResultType
  readonly data: unknown
  readonly score: number
}

export enum SearchResultType {
  ADDRESS = 'address',
  TOUR = 'tour',
  DRIVER = 'driver',
  VEHICLE = 'vehicle',
}

export interface AutocompleteProps {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly onSelect: (result: SearchResult) => void
  readonly placeholder?: string
  readonly minLength?: number
  readonly debounceMs?: number
  readonly maxResults?: number
  readonly providers?: readonly SearchProvider[]
}

export enum SearchProvider {
  LOCAL = 'local',
  NOMINATIM = 'nominatim',
  GOOGLE = 'google',
  CACHE = 'cache',
}

// Analytics and metrics types
export interface DashboardMetrics {
  readonly totalAddresses: number
  readonly totalTours: number
  readonly totalBottles: number
  readonly averageBottlesPerTour: number
  readonly totalDistance: number
  readonly totalTime: number
  readonly efficiency: number
  readonly lastOptimization?: Date
  readonly optimizationHistory: readonly OptimizationHistoryEntry[]
}

export interface OptimizationHistoryEntry {
  readonly timestamp: Date
  readonly addressCount: number
  readonly tourCount: number
  readonly efficiency: number
  readonly duration: number
  readonly algorithm: string
}

// Theme and styling types
export interface ThemeConfig {
  readonly mode: 'light' | 'dark' | 'auto'
  readonly primaryColor: string
  readonly accentColor: string
  readonly radius: number
  readonly font: string
  readonly animations: boolean
  readonly reducedMotion: boolean
}

export interface ColorScheme {
  readonly primary: string
  readonly secondary: string
  readonly accent: string
  readonly background: string
  readonly foreground: string
  readonly muted: string
  readonly border: string
  readonly error: string
  readonly warning: string
  readonly success: string
  readonly info: string
}

// Keyboard and accessibility types
export interface KeyboardShortcut {
  readonly key: string
  readonly ctrlKey?: boolean
  readonly shiftKey?: boolean
  readonly altKey?: boolean
  readonly description: string
  readonly handler: () => void
}

export interface AccessibilityProps {
  readonly 'aria-label'?: string
  readonly 'aria-labelledby'?: string
  readonly 'aria-describedby'?: string
  readonly role?: string
  readonly tabIndex?: number
}

// Animation and transition types
export interface AnimationConfig {
  readonly duration: number
  readonly delay?: number
  readonly easing: string
  readonly fillMode?: 'forwards' | 'backwards' | 'both' | 'none'
}

export interface TransitionConfig {
  readonly property: string
  readonly duration: number
  readonly easing: string
  readonly delay?: number
}

// Layout and responsive types
export interface BreakpointConfig {
  readonly xs: number
  readonly sm: number
  readonly md: number
  readonly lg: number
  readonly xl: number
  readonly '2xl': number
}

export interface ResponsiveValue<T> {
  readonly xs?: T
  readonly sm?: T
  readonly md?: T
  readonly lg?: T
  readonly xl?: T
  readonly '2xl'?: T
}

// Component state types
export interface AddressListState {
  readonly addresses: readonly DeliveryAddress[]
  readonly filteredAddresses: readonly DeliveryAddress[]
  readonly selectedAddresses: readonly string[]
  readonly sortConfig: SortConfig
  readonly filterConfig: FilterConfig
  readonly viewMode: ViewMode
  readonly isLoading: boolean
  readonly error?: string
}

export enum ViewMode {
  LIST = 'list',
  GRID = 'grid',
  COMPACT = 'compact',
}

export interface TourListState {
  readonly tours: readonly OptimizedTour[]
  readonly selectedTour?: string
  readonly expandedTours: readonly string[]
  readonly sortConfig: SortConfig
  readonly filterConfig: FilterConfig
  readonly isLoading: boolean
  readonly error?: string
}

export interface MapState {
  readonly viewState: MapViewState
  readonly markers: readonly MarkerData[]
  readonly routes: readonly RouteVisualization[]
  readonly clusters: readonly ClusterData[]
  readonly selectedMarkers: readonly string[]
  readonly hoveredMarker?: string
  readonly isLoading: boolean
  readonly error?: string
}

// Hook types
export interface UseAsyncState<T> {
  readonly data: T | null
  readonly isLoading: boolean
  readonly error: Error | null
  readonly execute: () => Promise<void>
  readonly reset: () => void
}

export interface UseDebounceOptions {
  readonly delay: number
  readonly maxWait?: number
  readonly leading?: boolean
  readonly trailing?: boolean
}

export interface UseLocalStorageOptions<T> {
  readonly defaultValue: T
  readonly serializer?: {
    readonly read: (value: string) => T
    readonly write: (value: T) => string
  }
}

// Validation types
export interface FormValidation {
  readonly isValid: boolean
  readonly isValidating: boolean
  readonly errors: Record<string, string>
  readonly warnings: Record<string, string>
  readonly touched: Record<string, boolean>
  readonly isDirty: boolean
}

export interface FieldValidation {
  readonly isValid: boolean
  readonly error?: string
  readonly warning?: string
  readonly isTouched: boolean
  readonly isDirty: boolean
}

// Event handler types
export type EventHandler<T extends Event = Event> = (event: T) => void
export type ChangeHandler<T = unknown> = (value: T) => void
export type SubmitHandler<T = unknown> = (data: T) => void | Promise<void>

// Utility UI types
export type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type Variant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'
export type Intent = 'default' | 'primary' | 'success' | 'warning' | 'error'

export interface WithSize {
  readonly size?: Size
}

export interface WithVariant {
  readonly variant?: Variant
}

export interface WithIntent {
  readonly intent?: Intent
}

export type UIComponentProps = BaseComponentProps & 
  WithSize & 
  WithVariant & 
  WithIntent & 
  AccessibilityProps

// Context types
export interface AppContextValue {
  readonly state: SystemState
  readonly dispatch: React.Dispatch<AppAction>
  readonly theme: ThemeConfig
  readonly setTheme: (theme: Partial<ThemeConfig>) => void
}

export interface ToastContextValue {
  readonly toasts: readonly ToastData[]
  readonly addToast: (toast: Omit<ToastData, 'id' | 'timestamp'>) => void
  readonly removeToast: (id: string) => void
  readonly clearToasts: () => void
}

// Action types for reducers
export type AppAction =
  | { type: 'SET_ADDRESSES'; payload: readonly DeliveryAddress[] }
  | { type: 'ADD_ADDRESS'; payload: DeliveryAddress }
  | { type: 'UPDATE_ADDRESS'; payload: { id: string; data: Partial<DeliveryAddress> } }
  | { type: 'REMOVE_ADDRESS'; payload: string }
  | { type: 'SET_TOURS'; payload: readonly OptimizedTour[] }
  | { type: 'SET_LOADING'; payload: { key: string; value: boolean } }
  | { type: 'SET_ERROR'; payload: { key: string; value: string | null } }
  | { type: 'RESET_STATE' }

// Error boundary types
export interface ErrorInfo {
  readonly componentStack: string
  readonly errorBoundary?: string
  readonly eventPhase?: string
}

export interface ErrorFallbackProps {
  readonly error: Error
  readonly resetError: () => void
  readonly errorInfo?: ErrorInfo
}

// Performance and optimization types
export interface PerformanceEntry {
  readonly name: string
  readonly startTime: number
  readonly duration: number
  readonly entryType: string
}

export interface RenderMetrics {
  readonly componentName: string
  readonly renderTime: number
  readonly propsChanged: readonly string[]
  readonly rerenderCount: number
}