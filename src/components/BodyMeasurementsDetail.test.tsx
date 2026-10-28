import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BodyMeasurementsDetail from './BodyMeasurementsDetail';

const { insert } = vi.hoisted(() => ({ insert: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: 'test-trainer' } } }) },
  from: () => ({ insert }),
} }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('recharts', () => ({
  ResponsiveContainer: () => null, LineChart: () => null, Line: () => null,
  XAxis: () => null, YAxis: () => null, CartesianGrid: () => null, Tooltip: () => null,
}));

describe('same-screen measurement entry', () => {
  beforeEach(() => { insert.mockReset(); insert.mockResolvedValue({ error: null }); });
  it('saves the selected chest metric without writing other body parts or closing the screen', async () => {
    const onClose = vi.fn();
    const onChanged = vi.fn();
    render(<BodyMeasurementsDetail open onClose={onClose} measurements={[]} lang="en" userId="test-client" onChanged={onChanged} />);
    fireEvent.click(screen.getByRole('button', { name: 'Chest', exact: true }));
    fireEvent.change(screen.getByLabelText('Chest · cm'), { target: { value: '101,5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }));
    await waitFor(() => expect(insert).toHaveBeenCalledOnce());
    expect(insert.mock.calls[0][0]).toMatchObject({ user_id: 'test-client', chest_cm: 101.5 });
    expect(insert.mock.calls[0][0]).not.toHaveProperty('weight_kg');
    await waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
    expect(onClose).not.toHaveBeenCalled();
  });
});