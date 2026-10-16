'use client'

import React, { useState, useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import {
  Users,
  Clock,
  Maximize2,
  Minimize2,
  RefreshCw,
  PowerOff,
  AlertTriangle,
  Loader2,
  CheckCircle2
} from '@/components/ui/icons'

interface QrDisplayProps {
  sessionId: string
  sessionName: string
  courseCode?: string | null
  hostName: string
  schoolName: string
  initialRotating?: boolean
  expiresAt: string
  onEndSession: () => Promise<void>
  initialAttendeeCount?: number
}

export function QrDisplay({
  sessionId,
  sessionName,
  courseCode,
  hostName,
  schoolName,
  initialRotating = true,
  expiresAt,
  onEndSession,
  initialAttendeeCount = 0,
}: QrDisplayProps) {
  const [qrSvg, setQrSvg] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(30)
  const [attendeeCount, setAttendeeCount] = useState<number>(initialAttendeeCount)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const [endingSession, setEndingSession] = useState<boolean>(false)
  const [showEndModal, setShowEndModal] = useState<boolean>(false)
  const [timeUntilExpiry, setTimeUntilExpiry] = useState<string>('')
  const [recentAttendees, setRecentAttendees] = useState<{ id: string; name: string; trackNo: string; time: string }[]>([])

  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch QR payload
  const fetchQr = async () => {
    try {
      const res = await fetch('/api/session-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      if (!res.ok) throw new Error('Failed to generate QR')
      const data = await res.json()

      const svgDataUrl = await QRCode.toDataURL(data.payload, {
        width: 480,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'M',
      })
      setQrSvg(svgDataUrl)
      if (data.secondsRemaining !== null) {
        setSecondsRemaining(data.secondsRemaining)
      }
      setLoading(false)
    } catch (err) {
      console.error('QR fetch error:', err)
      setLoading(false)
    }
  }

  // Refresh QR on interval (25s fetch cycle or when remaining reaches 0)
  useEffect(() => {
    fetchQr()
    const qrInterval = setInterval(() => {
      fetchQr()
    }, 25000)

    return () => clearInterval(qrInterval)
  }, [sessionId])

  // Countdown timer for 30s rotation ring & expiry timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 1 ? prev - 1 : 30))

      const diff = new Date(expiresAt).getTime() - Date.now()
      if (diff <= 0) {
        setTimeUntilExpiry('Expired')
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        const secs = Math.floor((diff % (1000 * 60)) / 1000)
        setTimeUntilExpiry(`${hours > 0 ? `${hours}h ` : ''}${mins}m ${secs}s`)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [expiresAt])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch((err) => {
        console.error('Fullscreen error:', err)
      })
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const handleEndConfirmed = async () => {
    setEndingSession(true)
    try {
      await onEndSession()
    } finally {
      setEndingSession(false)
      setShowEndModal(false)
    }
  }

  return (
    <div
      ref={containerRef}
      className={`w-full flex flex-col items-center justify-between p-6 sm:p-10 transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 bg-bg-primary overflow-y-auto' : 'relative'
      }`}
    >
      {/* Top Header Bar */}
      <div className="w-full max-w-4xl flex items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
              {courseCode || 'Live Session'}
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-success/10 text-success text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              Active
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight" style={{ fontFamily: 'var(--font-rajdhani)' }}>
            {sessionName}
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-0.5">
            Host: <strong className="text-text-primary">{hostName}</strong> · {schoolName}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Projector / Fullscreen'}
            className="p-3 rounded-xl border border-border-default bg-bg-secondary hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-all cursor-pointer shadow-sm"
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
          <button
            onClick={() => setShowEndModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-error/10 hover:bg-error text-error hover:text-white border border-error/30 font-bold text-xs transition-all cursor-pointer shadow-sm"
          >
            <PowerOff size={15} strokeWidth={2.5} />
            <span>End Session</span>
          </button>
        </div>
      </div>

      {/* Main Center Stage: High Contrast QR + Rotation Ring */}
      <div className="flex flex-col items-center justify-center my-auto py-4">
        
        {/* QR Frame - Guaranteed Black on White background */}
        <div className="relative p-6 sm:p-8 bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border-4 border-primary/20 flex flex-col items-center">
          {loading ? (
            <div className="w-72 h-72 sm:w-96 sm:h-96 flex flex-col items-center justify-center gap-4 text-gray-400">
              <Loader2 size={40} className="animate-spin text-primary" />
              <p className="text-xs font-bold tracking-wider uppercase text-gray-500">Generating Secure QR...</p>
            </div>
          ) : qrSvg ? (
            <img
              src={qrSvg}
              alt="Scan Attendance QR Code"
              className="w-72 h-72 sm:w-96 sm:h-96 object-contain select-none"
            />
          ) : (
            <div className="w-72 h-72 sm:w-96 sm:h-96 flex items-center justify-center text-error text-xs font-bold">
              Unable to load QR code
            </div>
          )}

          {/* JAV Security Watermark underneath QR */}
          <div className="mt-3 flex items-center gap-2 text-gray-600 text-xs font-bold tracking-widest uppercase">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span>JAV Lite Anti-Fraud Shield</span>
          </div>
        </div>

        {/* Live Rotation Countdown / Static Indicator */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-6">
          {initialRotating ? (
            <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-bg-secondary border border-border-default shadow-sm">
              <div className="relative w-7 h-7 flex items-center justify-center">
                <svg className="w-7 h-7 -rotate-90 transform" viewBox="0 0 36 36">
                  <path
                    className="text-border-default"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-primary transition-all duration-1000"
                    strokeDasharray={`${(secondsRemaining / 30) * 100}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <RefreshCw size={12} className="absolute text-primary animate-spin" style={{ animationDuration: '3s' }} />
              </div>
              <span className="text-xs font-bold text-text-primary">
                Rotating code: refreshing in <span className="font-mono text-primary font-bold">{secondsRemaining}s</span>
              </span>
            </div>
          ) : (
            <div className="px-4 py-1.5 rounded-full bg-bg-secondary border border-border-default text-xs font-bold text-text-secondary">
              Static QR Mode
            </div>
          )}

          {/* Auto-End Countdown */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-bg-secondary border border-border-default shadow-sm text-xs font-bold text-text-secondary">
            <Clock size={15} className="text-accent" />
            <span>Auto-ends in: <span className="font-mono text-text-primary">{timeUntilExpiry || 'Calculating...'}</span></span>
          </div>
        </div>

      </div>

      {/* Bottom Live Attendance Bar */}
      <div className="w-full max-w-4xl mt-6 p-4 rounded-2xl bg-bg-secondary border border-border-default flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Users size={20} strokeWidth={2.5} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-text-primary font-mono">{attendeeCount}</span>
              <span className="text-xs font-bold uppercase tracking-wider text-text-tertiary">Students Marked</span>
            </div>
            <p className="text-[11px] text-text-secondary">Real-time attendance feed active</p>
          </div>
        </div>

        <div className="text-xs text-text-tertiary text-center sm:text-right">
          Students scan via <strong className="text-text-primary">JAV Lite Scanner</strong> or standard camera app
        </div>
      </div>

      {/* End Session Confirmation Modal */}
      {showEndModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-bg-primary rounded-2xl border border-border-default shadow-2xl p-6 sm:p-8 max-w-md w-full animate-scale-in flex flex-col gap-5">
            <div className="w-12 h-12 rounded-2xl bg-error/10 text-error flex items-center justify-center border border-error/20">
              <AlertTriangle size={24} strokeWidth={2.5} />
            </div>

            <div>
              <h3 className="text-xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-rajdhani)' }}>
                End this attendance session?
              </h3>
              <p className="text-xs sm:text-sm text-text-secondary mt-1.5 leading-relaxed">
                Ending the session will immediately stop all further QR marks. A final snapshot will be locked for exports and PDF reports.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowEndModal(false)}
                disabled={endingSession}
                className="flex-1 py-3 rounded-xl border border-border-default text-xs font-bold text-text-secondary hover:bg-bg-secondary transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEndConfirmed}
                disabled={endingSession}
                className="flex-1 py-3 rounded-xl bg-error text-white text-xs font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                {endingSession ? <Loader2 size={16} className="animate-spin" /> : <PowerOff size={16} />}
                <span>Yes, End Session</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
