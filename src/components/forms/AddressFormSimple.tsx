import React, { useState } from 'react'

interface AddressFormSimpleProps {
  onAddressAdded?: (address: any) => void
  onError?: (error: string) => void
}

export const AddressFormSimple: React.FC<AddressFormSimpleProps> = ({
  onAddressAdded,
  onError,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [address, setAddress] = useState('')
  const [deliveryId, setDeliveryId] = useState('')
  const [bottleCount, setBottleCount] = useState('5')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!address.trim()) {
      onError?.('Address is required')
      return
    }

    if (address.length < 5) {
      onError?.('Address must be at least 5 characters')
      return
    }

    const bottleNum = parseInt(bottleCount) || 5
    if (bottleNum < 1 || bottleNum > 80) {
      onError?.('Bottle count must be between 1 and 80')
      return
    }

    setIsSubmitting(true)

    try {
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Generate random coordinates near Munich
      const randomLat = 48.1375 + (Math.random() - 0.5) * 0.1
      const randomLng = 11.5755 + (Math.random() - 0.5) * 0.1
      
      const newAddress = {
        id: `addr-${Date.now()}`,
        address: address.trim(),
        deliveryId: deliveryId.trim() || `DEL-${Date.now().toString().slice(-4)}`,
        bottleCount: bottleNum,
        coordinates: { lat: randomLat, lng: randomLng },
        timestamp: new Date().toISOString(),
      }

      onAddressAdded?.(newAddress)
      
      // Reset form
      setAddress('')
      setDeliveryId('')
      setBottleCount('5')
      
    } catch (error) {
      onError?.('Failed to add address. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">
          📍 Add Delivery Address
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Delivery Address *
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter full address (e.g., Marienplatz 1, Munich, Germany)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Delivery ID
              </label>
              <input
                type="text"
                value={deliveryId}
                onChange={(e) => setDeliveryId(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSubmitting}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bottle Count
              </label>
              <input
                type="number"
                value={bottleCount}
                onChange={(e) => setBottleCount(e.target.value)}
                min="1"
                max="80"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !address.trim()}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-colors duration-300 ${
              isSubmitting || !address.trim()
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Adding Address...
              </>
            ) : (
              '📍 Add Address'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}