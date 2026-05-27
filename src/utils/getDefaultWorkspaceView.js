import { memberMatchesRole } from './teamMembers';

export function getDefaultWorkspaceView(session, teamMembers) {
  if (!session?.username) return 'home';

  const key = session.username.trim().toLowerCase();
  const member = teamMembers.find(
    (entry) =>
      entry.username?.trim().toLowerCase() === key ||
      entry.name?.trim().toLowerCase() === key,
  );

  if (!member) return 'home';

  if (memberMatchesRole(member, 'Content Creator')) return 'board';
  if (memberMatchesRole(member, 'Editor')) return 'todo';
  if (memberMatchesRole(member, 'Account Manager')) return 'ideas';
  if (memberMatchesRole(member, 'Owner') || memberMatchesRole(member, 'Creative Director')) {
    return 'home';
  }

  return 'home';
}
