import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type SelectOption = { value: string; label: string };

type MenuBox = { top: number; left: number; width: number; maxHeight: number };

export function Select({
    value,
    options,
    onChange,
    ariaLabel,
    className,
}: {
    value: string;
    options: SelectOption[];
    onChange: (value: string) => void;
    ariaLabel?: string;
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const [box, setBox] = useState<MenuBox | null>(null);
    const ref = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLUListElement>(null);
    const current = options.find((option) => option.value === value) ?? options[0];

    function measure(): MenuBox | null {
        const button = ref.current?.querySelector('button');
        if (!button) return null;
        const rect = button.getBoundingClientRect();
        const estimated = Math.min(280, options.length * 42 + 16);
        const below = window.innerHeight - rect.bottom;
        const openUp = below < estimated && rect.top > below;
        const maxHeight = Math.max(120, (openUp ? rect.top : below) - 16);
        const top = openUp ? Math.max(8, rect.top - Math.min(estimated, maxHeight) - 6) : rect.bottom + 6;
        return { top, left: rect.left, width: rect.width, maxHeight };
    }

    useLayoutEffect(() => {
        if (!open) {
            setBox(null);
            return;
        }
        setBox(measure());
    }, [open, options.length]);

    useEffect(() => {
        if (!open) return;
        function place() {
            setBox(measure());
        }
        function onDocument(event: MouseEvent) {
            const target = event.target as Node;
            if (ref.current?.contains(target) || menuRef.current?.contains(target)) return;
            setOpen(false);
        }
        function onKey(event: KeyboardEvent) {
            if (event.key !== 'Escape') return;
            event.stopImmediatePropagation();
            setOpen(false);
        }
        document.addEventListener('mousedown', onDocument);
        document.addEventListener('keydown', onKey);
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);
        return () => {
            document.removeEventListener('mousedown', onDocument);
            document.removeEventListener('keydown', onKey);
            window.removeEventListener('resize', place);
            window.removeEventListener('scroll', place, true);
        };
    }, [open, options.length]);

    return (
        <div className={`ui-select${open ? ' ui-select--open' : ''}${className ? ` ${className}` : ''}`} ref={ref}>
            <button
                type="button"
                className="ui-select__trigger"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={ariaLabel}
                onClick={() => setOpen((currentOpen) => !currentOpen)}
            >
                <span>{current?.label}</span>
                <svg viewBox="0 0 10 6" aria-hidden="true"><path d="M0 0l5 6 5-6z" /></svg>
            </button>
            {open && box && createPortal(
                <ul
                    className="ui-select__menu"
                    role="listbox"
                    ref={menuRef}
                    style={{ top: box.top, left: box.left, width: box.width, maxHeight: box.maxHeight }}
                >
                    {options.map((option) => (
                        <li
                            key={option.value || option.label}
                            role="option"
                            aria-selected={option.value === value}
                            className={`ui-select__option${option.value === value ? ' is-selected' : ''}`}
                            onClick={() => {
                                onChange(option.value);
                                setOpen(false);
                            }}
                        >
                            {option.label}
                        </li>
                    ))}
                </ul>,
                document.body,
            )}
        </div>
    );
}
