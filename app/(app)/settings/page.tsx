import { requireUser } from "@/lib/auth/session";
import { GeneralSettingsForm } from "@/components/settings/GeneralSettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsGeneralPage() {
  const user = await requireUser();
  return <GeneralSettingsForm login={user.login} name={user.name} />;
}
