const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

/**
 * Groups already-sorted items into month/year sections.
 * Assumes items are already sorted in the desired direction (Newest or Oldest).
 */
export const groupItemsByMonth = (items: any[]) => {
    const groups: { title: string; data: any[] }[] = [];
    
    items.forEach((item) => {
        const dateStr = item.createdAt || item.created_at;
        if (!dateStr) return;
        
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return;
        
        const monthYear = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
        
        // Since items are already sorted, we can just check the last group
        if (groups.length === 0 || groups[groups.length - 1].title !== monthYear) {
            groups.push({ title: monthYear, data: [item] });
        } else {
            groups[groups.length - 1].data.push(item);
        }
    });
    
    return groups;
};
