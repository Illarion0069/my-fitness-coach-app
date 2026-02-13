import { ReactNode } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { GripVertical } from 'lucide-react';

interface DraggableClientRowProps {
  value: string;
  disabled: boolean;
  children: (dragHandleProps: { onPointerDown: (e: React.PointerEvent) => void }) => ReactNode;
}

const DraggableClientRow = ({ value, disabled, children }: DraggableClientRowProps) => {
  const controls = useDragControls();

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    controls.start(e);
  };

  return (
    <Reorder.Item value={value} dragListener={false} dragControls={controls}>
      {children({ onPointerDown: handlePointerDown })}
    </Reorder.Item>
  );
};

export default DraggableClientRow;
