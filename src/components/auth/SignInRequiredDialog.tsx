import { useEffect, useId, useRef } from "react";

type SignInRequiredDialogProps = {
  open: boolean;
  message: string;
  onDismiss: () => void;
  onSignIn: () => void;
  onCreateAccount: () => void;
};

export function SignInRequiredDialog({
  open, message, onDismiss, onSignIn, onCreateAccount,
}: SignInRequiredDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    return () => { if (dialog.open) dialog.close(); };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => { event.preventDefault(); onDismiss(); }}
      onClose={onDismiss}
      className="m-auto w-[90vw] max-w-sm rounded-xl border border-slate-700 bg-slate-800 p-5 text-slate-100 shadow-xl backdrop:bg-black/60"
    >
      <h2 id={titleId} className="mb-2 text-lg font-semibold">Sign in required</h2>
      <p id={descriptionId} className="mb-4 text-sm text-slate-300">{message}</p>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onSignIn} className="rounded-md bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-500">Sign in</button>
        <button type="button" onClick={onCreateAccount} className="rounded-md border border-slate-600 px-3 py-1 text-sm hover:bg-slate-700">Create account</button>
        <button type="button" onClick={onDismiss} className="rounded-md border border-slate-600 px-3 py-1 text-sm hover:bg-slate-700">Cancel</button>
      </div>
    </dialog>
  );
}
