import { useEffect, useState } from 'react'
import { localToday } from '@renderer/lib/dates'

/** 날짜가 바뀌었는지 확인하는 간격 */
const CHECK_MS = 60_000

/**
 * 이 PC 시간으로 오늘 날짜(YYYY-MM-DD). 1분마다 확인해 자정이 지나면 바뀐다. (설계 9.7)
 * 창을 밤새 켜 둬도 아침에 오늘 목록이 맞게 나온다.
 */
export function useLocalToday(): string {
  const [today, setToday] = useState(() => localToday())

  useEffect(() => {
    // 같은 날짜면 React가 다시 그리지 않는다
    const timer = setInterval(() => setToday(localToday()), CHECK_MS)
    return () => clearInterval(timer)
  }, [])

  return today
}
