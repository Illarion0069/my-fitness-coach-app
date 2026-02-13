import { User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ProfileIconProps {
  onClick: () => void;
}

const ProfileIcon = ({ onClick }: ProfileIconProps) => {
  const { user, profile } = useAuth();

  const getInitials = () => {
    if (!profile?.full_name) return '';
    const parts = profile.full_name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  };

  if (user && profile) {
    return (
      <button
        onClick={onClick}
        className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-[11px] hover:scale-105 transition-transform"
        aria-label="Profile"
      >
        {getInitials()}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all"
      aria-label="Sign in"
    >
      <User className="w-4 h-4" />
    </button>
  );
};

export default ProfileIcon;
