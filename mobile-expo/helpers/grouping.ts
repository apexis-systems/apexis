const MONTH_KEYS = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december"
];

/**
 * Groups already-sorted items into month/year sections.
 * Assumes items are already sorted in the desired direction (Newest or Oldest).
 */
export const groupItemsByMonth = (items: any[], t?: any) => {
    const groups: { title: string; data: any[] }[] = [];
    
    items.forEach((item) => {
        const dateStr = item.createdAt || item.created_at;
        if (!dateStr) return;
        
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return;
        
        const monthName = t ? t(`months.${MONTH_KEYS[d.getMonth()]}`) : 
            MONTH_KEYS[d.getMonth()].charAt(0).toUpperCase() + MONTH_KEYS[d.getMonth()].slice(1);
        
        const monthYear = `${monthName} ${d.getFullYear()}`;
        
        // Since items are already sorted, we can just check the last group
        if (groups.length === 0 || groups[groups.length - 1].title !== monthYear) {
            groups.push({ title: monthYear, data: [item] });
        } else {
            groups[groups.length - 1].data.push(item);
        }
    });
    
    return groups;
};
