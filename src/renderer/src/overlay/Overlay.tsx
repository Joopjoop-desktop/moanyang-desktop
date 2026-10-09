import styles from './Overlay.module.css'

/**
 * 캐릭터 창 화면. (설계 9.7)
 * 7-1은 창이 투명하게 떠 있는지 확인하는 자리표시자다. 캐릭터 그림·옮기기는 7-2,
 * 먹이 받기는 7-3, 반응은 7-4에서 붙인다.
 */
export function Overlay(): React.JSX.Element {
  return (
    <main className={styles.stage}>
      <div className={styles.placeholder}>줍줍</div>
    </main>
  )
}
