'use client'
import { useState } from 'react'
import EquipmentPage from '../equipment/page'
import StoragePage from '../storage/page'

export default function GearPage() {
  const [tab, setTab] = useState('equipment')
  return (
    <div>
      <div className="flex gap-2 mb-4 border-b border-gray-100 pb-2">
        <button onClick={() => setTab('equipment')}
          className={`text-[13px] px-4 py-1.5 rounded-lg font-medium transition-colors ${tab === 'equipment' ? 'bg-[#E0197D] text-white' : 'text-gray-500 hover:text-[#E0197D]'}`}>
          ציוד
        </button>
        <button onClick={() => setTab('storage')}
          className={`text-[13px] px-4 py-1.5 rounded-lg font-medium transition-colors ${tab === 'storage' ? 'bg-[#E0197D] text-white' : 'text-gray-500 hover:text-[#E0197D]'}`}>
          אכסון
        </button>
      </div>
      {tab === 'equipment' && <EquipmentPage />}
      {tab === 'storage' && <StoragePage />}
    </div>
  )
}
