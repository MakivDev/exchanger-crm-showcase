import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { firstAllowedPath } from "@/lib/auth/access";

export default async function AppIndexPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  redirect(firstAllowedPath(user));
}
