import { CaseForm } from "../../../../components/app/CaseForm";

export default function NewCasePage() {
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl">New Case</h1>
      <CaseForm />
    </div>
  );
}