import type { ComponentPropsWithoutRef } from 'react'

type CheckboxProps = Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'className'>

/**
 * 체크박스 (Figma Checkbox): 끔은 회색 테두리 네모, 켬은 검은 네모에 흰 체크.
 * 기본 체크박스를 그림으로 바꿔 쓴다. 카드(BlockActionBar)와 오늘 창이 같이 쓴다.
 *
 * 끔 그림(22px)은 20px 네모의 바깥으로 1px 테두리가 나오므로, 22px 칸을 만들고 margin -1px로
 * 자리는 20px만 차지하게 한다. 켬 그림은 흰 체크만 있어서 검은 바탕은 여기서 칠한다.
 * 그림 경로는 tailwind.css(assets/) 기준이다.
 */
export function Checkbox(props: CheckboxProps): React.JSX.Element {
  return (
    <input
      type="checkbox"
      className="-m-0.25 size-5.5 shrink-0 cursor-pointer appearance-none rounded-[0.3125rem] bg-[url(./icons/checkbox-off.svg)] bg-[length:1.375rem_1.375rem] bg-center bg-no-repeat p-0.25 checked:bg-primary checked:bg-[url(./icons/checkbox-on.svg)] checked:bg-[length:1.25rem_1.25rem] checked:bg-clip-content checked:bg-origin-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-50"
      {...props}
    />
  )
}
