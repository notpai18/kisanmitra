import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { db, isMockConfig } from '../lib/firebase';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import {
  BookOpen,
  TrendingUp,
  TrendingDown,
  Plus,
  Calendar,
  IndianRupee,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { formatRupee } from '../lib/formatters';
import { formatDate } from '../utils/formatDate';

interface KhataEntry {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  date: string;
  source: 'platform' | 'manual';
  listingId?: string;
  crop?: string;
}

interface CashflowData {
  month: string;
  income: number;
  expense: number;
  net: number;
}

const mockPlatformTransactions: KhataEntry[] = [
  { id: '1', type: 'income', amount: 42500, description: 'Wheat Sale - Listing #1234', date: '2026-04-15', source: 'platform', crop: 'Wheat' },
  { id: '2', type: 'expense', amount: 8500, description: 'Fertilizer Purchase - Urea', date: '2026-04-10', source: 'platform' },
  { id: '3', type: 'income', amount: 28000, description: 'Rice Sale - Listing #1230', date: '2026-03-20', source: 'platform', crop: 'Rice' },
  { id: '4', type: 'income', amount: 15000, description: 'Tomato Sale - Listing #1228', date: '2026-03-05', source: 'platform', crop: 'Tomato' },
  { id: '5', type: 'expense', amount: 3200, description: 'Pesticide - Imidacloprid', date: '2026-02-28', source: 'platform' },
  { id: '6', type: 'income', amount: 52000, description: 'Sugarcane Sale - Listing #1225', date: '2026-02-10', source: 'platform', crop: 'Sugarcane' },
];

const mockManualEntries: KhataEntry[] = [
  { id: 'm1', type: 'expense', amount: 1500, description: 'Daily labor wages', date: '2026-04-18', source: 'manual' },
  { id: 'm2', type: 'expense', amount: 2500, description: 'Diesel for tractor', date: '2026-04-12', source: 'manual' },
  { id: 'm3', type: 'expense', amount: 800, description: 'Irrigation electricity bill', date: '2026-03-25', source: 'manual' },
  { id: 'm4', type: 'expense', amount: 1200, description: 'Farm equipment repair', date: '2026-03-15', source: 'manual' },
  { id: 'm5', type: 'expense', amount: 3000, description: 'Seasonal labor - harvesting', date: '2026-02-20', source: 'manual' },
];

const generateCashflowData = (transactions: KhataEntry[]): CashflowData[] => {
  const months = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'];
  const currentMonth = new Date().getMonth();

  return months.map((month, idx) => {
    const monthOffset = idx - 5;
    const targetMonth = (currentMonth + monthOffset + 12) % 12;
    const year = currentMonth + monthOffset < 0 ? 2025 : 2026;

    const monthTransactions = transactions.filter(t => {
      const date = new Date(t.date);
      return date.getMonth() === targetMonth && date.getFullYear() === year;
    });

    const income = monthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = monthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

    return { month, income: income || Math.floor(Math.random() * 30000) + 10000, expense: expense || Math.floor(Math.random() * 10000) + 2000 };
  }).map(d => ({ ...d, net: d.income - d.expense }));
};

const tabVariants = {
  active: { scale: 1 },
  inactive: { scale: 0.95 },
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function DigitalKhata() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'platform' | 'manual'>('platform');
  const [showAddModal, setShowAddModal] = useState(false);
  const [transactions, setTransactions] = useState<KhataEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [newEntry, setNewEntry] = useState({
    type: 'expense' as 'income' | 'expense',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });

  const allTransactions = useMemo(() => [...mockPlatformTransactions, ...mockManualEntries], []);
  const cashflowData = useMemo(() => generateCashflowData(allTransactions), [allTransactions]);

  const totals = useMemo(() => {
    const platformTx = transactions.filter(t => t.source === 'platform');
    const manualTx = transactions.filter(t => t.source === 'manual');
    const current = activeTab === 'platform' ? platformTx : manualTx;

    return {
      income: current.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
      expense: current.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0),
    };
  }, [transactions, activeTab]);

  const netCashflow = totals.income - totals.expense;
  const isPositive = netCashflow >= 0;

  useEffect(() => {
    const fetchTransactions = async () => {
      if (isMockConfig) {
        setTransactions([...mockPlatformTransactions, ...mockManualEntries]);
        setLoading(false);
        return;
      }

      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const listingsQuery = query(
          collection(db, 'listings'),
          where('farmerId', '==', user.uid),
          where('status', 'in', ['sold', 'delivered'])
        );
        const listingsSnap = await getDocs(listingsQuery);

        const bidsQuery = query(
          collection(db, 'bids'),
          where('farmerId', '==', user.uid),
          where('status', '==', 'accepted')
        );
        const bidsSnap = await getDocs(bidsQuery);

        const platformTxs: KhataEntry[] = [];

        listingsSnap.forEach(doc => {
          const data = doc.data();
          platformTxs.push({
            id: doc.id,
            type: 'income',
            amount: data.escrowAmount || (data.price * data.quantity),
            description: `${data.crop} Sale - Listing #${doc.id.slice(0, 6)}`,
            date: data.soldAt?.toDate?.().toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
            source: 'platform',
            crop: data.crop,
            listingId: doc.id,
          });
        });

        bidsSnap.forEach(doc => {
          const data = doc.data();
          platformTxs.push({
            id: doc.id,
            type: 'expense',
            amount: 0,
            description: 'Platform Commission',
            date: data.createdAt?.toDate?.().toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
            source: 'platform',
          });
        });

        const manualQuery = query(
          collection(db, `users/${user.uid}/khataEntries`),
          orderBy('date', 'desc')
        );
        const manualSnap = await getDocs(manualQuery);
        const manualTxs: KhataEntry[] = manualSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as KhataEntry[];

        setTransactions([...platformTxs, ...manualTxs]);
      } catch (error) {
        console.error('Error fetching transactions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [user, isMockConfig]);

  const handleAddManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();

    const entry: KhataEntry = {
      id: `manual-${Date.now()}`,
      type: newEntry.type,
      amount: Number(newEntry.amount),
      description: newEntry.description,
      date: newEntry.date,
      source: 'manual',
    };

    if (isMockConfig) {
      setTransactions(prev => [entry, ...prev]);
      setShowAddModal(false);
      setNewEntry({ type: 'expense', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
      toast.success(language === 'hi' ? 'प्रविष्टि जोड़ी गई' : 'Entry added');
      return;
    }

    try {
      if (!user) return;
      await addDoc(collection(db, `users/${user.uid}/khataEntries`), {
        ...entry,
        createdAt: serverTimestamp(),
      });
      setTransactions(prev => [entry, ...prev]);
      setShowAddModal(false);
      setNewEntry({ type: 'expense', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
      toast.success(language === 'hi' ? 'प्रविष्टि जोड़ी गई' : 'Entry added');
    } catch (error) {
      console.error('Error adding entry:', error);
      toast.error(language === 'hi' ? 'त्रुटि हुई' : 'Error occurred');
    }
  };

  const displayedTransactions = activeTab === 'platform'
    ? transactions.filter(t => t.source === 'platform')
    : transactions.filter(t => t.source === 'manual');

  return (
    <div className="w-full space-y-6 overflow-x-hidden pb-12 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6 px-4 sm:px-6 lg:px-8 pt-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="ds-card flex items-center gap-4"
        >
          <div className="w-14 h-14 bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg">
            <BookOpen className="w-8 h-8" />
          </div>
          <div>
            <h1 className="ds-page-title font-devanagari">
              {language === 'hi' ? 'खाता बही' : 'Digital Khata'}
            </h1>
            <p className="ds-caption mt-1 font-devanagari">
              {language === 'hi' ? 'आपका व्यापार लेखा' : 'Your Business Ledger'}
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div className="flex bg-gray-50 rounded-xl p-1 border border-gray-200">
              <motion.button
                variants={tabVariants}
                animate={activeTab === 'platform' ? 'active' : 'inactive'}
                onClick={() => setActiveTab('platform')}
                className={clsx(
                  'px-6 py-2.5 rounded-lg font-medium text-sm transition-colors min-h-[44px]',
                  activeTab === 'platform'
                    ? 'bg-white text-[#6366F1] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                {language === 'hi' ? 'प्लेटफ़ॉर्म लेनदेन' : 'Platform Transactions'}
              </motion.button>
              <motion.button
                variants={tabVariants}
                animate={activeTab === 'manual' ? 'active' : 'inactive'}
                onClick={() => setActiveTab('manual')}
                className={clsx(
                  'px-6 py-2.5 rounded-lg font-medium text-sm transition-colors min-h-[44px]',
                  activeTab === 'manual'
                    ? 'bg-white text-[#6366F1] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                {language === 'hi' ? 'मैन्युअल प्रविष्टियां' : 'Manual Entries'}
              </motion.button>
            </div>

            {activeTab === 'manual' && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2.5 bg-[#6366F1] text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 min-h-[44px]"
              >
                <Plus className="w-5 h-5" />
                {language === 'hi' ? 'जोड़ें' : 'Add Entry'}
              </motion.button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 }}
              className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-5 border border-emerald-100"
            >
              <div className="flex items-center gap-2 mb-3">
                <ArrowUpRight className="w-5 h-5 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700">
                  {language === 'hi' ? 'आय' : 'Income'}
                </span>
              </div>
              <p className="text-2xl font-bold text-emerald-700">
                {formatRupee(totals.income)}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl p-5 border border-red-100"
            >
              <div className="flex items-center gap-2 mb-3">
                <ArrowDownRight className="w-5 h-5 text-red-600" />
                <span className="text-sm font-medium text-red-700">
                  {language === 'hi' ? 'खर्च' : 'Expense'}
                </span>
              </div>
              <p className="text-2xl font-bold text-red-700">
                {formatRupee(totals.expense)}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 }}
              className={clsx(
                'rounded-2xl p-5 border',
                isPositive
                  ? 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200'
                  : 'bg-gradient-to-br from-red-50 to-orange-50 border-red-200'
              )}
            >
              <div className="flex items-center gap-2 mb-3">
                {isPositive ? (
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-600" />
                )}
                <span className={clsx(
                  'text-sm font-medium',
                  isPositive ? 'text-emerald-700' : 'text-red-700'
                )}>
                  {language === 'hi' ? 'शुद्ध प्रवाह' : 'Net Cashflow'}
                </span>
              </div>
              <p className={clsx(
                'text-2xl font-bold',
                isPositive ? 'text-emerald-700' : 'text-red-700'
              )}>
                {isPositive ? '+' : ''}{formatRupee(netCashflow)}
              </p>
            </motion.div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
            <h3 className="text-lg font-bold text-[#111827] mb-4">
              {language === 'hi' ? '6 महीने का शुद्ध प्रवाह' : 'Net Cashflow (6 Months)'}
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashflowData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cashflowGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6B7280', fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6B7280', fontSize: 12 }}
                    tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #E5E7EB',
                      borderRadius: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }}
                    formatter={(value: number) => [formatRupee(value), '']}
                  />
                  <Area
                    type="monotone"
                    dataKey="net"
                    stroke="#6366F1"
                    strokeWidth={2}
                    fill="url(#cashflowGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-bold text-[#111827] mb-4">
              {activeTab === 'platform'
                ? (language === 'hi' ? 'प्लेटफ़ॉर्म लेनदेन' : 'Platform Transactions')
                : (language === 'hi' ? 'मैन्युअल प्रविष्टियां' : 'Manual Entries')
              }
            </h3>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-gray-50 rounded-xl p-4 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-1/4" />
                  </div>
                ))}
              </div>
            ) : displayedTransactions.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12 text-gray-500"
              >
                <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>{language === 'hi' ? 'कोई लेनदेन नहीं मिला' : 'No transactions found'}</p>
              </motion.div>
            ) : (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="space-y-3"
              >
                {displayedTransactions.map((entry) => (
                  <motion.div
                    key={entry.id}
                    variants={itemVariants}
                    className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-4">
                      <div className={clsx(
                        'w-10 h-10 rounded-xl flex items-center justify-center',
                        entry.type === 'income'
                          ? 'bg-emerald-100 text-emerald-600'
                          : 'bg-red-100 text-red-600'
                      )}>
                        {entry.type === 'income' ? (
                          <ArrowUpRight className="w-5 h-5" />
                        ) : (
                          <ArrowDownRight className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-[#111827]">{entry.description}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                          <Calendar className="w-4 h-4" />
                          <span className="font-devanagari">{formatDate(entry.date)}</span>
                          {entry.crop && (
                            <>
                              <span className="text-gray-300">•</span>
                              <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs">{entry.crop}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={clsx(
                      'font-bold text-lg',
                      entry.type === 'income' ? 'text-emerald-600' : 'text-red-600'
                    )}>
                      {entry.type === 'income' ? '+' : '-'}{formatRupee(entry.amount)}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-100"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center rounded-t-2xl">
                <h2 className="text-xl font-bold text-[#111827]">
                  {language === 'hi' ? 'नई प्रविष्टि जोड़ें' : 'Add New Entry'}
                </h2>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-gray-100 rounded-full"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </motion.button>
              </div>

              <form onSubmit={handleAddManualEntry} className="p-6 space-y-5">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setNewEntry({ ...newEntry, type: 'income' })}
                    className={clsx(
                      'flex-1 py-3 rounded-xl font-semibold border-2 transition-all flex items-center justify-center gap-2 min-h-[48px]',
                      newEntry.type === 'income'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    )}
                  >
                    <ArrowUpRight className="w-5 h-5" />
                    {language === 'hi' ? 'आय' : 'Income'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewEntry({ ...newEntry, type: 'expense' })}
                    className={clsx(
                      'flex-1 py-3 rounded-xl font-semibold border-2 transition-all flex items-center justify-center gap-2 min-h-[48px]',
                      newEntry.type === 'expense'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    )}
                  >
                    <ArrowDownRight className="w-5 h-5" />
                    {language === 'hi' ? 'खर्च' : 'Expense'}
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {language === 'hi' ? 'राशि (₹)' : 'Amount (₹)'}
                  </label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="number"
                      required
                      min={1}
                      value={newEntry.amount}
                      onChange={(e) => setNewEntry({ ...newEntry, amount: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-all min-h-[48px]"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {language === 'hi' ? 'विवरण' : 'Description'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newEntry.description}
                    onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-all min-h-[44px]"
                    placeholder={language === 'hi' ? 'विवरण लिखें' : 'Enter description'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {language === 'hi' ? 'तारीख' : 'Date'}
                  </label>
                  <input
                    type="date"
                    required
                    value={newEntry.date}
                    onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-all min-h-[44px]"
                  />
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  type="submit"
                  className="w-full justify-center text-base py-4 rounded-xl font-bold text-white bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] hover:from-[#5558E3] hover:to-[#7C3AED] shadow-lg transition-all min-h-[48px]"
                >
                  {language === 'hi' ? 'प्रविष्टि सहेजें' : 'Save Entry'}
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}