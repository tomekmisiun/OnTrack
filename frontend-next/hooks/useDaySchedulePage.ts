"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMember } from "@/contexts/MemberContext";
import { useToast } from "@/contexts/ToastContext";
import {
  clearWeek as apiClearWeek,
  create as apiCreate,
  createBulk as apiCreateBulk,
  deleteBlock as apiDeleteBlock,
  getAll as apiGetAll,
  update as apiUpdate,
} from "@/lib/api/daySchedule";
import { ApiError } from "@/lib/api/errors";
import { addDays, getCurrentWeek } from "@/lib/dates";
import { tFormatArgs, tFormatN, tString } from "@/lib/i18n/translate";
import { hasBlockOverlap } from "@/lib/schedule/overlap";
import {
  hourToTimeInputValue,
  parseScheduleBlockText,
  parseTimeInputEnd,
  parseTimeInputPart,
} from "@/lib/schedule/parseScheduleBlockText";
import {
  SCHEDULE_DAYS,
  SCHEDULE_WEEKDAYS,
  isPresetActive,
  togglePresetDays,
  toggleScheduleDay,
} from "@/lib/schedule/workDays";
import {
  sortScheduleBlocks,
  type ParsedScheduleBlock,
  type ScheduleBlock,
} from "@/types/daySchedule";

export const HOURS = Array.from({ length: 24 }, (_, i) => i);
export const DAYS = [...SCHEDULE_DAYS];
export const WEEKDAYS = [...SCHEDULE_WEEKDAYS];
export const ROW_H = 28;
export const BLOCK_COLORS = [
  "#4a6fa5",
  "#6366f1",
  "#0d9488",
  "#c2410c",
  "#9333ea",
  "#ca8a04",
] as const;
export const WORK_COLOR = "#64748b";

export type ScheduleModalState = {
  blockId?: number;
  day: number;
  start_hour: number;
  end_hour: number;
  week_start: string;
};

export type DragSelection = {
  day: number;
  start: number;
  end: number;
};

