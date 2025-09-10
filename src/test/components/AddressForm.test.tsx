import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render, createMockAddress } from '../utils/test-utils'
import AddressForm from '../../components/forms/AddressForm'

// Mock the address manager
const mockAddressManager = {
  addAddress: vi.fn(),
  validateAddressRequest: vi.fn().mockResolvedValue({
    isValid: true,
    errors: [],
  }),
}

vi.mock('../../services/address-manager', () => ({
  addressManager: mockAddressManager,
}))

describe('AddressForm', () => {
  const mockOnAddressAdded = vi.fn()
  const mockOnError = vi.fn()
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all form fields', () => {
    render(
      <AddressForm
        onAddressAdded={mockOnAddressAdded}
        onError={mockOnError}
      />
    )

    expect(screen.getByLabelText(/delivery address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/delivery id/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/bottle count/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/priority/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add address/i })).toBeInTheDocument()
  })

  it('validates required fields', async () => {
    render(
      <AddressForm
        onAddressAdded={mockOnAddressAdded}
        onError={mockOnError}
      />
    )

    const submitButton = screen.getByRole('button', { name: /add address/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/address is required/i)).toBeInTheDocument()
      expect(screen.getByText(/delivery id is required/i)).toBeInTheDocument()
    })

    expect(mockAddressManager.addAddress).not.toHaveBeenCalled()
  })

  it('validates bottle count range', async () => {
    render(
      <AddressForm
        onAddressAdded={mockOnAddressAdded}
        onError={mockOnError}
      />
    )

    const bottleInput = screen.getByLabelText(/bottle count/i)
    await user.type(bottleInput, '0')

    const submitButton = screen.getByRole('button', { name: /add address/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/must be at least 1/i)).toBeInTheDocument()
    })
  })

  it('submits form with valid data', async () => {
    const mockAddress = createMockAddress()
    mockAddressManager.addAddress.mockResolvedValue(mockAddress)

    render(
      <AddressForm
        onAddressAdded={mockOnAddressAdded}
        onError={mockOnError}
      />
    )

    // Fill out the form
    await user.type(screen.getByLabelText(/delivery address/i), '123 Test Street')
    await user.type(screen.getByLabelText(/delivery id/i), 'DEL-001')
    await user.type(screen.getByLabelText(/bottle count/i), '5')
    
    // Select priority
    const prioritySelect = screen.getByLabelText(/priority/i)
    await user.click(prioritySelect)
    await user.click(screen.getByText(/medium/i))

    // Submit form
    const submitButton = screen.getByRole('button', { name: /add address/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockAddressManager.addAddress).toHaveBeenCalledWith({
        address: '123 Test Street',
        deliveryId: 'DEL-001',
        bottleCount: 5,
        priority: 'MEDIUM',
        timeWindow: undefined,
        customerNotes: '',
        accessInstructions: '',
        contactInfo: undefined,
        addressType: 'RESIDENTIAL',
        tags: [],
      })
    })

    expect(mockOnAddressAdded).toHaveBeenCalledWith(mockAddress)
  })

  it('handles form submission errors', async () => {
    const errorMessage = 'Geocoding failed'
    mockAddressManager.addAddress.mockRejectedValue(new Error(errorMessage))

    render(
      <AddressForm
        onAddressAdded={mockOnAddressAdded}
        onError={mockOnError}
      />
    )

    // Fill out required fields
    await user.type(screen.getByLabelText(/delivery address/i), '123 Test Street')
    await user.type(screen.getByLabelText(/delivery id/i), 'DEL-001')
    await user.type(screen.getByLabelText(/bottle count/i), '5')

    // Submit form
    const submitButton = screen.getByRole('button', { name: /add address/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(errorMessage)
    })

    expect(mockOnAddressAdded).not.toHaveBeenCalled()
  })

  it('resets form after successful submission', async () => {
    const mockAddress = createMockAddress()
    mockAddressManager.addAddress.mockResolvedValue(mockAddress)

    render(
      <AddressForm
        onAddressAdded={mockOnAddressAdded}
        onError={mockOnError}
      />
    )

    // Fill out and submit form
    const addressInput = screen.getByLabelText(/delivery address/i)
    const deliveryIdInput = screen.getByLabelText(/delivery id/i)
    const bottleCountInput = screen.getByLabelText(/bottle count/i)

    await user.type(addressInput, '123 Test Street')
    await user.type(deliveryIdInput, 'DEL-001')
    await user.type(bottleCountInput, '5')

    const submitButton = screen.getByRole('button', { name: /add address/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockOnAddressAdded).toHaveBeenCalled()
    })

    // Check that form is reset
    expect(addressInput).toHaveValue('')
    expect(deliveryIdInput).toHaveValue('')
    expect(bottleCountInput).toHaveValue('1')
  })

  it('disables submit button while submitting', async () => {
    let resolveAddAddress: (value: any) => void
    const addAddressPromise = new Promise(resolve => {
      resolveAddAddress = resolve
    })
    mockAddressManager.addAddress.mockReturnValue(addAddressPromise)

    render(
      <AddressForm
        onAddressAdded={mockOnAddressAdded}
        onError={mockOnError}
      />
    )

    // Fill out form
    await user.type(screen.getByLabelText(/delivery address/i), '123 Test Street')
    await user.type(screen.getByLabelText(/delivery id/i), 'DEL-001')
    await user.type(screen.getByLabelText(/bottle count/i), '5')

    // Submit form
    const submitButton = screen.getByRole('button', { name: /add address/i })
    await user.click(submitButton)

    // Button should be disabled while submitting
    expect(submitButton).toBeDisabled()
    expect(screen.getByText(/adding address/i)).toBeInTheDocument()

    // Resolve the promise
    resolveAddAddress!(createMockAddress())

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled()
    })
  })

  it('handles time window input correctly', async () => {
    const mockAddress = createMockAddress()
    mockAddressManager.addAddress.mockResolvedValue(mockAddress)

    render(
      <AddressForm
        onAddressAdded={mockOnAddressAdded}
        onError={mockOnError}
      />
    )

    // Fill required fields
    await user.type(screen.getByLabelText(/delivery address/i), '123 Test Street')
    await user.type(screen.getByLabelText(/delivery id/i), 'DEL-001')
    await user.type(screen.getByLabelText(/bottle count/i), '5')

    // Fill time window
    const startTimeInput = screen.getByLabelText(/start time/i)
    const endTimeInput = screen.getByLabelText(/end time/i)
    
    await user.type(startTimeInput, '09:00')
    await user.type(endTimeInput, '17:00')

    const submitButton = screen.getByRole('button', { name: /add address/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockAddressManager.addAddress).toHaveBeenCalledWith(
        expect.objectContaining({
          timeWindow: {
            start: '09:00',
            end: '17:00',
          },
        })
      )
    })
  })
})