import { cn } from "@/lib/utils";
import { barStep, WAVEFORM_BARS } from "./voice-note";

// Heights in 7 to 66 px, the range the design draws, on the spacing scale.
// Full class names, so Tailwind sees each one.
const HEIGHTS = ["h-1.75", "h-3", "h-4", "h-6", "h-8", "h-10", "h-12", "h-14", "h-16.5"];

// The shape the design draws, used when the person asks for no motion.
const STILL = [
  0.1, 0.3, 0.5, 0.4, 0.7, 0.9, 0.65, 0.5, 0.8, 1, 0.7, 0.42, 0.6, 0.85, 0.55, 0.32, 0.68, 0.95, 0.78, 0.5, 0.3, 0.55, 0.72, 0.4, 0.25, 0.45, 0.32, 0.2, 0.12, 0.05,
];

type VoiceWaveformProps = {
  /** One level from 0 to 1 per bar, newest on the right. */
  levels: number[];
  /** Draw the fixed shape instead of following the microphone. */
  still?: boolean;
};

// Decoration. The timer and the Recording pill say what is happening.
function VoiceWaveform({ levels, still = false }: VoiceWaveformProps) {
  const bars = still ? STILL : levels.slice(-WAVEFORM_BARS);
  return (
    <div aria-hidden="true" className="flex h-16.5 items-center justify-center gap-0.75">
      {bars.map((level, index) => (
        <span key={index} className={cn("w-1 rounded-pill bg-primary transition-[height] duration-100", HEIGHTS[barStep(level)])} />
      ))}
    </div>
  );
}

export { VoiceWaveform };
