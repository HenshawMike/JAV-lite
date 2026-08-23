import React from 'react'
import { ChevronDown } from '@/components/ui/icons'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  options,
  placeholder,
  className = '',
  style = {},
  ...props
}) => {
  return (
    <div className="w-full flex flex-col gap-2">
      {label && (
        <label 
          className="block text-[11px] text-text-secondary font-semibold tracking-widest uppercase"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          className={`w-full bg-bg-tertiary border border-border-default rounded-xl px-4 py-3 text-text-primary text-sm outline-none transition-all duration-200 focus:border-border-focus focus:shadow-[0_0_0_3px_var(--color-primary-glow)] cursor-pointer appearance-none pr-10 ${className}`}
          style={{
            fontFamily: "'DM Sans', sans-serif",
            ...style
          }}
          {...props}
        >
          {placeholder && <option value="" className="bg-bg-secondary text-text-primary">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-bg-secondary text-text-primary">
              {opt.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-text-tertiary">
          <ChevronDown size={16} strokeWidth={2} />
        </div>
      </div>
      {error && <span className="text-xs text-error mt-1">{error}</span>}
    </div>
  )
}
