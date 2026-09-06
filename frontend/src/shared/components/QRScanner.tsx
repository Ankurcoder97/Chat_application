import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, CameraOff, RefreshCw, X, Image as ImageIcon } from 'lucide-react';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose?: () => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const streamRef = useRef<MediaStream | null>(null);
  const scanAnimationId = useRef<number | null>(null);

  const startCamera = async () => {
    setError(null);
    stopCamera();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { min: 640, ideal: 1280 },
          height: { min: 480, ideal: 720 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setIsScanning(true);
        startScanningLoop();
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setError('Unable to access camera. Please allow camera permissions in your browser or upload a QR image.');
    }
  };

  const stopCamera = () => {
    if (scanAnimationId.current) {
      cancelAnimationFrame(scanAnimationId.current);
      scanAnimationId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startScanningLoop = () => {
    const scanFrame = async () => {
      if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
        scanAnimationId.current = requestAnimationFrame(scanFrame);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // 1. Try Native BarcodeDetector
        if ('BarcodeDetector' in window) {
          try {
            const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
            const barcodes = await detector.detect(video);
            if (barcodes && barcodes.length > 0) {
              const raw = barcodes[0].rawValue;
              if (raw) {
                if (navigator.vibrate) navigator.vibrate(50);
                stopCamera();
                onScan(raw);
                return;
              }
            }
          } catch {
            // Fallback to jsQR
          }
        }

        // 2. jsQR Engine Fallback with 'attemptBoth' (light on dark & dark on light)
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });

        if (code && code.data) {
          if (navigator.vibrate) navigator.vibrate(50);
          stopCamera();
          onScan(code.data);
          return;
        }
      }

      scanAnimationId.current = requestAnimationFrame(scanFrame);
    };

    scanAnimationId.current = requestAnimationFrame(scanFrame);
  };

  // Image Upload Scanner Fallback
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });
        if (code && code.data) {
          stopCamera();
          onScan(code.data);
        } else {
          alert('Could not find a valid QR code in the selected image.');
        }
      }
    };
    img.src = URL.createObjectURL(file);
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [facingMode]);

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  return (
    <div className="relative flex flex-col items-center justify-center w-full bg-black rounded-2xl overflow-hidden shadow-elevated border border-border-default/60">
      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />

      {/* Video Feed */}
      <video
        ref={videoRef}
        className="w-full h-64 sm:h-72 object-cover bg-black"
        muted
        playsInline
      />

      {/* Viewfinder Target Overlay */}
      {isScanning && !error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-48 h-48 sm:w-52 sm:h-52 border-2 border-accent-500 rounded-2xl relative shadow-lg">
            <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-accent-400 rounded-tl-lg" />
            <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-accent-400 rounded-tr-lg" />
            <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-accent-400 rounded-bl-lg" />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-accent-400 rounded-br-lg" />
            <div className="w-full h-0.5 bg-accent-400/80 shadow-[0_0_8px_#38bdf8] animate-bounce mt-24" />
          </div>
        </div>
      )}

      {/* Controls Overlay */}
      <div className="absolute top-2.5 right-2.5 flex items-center space-x-1.5 z-10">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-full backdrop-blur-sm transition-colors"
          title="Upload QR image"
        >
          <ImageIcon size={16} />
        </button>
        <button
          onClick={toggleCamera}
          className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-full backdrop-blur-sm transition-colors"
          title="Flip camera"
        >
          <RefreshCw size={16} />
        </button>
        {onClose && (
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-full backdrop-blur-sm transition-colors"
            title="Close scanner"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Instruction Banner */}
      <div className="absolute bottom-2.5 inset-x-4 flex items-center justify-center bg-black/60 backdrop-blur-md py-1.5 px-3 rounded-xl text-[11px] text-white/90 text-center pointer-events-none">
        <Camera size={13} className="mr-1.5 text-accent-400" />
        <span>Align QR in box or tap image icon to upload photo</span>
      </div>

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 bg-surface-base/95 p-6 flex flex-col items-center justify-center text-center space-y-3 z-20">
          <CameraOff size={32} className="text-rose-500" />
          <p className="text-xs text-text-primary font-medium">{error}</p>
          <div className="flex items-center space-x-2">
            <button
              onClick={startCamera}
              className="px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-xl text-xs font-semibold"
            >
              Retry Camera
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-surface-muted hover:bg-surface-elevated text-text-primary rounded-xl text-xs font-semibold"
            >
              Choose Image
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
