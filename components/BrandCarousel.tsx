'use client'

import { useEffect, useState } from 'react'

const slides = [
  { title: 'Attendance, but fun.', desc: 'No more boring roll calls — check into class in a blink.' },
  { title: 'One tap, marked present.', desc: 'Tap a button and poof, attendance is logged instantly.' },
  { title: 'Built for every device.', desc: 'From your phone to your laptop, JAV works everywhere.' },
]

export function BrandCarousel() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % slides.length), 4000)
    return () => clearInterval(id)
  }, [])

  const slide = slides[active]

  return (
    <div className="relative z-10 flex flex-col items-start gap-6">
      <div>
        <h1
          className="text-4xl font-bold text-text-primary leading-tight mb-3 transition-colors duration-300"
          style={{ fontFamily: "var(--font-rajdhani)" }}
        >
          {slide.title}
        </h1>
        <p className="text-sm text-text-secondary max-w-sm leading-relaxed transition-colors duration-300 font-medium">{slide.desc}</p>
      </div>

      <div className="flex gap-2 items-center">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            aria-label={`Slide ${i + 1}`}
            className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
              i === active ? 'w-6 bg-primary' : 'w-1.5 bg-text-tertiary/40 hover:bg-text-tertiary'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
