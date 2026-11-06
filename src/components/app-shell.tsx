import Link from "next/link";
import { Boxes, CircleHelp, LogOut, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { signOut } from "@/app/login/actions";
import type { Profile } from "@/lib/types";

export function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  return <div className="app-shell"><aside className="sidebar"><Link href="/shipments" aria-label="Manifest shipments"><Brand/></Link><div className="workspace-label"><span className="workspace-avatar">A</span><div><strong>Company A</strong><span>Nhava Sheva · Import operations</span></div></div><span className="nav-caption">WORKSPACE</span><nav><Link href="/shipments" className="nav-link active"><Boxes size={19}/>Shipments</Link>{profile.role === "manager" && <Link href="/reports" className="nav-link"><ShieldCheck size={19}/>Accuracy report</Link>}</nav><div className="sidebar-bottom"><div className="private-note"><ShieldCheck size={19}/><span>Private workspace<br/><small>Access is role controlled</small></span></div><Link href="/guide" className="nav-link"><CircleHelp size={18}/>Workspace guide</Link><div className="user-row"><span className="user-avatar">{profile.display_name.slice(0, 1).toUpperCase()}</span><div><strong>{profile.display_name}</strong><span>{profile.role}</span></div><form action={signOut}><button className="icon-button" aria-label="Sign out"><LogOut size={17}/></button></form></div></div></aside><div className="main-column"><header className="app-header"><span className="breadcrumb">Workspace <span>/</span> Import documentation</span><span className="phase-pill">DOCUMENT WORKSPACE</span></header><main className="workspace-content">{children}</main></div></div>;
}
