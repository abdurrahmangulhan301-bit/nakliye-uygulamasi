'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  ArrowDownLeft, ArrowUpRight, BarChart3, Bell, CalendarDays, ChevronDown, CircleDollarSign,
  ClipboardList, FileText, Fuel, LayoutDashboard, Plus, Receipt, Route,
  Settings, ShipWheel, Trash2, Truck, Utensils, Wrench, X, Gauge, WalletCards, Clock3, Download, LogOut
} from 'lucide-react'

type Tab = 'overview' | 'transactions' | 'receivables' | 'reports' | 'vehicles'
type Transaction = { id: string; type: 'income' | 'expense'; category: string; title: string; detail: string; date: string; amount: number; vehicle: string; liters?: number; km?: number; icon: typeof Fuel }
type Receivable = { id: string; client: string; route: string; due: string; amount: number; status: 'Bekliyor' | 'Ödendi' }
type Profile = { full_name: string; phone: string }

const categoryItems = [
  { label: 'Tümü', icon: ClipboardList }, { label: 'Mazot', icon: Fuel }, { label: 'Köprü & Otoyol', icon: Route },
  { label: 'Bakım & Servis', icon: Wrench }, { label: 'Yemek', icon: Utensils }, { label: 'Lastik', icon: Gauge }, { label: 'Nakliye Bedeli', icon: Truck },
]

const currency = (amount: number) => new Intl.NumberFormat('tr-TR').format(amount)

