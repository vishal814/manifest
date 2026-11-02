import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser();
  return <AppShell profile={profile}>{children}</AppShell>;
}
