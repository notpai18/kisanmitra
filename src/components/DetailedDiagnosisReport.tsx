import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { CropDiagnosis, CropHealthScore, GrowthStage } from '../lib/geminiClient';
import { useCart } from '../contexts/CartContext';
import {
  Leaf, Sprout, Clock, ChevronRight, Calendar, ShoppingBag,
  UserCheck, ShieldCheck, ShieldAlert, Info, AlertTriangle,
  Stethoscope, Bug, Droplets, Package
} from 'lucide-react';
import { motion } from 'motion/react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

interface DetailedDiagnosisReportProps {
  diagnosis: CropDiagnosis;
  imageUrl?: string;
  expertAdvice?: string;
  isExpanded?: boolean;
  onExpandToggle?: () => void;
  showHeader?: boolean;
}

function CircularProgress({ percentage, color }: { percentage: number; color: string }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      <svg className="transform -rotate-90 w-24 h-24">
        <circle cx="48" cy="48" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-100" />
        <circle
          cx="48" cy="48" r={radius}
          stroke="currentColor" strokeWidth="8" fill="transparent"
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          className={color} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-gray-800">{percentage}%</span>
      </div>
    </div>
  );
}

function HealthScoreGauge({ score, breakdown, language }: { score: number; breakdown: CropHealthScore['breakdown']; language: 'en' | 'hi' }) {
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getColor = (s: number) => {
    if (s >= 80) return 'text-green-500';
    if (s >= 60) return 'text-yellow-500';
    if (s >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const healthLabel = language === 'hi' ? 'स्वास्थ्य स्कोर' : 'Health Score';

  return (
    <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-100">
      <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Leaf className="w-5 h-5 text-green-600" />
        {healthLabel}
      </h3>

      <div className="flex items-center justify-center gap-8">
        <div className="relative">
          <svg className="transform -rotate-90 w-32 h-32">
            <circle cx="64" cy="64" r={radius} stroke="currentColor" strokeWidth="10" fill="transparent" className="text-gray-100" />
            <circle
              cx="64" cy="64" r={radius}
              stroke="currentColor" strokeWidth="10" fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={clsx(getColor(score), 'transition-all duration-1000')}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-gray-800">{score}</span>
            <span className="text-xs text-gray-500">/ 100</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <span className="text-sm text-gray-600">Disease: {breakdown.disease}%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-400" />
            <span className="text-sm text-gray-600">Pest: {breakdown.pest}%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-400" />
            <span className="text-sm text-gray-600">Nutrient: {breakdown.nutrient}%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-cyan-400" />
            <span className="text-sm text-gray-600">Water: {breakdown.water}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function GrowthStageCard({ stage }: { stage: GrowthStage }) {
  const stageLabels = {
    seedling: { en: 'Seedling', hi: 'पौध' },
    vegetative: { en: 'Vegetative', hi: 'वानस्पतिक' },
    flowering: { en: 'Flowering', hi: 'फूल आना' },
    fruiting: { en: 'Fruiting', hi: 'फल लगना' },
    harvest: { en: 'Harvest Ready', hi: 'कटाई के लिए तैयार' },
  };

  const healthColors = {
    excellent: 'bg-green-100 text-green-800',
    good: 'bg-blue-100 text-blue-800',
    fair: 'bg-yellow-100 text-yellow-800',
    poor: 'bg-red-100 text-red-800',
  };

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-5 border border-green-100">
      <div className="flex items-center gap-3 mb-3">
        <Sprout className="w-6 h-6 text-green-600" />
        <h3 className="font-bold text-gray-900">
          {stageLabels[stage.current]?.hi || stageLabels[stage.current]?.en}
        </h3>
      </div>
      <div className="flex items-center justify-between">
        <span className={clsx('px-3 py-1 rounded-full text-sm font-bold', healthColors[stage.health])}>
          {stage.health.charAt(0).toUpperCase() + stage.health.slice(1)}
        </span>
        {stage.daysToNextStage && (
          <span className="text-sm text-gray-500">
            {stage.daysToNextStage} days to next stage
          </span>
        )}
      </div>
    </div>
  );
}

function TreatmentSchedule({ schedule }: { schedule: CropDiagnosis['treatmentSchedule'] }) {
  if (!schedule) return null;

  const days = [
    { key: 'day1', label: 'Day 1', icon: Calendar, color: 'bg-red-500' },
    { key: 'day7', label: 'Day 7', icon: Calendar, color: 'bg-yellow-500' },
    { key: 'day14', label: 'Day 14', icon: Calendar, color: 'bg-green-500' },
  ];

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100">
      <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-forest-600" />
        Treatment Schedule
      </h3>
      <div className="grid md:grid-cols-3 gap-4">
        {days.map((day) => {
          const actions = schedule[day.key as keyof typeof schedule] || [];
          return (
            <div key={day.key} className="relative">
              <div className={clsx('absolute -top-3 left-4 px-3 py-1 rounded-full text-white text-xs font-bold z-10', day.color)}>
                {day.label}
              </div>
              <div className="bg-gray-50 rounded-xl p-4 pt-6">
                <ul className="space-y-2">
                  {actions.map((action, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm">
                      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                      <span className="text-gray-700">{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TreatmentOptionCard({ type, option }: { type: 'organic' | 'chemical'; option: CropDiagnosis['treatmentOptions'] extends { organic: infer O } ? O : any }) {
  if (!option) return null;

  return (
    <div className={clsx(
      'rounded-xl p-5 border',
      type === 'organic' ? 'bg-green-50 border-green-100' : 'bg-blue-50 border-blue-100'
    )}>
      <div className="flex items-center justify-between mb-3">
        <h4 className={clsx(
          'font-bold',
          type === 'organic' ? 'text-green-800' : 'text-blue-800'
        )}>
          {type === 'organic' ? '🌿 Organic' : '⚗️ Chemical'}
        </h4>
        <span className={clsx(
          'text-sm font-medium px-2 py-1 rounded',
          type === 'organic' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
        )}>
          {option.costEstimate}
        </span>
      </div>
      <ul className="space-y-1.5 mb-4">
        {option.steps?.slice(0, 3).map((step: string, i: number) => (
          <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
            <span className="text-gray-400">{i + 1}.</span>
            {step}
          </li>
        ))}
      </ul>
      {option.products && (
        <div className="border-t border-gray-200 pt-3">
          <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
            <ShoppingBag className="w-3 h-3" />
            Products needed:
          </p>
          <div className="flex flex-wrap gap-2">
            {option.products.map((p: any, i: number) => (
              <span key={i} className={clsx(
                'text-xs px-2 py-1 rounded-full',
                type === 'organic' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
              )}>
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DetailedDiagnosisReport({
  diagnosis,
  imageUrl,
  expertAdvice,
  isExpanded = true,
  onExpandToggle,
  showHeader = true
}: DetailedDiagnosisReportProps) {
  const { language } = useLanguage();
  const { addToCart } = useCart();
  const [activeTab, setActiveTab] = React.useState<'diagnosis' | 'cause' | 'treatment' | 'prevention' | 'pests' | 'nutrients'>('diagnosis');
  const [treatmentView, setTreatmentView] = React.useState<'organic' | 'chemical'>('organic');

  const handleBuyNow = (product: any) => {
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      category: product.category,
    });
    toast.success(language === 'hi'
      ? `${product.name} कार्ट में जोड़ा गया`
      : `${product.name} added to cart`);
  };

  const getMockProducts = () => [
    { id: '1', name: 'Urea Fertilizer 46% N', price: 300, unit: 'bag', category: 'fertilizer' },
    { id: '4', name: 'Carbendazim 50% WP', price: 320, unit: 'kg', category: 'pesticide' },
    { id: '5', name: 'Neem Oil 10,000 PPM', price: 280, unit: 'liter', category: 'organic' },
  ];

  const hasProducts = diagnosis.suggested_inventory_tags && diagnosis.suggested_inventory_tags.length > 0;
  const products = hasProducts ? getMockProducts() : [];

  return (
    <div className="space-y-0">
      {/* EXPERT ADVICE OVERRIDE - Premium Card at Top */}
      {expertAdvice && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 rounded-2xl p-5 border-2 border-emerald-200 mb-6"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
              <UserCheck className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h4 className="font-bold text-emerald-800 text-lg">
                {language === 'hi' ? 'कृषि विशेषज्ञ की सलाह' : 'Expert Advice'}
              </h4>
              <p className="text-xs text-emerald-600">
                {language === 'hi' ? 'प्रमाणित कृषि वैज्ञानिक द्वारा समीक्षित' : 'Reviewed by certified agronomist'}
              </p>
            </div>
          </div>
          <p className="text-slate-800 text-base leading-relaxed font-medium pl-13">
            {expertAdvice}
          </p>
        </motion.div>
      )}

      {/* Header Section */}
      {showHeader && (
        <div className={clsx(
          "p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 border-b rounded-t-2xl",
          diagnosis.is_healthy ? "bg-green-50/50 border-green-100" : "bg-red-50/50 border-red-100"
        )}>
          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
              {diagnosis.is_healthy ? <ShieldCheck className="w-8 h-8 text-green-600" /> : <ShieldAlert className="w-8 h-8 text-red-600" />}
              <h2 className={clsx(
                "text-2xl font-bold",
                diagnosis.is_healthy ? "text-green-700" : "text-red-700"
              )}>
                {language === 'hi' ? 'AI निदान' : 'AI Diagnosis'}
              </h2>
            </div>

            {!diagnosis.is_healthy && (
              <div className="flex items-center justify-center md:justify-start gap-4 mt-3">
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 font-medium">Diagnosis:</span>
                  <span className="text-gray-900 font-bold">{diagnosis.disease_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 font-medium">Severity:</span>
                  <span className={clsx(
                    "px-3 py-1 rounded-full text-sm font-bold",
                    diagnosis.severity === 'Low' ? "bg-yellow-100 text-yellow-800" :
                      diagnosis.severity === 'Medium' ? "bg-orange-100 text-orange-800" :
                        "bg-red-100 text-red-800"
                  )}>
                    {diagnosis.severity}
                  </span>
                </div>
              </div>
            )}
          </div>

          <CircularProgress
            percentage={diagnosis.confidence_percent}
            color={diagnosis.is_healthy ? "text-green-500" : "text-red-500"}
          />
        </div>
      )}

      {/* Health Score & Growth Stage Cards */}
      <div className="grid md:grid-cols-2 gap-4 p-6 md:p-8 bg-gray-50/50 border-x border-b">
        <HealthScoreGauge
          score={diagnosis.healthScore?.overall ?? (diagnosis.is_healthy ? 95 : 50)}
          breakdown={diagnosis.healthScore?.breakdown ?? { disease: 0, pest: 0, nutrient: 0, water: 0 }}
          language={language}
        />
        <GrowthStageCard stage={diagnosis.growthStage ?? { current: 'vegetative', health: 'good' }} />
      </div>

      {/* Tabs */}
      <div className="p-6 md:p-8">
        <div className="flex flex-wrap gap-2 mb-6">
          {(['diagnosis', 'cause', 'treatment', 'prevention', 'pests', 'nutrients'] as const).map((tab) => {
            const tabLabels: Record<string, { en: string; hi: string }> = {
              diagnosis: { en: 'Diagnosis', hi: 'निदान' },
              cause: { en: 'Cause', hi: 'कारण' },
              treatment: { en: 'Treatment', hi: 'उपचार' },
              prevention: { en: 'Prevention', hi: 'रोकथाम' },
              pests: { en: 'Pests', hi: 'कीट' },
              nutrients: { en: 'Nutrients', hi: 'पोषण' },
            };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={clsx(
                  "px-5 py-2.5 rounded-full text-sm font-bold transition-colors",
                  activeTab === tab
                    ? "bg-forest-900 text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {tabLabels[tab]?.[language as 'en' | 'hi'] || tab}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 min-h-[200px]">
          {activeTab === 'diagnosis' && (
            <div className="space-y-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Info className="w-5 h-5 text-forest-600" /> Diagnosis
              </h3>
              <p className="text-gray-700 leading-relaxed">
                {diagnosis.is_healthy
                  ? (language === 'hi' ? 'आपकी फसल स्वस्थ है। कोई बीमारी या कीट नहीं पाया गया।' : 'Your crop appears healthy. No diseases or pests detected.')
                  : (language === 'hi'
                    ? `AI ने ${diagnosis.disease_name} का पता लगाया है। ${diagnosis.confidence_percent}% विश्वास के साथ ${diagnosis.severity} गंभीरता।`
                    : `The AI has detected signs of ${diagnosis.disease_name} with ${diagnosis.confidence_percent}% confidence and ${diagnosis.severity} severity.`
                  )}
              </p>
              {diagnosis.healthScore?.factors && diagnosis.healthScore.factors.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-600 mb-2">Key factors:</p>
                  <div className="flex flex-wrap gap-2">
                    {diagnosis.healthScore.factors.map((f, i) => (
                      <span key={i} className="text-xs bg-white px-3 py-1 rounded-full border border-gray-200 text-gray-600">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {diagnosis.waterStress && diagnosis.waterStress !== 'none' && (
                <div className={clsx(
                  'mt-4 p-3 rounded-lg flex items-center gap-2',
                  diagnosis.waterStress === 'over' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                )}>
                  <Droplets className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    {language === 'hi'
                      ? (diagnosis.waterStress === 'over' ? 'अधिक पानी का तनाव' : 'पानी की कमी')
                      : (diagnosis.waterStress === 'over' ? 'Over-watering detected' : 'Under-watering detected')
                    }
                  </span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'cause' && (
            <div className="space-y-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600" /> Cause
              </h3>
              <p className="text-gray-700 leading-relaxed">{diagnosis.cause}</p>
            </div>
          )}

          {activeTab === 'treatment' && (
            <div className="space-y-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-blue-600" /> Treatment
              </h3>

              {diagnosis.treatmentOptions && (
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setTreatmentView('organic')}
                    className={clsx(
                      'px-4 py-2 rounded-lg text-sm font-bold transition-colors',
                      treatmentView === 'organic'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    🌿 Organic
                  </button>
                  <button
                    onClick={() => setTreatmentView('chemical')}
                    className={clsx(
                      'px-4 py-2 rounded-lg text-sm font-bold transition-colors',
                      treatmentView === 'chemical'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    ⚗️ Chemical
                  </button>
                </div>
              )}

              {diagnosis.treatmentOptions ? (
                <div className="mb-6">
                  <TreatmentOptionCard
                    type={treatmentView}
                    option={treatmentView === 'organic' ? diagnosis.treatmentOptions.organic : diagnosis.treatmentOptions.chemical}
                  />
                </div>
              ) : (
                <ul className="space-y-3">
                  {diagnosis.treatment_steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 text-sm font-bold mt-0.5">{i + 1}</div>
                      <span className="text-gray-700">{step}</span>
                    </li>
                  ))}
                </ul>
              )}

              {diagnosis.treatmentSchedule && (
                <div className="mt-6">
                  <TreatmentSchedule schedule={diagnosis.treatmentSchedule} />
                </div>
              )}
            </div>
          )}

          {activeTab === 'prevention' && (
            <div className="space-y-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-green-600" /> Prevention
              </h3>
              <ul className="space-y-3">
                {diagnosis.prevention_tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-gray-700">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {activeTab === 'pests' && (
            <div className="space-y-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Bug className="w-5 h-5 text-orange-600" /> Pest Detection
              </h3>
              {diagnosis.pestDetection && diagnosis.pestDetection.length > 0 ? (
                <div className="space-y-3">
                  {diagnosis.pestDetection.map((pest, i) => (
                    <div key={i} className="bg-orange-50 rounded-xl p-4 border border-orange-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-orange-800">{pest.name}</span>
                        <span className={clsx(
                          'text-xs font-bold px-2 py-1 rounded-full',
                          pest.severity === 'Low' ? 'bg-yellow-100 text-yellow-800' :
                            pest.severity === 'Medium' ? 'bg-orange-100 text-orange-800' :
                              'bg-red-100 text-red-800'
                        )}>
                          {pest.severity}
                        </span>
                      </div>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {pest.treatment.map((t, j) => (
                          <li key={j}>• {t}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Bug className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p>No pests detected</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'nutrients' && (
            <div className="space-y-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Leaf className="w-5 h-5 text-emerald-600" /> Nutrient Deficiency
              </h3>
              {diagnosis.nutrientDeficiency && diagnosis.nutrientDeficiency.length > 0 ? (
                <div className="space-y-3">
                  {diagnosis.nutrientDeficiency.map((def, i) => (
                    <div key={i} className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-emerald-800">{def.element}</span>
                        <span className={clsx(
                          'text-xs font-bold px-2 py-1 rounded-full',
                          def.severity === 'Mild' ? 'bg-yellow-100 text-yellow-800' :
                            def.severity === 'Moderate' ? 'bg-orange-100 text-orange-800' :
                              'bg-red-100 text-red-800'
                        )}>
                          {def.severity}
                        </span>
                      </div>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {def.symptoms.map((s, j) => (
                          <li key={j}>• {s}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Leaf className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p>No nutrient deficiencies detected</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}