'use client'

import React from 'react'
import Link from 'next/link'
import { Check, ShieldCheck } from '@/components/ui/icons'

interface ConsentBoxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  error?: string | null
}

export function ConsentBox({ checked, onChange, error }: ConsentBoxProps) {
  return (
    <div className="flex flex-col gap-2 w-full">
      <label className="flex items-start gap-3 p-3.5 rounded-xl border border-border-default bg-bg-secondary hover:border-text-tertiary cursor-pointer transition-all select-none">
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`w-5 h-5 mt-0.5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
            checked
              ? 'bg-primary border-primary text-white'
              : 'border-border-default bg-bg-primary text-transparent hover:border-primary/50'
          }`}
        >
          {checked && <Check size={14} strokeWidth={3} />}
        </button>

        <div className="text-xs text-text-secondary leading-relaxed flex-1">
          <span>I confirm I have read and agree to the </span>
          <Link
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-primary font-semibold underline hover:opacity-80 inline-flex items-center gap-0.5"
          >
            Terms of Service
          </Link>
          <span> and </span>
          <Link
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-primary font-semibold underline hover:opacity-80 inline-flex items-center gap-0.5"
          >
            Privacy Policy
          </Link>
          <span> (NDPA 2023 compliant).</span>
        </div>
      </label>

      {error && (
        <p className="text-xs text-error font-medium flex items-center gap-1.5 px-1">
          <span>⚠️</span>
          <span>{error}</span>
        </p>
      )}

      <div className="flex items-center gap-1.5 text-[11px] text-text-tertiary px-1">
        <ShieldCheck size={13} className="text-success flex-shrink-0" />
        <span>No face biometrics collected · Recorded under Section 11</span>
      </div>
    </div>
  )
}
