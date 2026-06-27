"use client";

import { Icon } from "@iconify/react";
import { ScheduleHelpModal } from "@/components/schedule/ScheduleHelpModal";
import "@/components/schedule/day-schedule.css";
import {
  DAYS,
  HOURS,
  ROW_H,
  WEEKDAYS,
  formatHour,
  isSleepHour,
  useDaySchedulePage,
} from "@/hooks/useDaySchedulePage";
import {
  endHourToModalTime,
  hourToTimeInputValue,
  normalizeTimeInput,
} from "@/lib/schedule/parseScheduleBlockText";
import { toEU, dateToStr } from "@/lib/dates";
import type { TranslationKey } from "@/lib/i18n/translations";
import { tFormatN, tString } from "@/lib/i18n/translate";
import { memberColor } from "@/lib/members/colors";

type TFn = (key: TranslationKey) => unknown;

function tArray(t: TFn, key: TranslationKey): string[] {
  const value = t(key);
  return Array.isArray(value) ? value.map(String) : [];
}

export function DayScheduleScreen() {
  const page = useDaySchedulePage();
  const {
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
  } = page;

  const dayLabels = tArray(t, "day_short");
  const todayStr = dateToStr(new Date());

  return (
    <div className="schedule-page">
      <header className="schedule-hero card">
        <div className="schedule-hero-top">
          <div className="schedule-hero-head">
            <h2 className="card-section-title">{tString(t, "schedule_title")}</h2>
            <button
              type="button"
              className="pill-help-btn"
              onClick={() => setScheduleHelpOpen(true)}
              aria-label={tString(t, "schedule_how_title")}
              title={tString(t, "schedule_how_title")}
            >
              <Icon icon="heroicons:light-bulb" width={15} />
              <span>{tString(t, "import_help_btn")}</span>
            </button>
          </div>
          {blocks.length > 0 && (
            <div className="schedule-hero-meta">
              <span className="schedule-hero-count">
                {tFormatN(t, "schedule_blocks_count", blocks.length)}
              </span>
            </div>
          )}
        </div>
      </header>

      <ScheduleHelpModal
        open={scheduleHelpOpen}
        onClose={() => setScheduleHelpOpen(false)}
        t={t}
      />

      <div className="card schedule-toolbar">
        <div className="schedule-week-section">
          <div className="schedule-section-head">
            <Icon
              icon="heroicons:calendar-days"
              width={18}
              className="schedule-section-icon"
            />
            <span>{tString(t, "schedule_week_picker_title")}</span>
          </div>

          <div className="schedule-week-picker">
            <button
              type="button"
              className="schedule-nav-btn schedule-nav-btn--text"
              onClick={() => shiftWeek(-1)}
            >
              <Icon icon="heroicons:chevron-left" width={16} />
              <span>{tString(t, "schedule_prev_week")}</span>
            </button>

            <div className="schedule-week-center">
              <span className="schedule-week-range">
                {toEU(weekStart)} – {toEU(weekEnd)}
              </span>
              <span
                className={`schedule-week-badge ${isCurrentWeek ? "schedule-week-badge--current" : ""}`}
              >
                {isCurrentWeek
                  ? tString(t, "schedule_current_week_badge")
                  : tString(t, "schedule_other_week_badge")}
              </span>
              {!isCurrentWeek && (
                <button
                  type="button"
                  className="schedule-back-link"
                  onClick={() => setWeekStart(currentWeekStart)}
                >
                  <Icon icon="heroicons:arrow-uturn-left" width={14} />
                  {tString(t, "schedule_back_to_current")}
                </button>
              )}
            </div>

            <button
              type="button"
              className="schedule-nav-btn schedule-nav-btn--text"
              onClick={() => shiftWeek(1)}
            >
              <span>{tString(t, "schedule_next_week")}</span>
              <Icon icon="heroicons:chevron-right" width={16} />
            </button>
          </div>
        </div>

        <div className="schedule-work-section">
          <div className="schedule-section-head">
            <Icon
              icon="heroicons:queue-list"
              width={18}
              className="schedule-section-icon"
            />
            <div>
              <span>{tString(t, "schedule_work_hours")}</span>
            </div>
          </div>

          <div className="schedule-work-card">
            <div className="schedule-work-quick">
              <span className="schedule-work-quick-label">
                {tString(t, "schedule_work_quick_label")}
              </span>
              <div className="schedule-work-quick-input-wrap">
                <Icon
                  icon="heroicons:pencil-square"
                  className="schedule-work-quick-icon"
                  width={18}
                />
                <input
                  type="text"
                  className="schedule-work-paste"
                  value={workPasteText}
                  maxLength={80}
                  onChange={(e) => handleWorkPasteChange(e.target.value)}
                  placeholder={tString(t, "schedule_work_quick_ph")}
                  aria-label={tString(t, "schedule_work_quick_label")}
                />
              </div>
            </div>

            <div
              className={`schedule-work-summary${workPasteParsed ? " schedule-work-summary--parsed" : ""}`}
            >
              <div className="schedule-work-time">
                <input
                  type="text"
                  className="schedule-work-time-input"
                  value={workStartTimeDraft ?? workStartTimeValue}
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="09:00"
                  onFocus={() => setWorkStartTimeDraft(workStartTimeValue)}
                  onChange={(e) => setWorkStartTimeDraft(e.target.value)}
                  onBlur={(e) => {
                    const normalized = normalizeTimeInput(e.target.value);
                    if (normalized) handleWorkStartTimeChange(normalized);
                    setWorkStartTimeDraft(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  aria-label={tString(t, "schedule_work_from")}
                />
                <Icon
                  icon="heroicons:arrow-right"
                  width={14}
                  className="schedule-work-time-arrow"
                />
                <input
                  type="text"
                  className="schedule-work-time-input"
                  value={workEndTimeDraft ?? workEndTimeValue}
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="17:00"
                  onFocus={() => setWorkEndTimeDraft(workEndTimeValue)}
                  onChange={(e) => setWorkEndTimeDraft(e.target.value)}
                  onBlur={(e) => {
                    const normalized = normalizeTimeInput(e.target.value);
                    if (normalized) handleWorkEndTimeChange(normalized);
                    setWorkEndTimeDraft(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  aria-label={tString(t, "schedule_work_to")}
                />
              </div>
              <span className="schedule-work-summary-sep" aria-hidden="true" />
              {workPasteParsed && (
                <Icon
                  icon="heroicons:check-circle"
                  className="schedule-work-parse-ok"
                  width={16}
                  aria-hidden="true"
                />
              )}
              <input
                type="text"
                className="schedule-work-label-inline"
                maxLength={120}
                value={workLabel}
                onChange={(e) => setWorkLabel(e.target.value)}
                placeholder={tString(t, "schedule_work_label_ph")}
                aria-label={tString(t, "schedule_work_label")}
              />
            </div>

            <div className="schedule-work-days-row">
              <div className="schedule-work-presets">
                <button
                  type="button"
                  className={`schedule-day-chip ${isPresetActive(selectedWorkDays, WEEKDAYS) ? "active" : ""}`}
                  onClick={() => toggleWorkPreset(WEEKDAYS)}
                >
                  {tString(t, "schedule_work_weekdays")}
                </button>
                <button
                  type="button"
                  className={`schedule-day-chip ${isPresetActive(selectedWorkDays, DAYS) ? "active" : ""}`}
                  onClick={() => toggleWorkPreset(DAYS)}
                >
                  {tString(t, "schedule_work_all_days")}
                </button>
              </div>
              <span className="schedule-work-days-sep" aria-hidden="true" />
              <div className="schedule-work-individual">
                {DAYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`schedule-day-chip schedule-day-chip--day ${selectedWorkDays.includes(d) ? "active" : ""}`}
                    onClick={() =>
                      setSelectedWorkDays((prev) => toggleScheduleDay(prev, d))
                    }
                  >
                    {dayLabels[d]}
                  </button>
                ))}
              </div>
            </div>

            <div className="schedule-work-footer">
              <button
                type="button"
                className="btn schedule-work-clear"
                onClick={clearWeek}
                disabled={clearLoading || !blocks.length}
              >
                {clearLoading
                  ? tString(t, "loading")
                  : tString(t, "schedule_clear_week")}
              </button>
              <div className="schedule-work-footer-actions">
                {members.length > 1 && (
                  <div
                    className="schedule-work-targets"
                    role="group"
                    aria-label={tString(t, "schedule_work_for_members")}
                  >
                    <span className="schedule-work-targets-label">
                      {tString(t, "schedule_work_for_members")}
                    </span>
                    {members.map((m, i) => {
                      const active = workTargetMemberIds.includes(m.id);
                      const color = memberColor(i);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          className={`schedule-work-member-chip${active ? " active" : ""}`}
                          style={
                            active ? { borderColor: color, color } : undefined
                          }
                          onClick={() => toggleWorkTargetMember(m.id)}
                          aria-pressed={active}
                        >
                          <span
                            className="schedule-work-member-dot"
                            style={{
                              background: active ? color : "transparent",
                              borderColor: color,
                            }}
                            aria-hidden="true"
                          />
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                )}
                <button
                  type="button"
                  className="btn btn-primary schedule-work-apply"
                  onClick={() => void applyWorkHours()}
                  disabled={workLoading}
                >
                  {workLoading
                    ? tString(t, "loading")
                    : tString(t, "schedule_work_apply")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div className="schedule-loading">{tString(t, "loading")}</div>
        ) : (
          <div className="schedule-wrap">
            <div className="schedule-layout">
              <div className="schedule-corner" />
              {DAYS.map((d) => {
                const isToday = dayDates[d] === todayStr;
                return (
                <div
                  key={`h-${d}`}
                  className={`schedule-day-head${isToday ? " schedule-day-head--today" : ""}`}
                >
                  <span className="schedule-day-name">{dayLabels[d]}</span>
                  <span className="schedule-day-date">
                    {toEU(dayDates[d] ?? "").slice(0, 5)}
                  </span>
                </div>
              );
              })}

              <div className="schedule-body">
                <div className="schedule-time-col">
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className={`schedule-time ${isSleepHour(hour) ? "schedule-cell--sleep" : ""}`}
                    >
                      {formatHour(hour)}
                    </div>
                  ))}
                </div>

                {DAYS.map((day) => {
                  const isToday = dayDates[day] === todayStr;
                  return (
                  <div
                    key={day}
                    className={`schedule-day-col${isToday ? " schedule-day-col--today" : ""}`}
                  >
                    <div
                      className="schedule-day-body"
                      style={{ height: HOURS.length * ROW_H }}
                    >
                      {HOURS.map((hour) => (
                        <div
                          key={hour}
                          className={[
                            "schedule-cell",
                            isSleepHour(hour) ? "schedule-cell--sleep" : "",
                            isSelected(day, hour) ? "schedule-cell--selecting" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onMouseDown={() => startDrag(day, hour)}
                          onMouseEnter={() => extendDrag(day, hour)}
                        />
                      ))}
                      {blocks
                        .filter((b) => b.day === day)
                        .map((block) => (
                          <div
                            key={block.id}
                            className="schedule-block"
                            style={{
                              top: block.start_hour * ROW_H + 1,
                              height:
                                (block.end_hour - block.start_hour) * ROW_H - 2,
                              background: blockColor(block),
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={() => openEditModal(block)}
                            title={tString(t, "schedule_click_edit")}
                          >
                            {block.label}
                          </div>
                        ))}
                    </div>
                  </div>
                );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {modal && (
        <div
          className="schedule-modal-backdrop"
          onMouseDown={() => setModal(null)}
        >
          <div
            className="schedule-modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3>
              {modal.blockId
                ? tString(t, "schedule_edit_activity")
                : tString(t, "schedule_add_activity")}
            </h3>
            <p className="schedule-modal-day">{dayLabels[modal.day]}</p>

            <label className="schedule-modal-label">
              {tString(t, "schedule_activity_hours")}
            </label>
            <div className="schedule-modal-times">
              <input
                type="text"
                className="schedule-modal-time-input"
                value={
                  modalStartDraft ??
                  hourToTimeInputValue(modal.start_hour, 0)
                }
                inputMode="numeric"
                maxLength={5}
                placeholder="09:00"
                onFocus={() =>
                  setModalStartDraft(hourToTimeInputValue(modal.start_hour, 0))
                }
                onChange={(e) => setModalStartDraft(e.target.value)}
                onBlur={(e) => {
                  const normalized = normalizeTimeInput(e.target.value);
                  if (normalized) updateModalStart(normalized);
                  setModalStartDraft(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                aria-label={tString(t, "schedule_work_from")}
              />
              <Icon
                icon="heroicons:arrow-right"
                width={14}
                className="schedule-modal-time-arrow"
              />
              <input
                type="text"
                className="schedule-modal-time-input"
                value={
                  modalEndDraft ?? endHourToModalTime(modal.end_hour)
                }
                inputMode="numeric"
                maxLength={5}
                placeholder="17:00"
                onFocus={() =>
                  setModalEndDraft(endHourToModalTime(modal.end_hour))
                }
                onChange={(e) => setModalEndDraft(e.target.value)}
                onBlur={(e) => {
                  const raw = e.target.value.trim();
                  if (raw === "24:00" || raw === "24") {
                    updateModalEnd(raw);
                  } else {
                    const normalized = normalizeTimeInput(raw);
                    if (normalized) updateModalEnd(normalized);
                  }
                  setModalEndDraft(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                aria-label={tString(t, "schedule_work_to")}
              />
            </div>

            <label className="schedule-modal-label">
              {tString(t, "schedule_activity_name")}
            </label>
            <input
              type="text"
              autoFocus={!modal.blockId}
              maxLength={120}
              placeholder={tString(t, "schedule_activity_name")}
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void saveModal();
                if (e.key === "Escape") setModal(null);
              }}
            />

            <div className="schedule-modal-actions">
              {modal.blockId && (
                <button
                  type="button"
                  className="btn btn-danger schedule-modal-delete"
                  onClick={deleteFromModal}
                >
                  {tString(t, "delete")}
                </button>
              )}
              <div className="schedule-modal-actions-right">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setModal(null)}
                >
                  {tString(t, "cancel")}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void saveModal()}
                  disabled={!labelInput.trim()}
                >
                  <Icon
                    icon="heroicons:check"
                    width={16}
                    style={{ marginRight: 4, verticalAlign: "text-bottom" }}
                  />
                  {tString(t, "save_btn")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
