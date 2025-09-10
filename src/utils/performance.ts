/**
 * Performance monitoring and optimization utilities
 */

// Performance metrics collection
interface PerformanceMetrics {
  name: string
  startTime: number
  endTime?: number
  duration?: number
  metadata?: Record<string, unknown>
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics> = new Map()
  private observers: PerformanceObserver[] = []

  constructor() {
    this.setupObservers()
  }

  private setupObservers(): void {
    if (typeof window === 'undefined' || !window.PerformanceObserver) {
      return
    }

    try {
      // Observe navigation timing
      const navObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            this.recordNavigation(entry as PerformanceNavigationTiming)
          }
        }
      })
      navObserver.observe({ entryTypes: ['navigation'] })
      this.observers.push(navObserver)

      // Observe resource timing
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'resource') {
            this.recordResource(entry as PerformanceResourceTiming)
          }
        }
      })
      resourceObserver.observe({ entryTypes: ['resource'] })
      this.observers.push(resourceObserver)

      // Observe user timing
      const userObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'measure' || entry.entryType === 'mark') {
            this.recordUserTiming(entry)
          }
        }
      })
      userObserver.observe({ entryTypes: ['measure', 'mark'] })
      this.observers.push(userObserver)
    } catch (error) {
      console.warn('Performance monitoring setup failed:', error)
    }
  }

  private recordNavigation(entry: PerformanceNavigationTiming): void {
    const metrics = {
      domContentLoaded: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
      loadComplete: entry.loadEventEnd - entry.loadEventStart,
      domInteractive: entry.domInteractive - entry.fetchStart,
      firstPaint: this.getFirstPaint(),
      firstContentfulPaint: this.getFirstContentfulPaint(),
    }

    console.log('📊 Navigation Performance:', metrics)

    // Report slow navigation
    if (metrics.loadComplete > 3000) {
      console.warn('⚠️ Slow page load detected:', metrics.loadComplete + 'ms')
    }
  }

  private recordResource(entry: PerformanceResourceTiming): void {
    const duration = entry.responseEnd - entry.startTime

    // Report slow resources
    if (duration > 1000) {
      console.warn('⚠️ Slow resource load:', {
        url: entry.name,
        duration: duration + 'ms',
        size: entry.transferSize || 'unknown',
      })
    }
  }

  private recordUserTiming(entry: PerformanceEntry): void {
    console.log('🎯 User Timing:', {
      name: entry.name,
      duration: entry.duration,
      startTime: entry.startTime,
    })
  }

  private getFirstPaint(): number | null {
    const entries = performance.getEntriesByName('first-paint')
    return entries.length > 0 ? entries[0]!.startTime : null
  }

  private getFirstContentfulPaint(): number | null {
    const entries = performance.getEntriesByName('first-contentful-paint')
    return entries.length > 0 ? entries[0]!.startTime : null
  }

  public startTiming(name: string, metadata?: Record<string, unknown>): void {
    const startTime = performance.now()
    this.metrics.set(name, { name, startTime, metadata: metadata || {} })
    performance.mark(`${name}-start`)
  }

  public endTiming(name: string): PerformanceMetrics | null {
    const metric = this.metrics.get(name)
    if (!metric) {
      console.warn(`No timing started for: ${name}`)
      return null
    }

    const endTime = performance.now()
    const duration = endTime - metric.startTime
    
    metric.endTime = endTime
    metric.duration = duration

    performance.mark(`${name}-end`)
    performance.measure(name, `${name}-start`, `${name}-end`)

    console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`)

    // Report slow operations
    if (duration > 5000) {
      console.warn(`⚠️ Slow operation detected: ${name} took ${duration.toFixed(2)}ms`)
    }

    return metric
  }

  public getMetrics(): PerformanceMetrics[] {
    return Array.from(this.metrics.values())
  }

  public clearMetrics(): void {
    this.metrics.clear()
    if (performance.clearMarks) {
      performance.clearMarks()
    }
    if (performance.clearMeasures) {
      performance.clearMeasures()
    }
  }

  public getMemoryUsage(): any | null {
    if ('memory' in performance) {
      return (performance as any).memory
    }
    return null
  }

  public dispose(): void {
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []
    this.clearMetrics()
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor()

// Performance timing utilities (use React hooks in .tsx files)
export const createPerformanceTiming = (name: string) => {
  return {
    start: () => performanceMonitor.startTiming(name),
    end: () => performanceMonitor.endTiming(name),
  }
}

// HOC for component performance monitoring (use this in .tsx files)
export const createPerformanceMonitoringHOC = (componentName: string) => {
  return {
    startTiming: () => performanceMonitor.startTiming(`${componentName}-mount`),
    endTiming: () => performanceMonitor.endTiming(`${componentName}-mount`),
  }
}

// Debounce utility for performance optimization
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    const later = () => {
      timeout = null
      if (!immediate) func(...args)
    }

    const callNow = immediate && !timeout

    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(later, wait)

    if (callNow) func(...args)
  }
}

// Throttle utility for performance optimization
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

// Memory usage monitoring
export const monitorMemoryUsage = (): void => {
  const logMemoryUsage = () => {
    const memory = performanceMonitor.getMemoryUsage()
    if (memory) {
      const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024)
      const totalMB = Math.round(memory.totalJSHeapSize / 1024 / 1024)
      const limitMB = Math.round(memory.jsHeapSizeLimit / 1024 / 1024)

      console.log(`🧠 Memory Usage: ${usedMB}MB / ${totalMB}MB (Limit: ${limitMB}MB)`)

      // Warn if memory usage is high
      if (usedMB > limitMB * 0.8) {
        console.warn('⚠️ High memory usage detected!')
      }
    }
  }

  // Log memory usage every 30 seconds in development
  if (process.env.NODE_ENV === 'development') {
    const interval = setInterval(logMemoryUsage, 30000)
    return () => clearInterval(interval)
  }
}

// Bundle size analyzer (development only)
export const analyzeBundleSize = (): void => {
  if (process.env.NODE_ENV === 'development') {
    console.log('📦 Bundle analysis tools available in dev mode')
  }
}

// Lazy loading helper with performance tracking
export const createLazyLoader = (componentName: string) => {
  return {
    loadWithTiming: async (importFunc: () => Promise<any>) => {
      performanceMonitor.startTiming(`lazy-load-${componentName}`)
      
      try {
        const component = await importFunc()
        performanceMonitor.endTiming(`lazy-load-${componentName}`)
        return component
      } catch (error) {
        performanceMonitor.endTiming(`lazy-load-${componentName}`)
        throw error
      }
    }
  }
}

// Performance-optimized search utility
export const createPerformantSearch = <T>(searchFunction: (items: T[], term: string) => T[]) => {
  return {
    search: (items: T[], term: string) => {
      if (!term.trim()) {
        return items
      }
      performanceMonitor.startTiming('search-operation')
      const results = searchFunction(items, term)
      performanceMonitor.endTiming('search-operation')
      return results
    },
    debouncedSearch: debounce((items: T[], term: string, callback: (results: T[]) => void) => {
      const results = searchFunction(items, term)
      callback(results)
    }, 300)
  }
}