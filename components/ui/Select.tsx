import React from 'react'

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
          className="block text-[11px] text-[var(--text-secondary)] font-semibold tracking-widest uppercase"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          className={`w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-4 py-3 text-[var(--text-primary)] text-sm outline-none transition-all duration-200 focus:border-[var(--border-focus)] focus:shadow-[0_0_0_3px_var(--primary-glow)] cursor-pointer appearance-none ${className}`}
          style={{
            fontFamily: "'DM Sans', sans-serif",
            ...style
          }}
          {...props}
        >
          {placeholder && <option value="" className="bg-[var(--bg-secondary)] text-[var(--text-primary)]">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[var(--bg-secondary)] text-[var(--text-primary)]">
              {opt.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-500">
          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
          </svg>
        </div>
      </div>
      {error && <span className="text-xs text-red-500 mt-1">{error}</span>}
    </div>
  )
}
