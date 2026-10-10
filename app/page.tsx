'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  ArrowDownLeft, ArrowUpRight, BarChart3, ChevronDown, CircleDollarSign,
  ClipboardList, Fuel, LayoutDashboard, Plus, Receipt, Route,
  ShipWheel, Trash2, Truck, Utensils, Wrench, X, Gauge, WalletCards, Download, LogOut, Pencil, MessageSquare
} from 'lucide-react'

type Tab = 'overview' | 'transactions' | 'receivables' | 'reports' | 'vehicles'
type Transaction = { id: string; type: 'income' | 'expense'; category: string; title: string; detail: string; amount: number; vehicle: string; liters?: number; km?: number; icon: typeof Fuel }
type Receivable = { id: string; client: string; route: string; due: string; amount: number; status: 'Bekliyor' | 'Ödendi' }
type Profile = { full_name: string; phone: string }
type Vehicle = { id: string; plate_number: string }

const categoryItems = [
  { label: 'Tümü', icon: ClipboardList }, { label: 'Mazot', icon: Fuel }, { label: 'Köprü & Otoyol', icon: Route },
  { label: 'Bakım & Servis', icon: Wrench }, { label: 'Yemek', icon: Utensils }, { label: 'Lastik', icon: Gauge }, { label: 'Nakliye Bedeli', icon: Truck },
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
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [receivables, setReceivables] = useState<Receivable[]>([])
  const [activeCategory, setActiveCategory] = useState('Tümü')

  const [modalType, setModalType] = useState<'income' | 'expense' | null>(null)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false)
  const [isReceivableModalOpen, setIsReceivableModalOpen] = useState(false)
  const [editingReceivable, setEditingReceivable] = useState<Receivable | null>(null)

  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [category, setCategory] = useState('Mazot')
  const [liters, setLiters] = useState('')
  const [km, setKm] = useState('')
  const [newPlate, setNewPlate] = useState('')
  const [clientName, setClientName] = useState('')
  const [routeDesc, setRouteDesc] = useState('')
  const [recAmount, setRecAmount] = useState('')
  const [dueDate, setDueDate] = useState('')

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

  const filtered = useMemo(() => transactions.filter((item) => (vehicleFilter === 'Tüm araçlar' || item.vehicle === vehicleFilter) && (activeCategory === 'Tümü' || item.category === activeCategory)), [transactions, vehicleFilter, activeCategory])
  const income = useMemo(() => transactions.filter((item) => item.type === 'income' && (vehicleFilter === 'Tüm araçlar' || item.vehicle === vehicleFilter)).reduce((sum, item) => sum + item.amount, 0), [transactions, vehicleFilter])
  const expense = useMemo(() => transactions.filter((item) => item.type === 'expense' && (vehicleFilter === 'Tüm araçlar' || item.vehicle === vehicleFilter)).reduce((sum, item) => sum + item.amount, 0), [transactions, vehicleFilter])
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

    const payload = {
      user_id: userId,
      vehicle_id: selectedVehicleObj?.id || null,
      type: isIncome ? 'income' : 'expense',
      category: isIncome ? 'Nakliye Bedeli' : category,
      title: titleCase(note) || (isIncome ? 'Yeni Nakliye Geliri' : category),
      detail: !isIncome && category === 'Mazot' && liters ? `${liters} Litre${km ? ` · ${km} KM` : ''}` : isIncome ? 'Gelir Kaydı' : 'Gider Kaydı',
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
    setAmount(''); setNote(''); setLiters(''); setKm('')
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

    const payload = {
      user_id: userId,
      client: titleCase(clientName),
      route: titleCase(routeDesc) || 'Nakliye Rotası',
      due: dueDate || null,
      amount: parsed,
      status: editingReceivable ? editingReceivable.status : 'Bekliyor'
    }

    if (editingReceivable) {
      const { error } = await supabase.from('receivables').update(payload).eq('id', editingReceivable.id)
      if (!error) {
        setReceivables(curr => curr.map(r => r.id === editingReceivable.id ? { ...r, ...payload } : r))
      }
    } else {
      const { data, error } = await supabase.from('receivables').insert([payload]).select().single()
      if (!error && data) {
        setReceivables(curr => [data, ...curr])
      }
    }

    closeReceivableModal()
  }

  function openEditReceivable(rec: Receivable) {
    setEditingReceivable(rec)
    setClientName(rec.client)
    setRouteDesc(rec.route)
    setRecAmount(currency(rec.amount))
    setDueDate(rec.due || '')
    setIsReceivableModalOpen(true)
  }

  function closeReceivableModal() {
    setIsReceivableModalOpen(false)
    setEditingReceivable(null)
    setClientName(''); setRouteDesc(''); setRecAmount(''); setDueDate('')
  }

  async function deleteReceivable(id: string) {
    if (!confirm('Bu alacağı silmek istediğinize emin misiniz?')) return
    setReceivables(curr => curr.filter(r => r.id !== id))
    await supabase.from('receivables').delete().eq('id', id)
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
    return <div className="flex min-h-screen items-center justify-center bg-[#f5f7fa] text-sm font-bold text-[#122c4a]">Yükleniyor...</div>
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
    <main className="min-h-screen bg-[#f5f7fa] font-sans text-[#122c4a]">
      <div className="mx-auto flex min-h-screen max-w-[1440px]">
        <aside className="hidden w-[248px] shrink-0 flex-col border-r border-[#e5eaf0] bg-white px-5 py-7 lg:flex">
          <Brand />
          <nav className="mt-10 flex flex-col gap-1.5">
            {nav.map(({ id, label, icon: Icon }) => (
              <NavButton key={id} active={tab === id} onClick={() => setTab(id as Tab)} icon={Icon}>{label}</NavButton>
            ))}
          </nav>
          <div className="mt-auto rounded-2xl bg-[#122c4a] p-4 text-white shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">Bekleyen Navlun</p>
            <p className="mt-1.5 text-2xl font-black">₺{currency(pendingTotal)}</p>
          </div>
          <div className="mt-5 flex items-center gap-3 border-t border-[#e5eaf0] pt-4">
            <div className="flex size-9 items-center justify-center rounded-full bg-[#e7edf2] text-xs font-black text-[#122c4a]">{initials}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-extrabold leading-tight">{profile?.full_name ? titleCase(profile.full_name) : 'Kullanıcı'}</p>
              <p className="truncate text-[10px] font-semibold text-[#8391a0]">{vehiclePlates[0] || 'Plaka Yok'}</p>
            </div>
            <button onClick={handleLogout} className="p-1.5 text-[#8391a0] hover:text-red-600 transition-colors cursor-pointer" title="Çıkış"><LogOut className="size-4" /></button>
          </div>
        </aside>

        <section className="min-w-0 flex-1 px-4 pb-24 sm:px-7 lg:px-10 lg:pb-8">
          <header className="flex items-center justify-between py-5 sm:py-7">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#8391a0]">Hoş Geldiniz</p>
              <h1 className="mt-0.5 text-2xl font-black tracking-tight sm:text-3xl">Günaydın, {firstName}</h1>
            </div>
            <div className="flex items-center gap-3">
              <label className="hidden items-center gap-2 rounded-xl border border-[#e5eaf0] bg-white px-3.5 py-2 text-xs font-bold shadow-sm sm:flex cursor-pointer">
                <Truck className="size-4 text-[#d64526]" />
                <select value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)} className="bg-transparent outline-none cursor-pointer font-bold">
                  <option>Tüm araçlar</option>
                  {vehiclePlates.map((v) => <option key={v}>{v}</option>)}
                </select>
                <ChevronDown className="size-3.5 text-[#8391a0]" />
              </label>
              <button onClick={handleLogout} className="flex size-10 items-center justify-center rounded-full bg-white text-[#8391a0] shadow-sm hover:text-red-600 transition-colors cursor-pointer"><LogOut className="size-[18px]" /></button>
            </div>
          </header>

          {tab === 'overview' && <Overview income={income} expense={expense} pendingTotal={pendingTotal} setTab={setTab} setModalType={setModalType} categories={categoryItems} activeCategory={activeCategory} setActiveCategory={setActiveCategory} filtered={filtered} onDelete={deleteTransaction} onEdit={openEditTransaction} />}
          {tab === 'transactions' && <Transactions categories={categoryItems} activeCategory={activeCategory} setActiveCategory={setActiveCategory} filtered={filtered} onDelete={deleteTransaction} onEdit={openEditTransaction} />}
          {tab === 'receivables' && <Receivables receivables={receivables} toggleStatus={toggleReceivableStatus} pendingTotal={pendingTotal} openModal={() => setIsReceivableModalOpen(true)} onEdit={openEditReceivable} onDelete={deleteReceivable} />}
          {tab === 'reports' && <Reports transactions={transactions} vehicleFilter={vehicleFilter} income={income} expense={expense} />}
          {tab === 'vehicles' && <Vehicles vehicles={vehicles} onDeleteVehicle={deleteVehicle} openModal={() => setIsVehicleModalOpen(true)} />}
        </section>
      </div>

      <nav className="fixed inset-x-3 bottom-3 z-30 flex justify-around rounded-2xl border border-[#e5eaf0] bg-white/95 p-2 shadow-xl backdrop-blur lg:hidden">
        {nav.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id as Tab)} className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-2.5 py-2 text-[10px] font-bold ${tab === id ? 'bg-[#122c4a] text-white' : 'text-[#8391a0]'}`}>
            <Icon className="size-4" />{label}
          </button>
        ))}
      </nav>

      {(modalType || editingTransaction) && <Modal type={modalType || editingTransaction?.type || 'income'} isEditing={!!editingTransaction} amount={amount} setAmount={setAmount} category={category} setCategory={setCategory} note={note} setNote={setNote} liters={liters} setLiters={setLiters} km={km} setKm={setKm} onSubmit={handleTransactionSubmit} close={closeTransactionModal} />}
      {isVehicleModalOpen && <VehicleModal onSubmit={addVehicle} close={() => setIsVehicleModalOpen(false)} newPlate={newPlate} setNewPlate={setNewPlate} />}
      {isReceivableModalOpen && <ReceivableModal isEditing={!!editingReceivable} onSubmit={handleReceivableSubmit} close={closeReceivableModal} clientName={clientName} setClientName={setClientName} routeDesc={routeDesc} setRouteDesc={setRouteDesc} recAmount={recAmount} setRecAmount={setRecAmount} dueDate={dueDate} setDueDate={setDueDate} />}
    </main>
  )
}

function Brand() { 
  return (
    <div className="flex items-center gap-3 px-1">
      <div className="flex size-10 items-center justify-center rounded-xl bg-[#122c4a] text-white shadow-md"><ShipWheel className="size-5" /></div>
      <div><p className="text-[15px] font-black tracking-tight leading-tight">Nakliye Cepte <span className="text-[#d64526]">Finans</span></p><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#8391a0]">Sürücü Paneli</p></div>
    </div>
  ) 
}

function NavButton({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof LayoutDashboard; children: string }) { 
  return <button onClick={onClick} className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-xs font-extrabold transition-all cursor-pointer ${active ? 'bg-[#eef3f7] text-[#122c4a]' : 'text-[#8391a0] hover:bg-[#f5f7fa] hover:text-[#122c4a]'}`}><Icon className="size-[18px]" />{children}</button> 
}

