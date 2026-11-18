import { useEffect, useState } from 'react';
import { mediaUrl } from '../api.js';
import { initialsFor } from '../format.js';

// Shows the profile photo, or the user's initials when there is no photo yet
// (or when the picture file is missing on the server).
export default function Avatar({ user }) {
  const profile = user.profile || {};
  const src = mediaUrl(profile.photo);
  const [broken, setBroken] = useState(false);

  useEffect(() => { setBroken(false); }, [src]);      // a new photo gets a fresh chance

  if (src && !broken) return <img src={src} alt="" onError={() => setBroken(true)} />;
  return <>{initialsFor(profile.full_name, user.username)}</>;
}