// Lightweight logger wrapper used to centralize console usage.
// It conditionally logs only in development and keeps ESLint happy by
// isolating the `console` calls behind a small API.

export const logError = (...args) => {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.error(...args);
  }
};

export const logInfo = (...args) => {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
};
