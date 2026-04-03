import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary py-2">
      <SignIn path="/sign-in" routing="path" forceRedirectUrl="/dashboard" fallbackRedirectUrl="/dashboard" />
    </div>
  );
}
