import { redirect } from "next/navigation";
import { getUserSession } from "@/lib/auth/userActions";
import { RegisterForm } from "./RegisterForm";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  // Already signed in — skip signup and go straight to booking a class.
  const session = await getUserSession();
  if (session) redirect("/book/class");

  return <RegisterForm />;
}
