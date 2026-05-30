# KisanMitra Architecture Summary

> **Last Updated:** 2026-05-19
> **Version:** 1.2.0

---

## 1. High-Level Overview

KisanMitra is a bilingual (English/Hindi) agricultural platform designed for Indian farmers in Eastern Uttar Pradesh. It provides AI-powered crop disease detection, market intelligence, government scheme discovery, peer-to-peer trading, and post-harvest asset-light collateralized storage capabilities. The platform serves five user roles: **Farmers**, **Buyers**, **Village Agents**, **Transporters**, and **Warehouse Owners**.

The application is a single-page application (SPA) deployed on Vercel with Firebase backend services and a Node.js/Express API proxy.

---

## 2. Tech Stack

### Frontend
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 19.0.0 |
| Build Tool | Vite | 6.2.0 |
| Language | TypeScript | 5.8.2 |
| Routing | React Router | 7.14.0 |
| Styling | Tailwind CSS | 4.1.14 |
| Animation | Motion (framer-motion) | 12.23.24 |
| Icons | Lucide React | 0.546.0 |
| Charts | Recharts | 3.8.1 |
| Toast | react-hot-toast | 2.4.1 |
| PWA | vite-plugin-pwa | 1.2.0 |
| Service Worker | Workbox | 7.x (via vite-plugin-pwa) |

### E-Commerce
| Layer | Technology |
|-------|-----------|
| Cart State | React Context + localStorage |
| Product Listings | Firestore `inventory` collection |
| Checkout Flow | Integrated with existing checkout modal |

### Backend & Infrastructure
| Layer | Technology |
|-------|-----------|
| Auth & Database | Firebase (Auth + Firestore) |
| Serverless Logic | Firebase Functions (TrustScore, Alerts) |
| AI/ML | Google Gemini (Generative AI) |
| Weather Data | Open-Meteo API (free, no API key) |
| Hosting | Vercel (Frontend + API) + Firebase Hosting |
| Server Runtime | Express.js (dev/api) via tsx |

### Development
| Tool | Purpose |
|------|---------|
| tsx | TypeScript execution for scripts & dev server |
| Firebase Emulators | Local auth/Firestore/Functions development |

---

## 3. Architecture & Design Patterns

### 3.1 Component Architecture

```
src/
├── components/          # Reusable UI components
│   ├── CheckoutModal.tsx
│   ├── CreditApplyModal.tsx       # Farm Credit with DWR collateral integration
│   ├── DeliveryConfirmModal.tsx   # Buyer confirms delivery & releases escrow
│   ├── DetailedDiagnosisReport.tsx # Reusable AI diagnosis display
│   ├── DWRGenerator.tsx          # Digital Warehouse Receipt component
│   ├── FarmFormModal.tsx
│   ├── Footer.tsx
│   ├── Layout.tsx
│   ├── LocationSelector.tsx
│   ├── LogisticsFormModal.tsx     # Enter truck details (dispatch)
│   ├── MandiTicker.tsx            # Live commodity price ticker
│   ├── Navbar.tsx
│   ├── Navigation.tsx
│   ├── OnboardingModal.tsx
│   ├── PageSkeleton.tsx
│   ├── QualityCertificate.tsx     # AI-verified quality document
│   ├── RoleBasedRoute.tsx
│   ├── SoilMoistureCard.tsx
│   ├── SoilTestCard.tsx           # Soil testing service widget
│   ├── TransportModal.tsx         # Logistics selection modal
│   └── TrustScoreCard.tsx         # TrustScore visualization widget
├── pages/               # Route-level page components
│   ├── Advisory.tsx     # AI chat advisory (farmer only)
│   ├── CorporateContracts.tsx # B2B institutional procurement
│   ├── CropDoctor.tsx    # AI image-based disease detection
│   ├── Dashboard.tsx     # Role-specific home dashboard
│   ├── DeveloperAdmin.tsx # Internal admin & API hub
│   ├── DigitalKhata.tsx  # B2B bookkeeping dashboard
│   ├── DigitalVault.tsx  # Farmer's DWR assets & auto-sell
│   ├── GroupListings.tsx # FPO/cooperative group buying
│   ├── Insights.tsx      # Market analytics (buyer only)
│   ├── InputStore.tsx    # Agri-input e-commerce store
│   ├── Landing.tsx       # Public landing page
│   ├── LoadBoard.tsx     # Transporter load board (Uber-style)
│   ├── Market.tsx        # Crop listing marketplace
│   ├── Profile.tsx       # User profile management
│   ├── RoleSelection.tsx # Post-auth role picker
│   ├── Schemes.tsx       # Government scheme matcher
│   ├── StorageHub.tsx     # Storage marketplace for farmers
│   ├── TransporterDashboard.tsx # Transporter home dashboard
│   ├── VillageAgent.tsx  # Agent farmer management portal
│   └── WarehouseDashboard.tsx  # Warehouse owner dashboard
├── contexts/            # React Context providers
│   ├── AuthContext.tsx   # Firebase auth + user data
│   ├── CartContext.tsx   # Marketplace cart state
│   ├── LanguageContext.tsx # i18n (en/hi)
│   └── NotificationContext.tsx # Real-time notifications
├── lib/                  # Core services & utilities
│   ├── firebase.ts       # Firebase initialization
│   ├── geminiClient.ts   # Gemini AI service wrapper (Client)
│   ├── translations.ts   # i18n translation keys
│   ├── formatters.ts     # Currency/date formatting
│   ├── GroupListingService.ts
│   ├── NotificationService.ts
│   └── OfflineQueueService.ts # PWA offline sync manager
├── services/             # Feature-specific services
│   ├── PriceTriggerService.ts # Auto-sell execution engine
│   └── SoilMoistureService.ts
├── utils/                # Pure utility functions
│   ├── formatDate.ts
│   ├── formatLocation.ts
│   └── weatherLocation.ts
├── data/                 # Static reference data
│   ├── indiaLocations.ts
│   └── upDistricts.ts
├── constants/            # Static constants
│   └── translations.ts
└── types/                # TypeScript type definitions
    └── index.ts
```

