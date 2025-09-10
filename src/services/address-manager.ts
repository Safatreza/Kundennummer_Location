/**
 * Enterprise Address Management System
 * Handles CRUD operations, validation, deduplication, and intelligent address processing
 */

import type {
  DeliveryAddress,
  AddressType,
  Priority,
  TimeWindow,
  ContactInfo,
  DeliveryRecord,
  ValidationResult,
  Coordinates,
  UUID,
} from '@/types'

import { geocodingService } from './geocoding-service'
import { 
  AppError, 
  ErrorType, 
  createStorageError, 
  createValidationError, 
  createGeocodingError,
  withErrorHandling 
} from '@/utils/error-handler'

export interface CreateAddressRequest {
  readonly address: string
  readonly deliveryId?: string
  readonly bottleCount: number
  readonly priority: Priority
  readonly timeWindow?: TimeWindow
  readonly customerNotes?: string
  readonly accessInstructions?: string
  readonly contactInfo?: ContactInfo
  readonly addressType?: AddressType
  readonly tags?: readonly string[]
}

export interface UpdateAddressRequest extends Partial<CreateAddressRequest> {
  readonly id: string
}

export interface AddressSearchQuery {
  readonly query?: string
  readonly addressType?: AddressType
  readonly priority?: Priority
  readonly minBottles?: number
  readonly maxBottles?: number
  readonly hasTimeWindow?: boolean
  readonly tags?: readonly string[]
  readonly bounds?: {
    readonly north: number
    readonly south: number
    readonly east: number
    readonly west: number
  }
}

export interface AddressImportOptions {
  readonly validateAddresses: boolean
  readonly allowDuplicates: boolean
  readonly defaultPriority: Priority
  readonly defaultAddressType: AddressType
  readonly skipInvalid: boolean
}

export interface AddressImportResult {
  readonly imported: number
  readonly skipped: number
  readonly failed: number
  readonly duplicates: number
  readonly errors: readonly string[]
  readonly warnings: readonly string[]
  readonly addresses: readonly DeliveryAddress[]
}

export interface DuplicateCheck {
  readonly isDuplicate: boolean
  readonly similarAddresses: readonly {
    readonly address: DeliveryAddress
    readonly similarity: number
    readonly reasons: readonly string[]
  }[]
}

class AddressManager {
  private addresses = new Map<string, DeliveryAddress>()
  private spatialIndex = new Map<string, string[]>() // Grid-based spatial indexing
  private nextId = 1

