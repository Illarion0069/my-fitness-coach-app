import badgeBronze from '@/assets/badges/nutrition-bronze.png';
import badgeSilver from '@/assets/badges/nutrition-silver.png';
import badgeGold from '@/assets/badges/nutrition-gold.png';

export type Tier = 'bronze' | 'silver' | 'gold' | null;

const TIER_IMG: Record<Exclude<Tier, null>, string> = {
  bronze: badgeBronze,
  silver: badgeSilver,
  gold: badgeGold,
};

const TIER_RING: Record<Exclude<Tier, null>, string> = {
  bronze: 'shadow-[0_0_0_2px_#cd7f32,0_0_12px_rgba(205,127,50,0.6)]',
  silver: 'shadow-[0_0_0_2px_#c0c0c0,0_0_12px_rgba(192,192,192,0.7)]',
  gold: 'shadow-[0_0_0_2px_#ffd700,0_0_14px_rgba(255,215,0,0.85)]',
};

/**
 * Returns the highest tier achieved from a list of achievement keys.
 * Looks for `nutrition_quality_week_{threshold}` keys.
 */
export function highestTierFromKeys(keys: string[]): Tier {
  const has = (k: string) => keys.includes(k);
  if (has('nutrition_quality_week_95')) return 'gold';
  if (has('nutrition_quality_week_75')) return 'silver';
  if (has('nutrition_quality_week_60')) return 'bronze';
  return null;
}

interface Props {
  tier: Tier;
  /** Size of the medal overlay in pixels */
  size?: number;
  /** Additional positioning classes */
  className?: string;
}

/**
 * Renders a small medal overlay (top-right) for a given tier.
 * Place inside a `relative` parent (typically the avatar wrapper).
 */
const AvatarTierBadge = ({ tier, size = 22, className = '' }: Props) => {
  if (!tier) return null;
  return (
    <div
      style={{ width: size, height: size }}
      className={`absolute -top-1 -right-1 rounded-full bg-background ring-2 ring-background flex items-center justify-center pointer-events-none z-10 ${className}`}
    >
      <img
        src={TIER_IMG[tier]}
        alt={`${tier} tier`}
        className="w-full h-full object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
      />
    </div>
  );
};

export const tierRingClass = (tier: Tier): string => (tier ? TIER_RING[tier] : '');

export default AvatarTierBadge;
