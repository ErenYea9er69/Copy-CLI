import React from "react";
import { toast } from "some-toast-lib";

export function saveDocument() {
  try {
    // ...save logic
    toast.success("Great job! Your document was saved successfully!!!");
  } catch (err) {
    toast.error("Oops! Something went wrong");
  }
}

export function DeleteButton() {
  return (
    <button
      aria-label="Delete this item permanently, this action cannot be undone and there is no way to get it back"
      onClick={() => confirm("Are you sure you want to utilize the delete feature on this item?")}
    >
      Delete
    </button>
  );
}
