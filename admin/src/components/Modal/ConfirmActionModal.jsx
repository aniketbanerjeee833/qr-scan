import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ConfirmActionModal({
  open,
  onClose,
  onConfirm,
  isLoading,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmClassName = "bg-green-600 hover:bg-green-700 text-white cursor-pointer",
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-2 mt-4">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="cursor-pointer"
          >
            {cancelLabel}
          </Button>

          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className={confirmClassName}
          >
            {isLoading ? "Processing..." : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}