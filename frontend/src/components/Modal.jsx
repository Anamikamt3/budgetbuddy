import { useEffect, useRef } from 'react';

// A pop-up window using the browser's built-in <dialog> element.
// The content is only created while it is open, so forms start fresh every time.
export default function Modal({ open, onClose, title, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="dialogTitle">
      <div className="dialog-body">
        <div className="dialog-head">
          <h2 id="dialogTitle">{title}</h2>
          <button type="button" className="icon-close" aria-label="Close" onClick={onClose}>
            &times;
          </button>
        </div>
        {open && children}
      </div>
    </dialog>
  );
}
