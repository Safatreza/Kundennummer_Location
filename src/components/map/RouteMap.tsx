import React, { useEffect, useRef, useState, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import { LatLngBounds, Icon, divIcon } from 'leaflet'
import { Maximize2, Minimize2, RotateCcw, Layers } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { DeliveryAddress, OptimizedTour, Coordinates } from '@/types'

// Fix for default markers in react-leaflet
delete (Icon.Default.prototype as any)._getIconUrl
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

interface RouteMapProps {
  addresses: readonly DeliveryAddress[]
  tours: readonly OptimizedTour[]
  hqLocation: Coordinates
  onAddressClick?: (address: DeliveryAddress) => void
  onTourClick?: (tour: OptimizedTour) => void
  selectedAddresses?: readonly string[]
  selectedTour?: string | null
  showRoutes?: boolean
  className?: string
}

const TOUR_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', 
  '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b'
]

// Custom HQ Marker
const createHQMarker = () => divIcon({
  html: '<div class="hq-marker">HQ</div>',
  className: 'custom-marker',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
})

// Custom Address Marker
const createAddressMarker = (bottleCount: number, isSelected = false) => divIcon({
  html: `<div class="address-marker ${isSelected ? 'ring-4 ring-blue-400' : ''}">${bottleCount}</div>`,
  className: 'custom-marker',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
})

// Custom Tour Marker
const createTourMarker = (stopOrder: number, tourNumber: number, isSelected = false) => {
  const color = TOUR_COLORS[(tourNumber - 1) % TOUR_COLORS.length]
  return divIcon({
    html: `<div class="tour-marker tour-${tourNumber} ${isSelected ? 'ring-4 ring-white' : ''}" style="background: ${color}">${stopOrder}</div>`,
    className: 'custom-marker',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  })
}

// Map bounds controller component
const MapBoundsController: React.FC<{
  addresses: readonly DeliveryAddress[]
  hqLocation: Coordinates
  autoFit: boolean
}> = ({ addresses, hqLocation, autoFit }) => {
  const map = useMap()

  useEffect(() => {
    if (!autoFit || addresses.length === 0) return

    const bounds = new LatLngBounds([
      [hqLocation.lat, hqLocation.lng]
    ])

    addresses.forEach(address => {
      bounds.extend([address.coordinates.lat, address.coordinates.lng])
    })

    // Add padding to bounds
    map.fitBounds(bounds, { padding: [20, 20] })
  }, [map, addresses, hqLocation, autoFit])

  return null
}

// Map controls component
const MapControls: React.FC<{
  isFullscreen: boolean
  onFullscreenToggle: () => void
  onReset: () => void
  onLayerToggle: () => void
  showSatellite: boolean
}> = ({ isFullscreen, onFullscreenToggle, onReset, onLayerToggle, showSatellite }) => {
  return (
    <div className="absolute top-4 right-4 z-[1000] flex flex-col space-y-2">
      <Button
        variant="outline"
        size="icon"
        className="glass-morphism hover:bg-white/20"
        onClick={onFullscreenToggle}
        title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      >
        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </Button>
      
      <Button
        variant="outline"
        size="icon"
        className="glass-morphism hover:bg-white/20"
        onClick={onReset}
        title="Reset view"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
      
      <Button
        variant="outline"
        size="icon"
        className="glass-morphism hover:bg-white/20"
        onClick={onLayerToggle}
        title={showSatellite ? 'Switch to street map' : 'Switch to satellite'}
      >
        <Layers className="h-4 w-4" />
      </Button>
    </div>
  )
}

// Loading overlay component
const MapLoadingOverlay: React.FC<{ isLoading: boolean }> = ({ isLoading }) => {
  if (!isLoading) return null

  return (
    <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="flex flex-col items-center space-y-4">
        <div className="spinner-xl" />
        <p className="text-sm text-muted-foreground">Loading map...</p>
      </div>
    </div>
  )
}

