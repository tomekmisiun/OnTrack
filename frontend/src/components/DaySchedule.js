import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { daySchedule as api } from '../api';
import { useLanguage } from '../contexts/LanguageContext';
import { useMember } from '../contexts/MemberContext';
import { useToast } from '../contexts/ToastContext';
import { getCurrentWeek, addDays, toEU } from '../utils/dates';
import {
  parseScheduleBlockText,
  hourToTimeInputValue,
  parseTimeInputEnd,
  parseTimeInputPart,
  normalizeTimeInput,
} from '../utils/parseScheduleBlockText';
import {
  SCHEDULE_DAYS,
  SCHEDULE_WEEKDAYS,
  toggleScheduleDay,
  togglePresetDays,
  isPresetActive,
} from '../utils/scheduleWorkDays';
import './DaySchedule.css';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = SCHEDULE_DAYS;
const WEEKDAYS = SCHEDULE_WEEKDAYS;
const ROW_H = 28;
const BLOCK_COLORS = ['#4a6fa5', '#6366f1', '#0d9488', '#c2410c', '#9333ea', '#ca8a04'];
const WORK_COLOR = '#64748b';

const STEPS = [
  { icon: 'heroicons:cursor-arrow-rays', titleKey: 'schedule_step_1', descKey: 'schedule_step_1_desc' },
  { icon: 'heroicons:pencil-square',       titleKey: 'schedule_step_2', descKey: 'schedule_step_2_desc' },
  { icon: 'heroicons:trash',             titleKey: 'schedule_step_3', descKey: 'schedule_step_3_desc' },
];

function isSleepHour(hour) {
  return hour >= 23 || hour < 6;
}

function formatHour(hour) {
  return `${String(hour).padStart(2, '0')}:00`;
}

function hasBlockOverlap(blocks, day, startHour, endHour, excludeId = null) {
  return blocks.some(b =>
    b.id !== excludeId &&
    b.day === day &&
    startHour < b.end_hour &&
    endHour > b.start_hour
  );
}

function endHourToModalTime(endHour) {
  if (endHour === 24) return '24:00';
  return hourToTimeInputValue(endHour, 0);
}

