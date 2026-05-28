import Link from "next/link";

export default function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3 group">
      {/* Icon mark */}
      <div className="w-10 h-10 rounded-lg bg-primary-container/20 border border-primary-container/30 flex items-center justify-center group-hover:bg-primary-container/30 transition-colors">
        <span
          className="material-symbols-outlined text-primary-container text-xl"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          music_note
        </span>
      </div>
      <span className="font-playfair font-semibold text-headline-lg-mobile md:text-[1.4rem] text-primary-fixed-dim tracking-tight">
        MaestroAI
      </span>
    </Link>
  );
}
