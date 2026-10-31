/**
 * Break utility helpers for shift-wise break schedules, remaining time,
 * exceeded break penalties, and working hours calculation.
 */

export const parseTimeString = (timeStr) => {
  try {
    const match = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return { hours: 9, minutes: 0 };
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3] ? match[3].toUpperCase() : null;
    if (period === 'PM' && hours !== 12) hours += 12;
    else if (period === 'AM' && hours === 12) hours = 0;
    return { hours, minutes: minutes || 0 };
  } catch (error) {
    return { hours: 9, minutes: 0 };
  }
};

export const getBreakScheduleInfo = (breakType, shiftConfig) => {
  if (!shiftConfig) return null;
  let startStr = null, endStr = null, allowAnytime = false;

  if (breakType === 'Lunch Break') {
    startStr = shiftConfig.lunchStartTime || shiftConfig.lunchTime;
    endStr = shiftConfig.lunchEndTime;
    allowAnytime = Boolean(shiftConfig.allowLunchAnytime);
  } else if (breakType === '1st Refreshment Break') {
    startStr = shiftConfig.refreshment1StartTime;
    endStr = shiftConfig.refreshment1EndTime;
    allowAnytime = Boolean(shiftConfig.allowRefreshment1Anytime);
  } else if (breakType === '2nd Refreshment Break') {
    startStr = shiftConfig.refreshment2StartTime;
    endStr = shiftConfig.refreshment2EndTime;
    allowAnytime = Boolean(shiftConfig.allowRefreshment2Anytime);
  } else if (breakType === 'Tea Break' || breakType === 'Refreshment Break') {
    startStr = shiftConfig.refreshment1StartTime;
    endStr = shiftConfig.refreshment1EndTime;
    allowAnytime = Boolean(shiftConfig.allowRefreshment1Anytime);
  }

  if (!startStr || !endStr) {
    if (allowAnytime) {
      return { startStr: 'Anytime', endStr: 'Anytime', allowAnytime: true, windowDuration: breakType === 'Lunch Break' ? 30 : 15 };
    }
    return null;
  }

  const sP = parseTimeString(startStr);
  const eP = parseTimeString(endStr);
  let windowDuration = (eP.hours * 60 + eP.minutes) - (sP.hours * 60 + sP.minutes);
  if (windowDuration < 0) windowDuration += 1440;

  return { startStr, endStr, allowAnytime, windowDuration };
};

export const getBreakWindowStatus = (breakType, shiftConfig, now = new Date()) => {
  const info = getBreakScheduleInfo(breakType, shiftConfig);
  if (!info || info.allowAnytime) {
    return { canStart: true, windowStatus: 'open', message: null, allowedMins: info ? info.windowDuration : 15 };
  }

  const sP = parseTimeString(info.startStr);
  const eP = parseTimeString(info.endStr);
  const currentTotalMins = now.getHours() * 60 + now.getMinutes();

  const startMins = sP.hours * 60 + sP.minutes;
  const endMins = eP.hours * 60 + eP.minutes;

  if (currentTotalMins < startMins) {
    return {
      canStart: false,
      windowStatus: 'early',
      message: `Window opens at ${info.startStr}. You cannot take this break before ${info.startStr}.`,
      allowedMins: 0,
      info
    };
  }

  if (currentTotalMins >= endMins) {
    return {
      canStart: false,
      windowStatus: 'ended',
      message: `Window ended at ${info.endStr}. You can no longer take this break today.`,
      allowedMins: 0,
      info
    };
  }

  // Currently inside window
  const remainingMins = Math.max(0, endMins - currentTotalMins);
  const allowedMins = Math.min(info.windowDuration, remainingMins);
  const lateMins = Math.max(0, currentTotalMins - startMins);

  let note = null;
  if (lateMins > 0) {
    note = `Starting ${lateMins} min late leaves ${allowedMins} min break (ends at ${info.endStr}). Any time taken past ${info.endStr} will be subtracted from your working hours.`;
  } else {
    note = `Break window is ${info.startStr} – ${info.endStr} (${allowedMins} min limit).`;
  }

  return {
    canStart: true,
    windowStatus: 'open',
    message: note,
    allowedMins,
    lateMins,
    info
  };
};

