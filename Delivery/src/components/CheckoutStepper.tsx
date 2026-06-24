import { Fragment } from 'react';
import { Check, CheckCircle2, CreditCard, MapPin } from 'lucide-react';

interface CheckoutStepperProps {
  currentStep: 1 | 2 | 3;
}

const steps = [
  { id: 1, label: 'Endereço', icon: MapPin },
  { id: 2, label: 'Pagamento', icon: CreditCard },
  { id: 3, label: 'Confirmação', icon: CheckCircle2 },
] as const;

export default function CheckoutStepper({ currentStep }: CheckoutStepperProps) {
  return (
    <div className="checkout-stepper rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="flex items-start">
        {steps.map((step, index) => {
          const isComplete = currentStep > step.id;
          const isActive = currentStep === step.id;
          const Icon = step.icon;

          return (
            <Fragment key={step.id}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-center">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                      isComplete
                        ? 'border-emerald-500 bg-emerald-950 text-emerald-300'
                        : isActive
                          ? 'border-orange-500 bg-orange-950/40 text-orange-300'
                          : 'border-neutral-700 bg-neutral-950 text-neutral-500'
                    }`}
                  >
                    {isComplete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                </div>
                <p
                  className={`mt-2 text-center text-[10px] font-semibold whitespace-nowrap ${
                    isActive ? 'text-white' : isComplete ? 'text-emerald-300' : 'text-neutral-500'
                  }`}
                >
                  {step.label}
                </p>
              </div>

              {index < steps.length - 1 && (
                <div className="flex flex-1 items-start px-2 pt-5">
                  <div
                    className={`h-px w-full ${currentStep > step.id ? 'bg-emerald-500/60' : 'bg-neutral-800'}`}
                  />
                </div>
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
