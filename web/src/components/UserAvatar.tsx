import { Avatar, Tooltip, type MantineSize } from '@mantine/core';
import type { UserSummary } from '../api/types';

export function UserAvatar({ user, size = 'sm' }: { user: UserSummary | null; size?: MantineSize }) {
  const name = user?.name ?? 'Former member';
  return (
    <Tooltip label={name} withArrow>
      <Avatar name={name} color="initials" size={size} radius="xl" />
    </Tooltip>
  );
}