export const calculateActiveBreakStatus = (activeBreak, shiftConfig, elapsedSecs) => {
  if (!activeBreak) return null;
  const breakType = activeBreak.breakType || activeBreak.type;
  const info = getBreakScheduleInfo(breakType, shiftConfig);

  const start = new Date(activeBreak.startTime);
  let allowedDurationMins = activeBreak.allowedDuration;

  let scheduledStartTime = activeBreak.scheduledStartTime || (info ? info.startStr : null);
  let scheduledEndTime = activeBreak.scheduledEndTime || (info ? info.endStr : null);
  let windowDuration = info ? info.windowDuration : (breakType === 'Lunch Break' ? 30 : 15);

  if (!allowedDurationMins) {
    if (info && !info.allowAnytime && scheduledEndTime) {
      const eP = parseTimeString(scheduledEndTime);
      const schedEnd = new Date(start);
      schedEnd.setHours(eP.hours, eP.minutes, 0, 0);
      if (schedEnd < start && eP.hours < 12) schedEnd.setDate(schedEnd.getDate() + 1);
      allowedDurationMins = Math.max(0, Math.round((schedEnd - start) / 60000));
      allowedDurationMins = Math.min(windowDuration, allowedDurationMins);
    } else {
      allowedDurationMins = windowDuration;
    }
  }

  const allowedSecs = (allowedDurationMins || 15) * 60;
  const isExceeded = elapsedSecs > allowedSecs;
  const exceededSecs = isExceeded ? elapsedSecs - allowedSecs : 0;
  const remainingSecs = !isExceeded ? allowedSecs - elapsedSecs : 0;

  return {
    breakType,
    scheduledStartTime,
    scheduledEndTime,
    allowedDurationMins,
    allowedSecs,
    isExceeded,
    exceededSecs,
    remainingSecs,
    exceededMinutes: Math.ceil(exceededSecs / 60)
  };
};

export const calculateBreakDeductionSecs = (b, shiftConfig, now = new Date()) => {
  if (b.breakType === 'Other' || b.breakType === 'Briefing/Meeting' || b.breakType === 'Breifing/Meeting') {
    return 0; // Ignore
  }

  const start = new Date(b.startTime);
  const end = b.endTime ? new Date(b.endTime) : now;
  const actualDurSecs = Math.max(0, Math.round((end - start) / 1000));

  const info = getBreakScheduleInfo(b.breakType, shiftConfig);
  let windowDurationSecs = (info ? info.windowDuration : (b.breakType === 'Lunch Break' ? 30 : 15)) * 60;
  let scheduledEndStr = b.scheduledEndTime || (info ? info.endStr : null);

  let exceededSecs = 0;
  if (b.exceededMinutes !== undefined && b.exceededMinutes !== null && b.exceededMinutes > 0) {
    exceededSecs = b.exceededMinutes * 60;
  } else if (scheduledEndStr && scheduledEndStr !== 'Anytime' && (!info || !info.allowAnytime)) {
    const eP = parseTimeString(scheduledEndStr);
    const schedEnd = new Date(start);
    schedEnd.setHours(eP.hours, eP.minutes, 0, 0);
    if (schedEnd < start && eP.hours < 12) schedEnd.setDate(schedEnd.getDate() + 1);
    if (end > schedEnd) {
      exceededSecs = Math.max(0, Math.round((end - schedEnd) / 1000));
    }
  } else {
    const allowedSecs = (b.allowedDuration ? b.allowedDuration * 60 : windowDurationSecs);
    if (actualDurSecs > allowedSecs) {
      exceededSecs = actualDurSecs - allowedSecs;
    }
  }

  if (exceededSecs > 0) {
    return windowDurationSecs + exceededSecs;
  } else {
    return actualDurSecs;
  }
};


export const formatDurationHMS = (seconds) => {
  const s = Math.max(0, Math.floor(seconds || 0));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export const getBreakExceededSeconds = (b, shiftConfig, now = new Date()) => {
  if (!b) return 0;
  if (b.breakType === 'Other' || b.breakType === 'Briefing/Meeting' || b.breakType === 'Breifing/Meeting') {
    return 0;
  }

  if (b.exceededSeconds !== undefined && b.exceededSeconds !== null && b.exceededSeconds > 0) {
    return b.exceededSeconds;
  }

  const start = new Date(b.startTime);
  const end = b.endTime ? new Date(b.endTime) : now;
  const actualDurSecs = Math.max(0, Math.round((end - start) / 1000));

  const info = getBreakScheduleInfo(b.breakType, shiftConfig);
  let windowDurationSecs = (info ? info.windowDuration : (b.breakType === 'Lunch Break' ? 30 : 15)) * 60;
  let scheduledEndStr = b.scheduledEndTime || (info ? info.endStr : null);

  if (scheduledEndStr && scheduledEndStr !== 'Anytime' && (!info || !info.allowAnytime)) {
    const eP = parseTimeString(scheduledEndStr);
    const schedEnd = new Date(start);
    schedEnd.setHours(eP.hours, eP.minutes, 0, 0);
    if (schedEnd < start && eP.hours < 12) schedEnd.setDate(schedEnd.getDate() + 1);
    if (end > schedEnd) {
      return Math.max(0, Math.round((end - schedEnd) / 1000));
    }
    return 0;
  } else {
    const allowedSecs = (b.allowedDuration ? b.allowedDuration * 60 : windowDurationSecs);
    if (actualDurSecs > allowedSecs) {
      return actualDurSecs - allowedSecs;
    }
    return 0;
  }
};

export const formatExceededTime = (exceededSecs) => {
  if (!exceededSecs || exceededSecs <= 0) return '';
  const mins = Math.floor(exceededSecs / 60);
  const secs = Math.floor(exceededSecs % 60);
  if (mins > 0 && secs > 0) {
    return `${mins}m ${secs}s`;
  } else if (mins > 0) {
    return `${mins}m`;
  } else {
    return `${secs}s`;
  }
};
