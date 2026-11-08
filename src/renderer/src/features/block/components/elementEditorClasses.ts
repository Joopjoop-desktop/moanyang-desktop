import clsx from 'clsx'

/** 요소 편집칸 클래스. ElementEditor(고치기)와 ElementAdder(새로 추가)가 같이 쓴다. */
const button = clsx('inherit-font cursor-pointer rounded px-2.5 py-0.5 text-[0.75rem]')

export const editorClasses = {
  editor: clsx('flex min-w-0 flex-1 flex-col gap-1.5'),
  dateRow: clsx('flex gap-1.5'),
  input: clsx('inherit-font w-full min-w-0 resize-y rounded border border-accent px-1.5 py-1'),
  error: clsx('text-[0.75rem] text-warn'),
  buttons: clsx('flex gap-1.5'),
  primary: clsx(
    button,
    'border border-primary bg-primary text-primary-text disabled:cursor-default disabled:opacity-50'
  ),
  secondary: clsx(button, 'border border-border bg-surface text-text')
}
