import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

export interface DocumentScanProcessorRef {
    process: (imageUri: string) => Promise<string>;
}

const HTML = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body>
<canvas id="c"></canvas>
<script>
function applyDocumentScan(src, threshold) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function () {
            const canvas = document.getElementById('c');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i + 1], b = data[i + 2];
                // Weighted luminance (human eye sensitivity)
                const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                // Apply contrast boost before threshold
                const boosted = Math.min(255, Math.max(0, (lum - 128) * 1.8 + 128));
                // Binary threshold — white bg, black text
                const val = boosted > (threshold || 160) ? 255 : 0;
                data[i] = data[i + 1] = data[i + 2] = val;
            }
            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

window.addEventListener('message', async (event) => {
    const { uri, threshold } = JSON.parse(event.data);
    const result = await applyDocumentScan(uri, threshold);
    window.ReactNativeWebView.postMessage(JSON.stringify({ result }));
});
</script>
</body>
</html>
`;

const DocumentScanProcessor = forwardRef<DocumentScanProcessorRef>((_, ref) => {
    const webRef = useRef<WebView>(null);
    const resolverRef = useRef<((uri: string) => void) | null>(null);

    useImperativeHandle(ref, () => ({
        process: (imageUri: string): Promise<string> => {
            return new Promise((resolve) => {
                resolverRef.current = resolve;
                // Convert file:// URI to data URI first by reading inline
                const msg = JSON.stringify({ uri: imageUri, threshold: 160 });
                webRef.current?.injectJavaScript(`
                    window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(msg)} }));
                    true;
                `);
            });
        },
    }));

    const onMessage = (event: any) => {
        try {
            const { result } = JSON.parse(event.nativeEvent.data);
            if (resolverRef.current) {
                resolverRef.current(result);
                resolverRef.current = null;
            }
        } catch (e) {
            console.error('Scan processor error:', e);
        }
    };

    return (
        <View style={{ width: 0, height: 0, overflow: 'hidden' }}>
            <WebView
                ref={webRef}
                originWhitelist={['*']}
                source={{ html: HTML }}
                onMessage={onMessage}
                javaScriptEnabled
                style={{ width: 1, height: 1, opacity: 0 }}
            />
        </View>
    );
});

export default DocumentScanProcessor;
