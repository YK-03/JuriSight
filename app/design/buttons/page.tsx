import { Button } from "@/components/ui/button";

export default function ButtonShowcase() {
  return (
    <main className="min-h-screen bg-bg-primary text-text-primary p-12">
      <div className="max-w-4xl mx-auto space-y-12">
        <div>
          <h1 className="text-3xl font-display mb-2">Button Design System</h1>
          <p className="text-text-secondary">Enterprise legal-tech button component showcase.</p>
        </div>

        <section className="space-y-6">
          <h2 className="text-xl font-semibold border-b border-border pb-2">Variants (Default Size)</h2>
          <div className="flex flex-wrap gap-4 items-center">
            <Button variant="primary">Primary Action</Button>
            <Button variant="secondary">Secondary Action</Button>
            <Button variant="ghost">Ghost Action</Button>
            <Button variant="destructive">Destructive Action</Button>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-xl font-semibold border-b border-border pb-2">Sizes (Primary Variant)</h2>
          <div className="flex flex-wrap gap-4 items-center">
            <Button size="sm">Small (sm)</Button>
            <Button size="md">Medium (md)</Button>
            <Button size="lg">Large (lg)</Button>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-xl font-semibold border-b border-border pb-2">States (Primary Variant)</h2>
          <div className="flex flex-wrap gap-4 items-center">
            <Button>Default</Button>
            <Button disabled>Disabled</Button>
            <Button loading>Loading...</Button>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-xl font-semibold border-b border-border pb-2">Icon Variant</h2>
          <div className="flex flex-wrap gap-4 items-center">
            <Button variant="icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            </Button>
            <Button variant="icon" disabled>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            </Button>
            <Button variant="icon" loading>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            </Button>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-xl font-semibold border-b border-border pb-2">All Variants - Loading State</h2>
          <div className="flex flex-wrap gap-4 items-center">
            <Button variant="primary" loading>Primary</Button>
            <Button variant="secondary" loading>Secondary</Button>
            <Button variant="ghost" loading>Ghost</Button>
            <Button variant="destructive" loading>Destructive</Button>
          </div>
        </section>
      </div>
    </main>
  );
}
