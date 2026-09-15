"use client";

import React, { useEffect, useRef, useState } from "react";
import { 
  ShieldAlert, 
  Lock, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { resolveMediaUrl } from "@/lib/video-storage";

interface ProtectedVideoPlayerProps {
  videoUrl: string;
  lessonTitle: string;
  courseTitle: string;
  studentName?: string;
  studentEmail?: string;
  studentId?: string;
  isCompleted?: boolean;
  onToggleComplete?: () => void;
  onNextLesson?: () => void;
  hasNextLesson?: boolean;
}

export function ProtectedVideoPlayer({
  videoUrl,
  lessonTitle,
  courseTitle,
  studentName = "مستفهم منصة فهمت",
  studentEmail = "student@fahimt.com",
  studentId = "ST-9982",
  isCompleted = false,
  onToggleComplete,
  onNextLesson,
  hasNextLesson = false
}: ProtectedVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isTabFocused, setIsTabFocused] = useState(true);
  const [securityAlert, setSecurityAlert] = useState<string | null>(null);
  const [watermarkPos, setWatermarkPos] = useState({ top: 20, left: 20 });
  const [watermarkSecondaryPos, setWatermarkSecondaryPos] = useState({ top: 70, left: 60 });
  const [currentTimeFormatted, setCurrentTimeFormatted] = useState("");
  const [resolvedSrc, setResolvedSrc] = useState(videoUrl);

  useEffect(() => {
    let isMounted = true;
    resolveMediaUrl(videoUrl).then((src) => {
      if (isMounted && src) {
        setResolvedSrc(src);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [videoUrl]);

  // Update dynamic timestamp for watermark
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeFormatted(now.toLocaleTimeString("ar-EG", { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Float watermarks to random positions every 8 seconds to prevent masking
  useEffect(() => {
    const moveWatermark = () => {
      const randomTop = Math.floor(Math.random() * 70) + 10;
      const randomLeft = Math.floor(Math.random() * 70) + 10;
      setWatermarkPos({ top: randomTop, left: randomLeft });

      const randomTop2 = Math.floor(Math.random() * 70) + 10;
      const randomLeft2 = Math.floor(Math.random() * 70) + 10;
      setWatermarkSecondaryPos({ top: randomTop2, left: randomLeft2 });
    };

    const interval = setInterval(moveWatermark, 8000);
    return () => clearInterval(interval);
  }, []);

  // Anti-Screen Capture & Anti-Inspect Security Listeners
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsTabFocused(false);
        if (videoRef.current) {
          videoRef.current.pause();
          setIsPlaying(false);
        }
      } else {
        setIsTabFocused(true);
      }
    };

    const handleWindowBlur = () => {
      setIsTabFocused(false);
      if (videoRef.current) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    };

    const handleWindowFocus = () => {
      setIsTabFocused(true);
    };

    // Protect against getDisplayMedia (browser screen capture API)
    if (typeof navigator !== "undefined" && navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
      const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getDisplayMedia = async () => {
        setIsTabFocused(false);
        setSecurityAlert("🛑 المتصفح حظر طلب تسجيل أو مشاركة الشاشة لحماية الكورس.");
        if (videoRef.current) videoRef.current.pause();
        throw new Error("Screen capture is prohibited by Fahimt platform DRM.");
      };
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Print Screen or Screenshot combinations (Snipping tool, Win+Shift+S, Mac Cmd+Shift+3/4/5, Ctrl+P)
      if (
        e.key === "PrintScreen" || 
        e.keyCode === 44 ||
        (e.key === "p" && (e.ctrlKey || e.metaKey)) ||
        (e.metaKey && e.shiftKey && (e.key === "3" || e.key === "4" || e.key === "5")) ||
        (e.shiftKey && (e.metaKey || (e as any).windowsKey) && (e.key === "s" || e.key === "S")) ||
        (e.altKey && e.key === "PrintScreen")
      ) {
        e.preventDefault();
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText("");
          }
        } catch (_) {}
        setIsTabFocused(false);
        setSecurityAlert("🛑 ممنوع لقطة الشاشة أو تسجيل الفيديو! المتصفح حظر المحتوى فوراً.");
        if (videoRef.current) videoRef.current.pause();
        setTimeout(() => setSecurityAlert(null), 4500);
      }
      // Inspect Element (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U)
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "J" || e.key === "j" || e.key === "C" || e.key === "c")) ||
        (e.ctrlKey && (e.key === "u" || e.key === "U" || e.key === "s" || e.key === "S"))
      ) {
        e.preventDefault();
        setSecurityAlert("🛑 غير مسموح بفحص الصفحة أو حفظ الفيديو من المتصفح.");
        setTimeout(() => setSecurityAlert(null), 3000);
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("contextmenu", handleContextMenu);

    return () => {
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("contextmenu", handleContextMenu);
    };
  }, []);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = Number(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  };

  const handleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch((err) => {
        console.warn("Fullscreen failed:", err);
      });
    } else {
      document.exitFullscreen?.();
    }
  };

  const formatSeconds = (sec: number) => {
    if (isNaN(sec)) return "00:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Container with relative framing and security prevention */}
      <div 
        ref={containerRef}
        className="relative aspect-video w-full rounded-3xl overflow-hidden bg-black shadow-2xl border-4 border-zinc-800 select-none group"
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* The Native HTML5 Video Element with strict security attributes */}
        <video
          ref={videoRef}
          src={resolvedSrc}
          className={`w-full h-full object-contain transition-all duration-300 ${
            !isTabFocused ? "blur-2xl brightness-50" : ""
          }`}
          playsInline
          controlsList="nodownload noremoteplayback"
          disablePictureInPicture
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false);
            if (!isCompleted && onToggleComplete) {
              onToggleComplete();
            }
          }}
        />

        {/* Dynamic Watermark 1: Moving around the player with student name and id */}
        <div 
          className="absolute pointer-events-none transition-all duration-1000 ease-in-out opacity-45 z-20 flex flex-col items-center select-none text-[11px] md:text-xs text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] font-mono tracking-wider"
          style={{ top: `${watermarkPos.top}%`, left: `${watermarkPos.left}%` }}
        >
          <span className="font-black bg-black/60 border border-white/20 px-2 py-0.5 rounded-md backdrop-blur-sm text-yellow-300">
            {studentName} • {studentId}
          </span>
          <span className="text-[10px] text-zinc-200 font-bold bg-black/40 px-1.5 rounded mt-0.5">{studentEmail} • {currentTimeFormatted}</span>
        </div>

        {/* Dynamic Watermark 2: Secondary subtle diagonal ID */}
        <div 
          className="absolute pointer-events-none transition-all duration-1000 ease-in-out opacity-30 z-20 select-none text-[11px] text-white font-mono bg-black/50 px-2 py-0.5 rounded border border-white/10"
          style={{ top: `${watermarkSecondaryPos.top}%`, left: `${watermarkSecondaryPos.left}%` }}
        >
          فهمت • {studentId} • محمي ضد التسريب
        </div>

        {/* Permanent Top Security Badge */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-black/70 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 text-white text-xs font-bold pointer-events-none">
          <Lock className="w-3.5 h-3.5 text-emerald-400" />
          <span>🔒 ممنوع لقطة الشاشة وتسجيل الفيديو</span>
        </div>

        {/* Overlay when Tab Loses Focus / Screenshot triggered (anti-screen capture & recorders) */}
        {!isTabFocused && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl text-white p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-600/20 text-red-500 flex items-center justify-center animate-pulse">
              <ShieldAlert className="w-9 h-9" />
            </div>
            <div className="space-y-1.5 max-w-md">
              <h3 className="text-xl font-black text-red-400">🛑 تم حجب الشاشة لحماية الفيديو</h3>
              <p className="text-zinc-300 text-sm leading-relaxed">
                المتصفح بيمنع لقطة الشاشة وتسجيل الفيديو تلقائياً عشان يحافظ على حقوق المُفهم ومجهوده. دوس على الزرار تحت عشان تكمل مشاهدة عادي.
              </p>
            </div>
            <Button 
              onClick={() => {
                setIsTabFocused(true);
                if (videoRef.current) {
                  videoRef.current.play();
                  setIsPlaying(true);
                }
              }} 
              className="bg-primary hover:bg-primary/90 text-white font-black rounded-xl px-6 h-11"
            >
              كمّل مشاهدة الدرس
            </Button>
          </div>
        )}

        {/* Warning notification banner */}
        {securityAlert && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 bg-red-600/95 text-white px-5 py-2.5 rounded-2xl shadow-2xl font-black text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
            <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0" />
            <span>{securityAlert}</span>
          </div>
        )}

        {/* Play/Pause center overlay trigger when clicked */}
        <div 
          onClick={togglePlay}
          className="absolute inset-0 z-10 cursor-pointer flex items-center justify-center bg-transparent"
        >
          {!isPlaying && isTabFocused && (
            <div className="w-20 h-20 rounded-full bg-primary/90 text-white flex items-center justify-center shadow-2xl hover:scale-110 transition-transform">
              <Play className="w-9 h-9 fill-current translate-x-0.5" />
            </div>
          )}
        </div>

        {/* Custom Modern Video Control Bar */}
        <div className="absolute bottom-0 inset-x-0 z-20 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col gap-2 transition-opacity duration-200">
          {/* Progress Slider */}
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-zinc-600 rounded-lg appearance-none cursor-pointer accent-primary hover:h-2 transition-all"
          />

          <div className="flex items-center justify-between text-white text-xs font-bold pt-1">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={togglePlay}
                className="text-white hover:bg-white/20 h-8 w-8 rounded-lg"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMute}
                className="text-white hover:bg-white/20 h-8 w-8 rounded-lg"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>

              <span className="font-mono text-zinc-300">
                {formatSeconds(currentTime)} / {formatSeconds(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
                  }
                }}
                title="تراجع 10 ثوانٍ"
                className="text-white hover:bg-white/20 h-8 w-8 rounded-lg"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleFullscreen}
                title="شاشة كاملة"
                className="text-white hover:bg-white/20 h-8 w-8 rounded-lg"
              >
                <Maximize className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Lesson Footer Controls */}
      <div className="bg-white dark:bg-zinc-900 border rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1 text-right w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-bold border-primary text-primary">الدرس الحالي</Badge>
            <h4 className="font-black text-lg text-zinc-900 dark:text-white">{lessonTitle}</h4>
          </div>
          <p className="text-xs text-zinc-500 font-bold">{courseTitle}</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {onToggleComplete && (
            <Button
              onClick={onToggleComplete}
              variant={isCompleted ? "outline" : "default"}
              className={`rounded-xl font-black gap-2 text-sm ${
                isCompleted 
                  ? "border-emerald-500 text-emerald-600 bg-emerald-50 hover:bg-emerald-100" 
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {isCompleted ? "تم إنهاء الدرس" : "تحديد كمكتمل"}
            </Button>
          )}

          {hasNextLesson && onNextLesson && (
            <Button
              onClick={onNextLesson}
              className="bg-primary hover:bg-primary/90 text-white rounded-xl font-black gap-2 text-sm"
            >
              <span>الدرس التالي</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
