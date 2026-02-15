import { useEffect, useCallback, type RefObject } from 'react';
import { extractDigits, setCaret, getSelection } from '../utils';
import { Delimiters, NavigationKeys, InvalidPattern } from '../consts';
import type { FormatterHelpers } from '../types';

// ── Hook ────────────────────────────────────────────────────────────

export interface UseInputHandlersOptions {
    /** Ref to the <input> element */
    inputRef: RefObject<HTMLInputElement | null>;
    /** Current raw digit string */
    digits: string;
    /** Setter for digits */
    setDigits: (digits: string) => void;
    /** Current formatter (must be memoized externally) */
    formatter: FormatterHelpers;
    /** Whether the input is inactive (disabled or readonly) */
    inactive?: boolean;
    /** Optional callback after any digit mutation (e.g. for validation hint debounce) */
    onDigitsMutated?: () => void;
}

export function useInputHandlers(options: UseInputHandlersOptions): void {
    const { inputRef, digits, setDigits, formatter, inactive = false, onDigitsMutated } = options;

    // ── beforeinput ────────────────────────────────────────────────
    const handleBeforeInput = useCallback(
        (e: InputEvent) => {
            const data = e.data;
            if (e.inputType !== 'insertText' || !data) return;
            const el = inputRef.current;
            if (!el) return;
            if (InvalidPattern.test(data) || (data === ' ' && el.value.endsWith(' '))) {
                e.preventDefault();
            }
        },
        [inputRef]
    );

    // ── input (after browser has mutated the value) ────────────────
    const handleInput = useCallback(() => {
        const el = inputRef.current;
        if (!el || inactive) return;
        const raw = el.value || '';
        const maxDigits = formatter.getMaxDigits();
        const newDigits = extractDigits(raw, maxDigits);
        setDigits(newDigits);
        setTimeout(() => {
            const pos = formatter.getCaretPosition(newDigits.length);
            setCaret(el, pos);
        }, 0);
        onDigitsMutated?.();
    }, [inputRef, formatter, inactive, setDigits, onDigitsMutated]);

    // ── keydown ────────────────────────────────────────────────────
    const handleKeydown = useCallback(
        (e: KeyboardEvent) => {
            if (inactive) return;
            const el = inputRef.current;
            if (!el) return;

            if (e.ctrlKey || e.metaKey || e.altKey || NavigationKeys.includes(e.key)) return;

            const [selStart, selEnd] = getSelection(el);

            if (e.key === 'Backspace') {
                e.preventDefault();
                if (selStart !== selEnd) {
                    const range = formatter.getDigitRange(digits, selStart, selEnd);
                    if (range) {
                        const [start, end] = range;
                        setDigits(digits.slice(0, start) + digits.slice(end));
                        setTimeout(() => setCaret(el, formatter.getCaretPosition(start)), 0);
                    }
                } else if (selStart > 0) {
                    let prevPos = selStart - 1;
                    while (prevPos >= 0 && Delimiters.includes(el.value[prevPos]!)) prevPos--;
                    if (prevPos >= 0) {
                        const range = formatter.getDigitRange(digits, prevPos, prevPos + 1);
                        if (range) {
                            const [start] = range;
                            setDigits(digits.slice(0, start) + digits.slice(start + 1));
                            setTimeout(() => setCaret(el, formatter.getCaretPosition(start)), 0);
                        }
                    }
                }
                onDigitsMutated?.();
                return;
            }

            if (e.key === 'Delete') {
                e.preventDefault();
                if (selStart !== selEnd) {
                    const range = formatter.getDigitRange(digits, selStart, selEnd);
                    if (range) {
                        const [start, end] = range;
                        setDigits(digits.slice(0, start) + digits.slice(end));
                        setTimeout(() => setCaret(el, formatter.getCaretPosition(start)), 0);
                    }
                } else if (selStart < el.value.length) {
                    const range = formatter.getDigitRange(digits, selStart, selStart + 1);
                    if (range) {
                        const [start] = range;
                        setDigits(digits.slice(0, start) + digits.slice(start + 1));
                        setTimeout(() => setCaret(el, formatter.getCaretPosition(start)), 0);
                    }
                }
                onDigitsMutated?.();
                return;
            }

            if (/^[0-9]$/.test(e.key)) {
                if (digits.length >= formatter.getMaxDigits()) e.preventDefault();
                onDigitsMutated?.();
                return;
            }

            if (e.key.length === 1) e.preventDefault();
            onDigitsMutated?.();
        },
        [inputRef, inactive, formatter, digits, setDigits, onDigitsMutated]
    );

    // ── paste ──────────────────────────────────────────────────────
    const handlePaste = useCallback(
        (e: ClipboardEvent) => {
            if (inactive) return;
            e.preventDefault();
            const el = inputRef.current;
            if (!el) return;

            const text = e.clipboardData?.getData('text') || '';
            const maxDigits = formatter.getMaxDigits();
            const pastedDigits = extractDigits(text, maxDigits);
            if (!pastedDigits) return;

            const [selStart, selEnd] = getSelection(el);

            if (selStart !== selEnd) {
                const range = formatter.getDigitRange(digits, selStart, selEnd);
                if (range) {
                    const [start, end] = range;
                    const newDigits = extractDigits(
                        digits.slice(0, start) + pastedDigits + digits.slice(end),
                        maxDigits
                    );
                    setDigits(newDigits);
                    setTimeout(() => setCaret(el, formatter.getCaretPosition(start + pastedDigits.length)), 0);
                }
            } else {
                const range = formatter.getDigitRange(digits, selStart, selStart);
                const insertIndex = range ? range[0] : digits.length;
                const newDigits = extractDigits(
                    digits.slice(0, insertIndex) + pastedDigits + digits.slice(insertIndex),
                    maxDigits
                );
                setDigits(newDigits);
                setTimeout(() => setCaret(el, formatter.getCaretPosition(insertIndex + pastedDigits.length)), 0);
            }
            onDigitsMutated?.();
        },
        [inputRef, inactive, formatter, digits, setDigits, onDigitsMutated]
    );

    // ── Attach / detach native listeners ──────────────────────────
    useEffect(() => {
        const el = inputRef.current;
        if (!el) return;

        const beforeInputH = handleBeforeInput as unknown as (evt: Event) => void;
        const keydownH = handleKeydown as unknown as (evt: Event) => void;
        const pasteH = handlePaste as unknown as (evt: Event) => void;

        el.addEventListener('beforeinput', beforeInputH);
        el.addEventListener('keydown', keydownH);
        el.addEventListener('paste', pasteH);

        return () => {
            el.removeEventListener('beforeinput', beforeInputH);
            el.removeEventListener('keydown', keydownH);
            el.removeEventListener('paste', pasteH);
        };
    }, [handleBeforeInput, handleKeydown, handlePaste]);
}