export function isSleepHour(hour: number): boolean {
  return hour >= 23 || hour < 6;
}

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function useDaySchedulePage() {
  const { t } = useLanguage();
  const { activeMember, members, includedMemberIds } = useMember();
  const { showError, showSuccess, showConfirm } = useToast();

  const currentWeekStart = getCurrentWeek().start;
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [selection, setSelection] = useState<DragSelection | null>(null);
  const [modal, setModal] = useState<ScheduleModalState | null>(null);
  const [labelInput, setLabelInput] = useState("");
  const [workStart, setWorkStart] = useState(9);
  const [workStartMinute, setWorkStartMinute] = useState(0);
  const [workEnd, setWorkEnd] = useState(17);
  const [workEndPartHour, setWorkEndPartHour] = useState(17);
  const [workEndPartMinute, setWorkEndPartMinute] = useState(0);
  const [workLabel, setWorkLabel] = useState("");
  const [workPasteText, setWorkPasteText] = useState("");
  const [selectedWorkDays, setSelectedWorkDays] = useState<number[]>([
    ...WEEKDAYS,
  ]);
  const [workTargetMemberIds, setWorkTargetMemberIds] = useState<number[]>([]);
  const [workLoading, setWorkLoading] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [workStartTimeDraft, setWorkStartTimeDraft] = useState<string | null>(
    null,
  );
  const [workEndTimeDraft, setWorkEndTimeDraft] = useState<string | null>(null);
  const [modalStartDraft, setModalStartDraft] = useState<string | null>(null);
  const [modalEndDraft, setModalEndDraft] = useState<string | null>(null);
  const [scheduleHelpOpen, setScheduleHelpOpen] = useState(false);
  const dragRef = useRef<{ day: number; start: number; end: number } | null>(
    null,
  );

  const weekEnd = addDays(weekStart, 6);
  const isCurrentWeek = weekStart === currentWeekStart;

  const workPasteParsed = useMemo(
    () => (workPasteText.trim() ? parseScheduleBlockText(workPasteText) : null),
    [workPasteText],
  );

  const applyParsedWork = useCallback((parsed: ParsedScheduleBlock) => {
    setWorkStart(parsed.start_hour);
    setWorkStartMinute(parsed.start_minute);
    setWorkEnd(parsed.end_hour);
    setWorkEndPartHour(parsed.end_part_hour);
    setWorkEndPartMinute(parsed.end_part_minute);
    if (parsed.label) setWorkLabel(parsed.label);
  }, []);

  const workStartTimeValue = hourToTimeInputValue(workStart, workStartMinute);
  const workEndTimeValue = hourToTimeInputValue(
    workEndPartHour,
    workEndPartMinute,
  );

  const loadBlocks = useCallback(async () => {
    if (!activeMember?.id) {
      setBlocks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const items = await apiGetAll(activeMember.id, weekStart);
      setBlocks(items);
    } catch {
      showError(tString(t, "schedule_load_err"));
    } finally {
      setLoading(false);
    }
  }, [activeMember?.id, weekStart, showError, t]);

  useEffect(() => {
    void loadBlocks();
  }, [loadBlocks]);

  useEffect(() => {
    if (!members.length) return;
    setWorkTargetMemberIds((prev) => {
      const valid = prev.filter((id) => members.some((m) => m.id === id));
      if (valid.length) return valid;
      const fromIncluded = includedMemberIds.filter((id) =>
        members.some((m) => m.id === id),
      );
      if (fromIncluded.length) return fromIncluded;
      return activeMember?.id ? [activeMember.id] : [];
    });
  }, [members, includedMemberIds, activeMember?.id]);

  const dayDates = useMemo(
    () => DAYS.map((d) => addDays(weekStart, d)),
    [weekStart],
  );

  const blockAt = useCallback(
    (day: number, hour: number) =>
      blocks.find(
        (b) => b.day === day && hour >= b.start_hour && hour < b.end_hour,
      ),
    [blocks],
  );

  const workDefaultLabel = tString(t, "schedule_work_default");

  const blockColor = useCallback(
    (block: ScheduleBlock) =>
      block.label === workDefaultLabel
        ? WORK_COLOR
        : BLOCK_COLORS[block.id % BLOCK_COLORS.length],
    [workDefaultLabel],
  );

  const finishDrag = useCallback(() => {
    if (!dragging || !selection) {
      setDragging(false);
      return;
    }
    setDragging(false);
    const { day, start, end } = selection;
    const startHour = Math.min(start, end);
    const endHour = Math.max(start, end) + 1;

    for (let h = startHour; h < endHour; h++) {
      if (blockAt(day, h)) {
        setSelection(null);
        dragRef.current = null;
        showError(tString(t, "schedule_overlap_err"));
        return;
      }
    }

    setModal({
      day,
      start_hour: startHour,
      end_hour: endHour,
      week_start: weekStart,
    });
    setLabelInput("");
    setModalStartDraft(null);
    setModalEndDraft(null);
    setSelection(null);
    dragRef.current = null;
  }, [blockAt, dragging, selection, showError, t, weekStart]);

  useEffect(() => {
    const up = () => {
      if (dragging) finishDrag();
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, [dragging, finishDrag]);

  const startDrag = (day: number, hour: number) => {
    if (blockAt(day, hour)) return;
    dragRef.current = { day, start: hour, end: hour };
    setDragging(true);
    setSelection({ day, start: hour, end: hour });
  };

  const extendDrag = (day: number, hour: number) => {
    if (!dragging || !dragRef.current || dragRef.current.day !== day) return;
    dragRef.current.end = hour;
    const start = Math.min(dragRef.current.start, hour);
    const end = Math.max(dragRef.current.start, hour);
    setSelection({ day, start, end });
  };

  const openEditModal = (block: ScheduleBlock) => {
    setModal({
      blockId: block.id,
      day: block.day,
      start_hour: block.start_hour,
      end_hour: block.end_hour,
      week_start: weekStart,
    });
    setLabelInput(block.label);
    setModalStartDraft(null);
    setModalEndDraft(null);
  };

  const updateModalStart = (value: string) => {
    const part = parseTimeInputPart(value);
    if (!part) return;
    setModal((prev) => (prev ? { ...prev, start_hour: part.hour } : prev));
  };

  const updateModalEnd = (value: string) => {
    const trimmed = value.trim();
    if (trimmed === "24:00" || trimmed === "24") {
      setModal((prev) => (prev ? { ...prev, end_hour: 24 } : prev));
      return;
    }
    const part = parseTimeInputPart(value);
    if (!part) return;
    const end = parseTimeInputEnd(value);
    if (end == null) return;
    setModal((prev) => (prev ? { ...prev, end_hour: end } : prev));
  };

  const saveModal = async () => {
    const label = labelInput.trim();
    if (!label || !modal || !activeMember?.id) return;
    if (modal.end_hour <= modal.start_hour) {
      showError(tString(t, "schedule_overlap_err"));
      return;
    }
    if (
      hasBlockOverlap(
        blocks,
        modal.day,
        modal.start_hour,
        modal.end_hour,
        modal.blockId ?? null,
      )
    ) {
      showError(tString(t, "schedule_overlap_err"));
      return;
    }

    try {
      if (modal.blockId) {
        const updated = await apiUpdate(modal.blockId, {
          label,
          start_hour: modal.start_hour,
          end_hour: modal.end_hour,
        });
        setBlocks((prev) =>
          sortScheduleBlocks(
            prev.map((b) => (b.id === modal.blockId ? updated : b)),
          ),
        );
        showSuccess(tString(t, "schedule_updated"));
      } else {
        const targetIds = workTargetMemberIds.length
          ? workTargetMemberIds
          : [activeMember.id];
        const allCreated: ScheduleBlock[] = [];
        for (const memberId of targetIds) {
          try {
            const created = await apiCreate({
              day: modal.day,
              start_hour: modal.start_hour,
              end_hour: modal.end_hour,
              week_start: modal.week_start,
              label,
              member_id: memberId,
            });
            allCreated.push(created);
          } catch (err) {
            if (err instanceof ApiError && err.status === 409) continue;
            throw err;
          }
        }
        if (!allCreated.length) {
          showError(tString(t, "schedule_overlap_err"));
          return;
        }
        const forActive = allCreated.filter(
          (b) => b.member_id === activeMember.id,
        );
        if (forActive.length) {
          setBlocks((prev) => sortScheduleBlocks([...prev, ...forActive]));
        }
        showSuccess(tString(t, "schedule_saved"));
      }
      setModal(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        showError(tString(t, "schedule_overlap_err"));
      } else {
        showError(tString(t, "schedule_save_err"));
      }
    }
  };

  const confirmDeleteBlock = (block: ScheduleBlock) => {
    showConfirm({
      title: tString(t, "delete"),
      message: tString(t, "schedule_delete_confirm"),
      confirmLabel: tString(t, "delete"),
      onConfirm: async () => {
        try {
          await apiDeleteBlock(block.id);
          setBlocks((prev) => prev.filter((b) => b.id !== block.id));
          setModal(null);
        } catch {
          showError(tString(t, "schedule_delete_err"));
        }
      },
    });
  };

  const deleteFromModal = () => {
    if (!modal?.blockId) return;
    const block = blocks.find((b) => b.id === modal.blockId);
    if (block) confirmDeleteBlock(block);
  };

  const applyWorkHours = async () => {
    const label = (workLabel || workDefaultLabel).trim();
    if (workEnd <= workStart) {
      showError(tString(t, "schedule_overlap_err"));
      return;
    }
    if (!selectedWorkDays.length) {
      showError(tString(t, "schedule_work_no_days"));
      return;
    }
    if (!workTargetMemberIds.length) {
      showError(tString(t, "schedule_work_no_members"));
      return;
    }
    setWorkLoading(true);
    try {
      const allCreated: ScheduleBlock[] = [];
      let totalSkipped = 0;
      for (const memberId of workTargetMemberIds) {
        const res = await apiCreateBulk({
          member_id: memberId,
          week_start: weekStart,
          start_hour: workStart,
          end_hour: workEnd,
          label,
          days: selectedWorkDays,
        });
        allCreated.push(...res.created);
        totalSkipped += res.skipped.length;
      }
      if (allCreated.length === 0) {
        showError(tString(t, "schedule_work_none"));
      } else {
        const forActive = allCreated.filter(
          (b) => b.member_id === activeMember?.id,
        );
        if (forActive.length) {
          setBlocks((prev) => sortScheduleBlocks([...prev, ...forActive]));
        }
        showSuccess(
          tFormatArgs(
            t,
            "schedule_work_applied",
            allCreated.length,
            totalSkipped,
            workTargetMemberIds.length,
          ),
        );
      }
    } catch {
      showError(tString(t, "schedule_save_err"));
    } finally {
      setWorkLoading(false);
    }
  };

  const clearWeek = () => {
    if (!blocks.length || !activeMember?.id) return;
    showConfirm({
      title: tString(t, "schedule_clear_week"),
      message: tFormatN(t, "schedule_clear_week_confirm", blocks.length),
      confirmLabel: tString(t, "schedule_clear_week"),
      onConfirm: async () => {
        setClearLoading(true);
        try {
          await apiClearWeek(activeMember.id, weekStart);
          setBlocks([]);
          showSuccess(tString(t, "schedule_clear_week_ok"));
        } catch {
          showError(tString(t, "schedule_clear_week_err"));
          void loadBlocks();
        } finally {
          setClearLoading(false);
        }
      },
    });
  };

  const isSelected = (day: number, hour: number) => {
    if (!selection || selection.day !== day) return false;
    const lo = Math.min(selection.start, selection.end);
    const hi = Math.max(selection.start, selection.end);
    return hour >= lo && hour <= hi;
  };

  const shiftWeek = (delta: number) =>
    setWeekStart((prev) => addDays(prev, delta * 7));

  const handleWorkPasteChange = (text: string) => {
    setWorkPasteText(text);
    const parsed = parseScheduleBlockText(text);
    if (parsed) applyParsedWork(parsed);
  };

  const handleWorkStartTimeChange = (value: string) => {
    const part = parseTimeInputPart(value);
    if (!part) return;
    setWorkStart(part.hour);
    setWorkStartMinute(part.minute);
  };

  const handleWorkEndTimeChange = (value: string) => {
    const part = parseTimeInputPart(value);
    if (!part) return;
    const end = parseTimeInputEnd(value);
    if (end == null) return;
    setWorkEnd(end);
    setWorkEndPartHour(part.hour);
    setWorkEndPartMinute(part.minute);
  };

  const toggleWorkPreset = (preset: readonly number[]) => {
    setSelectedWorkDays((prev) => togglePresetDays(prev, preset));
  };

  const toggleWorkTargetMember = (id: number) => {
    setWorkTargetMemberIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev;
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  };

  return {
    t,
    members,
    blocks,
    loading,
    modal,
    labelInput,
    setLabelInput,
    workPasteText,
    workPasteParsed,
    workStartTimeDraft,
    setWorkStartTimeDraft,
    workEndTimeDraft,
    setWorkEndTimeDraft,
    workStartTimeValue,
    workEndTimeValue,
    workLabel,
    setWorkLabel,
    selectedWorkDays,
    setSelectedWorkDays,
    workTargetMemberIds,
    workLoading,
    clearLoading,
    modalStartDraft,
    setModalStartDraft,
    modalEndDraft,
    setModalEndDraft,
    scheduleHelpOpen,
    setScheduleHelpOpen,
    weekStart,
    weekEnd,
    isCurrentWeek,
    currentWeekStart,
    dayDates,
    blockColor,
    startDrag,
    extendDrag,
    openEditModal,
    updateModalStart,
    updateModalEnd,
    saveModal,
    deleteFromModal,
    applyWorkHours,
    clearWeek,
    isSelected,
    shiftWeek,
    setWeekStart,
    setModal,
    handleWorkPasteChange,
    handleWorkStartTimeChange,
    handleWorkEndTimeChange,
    toggleWorkPreset,
    toggleWorkTargetMember,
    isPresetActive,
    toggleScheduleDay,
  };
}
