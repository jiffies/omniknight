type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

type LocalDate = Pick<ZonedDateParts, 'year' | 'month' | 'day'>;

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

function getDateTimeFormatter(timeZone: string): Intl.DateTimeFormat {
  const existing = dateTimeFormatters.get(timeZone);
  if (existing) {
    return existing;
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  dateTimeFormatters.set(timeZone, formatter);
  return formatter;
}

function getPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  const value = parts.find((part) => part.type === type)?.value;
  if (!value) {
    throw new Error(`Unable to read ${type} from formatted date`);
  }

  return Number.parseInt(value, 10);
}

function getZonedDateParts(date: Date, timeZone: string): ZonedDateParts {
  const parts = getDateTimeFormatter(timeZone).formatToParts(date);

  return {
    year: getPart(parts, 'year'),
    month: getPart(parts, 'month'),
    day: getPart(parts, 'day'),
    hour: getPart(parts, 'hour'),
    minute: getPart(parts, 'minute'),
    second: getPart(parts, 'second'),
  };
}

function getOffsetMs(timeZone: string, date: Date): number {
  const parts = getZonedDateParts(date, timeZone);
  const zonedAsUtcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const dateMsWithoutMilliseconds = Math.floor(date.getTime() / 1000) * 1000;

  return zonedAsUtcMs - dateMsWithoutMilliseconds;
}

function zonedDateTimeToUtc(parts: ZonedDateParts, timeZone: string): Date {
  const localAsUtcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  let utcMs = localAsUtcMs;

  for (let index = 0; index < 3; index++) {
    const offsetMs = getOffsetMs(timeZone, new Date(utcMs));
    const nextUtcMs = localAsUtcMs - offsetMs;

    if (Math.abs(nextUtcMs - utcMs) < 1000) {
      utcMs = nextUtcMs;
      break;
    }

    utcMs = nextUtcMs;
  }

  return new Date(utcMs);
}

function addDays(date: LocalDate, days: number): LocalDate {
  const utcNoon = new Date(Date.UTC(date.year, date.month - 1, date.day + days, 12));

  return {
    year: utcNoon.getUTCFullYear(),
    month: utcNoon.getUTCMonth() + 1,
    day: utcNoon.getUTCDate(),
  };
}

function parseStartTime(startTime: string): { hour: number; minute: number } {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(startTime);
  if (!match) {
    throw new Error(`Invalid summary start time: ${startTime}`);
  }

  const hour = match[1];
  const minute = match[2];

  if (!hour || !minute) {
    throw new Error(`Invalid summary start time: ${startTime}`);
  }

  return {
    hour: Number.parseInt(hour, 10),
    minute: Number.parseInt(minute, 10),
  };
}

function getAnchorsForLocalDate(
  localDate: LocalDate,
  startTime: string,
  intervalHours: number,
  timeZone: string,
): Date[] {
  const { hour, minute } = parseStartTime(startTime);
  const startMinuteOfDay = hour * 60 + minute;
  const intervalMinutes = intervalHours * 60;
  const anchors: Date[] = [];

  for (let minuteOfDay = startMinuteOfDay; minuteOfDay < 24 * 60; minuteOfDay += intervalMinutes) {
    anchors.push(
      zonedDateTimeToUtc(
        {
          ...localDate,
          hour: Math.floor(minuteOfDay / 60),
          minute: minuteOfDay % 60,
          second: 0,
        },
        timeZone,
      ),
    );
  }

  return anchors;
}

export function validateTimeZone(timeZone: string): void {
  try {
    getDateTimeFormatter(timeZone).format(new Date());
  } catch (error) {
    throw new Error(
      `Invalid SCHEDULER_TIMEZONE "${timeZone}". Use an IANA timezone such as Asia/Shanghai.`,
      { cause: error },
    );
  }
}

export function getMostRecentScheduleAnchor(
  now: Date,
  startTime: string,
  intervalHours: number,
  timeZone: string,
): Date {
  if (!Number.isInteger(intervalHours) || intervalHours < 1 || intervalHours > 24) {
    throw new Error(`Invalid summary interval: ${intervalHours}`);
  }

  validateTimeZone(timeZone);

  const currentLocalDate = getZonedDateParts(now, timeZone);
  const localDates = [addDays(currentLocalDate, -1), currentLocalDate];
  let latestAnchor: Date | null = null;

  for (const localDate of localDates) {
    for (const anchor of getAnchorsForLocalDate(localDate, startTime, intervalHours, timeZone)) {
      if (anchor.getTime() <= now.getTime() && (!latestAnchor || anchor > latestAnchor)) {
        latestAnchor = anchor;
      }
    }
  }

  if (!latestAnchor) {
    throw new Error('Unable to find a schedule anchor before the current time');
  }

  return latestAnchor;
}
