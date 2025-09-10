// import toast from 'react-hot-toast' // Will be imported in components that use it

// Error types for better error handling
export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  GEOCODING_ERROR = 'GEOCODING_ERROR',
  OPTIMIZATION_ERROR = 'OPTIMIZATION_ERROR',
  EXPORT_ERROR = 'EXPORT_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

// Custom error class with additional context
export class AppError extends Error {
  public readonly type: ErrorType
  public readonly code?: string
  public readonly details?: Record<string, unknown>
  public readonly timestamp: Date
  public readonly recoverable: boolean

  constructor(
    message: string,
    type: ErrorType = ErrorType.UNKNOWN_ERROR,
    options: {
      code?: string
      details?: Record<string, unknown>
      recoverable?: boolean
      cause?: Error
    } = {}
  ) {
    super(message)
    this.name = 'AppError'
    this.type = type
    this.code = options.code || undefined
    this.details = options.details || undefined
    this.timestamp = new Date()
    this.recoverable = options.recoverable ?? true

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError)
    }

    // Include original error cause
    if (options.cause) {
      this.stack = `${this.stack}\nCaused by: ${options.cause.stack}`
    }
  }
}

// Network error detection and handling
export const isNetworkError = (error: unknown): boolean => {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true
  }
  
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('connection') ||
      message.includes('timeout') ||
      message.includes('offline')
    )
  }
  
  return false
}

// Rate limiting detection
export const isRateLimitError = (error: unknown): boolean => {
  if (error instanceof AppError && error.code) {
    return ['429', 'RATE_LIMIT_EXCEEDED', 'TOO_MANY_REQUESTS'].includes(error.code)
  }
  
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return message.includes('rate limit') || message.includes('too many requests')
  }
  
  return false
}

// Geocoding specific error handling
export const createGeocodingError = (
  message: string,
  provider?: string,
  address?: string
): AppError => {
  return new AppError(message, ErrorType.GEOCODING_ERROR, {
    code: 'GEOCODING_FAILED',
    details: { provider, address },
    recoverable: true,
  })
}

// Optimization error handling
export const createOptimizationError = (
  message: string,
  algorithm?: string,
  addressCount?: number
): AppError => {
  return new AppError(message, ErrorType.OPTIMIZATION_ERROR, {
    code: 'OPTIMIZATION_FAILED',
    details: { algorithm, addressCount },
    recoverable: true,
  })
}

// Export error handling
export const createExportError = (
  message: string,
  format?: string,
  tourCount?: number
): AppError => {
  return new AppError(message, ErrorType.EXPORT_ERROR, {
    code: 'EXPORT_FAILED',
    details: { format, tourCount },
    recoverable: true,
  })
}

// Storage error handling
export const createStorageError = (message: string, operation?: string): AppError => {
  return new AppError(message, ErrorType.STORAGE_ERROR, {
    code: 'STORAGE_FAILED',
    details: { operation },
    recoverable: false,
  })
}

// Validation error handling
export const createValidationError = (
  message: string,
  field?: string,
  value?: unknown
): AppError => {
  return new AppError(message, ErrorType.VALIDATION_ERROR, {
    code: 'VALIDATION_FAILED',
    details: { field, value },
    recoverable: true,
  })
}

// Global error handler with retry logic
export class ErrorHandler {
  private static retryAttempts = new Map<string, number>()
  private static readonly MAX_RETRIES = 3
  private static readonly RETRY_DELAY_BASE = 1000 // 1 second

  public static async handleError(
    error: unknown,
    context?: string,
    options: {
      showToast?: boolean
      retry?: boolean
      retryKey?: string
      onRetry?: () => Promise<T>
    } = {}
  ): Promise<void> {
    const { showToast = true, retry = false, retryKey, onRetry } = options

    // Convert to AppError if needed
    const appError = this.normalizeError(error, context)

    // Log error for debugging
    console.group('🚨 Error Handler')
    console.error('Context:', context)
    console.error('Error:', appError)
    console.error('Type:', appError.type)
    console.error('Recoverable:', appError.recoverable)
    if (appError.details) {
      console.error('Details:', appError.details)
    }
    console.groupEnd()

    // Handle retry logic
    if (retry && retryKey && onRetry && appError.recoverable) {
      const attempts = this.retryAttempts.get(retryKey) || 0
      
      if (attempts < this.MAX_RETRIES) {
        this.retryAttempts.set(retryKey, attempts + 1)
        
        if (showToast) {
          toast.loading(`Retrying... (${attempts + 1}/${this.MAX_RETRIES})`, {
            id: `retry-${retryKey}`,
          })
        }
        
        // Exponential backoff
        const delay = this.RETRY_DELAY_BASE * Math.pow(2, attempts)
        
        try {
          await new Promise(resolve => setTimeout(resolve, delay))
          await onRetry()
          
          // Reset retry count on success
          this.retryAttempts.delete(retryKey)
          
          if (showToast) {
            toast.dismiss(`retry-${retryKey}`)
            toast.success('Operation succeeded after retry')
          }
          
          return
        } catch (retryError) {
          if (showToast) {
            toast.dismiss(`retry-${retryKey}`)
          }
          
          // If max retries reached, continue with normal error handling
          if (attempts + 1 >= this.MAX_RETRIES) {
            this.retryAttempts.delete(retryKey)
          } else {
            // Recursive retry
            return this.handleError(retryError, context, options)
          }
        }
      }
    }

    // Show user-friendly toast notification
    if (showToast) {
      const userMessage = this.getUserFriendlyMessage(appError)
      
      if (appError.recoverable) {
        toast.error(userMessage, {
          duration: 5000,
          action: appError.type === ErrorType.NETWORK_ERROR ? {
            label: 'Retry',
            onClick: () => window.location.reload(),
          } : undefined,
        })
      } else {
        toast.error(userMessage, {
          duration: 8000,
          action: {
            label: 'Reload',
            onClick: () => window.location.reload(),
          },
        })
      }
    }

    // Report to error tracking service in production
    if (process.env.NODE_ENV === 'production') {
      this.reportError(appError, context)
    }
  }

