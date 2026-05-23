'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const VENUE_FOLDER_MAP = {
  'אולם 1': 'hall-1',
  'אולם 2': 'hall-2',
  'אולם 5': 'hall-5',
  'תיאטרון הבית': 'habit',
  'דירה': 'apartment',
}

export default function VenuesPage() {
  const [profile, setProfile] = useState(null)
  const [venues, setVenues] = useState([])
  const [files, setFiles] = useState({}) // venueName -> []
  const [loading, setLoading] = useState(true)
  const [openVenue, setOpenVenue] = useState(null)
  const [uploading, setUploading] = useState(null)
  const [viewing, setViewing] = useState(null) // { url, name }
  const fileInputRef = useRef(null)
  const [uploadTarget, setUploadTarget] = useState(null)
  const [selectedFiles, setSelectedFiles] = useState({}) // "venue/file" -> bool

  function toggleFileSelect(venue, fileName) {
    const key = `${venue}/${fileName}`
    setSelectedFiles(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function sendSelectedByEmail(venueName) {
    const venueFiles = files[venueName] || []
    const folder = VENUE_FOLDER_MAP[venueName] || venueName
    const selected = venueFiles.filter(f => selectedFiles[`${venueName}/${f.name}`])
    if (!selected.length) return
    const links = selected.map(f => {
      const { data } = supabase.storage.from('venues').getPublicUrl(`${folder}/${f.name}`)
      return `${f.name}: ${data.publicUrl}`
    }).join('%0D%0A')
    window.location.href = `mailto:?subject=${encodeURIComponent(venueName)}&body=${links}`
  }

  function selectAllVenue(venueName) {
    const venueFiles = files[venueName] || []
    const allSelected = venueFiles.every(f => selectedFiles[`${venueName}/${f.name}`])
    const newSel = {}
    venueFiles.forEach(f => { newSel[`${venueName}/${f.name}`] = !allSelected })
    setSelectedFiles(prev => ({ ...prev, ...newSel }))
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)

      const { data: vs } = await supabase.from('venues').select('name').order('sort_order')
      const venueNames = (vs || []).map(v => v.name).filter(v => VENUE_FOLDER_MAP[v])
      setVenues(venueNames)

      // Load files for each venue
      const fileMap = {}
      for (const v of venueNames) {
        const folder = VENUE_FOLDER_MAP[v]
        if (!folder) continue
        const { data } = await supabase.storage.from('venues').list(folder, { sortBy: { column: 'name', order: 'asc' } })
        fileMap[v] = (data || []).filter(f => f.name !== '.emptydir')
      }
      setFiles(fileMap)
      setLoading(false)
    }
    load()
  }, [])

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file || !uploadTarget) return
    setUploading(uploadTarget)

    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_\u0590-\u05FF ]/g, '_')
    const folder = VENUE_FOLDER_MAP[uploadTarget] || uploadTarget
    const path = `${folder}/${safeName}`

    const { error } = await supabase.storage.from('venues').upload(path, file, { upsert: true })
    if (!error) {
      const folder2 = VENUE_FOLDER_MAP[uploadTarget] || uploadTarget
      const { data: updated } = await supabase.storage.from('venues').list(folder2, { sortBy: { column: 'name', order: 'asc' } })
      setFiles(prev => ({ ...prev, [uploadTarget]: (updated || []).filter(f => f.name !== '.emptydir') }))
    }
    setUploading(null)
    setUploadTarget(null)
    e.target.value = ''
  }

  async function deleteFile(venueName, fileName) {
    if (!window.confirm(`למחוק את "${fileName}"?`)) return
    const delFolder = VENUE_FOLDER_MAP[venueName] || venueName
    await supabase.storage.from('venues').remove([`${delFolder}/${fileName}`])
    setFiles(prev => ({ ...prev, [venueName]: prev[venueName].filter(f => f.name !== fileName) }))
  }

  async function openFile(venueName, fileName) {
    const viewFolder = VENUE_FOLDER_MAP[venueName] || venueName
    const { data } = supabase.storage.from('venues').getPublicUrl(`${viewFolder}/${fileName}`)
    const isMobile = window.innerWidth < 768
    if (isMobile) {
      window.open(data.publicUrl, '_blank')
    } else {
      setViewing({ url: data.publicUrl, name: fileName })
    }
  }

  if (loading) return <div className="text-center text-gray-400 py-8">טוען...</div>

  return (
    <div className="max-w-2xl">
      {/* PDF Viewer Modal */}
      {viewing && (
        <div className="fixed inset-0 z-50 bg-black/70 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 flex-row-reverse">
            <button onClick={() => setViewing(null)} className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 text-[13px]">
              <i className="ti ti-x" style={{fontSize:16}}/>
              סגור
            </button>
            <span className="text-[13px] font-medium text-gray-800 truncate max-w-[45%] text-center">{viewing.name}</span>
            <a href={viewing.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[13px] text-[#CC1010] hover:underline">
              <i className="ti ti-external-link" style={{fontSize:14}}/>
              פתח בדפדפן
            </a>
          </div>

          {/* Desktop: iframe */}
          <iframe
            src={viewing.url}
            className="flex-1 w-full hidden md:block"
            title={viewing.name}
            allow="fullscreen"
            style={{border:'none'}}
          />

          {/* Mobile: open in browser */}
          <div className="flex-1 flex flex-col items-center justify-center gap-5 bg-gray-50 md:hidden px-6 text-center">
            <div className="w-16 h-16 bg-[#FDEAEA] rounded-2xl flex items-center justify-center">
              <i className="ti ti-file-type-pdf text-[#CC1010]" style={{fontSize:32}}/>
            </div>
            <div>
              <div className="text-[15px] font-semibold text-gray-800 mb-1">{viewing.name}</div>
              <div className="text-[13px] text-gray-400">לצפייה בקובץ PDF פתח אותו בדפדפן</div>
            </div>
            <a href={viewing.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-[14px] bg-[#CC1010] text-white px-6 py-3 rounded-xl font-medium active:bg-[#a00c0c]">
              <i className="ti ti-external-link" style={{fontSize:15}}/>
              פתח PDF
            </a>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleUpload}/>

      {venues.length === 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-[13px] text-gray-400">
          אין אולמות מוגדרים במערכת
        </div>
      )}

      {venues.map(venue => {
        const venueFiles = files[venue] || []
        const isOpen = openVenue === venue

        return (
          <div key={venue} className="bg-white border border-gray-100 rounded-xl mb-3 overflow-hidden">
            {/* Venue header */}
            <div className="flex items-center gap-3 px-4 py-4 cursor-pointer hover:bg-gray-50 flex-row-reverse"
              onClick={() => setOpenVenue(isOpen ? null : venue)}>
              <div className="flex-1 text-right">
                <div className="text-[16px] font-semibold text-gray-900">{venue}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">{venueFiles.length} קבצים</div>
              </div>
              <i className={`ti ${isOpen ? 'ti-chevron-up' : 'ti-chevron-down'} text-gray-300`} style={{fontSize:14}}/>
            </div>

            {isOpen && (
              <div className="border-t border-gray-50">
                {/* Email toolbar */}
                {venueFiles.length > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex-row-reverse">
                    <button onClick={() => selectAllVenue(venue)}
                      className="text-[11px] text-gray-500 hover:text-[#CC1010]">
                      {venueFiles.every(f => selectedFiles[`${venue}/${f.name}`]) ? 'בטל הכל' : 'בחר הכל'}
                    </button>
                    <div className="flex-1"/>
                    {venueFiles.some(f => selectedFiles[`${venue}/${f.name}`]) && (
                      <button onClick={() => sendSelectedByEmail(venue)}
                        className="flex items-center gap-1.5 text-[12px] bg-[#CC1010] text-white px-3 py-1.5 rounded-lg hover:bg-[#a00c0c]">
                        <i className="ti ti-mail" style={{fontSize:13}}/>
                        שלח במייל ({venueFiles.filter(f => selectedFiles[`${venue}/${f.name}`]).length})
                      </button>
                    )}
                  </div>
                )}

                {venueFiles.length === 0 && (
                  <div className="text-center text-[13px] text-gray-400 py-6">אין קבצים עדיין</div>
                )}

                {venueFiles.map(f => (
                  <div key={f.name} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 flex-row-reverse group hover:bg-gray-50">
                    {/* Right: checkbox + icon + name */}
                    <input type="checkbox"
                      checked={!!selectedFiles[`${venue}/${f.name}`]}
                      onChange={() => toggleFileSelect(venue, f.name)}
                      className="w-4 h-4 accent-[#CC1010] flex-shrink-0 cursor-pointer"
                    />
                    <div className="w-9 h-9 bg-[#FDEAEA] rounded-lg flex items-center justify-center flex-shrink-0">
                      <i className="ti ti-file-type-pdf text-[#CC1010]" style={{fontSize:18}}/>
                    </div>
                    <div className="flex-1 text-right">
                      <div className="text-[13px] font-medium text-gray-800 truncate">{f.name}</div>
                      <div className="text-[11px] text-gray-400">
                        {f.metadata?.size ? `${Math.round(f.metadata.size / 1024)} KB` : ''}
                      </div>
                    </div>
                    {/* Left: delete button (far left, separated) */}
                    {profile?.is_manager && (
                      <button onClick={() => deleteFile(venue, f.name)}
                        className="text-gray-300 hover:text-red-500 p-1 flex-shrink-0 md:opacity-0 md:group-hover:opacity-100 md:transition-opacity">
                        <i className="ti ti-trash" style={{fontSize:16}}/>
                      </button>
                    )}
                    {/* View button */}
                    <button onClick={() => openFile(venue, f.name)}
                      className="text-[#CC1010] hover:text-[#a00c0c] text-[12px] flex items-center gap-1 px-2 py-1 border border-[#CC1010] rounded-lg flex-shrink-0 md:opacity-0 md:group-hover:opacity-100 md:transition-opacity">
                      <i className="ti ti-eye" style={{fontSize:13}}/> צפה
                    </button>
                  </div>
                ))}

                {/* Upload button */}
                <button
                  onClick={() => { setUploadTarget(venue); fileInputRef.current.click() }}
                  disabled={uploading === venue}
                  className="w-full py-3 text-[13px] text-gray-400 hover:text-[#CC1010] hover:bg-[#FDEAEA] transition-colors flex items-center justify-center gap-1">
                  {uploading === venue ? (
                    <><i className="ti ti-loader-2 animate-spin" style={{fontSize:13}}/> מעלה...</>
                  ) : (
                    <><i className="ti ti-upload" style={{fontSize:13}}/> העלה PDF</>
                  )}
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
