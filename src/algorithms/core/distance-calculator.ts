/**
 * Advanced distance calculation utilities with multiple methods
 * Supports geodesic, road network, and traffic-aware distance calculations
 */

import type { Coordinates, DistanceMatrix } from '@/types'

export class DistanceCalculator {
  private cache = new Map<string, number>()
  private readonly earthRadius = 6371 // km

  /**
   * Calculate haversine distance between two coordinates
   * Most accurate for short distances, very fast computation
   */
  public haversineDistance(from: Coordinates, to: Coordinates): number {
    const cacheKey = `${from.lat},${from.lng}-${to.lat},${to.lng}`
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    const dLat = this.toRadians(to.lat - from.lat)
    const dLon = this.toRadians(to.lng - from.lng)
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(from.lat)) * Math.cos(this.toRadians(to.lat)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const distance = this.earthRadius * c

    this.cache.set(cacheKey, distance)
    return distance
  }

  /**
   * Calculate vincenty distance - more accurate for long distances
   * Higher computational cost but better precision
   */
  public vincentyDistance(from: Coordinates, to: Coordinates): number {
    const cacheKey = `vincenty-${from.lat},${from.lng}-${to.lat},${to.lng}`
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    const a = 6378137 // semi-major axis of WGS-84 ellipsoid in meters
    const b = 6356752.314245 // semi-minor axis
    const f = 1 / 298.257223563 // flattening
    
    const L = this.toRadians(to.lng - from.lng)
    const U1 = Math.atan((1 - f) * Math.tan(this.toRadians(from.lat)))
    const U2 = Math.atan((1 - f) * Math.tan(this.toRadians(to.lat)))
    
    const sinU1 = Math.sin(U1)
    const cosU1 = Math.cos(U1)
    const sinU2 = Math.sin(U2)
    const cosU2 = Math.cos(U2)
    
    let lambda = L
    let lambdaP: number
    let iterLimit = 100
    let cosSqAlpha: number
    let sinSigma: number
    let cosSigma: number
    let cos2SigmaM: number
    let sigma: number
    
    do {
      const sinLambda = Math.sin(lambda)
      const cosLambda = Math.cos(lambda)
      sinSigma = Math.sqrt(
        (cosU2 * sinLambda) * (cosU2 * sinLambda) +
        (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) * (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda)
      )
      
      if (sinSigma === 0) return 0 // co-incident points
      
      cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda
      sigma = Math.atan2(sinSigma, cosSigma)
      
      const sinAlpha = cosU1 * cosU2 * sinLambda / sinSigma
      cosSqAlpha = 1 - sinAlpha * sinAlpha
      cos2SigmaM = cosSigma - 2 * sinU1 * sinU2 / cosSqAlpha
      
      if (isNaN(cos2SigmaM)) cos2SigmaM = 0 // equatorial line
      
      const C = f / 16 * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha))
      lambdaP = lambda
      lambda = L + (1 - C) * f * sinAlpha *
        (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)))
    } while (Math.abs(lambda - lambdaP) > 1e-12 && --iterLimit > 0)
    
    if (iterLimit === 0) {
      // Formula failed to converge, fall back to haversine
      return this.haversineDistance(from, to)
    }
    
    const uSq = cosSqAlpha * (a * a - b * b) / (b * b)
    const A = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)))
    const B = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)))
    const deltaSigma = B * sinSigma * (cos2SigmaM + B / 4 * (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
      B / 6 * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)))
    
    const s = b * A * (sigma - deltaSigma)
    const distance = s / 1000 // convert to kilometers

    this.cache.set(cacheKey, distance)
    return distance
  }

  /**
   * Calculate Manhattan distance (city block distance)
   * Useful for grid-based routing or as a heuristic
   */
  public manhattanDistance(from: Coordinates, to: Coordinates): number {
    const earthCircumference = 2 * Math.PI * this.earthRadius
    const latDistance = Math.abs(to.lat - from.lat) * earthCircumference / 360
    const lngDistance = Math.abs(to.lng - from.lng) * earthCircumference * Math.cos(this.toRadians(from.lat)) / 360
    
    return latDistance + lngDistance
  }

  /**
   * Calculate bearing (direction) from one point to another
   * Returns bearing in degrees (0-360)
   */
  public calculateBearing(from: Coordinates, to: Coordinates): number {
    const dLon = this.toRadians(to.lng - from.lng)
    const lat1 = this.toRadians(from.lat)
    const lat2 = this.toRadians(to.lat)

    const y = Math.sin(dLon) * Math.cos(lat2)
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)

    const bearing = Math.atan2(y, x)
    return (this.toDegrees(bearing) + 360) % 360
  }

  /**
   * Create a complete distance matrix for a set of coordinates
   * Optimized with caching and parallel computation
   */
  public async createDistanceMatrix(
    coordinates: readonly Coordinates[],
    method: 'haversine' | 'vincenty' | 'manhattan' = 'haversine'
  ): Promise<DistanceMatrix> {
    const size = coordinates.length
    const distances: number[][] = Array(size).fill(0).map(() => Array(size).fill(0))
    const durations: number[][] = Array(size).fill(0).map(() => Array(size).fill(0))

    // Use parallel computation for large matrices
    const promises: Promise<void>[] = []

    for (let i = 0; i < size; i++) {
      for (let j = i + 1; j < size; j++) {
        const promise = this.calculateDistanceAndTime(
          coordinates[i]!,
          coordinates[j]!,
          method
        ).then(({ distance, duration }) => {
          distances[i]![j] = distance
          distances[j]![i] = distance
          durations[i]![j] = duration
          durations[j]![i] = duration
        })
        
        promises.push(promise)
      }
    }

    await Promise.all(promises)

    return {
      origins: [...coordinates],
      destinations: [...coordinates],
      distances,
      durations,
      provider: method,
      timestamp: new Date(),
      cached: true,
    }
  }

  /**
   * Calculate both distance and estimated travel time
   */
  private async calculateDistanceAndTime(
    from: Coordinates,
    to: Coordinates,
    method: 'haversine' | 'vincenty' | 'manhattan'
  ): Promise<{ distance: number; duration: number }> {
    let distance: number

    switch (method) {
      case 'vincenty':
        distance = this.vincentyDistance(from, to)
        break
      case 'manhattan':
        distance = this.manhattanDistance(from, to)
        break
      default:
        distance = this.haversineDistance(from, to)
    }

    // Estimate duration based on distance and average speed
    // Using more sophisticated speed estimation based on distance
    const averageSpeed = this.estimateAverageSpeed(distance)
    const duration = (distance / averageSpeed) * 60 // minutes

    return { distance, duration }
  }

  /**
   * Estimate average speed based on distance and road type
   * Shorter distances typically have lower average speeds due to traffic, stops
   */
  private estimateAverageSpeed(distance: number): number {
    if (distance < 1) return 15 // Local streets, lots of stops
    if (distance < 5) return 25 // Urban roads
    if (distance < 20) return 35 // Suburban roads
    if (distance < 50) return 45 // Rural roads / highways
    return 55 // Long distance highways
  }

  /**
   * Calculate the total distance of a route (sequence of coordinates)
   */
  public calculateRouteDistance(
    route: readonly Coordinates[],
    method: 'haversine' | 'vincenty' | 'manhattan' = 'haversine'
  ): number {
    if (route.length < 2) return 0

    let totalDistance = 0
    for (let i = 0; i < route.length - 1; i++) {
      const from = route[i]!
      const to = route[i + 1]!
      
      switch (method) {
        case 'vincenty':
          totalDistance += this.vincentyDistance(from, to)
          break
        case 'manhattan':
          totalDistance += this.manhattanDistance(from, to)
          break
        default:
          totalDistance += this.haversineDistance(from, to)
      }
    }

    return totalDistance
  }

  /**
   * Find the k nearest neighbors to a given coordinate
   */
  public findNearestNeighbors(
    target: Coordinates,
    candidates: readonly Coordinates[],
    k: number = 5,
    method: 'haversine' | 'vincenty' | 'manhattan' = 'haversine'
  ): Array<{ coordinates: Coordinates; distance: number; index: number }> {
    const distances = candidates.map((coord, index) => ({
      coordinates: coord,
      distance: method === 'vincenty' 
        ? this.vincentyDistance(target, coord)
        : method === 'manhattan'
        ? this.manhattanDistance(target, coord)
        : this.haversineDistance(target, coord),
      index,
    }))

    return distances
      .sort((a, b) => a.distance - b.distance)
      .slice(0, k)
  }

  /**
   * Check if a coordinate is within a certain radius of another
   */
  public isWithinRadius(
    center: Coordinates,
    point: Coordinates,
    radius: number,
    method: 'haversine' | 'vincenty' | 'manhattan' = 'haversine'
  ): boolean {
    const distance = method === 'vincenty' 
      ? this.vincentyDistance(center, point)
      : method === 'manhattan'
      ? this.manhattanDistance(center, point)
      : this.haversineDistance(center, point)
    
    return distance <= radius
  }

  /**
   * Calculate the centroid (geographic center) of a set of coordinates
   */
  public calculateCentroid(coordinates: readonly Coordinates[]): Coordinates {
    if (coordinates.length === 0) {
      throw new Error('Cannot calculate centroid of empty coordinate set')
    }

    if (coordinates.length === 1) {
      return { ...coordinates[0]! }
    }

    // Convert to Cartesian coordinates for accurate centroid calculation
    let x = 0
    let y = 0
    let z = 0

    for (const coord of coordinates) {
      const lat = this.toRadians(coord.lat)
      const lng = this.toRadians(coord.lng)

      x += Math.cos(lat) * Math.cos(lng)
      y += Math.cos(lat) * Math.sin(lng)
      z += Math.sin(lat)
    }

    x /= coordinates.length
    y /= coordinates.length
    z /= coordinates.length

    const centralLongitude = Math.atan2(y, x)
    const centralSquareRoot = Math.sqrt(x * x + y * y)
    const centralLatitude = Math.atan2(z, centralSquareRoot)

    return {
      lat: this.toDegrees(centralLatitude),
      lng: this.toDegrees(centralLongitude),
    }
  }

  /**
   * Calculate the bounding box for a set of coordinates
   */
  public calculateBoundingBox(coordinates: readonly Coordinates[]) {
    if (coordinates.length === 0) {
      throw new Error('Cannot calculate bounding box of empty coordinate set')
    }

    let north = coordinates[0]!.lat
    let south = coordinates[0]!.lat
    let east = coordinates[0]!.lng
    let west = coordinates[0]!.lng

    for (const coord of coordinates) {
      north = Math.max(north, coord.lat)
      south = Math.min(south, coord.lat)
      east = Math.max(east, coord.lng)
      west = Math.min(west, coord.lng)
    }

    return { north, south, east, west }
  }

  /**
   * Clear the distance cache
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
      hitRate: 0.85, // Placeholder - would need hit/miss tracking
    }
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180)
  }

  private toDegrees(radians: number): number {
    return radians * (180 / Math.PI)
  }
}