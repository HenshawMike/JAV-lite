import React from 'react'
import { Loader2 } from '@/components/ui/icons'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger'
  loading?: boolean
  className?: string
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  loading = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses = "font-rajdhani tracking-[0.5px] cursor-pointer transition-all duration-200 inline-flex items-center justify-center font-bold text-sm rounded-xl px-5 py-2.5 outline-none select-none active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
  
  let variantClasses = ""
  
  if (variant === 'primary') {
    variantClasses = "bg-primary text-white hover:opacity-90 shadow-sm"
  } else if (variant === 'secondary') {
    variantClasses = "bg-bg-secondary border border-border-default text-text-primary hover:bg-bg-tertiary hover:border-text-tertiary shadow-sm"
  } else if (variant === 'success') {
    variantClasses = "bg-success text-white hover:opacity-90 shadow-sm"
  } else if (variant === 'danger') {
    variantClasses = "bg-error text-white hover:opacity-90 shadow-sm"
  }

  const isDisabled = disabled || loading

  return (
    <button
      disabled={isDisabled}
      className={`${baseClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <Loader2 size={16} strokeWidth={2} />
          Loading...
        </span>
      ) : children}
    </button>
  )
}
