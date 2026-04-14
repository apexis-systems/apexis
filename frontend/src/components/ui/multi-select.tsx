"use client";

import * as React from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Option {
    label: string;
    value: string;
}

interface MultiSelectProps {
    options: Option[];
    selected: string[]; // array of selected values; empty means "all"
    onChange: (selected: string[]) => void;
    placeholder?: string;
    className?: string;
    triggerClassName?: string;
}

export function MultiSelect({
    options,
    selected,
    onChange,
    placeholder = "All",
    className,
    triggerClassName,
}: MultiSelectProps) {
    const [open, setOpen] = React.useState(false);
    const ref = React.useRef<HTMLDivElement>(null);

    // Close on outside click
    React.useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const toggle = (value: string) => {
        if (selected.includes(value)) {
            const next = selected.filter((v) => v !== value);
            onChange(next);
        } else {
            onChange([...selected, value]);
        }
    };

    const label = React.useMemo(() => {
        if (selected.length === 0) return placeholder;
        if (selected.length === 1) {
            return options.find((o) => o.value === selected[0])?.label ?? placeholder;
        }
        return `${selected.length} selected`;
    }, [selected, options, placeholder]);

    return (
        <div ref={ref} className={cn("relative", className)}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={cn(
                    "flex h-9 w-40 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                    triggerClassName
                )}
            >
                <span className="truncate text-left">{label}</span>
                <ChevronDown className={cn("ml-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
            </button>

            {open && (
                <div className="absolute left-0 top-full z-50 mt-1 max-h-60 w-full min-w-[10rem] overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md">
                    {/* "All" option — deselects everything */}
                    <button
                        type="button"
                        onClick={() => onChange([])}
                        className={cn(
                            "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs cursor-default select-none hover:bg-accent/10",
                            selected.length === 0 && "font-semibold text-accent"
                        )}
                    >
                        <div className={cn(
                            "flex h-3.5 w-3.5 items-center justify-center rounded border border-muted-foreground/40",
                            selected.length === 0 && "border-accent bg-accent"
                        )}>
                            {selected.length === 0 && <Check className="h-2.5 w-2.5 text-white" />}
                        </div>
                        All
                    </button>

                    {options.map((option) => {
                        const isSelected = selected.includes(option.value);
                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => toggle(option.value)}
                                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs cursor-default select-none hover:bg-accent/10"
                            >
                                <div className={cn(
                                    "flex h-3.5 w-3.5 items-center justify-center rounded border",
                                    isSelected
                                        ? "border-accent bg-accent"
                                        : "border-muted-foreground/40"
                                )}>
                                    {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                                </div>
                                <span className={cn("truncate", isSelected && "font-medium text-foreground")}>
                                    {option.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
