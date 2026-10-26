import { useEffect } from "react";

/**
 * Custom hook to close modals, popups, and dropdowns when the Escape key is pressed.
 * @param {Function} onClose - Callback invoked when Escape key is pressed.
 * @param {boolean} active - Whether the listener should currently be active.
 */
export function useEscapeKey(onClose, active = true) {
  useEffect(() => {
    if (!active || typeof onClose !== "function") return;

    function handleKeyDown(e) {
      if (e.key === "Escape" || e.keyCode === 27) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, active]);
}

export default useEscapeKey;
