'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  ArrowDownLeft, ArrowUpRight, BarChart3, ChevronDown, CircleDollarSign,
  ClipboardList, Fuel, LayoutDashboard, Plus, Receipt, Route,
  ShipWheel, Trash2, Truck, Utensils, Wrench, X, Gauge, WalletCards, Download, LogOut, Pencil, MessageSquare, Calendar, Tag, FileText, Phone
} from 'lucide-react'

type Tab = 'overview' | 'transactions' | 'receivables' | 'reports' | 'vehicles'
type Transaction = { id: string; type: 'income' | 'expense'; category: string; title: string; detail: string; amount: number; vehicle: string; liters?: number; km?: number; created_at?: string; icon: typeof Fuel }
type Receivable = { id: string; client: string; route: string; due: string; amount: number; phone?: string; status: 'Bekliyor' | 'Ödendi' }
type Profile = { full_name: string; phone: string }
type Vehicle = { id: string; plate_number: string }

const categoryItems = [
  { label: 'Tümü', icon: ClipboardList }, 
  { label: 'Mazot', icon: Fuel }, 
  { label: 'Köprü & Otoyol', icon: Route },
  { label: 'Bakım & Servis', icon: Wrench }, 
  { label: 'Yemek', icon: Utensils }, 
  { label: 'Lastik', icon: Gauge }, 
  { label: 'Nakliye Bedeli', icon: Truck },
]

const currency = (amount: number) => new Intl.NumberFormat('tr-TR').format(amount)

const formatNumberInput = (val: string) => {
  const digitsOnly = val.replace(/\D/g, '')
  if (!digitsOnly) return ''
  return new Intl.NumberFormat('tr-TR').format(Number(digitsOnly))
}