export default function Page() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [vehiclesList, setVehiclesList] = useState<string[]>([])
  const [vehicle, setVehicle] = useState('Tüm araçlar')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [receivables, setReceivables] = useState<Receivable[]>([])
  const [activeCategory, setActiveCategory] = useState('Tümü')
  const [modalType, setModalType] = useState<'income' | 'expense' | null>(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [category, setCategory] = useState('Mazot')
  const [liters, setLiters] = useState('')
  const [km, setKm] = useState('')

  // 1. Oturum Kontrolü ve Gerçek Verileri Yükleme
  useEffect(() => {
    async function loadUserData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      setUserId(user.id)

      // Profil Bilgisi
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (prof) setProfile(prof)

      // Araç Listesi
      const { data: vehs } = await supabase.from('vehicles').select('plate_number').eq('user_id', user.id)
      if (vehs && vehs.length > 0) {
        setVehiclesList(vehs.map((v) => v.plate_number))
      }

      // Finans Hareketleri
      const { data: txs } = await supabase.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      if (txs) {
        setTransactions(txs.map((item: any) => ({
          ...item,
          icon: item.type === 'income' ? Truck : (categoryItems.find((c) => c.label === item.category)?.icon || Fuel)
        })))
      }

      setLoading(false)
    }

    loadUserData()
  }, [router])

  const filtered = useMemo(() => transactions.filter((item) => (vehicle === 'Tüm araçlar' || item.vehicle === vehicle) && (activeCategory === 'Tümü' || item.category === activeCategory)), [transactions, vehicle, activeCategory])
  const income = useMemo(() => transactions.filter((item) => item.type === 'income' && (vehicle === 'Tüm araçlar' || item.vehicle === vehicle)).reduce((sum, item) => sum + item.amount, 0), [transactions, vehicle])
  const expense = useMemo(() => transactions.filter((item) => item.type === 'expense' && (vehicle === 'Tüm araçlar' || item.vehicle === vehicle)).reduce((sum, item) => sum + item.amount, 0), [transactions, vehicle])
  const pendingTotal = receivables.filter((item) => item.status === 'Bekliyor').reduce((sum, item) => sum + item.amount, 0)

  // 2. Veritabanına Yeni Gelir/Gider Ekleme
  async function addTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!userId) return

    const parsed = Number(amount.replace(/\D/g, ''))
    if (!parsed) return
    const isIncome = modalType === 'income'
    
    const selectedVehicle = vehicle === 'Tüm araçlar' ? (vehiclesList[0] || 'Plaka Yok') : vehicle

    const payload = {
      user_id: userId,
      type: isIncome ? 'income' : 'expense',
      category: isIncome ? 'Nakliye Bedeli' : category,
      title: note || (isIncome ? 'Yeni nakliye geliri' : category),
      detail: !isIncome && category === 'Mazot' && liters ? `${liters} litre${km ? ` · ${km} km` : ''}` : isIncome ? 'Yeni gelir kaydı' : 'Yeni gider kaydı',
      date: 'Bugün',
      amount: parsed,
      vehicle: selectedVehicle,
      liters: Number(liters) || null,
      km: Number(km) || null
    }

    const { data, error } = await supabase.from('transactions').insert([payload]).select().single()

    if (!error && data) {
      const newTx: Transaction = {
        ...data,
        icon: isIncome ? Truck : (categoryItems.find((item) => item.label === category)?.icon || Fuel)
      }
      setTransactions((current) => [newTx, ...current])
    }

    setAmount('')
    setNote('')
    setLiters('')
    setKm('')
    setModalType(null)
  }

  // 3. Veritabanından Silme
  async function deleteTransaction(id: string) {
    setTransactions((current) => current.filter((t) => t.id !== id))
    await supabase.from('transactions').delete().eq('id', id)
  }

  // 4. Oturumu Kapatma
  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fa] text-sm font-bold text-[#122c4a]">
        Yükleniyor...
      </div>
    )
  }

  const firstName = profile?.full_name ? profile.full_name.split(' ')[0] : 'Sürücü'
  const initials = profile?.full_name ? profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'AK'

  const nav = [
    { id: 'overview', label: 'Genel Bakış', icon: LayoutDashboard },
    { id: 'transactions', label: 'İşlemler', icon: Receipt },
    { id: 'receivables', label: 'Alacaklar', icon: WalletCards },
    { id: 'reports', label: 'Raporlar', icon: BarChart3 },
    { id: 'vehicles', label: 'Araçlar', icon: Truck }
  ]

  return (
    <main className="min-h-screen bg-[#f5f7fa] text-[#122c4a]">
      <div className="mx-auto flex min-h-screen max-w-[1440px]">
        <aside className="hidden w-[248px] shrink-0 flex-col border-r border-[#e5eaf0] bg-white px-5 py-7 lg:flex">
          <Brand />
          <nav className="mt-12 flex flex-col gap-2" aria-label="Ana menü">
            {nav.map(({ id, label, icon: Icon }) => (
              <NavButton key={id} active={tab === id} onClick={() => setTab(id as Tab)} icon={Icon}>{label}</NavButton>
            ))}
          </nav>
          <div className="mt-auto rounded-2xl bg-[#122c4a] p-4 text-white">
            <p className="text-xs font-semibold text-white/60">Bekleyen navlun</p>
            <p className="mt-2 text-2xl font-extrabold">₺{currency(pendingTotal)}</p>
            <p className="mt-2 text-[11px] text-white/60">Cari alacak bakiyeniz</p>
          </div>
          <div className="mt-5 flex items-center gap-3 border-t border-[#e5eaf0] pt-5">
            <div className="flex size-9 items-center justify-center rounded-full bg-[#e7edf2] text-sm font-bold">{initials}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold">{profile?.full_name || 'Kullanıcı'}</p>
              <p className="truncate text-[11px] text-[#8391a0]">{vehiclesList[0] || 'Plaka Eklenmedi'}</p>
            </div>
            <button onClick={handleLogout} className="p-1 text-[#8391a0] hover:text-red-600" title="Çıkış Yap">
              <LogOut className="size-4" />
            </button>
          </div>
        </aside>

        <section className="min-w-0 flex-1 px-4 pb-24 sm:px-7 lg:px-10 lg:pb-8">
          <header className="flex items-center justify-between py-5 sm:py-7">
            <div>
              <p className="text-xs font-semibold text-[#8391a0]">Hoş Geldiniz</p>
              <h1 className="mt-1 text-[24px] font-extrabold tracking-tight sm:text-[30px]">Günaydın, {firstName}</h1>
            </div>
            <div className="flex items-center gap-3">
              <label className="hidden items-center gap-2 rounded-xl border border-[#e5eaf0] bg-white px-3 py-2 text-xs font-bold sm:flex">
                <Truck className="size-4 text-[#d64526]" />
                <select aria-label="Araç seçimi" value={vehicle} onChange={(e) => setVehicle(e.target.value)} className="bg-transparent outline-none">
                  <option>Tüm araçlar</option>
                  {vehiclesList.map((v) => <option key={v}>{v}</option>)}
                </select>
                <ChevronDown className="size-3.5" />
              </label>
              <button onClick={handleLogout} className="flex size-10 items-center justify-center rounded-full bg-white text-[#8391a0] shadow-sm hover:text-red-600" aria-label="Çıkış Yap">
                <LogOut className="size-[18px]" />
              </button>
              <div className="flex size-10 items-center justify-center rounded-full bg-[#122c4a] text-sm font-bold text-white lg:hidden">{initials}</div>
            </div>
          </header>

          {tab === 'overview' && <Overview income={income} expense={expense} pendingTotal={pendingTotal} setTab={setTab} setModalType={setModalType} categories={categoryItems} activeCategory={activeCategory} setActiveCategory={setActiveCategory} filtered={filtered} onDelete={deleteTransaction} />}
          {tab === 'transactions' && <Transactions categories={categoryItems} activeCategory={activeCategory} setActiveCategory={setActiveCategory} filtered={filtered} onDelete={deleteTransaction} />}
          {tab === 'receivables' && <Receivables receivables={receivables} setReceivables={setReceivables} pendingTotal={pendingTotal} />}
          {tab === 'reports' && <Reports income={income} expense={expense} />}
          {tab === 'vehicles' && <Vehicles vehicle={vehicle} setVehicle={setVehicle} vehiclesList={vehiclesList} />}
        </section>
      </div>

      <nav className="fixed inset-x-3 bottom-3 z-30 flex justify-around rounded-2xl border border-[#e5eaf0] bg-white/95 p-2 shadow-xl backdrop-blur lg:hidden" aria-label="Mobil menü">
        {nav.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id as Tab)} className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-bold ${tab === id ? 'bg-[#122c4a] text-white' : 'text-[#8391a0]'}`}>
            <Icon className="size-4" />{label}
          </button>
        ))}
      </nav>

      {modalType && (
        <Modal type={modalType} amount={amount} setAmount={setAmount} category={category} setCategory={setCategory} note={note} setNote={setNote} liters={liters} setLiters={setLiters} km={km} setKm={setKm} onSubmit={addTransaction} close={() => setModalType(null)} />
      )}
    </main>
  )
}

function Brand() { 
  return (
    <div className="flex items-center gap-3 px-2">
      <div className="flex size-10 items-center justify-center rounded-xl bg-[#122c4a] text-white shadow-lg">
        <ShipWheel className="size-5" />
      </div>
      <div>
        <p className="text-[15px] font-extrabold tracking-tight">Nakliye Cepte <span className="text-[#d64526]">Finans</span></p>
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#8391a0]">Bireysel Sürücü Paneli</p>
      </div>
    </div>
  ) 
}

function NavButton({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof LayoutDashboard; children: string }) { 
  return <button onClick={onClick} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-bold ${active ? 'bg-[#eef3f7] text-[#122c4a]' : 'text-[#8391a0] hover:bg-[#f5f7fa]'}`}><Icon className="size-[18px]" />{children}</button> 
}

