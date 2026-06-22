'use client'

import React, { useState, useRef } from 'react'

interface FaceCaptureProps {
  onUpload: (url: string) => void
  currentUrl: string | null
}

export const FaceCapture: React.FC<FaceCaptureProps> = ({ onUpload, currentUrl }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const handleLocalCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check if file is over 5MB
    if (file.size > 5 * 1024 * 1024) {
      showToast('File size exceeds 5MB limit. Please choose a smaller photo.')
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setLoading(true)
    setError(null)
    try {
      const img = new Image()
      img.src = URL.createObjectURL(file)
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
      })

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      // Calculate new dimensions (max 400x400) for local fallback
      let width = img.width
      let height = img.height
      const maxSize = 400

      if (width > height) {
        if (width > maxSize) {
          height *= maxSize / width
          width = maxSize
        }
      } else {
        if (height > maxSize) {
          width *= maxSize / height
          height = maxSize
        }
      }

      canvas.width = width
      canvas.height = height

      // Draw and compress to jpeg
      ctx?.drawImage(img, 0, 0, width, height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6)

      onUpload(dataUrl)
    } catch (err) {
      setError('Failed to process local image capture.')
    } finally {
      setLoading(false)
    }
  }

  const openWidget = () => {
    setError(null)
    const cloudinary = (window as any).cloudinary

    if (!cloudinary) {
      setError('Cloudinary SDK is not loaded. Please verify internet connection or refresh.')
      return
    }

    try {
      setLoading(true)
      const widget = cloudinary.createUploadWidget(
        {
          cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
          uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
          sources: ['camera', 'local'],
          cropping: true,
          croppingAspectRatio: 1,
          showSkipCropCanvas: false,
          maxFiles: 1,
          clientAllowedFormats: ['png', 'jpg', 'jpeg', 'webp'],
          maxImageWidth: 500,
          maxImageHeight: 500,
          maxFileSize: 2000000,
          resourceType: 'image',
          theme: 'purple',
          styles: {
            palette: {
              window: '#000000',
              windowBorder: '#1e1e1e',
              tabIcon: '#C41EBB',
              menuIcons: '#C41EBB',
              textDark: '#0A0A0A',
              textLight: '#f8fafc',
              link: '#C41EBB',
              action: '#C41EBB',
              inactiveTabIcon: '#52525b',
              error: '#EF4444',
              inProgress: '#E27B3F',
              complete: '#10B981',
              sourceBg: '#000000'
            }
          }
        },
        (err: any, result: any) => {
          if (err) {
            setError('An error occurred during widget configuration.')
            setLoading(false)
            return
          }

          if (result.event === 'success') {
            onUpload(result.info.secure_url)
            setLoading(false)
          }

          if (result.event === 'close') {
            setLoading(false)
          }
        }
      )

      widget.open()
    } catch (e) {
      setError('Failed to open upload widget. You can use the fallback below.')
      setLoading(false)
    }
  }

  const handleFallback = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Frame Box */}
      <div className="relative w-full max-w-[280px] sm:max-w-[320px] md:max-w-full aspect-square mx-auto bg-[var(--bg-secondary)] border border-[var(--primary)]/20 rounded-2xl overflow-hidden flex flex-col items-center justify-center p-4 md:p-6 shadow-inner">
        {/* Absolute corner marks */}
        <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-[var(--primary)]" />
        <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-[var(--primary)]" />
        <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-[var(--primary)]" />
        <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-[var(--primary)]" />

        {currentUrl ? (
          <>
            <img
              src={currentUrl}
              alt="Captured student identity"
              className="w-full h-full object-cover rounded-md"
            />
            <div className="absolute top-8 right-8 bg-[var(--bg-primary)] border border-[var(--success)]/30 rounded-full px-3 py-1 text-[11px] text-[var(--success)] flex items-center gap-1.5 shadow-md font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse" />
              Photo Captured
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-center gap-3 select-none">
            {/* Minimalist face-scan circle icon */}
            <div className="w-20 h-20 rounded-full border border-[var(--border)] bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-secondary)]">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <h3 className="font-bold text-sm text-[var(--text-primary)] mt-2">
              No identity photo captured
            </h3>
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed max-w-[200px]">
              Use your webcam or upload an image file below
            </p>

            <button
              type="button"
              onClick={openWidget}
              className="mt-2 text-xs text-[var(--primary)] font-semibold hover:underline flex items-center gap-1.5 cursor-pointer"
            >
              📥 Upload image file
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 text-xs text-red-400">
          ⚠️ {error}
        </div>
      )}

      {/* Capture Action Button */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={openWidget}
          disabled={loading}
          className="w-full py-3.5 border border-[var(--border)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-bold rounded-lg text-sm transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Configuring...
            </span>
          ) : (
            <>
              <span>📷</span>
              <span>{currentUrl ? 'Retake via Cloud' : 'Capture via Cloud (Recommended)'}</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleFallback}
          disabled={loading}
          className="w-full py-2.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-semibold text-xs transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
        >
          <span>⚡</span>
          <span>{currentUrl ? 'Retake locally (Fallback)' : 'Capture locally (Fallback)'}</span>
        </button>

        {/* Hidden file input for local fallback */}
        <input
          type="file"
          accept="image/*"
          capture="user"
          ref={fileInputRef}
          onChange={handleLocalCapture}
          className="hidden"
        />
      </div>

      {/* Disclaimer Info */}
      <div className="flex gap-3 p-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[10px] text-[var(--text-secondary)] leading-relaxed">
        <span className="text-xs text-[var(--primary)]">🗹</span>
        <p>
          Your photo is used only for attendance identity matching. It is never shared externally.
        </p>
      </div>

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] animate-fade-in flex items-center gap-3 bg-[var(--error)] text-white px-5 py-3 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/10 max-w-[320px]">
          <span className="text-xl">⚠️</span>
          <p className="text-sm font-semibold leading-snug">{toast}</p>
        </div>
      )}
    </div>
  )
}
