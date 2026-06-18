import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  className = '',
  style = {},
  ...props
}) => {
  return (
    <div className="w-full flex flex-col gap-2">
      {label && (
        <label 
          className="block text-[11px] text-[var(--text-secondary)] font-semibold tracking-widest uppercase"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          {label}
        </label>
      )}
      <input
        className={`w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-4 py-3 text-[var(--text-primary)] text-sm outline-none transition-all duration-200 focus:border-[var(--border-focus)] focus:shadow-[0_0_0_3px_var(--primary-glow)] placeholder:text-[var(--text-tertiary)] ${className}`}
        style={{
          fontFamily: "'DM Sans', sans-serif",
          ...style
        }}
        {...props}
      />
      {error && <span className="text-xs text-red-500 mt-1">{error}</span>}
    </div>
  )
}