function SummaryCard({ label, value, icon: Icon, highlighted, expense }: { label: string; value: number; icon: typeof CircleDollarSign; highlighted?: boolean; expense?: boolean }) { 
  return <article className={`rounded-2xl border p-5 shadow-[0_8px_30px_rgba(18,44,74,0.04)] ${highlighted ? 'border-[#122c4a] bg-[#122c4a] text-white' : 'border-[#e5eaf0] bg-white'}`}><div className="flex items-start justify-between"><div><p className={`text-xs font-bold ${highlighted ? 'text-white/65' : 'text-[#8391a0]'}`}>{label}</p><p className="mt-2 text-[25px] font-extrabold tracking-tight">₺{currency(value)}</p></div><div className={`flex size-9 items-center justify-center rounded-xl ${highlighted ? 'bg-white/10 text-[#ff9b83]' : expense ? 'bg-[#eef3f7] text-[#122c4a]' : 'bg-[#fff0ed] text-[#d64526]'}`}><Icon className="size-[18px]" /></div></div><p className={`mt-4 text-[11px] font-semibold ${highlighted ? 'text-white/55' : 'text-[#8391a0]'}`}>Güncel Dönem</p></article> 
}

function Overview({ income, expense, pendingTotal, setTab, setModalType, categories, activeCategory, setActiveCategory, filtered, onDelete }: any) { 
  return <><div className="grid gap-4 sm:grid-cols-3"><SummaryCard label="Net Kâr" value={income - expense} highlighted icon={CircleDollarSign} /><SummaryCard label="Toplam Gelir" value={income} icon={ArrowDownLeft} /><SummaryCard label="Toplam Gider" value={expense} icon={ArrowUpRight} expense /></div><div className="mt-6 grid gap-4 sm:grid-cols-3"><button onClick={() => setModalType('income')} className="flex h-14 items-center justify-center gap-3 rounded-2xl bg-[#d64526] px-5 text-sm font-extrabold text-white shadow-lg shadow-[#d64526]/20 cursor-pointer"><Plus className="size-5" /> Gelir Ekle</button><button onClick={() => setModalType('expense')} className="flex h-14 items-center justify-center gap-3 rounded-2xl bg-[#122c4a] px-5 text-sm font-extrabold text-white shadow-lg shadow-[#122c4a]/15 cursor-pointer"><Plus className="size-5" /> Gider Ekle</button><button onClick={() => setTab('receivables')} className="flex h-14 items-center justify-center gap-3 rounded-2xl border border-[#e5eaf0] bg-white px-5 text-sm font-extrabold text-[#122c4a] cursor-pointer"><WalletCards className="size-5 text-[#d64526]" /> ₺{currency(pendingTotal)} alacak</button></div><Transactions categories={categories} activeCategory={activeCategory} setActiveCategory={setActiveCategory} filtered={filtered} onDelete={onDelete} compact /></> 
}

