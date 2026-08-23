'use client'

import React, { useState, useRef } from 'react'
import { Camera, UploadCloud, Zap, ShieldCheck, AlertCircle, CheckCircle2, Loader2, ScanFace } from '@/components/ui/icons'

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
      <div className="relative w-full max-w-[280px] sm:max-w-[320px] md:max-w-full aspect-square mx-auto bg-bg-secondary border border-primary/20 rounded-2xl overflow-hidden flex flex-col items-center justify-center p-4 md:p-6 shadow-inner">
        {/* Sleek hairline corner framing marks */}
        <div className="absolute top-4 left-4 w-5 h-5 border-t-2 border-l-2 border-primary/60 rounded-tl-sm pointer-events-none" />
        <div className="absolute top-4 right-4 w-5 h-5 border-t-2 border-r-2 border-primary/60 rounded-tr-sm pointer-events-none" />
        <div className="absolute bottom-4 left-4 w-5 h-5 border-b-2 border-l-2 border-primary/60 rounded-bl-sm pointer-events-none" />
        <div className="absolute bottom-4 right-4 w-5 h-5 border-b-2 border-r-2 border-primary/60 rounded-br-sm pointer-events-none" />

        {currentUrl ? (
          <>
            <img
              src={currentUrl}
              alt="Captured student identity"
              className="w-full h-full object-cover rounded-xl"
            />
            <div className="absolute top-6 right-6 bg-bg-primary/95 backdrop-blur-md border border-success/30 rounded-full px-3 py-1 text-[11px] text-success flex items-center gap-1.5 shadow-md font-semibold">
              <CheckCircle2 size={13} strokeWidth={2.5} className="text-success" />
              Photo Saved
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-center gap-3 select-none">
            {/* Minimalist line icon indicator */}
            <div className="w-16 h-16 rounded-2xl border border-border-default bg-bg-tertiary flex items-center justify-center text-text-tertiary">
              <ScanFace size={30} strokeWidth={1.5} className="text-primary/70" />
            </div>

            <h3 className="font-bold text-sm text-text-primary mt-1">
              No identity photo captured
            </h3>
            <p className="text-[11px] text-text-secondary leading-relaxed max-w-[200px]">
              Use your webcam or choose an image file below
            </p>

            <button
              type="button"
              onClick={openWidget}
              className="mt-2 text-xs text-primary font-semibold hover:underline flex items-center gap-1.5 cursor-pointer"
            >
              <UploadCloud size={14} strokeWidth={2} /> Choose image file
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-error/10 border border-error/20 rounded-xl p-3.5 text-xs text-error font-medium flex items-center gap-2">
          <AlertCircle size={15} strokeWidth={2} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Capture Action Button */}
      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={openWidget}
          disabled={loading}
          className="w-full py-3.5 border border-border-default bg-bg-secondary hover:bg-bg-tertiary hover:border-primary/40 text-text-primary font-bold rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-40 shadow-sm"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 size={16} strokeWidth={2} className="text-primary" />
              Configuring...
            </span>
          ) : (
            <>
              <Camera size={17} strokeWidth={1.75} className="text-primary" />
              <span>{currentUrl ? 'Retake via Cloud' : 'Capture via Cloud (Recommended)'}</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleFallback}
          disabled={loading}
          className="w-full py-2.5 text-text-secondary hover:text-text-primary font-semibold text-xs transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
        >
          <Zap size={14} strokeWidth={2} className="text-accent" />
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
      <div className="flex gap-2.5 p-3 bg-bg-secondary/70 border border-border-default rounded-xl text-[10px] text-text-secondary leading-relaxed items-center">
        <ShieldCheck size={14} strokeWidth={2} className="text-primary flex-shrink-0" />
        <p>
          Your photo is encrypted and used only for instant identity matching.
        </p>
      </div>

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] animate-fade-in flex items-center gap-3 bg-error text-white px-5 py-3 rounded-xl shadow-xl border border-white/10 max-w-[320px]">
          <AlertCircle size={18} strokeWidth={2} className="flex-shrink-0" />
          <p className="text-xs font-semibold leading-snug">{toast}</p>
        </div>
      )}
    </div>
  )
}
