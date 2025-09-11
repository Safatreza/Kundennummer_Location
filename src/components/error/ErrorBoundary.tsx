import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    })

    // Log error for debugging
    console.group('🚨 React Error Boundary Caught Error')
    console.error('Error:', error)
    console.error('Error Info:', errorInfo)
    console.error('Component Stack:', errorInfo.componentStack)
    console.groupEnd()

    // Call custom error handler
    this.props.onError?.(error, errorInfo)

    // Report to error tracking service in production
    if (import.meta.env.PROD) {
      this.reportError(error, errorInfo)
    }
  }

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    // In production, this would send to an error tracking service
    // like Sentry, LogRocket, or Bugsnag
    try {
      const errorReport = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        errorId: this.state.errorId,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        userId: localStorage.getItem('userId') || 'anonymous',
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

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    })
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleGoHome = () => {
    window.location.href = '/'
  }

  private copyErrorDetails = () => {
    const errorDetails = {
      errorId: this.state.errorId,
      message: this.state.error?.message,
      stack: this.state.error?.stack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    }

    navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2))
      .then(() => {
        alert('Error details copied to clipboard')
      })
      .catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = JSON.stringify(errorDetails, null, 2)
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        alert('Error details copied to clipboard')
      })
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="min-h-screen aboutwater-water-bg flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl glass-morphism">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              <CardTitle className="text-2xl font-bold text-destructive">
                Oops! Something went wrong
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <div className="text-center text-muted-foreground">
                <p className="mb-2">
                  We apologize for the inconvenience. An unexpected error occurred in the aboutwater Route Optimizer.
                </p>
                <p className="text-sm">
                  Error ID: <code className="font-mono bg-muted px-2 py-1 rounded">{this.state.errorId}</code>
                </p>
              </div>

              {/* Error Details (Development only) */}
              {!import.meta.env.PROD && this.state.error && (
                <details className="bg-muted/50 p-4 rounded-lg">
                  <summary className="cursor-pointer font-medium text-sm mb-2">
                    🐛 Error Details (Development)
                  </summary>
                  <div className="text-xs font-mono space-y-2">
                    <div>
                      <strong>Message:</strong>
                      <pre className="mt-1 text-destructive">{this.state.error.message}</pre>
                    </div>
                    {this.state.error.stack && (
                      <div>
                        <strong>Stack Trace:</strong>
                        <pre className="mt-1 text-xs overflow-auto max-h-40 text-muted-foreground">
                          {this.state.error.stack}
                        </pre>
                      </div>
                    )}
                    {this.state.errorInfo?.componentStack && (
                      <div>
                        <strong>Component Stack:</strong>
                        <pre className="mt-1 text-xs overflow-auto max-h-40 text-muted-foreground">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={this.handleRetry}
                  className="flex-1"
                  variant="default"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                
                <Button
                  onClick={this.handleReload}
                  variant="outline"
                  className="flex-1"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reload Page
                </Button>
                
                <Button
                  onClick={this.handleGoHome}
                  variant="outline"
                  className="flex-1"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Go Home
                </Button>
              </div>

              {/* Additional Actions */}
              <div className="flex justify-center space-x-4 text-sm">
                <button
                  onClick={this.copyErrorDetails}
                  className="text-muted-foreground hover:text-foreground transition-colors flex items-center"
                >
                  <Bug className="w-4 h-4 mr-1" />
                  Copy Error Details
                </button>
              </div>

              {/* Help Text */}
              <div className="text-center text-xs text-muted-foreground space-y-1">
                <p>If this problem persists, please contact our support team.</p>
                <p>Include the Error ID above for faster resolution.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

// Hook for functional components to handle errors
export const useErrorHandler = () => {
  return (error: Error, errorInfo?: ErrorInfo) => {
    console.error('Unhandled error:', error)
    
    // In a real app, you might want to trigger a re-render
    // or show a notification to the user
    throw error
  }
}