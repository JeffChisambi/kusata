/**
 * Practice (virtual trading) dashboard.
 *
 * This branch runs against a VIRTUAL_TRADING server: investors trade play
 * money, need no KYC, and their orders fill the moment they are placed, so
 * there is no execution queue, nothing to verify and nothing to pay out.
 * Sections that only exist for real money are hidden, and every page
 * carries a banner so a practice dashboard is never mistaken for the real
 * one.
 */
export const PRACTICE_MODE = true;

/** Sections that have no meaning when no real money moves. */
export const PRACTICE_HIDDEN_ROUTES = new Set(["/kyc", "/withdrawals", "/treasury"]);