export default function DaySchedule() {
  const { t } = useLanguage();
  const { activeMember } = useMember();
  const { showError, showSuccess, showConfirm } = useToast();

  const currentWeekStart = getCurrentWeek().start;
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [selection, setSelection] = useState(null);
  const [modal, setModal] = useState(null);
  const [labelInput, setLabelInput] = useState('');
  const [workStart, setWorkStart] = useState(9);
  const [workStartMinute, setWorkStartMinute] = useState(0);
  const [workEnd, setWorkEnd] = useState(17);
  const [workEndPartHour, setWorkEndPartHour] = useState(17);
  const [workEndPartMinute, setWorkEndPartMinute] = useState(0);
  const [workLabel, setWorkLabel] = useState('');
  const [workPasteText, setWorkPasteText] = useState('');
  const [selectedWorkDays, setSelectedWorkDays] = useState([...WEEKDAYS]);
  const [workLoading, setWorkLoading] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [workStartTimeDraft, setWorkStartTimeDraft] = useState(null);
  const [workEndTimeDraft, setWorkEndTimeDraft] = useState(null);
  const [modalStartDraft, setModalStartDraft] = useState(null);
  const [modalEndDraft, setModalEndDraft] = useState(null);
  const dragRef = useRef(null);

  const dayLabels = t('day_short');
  const weekEnd = addDays(weekStart, 6);
  const isCurrentWeek = weekStart === currentWeekStart;

  const workPasteParsed = useMemo(
    () => (workPasteText.trim() ? parseScheduleBlockText(workPasteText) : null),
    [workPasteText],
  );

  const applyParsedWork = useCallback((parsed) => {
    setWorkStart(parsed.start_hour);
    setWorkStartMinute(parsed.start_minute);
    setWorkEnd(parsed.end_hour);
    setWorkEndPartHour(parsed.end_part_hour);
    setWorkEndPartMinute(parsed.end_part_minute);
    if (parsed.label) setWorkLabel(parsed.label);
  }, []);

  const handleWorkPasteChange = (text) => {
    setWorkPasteText(text);
    const parsed = parseScheduleBlockText(text);
    if (parsed) applyParsedWork(parsed);
  };

  const handleWorkStartTimeChange = (value) => {
    const part = parseTimeInputPart(value);
    if (!part) return;
    setWorkStart(part.hour);
    setWorkStartMinute(part.minute);
  };

  const handleWorkEndTimeChange = (value) => {
    const part = parseTimeInputPart(value);
    if (!part) return;
    const end = parseTimeInputEnd(value);
    if (end == null) return;
    setWorkEnd(end);
    setWorkEndPartHour(part.hour);
    setWorkEndPartMinute(part.minute);
  };

  const workStartTimeValue = hourToTimeInputValue(workStart, workStartMinute);
  const workEndTimeValue = hourToTimeInputValue(workEndPartHour, workEndPartMinute);

  const toggleWorkPreset = (preset) => {
    setSelectedWorkDays(prev => togglePresetDays(prev, preset));
  };

  const loadBlocks = useCallback(async () => {
    if (!activeMember?.id) {
      setBlocks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.getAll(activeMember.id, weekStart);
      setBlocks(res.data);
    } catch {
      showError(t('schedule_load_err'));
    } finally {
      setLoading(false);
    }
  }, [activeMember?.id, weekStart, showError, t]);

  useEffect(() => { loadBlocks(); }, [loadBlocks]);

  const dayDates = useMemo(
    () => DAYS.map(d => addDays(weekStart, d)),
    [weekStart]
  );

  const blockAt = (day, hour) =>
    blocks.find(b => b.day === day && hour >= b.start_hour && hour < b.end_hour);

  const blockColor = (block) =>
    block.label === t('schedule_work_default') ? WORK_COLOR : BLOCK_COLORS[block.id % BLOCK_COLORS.length];

  const startDrag = (day, hour) => {
    if (blockAt(day, hour)) return;
    dragRef.current = { day, start: hour, end: hour };
    setDragging(true);
    setSelection({ day, start: hour, end: hour });
  };

  const extendDrag = (day, hour) => {
    if (!dragging || !dragRef.current || dragRef.current.day !== day) return;
    dragRef.current.end = hour;
    const start = Math.min(dragRef.current.start, hour);
    const end = Math.max(dragRef.current.start, hour);
    setSelection({ day, start, end });
  };

  const finishDrag = () => {
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
        showError(t('schedule_overlap_err'));
        return;
      }
    }

    setModal({ day, start_hour: startHour, end_hour: endHour, week_start: weekStart });
    setLabelInput('');
    setModalStartDraft(null);
    setModalEndDraft(null);
    setSelection(null);
    dragRef.current = null;
  };

  useEffect(() => {
    const up = () => { if (dragging) finishDrag(); };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  });

  const openEditModal = (block) => {
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

  const updateModalStart = (value) => {
    const part = parseTimeInputPart(value);
    if (!part) return;
    setModal(prev => (prev ? { ...prev, start_hour: part.hour } : prev));
  };

  const updateModalEnd = (value) => {
    const trimmed = value.trim();
    if (trimmed === '24:00' || trimmed === '24') {
      setModal(prev => (prev ? { ...prev, end_hour: 24 } : prev));
      return;
    }
    const part = parseTimeInputPart(value);
    if (!part) return;
    const end = parseTimeInputEnd(value);
    if (end == null) return;
    setModal(prev => (prev ? { ...prev, end_hour: end } : prev));
  };

  const saveModal = async () => {
    const label = labelInput.trim();
    if (!label || !modal) return;
    if (modal.end_hour <= modal.start_hour) {
      showError(t('schedule_overlap_err'));
      return;
    }
    if (hasBlockOverlap(blocks, modal.day, modal.start_hour, modal.end_hour, modal.blockId ?? null)) {
      showError(t('schedule_overlap_err'));
      return;
    }

    try {
      if (modal.blockId) {
        const res = await api.update(modal.blockId, {
          label,
          start_hour: modal.start_hour,
          end_hour: modal.end_hour,
        });
        setBlocks(prev => prev.map(b => (b.id === modal.blockId ? res.data : b)).sort((a, b) =>
          a.day - b.day || a.start_hour - b.start_hour
        ));
        showSuccess(t('schedule_updated'));
      } else {
        const res = await api.create({
          day: modal.day,
          start_hour: modal.start_hour,
          end_hour: modal.end_hour,
          week_start: modal.week_start,
          label,
          member_id: activeMember.id,
        });
        setBlocks(prev => [...prev, res.data].sort((a, b) =>
          a.day - b.day || a.start_hour - b.start_hour
        ));
        showSuccess(t('schedule_saved'));
      }
      setModal(null);
    } catch (err) {
      if (err.response?.status === 409) showError(t('schedule_overlap_err'));
      else showError(t('schedule_save_err'));
    }
  };

  const confirmDeleteBlock = (block) => {
    showConfirm({
      title: t('delete'),
      message: t('schedule_delete_confirm'),
      confirmLabel: t('delete'),
      onConfirm: async () => {
        try {
          await api.delete(block.id);
          setBlocks(prev => prev.filter(b => b.id !== block.id));
          setModal(null);
        } catch {
          showError(t('schedule_delete_err'));
        }
      },
    });
  };

  const deleteFromModal = () => {
    if (!modal?.blockId) return;
    const block = blocks.find(b => b.id === modal.blockId);
    if (block) confirmDeleteBlock(block);
  };

  const applyWorkHours = async () => {
    const label = (workLabel || t('schedule_work_default')).trim();
    if (workEnd <= workStart) {
      showError(t('schedule_overlap_err'));
      return;
    }
    if (!selectedWorkDays.length) {
      showError(t('schedule_work_no_days'));
      return;
    }
    setWorkLoading(true);
    try {
      const res = await api.createBulk({
        member_id: activeMember.id,
        week_start: weekStart,
        start_hour: workStart,
        end_hour: workEnd,
        label,
        days: selectedWorkDays,
      });
      const created = res.data.created || [];
      const skipped = res.data.skipped || [];
      if (created.length === 0) {
        showError(t('schedule_work_none'));
      } else {
        setBlocks(prev => [...prev, ...created].sort((a, b) =>
          a.day - b.day || a.start_hour - b.start_hour
        ));
        showSuccess(t('schedule_work_applied')(created.length, skipped.length));
      }
    } catch {
      showError(t('schedule_save_err'));
    } finally {
      setWorkLoading(false);
    }
  };

  const clearWeek = () => {
    if (!blocks.length || !activeMember?.id) return;
    showConfirm({
      title: t('schedule_clear_week'),
      message: t('schedule_clear_week_confirm')(blocks.length),
      confirmLabel: t('schedule_clear_week'),
      onConfirm: async () => {
        setClearLoading(true);
        try {
          await api.clearWeek(activeMember.id, weekStart);
          setBlocks([]);
          showSuccess(t('schedule_clear_week_ok'));
        } catch {
          showError(t('schedule_clear_week_err'));
          loadBlocks();
        } finally {
          setClearLoading(false);
        }
      },
    });
  };

  const isSelected = (day, hour) => {
    if (!selection || selection.day !== day) return false;
    const lo = Math.min(selection.start, selection.end);
    const hi = Math.max(selection.start, selection.end);
    return hour >= lo && hour <= hi;
  };

  const shiftWeek = (delta) => setWeekStart(prev => addDays(prev, delta * 7));

  return (
    <div className="schedule-page">
      <header className="schedule-hero card">
        <div className="schedule-hero-top">
          <div className="schedule-hero-icon">
            <Icon icon="heroicons:clock" width={26} />
          </div>
          <div className="schedule-hero-text">
            <h2 className="schedule-hero-title">{t('schedule_title')}</h2>
            <p className="schedule-hero-subtitle">{t('schedule_subtitle')}</p>
          </div>
          {blocks.length > 0 && (
            <div className="schedule-hero-meta">
              <span className="schedule-hero-count">{t('schedule_blocks_count')(blocks.length)}</span>
            </div>
          )}
        </div>
        <div className="schedule-steps">
          {STEPS.map((step, i) => (
            <div key={step.titleKey} className="schedule-step">
              <span className="schedule-step-num">{i + 1}</span>
              <Icon icon={step.icon} className="schedule-step-icon" width={18} />
              <div className="schedule-step-body">
                <span className="schedule-step-title">{t(step.titleKey)}</span>
                <span className="schedule-step-desc">{t(step.descKey)}</span>
              </div>
            </div>
          ))}
        </div>
      </header>

      <div className="card schedule-toolbar">
        <div className="schedule-week-section">
          <div className="schedule-section-head">
            <Icon icon="heroicons:calendar-days" width={18} className="schedule-section-icon" />
            <span>{t('schedule_week_picker_title')}</span>
          </div>

          <div className="schedule-week-picker">
            <button type="button" className="schedule-nav-btn schedule-nav-btn--text" onClick={() => shiftWeek(-1)}>
              <Icon icon="heroicons:chevron-left" width={16} />
              <span>{t('schedule_prev_week')}</span>
            </button>

            <div className="schedule-week-center">
              <span className="schedule-week-range">{toEU(weekStart)} – {toEU(weekEnd)}</span>
              <span className={`schedule-week-badge ${isCurrentWeek ? 'schedule-week-badge--current' : ''}`}>
                {isCurrentWeek ? t('schedule_current_week_badge') : t('schedule_other_week_badge')}
              </span>
              {!isCurrentWeek && (
                <button type="button" className="schedule-back-link" onClick={() => setWeekStart(currentWeekStart)}>
                  <Icon icon="heroicons:arrow-uturn-left" width={14} />
                  {t('schedule_back_to_current')}
                </button>
              )}
            </div>

            <button type="button" className="schedule-nav-btn schedule-nav-btn--text" onClick={() => shiftWeek(1)}>
              <span>{t('schedule_next_week')}</span>
              <Icon icon="heroicons:chevron-right" width={16} />
            </button>
          </div>

          <p className="schedule-week-hint">
            <Icon icon="heroicons:information-circle" width={15} />
            {t('schedule_week_nav_hint')}
          </p>
        </div>

        <div className="schedule-work-section">
          <div className="schedule-section-head">
            <Icon icon="heroicons:queue-list" width={18} className="schedule-section-icon" />
            <div>
              <span>{t('schedule_work_hours')}</span>
              <p className="schedule-section-desc">{t('schedule_work_desc')}</p>
            </div>
          </div>

          <div className="schedule-work-card">
            <div className="schedule-work-quick">
              <span className="schedule-work-quick-label">{t('schedule_work_quick_label')}</span>
              <div className="schedule-work-quick-input-wrap">
                <Icon icon="heroicons:pencil-square" className="schedule-work-quick-icon" width={18} />
                <input
                  type="text"
                  className="schedule-work-paste"
                  value={workPasteText}
                  maxLength={80}
                  onChange={e => handleWorkPasteChange(e.target.value)}
                  placeholder={t('schedule_work_quick_ph')}
                  aria-label={t('schedule_work_quick_label')}
                />
              </div>
            </div>

            <div className={`schedule-work-summary${workPasteParsed ? ' schedule-work-summary--parsed' : ''}`}>
              <div className="schedule-work-time">
                <input
                  type="text"
                  className="schedule-work-time-input"
                  value={workStartTimeDraft ?? workStartTimeValue}
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="09:00"
                  onFocus={() => setWorkStartTimeDraft(workStartTimeValue)}
                  onChange={e => setWorkStartTimeDraft(e.target.value)}
                  onBlur={e => {
                    const normalized = normalizeTimeInput(e.target.value);
                    if (normalized) handleWorkStartTimeChange(normalized);
                    setWorkStartTimeDraft(null);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                  }}
                  aria-label={t('schedule_work_from')}
                />
                <Icon icon="heroicons:arrow-right" width={14} className="schedule-work-time-arrow" />
                <input
                  type="text"
                  className="schedule-work-time-input"
                  value={workEndTimeDraft ?? workEndTimeValue}
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="17:00"
                  onFocus={() => setWorkEndTimeDraft(workEndTimeValue)}
                  onChange={e => setWorkEndTimeDraft(e.target.value)}
                  onBlur={e => {
                    const normalized = normalizeTimeInput(e.target.value);
                    if (normalized) handleWorkEndTimeChange(normalized);
                    setWorkEndTimeDraft(null);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                  }}
                  aria-label={t('schedule_work_to')}
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
                onChange={e => setWorkLabel(e.target.value)}
                placeholder={t('schedule_work_label_ph')}
                aria-label={t('schedule_work_label')}
              />
            </div>

            <div className="schedule-work-days-row">
              <div className="schedule-work-presets">
                <button
                  type="button"
                  className={`schedule-day-chip ${isPresetActive(selectedWorkDays, WEEKDAYS) ? 'active' : ''}`}
                  onClick={() => toggleWorkPreset(WEEKDAYS)}
                >
                  {t('schedule_work_weekdays')}
                </button>
                <button
                  type="button"
                  className={`schedule-day-chip ${isPresetActive(selectedWorkDays, DAYS) ? 'active' : ''}`}
                  onClick={() => toggleWorkPreset(DAYS)}
                >
                  {t('schedule_work_all_days')}
                </button>
              </div>
              <span className="schedule-work-days-sep" aria-hidden="true" />
              <div className="schedule-work-individual">
                {DAYS.map(d => (
                  <button
                    key={d}
                    type="button"
                    className={`schedule-day-chip schedule-day-chip--day ${selectedWorkDays.includes(d) ? 'active' : ''}`}
                    onClick={() => setSelectedWorkDays(prev => toggleScheduleDay(prev, d))}
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
                {clearLoading ? t('loading') : t('schedule_clear_week')}
              </button>
              <button
                type="button"
                className="btn btn-primary schedule-work-apply"
                onClick={applyWorkHours}
                disabled={workLoading}
              >
                {workLoading ? t('loading') : t('schedule_work_apply')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="schedule-loading">{t('loading')}</div>
        ) : (
          <div className="schedule-wrap">
            <div className="schedule-layout">
              <div className="schedule-corner" />
              {DAYS.map(d => (
                <div key={`h-${d}`} className="schedule-day-head">
                  <span className="schedule-day-name">{dayLabels[d]}</span>
                  <span className="schedule-day-date">{toEU(dayDates[d]).slice(0, 5)}</span>
                </div>
              ))}

              <div className="schedule-body">
                <div className="schedule-time-col">
                  {HOURS.map(hour => (
                    <div
                      key={hour}
                      className={`schedule-time ${isSleepHour(hour) ? 'schedule-cell--sleep' : ''}`}
                    >
                      {formatHour(hour)}
                    </div>
                  ))}
                </div>

                {DAYS.map(day => (
                  <div key={day} className="schedule-day-col">
                    <div className="schedule-day-body" style={{ height: HOURS.length * ROW_H }}>
                      {HOURS.map(hour => (
                        <div
                          key={hour}
                          className={[
                            'schedule-cell',
                            isSleepHour(hour) ? 'schedule-cell--sleep' : '',
                            isSelected(day, hour) ? 'schedule-cell--selecting' : '',
                          ].filter(Boolean).join(' ')}
                          onMouseDown={() => startDrag(day, hour)}
                          onMouseEnter={() => extendDrag(day, hour)}
                        />
                      ))}
                      {blocks.filter(b => b.day === day).map(block => (
                        <div
                          key={block.id}
                          className="schedule-block"
                          style={{
                            top: block.start_hour * ROW_H + 1,
                            height: (block.end_hour - block.start_hour) * ROW_H - 2,
                            background: blockColor(block),
                          }}
                          onMouseDown={e => e.stopPropagation()}
                          onClick={() => openEditModal(block)}
                          title={t('schedule_click_edit')}
                        >
                          {block.label}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {modal && (
        <div className="schedule-modal-backdrop" onMouseDown={() => setModal(null)}>
          <div className="schedule-modal" onMouseDown={e => e.stopPropagation()}>
            <h3>{modal.blockId ? t('schedule_edit_activity') : t('schedule_add_activity')}</h3>
            <p className="schedule-modal-day">{dayLabels[modal.day]}</p>

            <label className="schedule-modal-label">{t('schedule_activity_hours')}</label>
            <div className="schedule-modal-times">
              <input
                type="text"
                className="schedule-modal-time-input"
                value={modalStartDraft ?? hourToTimeInputValue(modal.start_hour, 0)}
                inputMode="numeric"
                maxLength={5}
                placeholder="09:00"
                onFocus={() => setModalStartDraft(hourToTimeInputValue(modal.start_hour, 0))}
                onChange={e => setModalStartDraft(e.target.value)}
                onBlur={e => {
                  const normalized = normalizeTimeInput(e.target.value);
                  if (normalized) updateModalStart(normalized);
                  setModalStartDraft(null);
                }}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                aria-label={t('schedule_work_from')}
              />
              <Icon icon="heroicons:arrow-right" width={14} className="schedule-modal-time-arrow" />
              <input
                type="text"
                className="schedule-modal-time-input"
                value={modalEndDraft ?? endHourToModalTime(modal.end_hour)}
                inputMode="numeric"
                maxLength={5}
                placeholder="17:00"
                onFocus={() => setModalEndDraft(endHourToModalTime(modal.end_hour))}
                onChange={e => setModalEndDraft(e.target.value)}
                onBlur={e => {
                  const raw = e.target.value.trim();
                  if (raw === '24:00' || raw === '24') {
                    updateModalEnd(raw);
                  } else {
                    const normalized = normalizeTimeInput(raw);
                    if (normalized) updateModalEnd(normalized);
                  }
                  setModalEndDraft(null);
                }}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                aria-label={t('schedule_work_to')}
              />
            </div>

            <label className="schedule-modal-label">{t('schedule_activity_name')}</label>
            <input
              type="text"
              autoFocus={!modal.blockId}
              maxLength={120}
              placeholder={t('schedule_activity_name')}
              value={labelInput}
              onChange={e => setLabelInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') saveModal();
                if (e.key === 'Escape') setModal(null);
              }}
            />

            <div className="schedule-modal-actions">
              {modal.blockId && (
                <button type="button" className="btn btn-danger schedule-modal-delete" onClick={deleteFromModal}>
                  {t('delete')}
                </button>
              )}
              <div className="schedule-modal-actions-right">
                <button type="button" className="btn" onClick={() => setModal(null)}>{t('cancel')}</button>
                <button type="button" className="btn btn-primary" onClick={saveModal} disabled={!labelInput.trim()}>
                  <Icon icon="heroicons:check" width={16} style={{ marginRight: 4, verticalAlign: 'text-bottom' }} />
                  {t('save_btn')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
