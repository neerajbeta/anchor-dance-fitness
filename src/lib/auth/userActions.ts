"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { USER_SESSION_COOKIE, verifySessionToken } from "./session";

export async function getUserSession() {
  const token = cookies().get(USER_SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

export async function logoutUserAction() {
  cookies().delete(USER_SESSION_COOKIE);
  redirect("/login");
}
