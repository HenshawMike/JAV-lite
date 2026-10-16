import React from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2 } from '@/components/ui/icons'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

export default async function TermsPage({ params }: { params: Promise<{ version: string }> }) {
  const { version } = await params

  return (
    <main className="min-h-screen bg-bg-primary text-text-primary py-12 px-6 sm:px-10 max-w-4xl mx-auto font-sans leading-relaxed selection:bg-primary selection:text-white">
      <div className="flex items-center justify-between pb-8 border-b border-border-default mb-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-bold text-text-secondary hover:text-primary transition-colors"
        >
          <ArrowLeft size={16} strokeWidth={2.5} />
          Back to JAV Lite
        </Link>
        <ThemeToggle />
      </div>

      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-3">
          <CheckCircle2 size={14} />
          Version {version || '1.0'} · Effective October 2026
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary" style={{ fontFamily: 'var(--font-rajdhani)' }}>
          Terms and Conditions
        </h1>
        <p className="text-sm text-text-tertiary mt-2">
          Agreement between User and Blim Technologies · JAV Lite Attendance Platform
        </p>
      </div>

      <div className="space-y-8 text-sm sm:text-base text-text-secondary">
        <section className="bg-bg-secondary p-6 rounded-2xl border border-border-default">
          <h2 className="text-lg font-bold text-text-primary mb-2">B1. Agreement</h2>
          <p>
            By signing in with Google, ticking the acceptance box, or scanning a JAV Lite QR code, you enter into a binding agreement
            with Blim Technologies. Your acceptance timestamp, document version, user agent, and salted IP hash are immutably logged.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text-primary mb-3">B2. User Responsibilities &amp; Anti-Fraud Rules</h2>
          <p className="mb-3">All users agree to strictly adhere to the following rules:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Accuracy:</strong> Provide your authentic student track number, full name, and academic department.</li>
            <li><strong>No Proxy Attendance:</strong> You must not scan on behalf of any other individual or permit anyone to mark attendance with your account.</li>
            <li><strong>Anti-Tampering:</strong> You must not photograph, record, share, or broadcast rotating QR codes outside the active session room.</li>
            <li><strong>Copy Protection:</strong> Attendance records pages are provided as view-only. You must not attempt to scrape or circumvent security controls.</li>
          </ul>
        </section>

        <section className="bg-bg-secondary p-6 rounded-2xl border border-border-default">
          <h2 className="text-lg font-bold text-text-primary mb-2">B3. Attendance Records &amp; Verification</h2>
          <p>
            Every attendance entry is cryptographically bound to an authenticated Google account and timestamped against the server clock.
            Generated PDF and CSV exports carry tamper-evident Report IDs and SHA-256 verification hashes for institutional audits.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text-primary mb-2">B4. Governing Law</h2>
          <p>
            These terms are governed by and construed in accordance with the laws of the Federal Republic of Nigeria.
          </p>
        </section>

        <section className="pt-6 border-t border-border-default flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-text-tertiary">
          <p>© {new Date().getFullYear()} Blim Technologies. All rights reserved.</p>
          <Link href="/privacy" className="underline hover:text-text-primary">View Privacy Policy</Link>
        </section>
      </div>
    </main>
  )
}
