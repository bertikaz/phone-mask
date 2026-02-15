import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useCallback,
  useMemo,
  type CSSProperties
} from 'react';
import type { CountryKey } from '@desource/phone-mask';
import { useCountryDetection } from '../hooks/useCountryDetection';
import { usePhoneState } from '../hooks/usePhoneState';
import { useInputHandlers } from '../hooks/useInputHandlers';
import { CountrySelector } from './CountrySelector';
import { CountryDropdown } from './CountryDropdown';
import { ActionButtons } from './ActionButtons';
import type { PhoneInputProps, PhoneInputRef } from '../types';

export const PhoneInput = forwardRef<PhoneInputRef, PhoneInputProps>((props, ref) => {
  const {
    value = '',
    country: propCountry,
    detect = true,
    locale: propLocale,
    size = 'normal',
    theme = 'auto',
    disabled = false,
    readonly = false,
    showCopy = true,
    showClear = false,
    withValidity = true,
    searchPlaceholder = 'Search country or code...',
    noResultsText = 'No countries found',
    clearButtonLabel = 'Clear phone number',
    dropdownClass = '',
    disableDefaultStyles = false,
    onChange,
    onPhoneChange,
    onCountryChange,
    onValidationChange,
    onFocus,
    onBlur,
    onCopy,
    onClear,
    renderActionsBefore,
    renderFlag,
    renderCopySvg,
    renderClearSvg
  } = props;

  const telRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectorRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);

  // ── Shared hooks ──────────────────────────────────────────────
  const detection = useCountryDetection({
    country: propCountry,
    detect,
    locale: propLocale,
    onCountryChange,
  });

  const phoneState = usePhoneState({
    country: detection.country,
    value,
    onChange,
    onPhoneChange,
    onValidationChange,
  });

  const inactive = disabled || readonly;

  // ── Validation hint debounce ──────────────────────────────────
  const [showValidationHint, setShowValidationHint] = useState(false);
  const validationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleValidationHint = useCallback(() => {
    setShowValidationHint(false);
    if (validationTimerRef.current) clearTimeout(validationTimerRef.current);
    validationTimerRef.current = setTimeout(() => {
      setShowValidationHint(true);
    }, 300);
  }, []);

  // ── Input handlers ────────────────────────────────────────────
  useInputHandlers({
    inputRef: telRef,
    digits: phoneState.digits,
    setDigits: phoneState.setDigits,
    formatter: phoneState.formatter,
    inactive,
    onDigitsMutated: scheduleValidationHint,
  });

  // ── Dropdown state ────────────────────────────────────────────
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeDropdown = useCallback(() => {
    if (!dropdownOpen) return;
    setIsClosing(true);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setDropdownOpen(false);
      setIsClosing(false);
    }, 200);
  }, [dropdownOpen]);

  const toggleDropdown = useCallback(() => {
    if (inactive || !detection.hasDropdown) return;
    if (dropdownOpen) {
      closeDropdown();
    } else {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      setIsClosing(false);
      setDropdownOpen(true);
    }
  }, [inactive, detection.hasDropdown, dropdownOpen, closeDropdown]);

  // ── Country selection ─────────────────────────────────────────
  const selectCountry = useCallback(
    (code: CountryKey) => {
      detection.setCountry(code);
      closeDropdown();
      setTimeout(() => telRef.current?.focus(), 0);
    },
    [detection, closeDropdown]
  );

  // ── Focus / blur ──────────────────────────────────────────────
  const handleFocusInput = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      // Do not hide the hint on focus; keep it visible if already shown (matches Vue)
      if (validationTimerRef.current) clearTimeout(validationTimerRef.current);
      closeDropdown();
      onFocus?.(e);
    },
    [onFocus, closeDropdown]
  );

  // Screen reader copy announcement (matches Vue's watch(copyMessage) → liveRef)
  const handleCopyAnnounce = useCallback(() => {
    if (liveRef.current) {
      liveRef.current.textContent = 'Phone number copied to clipboard';
    }
  }, []);

  const handleInput = useCallback(() => {
    // Handled by useInputHandlers; this is for the React onInput prop
    // to ensure displayValue stays in sync after each keystroke
  }, []);

  // ── Clear ─────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    phoneState.clearDigits();
    setShowValidationHint(false);
    if (validationTimerRef.current) clearTimeout(validationTimerRef.current);
    onClear?.();
  }, [phoneState, onClear]);

  // ── Imperative handle ─────────────────────────────────────────
  useImperativeHandle(
    ref,
    () => ({
      focus: () => telRef.current?.focus(),
      blur: () => telRef.current?.blur(),
      clear: () => {
        phoneState.clearDigits();
        setShowValidationHint(false);
        if (validationTimerRef.current) clearTimeout(validationTimerRef.current);
        onClear?.();
      },
      selectCountry,
      getFullNumber: () => phoneState.full,
      getFullFormattedNumber: () => phoneState.fullFormatted,
      getDigits: () => phoneState.digits,
      isValid: () => phoneState.isComplete,
      isComplete: () => phoneState.isComplete,
    }),
    [selectCountry, phoneState, onClear]
  );

  // ── Derived classes ───────────────────────────────────────────
  const shouldShowWarn = showValidationHint && !phoneState.isEmpty && !phoneState.isComplete;

  const themeClass = useMemo(() => {
    if (theme !== 'auto') return `theme-${theme}`;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      return 'theme-dark';
    }
    return 'theme-light';
  }, [theme]);

  const rootClasses = [
    'phone-input',
    `size-${size}`,
    themeClass,
    disabled && 'is-disabled',
    readonly && 'is-readonly',
    disableDefaultStyles && 'is-unstyled',
    withValidity && shouldShowWarn && 'is-incomplete',
    withValidity && phoneState.isComplete && 'is-complete',
  ]
    .filter(Boolean)
    .join(' ');

  const actionsCount =
    +(showCopy && !phoneState.isEmpty && !disabled) +
    +(showClear && !phoneState.isEmpty && !inactive) +
    (renderActionsBefore ? 1 : 0);

  // ── Cleanup timers ────────────────────────────────────────────
  React.useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (validationTimerRef.current) clearTimeout(validationTimerRef.current);
    };
  }, []);

  // ── Render ────────────────────────────────────────────────────
  return (
    <>
      <div
        ref={rootRef}
        className={rootClasses}
        style={{ '--pi-actions-count': actionsCount } as CSSProperties}
        role="group"
        aria-label="Phone input with country selector"
      >
        <CountrySelector
          country={detection.country}
          disabled={disabled}
          readonly={readonly}
          hasDropdown={detection.hasDropdown}
          isOpen={dropdownOpen}
          onToggle={toggleDropdown}
          renderFlag={renderFlag}
          selectorRef={selectorRef}
        />

        <div className="pi-input-wrap">
          <input
            ref={telRef}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="pi-input"
            placeholder={phoneState.displayPlaceholder}
            value={phoneState.displayValue}
            disabled={disabled}
            readOnly={readonly}
            aria-invalid={shouldShowWarn}
            onInput={handleInput}
            onFocus={handleFocusInput}
            onBlur={onBlur}
          />

          <ActionButtons
            fullFormatted={phoneState.fullFormatted}
            isEmpty={phoneState.isEmpty}
            disabled={disabled}
            inactive={inactive}
            showCopy={showCopy}
            showClear={showClear}
            clearButtonLabel={clearButtonLabel}
            countryCode={detection.country.code}
            displayValue={phoneState.displayValue}
            onCopy={onCopy}
            onCopyAnnounce={handleCopyAnnounce}
            onClear={handleClear}
            focusInput={() => telRef.current?.focus()}
            renderActionsBefore={renderActionsBefore}
            renderCopySvg={renderCopySvg}
            renderClearSvg={renderClearSvg}
          />
        </div>
      </div>

      <CountryDropdown
        countries={detection.countries}
        currentCountry={detection.country}
        isOpen={dropdownOpen}
        isClosing={isClosing}
        themeClass={themeClass}
        dropdownClass={dropdownClass}
        searchPlaceholder={searchPlaceholder}
        noResultsText={noResultsText}
        onSelect={selectCountry}
        onClose={closeDropdown}
        renderFlag={renderFlag}
        anchorRef={rootRef}
      />

      {/* Screen reader announcements */}
      <div ref={liveRef} className="sr-only" role="status" aria-live="polite" aria-atomic="true" />
    </>
  );
});

PhoneInput.displayName = 'PhoneInput';
