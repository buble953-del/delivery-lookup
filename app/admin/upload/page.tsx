import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/admin-auth";
import AdminUploadClient from "./AdminUploadClient";

export default async function AdminUploadPage() {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("admin_auth")?.value;

  if (!isAdminAuthed(adminCookie)) {
    redirect("/admin/login");
  }

  return <AdminUploadClient />;
}