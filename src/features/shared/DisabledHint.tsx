import React from 'react';

interface DisabledHintProps {
  /** Show the hint only while the wrapped control is actually disabled for this reason. */
  when: boolean;
  /** The explanation shown on hover (native tooltip). */
  hint: string;
  /**
   * Display/layout classes for the wrapper. A disabled <button> swallows pointer
   * events, so the wrapper must take the button's layout role — pass the same
   * sizing the button had (e.g. 'flex w-full', 'inline-flex'). Defaults to inline-flex.
   */
  className?: string;
  children: React.ReactNode;
}

/**
 * Explains WHY a control is inactive. A `title` on a disabled element is
 * unreliable — browsers (incl. the Chromium WebView) suppress pointer events on
 * disabled controls, so their own tooltip never fires. Putting the `title` on this
 * always-hoverable wrapper fixes that. When `when` is false the wrapper is inert
 * (no title), so an enabled control reads normally and shows no tooltip.
 */
export const DisabledHint: React.FC<DisabledHintProps> = ({ when, hint, className, children }) => (
  <span title={when ? hint : undefined} className={className ?? 'inline-flex'}>
    {children}
  </span>
);
