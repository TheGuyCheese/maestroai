import { Suspense } from "react";
import UploadZone from "@/components/UploadZone";
import Logo from "@/components/Logo";
import ErrorBanner from "@/components/ErrorBanner";

export default function UploadPage() {
  return (
    <div className="relative min-h-screen bg-surface-container-lowest staff-texture flex flex-col overflow-x-hidden">
      {/* Logo */}
      <header className="absolute top-6 left-6 md:top-8 md:left-10 z-10">
        <Logo />
      </header>

      {/* Error banner — shown when redirected back with ?error= param */}
      <Suspense>
        <ErrorBanner />
      </Suspense>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 md:px-10 py-24">
        {/* Hero text */}
        <div className="text-center mb-12 max-w-2xl">
          <h1 className="font-playfair font-bold text-display-lg text-on-surface mb-4 leading-tight">
            Your AI music<br />
            <span className="text-primary-fixed-dim italic">teacher</span> is ready.
          </h1>
          <p className="font-inter text-body-lg text-on-surface-variant">
            Upload a sheet — AI agents analyse every instrument and build your practice plan.
          </p>
        </div>

        {/* Upload zone */}
        <UploadZone />

        {/* Decorative staff-line accent */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary-container/30 to-transparent" />
      </main>
    </div>
  );
}
