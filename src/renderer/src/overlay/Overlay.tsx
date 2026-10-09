import { Character } from './Character'
import styles from './Overlay.module.css'

/**
 * 캐릭터 창 화면. (설계 9.7)
 * - 캐릭터 몸: 먹이 받기(7-3)·클릭(7-3)·더블클릭(7-4)용
 * - 아래 손잡이 막대: 잡고 끌면 창이 움직인다. 놓으면 코어가 위치를 저장한다
 */
export function Overlay(): React.JSX.Element {
  return (
    <main className={styles.stage}>
      <Character mood="idle" />
      <div className={styles.handle} title="끌어서 옮기기" />
    </main>
  )
}
