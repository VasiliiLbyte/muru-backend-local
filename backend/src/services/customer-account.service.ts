import { pool } from '../utils/db'
import type { FavoriteItem } from '../types/favorite'

export type AddressDto = {
  id: number
  label: string
  city: string
  cdekCityCode: number | null
  address: string
  isDefault: boolean
  createdAt: string
}

type AddressDbRow = {
  id: number
  label: string
  city: string
  cdek_city_code: number | null
  address: string
  is_default: boolean
  created_at: Date | string
}

const toIso = (value: Date | string): string => {
  if (value instanceof Date) return value.toISOString()
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString()
}

const toAddressDto = (row: AddressDbRow): AddressDto => ({
  id: row.id,
  label: row.label,
  city: row.city,
  cdekCityCode: row.cdek_city_code,
  address: row.address,
  isDefault: row.is_default,
  createdAt: toIso(row.created_at),
})

const notFound = (message = 'Not found'): Error & { status: number; code: string } => {
  const err = new Error(message) as Error & { status: number; code: string }
  err.status = 404
  err.code = 'NOT_FOUND'
  return err
}

export const listAddresses = async (customerId: number): Promise<AddressDto[]> => {
  const result = await pool.query<AddressDbRow>(
    `SELECT id, label, city, cdek_city_code, address, is_default, created_at
     FROM customer_addresses
     WHERE customer_id = $1
     ORDER BY is_default DESC, created_at DESC`,
    [customerId],
  )
  return result.rows.map(toAddressDto)
}

export type AddressInput = {
  label?: string
  city: string
  cdekCityCode?: number | null
  address: string
  isDefault?: boolean
}

export const createAddress = async (customerId: number, input: AddressInput): Promise<AddressDto> => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const isDefault = Boolean(input.isDefault)
    if (isDefault) {
      await client.query(
        `UPDATE customer_addresses SET is_default = false WHERE customer_id = $1 AND is_default = true`,
        [customerId],
      )
    }
    const result = await client.query<AddressDbRow>(
      `INSERT INTO customer_addresses (customer_id, label, city, cdek_city_code, address, is_default)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, label, city, cdek_city_code, address, is_default, created_at`,
      [
        customerId,
        input.label?.trim() || '',
        input.city.trim(),
        input.cdekCityCode ?? null,
        input.address.trim(),
        isDefault,
      ],
    )
    await client.query('COMMIT')
    return toAddressDto(result.rows[0]!)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export const updateAddress = async (
  customerId: number,
  addressId: number,
  input: AddressInput,
): Promise<AddressDto> => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const existing = await client.query<{ id: number }>(
      `SELECT id FROM customer_addresses WHERE id = $1 AND customer_id = $2`,
      [addressId, customerId],
    )
    if (!existing.rows[0]) {
      throw notFound('Address not found')
    }

    const isDefault = Boolean(input.isDefault)
    if (isDefault) {
      await client.query(
        `UPDATE customer_addresses SET is_default = false WHERE customer_id = $1 AND is_default = true`,
        [customerId],
      )
    }

    const result = await client.query<AddressDbRow>(
      `UPDATE customer_addresses
       SET label = $1, city = $2, cdek_city_code = $3, address = $4, is_default = $5
       WHERE id = $6 AND customer_id = $7
       RETURNING id, label, city, cdek_city_code, address, is_default, created_at`,
      [
        input.label?.trim() || '',
        input.city.trim(),
        input.cdekCityCode ?? null,
        input.address.trim(),
        isDefault,
        addressId,
        customerId,
      ],
    )
    await client.query('COMMIT')
    return toAddressDto(result.rows[0]!)
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      /* ignore */
    }
    throw error
  } finally {
    client.release()
  }
}

export const deleteAddress = async (customerId: number, addressId: number): Promise<void> => {
  const result = await pool.query(
    `DELETE FROM customer_addresses WHERE id = $1 AND customer_id = $2`,
    [addressId, customerId],
  )
  if (result.rowCount === 0) {
    throw notFound('Address not found')
  }
}

