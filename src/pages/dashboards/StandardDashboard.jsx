// import { useState, useEffect, useMemo } from 'react'
// import { useNavigate, useSearchParams } from 'react-router-dom'
// import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
// import { supabase } from '../../lib/supabaseClient'
// import { useDropdownData } from '../../lib/useDropdownData'
// import { latestPerEnquiry } from '../../lib/queueHelpers'
// import { formatDateDisplay, addBusinessDaysExcludingSunday, formatDateISO } from '../../lib/dateHelpers'
// import PipelineStagesCard from '../../components/PipelineStagesCard'
// import './StandardDashboard.css'

// const QUICK_RANGES = [
//   { key: 'all', label: 'All Time' },
//   { key: 'today', label: 'Today' },
//   { key: '7d', label: 'Last 7 Days' },
//   { key: '30d', label: 'Last 30 Days' },
//   { key: '3m', label: 'Last 3 Months' },
//   { key: '6m', label: 'Last 6 Months' },
//   { key: 'thisM', label: 'This Month' },
//   { key: 'thisY', label: 'This Year' },
// ]

// const STAGE_ACCENTS = ['#534AB7', '#0369a1', '#6d28d9', '#0d9488', '#b45309', '#be123c', '#059669', '#888780']

// function toISO(d) { return d.toISOString().slice(0, 10) }

// function computeRange(key) {
//   const today = new Date()
//   const end = toISO(today)
//   if (key === 'all') return { from: '', to: '' }
//   if (key === 'today') return { from: end, to: end }
//   if (key === '7d') { const d = new Date(today); d.setDate(d.getDate() - 6); return { from: toISO(d), to: end } }
//   if (key === '30d') { const d = new Date(today); d.setDate(d.getDate() - 29); return { from: toISO(d), to: end } }
//   if (key === '3m') { const d = new Date(today); d.setMonth(d.getMonth() - 3); return { from: toISO(d), to: end } }
//   if (key === '6m') { const d = new Date(today); d.setMonth(d.getMonth() - 6); return { from: toISO(d), to: end } }
//   if (key === 'thisM') return { from: toISO(new Date(today.getFullYear(), today.getMonth(), 1)), to: end }
//   if (key === 'thisY') return { from: `${today.getFullYear()}-01-01`, to: end }
//   return { from: '', to: '' }
// }

// export default function StandardDashboard({ user }) {
//   const navigate = useNavigate()
//   const [searchParams, setSearchParams] = useSearchParams()
//   const { stages } = useDropdownData()
//   const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'

//   const [loading, setLoading] = useState(true)
//   const [enquiries, setEnquiries] = useState([])
//   const [fcTasks, setFcTasks] = useState([])
//   const [gaTasks, setGaTasks] = useState([])
//   const [poTasks, setPoTasks] = useState([])
//   const [woTasks, setWoTasks] = useState([])
//   const [qtTasks, setQtTasks] = useState([])
//   const [qrTasks, setQrTasks] = useState([])

//   const [wqTypeFilter, setWqTypeFilter] = useState('all') // 'all' | 'overdue' | 'due-today' | 'flowchart' | 'quotation' | 'ga_drawing'

//   const [statModal, setStatModal] = useState(null)
//   const [recentPage, setRecentPage] = useState(0)

//   // Date-filter (preset/From/To) ab bhi URL mein (?preset=&from=&to=) rakhte
//   // hain — bilkul wqpage jaisa hi StrictMode-safe pattern — taaki Back button
//   // dabane par sirf page number hi nahi, poora filter (jaise "Today" select
//   // kiya tha) bhi wapas restore ho jaye, "All Time" pe reset na ho.
//   const activePreset = searchParams.get('preset') || 'all'
//   const fromDate = searchParams.get('from') || ''
//   const toDate = searchParams.get('to') || ''

//   function setDateFilter({ preset, from, to }) {
//     setRecentPage(0)
//     setSearchParams(prev => {
//       const params = new URLSearchParams(prev)
//       if (preset !== undefined) {
//         if (preset) params.set('preset', preset)
//         else params.delete('preset')
//       }
//       if (from !== undefined) {
//         if (from) params.set('from', from)
//         else params.delete('from')
//       }
//       if (to !== undefined) {
//         if (to) params.set('to', to)
//         else params.delete('to')
//       }
//       params.set('wqpage', '1')
//       return params
//     }, { replace: true })
//   }

//   // Today's Work Queue ka page number ab URL mein (?wqpage=N) rakhte hain, na ki
//   // sessionStorage mein — kyunki jab Back button (browser history) dabate ho,
//   // URL apne aap wahi purana wala restore ho jata hai (page number sameत). Ye
//   // sessionStorage-wale approach se zyada reliable hai kyunki isme koi
//   // component-mount-timing wali race-condition nahi hoti.
//   const workQueuePage = Math.max(0, (parseInt(searchParams.get('wqpage'), 10) || 1) - 1)

//   function setWorkQueuePage(updater) {
//     setSearchParams(prev => {
//       const current = Math.max(0, (parseInt(prev.get('wqpage'), 10) || 1) - 1)
//       const next = typeof updater === 'function' ? updater(current) : updater
//       const params = new URLSearchParams(prev)
//       params.set('wqpage', String(next + 1))
//       return params
//     }, { replace: true })
//   }

//   useEffect(() => {
//     loadData()
//   }, [])

//   // Purana "StrictMode-safe filter-reset effect" (prevFilterRef wala) yahan se
//   // hata diya — ab zaroorat nahi hai, kyunki `setDateFilter` khud hi seedha
//   // (user-action ke response mein) `wqpage` reset kar deta hai; koi effect
//   // nahi chal raha jo StrictMode ke double-invoke se prabhavit ho sake.

//   async function loadData() {
//     setLoading(true)
//     try {
//       const [
//         { data: enqRows },
//         { data: fcRows },
//         { data: gaRows },
//         { data: poRows },
//         { data: woRows },
//         { data: qtRows },
//         { data: qrRows },
//       ] = await Promise.all([
//         supabase.from('enquiries').select('*'),
//         supabase.from('flowchart_tasks').select('*'),
//         supabase.from('ga_drawing_tasks').select('*'),
//         supabase.from('purchase_orders').select('*'),
//         supabase.from('work_orders').select('*'),
//         supabase.from('quotation_versions').select('*'),
//         supabase.from('questionnaire_rounds').select('*'),
//       ])
//       setEnquiries(enqRows || [])
//       setFcTasks(fcRows || [])
//       setGaTasks(gaRows || [])
//       setPoTasks(poRows || [])
//       setWoTasks(woRows || [])
//       setQtTasks(qtRows || [])
//       setQrTasks(qrRows || [])
//     } catch (err) {
//       console.error('Error loading dashboard data:', err)
//     } finally {
//       setLoading(false)
//     }
//   }

//   function applyPreset(key) {
//     const { from, to } = computeRange(key)
//     setDateFilter({ preset: key, from, to })
//   }

//   function applyManualDates() {
//     if (fromDate && toDate && toDate < fromDate) {
//       alert('"To" date cannot be before "From" date')
//       return
//     }
//     setDateFilter({ preset: '' })
//   }

//   const filteredEnquiries = useMemo(() => {
//     if (!fromDate && !toDate) return enquiries
//     return enquiries.filter(e => {
//       const d = e.date || ''
//       if (fromDate && d < fromDate) return false
//       if (toDate && d > toDate) return false
//       return true
//     })
//   }, [enquiries, fromDate, toDate])

//   const today = toISO(new Date())
//   const activeEnquiries = filteredEnquiries.filter(e => e.status === 'Active')
//   const wonEnquiries = filteredEnquiries.filter(e => e.status === 'Won')
//   const lostEnquiries = filteredEnquiries.filter(e => e.status === 'Lost')
//   // "overdueEnquiries" (date-filter se limited) hata diya — ab dono jagah
//   // (top card + Work Queue) `overdueEnquiriesForWorkQueue` (hamesha-poora,
//   // date-filter-independent) use karte hain.

//   // Today's Work Queue ke "Follow-up" items ke liye ALAG, HAMESHA-POORA
//   // (date-filter se independent) source — kyunki "Overdue" ka matlab hi
//   // hota hai ki uski date bahut PEHLE ki hai. Agar isे bhi upar wale
//   // date-filter (jo enquiry ki CREATION date pe based hai) se limit karte,
//   // to "Today" jaisa filter select karte hi saari genuinely-overdue
//   // enquiries (jo hafto/mahino pehle bani thi) gayab ho jaati — jo galat
//   // tha. Isliye Work Queue hamesha FULL `enquiries` list use karta hai.
//   const overdueEnquiriesForWorkQueue = useMemo(
//     () => enquiries.filter(e => e.status === 'Active' && e.next_followup_date && e.next_followup_date <= today),
//     [enquiries, today]
//   )

