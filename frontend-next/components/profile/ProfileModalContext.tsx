"use client";

import { createContext, useContext } from "react";

type ProfileModalContextValue = {
  openProfile: () => void;
};

const ProfileModalContext = createContext<ProfileModalContextValue | null>(null);

export function ProfileModalProvider({
  openProfile,
  children,
}: {
  openProfile: () => void;
  children: React.ReactNode;
}) {
  return (
    <ProfileModalContext.Provider value={{ openProfile }}>
      {children}
    </ProfileModalContext.Provider>
  );
}

export function useProfileModal(): ProfileModalContextValue {
  const ctx = useContext(ProfileModalContext);
  if (!ctx) {
    return { openProfile: () => {} };
  }
  return ctx;
}