// Mükemmel Renk Uyumlu Özet Kartları
function SummaryCard({ label, value, icon: Icon, type }: { label: string; value: number; icon: typeof CircleDollarSign; type: 'profit' | 'income' | 'expense' }) { 
  const isProfit = type === 'profit'
  const isIncome = type === 'income'

  return (
    <article className={`rounded-2xl border p-5 shadow-sm transition-all ${isProfit ? 'border-[#122c4a] bg-[#122c4a] text-white' : 'border-[#e5eaf0] bg-white'}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-xs font-extrabold uppercase tracking-wider ${isProfit ? 'text-white/70' : 'text-[#8391a0]'}`}>{label}</p>
          <p className={`mt-2 text-2xl font-black sm:text-3xl ${isProfit ? 'text-white' : isIncome ? 'text-emerald-600' : 'text-rose-600'}`}>
            ₺{currency(value)}
          </p>
        </div>
        <div className={`flex size-10 items-center justify-center rounded-xl ${isProfit ? 'bg-white/10 text-emerald-400' : isIncome ? 'bg-emerald-100/70 text-emerald-600' : 'bg-rose-100/70 text-rose-600'}`}>
          <Icon className="size-5" />
        </div>
      </div>
    </article> 
  )
}

function Overview({ income, expense, pendingTotal, setTab, setModalType, categories, activeCategory, setActiveCategory, filtered, onDelete, onEdit }: any) { 
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Net Kâr" value={income - expense} type="profit" icon={CircleDollarSign} />
        <SummaryCard label="Toplam Gelir" value={income} type="income" icon={ArrowDownLeft} />
        <SummaryCard label="Toplam Gider" value={expense} type="expense" icon={ArrowUpRight} />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <button onClick={() => setModalType('income')} className="flex h-13 items-center justify-center gap-2.5 rounded-2xl bg-[#d64526] px-5 text-xs font-black text-white shadow-md shadow-[#d64526]/20 hover:bg-[#be3a1f] transition-all cursor-pointer"><Plus className="size-4" /> Gelir Ekle</button>
        <button onClick={() => setModalType('expense')} className="flex h-13 items-center justify-center gap-2.5 rounded-2xl bg-[#122c4a] px-5 text-xs font-black text-white shadow-md hover:bg-[#0d223a] transition-all cursor-pointer"><Plus className="size-4" /> Gider Ekle</button>
        <button onClick={() => setTab('receivables')} className="flex h-13 items-center justify-center gap-2.5 rounded-2xl border border-[#e5eaf0] bg-white px-5 text-xs font-black text-[#122c4a] shadow-sm hover:bg-[#f8fafb] transition-all cursor-pointer"><WalletCards className="size-4 text-[#d64526]" /> ₺{currency(pendingTotal)} Alacak</button>
      </div>

      <Transactions categories={categories} activeCategory={activeCategory} setActiveCategory={setActiveCategory} filtered={filtered} onDelete={onDelete} onEdit={onEdit} compact />
    </>
  )
}

