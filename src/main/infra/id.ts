import { v7 as uuidv7 } from 'uuid'

/** 엔티티 ID(UUID v7)를 만든다. (설계 6.4) */
export function newId(): string {
  return uuidv7()
}
