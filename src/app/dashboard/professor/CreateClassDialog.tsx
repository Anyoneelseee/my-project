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
import { ChangeEvent } from "react";

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
          className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl py-2 transition-colors flex items-center justify-center gap-2 shadow-md"
        >
          <Plus className="w-5 h-5" />
          Create
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-gradient-to-br from-gray-800 to-gray-900 border-teal-500/20 rounded-xl shadow-2xl p-6 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-teal-400">
            Create a New Class
          </DialogTitle>
          <DialogDescription className="text-gray-200 mt-2">
            Fill in the details to create a new class.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 gap-2">
            <Label htmlFor="name" className="text-sm font-medium text-teal-300">
              Class Name
            </Label>
            <Input
              id="name"
              value={newClass.name}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setNewClass({ ...newClass, name: e.target.value })
              }
              placeholder="e.g., Introduction to Programming"
              className="w-full p-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-gray-700/50 text-gray-200"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-1 gap-2">
            <Label htmlFor="section" className="text-sm font-medium text-teal-300">
              Section
            </Label>
            <Input
              id="section"
              value={newClass.section}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setNewClass({ ...newClass, section: e.target.value })
              }
              placeholder="e.g., A"
              className="w-full p-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-gray-700/50 text-gray-200"
            />
          </div>
          <div className="grid grid-cols-1 gap-2">
            <Label htmlFor="course" className="text-sm font-medium text-teal-300">
              Course
            </Label>
            <Input
              id="course"
              value={newClass.course}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setNewClass({ ...newClass, course: e.target.value })
              }
              placeholder="e.g., CS101"
              className="w-full p-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-gray-700/50 text-gray-200"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={onCreateClass}
            className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2 rounded-lg transition-colors"
          >
            Create Class
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