//   const enqMap = useMemo(() => {
//     const m = {}
//     enquiries.forEach(e => { m[e.enquiry_id] = e })
//     return m
//   }, [enquiries])

//   // ── Unified Work Queue ────────────────────────────────────
//   const workQueueItems = useMemo(() => {
//     const items = []

//     // NOTE: Questionnaire "sent — awaiting response" is intentionally NOT
//     // shown here anymore — that's Backend's own responsibility now (see
//     // BackendDashboard.jsx's Today's Work Queue). Admin/Followup no longer
//     // see it as an actionable item here.

//     // Flowchart — only "Shared with Client" (awaiting client decision). Due date
//     // uses the enquiry's own Next Follow-up Date (matches original Apps Script logic),
//     // falling back to the task's raw client_shared_date if that field is empty.
//     latestPerEnquiry(fcTasks)
//       .filter(t => t.status === 'Shared with Client' && enqMap[t.enquiry_id]?.status === 'Active')
//       .forEach(t => {
//         const enq = enqMap[t.enquiry_id]
//         const rawDue = enq?.next_followup_date || t.client_shared_date
//         if (!rawDue) return
//         const dueDate = rawDue.slice(0, 10)
//         if (dueDate > today) return
//         const isOverdue = dueDate < today
//         items.push({
//           type: 'flowchart',
//           icon: '🗂',
//           label: 'Flowchart',
//           color: '#6d28d9',
//           severity: isOverdue ? 'overdue' : 'due-today',
//           enquiryId: t.enquiry_id,
//           company: enq?.company_name,
//           message: 'Client decision needed on Flowchart',
//           date: dueDate,
//         })
//       })

//     // Quotation — Sent or Revision (awaiting client decision). Due date uses
//     // the enquiry's own Next Follow-up Date (jo Call Log se override ho sakti
//     // hai — jaise Flowchart mein bhi hota hai), warna task ke shared_date+6
//     // business-days wale computed default pe fallback karta hai.
//     latestPerEnquiry(qtTasks)
//       .filter(t => (t.status === 'Sent' || t.status === 'Revision') && enqMap[t.enquiry_id]?.status === 'Active')
//       .forEach(t => {
//         const enq = enqMap[t.enquiry_id]
//         const computedDue = t.shared_date ? formatDateISO(addBusinessDaysExcludingSunday(new Date(t.shared_date), 6)) : null
//         const rawDue = enq?.next_followup_date || computedDue
//         if (!rawDue) return
//         const dueDate = rawDue.slice(0, 10)
//         if (dueDate > today) return
//         const isOverdue = dueDate < today
//         items.push({
//           type: 'quotation',
//           icon: '💰',
//           label: 'Quotation',
//           color: '#0369a1',
//           severity: isOverdue ? 'overdue' : 'due-today',
//           enquiryId: t.enquiry_id,
//           company: enq?.company_name,
//           message: 'Client decision needed on Quotation',
//           date: dueDate,
//         })
//       })

//     // GA Drawing — sirf "Shared with Client" wala sub-case Follow-up ke Work
//     // Queue mein dikhega (Client ka decision pending hai — ye Follow-up ka
//     // kaam hai). "Approved by Admin" (abhi Client tak share hi nahi hui)
//     // wala sub-case ab SIRF Backend ke apne dashboard mein dikhega —
//     // Follow-up ko "Share GA Drawing with client" reminder ab yahan nahi
//     // aayega, kyunki wo Backend ki responsibility hai, Follow-up ki nahi.
//     latestPerEnquiry(gaTasks)
//       .filter(t => t.status === 'Shared with Client' && enqMap[t.enquiry_id]?.status === 'Active')
//       .forEach(t => {
//         const enq = enqMap[t.enquiry_id]
//         const rawDate = t.client_shared_date
//         if (!rawDate) return
//         const dueDate = rawDate.slice(0, 10)
//         if (dueDate > today) return
//         const isOverdue = dueDate < today
//         items.push({
//           type: 'ga_drawing',
//           icon: '📐',
//           label: 'GA Drawing',
//           color: '#0d9488',
//           severity: isOverdue ? 'overdue' : 'due-today',
//           enquiryId: t.enquiry_id,
//           company: enq?.company_name,
//           message: 'Client decision needed on GA Drawing',
//           date: dueDate,
//         })
//       })

//     // Generic Follow-up — shows independently even if the same enquiry also has a
//     // specific Flowchart/Quotation/GA Drawing item due; each due item gets its own row.
//     overdueEnquiriesForWorkQueue
//       .forEach(e => {
//         const isOverdue = e.next_followup_date < today
//         items.push({
//           type: 'followup',
//           icon: '🔔',
//           label: 'Follow-up',
//           color: isOverdue ? '#be123c' : '#b45309',
//           severity: isOverdue ? 'overdue' : 'due-today',
//           enquiryId: e.enquiry_id,
//           company: e.company_name,
//           message: isOverdue ? 'Follow-up overdue' : 'Follow-up due today',
//           date: e.next_followup_date,
//         })
//       })

//     if (isAdmin) {
//       latestPerEnquiry(poTasks)
//         .filter(t => t.status === 'Uploaded')
//         .forEach(t => {
//           items.push({
//             type: 'po',
//             icon: '📄',
//             label: 'PO Approval',
//             color: '#0369a1',
//             enquiryId: t.enquiry_id,
//             company: enqMap[t.enquiry_id]?.company_name,
//             message: 'Awaiting your approval',
//             date: t.upload_date,
//           })
//         })

//       latestPerEnquiry(woTasks)
//         .filter(t => t.status === 'Submitted for Review')
//         .forEach(t => {
//           items.push({
//             type: 'wo',
//             icon: '📋',
//             label: 'Work Order',
//             color: '#059669',
//             enquiryId: t.enquiry_id,
//             company: enqMap[t.enquiry_id]?.company_name,
//             message: 'Submitted for review',
//             date: t.designer_submission_date,
//           })
//         })
//     }

//     // Agar From/To date-filter select hai (jaise "Today", "Last 7 Days"), to
//     // Work Queue ko bhi usi date-range ke hisaab se filter karo — sirf wahi
//     // items dikhao jinki due-date us range ke andar aati hai. Filter khaali
//     // ho (All Time) to sab kuch dikhega, jaisa pehle hota tha.
//     //
//     // IMPORTANT: "Overdue" items hamesha dikhte rahenge, chahe koi bhi
//     // date-filter select ho — kyunki "Overdue" ka matlab hi hota hai ki
//     // uski date filter-range se PEHLE ki hai. Agar unhe bhi date-range se
//     // filter karte, to "Today" jaisa specific-date filter select karte hi
//     // Overdue items hamesha 0 dikhte (kyunki unki date kabhi "aaj" ki nahi
//     // hoti) — jo galat/confusing tha.
//     const filtered = (!fromDate && !toDate)
//       ? items
//       : items.filter(item => {
//           if (item.severity === 'overdue') return true
//           if (!item.date) return false
//           const d = item.date.slice(0, 10)
//           if (fromDate && d < fromDate) return false
//           if (toDate && d > toDate) return false
//           return true
//         })

//     const severityRank = { overdue: 0, 'due-today': 1 }
//     return filtered.sort((a, b) => {
//       const ra = severityRank[a.severity] ?? 2
//       const rb = severityRank[b.severity] ?? 2
//       if (ra !== rb) return ra - rb
//       if (ra === 0) return new Date(a.date || 0) - new Date(b.date || 0) // most overdue first
//       return new Date(b.date || 0) - new Date(a.date || 0)
//     })
//   }, [overdueEnquiriesForWorkQueue, fcTasks, gaTasks, qtTasks, poTasks, woTasks, qrTasks, enqMap, isAdmin, today, fromDate, toDate])

//   // Agar list chhoti ho jaye (kuch items complete ho gaye ho) to URL wala page
//   // number invalid ho sakta hai — usko valid range mein wapas le aate hain.
//   // IMPORTANT: jab tak data load ho raha hai (loading=true), workQueueItems
//   // temporarily khali hota hai — us waqt clamp mat karo, warna URL wala page
//   // galti se 0 pe reset ho jayega.
//   // Work Queue summary counts (matches original Apps Script's 6-card breakdown)
//   const wqTotalCount = workQueueItems.length
//   const wqOverdueCount = workQueueItems.filter(i => i.type === 'followup' && i.severity === 'overdue').length
//   const wqFollowupTodayCount = workQueueItems.filter(i => i.type === 'followup' && i.severity !== 'overdue').length
//   const wqFlowchartCount = workQueueItems.filter(i => i.type === 'flowchart').length
//   const wqQuotationCount = workQueueItems.filter(i => i.type === 'quotation').length
//   const wqGaCount = workQueueItems.filter(i => i.type === 'ga_drawing').length