const parseNumeric = (val: string) => {
  if (!val) return 0
  return Number(val.toString().replace(/\./g, '').replace(/\D/g, '')) || 0
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return 'Bugün'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

const titleCase = (str: string) => {
  if (!str) return ''
  return str
    .trim()
    .split(' ')
    .map((word) => {
      if (!word) return ''
      let cleanWord = word
      let prefix = ''
      let suffix = ''
      if (cleanWord.startsWith('(')) { prefix = '('; cleanWord = cleanWord.slice(1); }
      if (cleanWord.endsWith(')')) { suffix = ')'; cleanWord = cleanWord.slice(0, -1); }

      const firstChar = cleanWord.charAt(0)
      const rest = cleanWord.slice(1)

      const capitalizedFirst = firstChar === 'i' || firstChar === 'İ' ? 'İ' : firstChar.toLocaleUpperCase('tr-TR')
      const lowerRest = rest.replace(/İ/g, 'i').replace(/I/g, 'ı').toLocaleLowerCase('tr-TR')

      return `${prefix}${capitalizedFirst}${lowerRest}${suffix}`
    })
    .join(' ')
}

export default function Page() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [vehicleFilter, setVehicleFilter] = useState('Tüm araçlar')
  const [timeFilter, setTimeFilter] = useState<'all' | 'this_month' | 'last_month'>('this_month')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [receivables, setReceivables] = useState<Receivable[]>([])
  const [activeCategory, setActiveCategory] = useState('Tümü')

  const [modalType, setModalType] = useState<'income' | 'expense' | null>(null)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false)
  const [isReceivableModalOpen, setIsReceivableModalOpen] = useState(false)
  const [editingReceivable, setEditingReceivable] = useState<Receivable | null>(null)

  // Form State'leri
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [category, setCategory] = useState('Mazot')
  const [liters, setLiters] = useState('')
  const [km, setKm] = useState('')
  const [cargoWeight, setCargoWeight] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [newPlate, setNewPlate] = useState('')
  
  const [clientName, setClientName] = useState('')
  const [routeDesc, setRouteDesc] = useState('')
  const [recAmount, setRecAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [clientPhone, setClientPhone] = useState('')

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      setUserId(user.id)

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (prof) setProfile(prof)

      const { data: vehs } = await supabase.from('vehicles').select('*').eq('user_id', user.id).order('created_at', { ascending: true })
      if (vehs) setVehicles(vehs)

      const { data: txs } = await supabase.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      if (txs) {
        setTransactions(txs.map((item: any) => ({
          ...item,
          title: item.title || item.description || item.category || 'İşlem',
          detail: item.detail || 'İşlem Kaydı',
          vehicle: item.vehicle || '42DLB59',
          icon: item.type === 'income' ? Truck : (categoryItems.find((c) => c.label === item.category)?.icon || Fuel)
        })))
      }

      const { data: recs } = await supabase.from('receivables').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      if (recs) setReceivables(recs)

      setLoading(false)
    }

    loadData()
  }, [router])

  const vehiclePlates = useMemo(() => vehicles.map((v) => v.plate_number), [vehicles])

  const timeFilteredTransactions = useMemo(() => {
    const now = new Date()
    return transactions.filter(item => {
      if (vehicleFilter !== 'Tüm araçlar' && item.vehicle !== vehicleFilter) return false
      if (timeFilter === 'all') return true

      const itemDate = item.created_at ? new Date(item.created_at) : new Date()
      if (timeFilter === 'this_month') {
        return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear()
      }
      if (timeFilter === 'last_month') {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        return itemDate.getMonth() === lastMonth.getMonth() && itemDate.getFullYear() === lastMonth.getFullYear()
      }
      return true
    })
  }, [transactions, vehicleFilter, timeFilter])

  const filtered = useMemo(() => {
    return timeFilteredTransactions.filter(item => activeCategory === 'Tümü' || item.category === activeCategory)
  }, [timeFilteredTransactions, activeCategory])

  const income = useMemo(() => timeFilteredTransactions.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0), [timeFilteredTransactions])
  const expense = useMemo(() => timeFilteredTransactions.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0), [timeFilteredTransactions])
  const pendingTotal = receivables.filter((item) => item.status === 'Bekliyor').reduce((sum, item) => sum + Number(item.amount), 0)

  async function handleTransactionSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return
    const parsed = parseNumeric(amount)
    if (!parsed) {
      alert('Lütfen geçerli bir tutar girin!')
      return
    }

    const isIncome = modalType === 'income' || editingTransaction?.type === 'income'
    const selectedVehicleObj = vehicles.find(v => v.plate_number === vehicleFilter) || vehicles[0]

    let detailParts = []
    if (isIncome) {
      if (cargoWeight) detailParts.push(`${cargoWeight} Yük`)
      if (invoiceNo) detailParts.push(`İrsaliye: ${invoiceNo}`)
      if (detailParts.length === 0) detailParts.push('Gelir Kaydı')
    } else {
      if (category === 'Mazot' && liters) detailParts.push(`${liters} Litre`)
      if (category === 'Mazot' && km) detailParts.push(`${km} KM`)
      if (detailParts.length === 0) detailParts.push('Gider Kaydı')
    }

    const payload = {
      user_id: userId,
      vehicle_id: selectedVehicleObj?.id || null,
      type: isIncome ? 'income' : 'expense',
      category: isIncome ? 'Nakliye Bedeli' : category,
      title: titleCase(note) || (isIncome ? 'Yeni Nakliye Geliri' : category),
      detail: detailParts.join(' · '),
      date: 'Bugün',
      amount: parsed,
      liters: parseNumeric(liters) || null,
      km: parseNumeric(km) || null
    }

    if (editingTransaction) {
      const { error } = await supabase.from('transactions').update(payload).eq('id', editingTransaction.id)
      if (!error) {
        setTransactions(curr => curr.map(t => t.id === editingTransaction.id ? { ...t, ...payload, vehicle: selectedVehicleObj?.plate_number || '42DLB59' } : t))
      }
    } else {
      const { data, error } = await supabase.from('transactions').insert([payload]).select().single()
      if (!error && data) {
        setTransactions(curr => [{ ...data, vehicle: selectedVehicleObj?.plate_number || '42DLB59', icon: isIncome ? Truck : (categoryItems.find((item) => item.label === category)?.icon || Fuel) }, ...curr])
      }
    }

    closeTransactionModal()
  }

  function openEditTransaction(tx: Transaction) {
    setEditingTransaction(tx)
    setAmount(currency(tx.amount))
    setNote(tx.title)
    setCategory(tx.category)
    setLiters(tx.liters ? String(tx.liters) : '')
    setKm(tx.km ? String(tx.km) : '')
  }

  function closeTransactionModal() {
    setModalType(null)
    setEditingTransaction(null)
    setAmount(''); setNote(''); setLiters(''); setKm(''); setCargoWeight(''); setInvoiceNo('')
  }

  async function deleteTransaction(id: string) {
    if (!confirm('Bu işlemi silmek istediğinize emin misiniz?')) return
    setTransactions((curr) => curr.filter((t) => t.id !== id))
    await supabase.from('transactions').delete().eq('id', id)
  }

  async function handleReceivableSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return
    const parsed = parseNumeric(recAmount)
    if (!parsed || !clientName) {
      alert('Lütfen firma adı ve tutarı eksiksiz girin!')
      return
    }

    let finalRoute = titleCase(routeDesc) || 'Nakliye Rotası'
    if (clientPhone.trim()) {
      finalRoute += ` · Tel: ${clientPhone.trim()}`
    }

    const payload = {
      user_id: userId,
      client: titleCase(clientName),
      route: finalRoute,
      due: dueDate || null,
      amount: parsed,
      status: editingReceivable ? editingReceivable.status : 'Bekliyor'
    }

    if (editingReceivable) {
      const { error } = await supabase.from('receivables').update(payload).eq('id', editingReceivable.id)
      if (error) {
        alert('Hata oluştu: ' + error.message)
      } else {
        setReceivables(curr => curr.map(r => r.id === editingReceivable.id ? { ...r, ...payload, phone: clientPhone } : r))
        closeReceivableModal()
      }
    } else {
      const { data, error } = await supabase.from('receivables').insert([payload]).select().single()
      if (error) {
        alert('Alacak kaydedilirken hata oluştu: ' + error.message)
      } else if (data) {
        setReceivables(curr => [{ ...data, phone: clientPhone }, ...curr])
        closeReceivableModal()
      }
    }
  }

  function openEditReceivable(rec: Receivable) {
    setEditingReceivable(rec)
    setClientName(rec.client)
    setRouteDesc(rec.route.split(' · Tel:')[0] || rec.route)
    setRecAmount(currency(rec.amount))
    setDueDate(rec.due || '')
    setClientPhone(rec.phone || (rec.route.includes('Tel:') ? rec.route.split('Tel:')[1].trim() : ''))
    setIsReceivableModalOpen(true)
  }

  function closeReceivableModal() {
    setIsReceivableModalOpen(false)
    setEditingReceivable(null)
    setClientName(''); setRouteDesc(''); setRecAmount(''); setDueDate(''); setClientPhone('')
  }

  async function deleteReceivable(id: string) {
    if (!confirm('Bu alacağı silmek istediğinize emin misiniz?')) return
    const recToDelete = receivables.find(r => r.id === id)

    setReceivables(curr => curr.filter(r => r.id !== id))
    await supabase.from('receivables').delete().eq('id', id)

    if (recToDelete && recToDelete.status === 'Ödendi' && userId) {
      await supabase.from('transactions')
        .delete()
        .eq('user_id', userId)
        .eq('type', 'income')
        .eq('amount', recToDelete.amount)
        .ilike('title', `%${recToDelete.client}%`)

      setTransactions(curr => curr.filter(t => !(t.type === 'income' && t.amount === recToDelete.amount && t.title.includes(recToDelete.client))))
    }
  }

  async function toggleReceivableStatus(item: Receivable) {
    const nextStatus = item.status === 'Bekliyor' ? 'Ödendi' : 'Bekliyor'
    setReceivables((curr) => curr.map((r) => r.id === item.id ? { ...r, status: nextStatus } : r))
    await supabase.from('receivables').update({ status: nextStatus }).eq('id', item.id)

    if (nextStatus === 'Ödendi' && userId) {
      const selectedVehicleObj = vehicles[0]
      const incomePayload = {
        user_id: userId,
        vehicle_id: selectedVehicleObj?.id || null,
        type: 'income',
        category: 'Nakliye Bedeli',
        title: `${titleCase(item.client)} (Tahsilat)`,
        detail: `Alacak Tahsili: ${titleCase(item.route)}`,
        date: 'Bugün',
        amount: item.amount
      }

      const { data: newTx, error: txError } = await supabase.from('transactions').insert([incomePayload]).select().single()
      if (!txError && newTx) {
        setTransactions((curr) => [{ ...newTx, vehicle: selectedVehicleObj?.plate_number || '42DLB59', icon: Truck }, ...curr])
      }
    } else if (nextStatus === 'Bekliyor' && userId) {
      await supabase.from('transactions')
        .delete()
        .eq('user_id', userId)
        .eq('type', 'income')
        .eq('amount', item.amount)
        .ilike('title', `%${item.client}%`)

      setTransactions((curr) => curr.filter(t => !(t.type === 'income' && t.amount === item.amount && t.title.includes(item.client))))
    }
  }

  async function addVehicle(e: React.FormEvent) {
    e.preventDefault()
    const formattedPlate = newPlate.trim().toUpperCase()
    if (!userId || !formattedPlate) return

    if (vehicles.some((v) => v.plate_number === formattedPlate)) {
      alert('Bu plaka zaten ekli!')
      return
    }

    const { data, error } = await supabase.from('vehicles').insert([{ user_id: userId, plate_number: formattedPlate }]).select().single()
    if (!error && data) {
      setVehicles((curr) => [...curr, data])
      setNewPlate('')
      setIsVehicleModalOpen(false)
    }
  }

  async function deleteVehicle(id: string) {
    if (!confirm('Bu aracı silmek istediğinize emin misiniz?')) return
    setVehicles((curr) => curr.filter((v) => v.id !== id))
    await supabase.from('vehicles').delete().eq('id', id)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f5f7fa] text-base font-bold text-[#122c4a]">Sistem Yükleniyor...</div>
  }

  const firstName = profile?.full_name ? titleCase(profile.full_name.split(' ')[0]) : 'Sürücü'
  const initials = profile?.full_name ? profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'AK'

  const nav = [
    { id: 'overview', label: 'Genel Bakış', icon: LayoutDashboard },
    { id: 'transactions', label: 'İşlemler', icon: Receipt },
    { id: 'receivables', label: 'Alacaklar', icon: WalletCards },
    { id: 'reports', label: 'Raporlar', icon: BarChart3 },
    { id: 'vehicles', label: 'Araçlar', icon: Truck }
  ]

  return (
    <main className="min-h-screen bg-[#f4f7fb] font-sans text-[#122c4a]">
      <div className="mx-auto flex min-h-screen max-w-[1500px]">
        {/* Sol Sidebar */}
        <aside className="hidden w-[270px] shrink-0 flex-col border-r border-[#e1e8f0] bg-white px-6 py-8 lg:flex shadow-sm">
          <Brand />
          <nav className="mt-10 flex flex-col gap-2">
            {nav.map(({ id, label, icon: Icon }) => (
              <NavButton key={id} active={tab === id} onClick={() => setTab(id as Tab)} icon={Icon}>{label}</NavButton>
            ))}
          </nav>
          <div className="mt-auto rounded-2xl bg-gradient-to-br from-[#122c4a] to-[#1e3e63] p-5 text-white shadow-md">
            <p className="text-xs font-bold uppercase tracking-wider text-white/70">Bekleyen Navlun</p>
            <p className="mt-2 text-3xl font-black">₺{currency(pendingTotal)}</p>
          </div>
          <div className="mt-6 flex items-center gap-3.5 border-t border-[#e1e8f0] pt-5">
            <div className="flex size-11 items-center justify-center rounded-full bg-[#eef4f8] text-sm font-black text-[#122c4a] border border-[#d2deeb]">{initials}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold leading-tight">{profile?.full_name ? titleCase(profile.full_name) : 'Kullanıcı'}</p>
              <p className="truncate text-xs font-bold text-[#718096] mt-0.5">{vehiclePlates[0] || 'Plaka Yok'}</p>
            </div>
            <button onClick={handleLogout} className="p-2 text-[#718096] hover:text-red-600 transition-colors cursor-pointer rounded-lg hover:bg-red-50" title="Çıkış Yap"><LogOut className="size-5" /></button>
          </div>
        </aside>

        {/* Ana İçerik Alanı */}
        <section className="min-w-0 flex-1 px-5 pb-28 sm:px-8 lg:px-12 lg:pb-10">
          <header className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:py-8">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-[#718096]">Sürücü Finans Paneli</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-[#0f253e] sm:text-4xl">Günaydın, {firstName}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex rounded-2xl border border-[#e1e8f0] bg-white p-1.5 shadow-sm">
                {(['this_month', 'last_month', 'all'] as const).map((f) => (
                  <button key={f} onClick={() => setTimeFilter(f)} className={`rounded-xl px-4 py-2 text-xs font-black transition-all cursor-pointer ${timeFilter === f ? 'bg-[#122c4a] text-white shadow-md' : 'text-[#718096] hover:text-[#122c4a]'}`}>
                    {f === 'this_month' ? 'Bu Ay' : f === 'last_month' ? 'Geçen Ay' : 'Tüm Zamanlar'}
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-2.5 rounded-2xl border border-[#e1e8f0] bg-white px-4 py-2.5 text-xs font-extrabold shadow-sm cursor-pointer">
                <Truck className="size-4 text-[#d64526]" />
                <select value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)} className="bg-transparent outline-none cursor-pointer font-black text-[#122c4a]">
                  <option>Tüm araçlar</option>
                  {vehiclePlates.map((v) => <option key={v}>{v}</option>)}
                </select>
                <ChevronDown className="size-4 text-[#718096]" />
              </label>
              <button onClick={handleLogout} className="flex size-11 items-center justify-center rounded-2xl bg-white text-[#718096] shadow-sm hover:text-red-600 transition-colors cursor-pointer border border-[#e1e8f0]"><LogOut className="size-5" /></button>
            </div>
          </header>

          {tab === 'overview' && <Overview income={income} expense={expense} pendingTotal={pendingTotal} setTab={setTab} setModalType={setModalType} categories={categoryItems} activeCategory={activeCategory} setActiveCategory={setActiveCategory} filtered={filtered} onDelete={deleteTransaction} onEdit={openEditTransaction} />}
          {tab === 'transactions' && <Transactions categories={categoryItems} activeCategory={activeCategory} setActiveCategory={setActiveCategory} filtered={filtered} onDelete={deleteTransaction} onEdit={openEditTransaction} />}
          {tab === 'receivables' && <Receivables receivables={receivables} toggleStatus={toggleReceivableStatus} pendingTotal={pendingTotal} openModal={() => setIsReceivableModalOpen(true)} onEdit={openEditReceivable} onDelete={deleteReceivable} />}
          {tab === 'reports' && <Reports transactions={timeFilteredTransactions} vehicleFilter={vehicleFilter} income={income} expense={expense} />}
          {tab === 'vehicles' && <Vehicles vehicles={vehicles} onDeleteVehicle={deleteVehicle} openModal={() => setIsVehicleModalOpen(true)} />}
        </section>
      </div>

      {/* Mobil Alt Navigasyon Barı */}
      <nav className="fixed inset-x-4 bottom-4 z-30 flex justify-around rounded-3xl border border-[#e1e8f0] bg-white/95 p-2.5 shadow-2xl backdrop-blur-md lg:hidden">
        {nav.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id as Tab)} className={`flex min-w-0 flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[11px] font-black transition-all ${tab === id ? 'bg-[#122c4a] text-white shadow-md' : 'text-[#718096]'}`}>
            <Icon className="size-5" />{label}
          </button>
        ))}
      </nav>

      {/* Modallar */}
      {(modalType || editingTransaction) && <Modal type={modalType || editingTransaction?.type || 'income'} isEditing={!!editingTransaction} amount={amount} setAmount={setAmount} category={category} setCategory={setCategory} note={note} setNote={setNote} liters={liters} setLiters={setLiters} km={km} setKm={setKm} cargoWeight={cargoWeight} setCargoWeight={setCargoWeight} invoiceNo={invoiceNo} setInvoiceNo={setInvoiceNo} onSubmit={handleTransactionSubmit} close={closeTransactionModal} />}
      {isVehicleModalOpen && <VehicleModal onSubmit={addVehicle} close={() => setIsVehicleModalOpen(false)} newPlate={newPlate} setNewPlate={setNewPlate} />}
      {isReceivableModalOpen && <ReceivableModal isEditing={!!editingReceivable} onSubmit={handleReceivableSubmit} close={closeReceivableModal} clientName={clientName} setClientName={setClientName} routeDesc={routeDesc} setRouteDesc={setRouteDesc} recAmount={recAmount} setRecAmount={setRecAmount} dueDate={dueDate} setDueDate={setDueDate} clientPhone={clientPhone} setClientPhone={setClientPhone} />}
    </main>
  )
}

