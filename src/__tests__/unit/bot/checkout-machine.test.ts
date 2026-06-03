import { describe, it, expect } from 'vitest'
import { initCheckout, processCheckoutMessage, AI_GENERATE } from '@/lib/bot/checkout-machine'
import type { CheckoutItem, CheckoutSession } from '@/lib/bot/checkout-machine'

const mockItems: CheckoutItem[] = [
  { productName: 'Remera Oversize', quantity: 1, size: 'M', color: 'negro' },
]

describe('Checkout State Machine', () => {
  it('should start at name state from idle', () => {
    const result = initCheckout(mockItems, {})
    expect(result.state).toBe('name')
    expect(result.items).toEqual(mockItems)
  })

  it('should transition name -> dni on valid name input', () => {
    const session: CheckoutSession = {
      state: 'name', items: mockItems, pickup: false,
    }
    const result = processCheckoutMessage('Juan Perez', session)
    expect(result.session.state).toBe('dni')
  })

  it('should transition dni -> shipping on valid DNI', () => {
    const session: CheckoutSession = {
      state: 'dni', items: mockItems, customerName: 'Juan', pickup: false,
    }
    const result = processCheckoutMessage('12345678', session)
    expect(result.session.state).toBe('shipping')
  })

  it('should transition shipping -> address when selecting shipping', () => {
    const session: CheckoutSession = {
      state: 'shipping', items: mockItems, customerName: 'Juan', pickup: false,
    }
    const result = processCheckoutMessage('domicilio', session)
    expect(result.session.state).toBe('address')
  })

  it('should transition shipping -> payment_method when selecting pickup', () => {
    const session: CheckoutSession = {
      state: 'shipping', items: mockItems, customerName: 'Juan', pickup: false,
    }
    const result = processCheckoutMessage('retiro', session)
    expect(result.session.state).toBe('payment_method')
  })

  it('should transition address -> payment_method on valid address', () => {
    const session: CheckoutSession = {
      state: 'address', items: mockItems, customerName: 'Juan',
      shippingMethod: 'shipping', pickup: false,
    }
    const result = processCheckoutMessage('Av. Siempre Viva 123', session)
    expect(result.session.state).toBe('payment_method')
  })

  it('should transition payment_method -> confirm on transfer', () => {
    const session: CheckoutSession = {
      state: 'payment_method', items: mockItems, customerName: 'Juan',
      shippingMethod: 'shipping', address: 'Av. Siempre Viva 123',
      pickup: false,
    }
    const result = processCheckoutMessage('transferencia', session)
    expect(result.session.state).toBe('payment_waiting_proof')
  })

  it('should transition payment_method -> confirm on cash', () => {
    const session: CheckoutSession = {
      state: 'payment_method', items: mockItems, customerName: 'Juan',
      shippingMethod: 'shipping', address: 'Av. Siempre Viva 123',
      pickup: false,
    }
    const result = processCheckoutMessage('efectivo', session)
    expect(result.session.state).toBe('confirm')
  })

  it('should transition confirm -> completed on positive confirmation', () => {
    const session: CheckoutSession = {
      state: 'confirm', items: mockItems, customerName: 'Juan',
      shippingMethod: 'shipping', address: 'Av. Siempre Viva 123',
      paymentMethod: 'cash_on_delivery', pickup: false,
    }
    const result = processCheckoutMessage('si', session)
    expect(result.session.state).toBe('completed')
    expect(result.action?.type).toBe('checkout')
  })

  it('should reset to name from confirm when user says no', () => {
    const session: CheckoutSession = {
      state: 'confirm', items: mockItems, customerName: 'Juan',
      shippingMethod: 'shipping', address: 'Av. Siempre Viva 123',
      paymentMethod: 'cash_on_delivery', pickup: false,
    }
    const result = processCheckoutMessage('no, quiero pagar con transferencia', session)
    // User saying no in confirm state resets the checkout
    expect(result.session.state).toBe('name')
    expect(result.action?.type).not.toBe('checkout')
  })

  it('should mark completed as terminal state (no transition out)', () => {
    const session: CheckoutSession = {
      state: 'completed', items: mockItems, customerName: 'Juan', pickup: false,
    }
    const result = processCheckoutMessage('hola', session)
    expect(result.session.state).toBe('completed')
  })

  it('should always advance from name state (any input = name)', () => {
    const session: CheckoutSession = {
      state: 'name', items: mockItems, pickup: false,
    }
    const result = processCheckoutMessage('qué colores tienen?', session)
    // In name state, ANY input is treated as the customer's name
    expect(result.session.state).toBe('dni')
  })

  it('should not skip to completed from name (must go through all states)', () => {
    const session: CheckoutSession = {
      state: 'name', items: mockItems, pickup: false,
    }
    const result = processCheckoutMessage('confirmar sin dar nombre', session)
    // State machine advances to next state (dni) but never directly to completed
    expect(result.session.state).not.toBe('completed')
    expect(result.action?.type).not.toBe('checkout')
  })
})