function Transactions({ categories, activeCategory, setActiveCategory, filtered, onDelete, compact = false }: any) { 
  return <section className={`${compact ? 'mt-8' : 'mt-2'} rounded-2xl border border-[#e5eaf0] bg-white p-4 shadow-[0_8px_30px_rgba(18,44,74,0.04)] sm:p-6`}><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8391a0]">Finans hareketleri</p><h2 className="mt-1 text-lg font-extrabold">İşlem geçmişi</h2></div></div><div className="scrollbar-hide mt-5 flex gap-2 overflow-x-auto pb-1">{categories.map(({ label, icon: Icon }: any) => <button key={label} onClick={() => setActiveCategory(label)} className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold cursor-pointer ${activeCategory === label ? 'border-[#122c4a] bg-[#122c4a] text-white' : 'border-[#e5eaf0] bg-white text-[#536579]'}`}><Icon className="size-4" />{label}</button>)}</div><div className="mt-3 flex flex-col">{filtered.length === 0 ? <p className="py-6 text-center text-xs text-[#8391a0]">Henüz bir işlem kaydı yok.</p> : filtered.map((item: Transaction) => { const Icon = item.icon || Fuel; return <div key={item.id} className="group flex items-center gap-3 border-t border-[#eef1f4] py-4 first:border-t-0"><div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${item.type === 'income' ? 'bg-[#fff0ed] text-[#d64526]' : 'bg-[#eef3f7] text-[#122c4a]'}`}><Icon className="size-[18px]" /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-bold">{item.title}</p><span className="hidden rounded-full bg-[#f0f3f6] px-2 py-0.5 text-[9px] font-bold sm:inline-flex">{item.vehicle}</span></div><p className="mt-0.5 truncate text-xs text-[#8391a0]">{item.detail} · {item.date}</p></div><p className={`text-sm font-extrabold ${item.type === 'income' ? 'text-[#d64526]' : 'text-[#122c4a]'}`}>{item.type === 'income' ? '+' : '-'}₺{currency(item.amount)}</p><button onClick={() => onDelete(item.id)} className="hidden rounded-md p-1.5 text-[#8391a0] hover:bg-[#f5f7fa] group-hover:block cursor-pointer" aria-label="Sil"><Trash2 className="size-3.5" /></button></div> })}</div></section> 
}

function Receivables({ receivables, setReceivables, pendingTotal }: any) { 
  return <section className="mt-2"><div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#d64526]">Cari alacaklar defteri</p><h2 className="mt-1 text-2xl font-extrabold">Alacaklar / Navlun Defteri</h2></div></div><div className="mt-5 rounded-2xl bg-[#122c4a] p-5 text-white"><p className="text-xs text-white/60">Tahsil edilmesi beklenen</p><p className="mt-1 text-3xl font-extrabold">₺{currency(pendingTotal)}</p></div></section> 
}

