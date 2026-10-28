import { render } from '@testing-library/react';
import { fireEvent, screen, waitFor } from '@testing-library/dom';
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
    fireEvent.click(screen.getByRole('button', { name: 'Chest' }));
    fireEvent.change(screen.getByLabelText('Chest · cm'), { target: { value: '101,5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(insert).toHaveBeenCalledOnce());
    expect(insert.mock.calls[0][0]).toMatchObject({ user_id: 'test-client', chest_cm: 101.5 });
    expect(insert.mock.calls[0][0]).not.toHaveProperty('weight_kg');
    await waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps history to entries that carry a value for the selected metric and collapses the rest', () => {
    const rows = Array.from({ length: 6 }, (_, i) => ({
      id: `w${i}`,
      measured_at: `2026-10-${String(20 - i).padStart(2, '0')}`,
      weight_kg: 90 - i,
      chest_cm: null,
      waist_cm: null,
      hips_cm: null,
      left_arm_cm: null,
      right_arm_cm: null,
      left_leg_cm: null,
      right_leg_cm: null,
      notes: null,
    }));
    rows.push({
      id: 'chest-only',
      measured_at: '2026-10-13',
      weight_kg: null,
      chest_cm: 101,
      waist_cm: null,
      hips_cm: null,
      left_arm_cm: null,
      right_arm_cm: null,
      left_leg_cm: null,
      right_leg_cm: null,
      notes: null,
    });

    render(<BodyMeasurementsDetail open onClose={vi.fn()} measurements={rows} lang="en" editable />);

    // The 4 latest weight entries show; the chest-only row is not listed as "no value".
    expect(screen.queryByText(/no value/i)).not.toBeInTheDocument();
    expect(screen.getByText('87')).toBeInTheDocument();
    expect(screen.queryByText('86')).not.toBeInTheDocument();
    expect(screen.queryByText('85')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show all 6 entries' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show all 6 entries' }));
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument();
  });
});