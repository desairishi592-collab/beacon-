import { OnboardingWizard } from './onboarding-wizard'

export default function OnboardingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome to Beacon</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            A few quick questions before you get started.
          </p>
        </div>
        <OnboardingWizard />
      </div>
    </div>
  )
}
