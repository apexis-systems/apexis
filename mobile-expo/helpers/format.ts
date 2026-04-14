/**
 * Formats file size from MB to either MB or GB based on the 1024MB threshold.
 */
export const formatFileSize = (mb: number): string => {
  if (!mb || mb < 0) return '0 MB';
  
  if (mb < 1000) {
    return `${mb} MB`;
  }
  
  const gb = mb / 1000;
  return `${gb.toFixed(2)} GB`;
};
