import { redirect } from "next/navigation";
import { hasSupabaseConfig } from "@/lib/config";
export default function Home() { redirect(hasSupabaseConfig() ? "/shipments" : "/setup"); }