### 3.2 State Management

- **React Context** for global state (Auth, Language, Cart, Notifications)
- **Component-local state** with `useState` for UI state
- **Firebase real-time listeners** (`onSnapshot`) for Firestore data
- **localStorage** for cart persistence (per-user key: `km_cart_{uid}`)

### 3.3 Design Patterns

| Pattern | Implementation |
|---------|---------------|
| **Provider Pattern** | `AuthProvider`, `CartProvider`, `LanguageProvider`, `NotificationProvider` |
| **Lazy Loading** | `React.lazy()` + `Suspense` for all page components |
| **Route Guards** | `RoleBasedRoute` component restricts pages by user role |
| **Service Layer** | `geminiClient`, `GroupListingService`, `PriceTriggerService` |
| **Custom Hooks** | `useAuth()`, `useLanguage()`, `useCart()`, `useNotifications()` |

### 3.4 Routing Structure

```
/ (Landing) → Public
/role-selection → Authenticated, no role
/developer → Internal Admin (Admin dashboard)
/dashboard → Authenticated (Farmer, Buyer, Village Agent)
/transporter-dashboard → Transporter only
/load-board → Transporter only
/storage-hub → Farmer, Village Agent
/warehouse-dashboard → Warehouse Owner only
/vault → Farmer, Village Agent (Digital Vault)
/khata → Authenticated (B2B bookkeeping)
/advisory → Farmer, Village Agent
/crop-doctor → Farmer, Village Agent
/input-store → Authenticated (all roles)
/market → Authenticated (all roles)
/insights → Buyer, Village Agent
/schemes → Farmer, Village Agent
/group-listings → Farmer, Seller, Village Agent
/corporate-contracts → Buyer, Village Agent
/profile → Authenticated (all roles)
/agent/farmers → Village Agent only
```

---

## 4. Key Features & Modules

### 4.1 Authentication (Firebase Auth)
- Google Sign-In via popup
- Role assignment post-registration
- **Village Agent Mode:** Agents manage multiple farmer profiles; each action records `agentId` and `farmerId`.
- **Transporter Mode:** Transporters access the Load Board and track earnings via `totalRevenue`.

### 4.2 AI Advisory Chat (`/advisory`)
- Context-aware chat using **Gemini 1.5 Flash Lite**.
- Weather data injection from Open-Meteo API.
- Bilingual responses (English/Hindi) with speech-to-text support.

### 4.3 Crop Doctor (`/crop-doctor`)
- AI image analysis for disease, pests, and nutrient deficiencies.
- **Human-in-the-Loop (HITL):** Initial AI diagnosis can be reviewed and overridden by experts in the Developer Admin panel.
- Dynamic treatment recommendations matched with `inventory` collection.

### 4.4 Marketplace & Supply Chain (`/market`)
- **Forward Contracts:** Pre-harvest lock-in contracts with AI-verified health status.
- **AI Quality Certificate:** Verifiable certificates displaying AI Grade, Defect %, and Optical Scan data.
- **Bid-to-Logistics Workflow:** Complete state machine from bid → accepted → awaiting_logistics → in_transit → delivered.
- **Escrow Settlement:** Atomic transactions for revenue distribution (Seller, Agent, Transporter, Platform).

### 4.5 Kisan Transport Hub (Logistics)
- Uber-style load board for agricultural transport.
- **Platform Transport:** Automated matching with quantity-based pricing.
- Transporters earn 95% of transport fee; 5% platform commission.

