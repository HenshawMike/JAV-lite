import React from 'react'

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
  const baseClasses = "font-rajdhani tracking-[0.5px] cursor-pointer transition-all duration-200 inline-flex items-center justify-center font-bold text-sm rounded-[10px] px-[22px] py-[11px] border-none outline-none select-none active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
  
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
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading...
        </span>
      ) : children}
    </button>
  )
}