function Transactions({ categories, activeCategory, setActiveCategory, filtered, onDelete, onEdit, compact = false }: any) { 
  return (
    <section className={`${compact ? 'mt-7' : 'mt-2'} rounded-2xl border border-[#e5eaf0] bg-white p-5 shadow-sm sm:p-6`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#8391a0]">Finans Hareketleri</p>
          <h2 className="mt-0.5 text-base font-black sm:text-lg">İşlem Geçmişi</h2>
        </div>
      </div>
      
      <div className="scrollbar-hide mt-4 flex gap-2 overflow-x-auto pb-1">
        {categories.map(({ label, icon: Icon }: any) => (
          <button key={label} onClick={() => setActiveCategory(label)} className={`flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${activeCategory === label ? 'border-[#122c4a] bg-[#122c4a] text-white shadow-sm' : 'border-[#e5eaf0] bg-white text-[#536579] hover:bg-[#f8fafb]'}`}>
            <Icon className="size-3.5" />{label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-xs font-bold text-[#8391a0]">Henüz işlem kaydı bulunmuyor.</p>
        ) : (
          filtered.map((item: Transaction) => { 
            const Icon = item.icon || Fuel; 
            const isIncome = item.type === 'income'
            return (
              <div key={item.id} className="group flex items-center justify-between gap-4 border-t border-[#f0f3f6] py-3.5 first:border-t-0">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${isIncome ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-xs font-black text-[#122c4a] sm:text-sm">{titleCase(item.title)}</p>
                      <span className="shrink-0 rounded-md bg-[#f0f3f6] px-2 py-0.5 text-[10px] font-extrabold text-[#536579]">{item.vehicle}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] font-semibold text-[#8391a0]">{titleCase(item.detail)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <p className={`text-xs font-black sm:text-sm ${isIncome ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {isIncome ? '+' : '-'}₺{currency(item.amount)}
                  </p>
                  <button onClick={() => onEdit(item)} className="rounded-lg p-1.5 text-[#a0aec0] hover:bg-blue-50 hover:text-blue-600 transition-all cursor-pointer" title="Düzenle">
                    <Pencil className="size-3.5" />
                  </button>
                  <button onClick={() => onDelete(item.id)} className="rounded-lg p-1.5 text-[#a0aec0] hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer" title="Sil">
                    <Trash2 className="size-3.5" />
                  </button>
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
    const text = `Merhaba ${titleCase(item.client)}, Nakliye Cepte üzerindeki ${titleCase(item.route)} rotası için ₺${currency(item.amount)} tutarındaki ödemeyi hatırlatmak isteriz.`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <section className="mt-2">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#d64526]">Cari Alacaklar Defteri</p>
          <h2 className="mt-0.5 text-xl font-black sm:text-2xl">Alacaklar / Navlun Defteri</h2>
        </div>
        <button onClick={openModal} className="flex items-center gap-2 rounded-xl bg-[#d64526] px-4 py-2.5 text-xs font-black text-white shadow-md hover:bg-[#be3a1f] transition-all cursor-pointer">
          <Plus className="size-4" /> Alacak Ekle
        </button>
      </div>

      <div className="mt-5 rounded-2xl bg-[#122c4a] p-5 text-white shadow-sm">
        <p className="text-xs font-extrabold uppercase tracking-wider text-white/60">Tahsil Edilmesi Beklenen Toplam</p>
        <p className="mt-1 text-2xl font-black sm:text-3xl">₺{currency(pendingTotal)}</p>
      </div>

      <div className="mt-5 flex gap-2">
        {(['Tümü', 'Bekliyor', 'Ödendi'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-xl border px-3.5 py-1.5 text-xs font-extrabold transition-all cursor-pointer ${filter === f ? 'border-[#122c4a] bg-[#122c4a] text-white shadow-sm' : 'border-[#e5eaf0] bg-white text-[#536579] hover:bg-[#f8fafb]'}`}>{f}</button>
        ))}
      </div>

      <div className="mt-3 flex flex-col rounded-2xl border border-[#e5eaf0] bg-white px-5 shadow-sm">
        {filteredRecs.length === 0 ? (
          <p className="py-8 text-center text-xs font-bold text-[#8391a0]">Kayıtlı alacak bulunmuyor.</p>
        ) : (
          filteredRecs.map((item: Receivable) => (
            <div key={item.id} className="flex items-center justify-between gap-4 border-b border-[#f0f3f6] py-4 last:border-0">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#eef3f7] text-[#122c4a]">
                  <WalletCards className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-black text-[#122c4a] sm:text-sm">{titleCase(item.client)}</p>
                  <p className="mt-0.5 truncate text-[11px] font-semibold text-[#8391a0]">{titleCase(item.route)} · Vade: {titleCase(item.due) || 'Belirtilmedi'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <div className="text-right">
                  <p className="text-xs font-black sm:text-sm">₺{currency(item.amount)}</p>
                  <button onClick={() => toggleStatus(item)} className={`mt-1 rounded-full px-3 py-0.5 text-[10px] font-black transition-all cursor-pointer ${item.status === 'Bekliyor' ? 'bg-[#fff0ed] text-[#d64526] hover:bg-[#fddbd3]' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                    {item.status}
                  </button>
                </div>
                {item.status === 'Bekliyor' && (
                  <button onClick={() => sendWhatsAppMsg(item)} className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 transition-all cursor-pointer" title="WhatsApp Hatırlat">
                    <MessageSquare className="size-3.5" />
                  </button>
                )}
                <button onClick={() => onEdit(item)} className="rounded-lg p-1.5 text-[#a0aec0] hover:bg-blue-50 hover:text-blue-600 transition-all cursor-pointer" title="Düzenle">
                  <Pencil className="size-3.5" />
                </button>
                <button onClick={() => onDelete(item.id)} className="rounded-lg p-1.5 text-[#a0aec0] hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer" title="Sil">
                  <Trash2 className="size-3.5" />
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
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#d64526]">Performans Özeti</p>
          <h2 className="mt-0.5 text-xl font-black sm:text-2xl">Gelişmiş Raporlar</h2>
        </div>
        <button onClick={() => window.print()} className="flex items-center gap-2 rounded-xl border border-[#e5eaf0] bg-white px-4 py-2.5 text-xs font-black shadow-sm hover:bg-[#f8fafb] transition-all cursor-pointer"><Download className="size-4" /> Raporu İndir</button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-[#e5eaf0] bg-white p-5 shadow-sm">
          <h3 className="text-sm font-black text-[#122c4a]">Özet Bilanço ({vehicleFilter})</h3>
          <div className="mt-4 space-y-3 text-xs font-bold">
            <div className="flex justify-between border-b border-[#f0f3f6] pb-2"><span>Toplam Gelir</span><span className="font-black text-emerald-600">₺{currency(income)}</span></div>
            <div className="flex justify-between border-b border-[#f0f3f6] pb-2"><span>Toplam Gider</span><span className="font-black text-rose-600">₺{currency(expense)}</span></div>
            <div className="flex justify-between pt-1 text-sm font-black"><span>Net Kâr</span><span className={income - expense >= 0 ? 'text-emerald-600' : 'text-rose-600'}>₺{currency(income - expense)}</span></div>
          </div>
        </article>

        <article className="rounded-2xl border border-[#e5eaf0] bg-white p-5 shadow-sm">
          <h3 className="text-sm font-black text-[#122c4a]">Gider Dağılımı</h3>
          <div className="mt-4 space-y-3">
            {Object.keys(categoryTotals).length === 0 ? <p className="text-xs font-bold text-[#8391a0]">Henüz gider kaydı yok.</p> : Object.entries(categoryTotals).map(([cat, amt]) => {
              const pct = expense > 0 ? Math.round((amt / expense) * 100) : 0
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-xs font-extrabold">
                    <span>{cat}</span>
                    <span>₺{currency(amt)} (%{pct})</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#f0f3f6]">
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
  return <section className="mt-2"><div className="flex items-end justify-between"><div><p className="text-[11px] font-extrabold uppercase tracking-wider text-[#d64526]">Plaka Yönetimi</p><h2 className="mt-0.5 text-xl font-black sm:text-2xl">Araçlar & Filo</h2></div><button onClick={openModal} className="flex items-center gap-2 rounded-xl bg-[#d64526] px-4 py-2.5 text-xs font-black text-white shadow-md hover:bg-[#be3a1f] transition-all cursor-pointer"><Plus className="size-4" /> Araç Ekle</button></div><div className="mt-5 grid gap-3 sm:grid-cols-3">{vehicles.length === 0 ? <p className="text-xs font-bold text-[#8391a0]">Henüz kayıtlı araç yok.</p> : vehicles.map((v: any) => <div key={v.id} className="group relative flex items-center justify-between rounded-2xl border border-[#e5eaf0] bg-white p-4 shadow-sm"><div><Truck className="size-5 text-[#d64526]" /><p className="mt-2.5 text-sm font-black">{v.plate_number}</p></div><button onClick={() => onDeleteVehicle(v.id)} className="rounded-lg p-2 text-[#8391a0] hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer" title="Aracı Sil"><Trash2 className="size-4" /></button></div>)}</div></section> 
}

function Modal({ type, isEditing, amount, setAmount, category, setCategory, note, setNote, liters, setLiters, km, setKm, onSubmit, close }: any) { 
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#122c4a]/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) close() }}>
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#d64526]">{isEditing ? 'Düzenle' : 'Yeni Kayıt'}</p>
            <h2 className="mt-0.5 text-lg font-black">{isEditing ? 'İşlemi Güncelle' : (type === 'income' ? 'Gelir Ekle' : 'Gider Ekle')}</h2>
          </div>
          <button onClick={close} className="rounded-full bg-[#f5f7fa] p-2 text-[#8391a0] hover:bg-[#eef3f7] transition-all cursor-pointer"><X className="size-4" /></button>
        </div>
        <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-3.5">
          <label className="flex flex-col gap-1.5 text-xs font-extrabold text-[#536579]">
            Tutar (₺)
            <input 
              required 
              inputMode="numeric" 
              value={amount} 
              onChange={(e) => setAmount(formatNumberInput(e.target.value))} 
              placeholder="20.000" 
              className="h-11 rounded-xl border border-[#dfe6ed] bg-[#f8fafb] px-4 text-sm font-extrabold outline-none focus:border-[#d64526] focus:bg-white transition-all" 
            />
          </label>

          {type === 'expense' && (
            <label className="flex flex-col gap-1.5 text-xs font-extrabold text-[#536579]">
              Kategori
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-11 rounded-xl border border-[#dfe6ed] bg-[#f8fafb] px-4 text-xs font-extrabold outline-none focus:border-[#d64526] focus:bg-white transition-all cursor-pointer">
                <option>Mazot</option>
                <option>Köprü & Otoyol</option>
                <option>Bakım & Servis</option>
                <option>Yemek</option>
                <option>Lastik</option>
              </select>
            </label>
          )}

          {type === 'expense' && category === 'Mazot' && (
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-xs font-extrabold text-[#536579]">
                Litre
                <input 
                  inputMode="numeric" 
                  value={liters} 
                  onChange={(e) => setLiters(formatNumberInput(e.target.value))} 
                  placeholder="238" 
                  className="h-11 rounded-xl border border-[#dfe6ed] bg-[#f8fafb] px-4 font-extrabold outline-none focus:border-[#d64526] focus:bg-white transition-all" 
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-extrabold text-[#536579]">
                Kilometre
                <input 
                  inputMode="numeric" 
                  value={km} 
                  onChange={(e) => setKm(formatNumberInput(e.target.value))} 
                  placeholder="1.420" 
                  className="h-11 rounded-xl border border-[#dfe6ed] bg-[#f8fafb] px-4 font-extrabold outline-none focus:border-[#d64526] focus:bg-white transition-all" 
                />
              </label>
            </div>
          )}

          <label className="flex flex-col gap-1.5 text-xs font-extrabold text-[#536579]">
            Not / Açıklama
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="İstasyon veya rota" className="h-11 rounded-xl border border-[#dfe6ed] bg-[#f8fafb] px-4 text-xs font-extrabold outline-none focus:border-[#d64526] focus:bg-white transition-all" />
          </label>

          <button type="submit" className="mt-2 h-11 rounded-xl bg-[#d64526] text-xs font-black text-white shadow-md hover:bg-[#be3a1f] transition-all cursor-pointer">
            {isEditing ? 'Değişiklikleri Kaydet' : 'Kaydet'}
          </button>
        </form>
      </div>
    </div>
  ) 
}

function VehicleModal({ onSubmit, close, newPlate, setNewPlate }: any) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#122c4a]/45 p-4 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) close() }}><div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"><div className="flex justify-between items-center"><h2 className="text-base font-black">Yeni Araç Ekle</h2><button onClick={close} className="p-1.5 text-[#8391a0] hover:bg-[#f5f7fa] rounded-full transition-all"><X className="size-4" /></button></div><form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3"><input required value={newPlate} onChange={(e) => setNewPlate(e.target.value)} placeholder="Örn: 34 ABC 123" className="h-11 rounded-xl border border-[#dfe6ed] bg-[#f8fafb] px-4 text-xs font-extrabold outline-none uppercase focus:border-[#122c4a]" /><button type="submit" className="h-11 rounded-xl bg-[#122c4a] text-xs font-black text-white shadow-md">Plakayı Kaydet</button></form></div></div>
}

function ReceivableModal({ isEditing, onSubmit, close, clientName, setClientName, routeDesc, setRouteDesc, recAmount, setRecAmount, dueDate, setDueDate }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#122c4a]/45 p-4 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) close() }}>
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-black">{isEditing ? 'Alacağı Düzenle' : 'Yeni Alacak Ekle'}</h2>
          <button onClick={close} className="p-1.5 text-[#8391a0] hover:bg-[#f5f7fa] rounded-full transition-all"><X className="size-4" /></button>
        </div>
        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
          <input required value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Müşteri / Firma Adı" className="h-11 rounded-xl border border-[#dfe6ed] bg-[#f8fafb] px-4 text-xs font-extrabold outline-none focus:border-[#d64526]" />
          <input value={routeDesc} onChange={(e) => setRouteDesc(e.target.value)} placeholder="Rota (Örn: Ilgın → Beypazarı)" className="h-11 rounded-xl border border-[#dfe6ed] bg-[#f8fafb] px-4 text-xs font-extrabold outline-none focus:border-[#d64526]" />
          <input 
            required 
            inputMode="numeric" 
            value={recAmount} 
            onChange={(e) => setRecAmount(formatNumberInput(e.target.value))} 
            placeholder="Tutar (₺)" 
            className="h-11 rounded-xl border border-[#dfe6ed] bg-[#f8fafb] px-4 text-xs font-extrabold outline-none focus:border-[#d64526]" 
          />
          <input value={dueDate} onChange={(e) => setDueDate(e.target.value)} placeholder="Vade Tarihi (Örn: 2026-10-10)" className="h-11 rounded-xl border border-[#dfe6ed] bg-[#f8fafb] px-4 text-xs font-extrabold outline-none focus:border-[#d64526]" />
          <button type="submit" className="h-11 rounded-xl bg-[#d64526] text-xs font-black text-white shadow-md hover:bg-[#be3a1f] transition-all">
            {isEditing ? 'Değişiklikleri Kaydet' : 'Alacağı Kaydet'}
          </button>
        </form>
      </div>
    </div>
  )
}
