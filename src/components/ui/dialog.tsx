import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "cn";
import { XIcon } from "lucide-react";
import type * as React from "react";
import { Button } from "@/components/ui/button";

function Dialog(props: DialogPrimitive.Root.Props) { return <DialogPrimitive.Root data-slot="dialog" {...props} />; }
function DialogTrigger(props: DialogPrimitive.Trigger.Props) { return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />; }
function DialogPortal(props: DialogPrimitive.Portal.Props) { return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />; }
function DialogClose(props: DialogPrimitive.Close.Props) { return <DialogPrimitive.Close data-slot="dialog-close" {...props} />; }
function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
	return <DialogPrimitive.Backdrop className={cn("fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-ending-style:opacity-0 data-starting-style:opacity-0", className)} data-slot="dialog-overlay" {...props} />;
}
function DialogContent({ className, children, ...props }: DialogPrimitive.Popup.Props) {
	return <DialogPortal><DialogOverlay /><DialogPrimitive.Popup className={cn("fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[min(92vw,52rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-background p-5 text-foreground shadow-xl outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0", className)} data-slot="dialog-content" {...props}>{children}<DialogPrimitive.Close aria-label="Close" className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-background/80 text-foreground hover:bg-muted"><XIcon className="size-4" /></DialogPrimitive.Close></DialogPrimitive.Popup></DialogPortal>;
}
function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) { return <DialogPrimitive.Title className={cn("font-medium text-base", className)} data-slot="dialog-title" {...props} />; }
function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) { return <DialogPrimitive.Description className={cn("text-sm text-muted-foreground", className)} data-slot="dialog-description" {...props} />; }
function DialogHeader({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("mb-4 flex flex-col gap-1", className)} {...props} />; }

export { Dialog, DialogTrigger, DialogPortal, DialogClose, DialogOverlay, DialogContent, DialogTitle, DialogDescription, DialogHeader };
