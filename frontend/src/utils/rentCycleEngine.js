// frontend/src/utils/rentCycleEngine.js
// Tenant Move-In Date Rent Calculation Engine for PropConnect Frontend

const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function pad(n) {
  return String(n).padStart(2, "0");
}

export function formatYMD(date) {
  if (!date || isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatDisplayDate(date) {
  if (!date || isNaN(date.getTime())) return "";
  const d = pad(date.getDate());
  const m = MONTH_NAMES_SHORT[date.getMonth()];
  const y = date.getFullYear();
  return `${d} ${m} ${y}`;
}

export function getDaysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function parseFlexibleDate(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate());
  }

  const str = String(dateInput).trim();

  // 1. ISO YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  }

  // 2. "DD Mon YYYY" e.g. "10 Oct 2026" or "01 Jan 2026"
  const dmyMatch = str.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const mStr = dmyMatch[2].toLowerCase().slice(0, 3);
    const mIdx = MONTH_NAMES_SHORT.findIndex((m) => m.toLowerCase() === mStr);
    const year = Number(dmyMatch[3]);
    if (mIdx !== -1) {
      return new Date(year, mIdx, day);
    }
  }

  // 3. Native parse fallback
  const fallback = new Date(str);
  if (!isNaN(fallback.getTime())) {
    return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
  }

  return null;
}