function Brand() { 
  return (
    <div className="flex items-center gap-3.5 px-1">
      <div className="flex size-11 items-center justify-center rounded-2xl bg-[#122c4a] text-white shadow-lg"><ShipWheel className="size-6" /></div>
      <div><p className="text-lg font-black tracking-tight leading-tight text-[#0f253e]">Nakliye Cepte <span className="text-[#d64526]">Finans</span></p><p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#718096]">Sürücü Paneli</p></div>
    </div>
  ) 
}

function NavButton({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof LayoutDashboard; children: string }) { 
  return <button onClick={onClick} className={`flex items-center gap-3.5 rounded-2xl px-4 py-3 text-left text-sm font-black transition-all cursor-pointer ${active ? 'bg-[#eef4f8] text-[#122c4a] shadow-sm' : 'text-[#718096] hover:bg-[#f5f8fa] hover:text-[#122c4a]'}`}><Icon className="size-5" />{children}</button> 
}

function SummaryCard({ label, value, icon: Icon, type }: { label: string; value: number; icon: typeof CircleDollarSign; type: 'profit' | 'income' | 'expense' }) { 
  const isProfit = type === 'profit'
  const isIncome = type === 'income'

  return (
    <article className={`rounded-3xl border p-6 shadow-sm transition-all ${isProfit ? 'border-[#122c4a] bg-[#122c4a] text-white shadow-xl shadow-[#122c4a]/10' : 'border-[#e1e8f0] bg-white'}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-xs font-black uppercase tracking-wider ${isProfit ? 'text-white/70' : 'text-[#718096]'}`}>{label}</p>
          <p className={`mt-3 text-3xl font-black sm:text-4xl ${isProfit ? 'text-white' : isIncome ? 'text-emerald-600' : 'text-rose-600'}`}>
            ₺{currency(value)}
          </p>
        </div>
        <div className={`flex size-12 items-center justify-center rounded-2xl ${isProfit ? 'bg-white/10 text-emerald-400' : isIncome ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
          <Icon className="size-6" />
        </div>
      </div>
    </article> 
  )
}

function Overview({ income, expense, pendingTotal, setTab, setModalType, categories, activeCategory, setActiveCategory, filtered, onDelete, onEdit }: any) { 
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-3">
        <SummaryCard label="Net Kâr" value={income - expense} type="profit" icon={CircleDollarSign} />
        <SummaryCard label="Toplam Gelir" value={income} type="income" icon={ArrowDownLeft} />
        <SummaryCard label="Toplam Gider" value={expense} type="expense" icon={ArrowUpRight} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <button onClick={() => setModalType('income')} className="flex h-14 items-center justify-center gap-3 rounded-2xl bg-[#d64526] px-6 text-sm font-black text-white shadow-lg shadow-[#d64526]/20 hover:bg-[#be3a1f] transition-all cursor-pointer"><Plus className="size-5" /> Gelir / Yük Ekle</button>
        <button onClick={() => setModalType('expense')} className="flex h-14 items-center justify-center gap-3 rounded-2xl bg-[#122c4a] px-6 text-sm font-black text-white shadow-lg hover:bg-[#0d223a] transition-all cursor-pointer"><Plus className="size-5" /> Gider Kaydı Ekle</button>
        <button onClick={() => setTab('receivables')} className="flex h-14 items-center justify-center gap-3 rounded-2xl border border-[#e1e8f0] bg-white px-6 text-sm font-black text-[#122c4a] shadow-sm hover:bg-[#f8fafc] transition-all cursor-pointer"><WalletCards className="size-5 text-[#d64526]" /> ₺{currency(pendingTotal)} Alacak</button>
      </div>

      <Transactions categories={categories} activeCategory={activeCategory} setActiveCategory={setActiveCategory} filtered={filtered} onDelete={onDelete} onEdit={onEdit} compact />
    </>
  )
}

function Transactions({ categories, activeCategory, setActiveCategory, filtered, onDelete, onEdit, compact = false }: any) { 
  return (
    <section className={`${compact ? 'mt-8' : 'mt-2'} rounded-3xl border border-[#e1e8f0] bg-white p-6 shadow-sm sm:p-8`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-[#718096]">Finans Hareketleri</p>
          <h2 className="mt-1 text-xl font-black text-[#0f253e] sm:text-2xl">İşlem Geçmişi</h2>
        </div>
      </div>
      
      <div className="scrollbar-hide mt-5 flex gap-2.5 overflow-x-auto pb-1">
        {categories.map(({ label, icon: Icon }: any) => (
          <button key={label} onClick={() => setActiveCategory(label)} className={`flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-black transition-all cursor-pointer ${activeCategory === label ? 'border-[#122c4a] bg-[#122c4a] text-white shadow-md' : 'border-[#e1e8f0] bg-white text-[#536579] hover:bg-[#f8fafc]'}`}>
            <Icon className="size-4" />{label}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm font-bold text-[#718096]">Henüz işlem kaydı bulunmuyor.</p>
        ) : (
          filtered.map((item: Transaction) => { 
            const Icon = item.icon || Fuel; 
            const isIncome = item.type === 'income'
            return (
              <div key={item.id} className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[#f0f4f8] bg-[#fbfcfd] p-4.5 hover:border-[#d2deeb] hover:bg-white transition-all shadow-2xs">
                <div className="flex items-start sm:items-center gap-4 min-w-0">
                  <div className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${isIncome ? 'bg-emerald-100/80 text-emerald-700' : 'bg-rose-100/80 text-rose-700'}`}>
                    <Icon className="size-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-base font-black text-[#0f253e]">{titleCase(item.title)}</p>
                      <span className="shrink-0 rounded-lg bg-[#122c4a] px-2.5 py-0.5 text-[11px] font-black text-white">{item.vehicle}</span>
                      <span className="shrink-0 flex items-center gap-1 rounded-lg bg-[#eef4f8] px-2.5 py-0.5 text-[11px] font-extrabold text-[#536579] border border-[#d2deeb]">
                        <Calendar className="size-3 text-[#d64526]" />
                        {formatDate(item.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs font-bold text-[#718096]">{titleCase(item.detail)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 border-[#f0f4f8] pt-3 sm:pt-0">
                  <p className={`text-base font-black sm:text-lg ${isIncome ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {isIncome ? '+' : '-'}₺{currency(item.amount)}
                  </p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => onEdit(item)} className="rounded-xl p-2 text-[#a0aec0] hover:bg-blue-50 hover:text-blue-600 transition-all cursor-pointer" title="Düzenle">
                      <Pencil className="size-4" />
                    </button>
                    <button onClick={() => onDelete(item.id)} className="rounded-xl p-2 text-[#a0aec0] hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer" title="Sil">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </div> 
            )
          })
        )}
      </div>
    </section> 
  )
}

function Receivables({ receivables, toggleStatus, pendingTotal, openModal, onEdit, onDelete }: any) { 
  const [filter, setFilter] = useState<'Tümü' | 'Bekliyor' | 'Ödendi'>('Tümü')
  const filteredRecs = receivables.filter((r: Receivable) => filter === 'Tümü' || r.status === filter)

  const sendWhatsAppMsg = (item: Receivable) => {
    const phoneMatch = item.route.match(/Tel:\s*([0-9]+)/)
    const phoneNum = item.phone || (phoneMatch ? phoneMatch[1] : '')
    const routeName = item.route.split(' · Tel:')[0]

    const text = `Sayın ${titleCase(item.client)}, ${titleCase(routeName)} rotasına ait ₺${currency(item.amount)} tutarındaki alacak bakiyenizin ödemesini hatırlatmak isteriz. İyi çalışmalar dileriz.`
    const cleanPhone = phoneNum ? phoneNum.replace(/\D/g, '') : ''
    
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <section className="mt-2">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-[#d64526]">Cari Alacaklar Defteri</p>
          <h2 className="mt-1 text-2xl font-black text-[#0f253e] sm:text-3xl">Alacaklar / Navlun Defteri</h2>
        </div>
        <button onClick={openModal} className="flex items-center gap-2.5 rounded-2xl bg-[#d64526] px-5 py-3 text-xs font-black text-white shadow-lg hover:bg-[#be3a1f] transition-all cursor-pointer">
          <Plus className="size-4" /> Alacak Ekle
        </button>
      </div>

      <div className="mt-6 rounded-3xl bg-gradient-to-r from-[#122c4a] to-[#1e3e63] p-6 text-white shadow-md">
        <p className="text-xs font-black uppercase tracking-wider text-white/70">Tahsil Edilmesi Beklenen Toplam</p>
        <p className="mt-2 text-3xl font-black sm:text-4xl">₺{currency(pendingTotal)}</p>
      </div>

      <div className="mt-6 flex gap-2.5">
        {(['Tümü', 'Bekliyor', 'Ödendi'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-2xl border px-4 py-2 text-xs font-black transition-all cursor-pointer ${filter === f ? 'border-[#122c4a] bg-[#122c4a] text-white shadow-md' : 'border-[#e1e8f0] bg-white text-[#536579] hover:bg-[#f8fafc]'}`}>{f}</button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-3xl border border-[#e1e8f0] bg-white p-6 shadow-sm">
        {filteredRecs.length === 0 ? (
          <p className="py-10 text-center text-sm font-bold text-[#718096]">Kayıtlı alacak bulunmuyor.</p>
        ) : (
          filteredRecs.map((item: Receivable) => (
            <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[#f0f4f8] bg-[#fbfcfd] p-4.5 hover:border-[#d2deeb] transition-all">
              <div className="flex items-start sm:items-center gap-4 min-w-0">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef4f8] text-[#122c4a] border border-[#d2deeb]">
                  <WalletCards className="size-6 text-[#d64526]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-black text-[#0f253e]">{titleCase(item.client)}</p>
                  <p className="mt-1 truncate text-xs font-bold text-[#718096]">{titleCase(item.route)} · Vade: {titleCase(item.due) || 'Belirtilmedi'}</p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 border-t sm:border-t-0 border-[#f0f4f8] pt-3 sm:pt-0">
                <div className="text-right">
                  <p className="text-base font-black sm:text-lg text-[#0f253e]">₺{currency(item.amount)}</p>
                  <button onClick={() => toggleStatus(item)} className={`mt-1 rounded-full px-3.5 py-1 text-xs font-black transition-all cursor-pointer ${item.status === 'Bekliyor' ? 'bg-[#fff0ed] text-[#d64526] hover:bg-[#fddbd3]' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}>
                    {item.status}
                  </button>
                </div>
                {item.status === 'Bekliyor' && (
                  <button onClick={() => sendWhatsAppMsg(item)} className="rounded-xl p-2.5 text-emerald-600 hover:bg-emerald-50 transition-all cursor-pointer" title="WhatsApp ile Hatırlat">
                    <MessageSquare className="size-5" />
                  </button>
                )}
                <button onClick={() => onEdit(item)} className="rounded-xl p-2 text-[#a0aec0] hover:bg-blue-50 hover:text-blue-600 transition-all cursor-pointer" title="Düzenle">
                  <Pencil className="size-4" />
                </button>
                <button onClick={() => onDelete(item.id)} className="rounded-xl p-2 text-[#a0aec0] hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer" title="Sil">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function Reports({ transactions, vehicleFilter, income, expense }: { transactions: Transaction[]; vehicleFilter: string; income: number; expense: number }) { 
  const fuelStats = useMemo(() => {
    let totalLiters = 0
    let totalKm = 0
    transactions.forEach(t => {
      if (t.category === 'Mazot') {
        if (t.liters) totalLiters += Number(t.liters)
        if (t.km) totalKm += Number(t.km)
      }
    })
    const avgConsumption = totalKm > 0 && totalLiters > 0 ? ((totalLiters * 100) / totalKm).toFixed(1) : null
    return { totalLiters, totalKm, avgConsumption }
  }, [transactions])

  const expensesList = useMemo(() => transactions.filter(t => t.type === 'expense' && (vehicleFilter === 'Tüm araçlar' || t.vehicle === vehicleFilter)), [transactions, vehicleFilter])
  
  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    expensesList.forEach(t => {
      totals[t.category] = (totals[t.category] || 0) + t.amount
    })
    return totals
  }, [expensesList])

  return (
    <section className="mt-2">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-[#d64526]">Performans Özeti</p>
          <h2 className="mt-1 text-2xl font-black text-[#0f253e] sm:text-3xl">Gelişmiş Raporlar & Yakıt Analizi</h2>
        </div>
        <button onClick={() => window.print()} className="flex items-center gap-2.5 rounded-2xl border border-[#e1e8f0] bg-white px-5 py-3 text-xs font-black shadow-sm hover:bg-[#f8fafc] transition-all cursor-pointer"><Download className="size-4" /> Raporu İndir</button>
      </div>

      <div className="mt-6 rounded-3xl bg-gradient-to-r from-[#122c4a] to-[#1e3e63] p-6 text-white shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-white/70">100 KM Ortalama Yakıt Tüketimi</p>
            <p className="mt-2 text-3xl font-black">{fuelStats.avgConsumption ? `${fuelStats.avgConsumption} Litre / 100 KM` : 'Veri Girilmedi'}</p>
            <p className="mt-1 text-xs text-white/70">Toplam Alınan Mazot: {fuelStats.totalLiters} Lt · Toplam KM: {fuelStats.totalKm} KM</p>
          </div>
          <div className="flex size-14 items-center justify-center rounded-2xl bg-white/10 text-emerald-400">
            <Fuel className="size-7" />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <article className="rounded-3xl border border-[#e1e8f0] bg-white p-6 shadow-sm">
          <h3 className="text-base font-black text-[#0f253e]">Özet Bilanço ({vehicleFilter})</h3>
          <div className="mt-5 space-y-3.5 text-xs font-extrabold">
            <div className="flex justify-between border-b border-[#f0f4f8] pb-3"><span>Toplam Gelir</span><span className="font-black text-emerald-600 text-sm">₺{currency(income)}</span></div>
            <div className="flex justify-between border-b border-[#f0f4f8] pb-3"><span>Toplam Gider</span><span className="font-black text-rose-600 text-sm">₺{currency(expense)}</span></div>
            <div className="flex justify-between pt-1 text-base font-black"><span>Net Kâr</span><span className={income - expense >= 0 ? 'text-emerald-600' : 'text-rose-600'}>₺{currency(income - expense)}</span></div>
          </div>
        </article>

        <article className="rounded-3xl border border-[#e1e8f0] bg-white p-6 shadow-sm">
          <h3 className="text-base font-black text-[#0f253e]">Gider Dağılımı</h3>
          <div className="mt-5 space-y-4">
            {Object.keys(categoryTotals).length === 0 ? <p className="text-xs font-bold text-[#718096]">Henüz gider kaydı yok.</p> : Object.entries(categoryTotals).map(([cat, amt]) => {
              const pct = expense > 0 ? Math.round((amt / expense) * 100) : 0
              return (
                <div key={cat} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-black">
                    <span>{cat}</span>
                    <span>₺{currency(amt)} (%{pct})</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#f0f4f8]">
                    <div className="h-full bg-[#d64526]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </article>
      </div>
    </section>
  )
}

function Vehicles({ vehicles, onDeleteVehicle, openModal }: any) { 
  return <section className="mt-2"><div className="flex items-end justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-[#d64526]">Plaka Yönetimi</p><h2 className="mt-1 text-2xl font-black text-[#0f253e] sm:text-3xl">Araçlar & Filo</h2></div><button onClick={openModal} className="flex items-center gap-2.5 rounded-2xl bg-[#d64526] px-5 py-3 text-xs font-black text-white shadow-lg hover:bg-[#be3a1f] transition-all cursor-pointer"><Plus className="size-4" /> Araç Ekle</button></div><div className="mt-6 grid gap-4 sm:grid-cols-3">{vehicles.length === 0 ? <p className="text-xs font-bold text-[#718096]">Henüz kayıtlı araç yok.</p> : vehicles.map((v: any) => <div key={v.id} className="group relative flex items-center justify-between rounded-3xl border border-[#e1e8f0] bg-white p-5 shadow-sm"><div><Truck className="size-6 text-[#d64526]" /><p className="mt-3 text-base font-black text-[#0f253e]">{v.plate_number}</p></div><button onClick={() => onDeleteVehicle(v.id)} className="rounded-xl p-2.5 text-[#718096] hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer" title="Aracı Sil"><Trash2 className="size-5" /></button></div>)}</div></section> 
}

function Modal({ type, isEditing, amount, setAmount, category, setCategory, note, setNote, liters, setLiters, km, setKm, cargoWeight, setCargoWeight, invoiceNo, setInvoiceNo, onSubmit, close }: any) { 
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0f253e]/50 p-0 backdrop-blur-md sm:items-center sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) close() }}>
      <div className="w-full max-w-lg rounded-t-3xl bg-white p-7 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-[#d64526]">{isEditing ? 'Düzenle' : 'Yeni Kayıt'}</p>
            <h2 className="mt-1 text-xl font-black text-[#0f253e]">{isEditing ? 'İşlemi Güncelle' : (type === 'income' ? 'Gelir / Yük Ekle' : 'Gider Kaydı Ekle')}</h2>
          </div>
          <button onClick={close} className="rounded-full bg-[#f4f7fb] p-2.5 text-[#718096] hover:bg-[#eef4f8] transition-all cursor-pointer"><X className="size-5" /></button>
        </div>
        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-xs font-black text-[#536579]">
            Tutar (₺) *
            <input 
              required 
              inputMode="numeric" 
              value={amount} 
              onChange={(e) => setAmount(formatNumberInput(e.target.value))} 
              placeholder="Örn: 26.000" 
              className="h-12 rounded-2xl border border-[#dfe6ed] bg-[#f8fafb] px-4 text-base font-black outline-none focus:border-[#d64526] focus:bg-white transition-all text-[#0f253e]" 
            />
          </label>

          {type === 'income' && (
            <div className="grid grid-cols-2 gap-3.5">
              <label className="flex flex-col gap-1.5 text-xs font-black text-[#536579]">
                Taşınan Yük (Tonaj / Ürün)
                <input 
                  value={cargoWeight} 
                  onChange={(e) => setCargoWeight(e.target.value)} 
                  placeholder="Örn: 28 Ton Kömür" 
                  className="h-12 rounded-2xl border border-[#dfe6ed] bg-[#f8fafb] px-4 text-xs font-extrabold outline-none focus:border-[#d64526] focus:bg-white transition-all" 
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-black text-[#536579]">
                İrsaliye / Fatura No
                <input 
                  value={invoiceNo} 
                  onChange={(e) => setInvoiceNo(e.target.value)} 
                  placeholder="Örn: IRS-9021" 
                  className="h-12 rounded-2xl border border-[#dfe6ed] bg-[#f8fafb] px-4 text-xs font-extrabold outline-none focus:border-[#d64526] focus:bg-white transition-all" 
                />
              </label>
            </div>
          )}

          {type === 'expense' && (
            <label className="flex flex-col gap-1.5 text-xs font-black text-[#536579]">
              Kategori *
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-12 rounded-2xl border border-[#dfe6ed] bg-[#f8fafb] px-4 text-xs font-black outline-none focus:border-[#d64526] focus:bg-white transition-all cursor-pointer text-[#0f253e]">
                <option>Mazot</option>
                <option>Köprü & Otoyol</option>
                <option>Bakım & Servis</option>
                <option>Yemek</option>
                <option>Lastik</option>
              </select>
            </label>
          )}

          {type === 'expense' && category === 'Mazot' && (
            <div className="grid grid-cols-2 gap-3.5">
              <label className="flex flex-col gap-1.5 text-xs font-black text-[#536579]">
                Litre
                <input 
                  inputMode="numeric" 
                  value={liters} 
                  onChange={(e) => setLiters(formatNumberInput(e.target.value))} 
                  placeholder="238 Lt" 
                  className="h-12 rounded-2xl border border-[#dfe6ed] bg-[#f8fafb] px-4 text-xs font-extrabold outline-none focus:border-[#d64526] focus:bg-white transition-all" 
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-black text-[#536579]">
                Kilometre
                <input 
                  inputMode="numeric" 
                  value={km} 
                  onChange={(e) => setKm(formatNumberInput(e.target.value))} 
                  placeholder="1.420 KM" 
                  className="h-12 rounded-2xl border border-[#dfe6ed] bg-[#f8fafb] px-4 text-xs font-extrabold outline-none focus:border-[#d64526] focus:bg-white transition-all" 
                />
              </label>
            </div>
          )}

          <label className="flex flex-col gap-1.5 text-xs font-black text-[#536579]">
            Açıklama / Firma / Rota Detayı
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Örn: Ilgın Beypazarı Kömür Nakliyesi" className="h-12 rounded-2xl border border-[#dfe6ed] bg-[#f8fafb] px-4 text-xs font-extrabold outline-none focus:border-[#d64526] focus:bg-white transition-all" />
          </label>

          <button type="submit" className="mt-2 h-12 rounded-2xl bg-[#d64526] text-sm font-black text-white shadow-lg hover:bg-[#be3a1f] transition-all cursor-pointer">
            {isEditing ? 'Değişiklikleri Kaydet' : 'Kaydı Tamamla'}
          </button>
        </form>
      </div>
    </div>
  ) 
}

function VehicleModal({ onSubmit, close, newPlate, setNewPlate }: any) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f253e]/50 p-4 backdrop-blur-md" onClick={(e) => { if (e.target === e.currentTarget) close() }}><div className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-2xl"><div className="flex justify-between items-center"><h2 className="text-lg font-black text-[#0f253e]">Yeni Araç Ekle</h2><button onClick={close} className="p-2 text-[#718096] hover:bg-[#f4f7fb] rounded-full transition-all"><X className="size-5" /></button></div><form onSubmit={onSubmit} className="mt-5 flex flex-col gap-4"><input required value={newPlate} onChange={(e) => setNewPlate(e.target.value)} placeholder="Örn: 42 DLB 59" className="h-12 rounded-2xl border border-[#dfe6ed] bg-[#f8fafb] px-4 text-xs font-black outline-none uppercase focus:border-[#122c4a]" /><button type="submit" className="h-12 rounded-2xl bg-[#122c4a] text-xs font-black text-white shadow-md">Plakayı Kaydet</button></form></div></div>
}

function ReceivableModal({ isEditing, onSubmit, close, clientName, setClientName, routeDesc, setRouteDesc, recAmount, setRecAmount, dueDate, setDueDate, clientPhone, setClientPhone }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f253e]/50 p-4 backdrop-blur-md" onClick={(e) => { if (e.target === e.currentTarget) close() }}>
      <div className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black text-[#0f253e]">{isEditing ? 'Alacağı Düzenle' : 'Yeni Alacak Ekle'}</h2>
          <button onClick={close} className="p-2 text-[#718096] hover:bg-[#f4f7fb] rounded-full transition-all"><X className="size-5" /></button>
        </div>
        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-xs font-black text-[#536579]">
            Müşteri / Firma Adı *
            <input required value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Örn: Ilgın Kooperatifi" className="h-12 rounded-2xl border border-[#dfe6ed] bg-[#f8fafb] px-4 text-xs font-extrabold outline-none focus:border-[#d64526]" />
          </label>

          <label className="flex flex-col gap-1.5 text-xs font-black text-[#536579]">
            Rota ve Yük Detayı
            <input value={routeDesc} onChange={(e) => setRouteDesc(e.target.value)} placeholder="Örn: Ilgın → Beypazarı Kömür Nakliyesi" className="h-12 rounded-2xl border border-[#dfe6ed] bg-[#f8fafb] px-4 text-xs font-extrabold outline-none focus:border-[#d64526]" />
          </label>

          <div className="grid grid-cols-2 gap-3.5">
            <label className="flex flex-col gap-1.5 text-xs font-black text-[#536579]">
              Alacak Tutarı (₺) *
              <input 
                required 
                inputMode="numeric" 
                value={recAmount} 
                onChange={(e) => setRecAmount(formatNumberInput(e.target.value))} 
                placeholder="Örn: 35.000" 
                className="h-12 rounded-2xl border border-[#dfe6ed] bg-[#f8fafb] px-4 text-xs font-black outline-none focus:border-[#d64526] text-[#0f253e]" 
              />
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-black text-[#536579]">
              Vade Tarihi
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-12 rounded-2xl border border-[#dfe6ed] bg-[#f8fafb] px-4 text-xs font-black outline-none focus:border-[#d64526] cursor-pointer text-[#0f253e]" />
            </label>
          </div>

          <label className="flex flex-col gap-1.5 text-xs font-black text-[#536579]">
            Müşteri Telefon Numarası (WhatsApp Hatırlatması İçin)
            <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="Örn: 05551234567" className="h-12 rounded-2xl border border-[#dfe6ed] bg-[#f8fafb] px-4 text-xs font-extrabold outline-none focus:border-[#d64526]" />
          </label>

          <button type="submit" className="mt-2 h-12 rounded-2xl bg-[#d64526] text-sm font-black text-white shadow-lg hover:bg-[#be3a1f] transition-all cursor-pointer">
            {isEditing ? 'Değişiklikleri Kaydet' : 'Alacağı Kaydet'}
          </button>
        </form>
      </div>
    </div>
  )
}
