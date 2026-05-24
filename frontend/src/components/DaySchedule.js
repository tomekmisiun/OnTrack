import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { daySchedule as api } from '../api';
import { useLanguage } from '../contexts/LanguageContext';
import { useMember } from '../contexts/MemberContext';
import { useToast } from '../contexts/ToastContext';
import { getCurrentWeek, addDays, toEU } from '../utils/dates';
import './DaySchedule.css';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);
const END_HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i + 1);
const DAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [0, 1, 2, 3, 4];
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

function formatRange(start, end, dayLabel) {
  const endDisplay = end === 24 ? '24:00' : formatHour(end);
  return `${dayLabel}, ${formatHour(start)}–${endDisplay}`;
}

export default function DaySchedule() {
  const { t } = useLanguage();
  const { activeMember } = useMember();
  const { showError, showSuccess } = useToast();

  const currentWeekStart = getCurrentWeek().start;
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [selection, setSelection] = useState(null);
  const [modal, setModal] = useState(null);
  const [labelInput, setLabelInput] = useState('');
  const [workStart, setWorkStart] = useState(9);
  const [workEnd, setWorkEnd] = useState(17);
  const [workLabel, setWorkLabel] = useState('');
  const [workAllDays, setWorkAllDays] = useState(false);
  const [workLoading, setWorkLoading] = useState(false);
  const dragRef = useRef(null);

  const dayLabels = t('day_short');
  const weekEnd = addDays(weekStart, 6);
  const isCurrentWeek = weekStart === currentWeekStart;

  useEffect(() => {
    setWorkLabel(t('schedule_work_default'));
  }, [t]);

  useEffect(() => {
    if (workEnd <= workStart) setWorkEnd(Math.min(workStart + 1, 24));
  }, [workStart, workEnd]);

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
    setSelection(null);
    dragRef.current = null;
  };

  useEffect(() => {
    const up = () => { if (dragging) finishDrag(); };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  });

  const saveBlock = async () => {
    const label = labelInput.trim();
    if (!label || !modal) return;
    try {
      const res = await api.create({
        ...modal,
        label,
        member_id: activeMember.id,
      });
      setBlocks(prev => [...prev, res.data].sort((a, b) =>
        a.day - b.day || a.start_hour - b.start_hour
      ));
      setModal(null);
      showSuccess(t('schedule_saved'));
    } catch (err) {
      if (err.response?.status === 409) showError(t('schedule_overlap_err'));
      else showError(t('schedule_save_err'));
    }
  };

  const applyWorkHours = async () => {
    const label = (workLabel || t('schedule_work_default')).trim();
    if (workEnd <= workStart) {
      showError(t('schedule_overlap_err'));
      return;
    }
    setWorkLoading(true);
    try {
      const days = workAllDays ? DAYS : WEEKDAYS;
      const res = await api.createBulk({
        member_id: activeMember.id,
        week_start: weekStart,
        start_hour: workStart,
        end_hour: workEnd,
        label,
        days,
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

  const deleteBlock = async (block) => {
    if (!window.confirm(t('schedule_delete_confirm'))) return;
    try {
      await api.delete(block.id);
      setBlocks(prev => prev.filter(b => b.id !== block.id));
    } catch {
      showError(t('schedule_delete_err'));
    }
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
            <Icon icon="heroicons:briefcase" width={18} className="schedule-section-icon" />
            <div>
              <span>{t('schedule_work_hours')}</span>
              <p className="schedule-section-desc">{t('schedule_work_desc')}</p>
            </div>
          </div>

          <div className="schedule-work-grid">
            <label className="schedule-work-field">
              <span>{t('schedule_work_from')}</span>
              <select value={workStart} onChange={e => setWorkStart(Number(e.target.value))}>
                {HOUR_OPTIONS.map(h => <option key={h} value={h}>{formatHour(h)}</option>)}
              </select>
            </label>
            <label className="schedule-work-field">
              <span>{t('schedule_work_to')}</span>
              <select value={workEnd} onChange={e => setWorkEnd(Number(e.target.value))}>
                {END_HOUR_OPTIONS.filter(h => h > workStart).map(h => (
                  <option key={h} value={h}>{h === 24 ? '24:00' : formatHour(h)}</option>
                ))}
              </select>
            </label>
            <label className="schedule-work-field schedule-work-field--grow">
              <span>{t('schedule_work_label')}</span>
              <input
                type="text"
                maxLength={120}
                value={workLabel}
                onChange={e => setWorkLabel(e.target.value)}
                placeholder={t('schedule_work_default')}
              />
            </label>
            <div className="schedule-work-field">
              <span>{t('schedule_work_days_label')}</span>
              <div className="schedule-work-days">
                <button
                  type="button"
                  className={`schedule-day-chip ${!workAllDays ? 'active' : ''}`}
                  onClick={() => setWorkAllDays(false)}
                >
                  {t('schedule_work_weekdays')}
                </button>
                <button
                  type="button"
                  className={`schedule-day-chip ${workAllDays ? 'active' : ''}`}
                  onClick={() => setWorkAllDays(true)}
                >
                  {t('schedule_work_all_days')}
                </button>
              </div>
            </div>
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
                          onClick={() => deleteBlock(block)}
                          title={t('schedule_click_delete')}
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
            <h3>{t('schedule_add_activity')}</h3>
            <div className="schedule-modal-meta">
              {formatRange(modal.start_hour, modal.end_hour, dayLabels[modal.day])}
            </div>
            <input
              type="text"
              autoFocus
              maxLength={120}
              placeholder={t('schedule_activity_name')}
              value={labelInput}
              onChange={e => setLabelInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveBlock(); if (e.key === 'Escape') setModal(null); }}
            />
            <div className="schedule-modal-actions">
              <button type="button" className="btn" onClick={() => setModal(null)}>{t('cancel')}</button>
              <button type="button" className="btn btn-primary" onClick={saveBlock} disabled={!labelInput.trim()}>
                <Icon icon="heroicons:plus" width={16} style={{ marginRight: 4, verticalAlign: 'text-bottom' }} />
                {t('save_btn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