//   // Jis card pe click hua hai, table ko usi ke hisaab se filter karte hain —
//   // exactly wahi condition jo upar wale counts calculate karne mein use hui.
//   const displayedWorkQueueItems = useMemo(() => {
//     if (wqTypeFilter === 'overdue') return workQueueItems.filter(i => i.type === 'followup' && i.severity === 'overdue')
//     if (wqTypeFilter === 'due-today') return workQueueItems.filter(i => i.type === 'followup' && i.severity !== 'overdue')
//     if (wqTypeFilter === 'flowchart') return workQueueItems.filter(i => i.type === 'flowchart')
//     if (wqTypeFilter === 'quotation') return workQueueItems.filter(i => i.type === 'quotation')
//     if (wqTypeFilter === 'ga_drawing') return workQueueItems.filter(i => i.type === 'ga_drawing')
//     return workQueueItems
//   }, [workQueueItems, wqTypeFilter])

//   useEffect(() => {
//     if (loading) return
//     const totalPages = Math.max(1, Math.ceil(displayedWorkQueueItems.length / 10))
//     if (workQueuePage > totalPages - 1) setWorkQueuePage(totalPages - 1)
//   }, [displayedWorkQueueItems, workQueuePage, loading])

//   // latest quotation amount per enquiry
//   const latestQuotationAmountMap = useMemo(() => {
//     const map = {}
//     latestPerEnquiry(qtTasks).forEach(q => {
//       if (q.amount !== null && q.amount !== undefined) map[q.enquiry_id] = q.amount
//     })
//     return map
//   }, [qtTasks])

//   function getDisplayAmount(e) {
//     if (e.status === 'Won' && e.final_order_value) return e.final_order_value
//     if (latestQuotationAmountMap[e.enquiry_id] !== undefined) return latestQuotationAmountMap[e.enquiry_id]
//     return null
//   }

//   // ── Monthly trend (last 12 months, admin only) ────────────
//   const monthlyTrend = useMemo(() => {
//     if (!isAdmin) return []
//     const now = new Date()
//     const buckets = []
//     for (let i = 11; i >= 0; i--) {
//       const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
//       buckets.push({
//         key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
//         label: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
//         count: 0,
//       })
//     }
//     const bucketMap = {}
//     buckets.forEach(b => { bucketMap[b.key] = b })

//     enquiries.forEach(e => {
//       if (!e.date) return
//       const key = e.date.slice(0, 7)
//       if (bucketMap[key]) bucketMap[key].count++
//     })

//     return buckets
//   }, [enquiries, isAdmin])

//   const monthlyTotal = monthlyTrend.reduce((s, m) => s + m.count, 0)

//   // ── Recent enquiries (paginated) ──────────────────────────
//   const recentEnquiries = useMemo(() => {
//     return [...filteredEnquiries].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
//   }, [filteredEnquiries])

//   const RECENT_PER_PAGE = 8
//   const recentTotalPages = Math.ceil(recentEnquiries.length / RECENT_PER_PAGE) || 1
//   const recentPageSlice = recentEnquiries.slice(recentPage * RECENT_PER_PAGE, (recentPage + 1) * RECENT_PER_PAGE)

//   function openStatModal(title, list) {
//     if (!list.length) return
//     setStatModal({ title, list })
//   }

//   if (loading) {
//     return <div className="sd-loading"><i className="fas fa-spinner fa-spin"></i> Loading dashboard…</div>
//   }

//   return (
//     <div>
//       <h2 className="dash-greeting">Hello, {user?.name}! 👋</h2>
//       <p className="dash-greeting-sub">Your enquiry summary and today's tasks.</p>

//       {/* ── Date Filter Bar ─────────────────────────────── */}
//       <div className="dash-filter-bar">
//         <label>From</label>
//         <input type="date" value={fromDate} onChange={e => setDateFilter({ preset: '', from: e.target.value })} />
//         <label>To</label>
//         <input type="date" value={toDate} onChange={e => setDateFilter({ preset: '', to: e.target.value })} />
//         <button className="btn-apply" onClick={applyManualDates}>
//           <i className="fas fa-search"></i> Apply
//         </button>
//         <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
//           {QUICK_RANGES.map(r => (
//             <button
//               key={r.key}
//               className={`quick-btn ${activePreset === r.key ? 'active' : ''}`}
//               onClick={() => applyPreset(r.key)}
//             >
//               {r.label}
//             </button>
//           ))}
//         </div>
//         <button className="btn-clear" onClick={() => applyPreset('all')}>
//           <i className="fas fa-times"></i> Clear
//         </button>
//       </div>

//       {/* ── Stats Cards (clickable) ─────────────────────── */}
//       <div className="stats-grid">
//         <div className="stat-card c-green" onClick={() => openStatModal('Total Enquiries', filteredEnquiries)}>
//           <div className="stat-icon"><i className="fas fa-inbox"></i></div>
//           <div className="stat-value">{filteredEnquiries.length}</div>
//           <div className="stat-label">Total Enquiries</div>
//         </div>
//         <div className="stat-card c-teal" onClick={() => openStatModal('Active Enquiries', activeEnquiries)}>
//           <div className="stat-icon"><i className="fas fa-spinner"></i></div>
//           <div className="stat-value">{activeEnquiries.length}</div>
//           <div className="stat-label">Active</div>
//         </div>
//         <div className="stat-card c-emerald" onClick={() => openStatModal('Won Enquiries', wonEnquiries)}>
//           <div className="stat-icon"><i className="fas fa-trophy"></i></div>
//           <div className="stat-value">{wonEnquiries.length}</div>
//           <div className="stat-label">Won</div>
//         </div>
//         <div className="stat-card c-rose" onClick={() => openStatModal('Lost Enquiries', lostEnquiries)}>
//           <div className="stat-icon"><i className="fas fa-times-circle"></i></div>
//           <div className="stat-value">{lostEnquiries.length}</div>
//           <div className="stat-label">Lost</div>
//         </div>
//         <div className="stat-card c-amber" onClick={() => openStatModal('Overdue Follow-ups', overdueEnquiriesForWorkQueue)}>
//           <div className="stat-icon"><i className="fas fa-bell"></i></div>
//           <div className="stat-value">{overdueEnquiriesForWorkQueue.length}</div>
//           <div className="stat-label">Overdue Follow-ups</div>
//         </div>
//       </div>

//       {/* ── Unified Work Queue ──────────────────────────── */}
//       <div className="workqueue-card">
//         <div className="workqueue-left">
//           <div className="workqueue-icon">📋</div>
//           <div>
//             <div className="workqueue-title">Today's Work Queue</div>
//             <div className="workqueue-date">
//               {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
//             </div>
//             {(fromDate || toDate) && (
//               <div style={{ fontSize: 11, color: 'var(--amber, #b45309)', fontWeight: 600, marginTop: 2 }}>
//                 Filtered {fromDate || '…'} → {toDate || '…'}
//               </div>
//             )}
//           </div>
//         </div>
//         <div className="workqueue-badge">
//           {workQueueItems.length > 0 ? `${workQueueItems.length} pending` : 'All Clear ✓'}
//         </div>
//       </div>

//       {workQueueItems.length === 0 ? (
//         <div className="workqueue-empty">
//           <i className="fas fa-check-circle"></i>
//           All clear! No pending work right now. 🎉
//         </div>
//       ) : (
//         <div className="card" style={{ marginTop: -20 }}>
//           <div className="wq-summary-row">
//             {[
//               ['Total Pending', wqTotalCount, wqTotalCount > 0 ? 'var(--rose)' : 'var(--muted)', 'all'],
//               ['Overdue Calls', wqOverdueCount, wqOverdueCount > 0 ? 'var(--rose)' : 'var(--muted)', 'overdue'],
//               ['Follow-up Today', wqFollowupTodayCount, wqFollowupTodayCount > 0 ? 'var(--amber)' : 'var(--muted)', 'due-today'],
//               ['Flowchart', wqFlowchartCount, wqFlowchartCount > 0 ? '#6d28d9' : 'var(--muted)', 'flowchart'],
//               ['Quotation', wqQuotationCount, wqQuotationCount > 0 ? 'var(--sky)' : 'var(--muted)', 'quotation'],
//               ['GA Drawing', wqGaCount, wqGaCount > 0 ? 'var(--teal)' : 'var(--muted)', 'ga_drawing'],
//             ].map(([label, count, color, filterKey]) => (
//               <div
//                 key={label}
//                 className="wq-summary-cell"
//                 style={{
//                   color, cursor: 'pointer',
//                   background: wqTypeFilter === filterKey ? `${color}14` : 'transparent',
//                   borderRadius: 10,
//                   outline: wqTypeFilter === filterKey ? `2px solid ${color}` : 'none',
//                   transition: 'all .15s',
//                 }}
//                 onClick={() => { setWqTypeFilter(filterKey); setWorkQueuePage(0) }}
//               >
//                 <div className="wq-summary-value">{count}</div>
//                 <div className="wq-summary-label">{label}</div>
//               </div>
//             ))}
//           </div>