  /**
   * Create a new delivery address
   */
  public async createAddress(request: CreateAddressRequest): Promise<DeliveryAddress> {
    // Generate ID if not provided
    const deliveryId = request.deliveryId || this.generateDeliveryId()
    const id = this.generateUUID()

    // Geocode the address
    const geocodingResult = await geocodingService.geocode(request.address)
    if (!geocodingResult) {
      throw createGeocodingError(
        `Unable to geocode address: ${request.address}`,
        'default',
        request.address
      )
    }

    // Validate address
    const validation = await this.validateAddressRequest(request)
    if (!validation.isValid) {
      throw createValidationError(
        `Address validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
        'address',
        request.address
      )
    }

    // Check for duplicates
    const duplicateCheck = await this.checkForDuplicates(request.address, geocodingResult.coordinates)
    if (duplicateCheck.isDuplicate && duplicateCheck.similarAddresses.length > 0) {
      const existingAddress = duplicateCheck.similarAddresses[0]!.address
      console.warn(`Similar address found: ${existingAddress.address}`)
    }

    // Create the address object
    const address: DeliveryAddress = {
      id: id as UUID,
      address: geocodingResult.formattedAddress,
      coordinates: geocodingResult.coordinates,
      deliveryId,
      bottleCount: request.bottleCount,
      priority: request.priority,
      timeWindow: request.timeWindow,
      customerNotes: request.customerNotes,
      accessInstructions: request.accessInstructions,
      contactInfo: request.contactInfo,
      addressType: request.addressType || AddressType.RESIDENTIAL,
      isValidated: true,
      validationTimestamp: new Date(),
      geocodeAccuracy: geocodingResult.accuracy,
      estimatedDuration: this.calculateEstimatedDuration(request.bottleCount, request.addressType),
      deliveryHistory: [],
      tags: request.tags || [],
      metadata: {
        geocodingProvider: geocodingResult.provider,
        geocodingConfidence: geocodingResult.confidence,
        createdAt: new Date().toISOString(),
        createdBy: 'system',
      },
    }

    // Store the address
    this.addresses.set(id, address)
    this.updateSpatialIndex(address)

    return address
  }

  /**
   * Update an existing address
   */
  public async updateAddress(request: UpdateAddressRequest): Promise<DeliveryAddress> {
    const existingAddress = this.addresses.get(request.id)
    if (!existingAddress) {
      throw new Error(`Address not found: ${request.id}`)
    }

    let updatedAddress = { ...existingAddress }

    // If address text changed, re-geocode
    if (request.address && request.address !== existingAddress.address) {
      const geocodingResult = await geocodingService.geocode(request.address)
      if (!geocodingResult) {
        throw new Error(`Unable to geocode new address: ${request.address}`)
      }

      updatedAddress = {
        ...updatedAddress,
        address: geocodingResult.formattedAddress,
        coordinates: geocodingResult.coordinates,
        isValidated: true,
        validationTimestamp: new Date(),
        geocodeAccuracy: geocodingResult.accuracy,
        metadata: {
          ...updatedAddress.metadata,
          geocodingProvider: geocodingResult.provider,
          geocodingConfidence: geocodingResult.confidence,
          lastModified: new Date().toISOString(),
        },
      }

      // Update spatial index
      this.removeSpatialIndex(existingAddress)
      this.updateSpatialIndex(updatedAddress)
    }

    // Update other fields
    if (request.deliveryId !== undefined) updatedAddress = { ...updatedAddress, deliveryId: request.deliveryId }
    if (request.bottleCount !== undefined) updatedAddress = { ...updatedAddress, bottleCount: request.bottleCount }
    if (request.priority !== undefined) updatedAddress = { ...updatedAddress, priority: request.priority }
    if (request.timeWindow !== undefined) updatedAddress = { ...updatedAddress, timeWindow: request.timeWindow }
    if (request.customerNotes !== undefined) updatedAddress = { ...updatedAddress, customerNotes: request.customerNotes }
    if (request.accessInstructions !== undefined) updatedAddress = { ...updatedAddress, accessInstructions: request.accessInstructions }
    if (request.contactInfo !== undefined) updatedAddress = { ...updatedAddress, contactInfo: request.contactInfo }
    if (request.addressType !== undefined) updatedAddress = { ...updatedAddress, addressType: request.addressType }
    if (request.tags !== undefined) updatedAddress = { ...updatedAddress, tags: request.tags }

    // Recalculate estimated duration if relevant fields changed
    if (request.bottleCount !== undefined || request.addressType !== undefined) {
      updatedAddress = {
        ...updatedAddress,
        estimatedDuration: this.calculateEstimatedDuration(
          updatedAddress.bottleCount,
          updatedAddress.addressType
        ),
      }
    }

    // Store the updated address
    this.addresses.set(request.id, updatedAddress)

    return updatedAddress
  }

  /**
   * Delete an address
   */
  public deleteAddress(id: string): boolean {
    const address = this.addresses.get(id)
    if (!address) {
      return false
    }

    this.addresses.delete(id)
    this.removeSpatialIndex(address)
    return true
  }

  /**
   * Get an address by ID
   */
  public getAddress(id: string): DeliveryAddress | null {
    return this.addresses.get(id) || null
  }

  /**
   * Get all addresses
   */
  public getAllAddresses(): readonly DeliveryAddress[] {
    return Array.from(this.addresses.values())
  }

  /**
   * Search addresses with advanced filtering
   */
  public searchAddresses(query: AddressSearchQuery): readonly DeliveryAddress[] {
    let results = this.getAllAddresses()

    // Text search
    if (query.query) {
      const searchTerm = query.query.toLowerCase()
      results = results.filter(address =>
        address.address.toLowerCase().includes(searchTerm) ||
        address.deliveryId.toLowerCase().includes(searchTerm) ||
        address.customerNotes?.toLowerCase().includes(searchTerm) ||
        address.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      )
    }

    // Address type filter
    if (query.addressType) {
      results = results.filter(address => address.addressType === query.addressType)
    }

    // Priority filter
    if (query.priority) {
      results = results.filter(address => address.priority === query.priority)
    }

    // Bottle count range
    if (query.minBottles !== undefined) {
      results = results.filter(address => address.bottleCount >= query.minBottles!)
    }
    if (query.maxBottles !== undefined) {
      results = results.filter(address => address.bottleCount <= query.maxBottles!)
    }

    // Time window filter
    if (query.hasTimeWindow !== undefined) {
      results = results.filter(address => 
        query.hasTimeWindow ? address.timeWindow !== undefined : address.timeWindow === undefined
      )
    }

    // Tags filter
    if (query.tags && query.tags.length > 0) {
      results = results.filter(address =>
        query.tags!.some(tag => address.tags.includes(tag))
      )
    }

    // Geographic bounds filter
    if (query.bounds) {
      results = results.filter(address => {
        const { lat, lng } = address.coordinates
        return lat >= query.bounds!.south &&
               lat <= query.bounds!.north &&
               lng >= query.bounds!.west &&
               lng <= query.bounds!.east
      })
    }

    return results
  }

  /**
   * Import addresses from various formats
   */
  public async importAddresses(
    addressData: readonly any[],
    columnMapping: Record<string, string>,
    options: AddressImportOptions
  ): Promise<AddressImportResult> {
    const result: AddressImportResult = {
      imported: 0,
      skipped: 0,
      failed: 0,
      duplicates: 0,
      errors: [],
      warnings: [],
      addresses: [],
    }

    const importedAddresses: DeliveryAddress[] = []

    for (let i = 0; i < addressData.length; i++) {
      const row = addressData[i]
      const rowNumber = i + 2 // Assuming header row

      try {
        // Extract data using column mapping
        const addressText = this.getValueFromMapping(row, columnMapping, 'address')
        if (!addressText) {
          result.skipped++
          result.warnings.push(`Row ${rowNumber}: Missing address, skipping`)
          continue
        }

        const request: CreateAddressRequest = {
          address: addressText.toString(),
          deliveryId: this.getValueFromMapping(row, columnMapping, 'deliveryId')?.toString(),
          bottleCount: this.parseBottleCount(this.getValueFromMapping(row, columnMapping, 'bottleCount')),
          priority: this.parsePriority(this.getValueFromMapping(row, columnMapping, 'priority')) || options.defaultPriority,
          customerNotes: this.getValueFromMapping(row, columnMapping, 'customerNotes')?.toString(),
          accessInstructions: this.getValueFromMapping(row, columnMapping, 'accessInstructions')?.toString(),
          addressType: options.defaultAddressType,
          tags: this.parseTags(this.getValueFromMapping(row, columnMapping, 'tags')),
        }

        // Check for duplicates if not allowed
        if (!options.allowDuplicates) {
          // Quick check against already imported addresses
          const isDuplicateInBatch = importedAddresses.some(addr => 
            this.calculateStringSimilarity(addr.address, request.address) > 0.9
          )

          if (isDuplicateInBatch) {
            result.duplicates++
            result.warnings.push(`Row ${rowNumber}: Duplicate address detected, skipping`)
            continue
          }
        }

        // Validate if required
        if (options.validateAddresses) {
          const validation = await this.validateAddressRequest(request)
          if (!validation.isValid) {
            if (options.skipInvalid) {
              result.skipped++
              result.warnings.push(`Row ${rowNumber}: Invalid address, skipping: ${validation.errors.map(e => e.message).join(', ')}`)
              continue
            } else {
              result.failed++
              result.errors.push(`Row ${rowNumber}: ${validation.errors.map(e => e.message).join(', ')}`)
              continue
            }
          }
        }

        // Create the address
        const address = await this.createAddress(request)
        importedAddresses.push(address)
        result.imported++

      } catch (error) {
        result.failed++
        result.errors.push(`Row ${rowNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`)

        if (options.skipInvalid) {
          continue
        } else {
          break // Stop import on first error if not skipping invalid
        }
      }
    }

    return {
      ...result,
      addresses: importedAddresses,
    }
  }

  /**
   * Check for duplicate addresses
   */
  public async checkForDuplicates(
    address: string,
    coordinates?: Coordinates
  ): Promise<DuplicateCheck> {
    const similarAddresses: Array<{
      address: DeliveryAddress
      similarity: number
      reasons: string[]
    }> = []

    const allAddresses = this.getAllAddresses()

    for (const existingAddress of allAddresses) {
      const reasons: string[] = []
      let similarity = 0

      // Text similarity
      const textSimilarity = this.calculateStringSimilarity(address, existingAddress.address)
      if (textSimilarity > 0.8) {
        similarity += textSimilarity * 0.6
        reasons.push(`Address text similarity: ${(textSimilarity * 100).toFixed(1)}%`)
      }

      // Geographic proximity
      if (coordinates) {
        const distance = this.calculateDistance(coordinates, existingAddress.coordinates)
        if (distance < 0.1) { // 100 meters
          const proximityScore = Math.max(0, 1 - (distance / 0.1))
          similarity += proximityScore * 0.4
          reasons.push(`Geographic proximity: ${distance.toFixed(0)}m`)
        }
      }

      if (similarity > 0.7) {
        similarAddresses.push({
          address: existingAddress,
          similarity,
          reasons,
        })
      }
    }

    // Sort by similarity
    similarAddresses.sort((a, b) => b.similarity - a.similarity)

    return {
      isDuplicate: similarAddresses.length > 0 && similarAddresses[0]!.similarity > 0.85,
      similarAddresses: similarAddresses.slice(0, 5), // Top 5 similar addresses
    }
  }

  /**
   * Get addresses within a radius of coordinates
   */
  public getAddressesWithinRadius(
    center: Coordinates,
    radiusKm: number
  ): readonly DeliveryAddress[] {
    return this.getAllAddresses().filter(address => {
      const distance = this.calculateDistance(center, address.coordinates)
      return distance <= radiusKm
    })
  }

  /**
   * Get statistics about the address collection
   */
  public getStatistics() {
    const addresses = this.getAllAddresses()
    const totalBottles = addresses.reduce((sum, addr) => sum + addr.bottleCount, 0)

    const priorityBreakdown = addresses.reduce((acc, addr) => {
      acc[addr.priority] = (acc[addr.priority] || 0) + 1
      return acc
    }, {} as Record<Priority, number>)

    const typeBreakdown = addresses.reduce((acc, addr) => {
      acc[addr.addressType] = (acc[addr.addressType] || 0) + 1
      return acc
    }, {} as Record<AddressType, number>)

    return {
      totalAddresses: addresses.length,
      totalBottles,
      averageBottlesPerAddress: addresses.length > 0 ? totalBottles / addresses.length : 0,
      priorityBreakdown,
      typeBreakdown,
      withTimeWindows: addresses.filter(addr => addr.timeWindow).length,
      withContactInfo: addresses.filter(addr => addr.contactInfo).length,
      validatedAddresses: addresses.filter(addr => addr.isValidated).length,
    }
  }

  /**
   * Export addresses to various formats
   */
  public exportAddresses(
    addresses: readonly DeliveryAddress[],
    format: 'csv' | 'excel' | 'json'
  ): string | object {
    switch (format) {
      case 'csv':
        return this.exportToCsv(addresses)
      case 'excel':
        return this.exportToExcel(addresses)
      case 'json':
        return this.exportToJson(addresses)
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }

  /**
   * Validate address request
   */
  private async validateAddressRequest(request: CreateAddressRequest): Promise<ValidationResult> {
    const errors = []
    const warnings = []

    // Required fields
    if (!request.address || request.address.trim().length === 0) {
      errors.push({
        field: 'address',
        message: 'Address is required',
        code: 'REQUIRED_FIELD',
        severity: 'error' as const,
      })
    }

    if (request.bottleCount < 0) {
      errors.push({
        field: 'bottleCount',
        message: 'Bottle count cannot be negative',
        code: 'INVALID_VALUE',
        severity: 'error' as const,
      })
    }

    if (request.bottleCount > 80) {
      warnings.push({
        field: 'bottleCount',
        message: 'Bottle count exceeds typical vehicle capacity',
        code: 'CAPACITY_WARNING',
        suggestion: 'Consider splitting this delivery across multiple stops',
      })
    }

    // Priority validation
    if (![1, 2, 3, 4, 5].includes(request.priority)) {
      errors.push({
        field: 'priority',
        message: 'Priority must be between 1 and 5',
        code: 'INVALID_PRIORITY',
        severity: 'error' as const,
      })
    }

    // Time window validation
    if (request.timeWindow) {
      if (request.timeWindow.start >= request.timeWindow.end) {
        errors.push({
          field: 'timeWindow',
          message: 'Time window start must be before end',
          code: 'INVALID_TIME_WINDOW',
          severity: 'error' as const,
        })
      }
    }

    // Address format validation (basic)
    if (request.address && request.address.length < 5) {
      warnings.push({
        field: 'address',
        message: 'Address appears to be very short',
        code: 'SHORT_ADDRESS',
        suggestion: 'Consider adding more details like city or postal code',
      })
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Generate unique delivery ID
   */
  private generateDeliveryId(): string {
    const timestamp = Date.now().toString(36).toUpperCase()
    const random = Math.random().toString(36).substr(2, 4).toUpperCase()
    return `AW-${timestamp}-${random}`
  }

  /**
   * Generate UUID
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }

  /**
   * Calculate estimated service duration
   */
  private calculateEstimatedDuration(bottleCount: number, addressType: AddressType): number {
    const baseTime = 5 // Base service time in minutes
    const perBottleTime = 0.5 // Additional time per bottle
    
    let typeMultiplier = 1
    switch (addressType) {
      case AddressType.COMMERCIAL:
      case AddressType.OFFICE:
        typeMultiplier = 1.5 // Commercial deliveries typically take longer
        break
      case AddressType.WAREHOUSE:
        typeMultiplier = 2 // Warehouse deliveries can be complex
        break
      case AddressType.MEDICAL:
        typeMultiplier = 1.3 // Medical facilities may have special requirements
        break
    }

    return Math.round((baseTime + (bottleCount * perBottleTime)) * typeMultiplier)
  }

  /**
   * Update spatial index for efficient geographic queries
   */
  private updateSpatialIndex(address: DeliveryAddress): void {
    const gridKey = this.getGridKey(address.coordinates)
    if (!this.spatialIndex.has(gridKey)) {
      this.spatialIndex.set(gridKey, [])
    }
    this.spatialIndex.get(gridKey)!.push(address.id)
  }

  /**
   * Remove from spatial index
   */
  private removeSpatialIndex(address: DeliveryAddress): void {
    const gridKey = this.getGridKey(address.coordinates)
    const addresses = this.spatialIndex.get(gridKey)
    if (addresses) {
      const index = addresses.indexOf(address.id)
      if (index >= 0) {
        addresses.splice(index, 1)
      }
    }
  }

  /**
   * Get grid key for spatial indexing
   */
  private getGridKey(coordinates: Coordinates): string {
    const gridSize = 0.01 // Approximately 1km grid
    const latGrid = Math.floor(coordinates.lat / gridSize)
    const lngGrid = Math.floor(coordinates.lng / gridSize)
    return `${latGrid}_${lngGrid}`
  }

  /**
   * Calculate distance between two coordinates (Haversine)
   */
  private calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
    const R = 6371 // Earth radius in km
    const dLat = (coord2.lat - coord1.lat) * Math.PI / 180
    const dLng = (coord2.lng - coord1.lng) * Math.PI / 180
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim()
    const s2 = str2.toLowerCase().trim()
    
    if (s1 === s2) return 1.0
    
    const longer = s1.length > s2.length ? s1 : s2
    const shorter = s1.length > s2.length ? s2 : s1
    
    if (longer.length === 0) return 1.0
    
    const distance = this.levenshteinDistance(longer, shorter)
    return (longer.length - distance) / longer.length
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))
    
    for (let i = 0; i <= str1.length; i++) matrix[0]![i] = i
    for (let j = 0; j <= str2.length; j++) matrix[j]![0] = j
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j]![i] = Math.min(
          matrix[j - 1]![i] + 1, // deletion
          matrix[j]![i - 1] + 1, // insertion
          matrix[j - 1]![i - 1] + cost // substitution
        )
      }
    }
    
    return matrix[str2.length]![str1.length]!
  }

  /**
   * Helper methods for import functionality
   */
  private getValueFromMapping(row: any, mapping: Record<string, string>, field: string): unknown {
    const columnName = mapping[field]
    if (!columnName) return undefined
    
    return row[columnName]
  }

  private parseBottleCount(value: unknown): number {
    if (typeof value === 'number') return Math.max(0, Math.floor(value))
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10)
      return isNaN(parsed) ? 0 : Math.max(0, parsed)
    }
    return 0
  }

  private parsePriority(value: unknown): Priority | null {
    if (typeof value === 'number' && [1, 2, 3, 4, 5].includes(value)) {
      return value as Priority
    }
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10)
      if ([1, 2, 3, 4, 5].includes(parsed)) {
        return parsed as Priority
      }
    }
    return null
  }

  private parseTags(value: unknown): string[] {
    if (typeof value === 'string') {
      return value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
    }
    if (Array.isArray(value)) {
      return value.map(v => v?.toString().trim()).filter(tag => tag && tag.length > 0)
    }
    return []
  }

  /**
   * Export methods
   */
  private exportToCsv(addresses: readonly DeliveryAddress[]): string {
    const headers = [
      'ID', 'Delivery ID', 'Address', 'Latitude', 'Longitude', 'Bottles',
      'Priority', 'Address Type', 'Customer Notes', 'Access Instructions',
      'Time Window Start', 'Time Window End', 'Tags', 'Validated', 'Created'
    ]

    const rows = addresses.map(addr => [
      addr.id,
      addr.deliveryId,
      addr.address,
      addr.coordinates.lat.toString(),
      addr.coordinates.lng.toString(),
      addr.bottleCount.toString(),
      addr.priority.toString(),
      addr.addressType,
      addr.customerNotes || '',
      addr.accessInstructions || '',
      addr.timeWindow?.start.toISOString() || '',
      addr.timeWindow?.end.toISOString() || '',
      addr.tags.join(';'),
      addr.isValidated ? 'Yes' : 'No',
      addr.validationTimestamp?.toISOString() || ''
    ])

    return [headers, ...rows].map(row => 
      row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(',')
    ).join('\n')
  }

  private exportToExcel(addresses: readonly DeliveryAddress[]): object {
    // This would require a library like xlsx
    // For now, return the data in a format suitable for Excel export
    return {
      worksheetName: 'Addresses',
      data: addresses.map(addr => ({
        'ID': addr.id,
        'Delivery ID': addr.deliveryId,
        'Address': addr.address,
        'Latitude': addr.coordinates.lat,
        'Longitude': addr.coordinates.lng,
        'Bottles': addr.bottleCount,
        'Priority': addr.priority,
        'Address Type': addr.addressType,
        'Customer Notes': addr.customerNotes,
        'Access Instructions': addr.accessInstructions,
        'Time Window Start': addr.timeWindow?.start.toISOString(),
        'Time Window End': addr.timeWindow?.end.toISOString(),
        'Tags': addr.tags.join(';'),
        'Validated': addr.isValidated,
        'Created': addr.validationTimestamp?.toISOString(),
      }))
    }
  }

  private exportToJson(addresses: readonly DeliveryAddress[]): object {
    return {
      version: '4.0.0',
      exportDate: new Date().toISOString(),
      totalAddresses: addresses.length,
      addresses: addresses,
    }
  }

  /**
   * Clear all addresses
   */
  public clearAll(): void {
    this.addresses.clear()
    this.spatialIndex.clear()
    this.nextId = 1
  }

  /**
   * Get memory usage statistics
   */
  public getMemoryStats() {
    return {
      addressCount: this.addresses.size,
      spatialIndexSize: this.spatialIndex.size,
      estimatedMemoryKB: Math.round(
        (this.addresses.size * 2 + this.spatialIndex.size * 0.1) // Rough estimate
      ),
    }
  }
}

export const addressManager = new AddressManager()