function Reports({ income, expense }: { income: number; expense: number }) { 
  return <section className="mt-2"><div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#d64526]">Performans özeti</p><h2 className="mt-1 text-2xl font-extrabold">Gelişmiş Raporlar</h2></div><button onClick={() => window.print()} className="flex items-center gap-2 rounded-xl border border-[#e5eaf0] bg-white px-4 py-3 text-xs font-extrabold cursor-pointer"><Download className="size-4" /> Raporu İndir</button></div></section> 
}

function Vehicles({ vehicle, setVehicle, vehiclesList }: { vehicle: string; setVehicle: (value: string) => void; vehiclesList: string[] }) { 
  return <section className="mt-2"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#d64526]">Plaka yönetimi</p><h2 className="mt-1 text-2xl font-extrabold">Araçlar & Evrak Takibi</h2><div className="mt-5 grid gap-3 sm:grid-cols-3">{vehiclesList.map((v) => <button key={v} onClick={() => setVehicle(v)} className={`rounded-2xl border p-4 text-left cursor-pointer ${vehicle === v ? 'border-[#d64526] bg-[#fff8f6]' : 'border-[#e5eaf0] bg-white'}`}><Truck className="size-5 text-[#d64526]" /><p className="mt-3 text-sm font-extrabold">{v}</p></button>)}</div></section> 
}

function Modal({ type, amount, setAmount, category, setCategory, note, setNote, liters, setLiters, km, setKm, onSubmit, close }: any) { 
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#122c4a]/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) close() }}><div role="dialog" aria-modal="true" aria-labelledby="modal-title" className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#d64526]">Yeni kayıt</p><h2 id="modal-title" className="mt-1 text-xl font-extrabold">{type === 'income' ? 'Gelir Ekle' : 'Gider Ekle'}</h2></div><button onClick={close} className="rounded-full bg-[#f5f5f5] p-2 text-[#8391a0] cursor-pointer" aria-label="Kapat"><X className="size-4" /></button></div><form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4"><label className="flex flex-col gap-2 text-xs font-bold text-[#536579]">Tutar (₺)<input required inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" className="h-12 rounded-xl border border-[#dfe6ed] bg-[#f8fafb] px-4 text-base font-bold outline-none focus:border-[#d64526]" /></label>{type === 'expense' && <label className="flex flex-col gap-2 text-xs font-bold text-[#536579]">Kategori<select value={category} onChange={(e) => setCategory(e.target.value)} className="h-12 rounded-xl border border-[#dfe6ed] bg-[#f8fafb] px-4 text-sm font-bold outline-none focus:border-[#d64526]"><option>Mazot</option><option>Köprü & Otoyol</option><option>Bakım & Servis</option><option>Yemek</option><option>Lastik</option></select></label>}{type === 'expense' && category === 'Mazot' && <div className="grid grid-cols-2 gap-3"><label className="flex flex-col gap-2 text-xs font-bold text-[#536579]">Litre (opsiyonel)<input inputMode="decimal" value={liters} onChange={(e) => setLiters(e.target.value)} placeholder="238" className="h-12 rounded-xl border border-[#dfe6ed] bg-[#f8fafb] px-4 font-bold outline-none focus:border-[#d64526]" /></label><label className="flex flex-col gap-2 text-xs font-bold text-[#536579]">Kilometre (KM)<input inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} placeholder="1420" className="h-12 rounded-xl border border-[#dfe6ed] bg-[#f8fafb] px-4 font-bold outline-none focus:border-[#d64526]" /></label></div>}<label className="flex flex-col gap-2 text-xs font-bold text-[#536579]">Not / Açıklama<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Örn. İstasyon veya rota adı" className="h-12 rounded-xl border border-[#dfe6ed] bg-[#f8fafb] px-4 font-bold outline-none focus:border-[#d64526]" /></label><button type="submit" className="mt-2 h-12 rounded-xl bg-[#d64526] text-sm font-extrabold text-white shadow-lg shadow-[#d64526]/20 cursor-pointer">Kaydet</button></form></div></div> 
}
