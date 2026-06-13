'use client'
import { useState } from 'react'

const TABS = [
  { id: 'dashboard', label: 'דשבורד', icon: 'ti-layout-dashboard' },
  { id: 'gantts',    label: 'גאנטים',  icon: 'ti-timeline-event' },
  { id: 'tasks',     label: 'משימות',  icon: 'ti-checklist' },
]

export default function MarketingPage() {
  const [tab, setTab] = useState('dashboard')
  const active = TABS.find(t => t.id === tab)

  return (
    <div className="max-w-7xl">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[#E0197D]">פרסום ושיווק</h1>
        <p className="text-[13px] text-gray-400 mt-0.5">מחלקת פרסום ושיווק</p>
      </div>

      <div className="flex gap-2 mb-4 flex-row-reverse justify-end">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`text-[13px] px-4 py-2 rounded-lg border transition-colors flex items-center gap-1.5 flex-row-reverse ${tab === t.id ? 'bg-[#E0197D] text-white border-[#E0197D]' : 'border-gray-200 text-gray-600 hover:border-[#E0197D]'}`}>
            <i className={`ti ${t.icon}`} style={{ fontSize: 15 }} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-12 text-center text-gray-400">
        <i className={`ti ${active.icon}`} style={{ fontSize: 36 }} />
        <div className="mt-3 text-sm">אזור "{active.label}" — בהקמה</div>
        <div className="mt-1 text-[12px] text-gray-300">התוכן יתווסף בהמשך</div>
      </div>
    </div>
  )
}
