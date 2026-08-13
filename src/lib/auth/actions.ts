"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "./session";
import { verifyAdminCredentials } from "./verify";

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const user = await verifyAdminCredentials(email, password);
  if (!user) {
    return { error: "Invalid email or password." };
  }

  const token = await createSessionToken(user);
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  // Throws NEXT_REDIRECT — must be outside any try/catch.
  redirect("/admin/registrations");
}

export async function logoutAction() {
  cookies().delete(SESSION_COOKIE);
  redirect("/admin/login");
}