  private static normalizeError(error: unknown, context?: string): AppError {
    if (error instanceof AppError) {
      return error
    }

    if (error instanceof Error) {
      // Determine error type based on error characteristics
      let type = ErrorType.UNKNOWN_ERROR
      
      if (isNetworkError(error)) {
        type = ErrorType.NETWORK_ERROR
      } else if (context?.includes('geocoding')) {
        type = ErrorType.GEOCODING_ERROR
      } else if (context?.includes('optimization')) {
        type = ErrorType.OPTIMIZATION_ERROR
      } else if (context?.includes('export')) {
        type = ErrorType.EXPORT_ERROR
      } else if (context?.includes('storage')) {
        type = ErrorType.STORAGE_ERROR
      }

      return new AppError(error.message, type, {
        details: { originalError: error.name, context },
        cause: error,
      })
    }

    // Handle non-Error objects
    const message = typeof error === 'string' ? error : 'An unknown error occurred'
    return new AppError(message, ErrorType.UNKNOWN_ERROR, {
      details: { originalError: error, context },
    })
  }

  private static getUserFriendlyMessage(error: AppError): string {
    const baseMessages: Record<ErrorType, string> = {
      [ErrorType.NETWORK_ERROR]: 'Connection problem. Please check your internet connection.',
      [ErrorType.VALIDATION_ERROR]: 'Please check your input and try again.',
      [ErrorType.GEOCODING_ERROR]: 'Unable to find the address location. Please check the address.',
      [ErrorType.OPTIMIZATION_ERROR]: 'Route optimization failed. Please try with fewer addresses.',
      [ErrorType.EXPORT_ERROR]: 'Export failed. Please try a different format.',
      [ErrorType.STORAGE_ERROR]: 'Unable to save data. Please check your browser settings.',
      [ErrorType.PERMISSION_ERROR]: 'Permission denied. Please check your browser permissions.',
      [ErrorType.TIMEOUT_ERROR]: 'Operation timed out. Please try again.',
      [ErrorType.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.',
    }

    let message = baseMessages[error.type] || baseMessages[ErrorType.UNKNOWN_ERROR]

    // Add specific context for certain error types
    if (error.type === ErrorType.GEOCODING_ERROR && error.details && 'address' in error.details) {
      message += ` (Address: ${error.details['address']})`
    } else if (error.type === ErrorType.EXPORT_ERROR && error.details && 'format' in error.details) {
      message += ` (Format: ${error.details['format']})`
    }

    return message
  }

  private static reportError(error: AppError, context?: string): void {
    try {
      const errorReport = {
        message: error.message,
        type: error.type,
        code: error.code,
        details: error.details,
        context,
        timestamp: error.timestamp.toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        recoverable: error.recoverable,
      }

      // Send to error tracking service
      fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorReport),
      }).catch(() => {
        // Silently fail if error reporting fails
      })
    } catch (reportingError) {
      console.warn('Failed to report error:', reportingError)
    }
  }

  public static clearRetryAttempts(key?: string): void {
    if (key) {
      this.retryAttempts.delete(key)
    } else {
      this.retryAttempts.clear()
    }
  }
}

// Async wrapper with error handling
export const withErrorHandling = async <T>(
  operation: () => Promise<T>,
  context: string,
  options: {
    showToast?: boolean
    retry?: boolean
    fallback?: T
  } = {}
): Promise<T | undefined> => {
  try {
    return await operation()
  } catch (error) {
    await ErrorHandler.handleError(error, context, {
      showToast: options.showToast,
      retry: options.retry,
      retryKey: context,
      onRetry: operation,
    })
    return options.fallback
  }
}

// React hook for error handling
export const useErrorBoundary = () => {
  return (error: Error) => {
    throw error
  }
}