//           {wqTypeFilter !== 'all' && (
//             <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 12px' }}>
//               <span style={{ fontSize: 12, color: 'var(--muted)' }}>
//                 Showing only: <strong>{{ overdue: 'Overdue Calls', 'due-today': 'Follow-up Today', flowchart: 'Flowchart', quotation: 'Quotation', ga_drawing: 'GA Drawing' }[wqTypeFilter]}</strong>
//               </span>
//               <button className="quick-btn" onClick={() => { setWqTypeFilter('all'); setWorkQueuePage(0) }}>
//                 <i className="fas fa-times"></i> Clear Filter
//               </button>
//             </div>
//           )}
//           <div className="table-wrap">
//             <table className="dt">
//               <thead>
//                 <tr><th>Type</th><th>Enquiry ID</th><th>Company</th><th>Detail</th><th>Date</th><th></th></tr>
//               </thead>
//               <tbody>
//                 {displayedWorkQueueItems.slice(workQueuePage * 10, workQueuePage * 10 + 10).map((item, i) => (
//                   <tr
//                     key={i}
//                     className={item.severity === 'overdue' ? 'wq-row-overdue' : item.severity === 'due-today' ? 'wq-row-due-today' : ''}
//                     onClick={() => navigate(`/enquiries/${item.enquiryId}`)}
//                   >
//                     <td>
//                       <span className="badge" style={{ background: `${item.color}18`, color: item.color }}>
//                         {item.icon} {item.label}
//                       </span>
//                     </td>
//                     <td><span style={{ fontFamily: 'var(--mono)', color: 'var(--green)', fontSize: 12, fontWeight: 700 }}>{item.enquiryId}</span></td>
//                     <td><strong>{item.company || '—'}</strong></td>
//                     <td style={{ color: 'var(--muted)', fontSize: 12.5 }}>{item.message}</td>
//                     <td>
//                       <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: item.severity === 'overdue' ? 'var(--rose)' : item.severity === 'due-today' ? 'var(--amber)' : 'var(--muted)', fontWeight: item.severity ? 700 : 400 }}>
//                         {formatDateDisplay(item.date)}
//                       </span>
//                     </td>
//                     <td>
//                       <button className="quick-btn" onClick={(ev) => { ev.stopPropagation(); navigate(`/enquiries/${item.enquiryId}`) }}>
//                         Open →
//                       </button>
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//           {displayedWorkQueueItems.length > 10 && (
//             <div className="sd-pagination">
//               <span>{workQueuePage * 10 + 1}–{Math.min(workQueuePage * 10 + 10, displayedWorkQueueItems.length)} of {displayedWorkQueueItems.length}</span>
//               <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
//                 <button className="quick-btn" disabled={workQueuePage === 0} onClick={() => setWorkQueuePage(p => p - 1)}>← Prev</button>
//                 <input
//                   type="number"
//                   min={1}
//                   max={Math.ceil(displayedWorkQueueItems.length / 10)}
//                   value={workQueuePage + 1}
//                   onFocus={(e) => e.target.select()}
//                   onChange={(e) => {
//                     const totalPages = Math.ceil(displayedWorkQueueItems.length / 10)
//                     let n = parseInt(e.target.value, 10)
//                     if (isNaN(n)) return
//                     if (n < 1) n = 1
//                     if (n > totalPages) n = totalPages
//                     setWorkQueuePage(n - 1)
//                   }}
//                   style={{
//                     width: 48, textAlign: 'center', padding: '6px 4px',
//                     borderRadius: 8, border: '1px solid var(--border)',
//                     fontFamily: 'var(--mono)', fontSize: 12.5,
//                   }}
//                 />
//                 <span style={{ fontSize: 12, color: 'var(--muted)' }}>/ {Math.ceil(displayedWorkQueueItems.length / 10)}</span>
//                 <button className="quick-btn" disabled={(workQueuePage + 1) * 10 >= displayedWorkQueueItems.length} onClick={() => setWorkQueuePage(p => p + 1)}>Next →</button>
//               </div>
//             </div>
//           )}
//         </div>
//       )}

//       {/* ── Pipeline Stages ─────────────────────────────── */}
//       <PipelineStagesCard enquiries={filteredEnquiries} stages={stages} getDisplayAmount={getDisplayAmount} />

//       {/* ── Recent Enquiries ────────────────────────────── */}
//       <div className="card">
//         <div className="card-header">
//           <div className="card-title">🕐 Recent Enquiries</div>
//           <button className="quick-btn" onClick={() => navigate('/enquiries')}>View All →</button>
//         </div>
//         <div className="table-wrap">
//           <table className="dt">
//             <thead>
//               <tr><th>ID</th><th>Client</th><th>Stage</th><th>Date</th></tr>
//             </thead>
//             <tbody>
//               {recentPageSlice.length === 0 ? (
//                 <tr><td colSpan={4} style={{ textAlign: 'center', padding: 28, color: 'var(--muted)' }}>No enquiries found</td></tr>
//               ) : (
//                 recentPageSlice.map(e => (
//                   <tr key={e.id} onClick={() => navigate(`/enquiries/${e.enquiry_id}`)}>
//                     <td><span style={{ fontFamily: 'var(--mono)', color: 'var(--green)', fontSize: 12 }}>{e.enquiry_id}</span></td>
//                     <td><strong>{e.company_name || '—'}</strong></td>
//                     <td><span className="badge b-gray">{e.current_stage || '—'}</span></td>
//                     <td><span style={{ fontFamily: 'var(--mono)', color: 'var(--muted)', fontSize: 12 }}>{formatDateDisplay(e.date)}</span></td>
//                   </tr>
//                 ))
//               )}
//             </tbody>
//           </table>
//         </div>
//         {recentTotalPages > 1 && (
//           <div className="sd-pagination">
//             <span>{recentPage * RECENT_PER_PAGE + 1}–{Math.min((recentPage + 1) * RECENT_PER_PAGE, recentEnquiries.length)} of {recentEnquiries.length}</span>
//             <div style={{ display: 'flex', gap: 6 }}>
//               <button className="quick-btn" disabled={recentPage === 0} onClick={() => setRecentPage(p => p - 1)}>← Prev</button>
//               <button className="quick-btn" disabled={recentPage >= recentTotalPages - 1} onClick={() => setRecentPage(p => p + 1)}>Next →</button>
//             </div>
//           </div>
//         )}
//       </div>

//       {/* ── Monthly Trend Chart (admin only) ────────────── */}
//       {isAdmin && (
//         <div className="card">
//           <div className="card-header">
//             <div className="card-title">📊 Monthly Enquiries Trend</div>
//             <span style={{ fontSize: 12, color: 'var(--muted)' }}>Total: {monthlyTotal} in last 12 months</span>
//           </div>
//           <div className="card-body">
//             <ResponsiveContainer width="100%" height={280}>
//               <BarChart data={monthlyTrend} margin={{ top: 6, right: 10, left: -10, bottom: 0 }}>
//                 <defs>
//                   <linearGradient id="sdMonthlyGradient" x1="0" y1="0" x2="0" y2="1">
//                     <stop offset="0%" stopColor="#2d7a47" stopOpacity={0.95} />
//                     <stop offset="100%" stopColor="#2d7a47" stopOpacity={0.5} />
//                   </linearGradient>
//                 </defs>
//                 <CartesianGrid strokeDasharray="3 3" stroke="#e5ede6" vertical={false} />
//                 <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6a8c6f' }} axisLine={{ stroke: '#d4e0d6' }} tickLine={false} />
//                 <YAxis tick={{ fontSize: 11, fill: '#6a8c6f' }} axisLine={false} tickLine={false} allowDecimals={false} />
//                 <Tooltip
//                   cursor={{ fill: 'rgba(45,122,71,.06)' }}
//                   contentStyle={{ background: '#fff', border: '1px solid #d4e0d6', borderRadius: 10, fontSize: 12.5 }}
//                 />
//                 <Bar dataKey="count" name="Enquiries" fill="url(#sdMonthlyGradient)" radius={[6, 6, 0, 0]} animationDuration={900} />
//               </BarChart>
//             </ResponsiveContainer>
//           </div>
//         </div>
//       )}