export function getOrdinalSuffix(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Calculates a specific N-th rent cycle starting from the lease start date.
 * Handles month day-clamping (e.g., leases starting on the 31st or custom due day).
 */
export function getNthRentCycle(startDateInput, cycleIndex = 0, customDueDay = null) {
  const start = parseFlexibleDate(startDateInput);
  if (!start) return null;

  const initialYear = start.getFullYear();
  const initialMonth = start.getMonth();
  const moveInDay = customDueDay && Number(customDueDay) >= 1 && Number(customDueDay) <= 31
    ? Number(customDueDay)
    : start.getDate();

  // Current cycle start
  const totMonth = initialMonth + cycleIndex;
  const yearK = initialYear + Math.floor(totMonth / 12);
  const monthK = ((totMonth % 12) + 12) % 12;
  const daysInCurrentMonth = getDaysInMonth(yearK, monthK);
  const actualStartDay = Math.min(moveInDay, daysInCurrentMonth);
  const cycleStartDate = new Date(yearK, monthK, actualStartDay);

  // Next cycle start
  const nextTotMonth = initialMonth + cycleIndex + 1;
  const nextYear = initialYear + Math.floor(nextTotMonth / 12);
  const nextMonth = ((nextTotMonth % 12) + 12) % 12;
  const daysInNextMonth = getDaysInMonth(nextYear, nextMonth);
  const nextStartDay = Math.min(moveInDay, daysInNextMonth);
  const nextCycleStartDate = new Date(nextYear, nextMonth, nextStartDay);

  // Cycle ends 1 day before the next cycle starts
  const cycleEndDate = new Date(nextCycleStartDate.getTime() - 86400000);

  return {
    cycleIndex,
    cycleStartDate,
    cycleEndDate,
    nextCycleStartDate,
    periodStart: formatYMD(cycleStartDate),
    periodEnd: formatYMD(cycleEndDate),
    nextDueDate: formatYMD(nextCycleStartDate),
    currentDueDate: formatYMD(cycleStartDate),
    periodLabel: `${formatDisplayDate(cycleStartDate)} – ${formatDisplayDate(cycleEndDate)}`,
    currentDueDateFormatted: formatDisplayDate(cycleStartDate),
    nextDueDateFormatted: formatDisplayDate(nextCycleStartDate),
  };
}

/**
 * Calculates the tenant's current active rent cycle and payment status
 * based on their lease move-in date, personalized due dates, and existing payment history.
 */
export function calculateTenantRentCycle(lease, referenceDateInput = new Date(), payments = []) {
  if (!lease) return null;

  const startDate = parseFlexibleDate(lease.startDate || lease.start_date || "2026-10-10");
  const endDate = parseFlexibleDate(lease.endDate || lease.end_date);
  const refDate = parseFlexibleDate(referenceDateInput) || new Date();

  if (!startDate) return null;

  const customDueDay = lease.dueDay || lease.due_day || null;
  const moveInDay = startDate.getDate();
  const effectiveDueDay = customDueDay && Number(customDueDay) >= 1 && Number(customDueDay) <= 31
    ? Number(customDueDay)
    : moveInDay;
  const reminderThreshold = Math.max(5, Number(lease.reminderDaysBefore || lease.reminder_days_before || 5));

  let rentAmount = Number(lease.monthlyRent || lease.monthly_rent || lease.rent || 0);
  if (!rentAmount || rentAmount <= 0) {
    if (lease.property && (lease.property.rent || lease.property.monthlyRent)) {
      rentAmount = Number(lease.property.rent || lease.property.monthlyRent);
    } else if (lease.propertyRent) {
      rentAmount = Number(lease.propertyRent);
    } else {
      const idStr = String((lease.id || "") + " " + (lease.propertyName || "")).toLowerCase();
      if (idStr.includes("storage") || idStr.includes("-s")) {
        rentAmount = 7000;
      } else if (idStr.includes("parking") || idStr.includes("-p")) {
        rentAmount = 10000;
      } else {
        rentAmount = 22000;
      }
    }
  }

  // Determine active cycle index relative to refDate
  let activeIndex = 0;

  if (refDate < startDate) {
    activeIndex = 0;
  } else {
    for (let k = 0; k < 60; k++) {
      const cycle = getNthRentCycle(startDate, k, effectiveDueDay);
      if (!cycle) break;

      if (refDate >= cycle.cycleStartDate && refDate <= cycle.cycleEndDate) {
        activeIndex = k;
        break;
      }

      if (k > 0 && refDate < cycle.cycleStartDate) {
        activeIndex = Math.max(0, k - 1);
        break;
      }
      activeIndex = k;
    }
  }

  const currentCycle = getNthRentCycle(startDate, activeIndex, effectiveDueDay);
  const nextCycle = getNthRentCycle(startDate, activeIndex + 1, effectiveDueDay);

  const currentInvoiceNo = `INV-RENT-${lease.id}-${currentCycle.periodStart}`;
  const periodLabel = currentCycle.periodLabel;

  const matchingPayment = payments.find((p) => {
    if (p.invoiceNo === currentInvoiceNo || p.invoice_no === currentInvoiceNo) return true;
    if (p.periodStart === currentCycle.periodStart) return true;
    if (p.month === periodLabel) return true;
    if (
      p.leaseId === lease.id &&
      p.status === "Paid" &&
      p.paidDate &&
      p.paidDate >= currentCycle.periodStart &&
      p.paidDate <= currentCycle.periodEnd
    ) {
      return true;
    }
    return false;
  });

  const isPaid = matchingPayment && matchingPayment.status === "Paid";

  const todayTime = refDate.getTime();
  const dueDateTime = currentCycle.cycleStartDate.getTime();
  const diffDays = Math.round((todayTime - dueDateTime) / 86400000);

  let paymentStatus = "Unpaid";
  let daysOverdue = 0;
  let daysRemaining = 0;
  let isDueSoon = false;
  let isOverdue = false;

  if (isPaid) {
    paymentStatus = "Paid";
  } else if (diffDays > 0) {
    paymentStatus = "Overdue";
    daysOverdue = diffDays;
    isOverdue = true;
  } else if (diffDays === 0) {
    paymentStatus = "Due Today";
    isDueSoon = true;
  } else if (Math.abs(diffDays) <= reminderThreshold) {
    paymentStatus = "Due Soon";
    daysRemaining = Math.abs(diffDays);
    isDueSoon = true;
  } else {
    paymentStatus = "Pending";
    daysRemaining = Math.abs(diffDays);
  }

  const isLeaseActive = !endDate || refDate <= endDate;
  const isPersonalized = Boolean(customDueDay && Number(customDueDay) !== moveInDay);

  return {
    leaseId: lease.id,
    tenantId: lease.tenantId || lease.tenant_id,
    tenantName: lease.tenantName || lease.tenant_name || "Resident Tenant",
    propertyId: lease.propertyId || lease.property_id,
    propertyName: lease.propertyName || lease.property_name || "Rental Unit",
    moveInDate: formatDisplayDate(startDate),
    moveInDateISO: formatYMD(startDate),
    moveInDay,
    moveInDayOrdinal: getOrdinalSuffix(moveInDay),
    dueDay: effectiveDueDay,
    dueDayOrdinal: getOrdinalSuffix(effectiveDueDay),
    isPersonalizedDueDate: isPersonalized,
    reminderDaysBefore: reminderThreshold,
    rentAmount,
    cycleIndex: activeIndex,
    periodStart: currentCycle.periodStart,
    periodEnd: currentCycle.periodEnd,
    periodLabel: currentCycle.periodLabel,
    currentDueDate: currentCycle.currentDueDate,
    currentDueDateFormatted: currentCycle.currentDueDateFormatted,
    dueDate: currentCycle.currentDueDate,
    dueDateFormatted: currentCycle.currentDueDateFormatted,
    nextDueDate: currentCycle.nextDueDate,
    nextDueDateFormatted: currentCycle.nextDueDateFormatted,
    paymentStatus,
    isPaid,
    isDueSoon,
    isOverdue,
    daysOverdue,
    daysRemaining,
    daysUntilDue: daysRemaining,
    invoiceNo: currentInvoiceNo,
    existingPayment: matchingPayment || null,
    isLeaseActive,
    cycleRuleDescription: isPersonalized
      ? `Personalized rent cycle: Rent is due on the ${getOrdinalSuffix(effectiveDueDay)} of each month (move-in date: ${formatDisplayDate(startDate)}). Automatic payment reminders dispatched ${reminderThreshold} days prior to due date.`
      : `Rent cycle runs from the ${getOrdinalSuffix(moveInDay)} of each month. Payment reminders dispatched at least 5 days before payment. Next rent due on ${currentCycle.currentDueDateFormatted || currentCycle.nextDueDateFormatted}.`,
  };
}
