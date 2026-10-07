import { useBlockList, useFailedCaptures } from './api/queries'
import { messageForError } from './api/errorMessages'
import { useCoreEvents } from './api/useCoreEvents'

function App(): React.JSX.Element {
  useCoreEvents()
  // 6-1 확인용 임시 화면: 코어 연결과 이벤트 갱신만 보여준다. 6-2에서 탭·보드로 바꾼다.
  const inbox = useBlockList('inbox')
  const failed = useFailedCaptures()

  return (
    <main className="app">
      <h1>줍줍</h1>
      {inbox.error ? (
        <p>{messageForError(inbox.error)}</p>
      ) : (
        <p>
          검토함 {inbox.data?.length ?? '…'}개 · 실패 카드 {failed.data?.length ?? '…'}개
        </p>
      )}
    </main>
  )
}

export default App