//       {/* ── Stat Detail Modal ────────────────────────────── */}
//       {statModal && (
//         <div className="sd-modal-overlay" onClick={() => setStatModal(null)}>
//           <div className="sd-modal" onClick={e => e.stopPropagation()}>
//             <div className="sd-modal-header">
//               <span>{statModal.title} ({statModal.list.length})</span>
//               <button onClick={() => setStatModal(null)}><i className="fas fa-times"></i></button>
//             </div>
//             <div className="sd-modal-body">
//               <table className="dt">
//                 <thead>
//                   <tr><th>ID</th><th>Company</th><th>Stage</th><th>Status</th><th>Date</th></tr>
//                 </thead>
//                 <tbody>
//                   {statModal.list.map(e => (
//                     <tr key={e.id} onClick={() => { setStatModal(null); navigate(`/enquiries/${e.enquiry_id}`) }}>
//                       <td><span style={{ fontFamily: 'var(--mono)', color: 'var(--green)', fontSize: 12 }}>{e.enquiry_id}</span></td>
//                       <td><strong>{e.company_name || '—'}</strong></td>
//                       <td><span className="badge b-gray">{e.current_stage || '—'}</span></td>
//                       <td>
//                         <span className={`badge ${e.status === 'Won' ? 'b-emerald' : e.status === 'Lost' ? 'b-rose' : 'b-teal'}`}>
//                           {e.status}
//                         </span>
//                       </td>
//                       <td><span style={{ fontFamily: 'var(--mono)', color: 'var(--muted)', fontSize: 12 }}>{formatDateDisplay(e.date)}</span></td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   )
// }

import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../../lib/supabaseClient'
import { useDropdownData } from '../../lib/useDropdownData'
import { latestPerEnquiry } from '../../lib/queueHelpers'
import { formatDateDisplay, addBusinessDaysExcludingSunday, formatDateISO } from '../../lib/dateHelpers'
import PipelineStagesCard from '../../components/PipelineStagesCard'
import './StandardDashboard.css'