export const RouteMap: React.FC<RouteMapProps> = ({
  addresses,
  tours,
  hqLocation,
  onAddressClick,
  onTourClick,
  selectedAddresses = [],
  selectedTour = null,
  showRoutes = true,
  className = '',
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showSatellite, setShowSatellite] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [mapKey, setMapKey] = useState(0) // Force re-render key
  const mapRef = useRef<any>(null)

  // Handle fullscreen toggle
  const handleFullscreenToggle = useCallback(() => {
    setIsFullscreen(prev => !prev)
  }, [])

  // Handle map reset
  const handleReset = useCallback(() => {
    setMapKey(prev => prev + 1)
  }, [])

  // Handle layer toggle
  const handleLayerToggle = useCallback(() => {
    setShowSatellite(prev => !prev)
  }, [])

  // Map loading handler
  const handleMapReady = useCallback(() => {
    setIsLoading(false)
  }, [])

  // Create route polylines for tours
  const createRoutePolylines = () => {
    if (!showRoutes || tours.length === 0) return []

    return tours.map((tour, index) => {
      const color = TOUR_COLORS[index % TOUR_COLORS.length]
      const isSelected = selectedTour === tour.id
      
      // Create route coordinates: HQ -> addresses -> HQ
      const routeCoords: [number, number][] = [
        [hqLocation.lat, hqLocation.lng],
        ...tour.addresses.map(addr => [addr.coordinates.lat, addr.coordinates.lng] as [number, number]),
        [hqLocation.lat, hqLocation.lng],
      ]

      return (
        <Polyline
          key={`route-${tour.id}`}
          positions={routeCoords}
          color={color}
          weight={isSelected ? 6 : 4}
          opacity={isSelected ? 0.9 : 0.7}
          className="route-polyline"
          eventHandlers={{
            click: () => onTourClick?.(tour),
          }}
        />
      )
    })
  }

  // Create address markers
  const createAddressMarkers = () => {
    if (tours.length > 0) {
      // Show optimized tour markers
      return tours.flatMap((tour, tourIndex) =>
        tour.addresses.map((address, stopIndex) => {
          const isSelected = selectedAddresses.includes(address.id) || selectedTour === tour.id
          const marker = createTourMarker(stopIndex + 1, tourIndex + 1, isSelected)

          return (
            <Marker
              key={`tour-marker-${address.id}`}
              position={[address.coordinates.lat, address.coordinates.lng]}
              icon={marker}
              eventHandlers={{
                click: () => onAddressClick?.(address),
              }}
            >
              <Popup className="custom-popup">
                <div className="p-2 space-y-2">
                  <div className="font-semibold text-primary">{address.deliveryId}</div>
                  <div className="text-sm text-muted-foreground">{address.address}</div>
                  <div className="flex items-center justify-between text-xs">
                    <span>Bottles: {address.bottleCount}</span>
                    <span>Priority: {address.priority}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className={`px-2 py-1 rounded text-white tour-${tourIndex + 1}`}>
                      Tour {tourIndex + 1}
                    </span>
                    <span>Stop {stopIndex + 1}</span>
                  </div>
                  {address.customerNotes && (
                    <div className="text-xs text-muted-foreground border-t pt-2">
                      {address.customerNotes}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          )
        })
      )
    } else {
      // Show regular address markers
      return addresses.map(address => {
        const isSelected = selectedAddresses.includes(address.id)
        const marker = createAddressMarker(address.bottleCount, isSelected)

        return (
          <Marker
            key={`address-marker-${address.id}`}
            position={[address.coordinates.lat, address.coordinates.lng]}
            icon={marker}
            eventHandlers={{
              click: () => onAddressClick?.(address),
            }}
          >
            <Popup>
              <div className="p-2 space-y-2">
                <div className="font-semibold text-primary">{address.deliveryId}</div>
                <div className="text-sm text-muted-foreground">{address.address}</div>
                <div className="flex items-center justify-between text-xs">
                  <span>Bottles: {address.bottleCount}</span>
                  <span>Priority: {address.priority}</span>
                </div>
                <div className="text-xs">
                  <span className={`priority-${address.priority <= 2 ? 'high' : address.priority <= 3 ? 'medium' : 'low'} px-2 py-1 rounded`}>
                    {address.priority <= 2 ? 'High' : address.priority <= 3 ? 'Medium' : 'Standard'} Priority
                  </span>
                </div>
                {address.customerNotes && (
                  <div className="text-xs text-muted-foreground border-t pt-2">
                    {address.customerNotes}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        )
      })
    }
  }

  const mapContainerClass = `
    map-container relative h-full w-full
    ${isFullscreen ? 'fixed inset-0 z-[9999]' : ''}
    ${className}
  `

  return (
    <Card className={mapContainerClass}>
      <MapLoadingOverlay isLoading={isLoading} />
      
      <MapContainer
        key={mapKey}
        center={[hqLocation.lat, hqLocation.lng]}
        zoom={10}
        className="h-full w-full rounded-xl"
        zoomControl={false}
        ref={mapRef}
        whenReady={handleMapReady}
      >
        {/* Tile Layers */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url={
            showSatellite
              ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
              : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          }
          maxZoom={19}
        />

        {/* HQ Marker */}
        <Marker position={[hqLocation.lat, hqLocation.lng]} icon={createHQMarker()}>
          <Popup>
            <div className="p-2">
              <div className="font-semibold text-primary">AboutWater HQ</div>
              <div className="text-sm text-muted-foreground">Central Depot</div>
              <div className="text-xs text-muted-foreground mt-1">
                All routes start and end here
              </div>
            </div>
          </Popup>
        </Marker>

        {/* Address Markers */}
        {createAddressMarkers()}

        {/* Route Polylines */}
        {createRoutePolylines()}

        {/* Auto-fit bounds controller */}
        <MapBoundsController 
          addresses={addresses} 
          hqLocation={hqLocation} 
          autoFit={addresses.length > 0} 
        />
      </MapContainer>

      {/* Map Controls */}
      <MapControls
        isFullscreen={isFullscreen}
        onFullscreenToggle={handleFullscreenToggle}
        onReset={handleReset}
        onLayerToggle={handleLayerToggle}
        showSatellite={showSatellite}
      />

      {/* Map Legend */}
      {tours.length > 0 && (
        <div className="absolute bottom-4 left-4 z-[1000]">
          <Card className="glass-morphism p-3">
            <div className="text-xs font-medium text-foreground mb-2">Route Legend</div>
            <div className="space-y-1">
              {tours.slice(0, 6).map((tour, index) => (
                <div key={tour.id} className="flex items-center space-x-2 text-xs">
                  <div 
                    className="w-3 h-3 rounded-full border-2 border-white"
                    style={{ backgroundColor: TOUR_COLORS[index % TOUR_COLORS.length] }}
                  />
                  <span className="text-foreground">
                    Tour {index + 1} ({tour.addresses.length} stops)
                  </span>
                </div>
              ))}
              {tours.length > 6 && (
                <div className="text-xs text-muted-foreground">
                  +{tours.length - 6} more tours
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Map Statistics */}
      <div className="absolute top-4 left-4 z-[1000]">
        <Card className="glass-morphism p-3">
          <div className="text-xs space-y-1">
            <div className="font-medium text-foreground">Map Statistics</div>
            <div className="text-muted-foreground">Addresses: {addresses.length}</div>
            <div className="text-muted-foreground">Tours: {tours.length}</div>
            {tours.length > 0 && (
              <div className="text-muted-foreground">
                Total Distance: {tours.reduce((sum, tour) => sum + tour.estimatedDistance, 0).toFixed(1)} km
              </div>
            )}
          </div>
        </Card>
      </div>
    </Card>
  )
}

export default RouteMap