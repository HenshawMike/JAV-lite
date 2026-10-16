import React from 'react'
import Link from 'next/link'
import { ArrowLeft, ShieldCheck } from '@/components/ui/icons'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

export default async function PrivacyPolicyPage({ params }: { params: Promise<{ version: string }> }) {
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
          <ShieldCheck size={14} />
          Version {version || '1.0'} · Effective October 2026
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary" style={{ fontFamily: 'var(--font-rajdhani)' }}>
          Privacy Policy
        </h1>
        <p className="text-sm text-text-tertiary mt-2">
          Compliant with the Nigeria Data Protection Act (NDPA) 2023 · Blim Technologies
        </p>
      </div>

      <div className="space-y-8 text-sm sm:text-base text-text-secondary">
        <section className="bg-bg-secondary p-6 rounded-2xl border border-border-default">
          <h2 className="text-lg font-bold text-text-primary mb-2">A1. Who We Are</h2>
          <p>
            JAV Lite (&quot;the App&quot;, &quot;we&quot;, &quot;us&quot;) is an attendance platform operated by Blim Technologies (Nigeria).
            Contact for privacy matters: <strong className="text-text-primary">privacy@jav.blimtechnologies.com</strong>.
          </p>
          <p className="mt-2">
            We act as a <strong>Data Controller</strong> for your account credentials, security logs, and profile records,
            and as a <strong>Data Processor</strong> for academic and event attendance logs created on behalf of schools and session hosts.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text-primary mb-3">A2. Information We Collect</h2>
          <div className="overflow-x-auto border border-border-default rounded-xl">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-bg-secondary border-b border-border-default text-text-primary font-bold">
                <tr>
                  <th className="p-3">Category</th>
                  <th className="p-3">Data</th>
                  <th className="p-3">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                <tr>
                  <td className="p-3 font-semibold text-text-primary">Account</td>
                  <td className="p-3">Google email, name, Google ID</td>
                  <td className="p-3">Google OAuth sign-in</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-text-primary">Profile</td>
                  <td className="p-3">Full name, track/ID number, level, school, faculty, department</td>
                  <td className="p-3">Student registration form</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-text-primary">Attendance</td>
                  <td className="p-3">Class/event name, host, date, timestamp, snapshot profile data</td>
                  <td className="p-3">QR scan confirmation</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-text-primary">Technical Data</td>
                  <td className="p-3">Browser type, hashed salted IP, error diagnostics</td>
                  <td className="p-3">Automated security logs</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-bg-secondary p-6 rounded-2xl border border-border-default">
          <h2 className="text-lg font-bold text-text-primary mb-2">A3. No Face Photos Policy</h2>
          <p>
            JAV Lite <strong>does not collect, capture, or store face photos</strong>. The platform utilizes authenticated Google logins
            combined with dynamic cryptographically-signed rotating QR codes to securely verify physical attendance presence without biometrics.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text-primary mb-2">A4. Why We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>To securely create and authenticate your account through Google OAuth.</li>
            <li>To accurately record and snapshot your presence at academic lectures and institutional events.</li>
            <li>To generate verified attendance reports for course lecturers and department heads.</li>
            <li>To prevent fraud, proxy attendance, and unauthorized record tampering.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text-primary mb-2">A5. Your Rights Under NDPA 2023</h2>
          <p className="mb-3">
            As a data subject in Nigeria, you are entitled to:
          </p>
          <ol className="list-decimal pl-5 space-y-1.5">
            <li><strong>Access:</strong> Request a complete machine-readable copy of your personal records (via Profile &gt; Download My Data).</li>
            <li><strong>Correction:</strong> Request correction of inaccurate track numbers or levels through your institution&apos;s administrator.</li>
            <li><strong>Erasure:</strong> Request deletion of your personal account data subject to mandatory academic retention guidelines.</li>
            <li><strong>Complaints:</strong> Lodge an inquiry with our privacy officer or directly with the Nigeria Data Protection Commission (NDPC).</li>
          </ol>
        </section>

        <section className="pt-6 border-t border-border-default flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-text-tertiary">
          <p>© {new Date().getFullYear()} Blim Technologies. All rights reserved.</p>
          <Link href="/terms" className="underline hover:text-text-primary">View Terms and Conditions</Link>
        </section>
      </div>
    </main>
  )
}
