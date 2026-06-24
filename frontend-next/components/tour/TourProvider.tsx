"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  Joyride,
  ACTIONS,
  EVENTS,
  STATUS,
  type EventData,
} from "react-joyride";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getTourLocale,
  getTourSteps,
  isTourDone,
  markTourDone,
  TOUR_STYLES,
  type TourStep,
} from "@/lib/tour/tour-steps";

type TourContextValue = {
  startTour: () => void;
};

const TourContext = createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error("useTour must be used within TourProvider");
  }
  return ctx;
}

export function TourProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { lang } = useLanguage();
  const [tourRun, setTourRun] = useState(false);

  useEffect(() => {
    if (!user) setTourRun(false);
  }, [user]);

  useEffect(() => {
    if (loading || !user?.id || isTourDone(user.id)) return undefined;
    let tourTimer: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(() => {
      router.push("/macro");
      tourTimer = setTimeout(() => setTourRun(true), 250);
    }, 600);
    return () => {
      clearTimeout(timer);
      if (tourTimer) clearTimeout(tourTimer);
    };
  }, [user?.id, loading, router]);

  const handleTourEvent = useCallback(
    (data: EventData) => {
      const { status, type, action, index } = data;

      if (type === EVENTS.STEP_BEFORE) {
        const step = getTourSteps(lang)[index] as TourStep | undefined;
        if (step?.gotoTab) {
          router.push(`/${step.gotoTab}`);
        }
        return;
      }

      if (
        status === STATUS.FINISHED ||
        status === STATUS.SKIPPED ||
        action === ACTIONS.SKIP ||
        (action === ACTIONS.CLOSE && type === EVENTS.TOUR_END)
      ) {
        if (user?.id) markTourDone(user.id);
        setTourRun(false);
      }
    },
    [lang, router, user?.id],
  );

  const startTour = useCallback(() => {
    setTourRun(false);
    setTimeout(() => setTourRun(true), 100);
  }, []);

  const value = useMemo(() => ({ startTour }), [startTour]);

  return (
    <TourContext.Provider value={value}>
      {user && (
        <Joyride
          steps={getTourSteps(lang)}
          run={tourRun}
          continuous
          scrollToFirstStep={false}
          locale={getTourLocale(lang)}
          styles={TOUR_STYLES}
          onEvent={handleTourEvent}
          options={{
            skipScroll: true,
            showProgress: false,
            buttons: ["back", "close", "skip", "primary"],
            closeButtonAction: "skip",
          }}
        />
      )}
      {children}
    </TourContext.Provider>
  );
}
