import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";

interface CreateClassDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  newClass: { name: string; section: string; course: string };
  setNewClass: (newClass: { name: string; section: string; course: string }) => void;
  onCreateClass: () => void;
}

export function CreateClassDialog({
  isOpen,
  onOpenChange,
  newClass,
  setNewClass,
  onCreateClass,
}: CreateClassDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="default"
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl py-2 transition-colors flex items-center justify-center gap-2 shadow-md"
          // Customize button background color (bg-purple-600) and hover color (hover:bg-purple-700) in className
        >
          <Plus className="w-5 h-5" />
          Create
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-white rounded-xl shadow-2xl p-6 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-gray-900">
            Create a New Class
            {/* Customize title text color (text-gray-900) in className */}
          </DialogTitle>
          <DialogDescription className="text-gray-600 mt-2">
            Fill in the details to create a new class.
            {/* Customize description text color (text-gray-600) in className */}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 gap-2">
            <Label
              htmlFor="name"
              className="text-sm font-medium text-gray-700"
              // Customize label text color (text-gray-700) in className
            >
              Class Name
            </Label>
            <Input
              id="name"
              value={newClass.name}
              onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
              placeholder="e.g., Introduction to Programming"
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              autoFocus
              // Customize input border (border-gray-300) and focus ring (focus:ring-purple-500) in className
            />
          </div>
          <div className="grid grid-cols-1 gap-2">
            <Label
              htmlFor="section"
              className="text-sm font-medium text-gray-700"
              // Customize label text color (text-gray-700) in className
            >
              Section
            </Label>
            <Input
              id="section"
              value={newClass.section}
              onChange={(e) => setNewClass({ ...newClass, section: e.target.value })}
              placeholder="e.g., A"
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              // Customize input border (border-gray-300) and focus ring (focus:ring-purple-500) in className
            />
          </div>
          <div className="grid grid-cols-1 gap-2">
            <Label
              htmlFor="course"
              className="text-sm font-medium text-gray-700"
              // Customize label text color (text-gray-700) in className
            >
              Course
            </Label>
            <Input
              id="course"
              value={newClass.course}
              onChange={(e) => setNewClass({ ...newClass, course: e.target.value })}
              placeholder="e.g., CS101"
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              // Customize input border (border-gray-300) and focus ring (focus:ring-purple-500) in className
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={onCreateClass}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 rounded-lg transition-colors"
            // Customize button background color (bg-purple-600) and hover color (hover:bg-purple-700) in className
          >
            Create Class
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}