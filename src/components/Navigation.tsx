import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Sprout, Stethoscope, Store, Landmark, TrendingUp, User, Users, Building2, ShoppingBag, Briefcase, BookOpen, Truck, Map, Warehouse, Wallet } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { TranslationKey } from '../lib/translations';

interface NavItem {
  icon: typeof LayoutDashboard;
  labelKey: TranslationKey;
  path: string;
  roles: string[]; // which roles can see this item
}

const allNavItems: NavItem[] = [
  { icon: LayoutDashboard, labelKey: 'nav_dashboard', path: '/dashboard', roles: ['farmer', 'buyer', 'village_agent'] },
  { icon: LayoutDashboard, labelKey: 'nav_dashboard', path: '/transporter-dashboard', roles: ['transporter'] },
  { icon: Warehouse, labelKey: 'nav_warehouse_dashboard', path: '/warehouse-dashboard', roles: ['warehouse_owner'] },
  { icon: Map, labelKey: 'nav_load_board', path: '/load-board', roles: ['transporter'] },
  { icon: Warehouse, labelKey: 'nav_storage_hub', path: '/storage-hub', roles: ['farmer', 'village_agent'] },
  { icon: Wallet, labelKey: 'nav_vault', path: '/vault', roles: ['farmer', 'village_agent'] },
  { icon: Sprout, labelKey: 'nav_advisory', path: '/advisory', roles: ['farmer', 'village_agent'] },
  { icon: Stethoscope, labelKey: 'nav_crop_doctor', path: '/crop-doctor', roles: ['farmer', 'village_agent'] },
  { icon: ShoppingBag, labelKey: 'nav_input_store', path: '/input-store', roles: ['farmer', 'village_agent'] },
  { icon: Briefcase, labelKey: 'nav_corporate_contracts', path: '/corporate-contracts', roles: ['buyer', 'village_agent'] },
  { icon: Store, labelKey: 'nav_market', path: '/market', roles: ['farmer', 'buyer', 'village_agent', 'transporter', 'warehouse_owner'] },
  { icon: BookOpen, labelKey: 'nav_khata', path: '/khata', roles: ['farmer', 'buyer', 'village_agent'] },
  { icon: Users, labelKey: 'nav_group_listings', path: '/group-listings', roles: ['farmer', 'seller', 'village_agent'] },
  { icon: TrendingUp, labelKey: 'nav_insights', path: '/insights', roles: ['buyer', 'village_agent'] },
  { icon: Landmark, labelKey: 'nav_schemes', path: '/schemes', roles: ['farmer', 'village_agent'] },
  { icon: Building2, labelKey: 'nav_agent_farmers', path: '/agent/farmers', roles: ['village_agent'] },
];

export function Sidebar() {
  const { t } = useLanguage();
  const { userData } = useAuth();
  const role = userData?.role || 'farmer';
  
  const visibleItems = allNavItems.filter(item => item.roles.includes(role));

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-100 h-[calc(100vh-4rem)] sticky top-16 pt-6 px-4">
      <nav className="space-y-2">
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              twMerge(
                clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-2xl font-medium transition-colors min-h-[44px]',
                  isActive ? 'bg-[#D1FAE5] text-[#1B4332]' : 'text-[#6B7280] hover:bg-gray-50 hover:text-[#111827]'
                )
              )
            }
          >
            <item.icon className="w-5 h-5 shrink-0" />
            <span className="font-devanagari">{t(item.labelKey)}</span>
          </NavLink>
        ))}
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            twMerge(
              clsx(
                'flex items-center gap-3 px-4 py-3 rounded-2xl font-medium transition-colors min-h-[44px]',
                isActive ? 'bg-[#D1FAE5] text-[#1B4332]' : 'text-[#6B7280] hover:bg-gray-50 hover:text-[#111827]'
              )
            )
          }
        >
          <User className="w-5 h-5 shrink-0" />
          <span className="font-devanagari">{t('nav_profile')}</span>
        </NavLink>
      </nav>
    </aside>
  );
}

export function BottomBar() {
  const { t } = useLanguage();
  const { userData } = useAuth();
  const role = userData?.role || 'farmer';
  
  // Bottom bar: filter by role and limit to 5 items (drop crop-doctor for farmers)
  const visibleItems = allNavItems.filter(item => item.roles.includes(role));
  const bottomItems = visibleItems.length > 5 
    ? visibleItems.filter(item => item.path !== '/crop-doctor')
    : visibleItems;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50 pb-[env(safe-area-inset-bottom,0)]">
      <div className="flex justify-around items-stretch min-h-16 px-1">
        {bottomItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              twMerge(
                clsx(
                  'flex flex-col items-center justify-center flex-1 py-2 gap-1 min-w-0 transition-colors min-h-[44px]',
                  isActive ? 'text-[#1B4332]' : 'text-[#6B7280]'
                )
              )
            }
          >
            <item.icon className="w-6 h-6 shrink-0" />
            <span className="text-[10px] font-medium text-center leading-tight font-devanagari truncate max-w-full px-0.5">
              {t(item.labelKey)}
            </span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
