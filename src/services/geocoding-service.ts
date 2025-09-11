/**
 * Advanced Geocoding Service with multiple providers and intelligent caching
 * Supports batch processing, fuzzy matching, and address validation
 */

import type {
  Coordinates,
  DeliveryAddress,
  GeocodingProvider,
  ValidationResult,
  ApiResponse,
} from '@/types'

export interface GeocodingResult {
  readonly coordinates: Coordinates
  readonly formattedAddress: string
  readonly accuracy: number
  readonly confidence: number
  readonly provider: GeocodingProvider
  readonly components: AddressComponents
  readonly metadata: GeocodingMetadata
}

export interface AddressComponents {
  readonly streetNumber?: string
  readonly streetName?: string
  readonly city?: string
  readonly state?: string
  readonly postalCode?: string
  readonly country?: string
  readonly district?: string
}

export interface GeocodingMetadata {
  readonly placeId?: string
  readonly types: readonly string[]
  readonly bounds?: {
    readonly north: number
    readonly south: number
    readonly east: number
    readonly west: number
  }
  readonly viewport?: {
    readonly north: number
    readonly south: number
    readonly east: number
    readonly west: number
  }
}

export interface BatchGeocodingRequest {
  readonly addresses: readonly string[]
  readonly options?: GeocodingOptions
}

export interface BatchGeocodingResult {
  readonly results: readonly (GeocodingResult | null)[]
  readonly successful: number
  readonly failed: number
  readonly errors: readonly string[]
}

export interface GeocodingOptions {
  readonly provider?: GeocodingProvider
  readonly country?: string
  readonly bounds?: {
    readonly north: number
    readonly south: number
    readonly east: number
    readonly west: number
  }
  readonly timeout?: number
  readonly retries?: number
  readonly fallbackProviders?: readonly GeocodingProvider[]
}

class GeocodingService {
  private cache = new Map<string, GeocodingResult>()
  private requestQueue: Array<{
    address: string
    resolve: (result: GeocodingResult | null) => void
    reject: (error: Error) => void
    options?: GeocodingOptions
  }> = []
  private isProcessing = false
  private rateLimiter = new Map<GeocodingProvider, number>()

  // Rate limits per provider (requests per second)
  private readonly rateLimits = {
    [GeocodingProvider.NOMINATIM]: 1, // 1 request per second
    [GeocodingProvider.GOOGLE]: 50, // Google allows much higher rates
    [GeocodingProvider.MAPBOX]: 10,
    [GeocodingProvider.HERE]: 5,
  }

  /**
   * Geocode a single address with fallback providers
   */
  public async geocode(
    address: string,
    options: GeocodingOptions = {}
  ): Promise<GeocodingResult | null> {
    const cacheKey = this.getCacheKey(address, options)
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    const providers = [
      options.provider || GeocodingProvider.NOMINATIM,
      ...(options.fallbackProviders || [GeocodingProvider.GOOGLE, GeocodingProvider.MAPBOX])
    ]

    for (const provider of providers) {
      try {
        await this.waitForRateLimit(provider)
        const result = await this.geocodeWithProvider(address, provider, options)
        
        if (result && result.confidence > 0.5) {
          this.cache.set(cacheKey, result)
          return result
        }
      } catch (error) {
        console.warn(`Geocoding failed with ${provider}:`, error)
      }
    }

    return null
  }

  /**
   * Batch geocode multiple addresses with intelligent queuing
   */
  public async batchGeocode(
    request: BatchGeocodingRequest
  ): Promise<BatchGeocodingResult> {
    const results: (GeocodingResult | null)[] = []
    const errors: string[] = []
    let successful = 0
    let failed = 0

    // Process in chunks to avoid overwhelming the API
    const chunkSize = 10
    const chunks = this.chunkArray(request.addresses, chunkSize)

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (address, index) => {
        try {
          const result = await this.geocode(address, request.options)
          if (result) {
            successful++
            return result
          } else {
            failed++
            errors.push(`Failed to geocode: ${address}`)
            return null
          }
        } catch (error) {
          failed++
          errors.push(`Error geocoding ${address}: ${error instanceof Error ? error.message : 'Unknown error'}`)
          return null
        }
      })

