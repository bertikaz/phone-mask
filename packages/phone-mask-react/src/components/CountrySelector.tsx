import React from 'react';
import type { MaskFull } from '@desource/phone-mask';

export interface CountrySelectorProps {
    country: MaskFull;
    disabled: boolean;
    readonly: boolean;
    hasDropdown: boolean;
    isOpen: boolean;
    onToggle: () => void;
    renderFlag?: (country: MaskFull) => React.ReactNode;
    selectorRef: React.RefObject<HTMLDivElement | null>;
}

export const CountrySelector: React.FC<CountrySelectorProps> = ({
    country,
    disabled,
    readonly,
    hasDropdown,
    isOpen,
    onToggle,
    renderFlag,
    selectorRef,
}) => {
    const inactive = disabled || readonly;

    return (
        <div className="pi-selector" ref={selectorRef}>
            <button
                type="button"
                className={`pi-selector-btn ${!hasDropdown || readonly ? 'no-dropdown' : ''}`}
                disabled={disabled}
                tabIndex={inactive || !hasDropdown ? -1 : undefined}
                aria-label={`Selected country: ${country.name}`}
                aria-expanded={isOpen}
                aria-haspopup={hasDropdown ? 'listbox' : undefined}
                onClick={onToggle}
            >
                <span className="pi-flag" role="img" aria-label={`${country.name} flag`}>
                    {renderFlag ? renderFlag(country) : country.flag}
                </span>
                <span className="pi-code">{country.code}</span>
                {!inactive && hasDropdown && (
                    <svg
                        className={`pi-chevron ${isOpen ? 'is-open' : ''}`}
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        aria-hidden="true"
                    >
                        <path
                            d="M2.5 4.5L6 8L9.5 4.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                )}
            </button>
        </div>
    );
};

CountrySelector.displayName = 'CountrySelector';
