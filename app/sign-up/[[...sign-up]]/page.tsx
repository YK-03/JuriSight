import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary py-2">
      <SignUp path="/sign-up" routing="path" forceRedirectUrl="/dashboard" fallbackRedirectUrl="/dashboard" />
    </div>
  );
}
