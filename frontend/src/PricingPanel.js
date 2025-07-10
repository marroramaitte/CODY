import React, { useState } from 'react';

const PricingPanel = ({ onClose }) => {
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' or 'yearly'
  const [selectedPlan, setSelectedPlan] = useState('pro');

  const plans = {
    monthly: {
      free: {
        name: 'Free',
        price: 0,
        period: 'Gratis para siempre',
        description: 'Perfecto para comenzar con desarrollo básico',
        features: [
          '5 sesiones de chat por día',
          '1 agente conversacional',
          'Proyectos básicos',
          'Soporte por email',
          'Editor de código estándar'
        ],
        limitations: [
          'Sin acceso a agentes avanzados',
          'Sin desarrollo en tiempo real',
          'Sin integración de IA premium'
        ],
        buttonText: 'Comenzar Gratis',
        buttonStyle: 'bg-gray-600 hover:bg-gray-700',
        popular: false
      },
      pro: {
        name: 'Pro',
        price: 15,
        period: 'por mes',
        description: 'Para desarrolladores profesionales y equipos pequeños',
        features: [
          'Chat ilimitado con todos los agentes',
          '5 agentes conversacionales especializados',
          'Desarrollo en tiempo real ultra-rápido',
          'Generación de código con IA',
          'Debugging avanzado',
          'Revisión automática de código',
          'Documentación inteligente',
          'Optimización de rendimiento',
          'Soporte prioritario',
          'Historial de proyectos ilimitado'
        ],
        limitations: [],
        buttonText: 'Comenzar Prueba Gratis',
        buttonStyle: 'bg-blue-600 hover:bg-blue-700',
        popular: true
      },
      enterprise: {
        name: 'Enterprise',
        price: 50,
        period: 'por mes',
        description: 'Para equipos grandes y empresas que necesitan máximo control',
        features: [
          'Todo lo incluido en Pro',
          'API keys personalizadas',
          'Modelos de IA premium (GPT-4, Claude Opus)',
          'Integraciones personalizadas',
          'SSO y autenticación empresarial',
          'Análisis y métricas avanzadas',
          'Soporte 24/7 dedicado',
          'Entrenamiento y onboarding',
          'SLA garantizado (99.9% uptime)',
          'Backup y recuperación automática',
          'Compliance SOC2 y GDPR',
          'Usuarios ilimitados'
        ],
        limitations: [],
        buttonText: 'Contactar Ventas',
        buttonStyle: 'bg-purple-600 hover:bg-purple-700',
        popular: false
      }
    },
    yearly: {
      free: {
        name: 'Free',
        price: 0,
        period: 'Gratis para siempre',
        description: 'Perfecto para comenzar con desarrollo básico',
        features: [
          '5 sesiones de chat por día',
          '1 agente conversacional',
          'Proyectos básicos',
          'Soporte por email',
          'Editor de código estándar'
        ],
        limitations: [
          'Sin acceso a agentes avanzados',
          'Sin desarrollo en tiempo real',
          'Sin integración de IA premium'
        ],
        buttonText: 'Comenzar Gratis',
        buttonStyle: 'bg-gray-600 hover:bg-gray-700',
        popular: false
      },
      pro: {
        name: 'Pro',
        price: 12,
        originalPrice: 15,
        period: 'por mes (facturado anualmente)',
        yearlyTotal: 144,
        description: 'Para desarrolladores profesionales y equipos pequeños',
        features: [
          'Chat ilimitado con todos los agentes',
          '5 agentes conversacionales especializados',
          'Desarrollo en tiempo real ultra-rápido',
          'Generación de código con IA',
          'Debugging avanzado',
          'Revisión automática de código',
          'Documentación inteligente',
          'Optimización de rendimiento',
          'Soporte prioritario',
          'Historial de proyectos ilimitado'
        ],
        limitations: [],
        buttonText: 'Comenzar Prueba Gratis',
        buttonStyle: 'bg-blue-600 hover:bg-blue-700',
        popular: true,
        savings: '20% de descuento'
      },
      enterprise: {
        name: 'Enterprise',
        price: 40,
        originalPrice: 50,
        period: 'por mes (facturado anualmente)',
        yearlyTotal: 480,
        description: 'Para equipos grandes y empresas que necesitan máximo control',
        features: [
          'Todo lo incluido en Pro',
          'API keys personalizadas',
          'Modelos de IA premium (GPT-4, Claude Opus)',
          'Integraciones personalizadas',
          'SSO y autenticación empresarial',
          'Análisis y métricas avanzadas',
          'Soporte 24/7 dedicado',
          'Entrenamiento y onboarding',
          'SLA garantizado (99.9% uptime)',
          'Backup y recuperación automática',
          'Compliance SOC2 y GDPR',
          'Usuarios ilimitados'
        ],
        limitations: [],
        buttonText: 'Contactar Ventas',
        buttonStyle: 'bg-purple-600 hover:bg-purple-700',
        popular: false,
        savings: '20% de descuento'
      }
    }
  };

  const currentPlans = plans[billingCycle];

  const handlePlanSelect = (planKey) => {
    setSelectedPlan(planKey);
    // Aquí puedes agregar lógica para manejar la selección del plan
    console.log(`Plan seleccionado: ${planKey}`, currentPlans[planKey]);
  };

  const formatPrice = (price) => {
    if (price === 0) return 'Gratis';
    return `$${price}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-gray-900 rounded-lg w-[90%] max-w-7xl my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gray-800 p-6 rounded-t-lg flex items-center justify-between border-b border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              💎 Planes y Precios
            </h2>
            <p className="text-gray-300">
              Elige el plan perfecto para tus necesidades de desarrollo
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-3xl"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {/* Billing Toggle */}
          <div className="flex justify-center mb-8">
            <div className="bg-gray-800 p-1 rounded-lg">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                  billingCycle === 'monthly'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Mensual
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-6 py-2 rounded-md text-sm font-medium transition-colors relative ${
                  billingCycle === 'yearly'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Anual
                <span className="absolute -top-1 -right-1 bg-green-500 text-xs px-1 rounded text-white">
                  -20%
                </span>
              </button>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(currentPlans).map(([planKey, plan]) => (
              <div
                key={planKey}
                className={`relative bg-gray-800 rounded-lg p-6 border-2 transition-all duration-200 hover:shadow-lg ${
                  plan.popular
                    ? 'border-blue-500 shadow-blue-500/20'
                    : selectedPlan === planKey
                    ? 'border-gray-500'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                      ⭐ Más Popular
                    </span>
                  </div>
                )}

                {/* Savings Badge */}
                {plan.savings && (
                  <div className="absolute -top-2 -right-2">
                    <span className="bg-green-500 text-white px-2 py-1 rounded-md text-xs font-medium">
                      {plan.savings}
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                  <div className="mb-2">
                    <span className="text-4xl font-bold text-white">
                      {formatPrice(plan.price)}
                    </span>
                    {plan.originalPrice && billingCycle === 'yearly' && (
                      <span className="text-lg text-gray-400 line-through ml-2">
                        ${plan.originalPrice}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm">{plan.period}</p>
                  {plan.yearlyTotal && (
                    <p className="text-green-400 text-sm">
                      ${plan.yearlyTotal}/año - Ahorra ${(plan.originalPrice - plan.price) * 12}
                    </p>
                  )}
                  <p className="text-gray-300 text-sm mt-2">{plan.description}</p>
                </div>

                {/* Features */}
                <div className="mb-6">
                  <h4 className="text-white font-semibold mb-3">✨ Características incluidas:</h4>
                  <ul className="space-y-2">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start text-sm text-gray-300">
                        <span className="text-green-400 mr-2 mt-0.5">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Limitations */}
                {plan.limitations.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-white font-semibold mb-3">⚠️ Limitaciones:</h4>
                    <ul className="space-y-2">
                      {plan.limitations.map((limitation, index) => (
                        <li key={index} className="flex items-start text-sm text-gray-400">
                          <span className="text-red-400 mr-2 mt-0.5">✗</span>
                          {limitation}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* CTA Button */}
                <button
                  onClick={() => handlePlanSelect(planKey)}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${plan.buttonStyle} text-white`}
                >
                  {plan.buttonText}
                </button>

                {planKey === 'pro' && (
                  <p className="text-center text-xs text-gray-400 mt-2">
                    14 días de prueba gratuita - Sin tarjeta de crédito
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* FAQ Section */}
          <div className="mt-12 bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-bold text-white mb-6 text-center">
              🤔 Preguntas Frecuentes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-white mb-2">
                  ¿Puedo cambiar de plan en cualquier momento?
                </h4>
                <p className="text-gray-300 text-sm">
                  Sí, puedes actualizar o degradar tu plan en cualquier momento. Los cambios se aplican inmediatamente.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-2">
                  ¿Qué incluye la prueba gratuita?
                </h4>
                <p className="text-gray-300 text-sm">
                  14 días completos con acceso a todas las funciones Pro, sin necesidad de tarjeta de crédito.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-2">
                  ¿Los precios incluyen impuestos?
                </h4>
                <p className="text-gray-300 text-sm">
                  Los precios mostrados no incluyen impuestos locales, que se calcularán al momento del pago.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-2">
                  ¿Hay descuentos para estudiantes?
                </h4>
                <p className="text-gray-300 text-sm">
                  Sí, ofrecemos 50% de descuento para estudiantes verificados. Contáctanos para más información.
                </p>
              </div>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="mt-8 text-center">
            <p className="text-gray-400 text-sm mb-4">
              Confiado por más de 10,000 desarrolladores en todo el mundo
            </p>
            <div className="flex justify-center space-x-8 items-center">
              <div className="flex items-center space-x-2">
                <span className="text-green-400">🔒</span>
                <span className="text-sm text-gray-300">Pagos seguros</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-blue-400">💳</span>
                <span className="text-sm text-gray-300">Sin compromisos</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-purple-400">🚀</span>
                <span className="text-sm text-gray-300">Configuración instantánea</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPanel;