'use client'

import { useState } from 'react'
import { GraduationCap, User, Check } from '@/components/ui/icons'
import { SignInButton } from '@/components/SignInButton'

type Role = 'lecturer' | 'student'

const ROLES: { id: Role; label: string; desc: string; icon: React.ReactNode }[] = [
    {
        id: 'lecturer',
        label: 'Lecturer',
        desc: 'Take attendance for your classes',
        icon: <GraduationCap size={20} strokeWidth={1.75} />,
    },
    {
        id: 'student',
        label: 'Student',
        desc: 'Check in to your classes',
        icon: <User size={20} strokeWidth={1.75} />,
    },
]

export function RoleSelect() {
    const [selected, setSelected] = useState<Role | null>(null)

    const handleSelect = (role: Role) => {
        setSelected(role)
        // SignInButton kicks off the Google OAuth redirect, so the role
        // needs to survive that round trip. Simplest option: stash it and
        // read it back on the /register page once the user lands there.
        localStorage.setItem('jav_selected_role', role)
    }

    return (
        <div className="w-full flex flex-col gap-6">
            <div className="flex flex-col gap-3">
                {ROLES.map((role) => {
                    const isSelected = selected === role.id
                    return (
                        <button
                            key={role.id}
                            type="button"
                            onClick={() => handleSelect(role.id)}
                            aria-pressed={isSelected}
                            className={`w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-all
                ${isSelected
                                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                    : 'border-border-default bg-bg-secondary hover:border-text-tertiary'}`}
                        >
                            <div
                                className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border
                  ${isSelected
                                        ? 'bg-primary text-white border-primary'
                                        : 'bg-bg-primary text-text-secondary border-border-default'}`}
                            >
                                {role.icon}
                            </div>

                            <div className="flex-1">
                                <p className="text-sm font-bold text-text-primary">{role.label}</p>
                                <p className="text-xs text-text-secondary mt-0.5">{role.desc}</p>
                            </div>

                            <div
                                className={`w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors
                  ${isSelected ? 'bg-primary border-primary' : 'border-border-default bg-transparent'}`}
                            >
                                {isSelected && <Check size={14} strokeWidth={3} className="text-white" />}
                            </div>
                        </button>
                    )
                })}
            </div>

            <div className={`transition-opacity ${selected ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                <SignInButton />
            </div>
        </div>
    )
}