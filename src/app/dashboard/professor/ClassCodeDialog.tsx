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
      <DialogContent className="bg-white rounded-xl shadow-2xl p-6 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-gray-900">
            Class Created Successfully!
            {/* Customize title text color (text-gray-900) in className */}
          </DialogTitle>
          <DialogDescription className="text-gray-600 mt-2">
            Share this class code with your students so they can join the class.
            {/* Customize description text color (text-gray-600) in className */}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p
            className="text-center text-xl font-bold text-purple-700 bg-purple-50 px-4 py-2 rounded-lg"
            // Customize class code text color (text-purple-700) and background (bg-purple-50) in className
          >
            {classCode}
          </p>
        </div>
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={() => {
              navigator.clipboard.writeText(classCode);
              alert("Class code copied to clipboard!");
            }}
            className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 rounded-lg transition-colors"
            // Customize button background color (bg-purple-600) and hover color (hover:bg-purple-700) in className
          >
            Copy Code
          </Button>
          <Button
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-2 rounded-lg transition-colors"
            // Customize button background color (bg-gray-200) and hover color (hover:bg-gray-300) in className
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}