export type CustomerOrderSummary = {
  id: number
  status: string
  total: number
  channel: string
  createdAt: string
  paidAt: string | null
}

export type CustomerOrderDetail = CustomerOrderSummary & {
  deliveryMode: string
  address: string
  items: Array<{
    sku: string
    name: string
    price: number
    quantity: number
  }>
}

export const listCustomerOrders = async (customerId: number): Promise<CustomerOrderSummary[]> => {
  const result = await pool.query<{
    id: number
    status: string
    total: string
    channel: string
    created_at: Date | string
    paid_at: Date | string | null
  }>(
    `SELECT id, status, total::text, COALESCE(channel, 'telegram') AS channel, created_at, paid_at
     FROM orders
     WHERE customer_id = $1 AND is_draft = false
     ORDER BY created_at DESC`,
    [customerId],
  )
  return result.rows.map((row) => ({
    id: row.id,
    status: row.status,
    total: Number(row.total),
    channel: row.channel,
    createdAt: toIso(row.created_at),
    paidAt: row.paid_at ? toIso(row.paid_at) : null,
  }))
}

export const getCustomerOrder = async (
  customerId: number,
  orderId: number,
): Promise<CustomerOrderDetail> => {
  const orderResult = await pool.query<{
    id: number
    status: string
    total: string
    channel: string
    delivery_mode: string
    address: string
    created_at: Date | string
    paid_at: Date | string | null
  }>(
    `SELECT id, status, total::text, COALESCE(channel, 'telegram') AS channel,
            delivery_mode, address, created_at, paid_at
     FROM orders
     WHERE id = $1 AND customer_id = $2 AND is_draft = false
     LIMIT 1`,
    [orderId, customerId],
  )
  const order = orderResult.rows[0]
  if (!order) throw notFound('Order not found')

  const itemsResult = await pool.query<{
    product_sku: string
    product_name: string
    price: string
    quantity: number
  }>(
    `SELECT product_sku, product_name, price::text, quantity
     FROM order_items WHERE order_id = $1 ORDER BY id`,
    [orderId],
  )

  return {
    id: order.id,
    status: order.status,
    total: Number(order.total),
    channel: order.channel,
    deliveryMode: order.delivery_mode,
    address: order.address,
    createdAt: toIso(order.created_at),
    paidAt: order.paid_at ? toIso(order.paid_at) : null,
    items: itemsResult.rows.map((item) => ({
      sku: item.product_sku,
      name: item.product_name,
      price: Number(item.price),
      quantity: item.quantity,
    })),
  }
}

export const getFavoritesByCustomerId = async (customerId: number): Promise<FavoriteItem[]> => {
  const result = await pool.query<{
    sku: string
    name: string
    price: string
    image_url_1: string
    in_stock: number
  }>(
    `SELECT p.sku, p.name, p.price::text, p.image_url_1, p.in_stock
     FROM favorites f
     JOIN products p ON p.sku = f.product_sku
     WHERE f.customer_id = $1
     ORDER BY f.created_at DESC`,
    [customerId],
  )

  return result.rows.map((row) => ({
    sku: row.sku,
    name: row.name,
    price: Number(row.price),
    imageUrl: row.image_url_1,
    inStock: row.in_stock,
  }))
}

export const addCustomerFavorite = async (customerId: number, sku: string): Promise<void> => {
  await pool.query(
    `INSERT INTO favorites (customer_id, product_sku, created_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (customer_id, product_sku) WHERE (customer_id IS NOT NULL) DO NOTHING`,
    [customerId, sku],
  )
}

export const removeCustomerFavorite = async (customerId: number, sku: string): Promise<void> => {
  await pool.query(`DELETE FROM favorites WHERE customer_id = $1 AND product_sku = $2`, [
    customerId,
    sku,
  ])
}
