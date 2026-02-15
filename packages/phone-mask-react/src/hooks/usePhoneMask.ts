import { useRef, useEffect, useCallback } from 'react';
import { useCountryDetection, tryGetCountry } from './useCountryDetection';
import { usePhoneState } from './usePhoneState';
import { useInputHandlers } from './useInputHandlers';
import { createPhoneFormatter } from '../utils';
import type { UsePhoneMaskOptions, UsePhoneMaskReturn, PhoneNumber } from '../types';

/**
 * React hook for phone number masking.
 * Provides low-level phone masking functionality for custom input implementations.
 */
export function usePhoneMask(options: UsePhoneMaskOptions = {}): UsePhoneMaskReturn {
  const inputRef = useRef<HTMLInputElement>(null);

  // Stable callback ref to avoid stale closure in onChange effect
  const onChangeRef = useRef(options.onChange);
  useEffect(() => { onChangeRef.current = options.onChange; }, [options.onChange]);

  // ── Country detection ─────────────────────────────────────────
  const detection = useCountryDetection({
    country: options.country,
    detect: options.detect,
    locale: options.locale,
    onCountryChange: options.onCountryChange,
  });

  // ── Phone state ───────────────────────────────────────────────
  const phoneState = usePhoneState({
    country: detection.country,
  });

  // ── Input handlers ────────────────────────────────────────────
  useInputHandlers({
    inputRef,
    digits: phoneState.digits,
    setDigits: phoneState.setDigits,
    formatter: phoneState.formatter,
  });

  // Sync display value to the DOM input
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.value = phoneState.displayValue;
    el.placeholder = phoneState.displayPlaceholder;
  }, [phoneState.displayValue, phoneState.displayPlaceholder]);

  // Set input attributes on mount
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.setAttribute('type', 'tel');
    el.setAttribute('inputmode', 'tel');
  }, []);

  // Emit input event to keep value in sync (for uncontrolled usage)
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const onInputEvent = () => {
      // Already handled by useInputHandlers; this syncs the display
      el.value = phoneState.displayValue;
    };
    el.addEventListener('input', onInputEvent);
    return () => el.removeEventListener('input', onInputEvent);
  }, [phoneState.displayValue]);

  // Notify onChange
  useEffect(() => {
    if (onChangeRef.current) {
      const phoneData: PhoneNumber = {
        full: phoneState.full,
        fullFormatted: phoneState.fullFormatted,
        digits: phoneState.digits,
      };
      onChangeRef.current(phoneData);
    }
  }, [phoneState.digits, phoneState.full, phoneState.fullFormatted]);

  // ── Set country ───────────────────────────────────────────────
  const setCountry = useCallback(
    (countryCode: string) => {
      const newCountry = tryGetCountry(countryCode, detection.locale);
      if (newCountry) {
        detection.setCountry(countryCode);
        const newFormatter = createPhoneFormatter(newCountry);
        const maxDigits = newFormatter.getMaxDigits();
        if (phoneState.digits.length > maxDigits) {
          phoneState.setDigits(phoneState.digits.slice(0, maxDigits));
        }
      }
    },
    [detection, phoneState]
  );

  // ── Clear ─────────────────────────────────────────────────────
  const clear = useCallback(() => {
    phoneState.setDigits('');
    const el = inputRef.current;
    if (el) el.value = '';
  }, [phoneState]);

  return {
    ref: inputRef,
    digits: phoneState.digits,
    full: phoneState.full,
    fullFormatted: phoneState.fullFormatted,
    isComplete: phoneState.isComplete,
    isEmpty: phoneState.isEmpty,
    shouldShowWarn: !phoneState.isEmpty && !phoneState.isComplete,
    country: detection.country,
    setCountry,
    clear,
  };
}
