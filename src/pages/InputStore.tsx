import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useCart } from '../contexts/CartContext';
import { db, isMockConfig } from '../lib/firebase';
import { collection, getDocs, query, where } from '../lib/firebase';
import { ShoppingBag, Search, Filter, Package, Leaf, Droplets, Bug, X, ChevronDown, Sparkles, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { seedInventory, isInventorySeeded } from '../utils/seedInventory';

interface InventoryItem {
  id: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  category: 'fertilizer' | 'pesticide' | 'seed' | 'organic' | 'tool';
  type?: 'fertilizer' | 'chemical' | 'organic';
  tags?: string[];
  imageUrl?: string;
  inStock: boolean;
  brand?: string;
  applicableCrops?: string[];
}

const CATEGORIES = [
  { key: 'all', en: 'All Products', hi: 'सभी उत्पाद' },
  { key: 'fertilizer', en: 'Fertilizers', hi: 'उर्वरक' },
  { key: 'pesticide', en: 'Pesticides', hi: 'कीटनाशक' },
  { key: 'seed', en: 'Seeds', hi: 'बीज' },
  { key: 'organic', en: 'Organic', hi: 'जैविक' },
  { key: 'tool', en: 'Tools', hi: 'उपकरण' },
];

export default function InputStore() {
  const { language, t } = useLanguage();
  const { addToCart } = useCart();
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [showSeedBanner, setShowSeedBanner] = useState(false);

  useEffect(() => {
    const fetchInventory = async () => {
      setLoading(true);
      try {
        if (isMockConfig) {
          setProducts(getMockProducts());
          return;
        }
        const snapshot = await getDocs(collection(db, 'inventory'));
        const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem));
        setProducts(items);

        // Show seed banner if inventory is empty (and not already seeded)
        if (snapshot.empty && !(await isInventorySeeded())) {
          setShowSeedBanner(true);
        }
      } catch (err) {
        console.error('Failed to fetch inventory:', err);
        setProducts(getMockProducts());
      } finally {
        setLoading(false);
      }
    };
    fetchInventory();
  }, []);

  const handleSeedInventory = async () => {
    setIsSeeding(true);
    try {
      const result = await seedInventory();
      toast.success(
        language === 'hi'
          ? `${result.count} उत्पाद जोड़े गए`
          : `${result.count} products added`
      );
      // Refresh inventory
      const snapshot = await getDocs(collection(db, 'inventory'));
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem));
      setProducts(items);
      setShowSeedBanner(false);
    } catch (err) {
      console.error('Failed to seed inventory:', err);
      toast.error(language === 'hi' ? 'सीडिंग विफल' : 'Seeding failed');
    } finally {
      setIsSeeding(false);
    }
  };

  const getMockProducts = (): InventoryItem[] => [
    { id: '1', name: 'Urea 46-0-0', description: 'High nitrogen fertilizer for vegetative growth', price: 300, unit: 'bag', category: 'fertilizer', inStock: true, brand: 'IFFCO', applicableCrops: ['Wheat', 'Rice', 'Cotton'] },
    { id: '2', name: 'DAP 18-46-0', description: 'Phosphorus rich fertilizer for root development', price: 1350, unit: 'bag', category: 'fertilizer', inStock: true, brand: 'IFFCO', applicableCrops: ['Wheat', 'Mustard', 'Cotton'] },
    { id: '3', name: 'Imidacloprid 17.8% SL', description: 'Systemic insecticide for sucking pests', price: 450, unit: 'liter', category: 'pesticide', inStock: true, brand: 'Bayer', applicableCrops: ['Rice', 'Cotton', 'Sugarcane'] },
    { id: '4', name: 'Carbendazim 50% WP', description: 'Fungicide for fungal disease control', price: 320, unit: 'kg', category: 'pesticide', inStock: true, brand: 'Bayer', applicableCrops: ['Wheat', 'Tomato', 'Potato'] },
    { id: '5', name: 'Basmati Super 100', description: 'Premium basmati rice seeds, high yield', price: 850, unit: 'kg', category: 'seed', inStock: true, brand: 'Pioneer', applicableCrops: ['Rice'] },
    { id: '6', name: 'HD 2329 Wheat', description: 'High yielding wheat variety', price: 450, unit: 'kg', category: 'seed', inStock: true, brand: 'Corteva', applicableCrops: ['Wheat'] },
    { id: '7', name: 'Neem Cake', description: 'Organic pest control and soil enrichment', price: 180, unit: 'kg', category: 'organic', inStock: true, brand: 'Organic India', applicableCrops: ['All'] },
    { id: '8', name: 'Vermicompost', description: '100% organic soil conditioner', price: 250, unit: 'kg', category: 'organic', inStock: true, brand: 'Self', applicableCrops: ['All'] },
    { id: '9', name: 'Knapsack Sprayer 16L', description: 'Manual sprayer for pesticides and fertilizers', price: 850, unit: 'piece', category: 'tool', inStock: true, brand: 'Kisan', applicableCrops: ['All'] },
    { id: '10', name: 'NPK 10-26-26', description: 'Balanced fertilizer for flowering and fruiting', price: 950, unit: 'bag', category: 'fertilizer', inStock: true, brand: 'Coromandel', applicableCrops: ['Mustard', 'Sugarcane', 'Cotton'] },
    { id: '11', name: 'Chlorpyrifos 20% EC', description: 'Broad spectrum insecticide for all pests', price: 380, unit: 'liter', category: 'pesticide', inStock: true, brand: 'FMC', applicableCrops: ['Rice', 'Wheat', 'Cotton'] },
    { id: '12', name: 'FYM (Farm Yard Manure)', description: 'Natural organic manure', price: 120, unit: 'kg', category: 'organic', inStock: true, brand: 'Local', applicableCrops: ['All'] },
  ];

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAddToCart = (item: InventoryItem) => {
    addToCart({
      id: item.id,
      name: item.name,
      price: item.price,
      category: item.category,
    });
    toast.success(language === 'hi' ? `${item.name} कार्ट में जोड़ा गया` : `${item.name} added to cart`);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'fertilizer': return <Droplets className="w-4 h-4" />;
      case 'pesticide': return <Bug className="w-4 h-4" />;
      case 'seed': return <Leaf className="w-4 h-4" />;
      case 'organic': return <Leaf className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  const getCategoryLabel = (category: string) => {
    const cat = CATEGORIES.find(c => c.key === category);
    return cat ? cat[language as 'en' | 'hi'] : category;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Seed Banner */}
      <AnimatePresence>
        {showSeedBanner && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">
                  {language === 'hi' ? 'इन्वेंटरी खाली है' : 'Inventory is empty'}
                </h3>
                <p className="text-sm text-gray-600">
                  {language === 'hi'
                    ? 'कुछ उत्पाद जोड़ें ताकि किसान आपकी दुकान से खरीद सकें।'
                    : 'Add products so farmers can purchase from your store.'}
                </p>
              </div>
            </div>
            <button
              onClick={handleSeedInventory}
              disabled={isSeeding}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
            >
              {isSeeding ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {language === 'hi' ? 'सीड करें' : 'Seed Products'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="bg-white rounded-3xl p-6 md:p-8 mb-8 border border-gray-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center text-white">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 font-devanagari">
                {language === 'en' ? 'Input Store' : 'इनपुट स्टोर'}
              </h1>
              <p className="text-gray-500 font-devanagari">
                {language === 'en' ? 'Quality agricultural inputs for your farm' : 'आपके खेत के लिए गुणवत्ता कृषि इनपुट'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder={language === 'en' ? 'Search products...' : 'उत्पाद खोजें...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 w-full md:w-64 bg-gray-50"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={clsx(
                'p-3 rounded-xl transition-colors',
                showFilters ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Category Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-6 flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.key}
                    onClick={() => setSelectedCategory(cat.key)}
                    className={clsx(
                      'px-4 py-2 rounded-full text-sm font-bold transition-all',
                      selectedCategory === cat.key
                        ? 'bg-green-600 text-white shadow-lg shadow-green-600/20'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    {cat[language as 'en' | 'hi']}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 animate-pulse">
              <div className="h-40 bg-gray-200 rounded-xl mb-4" />
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-gray-100">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg font-devanagari">
            {language === 'en' ? 'No products found' : 'कोई उत्पाद नहीं मिला'}
          </p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >
          {filteredProducts.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ y: -4, scale: 1.01 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-shadow overflow-hidden group"
            >
              <div className="relative h-40 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-20 h-20 bg-white rounded-2xl shadow-md flex items-center justify-center text-green-600">
                    {getCategoryIcon(product.category)}
                  </div>
                )}
                <span className={clsx(
                  'absolute top-3 left-3 px-2 py-1 rounded-full text-xs font-bold',
                  product.inStock ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                )}>
                  {product.inStock
                    ? (language === 'en' ? 'In Stock' : 'उपलब्ध')
                    : (language === 'en' ? 'Out of Stock' : 'नहीं उपलब्ध')}
                </span>
              </div>

              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                    {getCategoryLabel(product.category)}
                  </span>
                  {product.brand && (
                    <span className="text-xs text-gray-400">{product.brand}</span>
                  )}
                </div>
                <h3 className="font-bold text-gray-900 text-lg mb-1">{product.name}</h3>
                <p className="text-sm text-gray-500 mb-3 line-clamp-2">{product.description}</p>

                {product.applicableCrops && product.applicableCrops.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {product.applicableCrops.slice(0, 3).map((crop, i) => (
                      <span key={i} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                        {crop}
                      </span>
                    ))}
                    {product.applicableCrops.length > 3 && (
                      <span className="text-xs text-gray-400">+{product.applicableCrops.length - 3}</span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                  <div>
                    <span className="text-2xl font-bold text-gray-900">₹{product.price}</span>
                    <span className="text-sm text-gray-500">/{product.unit}</span>
                  </div>
                  <button
                    onClick={() => handleAddToCart(product)}
                    disabled={!product.inStock}
                    className={clsx(
                      'px-4 py-2 rounded-xl font-bold text-sm transition-all',
                      product.inStock
                        ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    )}
                  >
                    {language === 'en' ? 'Buy Now' : 'खरीदें'}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}