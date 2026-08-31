import * as FileSystem from 'expo-file-system/legacy';

let VideoCompressor: any = null;
try {
    const compressorModule = require('react-native-compressor');
    VideoCompressor = compressorModule.Video;
} catch (e) {
    console.warn('react-native-compressor not available, video compression will fallback to original');
}

export interface VideoCompressionResult {
    uri: string;
    size: number;
}

/**
 * Compresses a video file to an optimal 720p / medium quality
 * to keep file size low while maintaining decent visual fidelity.
 * 
 * @param uri Local file URI of the video
 * @param onProgress Callback with progress from 0 to 1
 */
export async function compressVideo(
    uri: string,
    onProgress?: (progress: number) => void
): Promise<VideoCompressionResult> {
    if (!uri) {
        throw new Error('No URI provided for video compression');
    }

    try {
        if (VideoCompressor && typeof VideoCompressor.compress === 'function') {
            const compressedUri = await VideoCompressor.compress(
                uri,
                {
                    compressionMethod: 'auto',
                    minimumFileSizeForCompress: 1,
                    maxSize: 1280, // Cap resolution at 1280 (720p)
                },
                (progress: number) => {
                    if (onProgress) {
                        onProgress(progress);
                    }
                }
            );

            // Get compressed file size
            let size = 0;
            try {
                const info = await FileSystem.getInfoAsync(compressedUri);
                if (info.exists && info.size) {
                    size = info.size;
                }
            } catch (err) {
                console.warn('Could not read compressed video file info:', err);
            }

            return {
                uri: compressedUri,
                size
            };
        }
    } catch (err) {
        console.warn('Video compression error, falling back to original video:', err);
    }

    // Fallback if compressor unavailable or error occurred
    let originalSize = 0;
    try {
        const info = await FileSystem.getInfoAsync(uri);
        if (info.exists && info.size) {
            originalSize = info.size;
        }
    } catch {}

    return {
        uri,
        size: originalSize
    };
}
