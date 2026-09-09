'use client';

import { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { Eraser, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SignaturePadHandle {
  /// Returns a PNG data URL of the signature on a white background, or null if empty.
  toPng: () => string | null;
  clear: () => void;
  isEmpty: () => boolean;
}

interface SignaturePadProps {
  className?: string;
  /// Called whenever the empty state changes.
  onEmptyChange?: (empty: boolean) => void;
}

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  function SignaturePad({ className, onEmptyChange }, ref) {
    const sigRef = useRef<SignatureCanvas | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [size, setSize] = useState({ width: 320, height: 220 });
    const [isEmpty, setIsEmpty] = useState(true);

    useImperativeHandle(ref, () => ({
      toPng: () => {
        const sig = sigRef.current;
        if (!sig || sig.isEmpty()) return null;
        // SignatureCanvas.toDataURL returns the PNG of the canvas.
        // We set backgroundColor to opaque white above, so the canvas already has a clean white bg.
        return sig.toDataURL('image/png');
      },
      clear: () => {
        sigRef.current?.clear();
        setIsEmpty(true);
        onEmptyChange?.(true);
      },
      isEmpty: () => (sigRef.current ? sigRef.current.isEmpty() : true),
    }));

    // Responsive sizing: measure parent width, keep ~3:2 ratio.
    useEffect(() => {
      if (!containerRef.current) return;
      const update = () => {
        if (!containerRef.current) return;
        const width = containerRef.current.clientWidth;
        const height = Math.max(180, Math.round(width * 0.55));
        setSize({ width, height });
      };
      update();
      const ro = new ResizeObserver(update);
      ro.observe(containerRef.current);
      window.addEventListener('orientationchange', update);
      return () => {
        ro.disconnect();
        window.removeEventListener('orientationchange', update);
      };
    }, []);

    // Prevent page scrolling/touch scrolling while drawing on the canvas.
    useEffect(() => {
      const el = sigRef.current?.getCanvas();
      if (!el) return;
      const prevent = (e: TouchEvent) => {
        // Only block scrolling when the user is interacting with the canvas
        if (e.cancelable) e.preventDefault();
      };
      el.style.touchAction = 'none';
      el.addEventListener('touchstart', prevent, { passive: false });
      el.addEventListener('touchmove', prevent, { passive: false });
      return () => {
        el.removeEventListener('touchstart', prevent);
        el.removeEventListener('touchmove', prevent);
      };
    }, [size]);

    return (
      <div
        ref={containerRef}
        className={cn(
          'relative w-full rounded-lg border-2 border-dashed border-slate-300 bg-white overflow-hidden',
          className
        )}
        style={{ height: size.height }}
      >
        <SignatureCanvas
          ref={sigRef}
          canvasProps={{
            width: size.width,
            height: size.height,
            className: 'signature-canvas block touch-none',
          }}
          backgroundColor="rgba(255,255,255,1)"
          penColor="#0f172a"
          minWidth={0.7}
          maxWidth={2.6}
          velocityFilterWeight={0.6}
          onBegin={() => {
            if (isEmpty) {
              setIsEmpty(false);
              onEmptyChange?.(false);
            }
          }}
          onEnd={() => {
            const e = sigRef.current?.isEmpty() ?? true;
            setIsEmpty(e);
            onEmptyChange?.(e);
          }}
        />
        {/* Empty-state hint */}
        {isEmpty && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-slate-400 select-none">
            <span className="text-sm font-medium">Sign here with your finger</span>
            <span className="text-xs mt-1">Touch & drag inside this box</span>
          </div>
        )}
        {/* Baseline */}
        <div className="pointer-events-none absolute left-6 right-6 bottom-10 border-b border-slate-200" />
        <div className="absolute left-3 bottom-2 flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              sigRef.current?.clear();
              setIsEmpty(true);
              onEmptyChange?.(true);
            }}
            className="h-8"
          >
            <Eraser className="h-4 w-4 mr-1" /> Clear
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              // Undo last stroke by popping from data and re-rendering from data
              const sig = sigRef.current as unknown as {
                fromData?: (data: never) => void;
                toData?: () => never[];
              };
              if (!sig || !sig.toData || !sig.fromData) return;
              const data = sig.toData();
              if (!data || data.length === 0) return;
              data.pop();
              sig.fromData(data as never);
              const empty = sigRef.current?.isEmpty() ?? true;
              setIsEmpty(empty);
              onEmptyChange?.(empty);
            }}
            className="h-8"
          >
            <Undo2 className="h-4 w-4 mr-1" /> Undo
          </Button>
        </div>
      </div>
    );
  }
);

/// (kept for future use) Composite a transparent PNG data URL onto a white background.
// Currently unused because SignatureCanvas already has a white background set via backgroundColor prop.
