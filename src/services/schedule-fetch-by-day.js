import dayjs from "dayjs";
import { apiConfig } from "./api-config.js";

/**
 * Fetch schedules from the API and return the ones matching the provided date.
 * - If no `date` is provided, returns all schedules.
 * - Robust to network errors and returns an empty array on failure.
 *
 * @param {{ date?: string|Date }} params
 * @returns {Promise<Array>} daily schedules (or all schedules if no date provided)
 */
export async function scheduleFetchByDay({ date } = {}) {
  const url = `${apiConfig.baseURL}/schedules`;
  const timeoutMs = 10000; // 10s timeout for the request

  try {
    console.debug("scheduleFetchByDay: starting fetch", { url, date });

    // Use AbortController to enforce a timeout so the UI won't hang indefinitely.
    const controller = new AbortController();
    const signal = controller.signal;
    const timeout = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    const response = await fetch(url, { signal });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error("scheduleFetchByDay: network response not ok", {
        status: response.status,
        statusText: response.statusText,
      });
      return [];
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      console.warn(
        "scheduleFetchByDay: unexpected response shape, expected array:",
        data,
      );
      return [];
    }

    console.debug("scheduleFetchByDay: total schedules received", data.length);

    // If no date provided, return all schedules to allow callers to use them as needed.
    if (!date) {
      console.debug(
        "scheduleFetchByDay: no date provided, returning all schedules",
      );
      return data;
    }

    const selectedDay = dayjs(date);
    if (!selectedDay.isValid()) {
      console.warn("scheduleFetchByDay: provided date is invalid", { date });
      return [];
    }

    const dailySchedules = data.filter((schedule) => {
      // Ensure schedule.when exists and is parseable
      if (!schedule || !schedule.when) return false;
      const scheduleDay = dayjs(schedule.when);
      if (!scheduleDay.isValid()) {
        console.warn(
          "scheduleFetchByDay: encountered schedule with invalid date",
          schedule,
        );
        return false;
      }
      return scheduleDay.isSame(selectedDay, "day");
    });

    console.debug(
      "scheduleFetchByDay: daily schedules found",
      dailySchedules.length,
    );
    return dailySchedules;
  } catch (error) {
    if (error.name === "AbortError") {
      console.error("scheduleFetchByDay: request aborted due to timeout", {
        timeoutMs,
      });
    } else {
      console.error("scheduleFetchByDay: unexpected error", error);
    }
    // Return empty array so callers can handle gracefully without extra null checks.
    return [];
  }
}
