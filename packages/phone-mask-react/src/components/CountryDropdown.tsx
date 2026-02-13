import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { CountryKey, MaskFull } from '@desource/phone-mask';

export interface CountryDropdownProps {
    countries: MaskFull[];
    currentCountry: MaskFull;
    isOpen: boolean;
    isClosing: boolean;
    themeClass: string;
    dropdownClass: string;
    searchPlaceholder: string;
    noResultsText: string;
    onSelect: (code: CountryKey) => void;
    onClose: () => void;
    renderFlag?: (country: MaskFull) => React.ReactNode;
    anchorRef: React.RefObject<HTMLDivElement | null>;
}

export const CountryDropdown: React.FC<CountryDropdownProps> = ({
    countries,
    currentCountry,
    isOpen,
    isClosing,
    themeClass,
    dropdownClass,
    searchPlaceholder,
    noResultsText,
    onSelect,
    onClose,
    renderFlag,
    anchorRef,
}) => {
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const [search, setSearch] = useState('');
    const [focusedIndex, setFocusedIndex] = useState(0);
    const [style, setStyle] = useState<React.CSSProperties>({});

    // Filtered + scored country list
    const filteredCountries = useMemo(() => {
        const raw = search.trim();
        if (!raw) return countries;
        const q = raw.toUpperCase();
        const qDigits = q.replace(/\D/g, '');
        const isNumeric = qDigits.length > 0;

        return countries
            .map((c) => {
                const nameUpper = c.name.toUpperCase();
                const idUpper = c.id.toUpperCase();
                const codeUpper = c.code.toUpperCase();
                const codeDigits = c.code.replace(/\D/g, '');
                let score = 0;
                if (nameUpper.startsWith(q)) score = 1000;
                else if (nameUpper.includes(q)) score = 500;
                if (codeUpper.startsWith(q)) score += 100;
                else if (codeUpper.includes(q)) score += 50;
                if (idUpper === q) score += 200;
                else if (idUpper.startsWith(q)) score += 150;
                if (isNumeric && codeDigits.startsWith(qDigits)) score += 80;
                else if (isNumeric && codeDigits.includes(qDigits)) score += 40;
                return { country: c, score };
            })
            .filter((x) => x.score > 0)
            .sort((a, b) =>
                b.score !== a.score ? b.score - a.score : a.country.name.localeCompare(b.country.name)
            )
            .map((x) => x.country);
    }, [countries, search]);

    // Position dropdown under anchor
    const positionDropdown = useCallback(() => {
        if (!anchorRef.current) return;
        const rect = anchorRef.current.getBoundingClientRect();
        setStyle({
            top: `${rect.bottom + window.scrollY + 8}px`,
            left: `${rect.left + window.scrollX}px`,
            width: `${rect.width}px`,
        });
    }, [anchorRef]);

    // Setup on open: position, focus search, click-outside, scroll/resize listeners
    useEffect(() => {
        if (!isOpen) {
            // Reset state when closed
            setSearch('');
            setFocusedIndex(0);
            return;
        }

        positionDropdown();
        const focusTimer = setTimeout(() => searchRef.current?.focus({ preventScroll: true }), 0);

        const onDocClick = (ev: Event) => {
            const target = ev.target as Node | null;
            if (!target) return;
            if (dropdownRef.current?.contains(target)) return;
            if (anchorRef.current?.contains(target)) return;
            onClose();
        };

        // Skip repositioning when scroll originates inside the dropdown (matches Vue)
        const onScroll = (ev: Event) => {
            if (ev.target && dropdownRef.current?.contains(ev.target as Node)) return;
            positionDropdown();
        };

        window.addEventListener('resize', positionDropdown);
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('click', onDocClick, true);

        return () => {
            clearTimeout(focusTimer);
            window.removeEventListener('resize', positionDropdown);
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('click', onDocClick, true);
        };
    }, [isOpen, positionDropdown, onClose, anchorRef]);

    // Scroll focused option into view
    const scrollFocusedIntoView = (index: number) => {
        setTimeout(() => {
            const list = dropdownRef.current?.lastElementChild;
            const option = list?.children[index];
            if (!list || !option) return;

            const listRect = list.getBoundingClientRect();
            const optionRect = option.getBoundingClientRect();

            let scrollAmount = 0;
            if (optionRect.top < listRect.top) {
                scrollAmount = list.scrollTop - (listRect.top - optionRect.top);
            } else if (optionRect.bottom > listRect.bottom) {
                scrollAmount = list.scrollTop + (optionRect.bottom - listRect.bottom);
            } else {
                return;
            }

            list.scrollTo({ top: scrollAmount, behavior: 'smooth' });
        }, 0);
    };

    // Keyboard navigation
    const handleSearchKeydown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setFocusedIndex((i) => {
                    const next = Math.min(i + 1, filteredCountries.length - 1);
                    scrollFocusedIntoView(next);
                    return next;
                });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setFocusedIndex((i) => {
                    const prev = Math.max(i - 1, 0);
                    scrollFocusedIntoView(prev);
                    return prev;
                });
            } else if (e.key === 'Enter' && filteredCountries[focusedIndex]) {
                e.preventDefault();
                onSelect(filteredCountries[focusedIndex]!.id);
            } else if (e.key === 'Escape') {
                onClose();
            }
        },
        [filteredCountries, focusedIndex, onSelect, onClose]
    );

    if (!isOpen || typeof document === 'undefined') return null;

    return createPortal(
        <div
            ref={dropdownRef}
            className={`phone-dropdown ${dropdownClass} ${themeClass} ${isClosing ? 'is-closing' : ''}`}
            style={style}
            role="dialog"
            aria-modal="false"
            aria-label="Select country"
        >
            <div className="pi-search-wrap">
                <input
                    ref={searchRef}
                    type="search"
                    className="pi-search"
                    aria-label="Search countries"
                    placeholder={searchPlaceholder}
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setFocusedIndex(0);
                    }}
                    onKeyDown={handleSearchKeydown}
                />
            </div>
            <ul
                className="pi-options"
                role="listbox"
                aria-activedescendant={`option-${focusedIndex}`}
                tabIndex={-1}
            >
                {filteredCountries.length > 0 ? (
                    filteredCountries.map((c, idx) => (
                        <li
                            key={c.id}
                            id={`option-${idx}`}
                            role="option"
                            className={`pi-option ${idx === focusedIndex ? 'is-focused' : ''} ${c.id === currentCountry.id ? 'is-selected' : ''
                                }`}
                            aria-selected={c.id === currentCountry.id}
                            title={c.name}
                            onClick={() => onSelect(c.id)}
                            onMouseEnter={() => setFocusedIndex(idx)}
                        >
                            <span className="pi-flag" role="img" aria-label={`${c.name} flag`}>
                                {renderFlag ? renderFlag(c) : c.flag}
                            </span>
                            <span className="pi-opt-name">{c.name}</span>
                            <span className="pi-opt-code">{c.code}</span>
                        </li>
                    ))
                ) : (
                    <li className="pi-empty">{noResultsText}</li>
                )}
            </ul>
        </div>,
        document.body
    );
};

CountryDropdown.displayName = 'CountryDropdown';
