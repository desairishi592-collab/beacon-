import { LoginForm } from './login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; invite?: string; email?: string }>
}) {
  const params = await searchParams

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Beacon</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Risk monitoring for managers
          </p>
        </div>
        <LoginForm initialError={params.error} inviteId={params.invite} inviteEmail={params.email} />
      </div>
    </div>
  )
}
