import React from 'react';

/**
 * Utility for continuous keyboard navigation with the Enter key across all form inputs.
 * - When Enter is pressed on an input or select:
 *   - Prevents accidental early form submission.
 *   - Advances focus to the next visible and enabled input/select/submit element.
 *   - Auto-selects text in the next input for rapid overwrite.
 * - On multiline textareas, Enter behaves normally (new line).
 * - On submit buttons, Enter submits the form.
 */
export function handleEnterNavigation(
  e: React.KeyboardEvent<HTMLElement>,
  onLastFieldSubmit?: () => void,
) {
  if (e.key !== 'Enter') return;

  const target = e.target as HTMLElement;

  // Allow normal Enter behavior on textareas
  if (target.tagName === 'TEXTAREA') return;

  // Allow normal Enter behavior on submit buttons
  if (target.tagName === 'BUTTON' && (target as HTMLButtonElement).type === 'submit') {
    return;
  }

  // Find the enclosing form or modal/container
  const form =
    target.closest('form') ||
    target.closest('.modal-body') ||
    target.closest('.quick-entry-form-card') ||
    target.closest('.card');

  if (!form) return;

  const focusableSelectors = [
    'input:not([type="hidden"]):not([disabled]):not([readonly])',
    'select:not([disabled])',
    'textarea:not([disabled]):not([readonly])',
    'button[type="submit"]:not([disabled])',
    '.btn-add-item:not([disabled])',
  ].join(', ');

  const focusables = Array.from(
    form.querySelectorAll<HTMLElement>(focusableSelectors),
  ).filter((el) => {
    // Only visible elements that are part of the active tab/view
    return el.offsetParent !== null && !el.closest('.no-enter-nav');
  });

  const currentIndex = focusables.indexOf(target);

  if (currentIndex !== -1 && currentIndex < focusables.length - 1) {
    e.preventDefault();
    const nextElement = focusables[currentIndex + 1];
    nextElement.focus();
    if (
      nextElement instanceof HTMLInputElement &&
      nextElement.type !== 'date' &&
      nextElement.type !== 'checkbox' &&
      nextElement.type !== 'radio'
    ) {
      try {
        nextElement.select();
      } catch {
        // Ignored for input types that don't support selection
      }
    }
  } else if (currentIndex === focusables.length - 1) {
    if (onLastFieldSubmit) {
      e.preventDefault();
      onLastFieldSubmit();
    }
  }
}
