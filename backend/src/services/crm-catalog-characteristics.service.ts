import type {
  CreateCrmCharacteristicInput,
  PatchCrmCharacteristicInput,
} from '../schemas/crm-catalog.schemas'
import { pool } from '../utils/db'

import { assertCatalogCrmWritable } from './catalog-source.guard'
import { conflictError, isUniqueViolation } from './crm-catalog.helpers'

export type CrmCharacteristicItem = {
  id: number
  name: string
  sortOrder: number
}

type CharacteristicRow = {
  id: number
  name: string
  sort_order: number
}

const mapRow = (row: CharacteristicRow): CrmCharacteristicItem => ({
  id: row.id,
  name: row.name,
  sortOrder: row.sort_order,
})

export const listCrmCharacteristics = async (): Promise<CrmCharacteristicItem[]> => {
  const result = await pool.query<CharacteristicRow>(
    `SELECT id, name, sort_order
     FROM characteristics
     ORDER BY sort_order, name`,
  )
  return result.rows.map(mapRow)
}

export const createCrmCharacteristic = async (
  input: CreateCrmCharacteristicInput,
): Promise<CrmCharacteristicItem> => {
  assertCatalogCrmWritable()
  const name = input.name.trim()
  const sortOrder = input.sortOrder ?? 0

  try {
    const result = await pool.query<CharacteristicRow>(
      `INSERT INTO characteristics (name, sort_order) VALUES ($1, $2)
       RETURNING id, name, sort_order`,
      [name, sortOrder],
    )
    return mapRow(result.rows[0])
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflictError(`Characteristic with name "${name}" already exists`)
    }
    throw error
  }
}

export const updateCrmCharacteristic = async (
  id: number,
  input: PatchCrmCharacteristicInput,
): Promise<CrmCharacteristicItem | null> => {
  assertCatalogCrmWritable()

  const sets: string[] = []
  const params: unknown[] = []

  if (input.name !== undefined) {
    params.push(input.name.trim())
    sets.push(`name = $${params.length}`)
  }
  if (input.sortOrder !== undefined) {
    params.push(input.sortOrder)
    sets.push(`sort_order = $${params.length}`)
  }

  if (sets.length === 0) {
    throw new Error('No fields to update')
  }

  params.push(id)

  try {
    const result = await pool.query<CharacteristicRow>(
      `UPDATE characteristics SET ${sets.join(', ')} WHERE id = $${params.length}
       RETURNING id, name, sort_order`,
      params,
    )
    if (result.rows.length === 0) return null
    return mapRow(result.rows[0])
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflictError('Characteristic with this name already exists')
    }
    throw error
  }
}
