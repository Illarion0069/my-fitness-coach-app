import { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Trash2 } from 'lucide-react';

interface SwipeableClientCardProps {
  children: React.ReactNode;
  onDelete: () => void;
  clientName: string;
  lang: string;
  disabled?: boolean;
}

const SWIPE_THRESHOLD = -80;

const SwipeableClientCard = ({ children, onDelete, clientName, lang, disabled = false }: SwipeableClientCardProps) => {
  const [confirming, setConfirming] = useState(false);
  const x = useMotionValue(0);
  const deleteOpacity = useTransform(x, [-120, -60, 0], [1, 0.8, 0]);
  const deleteScale = useTransform(x, [-120, -60, 0], [1, 0.8, 0.5]);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x < SWIPE_THRESHOLD) {
      setConfirming(true);
    }
  };

  if (confirming) {
    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4 flex items-center justify-between gap-3"
      >
        <p className="text-xs text-destructive font-semibold flex-1">
          {lang === 'en' ? `Delete ${clientName}?` : `Удалить ${clientName}?`}
        </p>
        <button
          onClick={onDelete}
          className="bg-destructive text-destructive-foreground text-xs font-bold px-4 py-2 rounded-xl"
        >
          {lang === 'en' ? 'Delete' : 'Удалить'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="bg-secondary text-foreground text-xs font-bold px-4 py-2 rounded-xl"
        >
          {lang === 'en' ? 'Cancel' : 'Отмена'}
        </button>
      </motion.div>
    );
  }

  if (disabled) {
    return (
      <div ref={containerRef} className="relative rounded-2xl">
        {children}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-2xl">
      {/* Delete background */}
      <motion.div
        style={{ opacity: deleteOpacity, scale: deleteScale }}
        className="absolute inset-0 bg-destructive/90 rounded-2xl flex items-center justify-end pr-6"
      >
        <Trash2 className="w-5 h-5 text-destructive-foreground" />
      </motion.div>

      {/* Draggable card */}
      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: -120, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        className="relative z-10"
      >
        {children}
      </motion.div>
    </div>
  );
};

export default SwipeableClientCard;
