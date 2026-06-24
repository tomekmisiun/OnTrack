"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { ProfileModal } from "@/components/profile/ProfileModal";
import { ProfileModalProvider } from "@/components/profile/ProfileModalContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { TourProvider, useTour } from "@/components/tour/TourProvider";
import { HOME_PATH } from "@/lib/config/routes";

type AppShellInnerProps = {
  children: React.ReactNode;
};

function AppShellInner({ children }: AppShellInnerProps) {
  const pathname = usePathname();
  const isHome = pathname === HOME_PATH;
  const [showProfile, setShowProfile] = useState(false);
  const { startTour } = useTour();

  const profileModal = showProfile ? (
    <ProfileModal
      onClose={() => setShowProfile(false)}
      onStartTour={() => {
        setShowProfile(false);
        startTour();
      }}
    />
  ) : null;

  if (isHome) {
    return (
      <ProfileModalProvider openProfile={() => setShowProfile(true)}>
        <div className="min-h-screen">
          {children}
          {profileModal}
        </div>
      </ProfileModalProvider>
    );
  }

  return (
    <ProfileModalProvider openProfile={() => setShowProfile(true)}>
      <div className="flex min-h-screen">
        <Sidebar onAccount={() => setShowProfile(true)} />
        <main className="min-w-0 flex-1 overflow-auto p-4 md:p-6">{children}</main>
        {profileModal}
      </div>
    </ProfileModalProvider>
  );
}

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <TourProvider>
      <AppShellInner>{children}</AppShellInner>
    </TourProvider>
  );
}
