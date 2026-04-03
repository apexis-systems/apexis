"use client";

import React, { useRef, useEffect, useState } from 'react';
import { X, Check, RotateCcw, Type, Square, Circle, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageAnnotatorProps {
    imageSrc: string;
    onSave: (annotatedImageDataUrl: string) => void;
    onCancel: () => void;
}

export default function ImageAnnotator({ imageSrc, onSave, onCancel }: ImageAnnotatorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#ef4444'); // Default red
    const [lineWidth, setLineWidth] = useState(3);
    
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            // Calculate dimensions to fit in container
            const container = containerRef.current;
            if (!container) return;
            
            const maxWidth = container.clientWidth;
            const maxHeight = container.clientHeight;
            
            let width = img.width;
            let height = img.height;
            
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width *= ratio;
            height *= ratio;
            
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            
            // Set initial stroke styles
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        };
        img.src = imageSrc;
    }, [imageSrc]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
        }
    }, [color, lineWidth]);

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        let x, y;
        
        if ('touches' in e) {
            x = e.touches[0].clientX - rect.left;
            y = e.touches[0].clientY - rect.top;
        } else {
            x = (e as React.MouseEvent).clientX - rect.left;
            y = (e as React.MouseEvent).clientY - rect.top;
        }

        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        let x, y;
        
        if ('touches' in e) {
            x = e.touches[0].clientX - rect.left;
            y = e.touches[0].clientY - rect.top;
        } else {
            x = (e as React.MouseEvent).clientX - rect.left;
            y = (e as React.MouseEvent).clientY - rect.top;
        }

        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const handleSave = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        onSave(canvas.toDataURL('image/jpeg', 0.9));
    };

    const clear = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = imageSrc;
    };

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/90 animate-in fade-in duration-200">
            {/* Toolbar */}
            <div className="flex items-center justify-between p-4 bg-zinc-900 border-b border-zinc-800">
                <Button variant="ghost" size="icon" onClick={onCancel} className="text-zinc-400 hover:text-white">
                    <X className="h-5 w-5" />
                </Button>
                
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1 bg-zinc-800 rounded-full">
                        {['#ef4444', '#22c55e', '#3b82f6', '#eab308', '#ffffff'].map((c) => (
                            <button
                                key={c}
                                onClick={() => setColor(c)}
                                className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c ? 'scale-125 border-white' : 'border-transparent hover:scale-110'}`}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                    </div>
                    
                    <Button variant="ghost" size="icon" onClick={clear} title="Clear annotations" className="text-zinc-400 hover:text-white">
                        <RotateCcw className="h-5 w-5" />
                    </Button>
                </div>

                <Button onClick={handleSave} className="bg-accent text-accent-foreground">
                    <Check className="h-4 w-4 mr-2" /> Save
                </Button>
            </div>

            {/* Canvas Container */}
            <div ref={containerRef} className="flex-1 relative flex items-center justify-center p-4 overflow-hidden select-none touch-none">
                <canvas
                    ref={canvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="max-w-full max-h-full bg-white shadow-2xl cursor-crosshair rounded-sm"
                />
            </div>
            
            <div className="p-4 bg-zinc-900 text-center text-[10px] text-zinc-500 font-medium tracking-wider uppercase">
                Draw on the image to highlight details
            </div>
        </div>
    );
}
