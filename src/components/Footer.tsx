import React from 'react';
import { Sprout, Facebook, Twitter, Instagram, Mail } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function Footer() {
  const { t } = useLanguage();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-forest-900 text-forest-100 py-12 border-t border-forest-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-gold-500 p-1.5 rounded-lg shadow-lg shadow-gold-500/20">
                <Sprout className="w-6 h-6 text-forest-900" />
              </div>
              <span className="text-2xl font-bold text-white tracking-tight">
                Kisan<span className="text-gold-500">Mitra</span>
              </span>
            </div>
            <p className="text-forest-200 max-w-sm font-devanagari mb-6">
              Empowering Indian farmers with AI-driven insights, direct market access, and expert advisory.
            </p>
            <div className="flex gap-4">
              <a href="#" className="hover:text-gold-400 transition-colors"><Facebook className="w-5 h-5" /></a>
              <a href="#" className="hover:text-gold-400 transition-colors"><Twitter className="w-5 h-5" /></a>
              <a href="#" className="hover:text-gold-400 transition-colors"><Instagram className="w-5 h-5" /></a>
              <a href="#" className="hover:text-gold-400 transition-colors"><Mail className="w-5 h-5" /></a>
            </div>
          </div>
          
          <div>
            <h4 className="text-white font-bold mb-4 font-devanagari">Platform</h4>
            <ul className="space-y-2 font-devanagari">
              <li><a href="#features" className="hover:text-gold-400 transition-colors">Features</a></li>
              <li><a href="/market" className="hover:text-gold-400 transition-colors">Marketplace</a></li>
              <li><a href="/crop-doctor" className="hover:text-gold-400 transition-colors">Crop Doctor</a></li>
              <li><a href="/advisory" className="hover:text-gold-400 transition-colors">Advisory</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-4 font-devanagari">Company</h4>
            <ul className="space-y-2 font-devanagari">
              <li><a href="#" className="hover:text-gold-400 transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-gold-400 transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-gold-400 transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-gold-400 transition-colors">Contact</a></li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 border-t border-forest-800 text-center text-forest-300 text-sm">
          <p>© {currentYear} KisanMitra. All rights reserved. Made with ❤️ for Indian Farmers.</p>
        </div>
      </div>
    </footer>
  );
}
