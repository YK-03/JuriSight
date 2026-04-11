"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DocumentUploader, { type ExtractedDocumentData } from "@/components/app/DocumentUploader";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const schema = z.object({
  title: z.string().min(2),
  accusedName: z.string().min(2),
  section: z.string().min(1),
  offenseType: z.string().min(2),
  accusedProfile: z.enum(["First-time offender", "Repeat offender", "Juvenile"]),
  priorRecord: z.enum(["yes", "no"]),
  offenseDescription: z.string().min(10),
  cooperationLevel: z.enum(["High", "Medium", "Low"]),
  jurisdiction: z.string().min(2),
  legalFramework: z.enum(["CrPC", "BNSS 2023", "IPC + BNS 2023", "Special Act"]),
  specialAct: z.string().optional(),
  dateOfArrest: z.string().optional(),
  maximumSentenceYears: z.string().optional(),
  timeServedDays: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function CaseForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isAutoFilled, setIsAutoFilled] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      accusedName: "",
      section: "437",
      offenseType: "",
      accusedProfile: "First-time offender",
      priorRecord: "no",
      offenseDescription: "",
      cooperationLevel: "Medium",
      jurisdiction: "",
      legalFramework: "CrPC",
      specialAct: "",
      dateOfArrest: "",
      maximumSentenceYears: "",
      timeServedDays: "",
    },
  });

  const legalFramework = form.watch("legalFramework");

  const handleExtracted = (data: ExtractedDocumentData) => {
    const jurisdictionParts = [data.policeStation, data.district, data.state].filter(Boolean);
    const title = data.title || data.firNumber;
    const descriptionParts = [data.allegations, data.notes].filter(Boolean);
    const servedMatch = data.custodyDuration.match(/(\d+)/);

    const values: Partial<FormValues> = {
      title: title || form.getValues("title"),
      accusedName: data.accusedName || form.getValues("accusedName"),
      section: data.sections || form.getValues("section"),
      offenseType: data.sections ? `Alleged offenses under ${data.sections}` : form.getValues("offenseType"),
      offenseDescription: descriptionParts.join("\n\n") || form.getValues("offenseDescription"),
      priorRecord: data.previousConvictions ? "yes" : "no",
      jurisdiction: jurisdictionParts.join(", ") || form.getValues("jurisdiction"),
      dateOfArrest: data.arrestDate ? data.arrestDate.slice(0, 10) : form.getValues("dateOfArrest"),
      timeServedDays: servedMatch?.[1] ?? form.getValues("timeServedDays"),
    };

    for (const [key, value] of Object.entries(values) as Array<[keyof FormValues, string]>) {
      form.setValue(key, value, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    }

    setIsAutoFilled(true);
    setError(null);
  };

  const onSubmit = (values: FormValues) => {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          priorRecord: values.priorRecord === "yes",
          dateOfArrest: values.dateOfArrest ? new Date(values.dateOfArrest).toISOString() : undefined,
          maximumSentenceYears: values.maximumSentenceYears ? Number(values.maximumSentenceYears) : undefined,
          timeServedDays: values.timeServedDays ? Number(values.timeServedDays) : undefined,
          specialAct: values.legalFramework === "Special Act" ? values.specialAct : undefined,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Failed to create case");
        return;
      }

      const data = (await res.json()) as { id: string };
      router.push(`/cases/${data.id}` as Route);
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Case</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <DocumentUploader onExtracted={handleExtracted} />
          {isAutoFilled ? (
            <div className="rounded-md border border-state-warning/30 bg-state-warning/10 px-4 py-3 text-sm text-state-warning">
              Form auto-filled from document — please review before submitting
            </div>
          ) : null}
          <div className="grid gap-2">
            <label className="text-sm text-text-secondary">Case Title</label>
            <Input {...form.register("title")} />
          </div>
          <div className="grid gap-2">
            <label className="text-sm text-text-secondary">Accused Name</label>
            <Input {...form.register("accusedName")} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm text-text-secondary">CrPC Section</label>
              <Input {...form.register("section")} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm text-text-secondary">Offense Type</label>
              <Input {...form.register("offenseType")} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm text-text-secondary">Legal Framework</label>
              <Select {...form.register("legalFramework")}>
                <option>CrPC</option>
                <option>BNSS 2023</option>
                <option>IPC + BNS 2023</option>
                <option>Special Act</option>
              </Select>
            </div>
            {legalFramework === "Special Act" ? (
              <div className="grid gap-2">
                <label className="text-sm text-text-secondary">Special Act (if applicable)</label>
                <Select {...form.register("specialAct")}>
                  <option value="">Select one</option>
                  <option>SC/ST (Prevention of Atrocities) Act</option>
                  <option>POCSO Act</option>
                  <option>NDPS Act</option>
                  <option>Prevention of Corruption Act</option>
                  <option>IT Act (Cybercrime)</option>
                  <option>UAPA</option>
                  <option>Other</option>
                </Select>
              </div>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm text-text-secondary">Accused Profile</label>
              <Select {...form.register("accusedProfile")}>
                <option>First-time offender</option>
                <option>Repeat offender</option>
                <option>Juvenile</option>
              </Select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm text-text-secondary">Prior Record</label>
              <Select {...form.register("priorRecord")}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <label className="text-sm text-text-secondary">Offense Description</label>
            <Textarea rows={5} {...form.register("offenseDescription")} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm text-text-secondary">Cooperation Level</label>
              <Select {...form.register("cooperationLevel")}>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </Select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm text-text-secondary">Jurisdiction</label>
              <Input {...form.register("jurisdiction")} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <label className="text-sm text-text-secondary">Date of Arrest</label>
              <Input type="date" {...form.register("dateOfArrest")} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm text-text-secondary">Maximum Sentence (years)</label>
              <Input type="number" placeholder="Maximum sentence for the offense" {...form.register("maximumSentenceYears")} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm text-text-secondary">Time Already Served (days)</label>
              <Input type="number" {...form.register("timeServedDays")} />
            </div>
          </div>
          {error ? <p className="text-sm text-state-error">{error}</p> : null}
          <Button type="submit" disabled={isPending}>{isPending ? "Creating..." : "Create Case"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
