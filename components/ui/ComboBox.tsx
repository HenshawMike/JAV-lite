'use client'

import React, { useState, useEffect, useRef } from 'react'

interface ComboBoxProps {
  label?: string
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  placeholder?: string
  required?: boolean
  error?: string
  className?: string
}

export const ComboBox: React.FC<ComboBoxProps> = ({
  label,
  value,
  onChange,
  suggestions,
  placeholder = '',
  required = false,
  error,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)

  // Filter suggestions based on input value
  const filteredSuggestions = suggestions.filter((item) =>
    item?.toLowerCase().includes(value.toLowerCase())
  )

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true)
      }
      return
    }

    if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < filteredSuggestions.length) {
        e.preventDefault()
        onChange(filteredSuggestions[activeIndex])
        setIsOpen(false)
        setActiveIndex(-1)
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (prev + 1 < filteredSuggestions.length ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (prev - 1 >= 0 ? prev - 1 : prev))
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setActiveIndex(-1)
    }
  }

  return (
    <div ref={containerRef} className={`w-full flex flex-col gap-2 relative ${className}`}>
      {label && (
        <label 
          className="block text-[11px] text-[var(--text-secondary)] font-semibold tracking-widest uppercase"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setIsOpen(true)
            setActiveIndex(-1)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          className="w-full bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-4 py-3 pr-10 text-[var(--text-primary)] text-sm outline-none transition-all duration-200 focus:border-[var(--border-focus)] focus:shadow-[0_0_0_3px_var(--primary-glow)] placeholder:text-[var(--text-tertiary)]"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        />
        <div 
          className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <svg 
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {isOpen && filteredSuggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-[calc(100%+4px)] max-h-60 overflow-y-auto z-50 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-lg py-1 transition-all duration-200">
          {filteredSuggestions.map((item, index) => (
            <li
              key={item}
              onClick={() => {
                onChange(item)
                setIsOpen(false)
                setActiveIndex(-1)
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={`px-4 py-2.5 text-sm cursor-pointer transition-colors duration-150 ${
                index === activeIndex 
                  ? 'bg-[var(--bg-tertiary)] text-[var(--primary)] font-semibold' 
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              }`}
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {item}
            </li>
          ))}
        </ul>
      )}

      {error && <span className="text-xs text-red-500 mt-1">{error}</span>}
    </div>
  )
}
