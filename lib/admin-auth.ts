export function isAdminAuthed(cookieValue?: string) {
    const token = process.env.ADMIN_AUTH_TOKEN?.trim();
  
    if (!token) return false;
    if (!cookieValue) return false;
  
    return cookieValue === token;
  }