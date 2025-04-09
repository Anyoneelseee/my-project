// src/app/dashboard/professor/ClassCodeDialog.tsx
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from "@/components/ui/dialog";
  import { Button } from "@/components/ui/button";
  
  interface ClassCodeDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    classCode: string;
  }
  
  export function ClassCodeDialog({ isOpen, onOpenChange, classCode }: ClassCodeDialogProps) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Class Created Successfully!</DialogTitle>
            <DialogDescription>
              Share this class code with your students so they can join the class.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-center text-lg font-bold">{classCode}</p>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                navigator.clipboard.writeText(classCode);
                alert("Class code copied to clipboard!");
              }}
            >
              Copy Code
            </Button>
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }