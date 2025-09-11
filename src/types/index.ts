/**
 * Centralized type exports for the aboutwater Route Optimization System
 * Re-exports all types for easy importing throughout the application
 */

// Re-export everything from core types
export * from './core'

// Re-export everything from algorithm types
export * from './algorithms'

// Re-export everything from UI types
export * from './ui'

// Common type guards
export const isValidCoordinates = (value: unknown): boolean => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'lat' in value &&
    'lng' in value &&
    typeof (value as any).lat === 'number' &&
    typeof (value as any).lng === 'number' &&
    Math.abs((value as any).lat) <= 90 &&
    Math.abs((value as any).lng) <= 180
  )
}

// Common constants
export const DEFAULT_BOTTLE_LIMIT = 80
export const DEFAULT_MAX_STOPS = 50
export const DEFAULT_MAX_DURATION = 480 // 8 hours in minutes