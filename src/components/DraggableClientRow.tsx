import { ReactNode, useState } from 'react';
import { Reorder, useDragControls } from 'framer-motion';

interface DraggableClientRowProps {
  value: string;
  disabled: boolean;
  children: (dragHandleProps: { onPointerDown: (e: React.PointerEvent) => void }) => ReactNode;
}

const DraggableClientRow = ({ value, disabled, children }: DraggableClientRowProps) => {
  const controls = useDragControls();
  const [isDragging, setIsDragging] = useState(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(true);
    controls.start(e);
  };

  return (
    <Reorder.Item
      value={value}
      dragListener={false}
      dragControls={controls}
      onDragEnd={() => setIsDragging(false)}
      style={{ touchAction: isDragging ? 'none' : 'auto' }}
    >
      {children({ onPointerDown: handlePointerDown })}
    </Reorder.Item>
  );
};

export default DraggableClientRow;
