import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { MaskFull } from '@desource/phone-mask';
import { createPhoneFormatter, extractDigits } from '../utils';
import type { FormatterHelpers, PhoneNumber } from '../types';

// ── Hook ────────────────────────────────────────────────────────────

export interface UsePhoneStateOptions {
    /** Current country data */
    country: MaskFull;
    /** Controlled value (digits only) */
    value?: string;
    /** Callback when raw digits change */
    onChange?: (digits: string) => void;
    /** Callback when the phone number object changes */
    onPhoneChange?: (phone: PhoneNumber) => void;
    /** Callback when validation state changes */
    onValidationChange?: (isValid: boolean) => void;
}

export interface UsePhoneStateReturn {
    /** Raw digit string (no formatting) */
    digits: string;
    /** Update digits */
    setDigits: (digits: string) => void;
    /** Memoized formatter for the current country */
    formatter: FormatterHelpers;
    /** Formatted display string (e.g. "234-567-890") */
    displayValue: string;
    /** Placeholder from the mask (e.g. "XXX-XXX-XXXX") */
    displayPlaceholder: string;
    /** Whether the number is complete per the mask */
    isComplete: boolean;
    /** Whether digits are empty */
    isEmpty: boolean;
    /** Full number with country code (e.g. "+1234567890") */
    full: string;
    /** Full formatted number (e.g. "+1 234-567-890") */
    fullFormatted: string;
    /** Clear digits and fire callbacks */
    clearDigits: () => void;
}

export function usePhoneState(options: UsePhoneStateOptions): UsePhoneStateReturn {
    const { country, value, onChange, onPhoneChange, onValidationChange } = options;
    const [digits, setDigitsRaw] = useState('');

    // Stable callback refs to avoid stale closures in effects
    const onChangeRef = useRef(onChange);
    const onPhoneChangeRef = useRef(onPhoneChange);
    const onValidationChangeRef = useRef(onValidationChange);

    useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
    useEffect(() => { onPhoneChangeRef.current = onPhoneChange; }, [onPhoneChange]);
    useEffect(() => { onValidationChangeRef.current = onValidationChange; }, [onValidationChange]);

    // Memoize formatter (was missing in usePhoneMask)
    const formatter = useMemo(() => createPhoneFormatter(country), [country]);

    // Derived state
    const displayValue = formatter.formatDisplay(digits);
    const displayPlaceholder = formatter.getPlaceholder();
    const isComplete = formatter.isComplete(digits);
    const isEmpty = digits.length === 0;
    const full = `${country.code}${digits}`;
    const fullFormatted = digits ? `${country.code} ${displayValue}` : '';

    // Clamp digits when country/formatter changes
    useEffect(() => {
        const maxDigits = formatter.getMaxDigits();
        if (digits.length > maxDigits) {
            setDigitsRaw((d) => d.slice(0, maxDigits));
        }
    }, [formatter]);

    // Sync controlled `value` prop
    useEffect(() => {
        const incoming = extractDigits(value || '');
        if (incoming !== digits) {
            setDigitsRaw(incoming);
        }
    }, [value]);

    // Emit onChange / onPhoneChange whenever digits change
    useEffect(() => {
        onChangeRef.current?.(digits);
        onPhoneChangeRef.current?.({ full, fullFormatted, digits });
    }, [digits, full, fullFormatted]);

    // Emit onValidationChange
    useEffect(() => {
        onValidationChangeRef.current?.(isComplete);
    }, [isComplete]);

    const clearDigits = useCallback(() => {
        setDigitsRaw('');
        onChangeRef.current?.('');
        onPhoneChangeRef.current?.({ full: '', fullFormatted: '', digits: '' });
    }, []);

    return {
        digits,
        setDigits: setDigitsRaw,
        formatter,
        displayValue,
        displayPlaceholder,
        isComplete,
        isEmpty,
        full,
        fullFormatted,
        clearDigits,
    };
}