### 4.6 Post-Harvest Storage Hub
- **Asset-Light Storage:** Marketplace for cold/dry storage facilities.
- **Digital Warehouse Receipt (DWR):** Generated after warehouse owner confirms deposit.
- **DWR-to-Contract Pledging:** Farmers can pledge stored inventory directly to corporate procurement contracts.
- **Real-time Farmer Ledgers:**
  - **Pending Bookings:** Displays requests from `storage_requests` where status is `pending`.
  - **Active Stored Goods:** Displays actively stored inventory from `digital_receipts` where status is `deposited`, showing storage timelines and total costs.

### 4.7 Smart Inventory & Auto-Sell
- **Price Triggers:** Farmers set target prices in the Digital Vault.
- **Trigger Engine:** Automatically lists crop in marketplace when Mandi price matches target.

### 4.8 Corporate Contracts (`/corporate-contracts`)
- Institutional procurement facilitation.
- **3% Platform Commission** on fulfilled B2B contracts.
- Progressive fulfillment tracking for Village Agents.

### 4.9 Zero-Risk Embedded Finance (Farm Credit)
- Loan origination platform for partner NBFCs.
- **Collateralized Loans:** DWRs used as collateral for lower interest rates (9% vs 12%).
- **1.5% Origination Fee** paid by partner banks (Zero balance sheet risk for KisanMitra).

### 4.10 Digital Khata (`/khata`)
- Premium B2B bookkeeping dashboard.
- Auto-syncs platform sales; allows manual entry for labor/fuel costs.
- Real-time cashflow visualization (Recharts).

### 4.11 Enterprise Agri-Data API Hub
- Monetizing anonymized crop health and inventory data for hedge funds and researchers.
- **Real-Time Analytics Dashboard:** Features a high-fidelity geo-spatial visualizer using `react-simple-maps` and `d3-geo` to plot live disease telemetry fetched from the `cropReports` collection.
- **Data-Driven Insights:** Outbreaks from the last 7 days are plotted on an interactive SVG map of India with coordinates mapped to farmer-reported districts, providing actionable supply-chain intelligence.
- **Enterprise Metrics:** Live-updating terminal-style metrics using monospaced typography and neon-glowing indicators for outbreaks, inventory, and price volatility.
- **API Management:** Secure API Key generation with one-time display and clipboard integration.
- **Visual Design:** Glassmorphism-based containers with `backdrop-blur-xl`, interactive data tooltips, and tactical radar-sweep visual effects.

### 4.12 Soil Testing Service
- Multi-step booking for professional soil analysis.
- Integrated request tracking in `service_requests` collection.

### 4.13 Real-Time Notification Engine
- Global bell icon with unread badges.
- Alerts for DWR issuance, auto-sell execution, and contract milestones.

---

## 5. State Management & Data

### 5.1 Firestore Collections

| Collection | Purpose | Access |
|------------|---------|--------|
| `users/{uid}` | User profile & role | Per-user |
| `listings` | Marketplace crop listings | All authenticated |
| `bids` | Buyer bids on listings | Farmer + Buyer |
| `expert_reviews` | Crop diagnoses for HITL review | Admin |
| `inventory` | Agri-input products | Public read |
| `corporateContracts` | B2B procurement contracts | Buyer + Agent |
| `contractCommits` | Crop commitments to contracts | Per-agent |
| `warehouses` | Storage facility listings | All |
| `digital_receipts` | Confirmed DWRs with pledge status | Per-user |
| `price_triggers` | Auto-sell price triggers | Per-user |
| `notifications` | Real-time user notifications | Per-user |
| `loan_applications` | Farm credit requests | Per-user |
| `service_requests` | Soil testing service requests | Per-user |

### 5.2 Caching Strategy
- Gemini responses: In-memory (TTL: 30m–2h).
- Mandi Prices: NetworkFirst (5m timeout).
- Cart: localStorage per user.

---

## 6. External Integrations

- **Google Gemini AI:** `gemini-3.1-flash-lite` model for all AI features.
- **Mandi Prices API:** Backend proxy fetching from e-NAM fallback.
- **Open-Meteo API:** Free real-time weather forecasting.
- **Web Speech API:** Speech-to-text for bilingual advisory.

---

## 7. Current State & Known Technical Debt

### 7.1 Production Readiness
- ✅ **Frontend:** Vite + Tailwind + PWA (Production Ready).
- ✅ **Backend:** Firebase Auth/Firestore/Functions (Active).
- ✅ **Offline:** Workbox caching + IndexedDB queue (Active).
- ✅ **i18n:** Full English/Hindi support.

### 7.2 Known Technical Debt
| Item | Description | Priority |
|------|-------------|----------|
| **Mock Config Fallback** | `isMockConfig` flag used when Firebase keys are missing | Medium |
| **Soil Moisture Simulation** | Data is simulated; needs IoT integration | Medium |
| **Missing PWA Assets** | High-res icons (192x192, 512x512) need generation | Low |
| **Data Connectors** | Insights page uses partially simulated trends | Medium |

---

*This document is maintained by the development team. Update this file when architecture changes are made per CLAUDE.md instructions.*
