import { UserRound } from 'lucide-react';

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  online?: boolean;
}

const sizeMap = {
  sm: { box: 'w-10 h-10', text: 'text-sm', badge: 'w-3 h-3', border: 'bottom-0 right-0' },
  md: { box: 'w-12 h-12', text: 'text-base', badge: 'w-3.5 h-3.5', border: 'bottom-0 right-0' },
  lg: { box: 'w-16 h-16', text: 'text-xl', badge: 'w-4 h-4', border: 'bottom-0.5 right-0.5' },
  xl: { box: 'w-28 h-28', text: 'text-3xl', badge: 'w-6 h-6', border: 'bottom-1 right-1' },
};

export function Avatar({ src, name, size = 'md', online = false }: AvatarProps) {
  const s = sizeMap[size];
  return (
    <div className={`relative ${s.box} shrink-0`}>
      <div
        className={`${s.box} hex-clip bg-nest-carbon hairline flex items-center justify-center font-display font-semibold text-nest-white-soft overflow-hidden`}
        style={{ padding: '2px' }}
      >
        <div className="w-full h-full hex-clip bg-nest-abyss flex items-center justify-center overflow-hidden">
          {src ? (
            <img src={src} alt={name ?? 'Profile'} className="w-full h-full object-cover hex-clip" />
          ) : name ? (
            <span className={s.text}>{name.slice(0, 1).toUpperCase()}</span>
          ) : (
            <UserRound className="w-1/2 h-1/2 text-nest-zinc" />
          )}
        </div>
      </div>
      {online && (
        <div
          className={`absolute ${s.border} ${s.badge} hex-badge bg-nest-honey animate-honey-pulse ring-2 ring-nest-void`}
        />
      )}
    </div>
  );
}
