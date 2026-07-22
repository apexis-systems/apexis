import * as FileSystem from 'expo-file-system/legacy';

/**
 * Centralized service to manage cache/temporary file lifecycle.
 * Provides APIs to clean up specific files or batch-clean lists of files,
 * and background cache pruning to prevent orphaned files from leaking.
 */

/**
 * Delete a single file safely.
 * @param uri Local file URI (starts with file://)
 */
export const deleteFileAsync = async (uri: string | null | undefined): Promise<boolean> => {
    if (!uri || !uri.startsWith('file://')) return false;
    try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
        return true;
    } catch (error) {
        console.warn(`[CacheService] Failed to delete file: ${uri}`, error);
        return false;
    }
};

/**
 * Delete a list of files.
 * @param uris List of local file URIs
 */
export const deleteFilesAsync = async (uris: (string | null | undefined)[]): Promise<void> => {
    if (!uris || uris.length === 0) return;
    await Promise.all(
        uris
            .filter((uri): uri is string => !!uri && uri.startsWith('file://'))
            .map((uri) => deleteFileAsync(uri))
    );
};

/**
 * Prune cacheDirectory of files older than maxAgeMs.
 * Defaults to files older than 1 hour.
 */
export const pruneCacheAsync = async (maxAgeMs: number = 60 * 60 * 1000): Promise<void> => {
    try {
        const cacheDir = FileSystem.cacheDirectory;
        if (!cacheDir) return;

        const files = await FileSystem.readDirectoryAsync(cacheDir);
        const now = Date.now();

        for (const file of files) {
            // Skip SQLite files or other persistent system directories if any (unlikely in cacheDirectory)
            if (file === 'SQLite' || file.startsWith('.')) continue;

            const fileUri = `${cacheDir}${file}`;
            try {
                const info = await FileSystem.getInfoAsync(fileUri);
                if (info.exists && !info.isDirectory) {
                    const modificationTime = info.modificationTime || now;
                    // If modificationTime is not available, we can delete it if it matches temporary patterns
                    const isOld = now - modificationTime > maxAgeMs;
                    if (isOld) {
                        await deleteFileAsync(fileUri);
                    }
                }
            } catch (err) {
                console.warn(`[CacheService] Error pruning file ${fileUri}:`, err);
            }
        }
    } catch (error) {
        console.error('[CacheService] Failed to read or prune cache directory:', error);
    }
};