const QUICK_RANGES = [
  { key: 'all', label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
  { key: '3m', label: 'Last 3 Months' },
  { key: '6m', label: 'Last 6 Months' },
  { key: 'thisM', label: 'This Month' },
  { key: 'thisY', label: 'This Year' },
]

const STAGE_ACCENTS = ['#534AB7', '#0369a1', '#6d28d9', '#0d9488', '#b45309', '#be123c', '#059669', '#888780']

function toISO(d) { return d.toISOString().slice(0, 10) }

function computeRange(key) {
  const today = new Date()
  const end = toISO(today)
  if (key === 'all') return { from: '', to: '' }
  if (key === 'today') return { from: end, to: end }
  if (key === '7d') { const d = new Date(today); d.setDate(d.getDate() - 6); return { from: toISO(d), to: end } }
  if (key === '30d') { const d = new Date(today); d.setDate(d.getDate() - 29); return { from: toISO(d), to: end } }
  if (key === '3m') { const d = new Date(today); d.setMonth(d.getMonth() - 3); return { from: toISO(d), to: end } }
  if (key === '6m') { const d = new Date(today); d.setMonth(d.getMonth() - 6); return { from: toISO(d), to: end } }
  if (key === 'thisM') return { from: toISO(new Date(today.getFullYear(), today.getMonth(), 1)), to: end }
  if (key === 'thisY') return { from: `${today.getFullYear()}-01-01`, to: end }
  return { from: '', to: '' }
}

export default function StandardDashboard({ user }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { stages } = useDropdownData()
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'

  const [loading, setLoading] = useState(true)
  const [enquiries, setEnquiries] = useState([])
  const [fcTasks, setFcTasks] = useState([])
  const [gaTasks, setGaTasks] = useState([])
  const [poTasks, setPoTasks] = useState([])
  const [woTasks, setWoTasks] = useState([])
  const [qtTasks, setQtTasks] = useState([])
  const [qrTasks, setQrTasks] = useState([])

  const [wqTypeFilter, setWqTypeFilter] = useState('all') // 'all' | 'overdue' | 'due-today' | 'flowchart' | 'quotation' | 'ga_drawing'

  const [statModal, setStatModal] = useState(null)
  const [recentPage, setRecentPage] = useState(0)

  // Date-filter (preset/From/To) ab bhi URL mein (?preset=&from=&to=) rakhte
  // hain — bilkul wqpage jaisa hi StrictMode-safe pattern — taaki Back button
  // dabane par sirf page number hi nahi, poora filter (jaise "Today" select
  // kiya tha) bhi wapas restore ho jaye, "All Time" pe reset na ho.
  const activePreset = searchParams.get('preset') || 'all'
  const fromDate = searchParams.get('from') || ''
  const toDate = searchParams.get('to') || ''

  function setDateFilter({ preset, from, to }) {
    setRecentPage(0)
    setSearchParams(prev => {
      const params = new URLSearchParams(prev)
      if (preset !== undefined) {
        if (preset) params.set('preset', preset)
        else params.delete('preset')
      }
      if (from !== undefined) {
        if (from) params.set('from', from)
        else params.delete('from')
      }
      if (to !== undefined) {
        if (to) params.set('to', to)
        else params.delete('to')
      }
      params.set('wqpage', '1')
      return params
    }, { replace: true })
  }

  // Today's Work Queue ka page number ab URL mein (?wqpage=N) rakhte hain, na ki
  // sessionStorage mein — kyunki jab Back button (browser history) dabate ho,
  // URL apne aap wahi purana wala restore ho jata hai (page number sameत). Ye
  // sessionStorage-wale approach se zyada reliable hai kyunki isme koi
  // component-mount-timing wali race-condition nahi hoti.
  const workQueuePage = Math.max(0, (parseInt(searchParams.get('wqpage'), 10) || 1) - 1)

  function setWorkQueuePage(updater) {
    setSearchParams(prev => {
      const current = Math.max(0, (parseInt(prev.get('wqpage'), 10) || 1) - 1)
      const next = typeof updater === 'function' ? updater(current) : updater
      const params = new URLSearchParams(prev)
      params.set('wqpage', String(next + 1))
      return params
    }, { replace: true })
  }

  useEffect(() => {
    loadData()
  }, [])

  // Purana "StrictMode-safe filter-reset effect" (prevFilterRef wala) yahan se
  // hata diya — ab zaroorat nahi hai, kyunki `setDateFilter` khud hi seedha
  // (user-action ke response mein) `wqpage` reset kar deta hai; koi effect
  // nahi chal raha jo StrictMode ke double-invoke se prabhavit ho sake.

  async function loadData() {
    setLoading(true)
    try {
      const [
        { data: enqRows },
        { data: fcRows },
        { data: gaRows },
        { data: poRows },
        { data: woRows },
        { data: qtRows },
        { data: qrRows },
      ] = await Promise.all([
        supabase.from('enquiries').select('*'),
        supabase.from('flowchart_tasks').select('*'),
        supabase.from('ga_drawing_tasks').select('*'),
        supabase.from('purchase_orders').select('*'),
        supabase.from('work_orders').select('*'),
        supabase.from('quotation_versions').select('*'),
        supabase.from('questionnaire_rounds').select('*'),
      ])
      setEnquiries(enqRows || [])
      setFcTasks(fcRows || [])
      setGaTasks(gaRows || [])
      setPoTasks(poRows || [])
      setWoTasks(woRows || [])
      setQtTasks(qtRows || [])
      setQrTasks(qrRows || [])
    } catch (err) {
      console.error('Error loading dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  function applyPreset(key) {
    const { from, to } = computeRange(key)
    setDateFilter({ preset: key, from, to })
  }

  function applyManualDates() {
    if (fromDate && toDate && toDate < fromDate) {
      alert('"To" date cannot be before "From" date')
      return
    }
    setDateFilter({ preset: '' })
  }

  const filteredEnquiries = useMemo(() => {
    if (!fromDate && !toDate) return enquiries
    return enquiries.filter(e => {
      const d = e.date || ''
      if (fromDate && d < fromDate) return false
      if (toDate && d > toDate) return false
      return true
    })
  }, [enquiries, fromDate, toDate])

  const today = toISO(new Date())
  const activeEnquiries = filteredEnquiries.filter(e => e.status === 'Active')
  const wonEnquiries = filteredEnquiries.filter(e => e.status === 'Won')
  const lostEnquiries = filteredEnquiries.filter(e => e.status === 'Lost')
  // "overdueEnquiries" (date-filter se limited) hata diya — ab dono jagah
  // (top card + Work Queue) `overdueEnquiriesForWorkQueue` (hamesha-poora,
  // date-filter-independent) use karte hain.

  // Today's Work Queue ke "Follow-up" items ke liye ALAG, HAMESHA-POORA
  // (date-filter se independent) source — kyunki "Overdue" ka matlab hi
  // hota hai ki uski date bahut PEHLE ki hai. Agar isे bhi upar wale
  // date-filter (jo enquiry ki CREATION date pe based hai) se limit karte,
  // to "Today" jaisa filter select karte hi saari genuinely-overdue
  // enquiries (jo hafto/mahino pehle bani thi) gayab ho jaati — jo galat
  // tha. Isliye Work Queue hamesha FULL `enquiries` list use karta hai.
  const overdueEnquiriesForWorkQueue = useMemo(
    () => enquiries.filter(e => e.status === 'Active' && e.next_followup_date && e.next_followup_date <= today),
    [enquiries, today]
  )

  const enqMap = useMemo(() => {
    const m = {}
    enquiries.forEach(e => { m[e.enquiry_id] = e })
    return m
  }, [enquiries])

  // ── Unified Work Queue ────────────────────────────────────
  const workQueueItems = useMemo(() => {
    const items = []

    // NOTE: Questionnaire "sent — awaiting response" is intentionally NOT
    // shown here anymore — that's Backend's own responsibility now (see
    // BackendDashboard.jsx's Today's Work Queue). Admin/Followup no longer
    // see it as an actionable item here.

    // Flowchart — only "Shared with Client" (awaiting client decision). Due date
    // uses the enquiry's own Next Follow-up Date (matches original Apps Script logic),
    // falling back to the task's raw client_shared_date if that field is empty.
    latestPerEnquiry(fcTasks)
      .filter(t => t.status === 'Shared with Client' && enqMap[t.enquiry_id]?.status === 'Active')
      .forEach(t => {
        const enq = enqMap[t.enquiry_id]
        const rawDue = enq?.next_followup_date || t.client_shared_date
        if (!rawDue) return
        const dueDate = rawDue.slice(0, 10)
        if (dueDate > today) return
        const isOverdue = dueDate < today
        items.push({
          type: 'flowchart',
          icon: '🗂',
          label: 'Flowchart',
          color: '#6d28d9',
          severity: isOverdue ? 'overdue' : 'due-today',
          enquiryId: t.enquiry_id,
          company: enq?.company_name,
          message: 'Client decision needed on Flowchart',
          date: dueDate,
        })
      })

    // Quotation — Sent or Revision (awaiting client decision). Due date uses
    // the enquiry's own Next Follow-up Date (jo Call Log se override ho sakti
    // hai — jaise Flowchart mein bhi hota hai), warna task ke shared_date+6
    // business-days wale computed default pe fallback karta hai.
    latestPerEnquiry(qtTasks)
      .filter(t => (t.status === 'Sent' || t.status === 'Revision') && enqMap[t.enquiry_id]?.status === 'Active')
      .forEach(t => {
        const enq = enqMap[t.enquiry_id]
        const computedDue = t.shared_date ? formatDateISO(addBusinessDaysExcludingSunday(new Date(t.shared_date), 6)) : null
        const rawDue = enq?.next_followup_date || computedDue
        if (!rawDue) return
        const dueDate = rawDue.slice(0, 10)
        if (dueDate > today) return
        const isOverdue = dueDate < today
        items.push({
          type: 'quotation',
          icon: '💰',
          label: 'Quotation',
          color: '#0369a1',
          severity: isOverdue ? 'overdue' : 'due-today',
          enquiryId: t.enquiry_id,
          company: enq?.company_name,
          message: 'Client decision needed on Quotation',
          date: dueDate,
        })
      })

    // GA Drawing — sirf "Shared with Client" wala sub-case Follow-up ke Work
    // Queue mein dikhega (Client ka decision pending hai — ye Follow-up ka
    // kaam hai). "Approved by Admin" (abhi Client tak share hi nahi hui)
    // wala sub-case ab SIRF Backend ke apne dashboard mein dikhega —
    // Follow-up ko "Share GA Drawing with client" reminder ab yahan nahi
    // aayega, kyunki wo Backend ki responsibility hai, Follow-up ki nahi.
    latestPerEnquiry(gaTasks)
      .filter(t => t.status === 'Shared with Client' && enqMap[t.enquiry_id]?.status === 'Active')
      .forEach(t => {
        const enq = enqMap[t.enquiry_id]
        const rawDate = t.client_shared_date
        if (!rawDate) return
        const dueDate = rawDate.slice(0, 10)
        if (dueDate > today) return
        const isOverdue = dueDate < today
        items.push({
          type: 'ga_drawing',
          icon: '📐',
          label: 'GA Drawing',
          color: '#0d9488',
          severity: isOverdue ? 'overdue' : 'due-today',
          enquiryId: t.enquiry_id,
          company: enq?.company_name,
          message: 'Client decision needed on GA Drawing',
          date: dueDate,
        })
      })

    // Generic Follow-up — SIRF un enquiries ke liye jinka koi bhi specific-
    // module item (Flowchart/Quotation/GA Drawing) pending NAHI hai. Agar
    // kisi enquiry ka pehle se hi specific-module item ban chuka hai (jo
    // upar bana), to uska generic "Follow-up" row SKIP karte hain — kyunki
    // dono ek hi `next_followup_date` field se date lete hain aur ek jaisa
    // hi "call karo" reminder hote, isse duplicate/confusing lagta tha.
    const enquiriesWithSpecificModuleItem = new Set(
      items.filter(i => i.type === 'flowchart' || i.type === 'quotation' || i.type === 'ga_drawing').map(i => i.enquiryId)
    )
    overdueEnquiriesForWorkQueue
      .filter(e => !enquiriesWithSpecificModuleItem.has(e.enquiry_id))
      .forEach(e => {
        const isOverdue = e.next_followup_date < today
        items.push({
          type: 'followup',
          icon: '🔔',
          label: 'Follow-up',
          color: isOverdue ? '#be123c' : '#b45309',
          severity: isOverdue ? 'overdue' : 'due-today',
          enquiryId: e.enquiry_id,
          company: e.company_name,
          message: isOverdue ? 'Follow-up overdue' : 'Follow-up due today',
          date: e.next_followup_date,
        })
      })

    if (isAdmin) {
      latestPerEnquiry(poTasks)
        .filter(t => t.status === 'Uploaded')
        .forEach(t => {
          items.push({
            type: 'po',
            icon: '📄',
            label: 'PO Approval',
            color: '#0369a1',
            enquiryId: t.enquiry_id,
            company: enqMap[t.enquiry_id]?.company_name,
            message: 'Awaiting your approval',
            date: t.upload_date,
          })
        })

      latestPerEnquiry(woTasks)
        .filter(t => t.status === 'Submitted for Review')
        .forEach(t => {
          items.push({
            type: 'wo',
            icon: '📋',
            label: 'Work Order',
            color: '#059669',
            enquiryId: t.enquiry_id,
            company: enqMap[t.enquiry_id]?.company_name,
            message: 'Submitted for review',
            date: t.designer_submission_date,
          })
        })
    }

    // Agar From/To date-filter select hai (jaise "Today", "Last 7 Days"), to
    // Work Queue ko bhi usi date-range ke hisaab se filter karo — sirf wahi
    // items dikhao jinki due-date us range ke andar aati hai. Filter khaali
    // ho (All Time) to sab kuch dikhega, jaisa pehle hota tha.
    //
    // IMPORTANT: "Overdue" items hamesha dikhte rahenge, chahe koi bhi
    // date-filter select ho — kyunki "Overdue" ka matlab hi hota hai ki
    // uski date filter-range se PEHLE ki hai. Agar unhe bhi date-range se
    // filter karte, to "Today" jaisa specific-date filter select karte hi
    // Overdue items hamesha 0 dikhte (kyunki unki date kabhi "aaj" ki nahi
    // hoti) — jo galat/confusing tha.
    const filtered = (!fromDate && !toDate)
      ? items
      : items.filter(item => {
          if (item.severity === 'overdue') return true
          if (!item.date) return false
          const d = item.date.slice(0, 10)
          if (fromDate && d < fromDate) return false
          if (toDate && d > toDate) return false
          return true
        })

    const severityRank = { overdue: 0, 'due-today': 1 }
    return filtered.sort((a, b) => {
      const ra = severityRank[a.severity] ?? 2
      const rb = severityRank[b.severity] ?? 2
      if (ra !== rb) return ra - rb
      if (ra === 0) return new Date(a.date || 0) - new Date(b.date || 0) // most overdue first
      return new Date(b.date || 0) - new Date(a.date || 0)
    })
  }, [overdueEnquiriesForWorkQueue, fcTasks, gaTasks, qtTasks, poTasks, woTasks, qrTasks, enqMap, isAdmin, today, fromDate, toDate])

  // Agar list chhoti ho jaye (kuch items complete ho gaye ho) to URL wala page
  // number invalid ho sakta hai — usko valid range mein wapas le aate hain.
  // IMPORTANT: jab tak data load ho raha hai (loading=true), workQueueItems
  // temporarily khali hota hai — us waqt clamp mat karo, warna URL wala page
  // galti se 0 pe reset ho jayega.
  // Work Queue summary counts (matches original Apps Script's 6-card breakdown)
  const wqTotalCount = workQueueItems.length
  const wqOverdueCount = workQueueItems.filter(i => i.type === 'followup' && i.severity === 'overdue').length
  const wqFollowupTodayCount = workQueueItems.filter(i => i.type === 'followup' && i.severity !== 'overdue').length
  const wqFlowchartCount = workQueueItems.filter(i => i.type === 'flowchart').length
  const wqQuotationCount = workQueueItems.filter(i => i.type === 'quotation').length
  const wqGaCount = workQueueItems.filter(i => i.type === 'ga_drawing').length

  // Jis card pe click hua hai, table ko usi ke hisaab se filter karte hain —
  // exactly wahi condition jo upar wale counts calculate karne mein use hui.
  const displayedWorkQueueItems = useMemo(() => {
    if (wqTypeFilter === 'overdue') return workQueueItems.filter(i => i.type === 'followup' && i.severity === 'overdue')
    if (wqTypeFilter === 'due-today') return workQueueItems.filter(i => i.type === 'followup' && i.severity !== 'overdue')
    if (wqTypeFilter === 'flowchart') return workQueueItems.filter(i => i.type === 'flowchart')
    if (wqTypeFilter === 'quotation') return workQueueItems.filter(i => i.type === 'quotation')
    if (wqTypeFilter === 'ga_drawing') return workQueueItems.filter(i => i.type === 'ga_drawing')
    return workQueueItems
  }, [workQueueItems, wqTypeFilter])

  useEffect(() => {
    if (loading) return
    const totalPages = Math.max(1, Math.ceil(displayedWorkQueueItems.length / 10))
    if (workQueuePage > totalPages - 1) setWorkQueuePage(totalPages - 1)
  }, [displayedWorkQueueItems, workQueuePage, loading])

  // latest quotation amount per enquiry
  const latestQuotationAmountMap = useMemo(() => {
    const map = {}
    latestPerEnquiry(qtTasks).forEach(q => {
      if (q.amount !== null && q.amount !== undefined) map[q.enquiry_id] = q.amount
    })
    return map
  }, [qtTasks])

  function getDisplayAmount(e) {
    if (e.status === 'Won' && e.final_order_value) return e.final_order_value
    if (latestQuotationAmountMap[e.enquiry_id] !== undefined) return latestQuotationAmountMap[e.enquiry_id]
    return null
  }

  // ── Monthly trend (last 12 months, admin only) ────────────
  const monthlyTrend = useMemo(() => {
    if (!isAdmin) return []
    const now = new Date()
    const buckets = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      buckets.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
        count: 0,
      })
    }
    const bucketMap = {}
    buckets.forEach(b => { bucketMap[b.key] = b })

    enquiries.forEach(e => {
      if (!e.date) return
      const key = e.date.slice(0, 7)
      if (bucketMap[key]) bucketMap[key].count++
    })

    return buckets
  }, [enquiries, isAdmin])

  const monthlyTotal = monthlyTrend.reduce((s, m) => s + m.count, 0)

  // ── Recent enquiries (paginated) ──────────────────────────
  const recentEnquiries = useMemo(() => {
    return [...filteredEnquiries].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
  }, [filteredEnquiries])

  const RECENT_PER_PAGE = 8
  const recentTotalPages = Math.ceil(recentEnquiries.length / RECENT_PER_PAGE) || 1
  const recentPageSlice = recentEnquiries.slice(recentPage * RECENT_PER_PAGE, (recentPage + 1) * RECENT_PER_PAGE)

  function openStatModal(title, list) {
    if (!list.length) return
    setStatModal({ title, list })
  }

  if (loading) {
    return <div className="sd-loading"><i className="fas fa-spinner fa-spin"></i> Loading dashboard…</div>
  }

  return (
    <div>
      <h2 className="dash-greeting">Hello, {user?.name}! 👋</h2>
      <p className="dash-greeting-sub">Your enquiry summary and today's tasks.</p>

      {/* ── Date Filter Bar ─────────────────────────────── */}
      <div className="dash-filter-bar">
        <label>From</label>
        <input type="date" value={fromDate} onChange={e => setDateFilter({ preset: '', from: e.target.value })} />
        <label>To</label>
        <input type="date" value={toDate} onChange={e => setDateFilter({ preset: '', to: e.target.value })} />
        <button className="btn-apply" onClick={applyManualDates}>
          <i className="fas fa-search"></i> Apply
        </button>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {QUICK_RANGES.map(r => (
            <button
              key={r.key}
              className={`quick-btn ${activePreset === r.key ? 'active' : ''}`}
              onClick={() => applyPreset(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button className="btn-clear" onClick={() => applyPreset('all')}>
          <i className="fas fa-times"></i> Clear
        </button>
      </div>

      {/* ── Stats Cards (clickable) ─────────────────────── */}
      <div className="stats-grid">
        <div className="stat-card c-green" onClick={() => openStatModal('Total Enquiries', filteredEnquiries)}>
          <div className="stat-icon"><i className="fas fa-inbox"></i></div>
          <div className="stat-value">{filteredEnquiries.length}</div>
          <div className="stat-label">Total Enquiries</div>
        </div>
        <div className="stat-card c-teal" onClick={() => openStatModal('Active Enquiries', activeEnquiries)}>
          <div className="stat-icon"><i className="fas fa-spinner"></i></div>
          <div className="stat-value">{activeEnquiries.length}</div>
          <div className="stat-label">Active</div>
        </div>
        <div className="stat-card c-emerald" onClick={() => openStatModal('Won Enquiries', wonEnquiries)}>
          <div className="stat-icon"><i className="fas fa-trophy"></i></div>
          <div className="stat-value">{wonEnquiries.length}</div>
          <div className="stat-label">Won</div>
        </div>
        <div className="stat-card c-rose" onClick={() => openStatModal('Lost Enquiries', lostEnquiries)}>
          <div className="stat-icon"><i className="fas fa-times-circle"></i></div>
          <div className="stat-value">{lostEnquiries.length}</div>
          <div className="stat-label">Lost</div>
        </div>
        <div className="stat-card c-amber" onClick={() => openStatModal('Overdue Follow-ups', overdueEnquiriesForWorkQueue)}>
          <div className="stat-icon"><i className="fas fa-bell"></i></div>
          <div className="stat-value">{overdueEnquiriesForWorkQueue.length}</div>
          <div className="stat-label">Overdue Follow-ups</div>
        </div>
      </div>

      {/* ── Unified Work Queue ──────────────────────────── */}
      <div className="workqueue-card">
        <div className="workqueue-left">
          <div className="workqueue-icon">📋</div>
          <div>
            <div className="workqueue-title">Today's Work Queue</div>
            <div className="workqueue-date">
              {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
            {(fromDate || toDate) && (
              <div style={{ fontSize: 11, color: 'var(--amber, #b45309)', fontWeight: 600, marginTop: 2 }}>
                Filtered {fromDate || '…'} → {toDate || '…'}
              </div>
            )}
          </div>
        </div>
        <div className="workqueue-badge">
          {workQueueItems.length > 0 ? `${workQueueItems.length} pending` : 'All Clear ✓'}
        </div>
      </div>

      {workQueueItems.length === 0 ? (
        <div className="workqueue-empty">
          <i className="fas fa-check-circle"></i>
          All clear! No pending work right now. 🎉
        </div>
      ) : (
        <div className="card" style={{ marginTop: -20 }}>
          <div className="wq-summary-row">
            {[
              ['Total Pending', wqTotalCount, wqTotalCount > 0 ? 'var(--rose)' : 'var(--muted)', 'all'],
              ['Overdue Calls', wqOverdueCount, wqOverdueCount > 0 ? 'var(--rose)' : 'var(--muted)', 'overdue'],
              ['Follow-up Today', wqFollowupTodayCount, wqFollowupTodayCount > 0 ? 'var(--amber)' : 'var(--muted)', 'due-today'],
              ['Flowchart', wqFlowchartCount, wqFlowchartCount > 0 ? '#6d28d9' : 'var(--muted)', 'flowchart'],
              ['Quotation', wqQuotationCount, wqQuotationCount > 0 ? 'var(--sky)' : 'var(--muted)', 'quotation'],
              ['GA Drawing', wqGaCount, wqGaCount > 0 ? 'var(--teal)' : 'var(--muted)', 'ga_drawing'],
            ].map(([label, count, color, filterKey]) => (
              <div
                key={label}
                className="wq-summary-cell"
                style={{
                  color, cursor: 'pointer',
                  background: wqTypeFilter === filterKey ? `${color}14` : 'transparent',
                  borderRadius: 10,
                  outline: wqTypeFilter === filterKey ? `2px solid ${color}` : 'none',
                  transition: 'all .15s',
                }}
                onClick={() => { setWqTypeFilter(filterKey); setWorkQueuePage(0) }}
              >
                <div className="wq-summary-value">{count}</div>
                <div className="wq-summary-label">{label}</div>
              </div>
            ))}
          </div>

          {wqTypeFilter !== 'all' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 12px' }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                Showing only: <strong>{{ overdue: 'Overdue Calls', 'due-today': 'Follow-up Today', flowchart: 'Flowchart', quotation: 'Quotation', ga_drawing: 'GA Drawing' }[wqTypeFilter]}</strong>
              </span>
              <button className="quick-btn" onClick={() => { setWqTypeFilter('all'); setWorkQueuePage(0) }}>
                <i className="fas fa-times"></i> Clear Filter
              </button>
            </div>
          )}
          <div className="table-wrap">
            <table className="dt">
              <thead>
                <tr><th>Type</th><th>Enquiry ID</th><th>Company</th><th>Detail</th><th>Date</th><th></th></tr>
              </thead>
              <tbody>
                {displayedWorkQueueItems.slice(workQueuePage * 10, workQueuePage * 10 + 10).map((item, i) => (
                  <tr
                    key={i}
                    className={item.severity === 'overdue' ? 'wq-row-overdue' : item.severity === 'due-today' ? 'wq-row-due-today' : ''}
                    onClick={() => navigate(`/enquiries/${item.enquiryId}`)}
                  >
                    <td>
                      <span className="badge" style={{ background: `${item.color}18`, color: item.color }}>
                        {item.icon} {item.label}
                      </span>
                    </td>
                    <td><span style={{ fontFamily: 'var(--mono)', color: 'var(--green)', fontSize: 12, fontWeight: 700 }}>{item.enquiryId}</span></td>
                    <td><strong>{item.company || '—'}</strong></td>
                    <td style={{ color: 'var(--muted)', fontSize: 12.5 }}>{item.message}</td>
                    <td>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: item.severity === 'overdue' ? 'var(--rose)' : item.severity === 'due-today' ? 'var(--amber)' : 'var(--muted)', fontWeight: item.severity ? 700 : 400 }}>
                        {formatDateDisplay(item.date)}
                      </span>
                    </td>
                    <td>
                      <button className="quick-btn" onClick={(ev) => { ev.stopPropagation(); navigate(`/enquiries/${item.enquiryId}`) }}>
                        Open →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {displayedWorkQueueItems.length > 10 && (
            <div className="sd-pagination">
              <span>{workQueuePage * 10 + 1}–{Math.min(workQueuePage * 10 + 10, displayedWorkQueueItems.length)} of {displayedWorkQueueItems.length}</span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button className="quick-btn" disabled={workQueuePage === 0} onClick={() => setWorkQueuePage(p => p - 1)}>← Prev</button>
                <input
                  type="number"
                  min={1}
                  max={Math.ceil(displayedWorkQueueItems.length / 10)}
                  value={workQueuePage + 1}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const totalPages = Math.ceil(displayedWorkQueueItems.length / 10)
                    let n = parseInt(e.target.value, 10)
                    if (isNaN(n)) return
                    if (n < 1) n = 1
                    if (n > totalPages) n = totalPages
                    setWorkQueuePage(n - 1)
                  }}
                  style={{
                    width: 48, textAlign: 'center', padding: '6px 4px',
                    borderRadius: 8, border: '1px solid var(--border)',
                    fontFamily: 'var(--mono)', fontSize: 12.5,
                  }}
                />
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>/ {Math.ceil(displayedWorkQueueItems.length / 10)}</span>
                <button className="quick-btn" disabled={(workQueuePage + 1) * 10 >= displayedWorkQueueItems.length} onClick={() => setWorkQueuePage(p => p + 1)}>Next →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Pipeline Stages ─────────────────────────────── */}
      <PipelineStagesCard enquiries={filteredEnquiries} stages={stages} getDisplayAmount={getDisplayAmount} />

      {/* ── Recent Enquiries ────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">🕐 Recent Enquiries</div>
          <button className="quick-btn" onClick={() => navigate('/enquiries')}>View All →</button>
        </div>
        <div className="table-wrap">
          <table className="dt">
            <thead>
              <tr><th>ID</th><th>Client</th><th>Stage</th><th>Date</th></tr>
            </thead>
            <tbody>
              {recentPageSlice.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 28, color: 'var(--muted)' }}>No enquiries found</td></tr>
              ) : (
                recentPageSlice.map(e => (
                  <tr key={e.id} onClick={() => navigate(`/enquiries/${e.enquiry_id}`)}>
                    <td><span style={{ fontFamily: 'var(--mono)', color: 'var(--green)', fontSize: 12 }}>{e.enquiry_id}</span></td>
                    <td><strong>{e.company_name || '—'}</strong></td>
                    <td><span className="badge b-gray">{e.current_stage || '—'}</span></td>
                    <td><span style={{ fontFamily: 'var(--mono)', color: 'var(--muted)', fontSize: 12 }}>{formatDateDisplay(e.date)}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {recentTotalPages > 1 && (
          <div className="sd-pagination">
            <span>{recentPage * RECENT_PER_PAGE + 1}–{Math.min((recentPage + 1) * RECENT_PER_PAGE, recentEnquiries.length)} of {recentEnquiries.length}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="quick-btn" disabled={recentPage === 0} onClick={() => setRecentPage(p => p - 1)}>← Prev</button>
              <button className="quick-btn" disabled={recentPage >= recentTotalPages - 1} onClick={() => setRecentPage(p => p + 1)}>Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Monthly Trend Chart (admin only) ────────────── */}
      {isAdmin && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">📊 Monthly Enquiries Trend</div>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Total: {monthlyTotal} in last 12 months</span>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyTrend} margin={{ top: 6, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="sdMonthlyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2d7a47" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#2d7a47" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5ede6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6a8c6f' }} axisLine={{ stroke: '#d4e0d6' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6a8c6f' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(45,122,71,.06)' }}
                  contentStyle={{ background: '#fff', border: '1px solid #d4e0d6', borderRadius: 10, fontSize: 12.5 }}
                />
                <Bar dataKey="count" name="Enquiries" fill="url(#sdMonthlyGradient)" radius={[6, 6, 0, 0]} animationDuration={900} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Stat Detail Modal ────────────────────────────── */}
      {statModal && (
        <div className="sd-modal-overlay" onClick={() => setStatModal(null)}>
          <div className="sd-modal" onClick={e => e.stopPropagation()}>
            <div className="sd-modal-header">
              <span>{statModal.title} ({statModal.list.length})</span>
              <button onClick={() => setStatModal(null)}><i className="fas fa-times"></i></button>
            </div>
            <div className="sd-modal-body">
              <table className="dt">
                <thead>
                  <tr><th>ID</th><th>Company</th><th>Stage</th><th>Status</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {statModal.list.map(e => (
                    <tr key={e.id} onClick={() => { setStatModal(null); navigate(`/enquiries/${e.enquiry_id}`) }}>
                      <td><span style={{ fontFamily: 'var(--mono)', color: 'var(--green)', fontSize: 12 }}>{e.enquiry_id}</span></td>
                      <td><strong>{e.company_name || '—'}</strong></td>
                      <td><span className="badge b-gray">{e.current_stage || '—'}</span></td>
                      <td>
                        <span className={`badge ${e.status === 'Won' ? 'b-emerald' : e.status === 'Lost' ? 'b-rose' : 'b-teal'}`}>
                          {e.status}
                        </span>
                      </td>
                      <td><span style={{ fontFamily: 'var(--mono)', color: 'var(--muted)', fontSize: 12 }}>{formatDateDisplay(e.date)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}