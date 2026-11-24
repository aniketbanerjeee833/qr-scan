
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function DeleteAlertModal({
  open,
  onClose,
  onConfirm,
  isDeleting,
  itemName,
}) {
  const lastItemName = useRef(itemName);

  // Update the ref whenever a valid item name is provided.
  if (open && itemName) {
    lastItemName.current = itemName;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && !isDeleting) {
          onClose();
        }
      }}
    >
      <DialogContent
        className="z-[200] max-w-sm "
        onEscapeKeyDown={(e) => {
          if (isDeleting) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (isDeleting) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Confirm Delete</DialogTitle>
        </DialogHeader>

        <p className="mt-1 text-sm text-gray-600">
          Are you sure you want to delete{" "}
          <span className="font-semibold text-gray-900">
            {lastItemName.current || "this item"}
          </span>
          ? This action cannot be undone.
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
            className="cursor-pointer"
          >
            Cancel
          </Button>

          <Button
            onClick={onConfirm}
            disabled={isDeleting}
            className="cursor-pointer bg-rose-600 text-white hover:bg-rose-700"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
