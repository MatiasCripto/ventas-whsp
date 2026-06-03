import { describe, it, expect } from 'vitest'
import { initCheckout, processCheckoutMessage, AI_GENERATE } from '@/lib/bot/checkout-machine'
import type { CheckoutItem, CheckoutSession } from '@/lib/bot/checkout-machine'

const mockItems: CheckoutItem[] = [
  { productName: 'Remera Oversize', quantity: 1, size: 'M', color: 'negro' },
]

describe('Checkout State Machine', () => {
  it('should start at name state from idle', () => {
    const result = initCheckout(mockItems, {})
    expect(result.session.state).toBe('name')
    expect(result.session.items).toEqual(mockItems)
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

  it('should go back to payment_method from confirm when user says no', () => {
    const session: CheckoutSession = {
      state: 'confirm', items: mockItems, customerName: 'Juan',
      shippingMethod: 'shipping', address: 'Av. Siempre Viva 123',
      paymentMethod: 'cash_on_delivery', pickup: false,
    }
    const result = processCheckoutMessage('no, quiero pagar con transferencia', session)
    expect(result.session.state).toBe('payment_method')
  })

  it('should mark completed as terminal state (no transition out)', () => {
    const session: CheckoutSession = {
      state: 'completed', items: mockItems, customerName: 'Juan', pickup: false,
    }
    const result = processCheckoutMessage('hola', session)
    expect(result.session.state).toBe('completed')
  })

  it('should return AI_GENERATE for unexpected input', () => {
    const session: CheckoutSession = {
      state: 'name', items: mockItems, pickup: false,
    }
    const result = processCheckoutMessage('qué colores tienen?', session)
    expect(result.response).toBe(AI_GENERATE)
    expect(result.session.state).toBe('name')
  })

  it('should go from name -> completed (invalid, stays in name)', () => {
    const session: CheckoutSession = {
      state: 'name', items: mockItems, pickup: false,
    }
    const result = processCheckoutMessage('quiero confirmar', session)
    expect(result.session.state).toBe('name')
    expect(result.action?.type).not.toBe('checkout')
  })
})
