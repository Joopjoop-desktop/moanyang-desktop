import type { ElementType } from '@shared/model'
import type { DomainElement } from './types'

/** 테스트 전용: 요소를 간단히 만든다. 앱 코드에서 import하지 않는다. */
export function makeElement(
  id: string,
  type: ElementType,
  overrides: Partial<Omit<DomainElement, 'id' | 'type'>> = {}
): DomainElement {
  return {
    id,
    blockId: 'block',
    type,
    value: null,
    dateValue: null,
    timeValue: null,
    needsConfirm: false,
    orderIndex: 0,
    ...overrides
  }
}
