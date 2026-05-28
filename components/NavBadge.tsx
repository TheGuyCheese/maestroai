"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SignInButton,
  SignUpButton,
  UserButton,
  Show,
} from "@clerk/nextjs";

/**
 * Fixed top-right auth badge.
 * "My Lessons" link is only shown on the upload/home page ("/").
 */
export default function NavBadge() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <div className="fixed top-5 right-6 z-50 flex items-center gap-3">
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button className="font-inter text-label-md text-on-surface-variant hover:text-on-surface transition-colors px-3 py-1.5 rounded-lg hover:bg-surface-container-high">
            Sign in
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button className="font-inter text-label-md bg-primary-container text-[#0a0a0a] px-3 py-1.5 rounded-lg hover:brightness-110 transition-all">
            Sign up
          </button>
        </SignUpButton>
      </Show>

      <Show when="signed-in">
        {isHome && (
          <Link
            href="/history"
            className="font-inter text-label-md text-on-surface-variant hover:text-primary-container transition-colors px-3 py-1.5 rounded-lg hover:bg-surface-container-high flex items-center gap-1.5"
          >
            <span
              className="material-symbols-outlined text-base"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              library_music
            </span>
            My Lessons
          </Link>
        )}
        <UserButton
          appearance={{
            elements: {
              avatarBox: "w-8 h-8 ring-2 ring-primary-container/40",
            },
          }}
        />
      </Show>
    </div>
  );
}
