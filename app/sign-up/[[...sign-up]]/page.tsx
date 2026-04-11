import { SignUp } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function SignUpPage() {
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary py-2">
      <SignUp path="/sign-up" routing="path" forceRedirectUrl="/dashboard" fallbackRedirectUrl="/dashboard" />
    </div>
  );
}
