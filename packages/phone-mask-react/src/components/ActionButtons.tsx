import React, { useState, useCallback, useRef, useEffect } from 'react';

export interface ActionButtonsProps {
    /** Full formatted phone number (for copying) */
    fullFormatted: string;
    /** Whether digits are empty */
    isEmpty: boolean;
    /** Whether the input is disabled */
    disabled: boolean;
    /** Whether the input is inactive (disabled or readonly) */
    inactive: boolean;
    /** Whether to show the copy button */
    showCopy: boolean;
    /** Whether to show the clear button */
    showClear: boolean;
    /** Clear button aria label */
    clearButtonLabel: string;
    /** Country code for copy label */
    countryCode: string;
    /** Display value for copy label */
    displayValue: string;
    /** Callback after copy */
    onCopy?: (value: string) => void;
    /** Callback after clear */
    onClear: () => void;
    /** Focus the input after clear */
    focusInput: () => void;
    /** Custom render for extra actions before defaults */
    renderActionsBefore?: () => React.ReactNode;
    /** Custom render for copy SVG */
    renderCopySvg?: (copied: boolean) => React.ReactNode;
    /** Custom render for clear SVG */
    renderClearSvg?: () => React.ReactNode;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
    fullFormatted,
    isEmpty,
    disabled,
    inactive,
    showCopy,
    showClear,
    clearButtonLabel,
    countryCode,
    displayValue,
    onCopy,
    onClear,
    focusInput,
    renderActionsBefore,
    renderCopySvg,
    renderClearSvg,
}) => {
    const [copied, setCopied] = useState(false);
    const [isCopying, setIsCopying] = useState(false);
    const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        };
    }, []);

    const showCopyButton = showCopy && !isEmpty && !disabled;
    const showClearButton = showClear && !isEmpty && !inactive;

    const handleCopyClick = useCallback(async () => {
        if (isCopying) return;
        const trimmedValue = fullFormatted.trim();
        if (!trimmedValue) return;

        setIsCopying(true);
        try {
            await navigator.clipboard.writeText(trimmedValue);
            setCopied(true);
            onCopy?.(trimmedValue);

            if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
            copyTimerRef.current = setTimeout(() => {
                setCopied(false);
                copyTimerRef.current = null;
            }, 1800);
        } catch (err) {
            console.warn('Copy failed', err);
        } finally {
            setIsCopying(false);
        }
    }, [fullFormatted, onCopy, isCopying]);

    const handleClearClick = useCallback(() => {
        onClear();
        setTimeout(() => focusInput(), 0);
    }, [onClear, focusInput]);

    return (
        <div className="pi-actions" role="toolbar" aria-label="Phone input actions">
            {renderActionsBefore?.()}

            {showCopyButton && (
                <button
                    type="button"
                    className={`pi-btn ${copied ? 'is-copied' : ''}`}
                    aria-label={copied ? 'Copied' : `Copy ${countryCode} ${displayValue}`}
                    title={copied ? 'Copied' : 'Copy phone number'}
                    onClick={handleCopyClick}
                >
                    {renderCopySvg ? (
                        renderCopySvg(copied)
                    ) : copied ? (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path d="M6.5 11.5L3 8L4.06 6.94L6.5 9.38L11.94 3.94L13 5L6.5 11.5Z" fill="currentColor" />
                        </svg>
                    ) : (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path
                                d="M13.5 5.5V13.5H5.5V5.5H13.5ZM13.5 4H5.5C4.67 4 4 4.67 4 5.5V13.5C4 14.33 4.67 15 5.5 15H13.5C14.33 15 15 14.33 15 13.5V5.5C15 4.67 14.33 4 13.5 4ZM10.5 1H2.5V11H4V2.5H10.5V1Z"
                                fill="currentColor"
                            />
                        </svg>
                    )}
                </button>
            )}

            {showClearButton && (
                <button
                    type="button"
                    className="pi-btn"
                    aria-label={clearButtonLabel}
                    title={clearButtonLabel}
                    onClick={handleClearClick}
                >
                    {renderClearSvg ? (
                        renderClearSvg()
                    ) : (
                        <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                            <path
                                d="M14 1.41L12.59 0L7 5.59L1.41 0L0 1.41L5.59 7L0 12.59L1.41 14L7 8.41L12.59 14L14 12.59L8.41 7L14 1.41Z"
                                fill="currentColor"
                            />
                        </svg>
                    )}
                </button>
            )}
        </div>
    );
};

ActionButtons.displayName = 'ActionButtons';
