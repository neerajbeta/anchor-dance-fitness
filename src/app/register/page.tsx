import Link from "next/link";
import { LogoWordmark } from "@/components/Logo";
import { Stepper } from "@/components/Stepper";
import { LocationSelect } from "@/components/LocationSelect";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between bg-ink px-7">
        <LogoWordmark size={30} />
        <div className="text-[13px] text-white/50">Step 1 of 3 — Profile Setup</div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-6 py-8 anim-fade">
        <Stepper steps={["Your Details", "Choose Plan", "Payment"]} current={0} />

        <div className="card">
          <div className="card-title">Tell us about yourself</div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Full Name *" placeholder="e.g. Priya Sharma" />
            <Field label="Date of Birth *" type="date" />
            <div>
              <label className="field-label">Gender *</label>
              <select className="field">
                <option>Select</option>
                <option>Female</option>
                <option>Male</option>
                <option>Non-binary</option>
                <option>Prefer not to say</option>
              </select>
            </div>
            <Field label="Contact Number *" type="tel" placeholder="+46 70 000 0000" />
            <Field label="City *" placeholder="e.g. Stockholm" />
            <div>
              <label className="field-label">Country *</label>
              <select className="field">
                <option>Sweden</option>
                <option>India</option>
                <option>United Kingdom</option>
                <option>United States</option>
                <option>Other</option>
              </select>
            </div>
          </div>

          <div className="mt-3">
            <label className="field-label">Email Address *</label>
            <input className="field" type="email" defaultValue="priya@example.com" />
          </div>
          <div className="mt-3">
            <label className="field-label">Home Studio Location *</label>
            <LocationSelect withCountry />
          </div>

          {/* Flexible parent/guardian block */}
          <div className="relative mt-5 rounded-xl border-[1.5px] border-dashed border-grape/40 bg-grape/5 p-4">
            <span className="absolute -top-2.5 left-4 rounded-lg bg-grape px-2 py-0.5 text-[10px] font-bold text-white">
              ⭐ FLEXIBLE
            </span>
            <div className="mb-3 mt-1 text-sm font-bold text-ink">
              Parent / Guardian <span className="badge badge-grape ml-1">Optional</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Parent Name" placeholder="e.g. Anjali Sharma" />
              <Field label="Parent Contact" placeholder="+46 70 000 0000" />
            </div>
          </div>

          <div className="mt-6 flex justify-between">
            <Link href="/login" className="btn btn-ghost">
              ← Back
            </Link>
            <Link href="/plans" className="btn btn-primary">
              Save &amp; Continue →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  type = "text",
  placeholder,
}: {
  label: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input className="field" type={type} placeholder={placeholder} />
    </div>
  );
}
