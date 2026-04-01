import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/admin-auth";
import AdminLoginClient from "./AdminLoginClient";

export default async function AdminLoginPage() {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("admin_auth")?.value;

  if (isAdminAuthed(adminCookie)) {
    redirect("/admin/upload");
  }

  return <AdminLoginClient />;
}