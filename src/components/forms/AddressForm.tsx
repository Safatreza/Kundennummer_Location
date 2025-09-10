import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { MapPin, Package, Clock, User, AlertCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { addressManager } from '@/services/address-manager'
import type { CreateAddressRequest, AddressType, Priority } from '@/types'

const addressFormSchema = z.object({
  address: z.string().min(5, 'Address must be at least 5 characters'),
  deliveryId: z.string().optional(),
  bottleCount: z.coerce
    .number()
    .min(0, 'Bottle count cannot be negative')
    .max(80, 'Bottle count cannot exceed 80'),
  priority: z.coerce.number().min(1).max(5).default(5),
  customerNotes: z.string().optional(),
  accessInstructions: z.string().optional(),
  addressType: z.enum(['RESIDENTIAL', 'COMMERCIAL', 'OFFICE', 'WAREHOUSE', 'MEDICAL', 'EMERGENCY']).default('RESIDENTIAL'),
})

type AddressFormData = z.infer<typeof addressFormSchema>

interface AddressFormProps {
  onAddressAdded?: (address: any) => void
  onError?: (error: string) => void
}

export const AddressForm: React.FC<AddressFormProps> = ({
  onAddressAdded,
  onError,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string>('')

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AddressFormData>({
    resolver: zodResolver(addressFormSchema),
    defaultValues: {
      bottleCount: 0,
      priority: 5,
      addressType: 'RESIDENTIAL',
    },
  })

  const priorityOptions = [
    { value: 1, label: 'Critical (1)', color: 'text-red-600' },
    { value: 2, label: 'High (2)', color: 'text-orange-600' },
    { value: 3, label: 'Medium (3)', color: 'text-yellow-600' },
    { value: 4, label: 'Low (4)', color: 'text-green-600' },
    { value: 5, label: 'Standard (5)', color: 'text-gray-600' },
  ]

  const addressTypeOptions = [
    { value: 'RESIDENTIAL', label: 'Residential', icon: '🏠' },
    { value: 'COMMERCIAL', label: 'Commercial', icon: '🏢' },
    { value: 'OFFICE', label: 'Office', icon: '🏬' },
    { value: 'WAREHOUSE', label: 'Warehouse', icon: '🏭' },
    { value: 'MEDICAL', label: 'Medical', icon: '🏥' },
    { value: 'EMERGENCY', label: 'Emergency', icon: '🚨' },
  ]

  const onSubmit = async (data: AddressFormData) => {
    setIsSubmitting(true)
    setSubmitError('')

    try {
      const request: CreateAddressRequest = {
        address: data.address,
        deliveryId: data.deliveryId,
        bottleCount: data.bottleCount,
        priority: data.priority as Priority,
        customerNotes: data.customerNotes,
        accessInstructions: data.accessInstructions,
        addressType: data.addressType as AddressType,
      }

      const newAddress = await addressManager.createAddress(request)
      
      // Success feedback
      onAddressAdded?.(newAddress)
      
      // Reset form
      reset()
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add address'
      setSubmitError(errorMessage)
      onError?.(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const generateDeliveryId = () => {
    const timestamp = Date.now().toString(36).toUpperCase()
    const random = Math.random().toString(36).substr(2, 4).toUpperCase()
    setValue('deliveryId', `AW-${timestamp}-${random}`)
  }

  const watchedBottleCount = watch('bottleCount')
  const watchedPriority = watch('priority')

  return (
    <Card className="w-full max-w-2xl mx-auto animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <MapPin className="h-5 w-5 text-primary" />
          <span>Add Delivery Address</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Address Input */}
          <div className="space-y-2">
            <label htmlFor="address" className="text-sm font-medium text-foreground">
              Delivery Address *
            </label>
            <Input
              id="address"
              placeholder="e.g. München, Deutschland"
              icon={<MapPin className="h-4 w-4" />}
              error={errors.address?.message}
              {...register('address')}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Delivery ID */}
            <div className="space-y-2">
              <label htmlFor="deliveryId" className="text-sm font-medium text-foreground">
                Delivery ID
              </label>
              <div className="flex space-x-2">
                <Input
                  id="deliveryId"
                  placeholder="Auto-generated"
                  {...register('deliveryId')}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={generateDeliveryId}
                  className="shrink-0"
                >
                  <span className="text-xs">Gen</span>
                </Button>
              </div>
            </div>

            {/* Bottle Count */}
            <div className="space-y-2">
              <label htmlFor="bottleCount" className="text-sm font-medium text-foreground">
                Bottles
              </label>
              <Input
                id="bottleCount"
                type="number"
                min="0"
                max="80"
                placeholder="0"
                icon={<Package className="h-4 w-4" />}
                error={errors.bottleCount?.message}
                {...register('bottleCount')}
              />
              {watchedBottleCount > 60 && (
                <p className="text-xs text-yellow-600 flex items-center space-x-1">
                  <AlertCircle className="h-3 w-3" />
                  <span>High bottle count may require multiple trips</span>
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Priority */}
            <div className="space-y-2">
              <label htmlFor="priority" className="text-sm font-medium text-foreground">
                Priority
              </label>
              <Select
                value={watchedPriority.toString()}
                onValueChange={(value) => setValue('priority', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      <span className={option.color}>{option.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Address Type */}
            <div className="space-y-2">
              <label htmlFor="addressType" className="text-sm font-medium text-foreground">
                Address Type
              </label>
              <Select
                onValueChange={(value) => setValue('addressType', value as AddressType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {addressTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="flex items-center space-x-2">
                        <span>{option.icon}</span>
                        <span>{option.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Customer Notes */}
          <div className="space-y-2">
            <label htmlFor="customerNotes" className="text-sm font-medium text-foreground">
              Customer Notes
            </label>
            <Input
              id="customerNotes"
              placeholder="Special delivery instructions or notes"
              icon={<User className="h-4 w-4" />}
              {...register('customerNotes')}
            />
          </div>

          {/* Access Instructions */}
          <div className="space-y-2">
            <label htmlFor="accessInstructions" className="text-sm font-medium text-foreground">
              Access Instructions
            </label>
            <Input
              id="accessInstructions"
              placeholder="Building access, gate codes, parking info, etc."
              icon={<Clock className="h-4 w-4" />}
              {...register('accessInstructions')}
            />
          </div>

          {/* Submit Error */}
          {submitError && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive flex items-center space-x-2">
                <AlertCircle className="h-4 w-4" />
                <span>{submitError}</span>
              </p>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            variant="aboutwater"
            size="lg"
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Adding Address...' : 'Add Address'}
          </Button>

          {/* Form Helper Text */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Address will be automatically geocoded and validated</p>
            <p>• Higher priority deliveries (lower numbers) will be scheduled first</p>
            <p>• Bottle counts above 60 may be split across multiple vehicles</p>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export default AddressForm