"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

// The Shape Detection API isn't in TypeScript's DOM types yet.
type BarcodeDetectorLike = {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
};
type BarcodeDetectorCtor = new (options: { formats: string[] }) => BarcodeDetectorLike;

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];
const SCAN_EVERY_MS = 150;

function getDetector(): BarcodeDetectorCtor | undefined {
  return (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
}

/**
 * Full-screen camera view that reports the first barcode it sees. Uses the
 * browser's own BarcodeDetector (Chrome on Android); where that's missing it
 * says so and the code has to be typed. Only rendered after a tap, so it
 * never runs on the server.
 */
export default function BarcodeScanner({
  onDetect,
  onClose,
}: {
  onDetect: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(() =>
    getDetector() ? null : "Este navegador no puede leer códigos de barras. Escribí el número.",
  );
  const handleDetect = useEffectEvent(onDetect);

  useEffect(() => {
    const Detector = getDetector();
    if (!Detector) return;

    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    async function start(Detector: BarcodeDetectorCtor) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
      } catch {
        setError("No se pudo abrir la cámara. Revisá el permiso o escribí el número.");
        return;
      }
      const video = videoRef.current;
      if (stopped || !video) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      video.srcObject = stream;
      await video.play().catch(() => {});

      const detector = new Detector({ formats: FORMATS });
      const scan = async () => {
        if (stopped) return;
        try {
          const [hit] = await detector.detect(video);
          if (hit?.rawValue) {
            handleDetect(hit.rawValue);
            return;
          }
        } catch {
          // The first frames may not be ready; try again.
        }
        timer = setTimeout(scan, SCAN_EVERY_MS);
      };
      scan();
    }

    start(Detector);
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <video ref={videoRef} playsInline muted className="min-h-0 flex-1 object-cover" />
      <div className="space-y-3 px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <p className="text-center text-sm">{error ?? "Apuntá al código de barras del envase."}</p>
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-2xl bg-white/15 py-3 font-medium"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
