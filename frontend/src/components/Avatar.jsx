import { mediaUrl } from '../api.js';
import { initialsFor } from '../format.js';

// Shows the profile photo, or the user's initials when there is no photo yet.
// Put it inside any round container (the CSS makes the picture fill it).
export default function Avatar({ user }) {
  const profile = user.profile || {};
  const src = mediaUrl(profile.photo);
  if (src) return <img src={src} alt="" />;
  return <>{initialsFor(profile.full_name, user.username)}</>;
}