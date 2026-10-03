import { LoginForm } from "@/components/auth/LoginForm";
import { SetupWizard } from "@/components/setup/SetupWizard";
import { getSessionUser } from "@/lib/auth/session";
import { ensurePermissionsCatalog } from "@/lib/auth/ensure-permissions";
import { getSetupProgress, ensureSetupCurrencies } from "@/lib/setup";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  await ensurePermissionsCatalog();
  await ensureSetupCurrencies();

  const progress = await getSetupProgress();
  if (progress.required) {
    return (
      <div className="flex min-h-[100dvh] items-start justify-center bg-bg px-4 py-10 sm:items-center">
        <SetupWizard
          initialStep={progress.initialStep}
          completedSteps={progress.completedSteps}
        />
      </div>
    );
  }

  const user = await getSessionUser();
  if (user) redirect("/work/journal");

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-bg px-4">
      <div className="ui-panel w-full max-w-sm p-6">
        <h1 className="text-[18px] font-semibold tracking-tight text-text">
          Вхід
        </h1>
        <p className="mt-1 text-[13px] text-text-muted">
          Операційна CRM обмінника · облік до USD
        </p>
        <div className="mt-5">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
