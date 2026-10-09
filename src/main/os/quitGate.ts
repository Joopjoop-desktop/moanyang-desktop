/**
 * 종료 흐름. (설계 9.7)
 * - 창의 X는 숨기기다. 앱은 트레이에 남는다.
 * - 종료(트레이 메뉴 등)는 before-quit에서 처리 중인 먹이를 확인한다(설계 8.2).
 * - 확인을 통과하면 "종료 중"이 되고, 그때부터는 창이 닫힐 때 숨기지 않는다.
 *   그래야 창 숨기기 처리가 실제 종료를 막지 않는다. 확인에서 취소하면 "종료 중"이 아니다.
 * Electron에 의존하지 않아 테스트로 확인한다.
 */
export class QuitGate {
  private quitting = false

  /** @param confirm 종료해도 되는지 묻는다(처리 중인 먹이가 없으면 묻지 않고 true) */
  constructor(private readonly confirm: () => boolean) {}

  /** before-quit에서 부른다. false면 종료를 막는다. */
  allowQuit(): boolean {
    if (this.quitting) return true
    if (!this.confirm()) return false
    this.quitting = true
    return true
  }

  /** 창 close에서 부른다. true면 닫지 말고 숨긴다. */
  shouldHideOnClose(): boolean {
    return !this.quitting
  }
}
