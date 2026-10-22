import type { ButtonHTMLAttributes, FC } from 'react'

import type { ButtonTone } from './Button.types'

const TONES: Record<ButtonTone, string> = {
  primary: 'bg-brand text-ink-on-fill hover:bg-brand-hover active:bg-brand-deep',
  secondary: 'border border-line bg-surface text-ink hover:border-chip-hover hover:bg-brand-soft',
  danger: 'bg-status-error text-ink-on-fill hover:brightness-95',
  quiet: 'bg-brand-soft text-brand hover:bg-selected'
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ButtonTone
  small?: boolean
}

/** A pill button; `small` is the dense size used inside table rows. */
const Button: FC<ButtonProps> = ({
  tone = 'secondary',
  small = false,
  className = '',
  type = 'button',
  ...rest
}) => (
  <button
    type={type}
    className={`inline-flex items-center justify-center gap-2 rounded-pill font-medium whitespace-nowrap transition-colors duration-150 ease-settle disabled:cursor-not-allowed disabled:opacity-55 ${small ? 'h-8 px-3.5 text-[13px]' : 'h-11 px-5 text-[15px]'} ${TONES[tone]} ${className}`}
    {...rest}
  />
)

export default Button
