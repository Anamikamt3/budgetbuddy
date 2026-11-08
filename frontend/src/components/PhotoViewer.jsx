import { useEffect, useRef } from 'react';

// The profile photo shown large in a pop-up.
// It closes with the X button, the Esc key, or a click outside the picture.
export default function PhotoViewer({ open, onClose, src, name }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // A click on the dark area around the picture hits the dialog itself
  function handleClick(e) {
    if (e.target === ref.current) onClose();
  }

  return (
    <dialog ref={ref} className="lightbox" onClose={onClose} onClick={handleClick}
      aria-label={`${name} profile photo`}>
      <button type="button" className="lightbox-close" aria-label="Close photo" onClick={onClose}>
        &times;
      </button>
      {open && src && <img src={src} alt={`${name}'s profile photo`} />}
    </dialog>
  );
}