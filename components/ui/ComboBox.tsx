'use client'

import React, { useState, useEffect, useRef } from 'react'
import { ChevronDown } from '@/components/ui/icons'

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
          className="block text-[11px] text-text-secondary font-semibold tracking-widest uppercase"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          {label} {required && <span className="text-error">*</span>}
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
          className="w-full bg-bg-tertiary border border-border-default rounded-xl px-4 py-3 pr-10 text-text-primary text-sm outline-none transition-all duration-200 focus:border-border-focus focus:shadow-[0_0_0_3px_var(--color-primary-glow)] placeholder:text-text-tertiary"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        />
        <div 
          className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer text-text-tertiary hover:text-text-secondary transition-colors"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <ChevronDown 
            size={16}
            strokeWidth={2}
            className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : ''}`}
          />
        </div>
      </div>

      {isOpen && filteredSuggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-[calc(100%+6px)] max-h-60 overflow-y-auto z-50 bg-bg-primary border border-border-default rounded-xl shadow-xl py-1.5 transition-all duration-200 divide-y divide-border-default/40">
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
                  ? 'bg-bg-tertiary text-primary font-semibold' 
                  : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
              }`}
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {item}
            </li>
          ))}
        </ul>
      )}

      {error && <span className="text-xs text-error mt-1">{error}</span>}
    </div>
  )
}
