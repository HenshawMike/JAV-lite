'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Camera, AlertCircle, RefreshCw } from '@/components/ui/icons'

interface QrScannerProps {
  onScanSuccess: (decodedText: string) => void
  onScanError?: (errorMessage: string) => void
}

export function QrScanner({ onScanSuccess, onScanError }: QrScannerProps) {
  const [scannerStarted, setScannerStarted] = useState<boolean>(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const containerId = 'jav-qr-reader'

  useEffect(() => {
    let isMounted = true

    const startScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode(containerId)
        scannerRef.current = html5QrCode

        const config = {
          fps: 15,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1.0,
        }

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            if (isMounted) {
              onScanSuccess(decodedText)
            }
          },
          () => {
            // Frame parse error (normal while scanning empty space)
          }
        )

        if (isMounted) {
          setScannerStarted(true)
          setCameraError(null)
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Camera start error:', err)
          setCameraError(
            err?.message?.includes('Permission') || err?.name === 'NotAllowedError'
              ? 'Camera permission was denied. Please allow camera access in your browser settings.'
              : 'Unable to access device camera. Please make sure no other app is using it.'
          )
          if (onScanError) onScanError(err?.message || 'Camera error')
        }
      }
    }

    startScanner()

    return () => {
      isMounted = false
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current
          .stop()
          .catch((e) => console.error('Error stopping scanner:', e))
          .finally(() => {
            scannerRef.current?.clear()
          })
      }
    }
  }, [onScanSuccess, onScanError])

  return (
    <div className="w-full flex flex-col items-center">
      {cameraError ? (
        <div className="w-full max-w-sm p-6 rounded-2xl bg-error/10 border border-error/20 flex flex-col items-center text-center gap-3 animate-fade-in">
          <AlertCircle size={32} className="text-error" />
          <p className="text-sm font-bold text-text-primary">Camera Access Needed</p>
          <p className="text-xs text-text-secondary leading-relaxed">{cameraError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-md hover:opacity-90 transition-opacity"
          >
            <RefreshCw size={14} />
            Try Again
          </button>
        </div>
      ) : (
        <div className="relative w-full max-w-sm aspect-square bg-black rounded-3xl overflow-hidden border-2 border-primary/30 shadow-2xl flex items-center justify-center">
          <div id={containerId} className="w-full h-full object-cover" />

          {/* Viewfinder Reticle Overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
            <div className="relative w-64 h-64 border-2 border-dashed border-primary/70 rounded-2xl animate-pulse flex items-center justify-center">
              {/* Corner accents */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-lg" />

              {/* Laser scanning line */}
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-accent to-transparent absolute top-1/2 -translate-y-1/2 animate-bounce" />
            </div>
          </div>

          {!scannerStarted && (
            <div className="absolute inset-0 bg-bg-primary/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 text-text-primary">
              <Camera size={28} className="text-primary animate-pulse" />
              <p className="text-xs font-bold tracking-wider uppercase text-text-secondary">
                Starting Camera...
              </p>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-text-tertiary text-center mt-4">
        Position the lecturer&apos;s rotating QR code inside the frame
      </p>
    </div>
  )
}