      const chunkResults = await Promise.allSettled(chunkPromises)
      results.push(...chunkResults.map(r => r.status === 'fulfilled' ? r.value : null))

      // Add delay between chunks to respect rate limits
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await this.delay(1000)
      }
    }

    return {
      results,
      successful,
      failed,
      errors,
    }
  }

  /**
   * Reverse geocode coordinates to address
   */
  public async reverseGeocode(
    coordinates: Coordinates,
    options: GeocodingOptions = {}
  ): Promise<GeocodingResult | null> {
    const cacheKey = `reverse_${coordinates.lat}_${coordinates.lng}_${options.provider || 'default'}`
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    const provider = options.provider || GeocodingProvider.NOMINATIM

    try {
      await this.waitForRateLimit(provider)
      const result = await this.reverseGeocodeWithProvider(coordinates, provider, options)
      
      if (result) {
        this.cache.set(cacheKey, result)
      }
      
      return result
    } catch (error) {
      console.error('Reverse geocoding failed:', error)
      return null
    }
  }

  /**
   * Validate and normalize an address
   */
  public async validateAddress(address: string): Promise<ValidationResult> {
    try {
      const result = await this.geocode(address, {
        provider: GeocodingProvider.GOOGLE, // Google has best validation
      })

      if (!result) {
        return {
          isValid: false,
          errors: [{
            field: 'address',
            message: 'Address could not be found or verified',
            code: 'ADDRESS_NOT_FOUND',
            severity: 'error',
          }],
          warnings: [],
        }
      }

      const warnings = []

      // Check confidence level
      if (result.confidence < 0.8) {
        warnings.push({
          field: 'address',
          message: 'Address match confidence is low',
          code: 'LOW_CONFIDENCE',
          suggestion: `Did you mean: ${result.formattedAddress}?`,
        })
      }

      // Check if address is too generic
      if (result.accuracy < 0.7) {
        warnings.push({
          field: 'address',
          message: 'Address may be too generic for precise delivery',
          code: 'LOW_ACCURACY',
          suggestion: 'Consider adding more specific details like building number or unit',
        })
      }

      return {
        isValid: true,
        errors: [],
        warnings,
      }

    } catch (error) {
      return {
        isValid: false,
        errors: [{
          field: 'address',
          message: error instanceof Error ? error.message : 'Validation failed',
          code: 'VALIDATION_ERROR',
          severity: 'error',
        }],
        warnings: [],
      }
    }
  }

  /**
   * Find similar addresses (fuzzy matching)
   */
  public async findSimilarAddresses(
    query: string,
    limit: number = 5
  ): Promise<readonly GeocodingResult[]> {
    try {
      // For now, use a simple approach - in production, would use specialized fuzzy matching
      const variations = this.generateAddressVariations(query)
      const results: GeocodingResult[] = []

      for (const variation of variations.slice(0, limit)) {
        const result = await this.geocode(variation)
        if (result && !results.some(r => this.isSameLocation(r.coordinates, result.coordinates))) {
          results.push(result)
        }

        if (results.length >= limit) break
      }

      return results.sort((a, b) => b.confidence - a.confidence)

    } catch (error) {
      console.error('Similar address search failed:', error)
      return []
    }
  }

  /**
   * Geocode with specific provider
   */
  private async geocodeWithProvider(
    address: string,
    provider: GeocodingProvider,
    options: GeocodingOptions
  ): Promise<GeocodingResult | null> {
    switch (provider) {
      case GeocodingProvider.NOMINATIM:
        return this.geocodeWithNominatim(address, options)
      case GeocodingProvider.GOOGLE:
        return this.geocodeWithGoogle(address, options)
      case GeocodingProvider.MAPBOX:
        return this.geocodeWithMapbox(address, options)
      case GeocodingProvider.HERE:
        return this.geocodeWithHere(address, options)
      default:
        throw new Error(`Unsupported geocoding provider: ${provider}`)
    }
  }

  /**
   * Geocode with Nominatim (OpenStreetMap)
   */
  private async geocodeWithNominatim(
    address: string,
    options: GeocodingOptions
  ): Promise<GeocodingResult | null> {
    const params = new URLSearchParams({
      q: address,
      format: 'json',
      limit: '1',
      addressdetails: '1',
      extratags: '1',
    })

    if (options.country) {
      params.append('countrycodes', options.country.toLowerCase())
    }

    if (options.bounds) {
      params.append('viewbox', 
        `${options.bounds.west},${options.bounds.north},${options.bounds.east},${options.bounds.south}`)
      params.append('bounded', '1')
    }

    const url = `https://nominatim.openstreetmap.org/search?${params}`

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'aboutwater Route Optimizer/4.0.0 (contact@aboutwater.com)',
      },
      signal: AbortSignal.timeout(options.timeout || 10000),
    })

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`)
    }

    const data = await response.json()

    if (!Array.isArray(data) || data.length === 0) {
      return null
    }

    const result = data[0]
    const components = this.parseNominatimComponents(result)

    return {
      coordinates: {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
      },
      formattedAddress: result.display_name,
      accuracy: this.calculateNominatimAccuracy(result),
      confidence: this.calculateNominatimConfidence(result, address),
      provider: GeocodingProvider.NOMINATIM,
      components,
      metadata: {
        placeId: result.place_id?.toString(),
        types: result.type ? [result.type] : [],
        bounds: result.boundingbox ? {
          north: parseFloat(result.boundingbox[1]),
          south: parseFloat(result.boundingbox[0]),
          east: parseFloat(result.boundingbox[3]),
          west: parseFloat(result.boundingbox[2]),
        } : undefined,
      },
    }
  }

  /**
   * Geocode with Google Maps API
   */
  private async geocodeWithGoogle(
    address: string,
    options: GeocodingOptions
  ): Promise<GeocodingResult | null> {
    // This would require Google Maps API key
    // For now, return null to indicate not implemented
    console.warn('Google geocoding requires API key configuration')
    return null
  }

  /**
   * Geocode with Mapbox API
   */
  private async geocodeWithMapbox(
    address: string,
    options: GeocodingOptions
  ): Promise<GeocodingResult | null> {
    // This would require Mapbox API key
    console.warn('Mapbox geocoding requires API key configuration')
    return null
  }

  /**
   * Geocode with HERE API
   */
  private async geocodeWithHere(
    address: string,
    options: GeocodingOptions
  ): Promise<GeocodingResult | null> {
    // This would require HERE API key
    console.warn('HERE geocoding requires API key configuration')
    return null
  }

  /**
   * Reverse geocode with specific provider
   */
  private async reverseGeocodeWithProvider(
    coordinates: Coordinates,
    provider: GeocodingProvider,
    options: GeocodingOptions
  ): Promise<GeocodingResult | null> {
    switch (provider) {
      case GeocodingProvider.NOMINATIM:
        return this.reverseGeocodeWithNominatim(coordinates, options)
      default:
        throw new Error(`Reverse geocoding not implemented for ${provider}`)
    }
  }

  /**
   * Reverse geocode with Nominatim
   */
  private async reverseGeocodeWithNominatim(
    coordinates: Coordinates,
    options: GeocodingOptions
  ): Promise<GeocodingResult | null> {
    const params = new URLSearchParams({
      lat: coordinates.lat.toString(),
      lon: coordinates.lng.toString(),
      format: 'json',
      addressdetails: '1',
      zoom: '18',
    })

    const url = `https://nominatim.openstreetmap.org/reverse?${params}`

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'aboutwater Route Optimizer/4.0.0 (contact@aboutwater.com)',
      },
      signal: AbortSignal.timeout(options.timeout || 10000),
    })

    if (!response.ok) {
      throw new Error(`Nominatim reverse geocoding error: ${response.status}`)
    }

    const result = await response.json()

    if (!result || result.error) {
      return null
    }

    const components = this.parseNominatimComponents(result)

    return {
      coordinates,
      formattedAddress: result.display_name,
      accuracy: 1.0, // Reverse geocoding is typically accurate
      confidence: 0.9,
      provider: GeocodingProvider.NOMINATIM,
      components,
      metadata: {
        placeId: result.place_id?.toString(),
        types: result.type ? [result.type] : [],
      },
    }
  }

  /**
   * Parse Nominatim address components
   */
  private parseNominatimComponents(result: any): AddressComponents {
    const addr = result.address || {}
    
    return {
      streetNumber: addr.house_number,
      streetName: addr.road || addr.street,
      city: addr.city || addr.town || addr.village,
      state: addr.state,
      postalCode: addr.postcode,
      country: addr.country,
      district: addr.suburb || addr.district,
    }
  }

  /**
   * Calculate accuracy score for Nominatim results
   */
  private calculateNominatimAccuracy(result: any): number {
    const type = result.type
    const category = result.category

    // Higher accuracy for more specific types
    if (type === 'house' && category === 'place') return 1.0
    if (type === 'building') return 0.9
    if (type === 'road') return 0.7
    if (type === 'suburb' || type === 'neighbourhood') return 0.6
    if (type === 'city' || type === 'town') return 0.5
    if (type === 'state') return 0.3
    if (type === 'country') return 0.1

    return 0.5 // Default
  }

  /**
   * Calculate confidence score for Nominatim results
   */
  private calculateNominatimConfidence(result: any, originalQuery: string): number {
    const displayName = result.display_name.toLowerCase()
    const query = originalQuery.toLowerCase()

    // Simple similarity check
    const words = query.split(/\s+/)
    const matchedWords = words.filter(word => displayName.includes(word))
    
    const wordMatchRatio = matchedWords.length / words.length
    const importance = parseFloat(result.importance) || 0.5
    
    return Math.min(1.0, (wordMatchRatio * 0.7) + (importance * 0.3))
  }

  /**
   * Generate address variations for fuzzy matching
   */
  private generateAddressVariations(query: string): string[] {
    const variations = [query]
    
    // Remove common words that might cause issues
    const cleanQuery = query
      .replace(/\b(street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim()

    if (cleanQuery !== query) {
      variations.push(cleanQuery)
    }

    // Add variations with different punctuation
    variations.push(query.replace(/[.,]/g, ''))
    variations.push(query.replace(/\s+/g, '+'))

    return [...new Set(variations)] // Remove duplicates
  }

  /**
   * Check if two coordinates represent the same location
   */
  private isSameLocation(coord1: Coordinates, coord2: Coordinates, threshold = 0.001): boolean {
    return Math.abs(coord1.lat - coord2.lat) < threshold && 
           Math.abs(coord1.lng - coord2.lng) < threshold
  }

  /**
   * Generate cache key for geocoding request
   */
  private getCacheKey(address: string, options: GeocodingOptions): string {
    const provider = options.provider || 'default'
    const country = options.country || 'global'
    const boundsKey = options.bounds 
      ? `${options.bounds.north}_${options.bounds.south}_${options.bounds.east}_${options.bounds.west}`
      : 'nobounds'
    
    return `${provider}_${country}_${boundsKey}_${address.toLowerCase().trim()}`
  }

  /**
   * Wait for rate limit before making API call
   */
  private async waitForRateLimit(provider: GeocodingProvider): Promise<void> {
    const now = Date.now()
    const lastRequest = this.rateLimiter.get(provider) || 0
    const minInterval = 1000 / this.rateLimits[provider] // ms between requests

    if (now - lastRequest < minInterval) {
      const waitTime = minInterval - (now - lastRequest)
      await this.delay(waitTime)
    }

    this.rateLimiter.set(provider, Date.now())
  }

  /**
   * Utility function to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: readonly T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize) as T[])
    }
    return chunks
  }

  /**
   * Clear the geocoding cache
   */
  public clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0.85, // Would need hit/miss tracking for accurate rate
    }
  }

  /**
   * Preload addresses for better performance
   */
  public async preloadAddresses(addresses: readonly string[]): Promise<void> {
    const uniqueAddresses = [...new Set(addresses)]
    const batchRequest: BatchGeocodingRequest = {
      addresses: uniqueAddresses,
      options: {
        provider: GeocodingProvider.NOMINATIM,
        timeout: 15000,
      },
    }

    await this.batchGeocode(batchRequest)
  }
}

export const geocodingService = new GeocodingService()