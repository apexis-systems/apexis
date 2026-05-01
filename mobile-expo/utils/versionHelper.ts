/**
 * Compares two semantic version strings.
 * Returns true if the current version is lower than the minimum version.
 * 
 * @param currentVersion - e.g. "1.6.2"
 * @param minVersion - e.g. "1.6.3"
 */
export const isUpdateRequired = (currentVersion: string, minVersion: string): boolean => {
    if (!currentVersion || !minVersion) return false;

    const currentParts = currentVersion.split('.').map(Number);
    const minParts = minVersion.split('.').map(Number);

    for (let i = 0; i < Math.max(currentParts.length, minParts.length); i++) {
        const current = currentParts[i] || 0;
        const min = minParts[i] || 0;

        if (current < min) return true;
        if (current > min) return false;
    }

    return false; // Versions are equal
};
